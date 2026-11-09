"""Konfigurasi probe: endpoint provider dan variabel env.

Endpoint (chat completions OpenAI-compatible saja, NFR-PRIV-03; dicek 9 Nov 2026):
- Fireworks: https://docs.fireworks.ai/api-reference/post-chatcompletions
  → POST https://api.fireworks.ai/inference/v1/chat/completions, `Authorization: Bearer <key>`
- Groq:      https://console.groq.com/docs/structured-outputs (bagian endpoint & contoh)
  → POST https://api.groq.com/openai/v1/chat/completions, `Authorization: Bearer <key>`

Key yang dipakai adalah key evaluasi (NFR-COST-04), bukan key demo.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProviderSpec:
    name: str
    chat_url: str
    key_env: str
    model_env: str


PROVIDERS: dict[str, ProviderSpec] = {
    "fireworks": ProviderSpec(
        name="fireworks",
        chat_url="https://api.fireworks.ai/inference/v1/chat/completions",
        key_env="FIREWORKS_EVAL_API_KEY",
        model_env="FIREWORKS_TEXT_MODEL",
    ),
    "groq": ProviderSpec(
        name="groq",
        chat_url="https://api.groq.com/openai/v1/chat/completions",
        key_env="GROQ_EVAL_API_KEY",
        model_env="GROQ_TEXT_MODEL",
    ),
}

# Env yang nilainya selalu disensor dari laporan/log, walau provider-nya tidak dipilih.
SECRET_ENVS = ("FIREWORKS_EVAL_API_KEY", "GROQ_EVAL_API_KEY", "FIREWORKS_API_KEY", "GROQ_API_KEY")

# P5: nilai salah yang disengaja (bukan rahasia).
WRONG_KEY = "tilik-probe-kunci-salah-0000"
WRONG_MODEL = "tilik-probe/model-tidak-ada"

ALL_TESTS = ("P1", "P3", "P4", "P5")


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class ProviderRun:
    spec: ProviderSpec
    key: str
    model: str
    key_from_env: bool


@dataclass(frozen=True)
class ProbeConfig:
    providers: dict[str, ProviderRun]
    dry_run: bool
    secrets: tuple[str, ...]
    max_tokens: int = 400            # NFR-COST-03 (awal: 400 untuk teks)
    timeout_s: float = 12.0          # NFR-PERF-02: timeout per panggilan provider
    timeout_probe_s: float = 1.0     # P5: klien sengaja 1 detik
    p1_n: int = 5
    p3_n: int = 10
    burst_n: int = 35
    json_modes: dict[str, str | None] = field(default_factory=dict)


def _get(env: Mapping[str, str], name: str) -> str | None:
    value = env.get(name)
    if value is None or not value.strip():
        return None
    return value.strip()


def load_config(
    env: Mapping[str, str],
    *,
    providers: Sequence[str],
    dry_run: bool,
    max_tokens: int = 400,
    json_modes: Mapping[str, str | None] | None = None,
    timeout_probe_s: float = 1.0,
    burst_n: int = 35,
) -> ProbeConfig:
    """Baca env untuk provider terpilih. Mode nyata: env kosong → ConfigError berisi daftar nama."""
    unknown = [p for p in providers if p not in PROVIDERS]
    if unknown:
        raise ConfigError(f"provider tidak dikenal: {', '.join(unknown)}")

    missing: list[str] = []
    runs: dict[str, ProviderRun] = {}
    for name in providers:
        spec = PROVIDERS[name]
        key = _get(env, spec.key_env)
        model = _get(env, spec.model_env)
        if not dry_run:
            missing += [n for n, v in ((spec.key_env, key), (spec.model_env, model)) if v is None]
        runs[name] = ProviderRun(
            spec=spec,
            key=key or f"dry-run-key-{name}",
            model=model or f"dry-run/{name}-text-model",
            key_from_env=key is not None,
        )
    if missing:
        raise ConfigError(
            "variabel env wajib belum diisi: " + ", ".join(missing)
            + ". Isi di shell atau lewat `uv run --env-file <file>`; lihat docstring scripts/probe."
        )

    secrets = tuple(v for n in SECRET_ENVS if (v := _get(env, n)) is not None)
    return ProbeConfig(
        providers=runs,
        dry_run=dry_run,
        secrets=secrets,
        max_tokens=max_tokens,
        timeout_probe_s=timeout_probe_s,
        burst_n=burst_n,
        json_modes=dict(json_modes or {}),
    )
