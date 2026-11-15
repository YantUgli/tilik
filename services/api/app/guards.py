"""Pengaman biaya (T-20): kunci rate limit per IP, batas token harian, cache hasil L4 LLM.

Semua state in-memory per instance app: hilang saat restart atau scale-to-zero, dan tidak
dibagi antar-replika. IP klien hanya dipakai sebagai kunci limiter, tidak pernah ditulis ke log
(NFR-PRIV-01). Cache menyimpan hasil (output LLM tervalidasi), bukan input (NFR-COST-02).
"""

from __future__ import annotations

import hashlib
import time
from collections import OrderedDict
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from starlette.requests import Request

from app.llm_schema import LlmTextOutput

Clock = Callable[[], float]  # detik epoch (time.time); di-inject di tes

WIB = timedelta(hours=7)
CACHE_MAX_ENTRIES = 512
CACHE_TTL_S = 24 * 60 * 60


def client_ip(request: Request) -> str:
    """Kunci rate limit: entri PALING KANAN `X-Forwarded-For`, atau IP koneksi.

    Asumsi (belum terverifikasi di FastAPI Cloud): proxy platform menambahkan IP klien di ujung
    kanan header. Entri di kirinya bisa dipalsukan klien, jadi diabaikan.
    """
    entries = [
        part.strip()
        for value in request.headers.getlist("x-forwarded-for")
        for part in value.split(",")
        if part.strip()
    ]
    if entries:
        return entries[-1]
    return request.client.host if request.client else "unknown"


def wib_day(now: float) -> str:
    """Tanggal kalender WIB (UTC+7) untuk detik epoch `now`; ganti hari pukul 00.00 WIB."""
    return (datetime.fromtimestamp(now, UTC) + WIB).date().isoformat()


class DailyTokenBudget:
    """Penghitung tokens_in + tokens_out per hari WIB (deviasi NFR-COST-01: token, bukan USD).

    Batasnya lunak: request yang sedang berjalan saat batas tercapai tetap dihitung, jadi
    pemakaian bisa melewati batas sebesar beberapa panggilan.
    """

    def __init__(self, limit: int, clock: Clock = time.time) -> None:
        self.limit = limit
        self._clock = clock
        self._day = wib_day(clock())
        self._used = 0

    def _roll(self) -> None:
        today = wib_day(self._clock())
        if today != self._day:
            self._day, self._used = today, 0

    @property
    def used(self) -> int:
        self._roll()
        return self._used

    def exhausted(self) -> bool:
        return self.used >= self.limit

    def add(self, tokens_in: int | None, tokens_out: int | None) -> None:
        self._roll()
        self._used += (tokens_in or 0) + (tokens_out or 0)


def _normalize(text: str | None) -> str:
    return " ".join((text or "").split())


def cache_key(model: str, caption: str | None, ocr_text: str | None) -> str:
    """sha256(model \\0 caption ternormalisasi spasi \\0 ocr_text). Kunci tidak pernah dicatat."""
    raw = "\x00".join((model, _normalize(caption), ocr_text or ""))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ResultCache:
    """LRU + TTL untuk output L4 LLM yang `ok`. Nilai: (nama provider, LlmTextOutput)."""

    def __init__(self, max_entries: int = CACHE_MAX_ENTRIES, ttl_s: float = CACHE_TTL_S,
                 clock: Clock = time.time) -> None:
        self.max_entries = max_entries
        self.ttl_s = ttl_s
        self._clock = clock
        self._data: OrderedDict[str, tuple[float, str, LlmTextOutput]] = OrderedDict()

    def __len__(self) -> int:
        return len(self._data)

    def get(self, key: str) -> tuple[str, LlmTextOutput] | None:
        item = self._data.get(key)
        if item is None:
            return None
        stored_at, provider, output = item
        if self._clock() - stored_at >= self.ttl_s:
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return provider, output

    def put(self, key: str, provider: str, output: LlmTextOutput) -> None:
        self._data[key] = (self._clock(), provider, output)
        self._data.move_to_end(key)
        while len(self._data) > self.max_entries:
            self._data.popitem(last=False)


class LlmGuard:
    """Gabungan cache + anggaran yang dipakai lapis L4 LLM."""

    def __init__(self, model: str, daily_token_budget: int, clock: Clock = time.time) -> None:
        self.model = model
        self.budget = DailyTokenBudget(daily_token_budget, clock)
        self.cache = ResultCache(clock=clock)
