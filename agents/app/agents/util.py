"""Shared helpers for AG2 beta agent modules."""

from __future__ import annotations

import json
import re
from typing import Any

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def extract_json(reply: Any) -> Any:
    """Coerce an AG2 beta agent reply into a parsed JSON object.

    AG2 beta's Agent.ask() returns a response object with a .body property
    containing the raw text. This function parses that text (stripping any
    markdown fences) into a JSON object.
    """
    if reply is None:
        raise ValueError("Agent returned no reply")
    if hasattr(reply, "model_dump"):
        return reply.model_dump()
    if isinstance(reply, dict):
        if "content" in reply and isinstance(reply["content"], str):
            return _parse_string(reply["content"])
        return reply
    if isinstance(reply, str):
        return _parse_string(reply)
    raise ValueError(f"Unexpected reply type: {type(reply).__name__}")


def _parse_string(s: str) -> Any:
    s = s.strip()
    s = _FENCE_RE.sub("", s).strip()
    return json.loads(s)
