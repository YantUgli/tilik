"""Log akses tanpa konten (NFR-PRIV-01).

Akses: request_id, method, path (tanpa query), status, latensi. LLM: request_id, provider,
status, latensi, token in/out, status HTTP. Body, query string,
header, dan pesan exception tidak pernah ditulis.
"""

from __future__ import annotations

import logging
import sys

access_log = logging.getLogger("tilik.access")
llm_log = logging.getLogger("tilik.llm")
error_log = logging.getLogger("tilik.error")


def configure_logging() -> None:
    root = logging.getLogger("tilik")
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root.addHandler(handler)
    root.setLevel(logging.INFO)
    # Access log uvicorn memuat IP klien dan query string; `fastapi run` (FastAPI Cloud)
    # menyalakannya tanpa bisa diberi flag. Uvicorn mengonfigurasi logging sebelum app
    # diimpor, jadi mematikannya di sini bertahan. Penggantinya: tilik.access.
    logging.getLogger("uvicorn.access").disabled = True


def log_access(request_id: str, method: str, path: str, status: int, latency_ms: int) -> None:
    access_log.info(
        "request_id=%s method=%s path=%s status=%d latency_ms=%d",
        request_id,
        method,
        path,
        status,
        latency_ms,
    )


def log_unhandled(request_id: str, exc: BaseException) -> None:
    # Hanya nama kelas; pesan dan traceback bisa memuat input pengguna.
    error_log.error("request_id=%s unhandled=%s", request_id, type(exc).__name__)


def log_llm(
    request_id: str,
    provider: str | None,
    status: str,
    latency_ms: int,
    tokens_in: int | None,
    tokens_out: int | None,
    http_status: int | None,
) -> None:
    """Satu baris per panggilan lapis L4 LLM. Tanpa teks, body respons, atau pesan error."""
    llm_log.info(
        "request_id=%s provider=%s status=%s latency_ms=%d tokens_in=%s tokens_out=%s http_status=%s",
        request_id,
        provider or "-",
        status,
        latency_ms,
        "-" if tokens_in is None else tokens_in,
        "-" if tokens_out is None else tokens_out,
        "-" if http_status is None else http_status,
    )
