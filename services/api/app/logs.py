"""Log akses tanpa konten (NFR-PRIV-01).

Hanya request_id, method, path (tanpa query), status, dan latensi. Body, query string,
header, dan pesan exception tidak pernah ditulis.
"""

from __future__ import annotations

import logging
import sys

access_log = logging.getLogger("tilik.access")
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
