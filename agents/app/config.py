"""LLMConfig builder + live-LLM detection.

Mirrors src/lib/gemini.ts: same default model, same env-var-driven detection.
Uses AG2 beta API (autogen.beta.config.OpenAIConfig).
"""

from __future__ import annotations

import os
from typing import Any, Optional

from autogen.beta.config import OpenAIConfig  # type: ignore[import-untyped]

DEFAULT_MODEL = "gemini-3.1-pro-preview"


def gemini_api_key() -> Optional[str]:
    return os.environ.get("AG2_API_KEY") or os.environ.get("GEMINI_API_KEY") or None


def gemini_model() -> str:
    # PLAN_MODEL overrides the plan sidecar only; falls back to GEMINI_MODEL, then the default.
    return os.environ.get("PLAN_MODEL") or os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL


def is_live_llm() -> bool:
    return bool(gemini_api_key())


def max_iterations() -> int:
    raw = os.environ.get("PLAN_MAX_ITERS")
    if not raw:
        return 3
    try:
        return max(1, int(raw))
    except ValueError:
        return 3


def build_llm_config(response_format: Optional[Any] = None) -> OpenAIConfig:
    """Return an AG2 beta OpenAIConfig for Gemini.

    `response_format` is the Pydantic model (or JSON Schema dict) the model
    must conform to. AG2 forwards this to Gemini's structured-output mode.
    """
    cfg = OpenAIConfig(
        model=gemini_model(),
        api_key=gemini_api_key() or "",
        base_url="https://generativelanguage.googleapis.com/v1beta",
        max_completion_tokens=4096,
    )
    if response_format is not None:
        # Store response_format on the config object as an extra attribute
        # AG2 beta will check for this when generating structured outputs
        object.__setattr__(cfg, "response_format", response_format)
    return cfg
