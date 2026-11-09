"""Transport httpx tiruan untuk `--dry-run` dan tes. Tidak ada panggilan jaringan.

Perilaku (deterministik, per instance transport):
- `Authorization` tidak sama dengan key yang diharapkan → 401.
- `model` = WRONG_MODEL → 404.
- timeout baca klien ≤ 1 detik → `httpx.ReadTimeout` (meniru P5 timeout).
- request ke-31 dan seterusnya → 429 dengan `retry-after` dan `x-ratelimit-*`
  (meniru limit 30 RPM Groq di P4).
- respons sukses ke-3 untuk percobaan pertama ber-`response_format` → konten
  dibungkus blok kode markdown (tidak valid), supaya jalur retry P3 teruji.
"""

from __future__ import annotations

import json

import httpx

from .config import WRONG_MODEL

MOCK_RPM = 30

_VALID_OUTPUT = {
    "findings": [
        {
            "category": "jadwal_pergerakan",
            "severity": "tinggi",
            "evidence_text": "besok subuh suami berangkat bareng Yonif 999/Contoh",
            "where": "caption",
            "explanation": "Menyebut waktu keberangkatan satuan. Informasi ini bisa dipakai pihak lain.",
        }
    ]
}


def _err(status: int, message: str, code: str, headers: dict[str, str] | None = None) -> httpx.Response:
    body = {"error": {"message": message, "type": "invalid_request_error", "code": code}}
    return httpx.Response(status, json=body, headers=headers)


def make_mock_transport(provider: str, expected_key: str) -> httpx.MockTransport:
    state = {"n": 0, "ok": 0}

    def ratelimit_headers(remaining: int) -> dict[str, str]:
        if provider != "groq":
            return {"x-request-id": f"mock-{state['n']}"}
        return {
            "x-request-id": f"mock-{state['n']}",
            "x-ratelimit-limit-requests": "1000",
            "x-ratelimit-remaining-requests": str(max(0, 1000 - state["n"])),
            "x-ratelimit-reset-requests": "1m26s",
            "x-ratelimit-limit-tokens": "6000",
            "x-ratelimit-remaining-tokens": str(max(0, remaining)),
            "x-ratelimit-reset-tokens": "7.66s",
        }

    def handler(request: httpx.Request) -> httpx.Response:
        state["n"] += 1
        timeout = request.extensions.get("timeout") or {}
        if (timeout.get("read") or 99) <= 1.0:
            raise httpx.ReadTimeout("mock: klien timeout", request=request)

        if request.headers.get("authorization") != f"Bearer {expected_key}":
            return _err(401, "Invalid API Key", "invalid_api_key")

        body = json.loads(request.content)
        if body.get("model") == WRONG_MODEL:
            return _err(404, f"The model `{WRONG_MODEL}` does not exist", "model_not_found")

        if state["n"] > MOCK_RPM:
            headers = ratelimit_headers(0)
            headers["retry-after"] = "2"
            return _err(429, "Rate limit reached for requests (mock)", "rate_limit_exceeded", headers)

        state["ok"] += 1
        content = json.dumps(_VALID_OUTPUT, ensure_ascii=False)
        is_first_attempt = len(body.get("messages", [])) <= 2
        if body.get("response_format") and is_first_attempt and state["ok"] == 3:
            content = f"```json\n{content}\n```"

        prompt_tokens = len(request.content) // 4
        completion_tokens = max(1, min(len(content) // 4, int(body.get("max_tokens") or 1)))
        payload = {
            "id": f"mock-{state['n']}",
            "object": "chat.completion",
            "model": body.get("model"),
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop" if completion_tokens < int(body.get("max_tokens") or 1) else "length",
            }],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }
        return httpx.Response(200, json=payload, headers=ratelimit_headers(6000 - prompt_tokens))

    return httpx.MockTransport(handler)
