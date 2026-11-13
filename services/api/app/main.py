"""Aplikasi FastAPI TILIK.

/analyze/caption: rule engine + satu provider LLM teks (T-18, app/routes/caption.py).
/analyze/visual masih stub valid kontrak (T-08); isinya datang di T-21.
"""

from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.config import Settings
from app.logs import configure_logging, log_access, log_unhandled
from app.routes.caption import build_caption_router
from providers import TextProvider
from providers.fireworks import FireworksText
from rules_engine import RuleEngine, load_rules

STUB_NOTE = "stub T-08"


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def _skipped(layer: str, provider: str | None) -> dict:
    return {
        "layer": layer,
        "status": "skipped",
        "provider": provider,
        "latency_ms": 0,
        "findings": [],
        "note": STUB_NOTE,
    }


def build_text_provider(settings: Settings) -> TextProvider | None:
    """Fireworks bila key dan model terisi; selain itu None (L4 LLM `unavailable`)."""
    if not settings.fireworks_api_key or not settings.fireworks_text_model:
        return None
    return FireworksText(
        api_key=settings.fireworks_api_key,
        model=settings.fireworks_text_model,
        max_tokens=settings.text_max_tokens,
        reasoning_effort=settings.text_reasoning_effort,
    )


def create_app(settings: Settings | None = None, text_provider: TextProvider | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings.from_env()
    if text_provider is None:
        text_provider = build_text_provider(settings)
    rule_engine = RuleEngine(load_rules())  # regex dikompilasi sekali saat startup
    configure_logging()

    app = FastAPI(title="TILIK API", version=__version__, docs_url=None, redoc_url=None)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = uuid.uuid4().hex
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:  # noqa: BLE001 — semua error tak tertangani jadi 500 kontrak
            log_unhandled(request_id, exc)
            response = error_response(500, "INTERNAL", "Terjadi kesalahan di server.")
        latency_ms = int((time.perf_counter() - start) * 1000)
        response.headers["X-Request-ID"] = request_id
        log_access(request_id, request.method, request.url.path, response.status_code, latency_ms)
        return response

    # Ditambahkan setelah middleware di atas sehingga CORS menjadi lapisan terluar dan
    # respons 500 pun tetap mendapat header CORS untuk origin yang diizinkan.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
        expose_headers=["X-Request-ID"],
    )

    @app.exception_handler(RequestValidationError)
    async def invalid_input(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Hanya lokasi field; nilai input tidak digemakan (data tak tepercaya).
        fields = sorted({".".join(str(p) for p in err["loc"][1:]) or "body" for err in exc.errors()})
        return error_response(400, "INVALID_INPUT", "Input tidak valid: " + ", ".join(fields))

    @app.get("/health")
    def health() -> dict:
        # Status provider diisi setelah abstraksi provider ada (T-19).
        return {"status": "ok", "providers": {}, "version": __version__}

    app.include_router(build_caption_router(rule_engine, text_provider))

    @app.post("/analyze/visual")
    def analyze_visual(request: Request) -> dict:
        # Stub: body multipart tidak dibaca. Validasi upload (magic bytes, 10 MB, 40 MP) di T-39.
        return {
            "request_id": request.state.request_id,
            "layers": [_skipped("L2", None)],
            "has_text_document": None,
        }

    return app


app = create_app()
