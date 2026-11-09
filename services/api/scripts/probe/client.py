"""Klien chat completions minimal untuk probe (httpx, sinkron).

Hanya memanggil `ProviderSpec.chat_url` (chat completions, NFR-PRIV-03). Header
request (berisi key) tidak pernah dicatat; dari header respons hanya yang ada di
allowlist yang disimpan.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field

import httpx

from .config import ProviderSpec
from .errors import ProviderError, classify_error

_HEADER_ALLOW_EXACT = {"retry-after", "x-request-id", "content-type"}


def _keep_header(name: str) -> bool:
    n = name.lower()
    return n in _HEADER_ALLOW_EXACT or "ratelimit" in n


@dataclass
class CallResult:
    status: int | None
    latency_s: float
    error: ProviderError | None = None
    content: str | None = None
    finish_reason: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    headers: dict[str, str] = field(default_factory=dict)
    body_shape: dict | None = None  # hanya untuk respons gagal

    @property
    def ok(self) -> bool:
        return self.error is None

    @property
    def error_code(self) -> str | None:
        if not self.body_shape:
            return None
        return self.body_shape.get("error.code")


def describe_body(text: str, content_type: str | None) -> dict:
    """Ringkas bentuk body error tanpa menyalin seluruh isinya."""
    try:
        parsed = json.loads(text)
    except ValueError:
        return {"json": False, "content_type": content_type, "snippet": text[:120]}
    shape: dict = {"json": True, "top_level_keys": sorted(parsed) if isinstance(parsed, dict) else None}
    err = parsed.get("error") if isinstance(parsed, dict) else None
    if isinstance(err, dict):
        shape["error_keys"] = sorted(err)
        for k in ("type", "code", "param"):
            if k in err:
                shape[f"error.{k}"] = err[k]
        if isinstance(err.get("message"), str):
            shape["error.message"] = err["message"][:200]
    elif isinstance(err, str):
        shape["error"] = err[:200]
    return shape


class ChatClient:
    def __init__(self, spec: ProviderSpec, transport: httpx.BaseTransport | None = None) -> None:
        self.spec = spec
        self._http = httpx.Client(transport=transport)

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> ChatClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def chat(
        self,
        *,
        key: str,
        model: str,
        messages: list[dict],
        max_tokens: int,
        timeout: float,
        temperature: float = 0,
        response_format: dict | None = None,
    ) -> CallResult:
        payload: dict = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }
        if response_format is not None:
            payload["response_format"] = response_format

        t0 = time.perf_counter()
        try:
            resp = self._http.post(
                self.spec.chat_url,
                json=payload,
                headers={"Authorization": f"Bearer {key}"},
                timeout=timeout,
            )
        except httpx.TimeoutException:
            return CallResult(None, time.perf_counter() - t0,
                              error=classify_error(None, None, timed_out=True))
        except httpx.TransportError as exc:
            return CallResult(None, time.perf_counter() - t0,
                              error=ProviderError(f"transport:{type(exc).__name__}"))
        latency = time.perf_counter() - t0

        headers = {k.lower(): v for k, v in resp.headers.items() if _keep_header(k)}
        text = resp.text
        result = CallResult(resp.status_code, latency, headers=headers)
        result.error = classify_error(resp.status_code, text)
        if result.error is not None:
            result.body_shape = describe_body(text, resp.headers.get("content-type"))
            return result

        data = json.loads(text)
        choice = data["choices"][0] if data["choices"] else {}
        message = choice.get("message") or {}
        result.content = message.get("content")
        result.finish_reason = choice.get("finish_reason")
        usage = data.get("usage") or {}
        result.prompt_tokens = usage.get("prompt_tokens")
        result.completion_tokens = usage.get("completion_tokens")
        return result
