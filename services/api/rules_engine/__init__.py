"""Rule engine TILIK (T-16): aturan deterministik untuk L3 dan L4, tanpa LLM.

Pemakaian:
    engine = RuleEngine(load_rules())          # sekali saat startup
    findings = engine.run(RuleInput(caption=..., ocr_text=..., ocr_words=None))
"""

from .combine import combine_l3
from .engine import RuleEngine
from .loader import RuleLoadError, load_rules
from .matcher import match_rule
from .models import OcrWord, RawFinding, Rule, RuleInput

__all__ = [
    "OcrWord",
    "RawFinding",
    "Rule",
    "RuleEngine",
    "RuleInput",
    "RuleLoadError",
    "combine_l3",
    "load_rules",
    "match_rule",
]
