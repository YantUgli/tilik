"""Aplikasi FastAPI TILIK.

T-08: stub valid kontrak untuk /health, /analyze/caption, /analyze/visual. Isi analisis
datang di T-18 (caption) dan T-21 (visual).
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
from app.schemas import CaptionRequest

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


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings.from_env()
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

    @app.post("/analyze/caption")
    def analyze_caption(body: CaptionRequest, request: Request) -> dict:
        del body  # stub: input divalidasi lalu dibuang, tidak disimpan atau dicatat
        return {
            "request_id": request.state.request_id,
            "layers": [_skipped("L3", "rule"), _skipped("L4", "rule"), _skipped("L4", None)],
        }

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
