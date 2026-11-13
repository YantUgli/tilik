# Image TILIK API untuk uji lokal dan profil self-hosted. Build context: services/api/.
# Demo publik di FastAPI Cloud, yang mengabaikan Dockerfile (lihat deploy/README.md).
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.20 /uv /bin/uv

# Jangan jalan sebagai root.
RUN useradd --create-home --uid 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /home/user/app

COPY --chown=user pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY --chown=user app ./app
COPY --chown=user rules_engine ./rules_engine
COPY --chown=user rules ./rules
COPY --chown=user providers ./providers

EXPOSE 7860
# --no-access-log: log akses bawaan uvicorn diganti log tilik.access tanpa konten (NFR-PRIV-01).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--no-access-log"]
