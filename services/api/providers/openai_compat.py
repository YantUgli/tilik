"""TextProvider untuk API bergaya OpenAI chat completions (Fireworks; Groq di T-19).

Hanya endpoint `/chat/completions` (NFR-PRIV-03). Output divalidasi terhadap
`LlmTextOutput`; gagal → satu kali coba ulang dengan pesan koreksi yang hanya memuat
lokasi dan jenis kesalahan (tanpa input pengguna dan tanpa output model sebelumnya).
"""

from __future__ import annotations

import httpx
from pydantic import ValidationError

from app.llm_schema import LLM_TEXT_OUTPUT_JSON_SCHEMA, LlmTextFinding, LlmTextOutput
from app.prompts import build_caption_messages

from . import InvalidOutput, ProviderError, ProviderTimeout, RateLimited, Usage

REQUEST_TIMEOUT_S = 12.0
MAX_ATTEMPTS = 2  # percobaan pertama + satu coba ulang
_KNOWN_FIELDS = frozenset({"findings", *LlmTextFinding.model_fields})
_MAX_REPORTED_ERRORS = 5


class OpenAICompatText:
    name: str
    chat_url: str

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        max_tokens: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._max_tokens = max_tokens
        self._transport = transport

    def __repr__(self) -> str:  # tanpa key
        return f"{type(self).__name__}(model={self._model!r})"

    async def classify(self, caption: str | None, ocr_text: str | None) -> tuple[LlmTextOutput, Usage]:
        messages, _ = build_caption_messages(caption, ocr_text)
        tokens_in = tokens_out = 0
        http_status: int | None = None
        # Klien per panggilan: aman lintas event loop (TestClient, uvicorn). Pooling di T-20 bila perlu.
        async with httpx.AsyncClient(transport=self._transport, timeout=REQUEST_TIMEOUT_S) as client:
            for attempt in range(MAX_ATTEMPTS):
                content, usage = await self._chat(client, messages)
                tokens_in += usage.tokens_in or 0
                tokens_out += usage.tokens_out or 0
                http_status = usage.http_status
                total = Usage(tokens_in=tokens_in, tokens_out=tokens_out, http_status=http_status)
                try:
                    return parse_output(content), total
                except ValidationError as exc:
                    if attempt + 1 >= MAX_ATTEMPTS:
                        raise InvalidOutput(http_status=http_status, usage=total) from None
                    messages = [*messages, {"role": "user", "content": correction_message(exc)}]
        raise AssertionError("tidak terjangkau")  # pragma: no cover

    def _payload(self, messages: list[dict]) -> dict:
        return {
            "model": self._model,
            "messages": messages,
            "temperature": 0,
            "max_tokens": self._max_tokens,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "LlmTextOutput", "schema": LLM_TEXT_OUTPUT_JSON_SCHEMA},
            },
        }

    async def _chat(self, client: httpx.AsyncClient, messages: list[dict]) -> tuple[str | None, Usage]:
        try:
            res = await client.post(
                self.chat_url,
                json=self._payload(messages),
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
        except httpx.TimeoutException:
            raise ProviderTimeout() from None
        except httpx.HTTPError:
            raise ProviderError() from None

        if res.status_code == 429:
            raise RateLimited(http_status=429)
        if res.status_code >= 400:
            raise ProviderError(http_status=res.status_code)
        try:
            body = res.json()
            content = body["choices"][0]["message"].get("content")
            usage = body.get("usage") or {}
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            raise ProviderError(http_status=res.status_code) from None
        return content, Usage(
            tokens_in=_int_or_none(usage.get("prompt_tokens")),
            tokens_out=_int_or_none(usage.get("completion_tokens")),
            http_status=res.status_code,
        )


def parse_output(content: str | None) -> LlmTextOutput:
    """Validasi konten model. Blok kode ```json``` di sekeliling JSON ditoleransi."""
    text = (content or "").strip()
    if text.startswith("```") and text.endswith("```"):
        text = text[3:-3]
        if text.lower().startswith("json"):
            text = text[4:]
    return LlmTextOutput.model_validate_json(text.strip() or "null")


def correction_message(exc: ValidationError) -> str:
    """Pesan koreksi: hanya lokasi (nama field kontrak/indeks) dan kode jenis error.

    Nilai input, pesan error Pydantic, dan kunci asing pilihan model tidak disertakan,
    karena bisa berisi teks pengguna.
    """
    problems = []
    for err in exc.errors(include_url=False, include_input=False, include_context=False)[:_MAX_REPORTED_ERRORS]:
        loc = ".".join(str(p) if isinstance(p, int) or p in _KNOWN_FIELDS else "?" for p in err["loc"])
        problems.append(f"{loc or '(akar)'}: {err['type']}")
    return (
        "Jawaban sebelumnya tidak valid terhadap skema ("
        + "; ".join(problems)
        + "). Kirim ulang jawaban sebagai JSON saja yang sesuai skema, tanpa teks lain."
    )


def _int_or_none(value) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None
