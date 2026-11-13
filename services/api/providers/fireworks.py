"""Provider teks Fireworks lewat chat completions (NFR-PRIV-03; tidak memakai Response API)."""

from __future__ import annotations

from .openai_compat import OpenAICompatText

FIREWORKS_CHAT_URL = "https://api.fireworks.ai/inference/v1/chat/completions"


class FireworksText(OpenAICompatText):
    name = "fireworks"
    chat_url = FIREWORKS_CHAT_URL
