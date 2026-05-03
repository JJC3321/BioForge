"""Wet-lab physics constants and reagent compatibility rules.

Port of CONSTRAINTS in src/lib/biopro-agent.ts:18-43. Keep in sync if the TS
side is ever reintroduced.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Tuple


@dataclass(frozen=True)
class _Temperature:
    valid_incubation: Tuple[int, ...] = (4, 25, 30, 37, 42, 55, 60, 65, 72, 95)
    max_allowed: int = 200
    min_allowed: int = -196


@dataclass(frozen=True)
class _Timing:
    max_step_duration_hours: int = 168
    max_total_timeline_days: int = 365
    min_duration_minutes: int = 1


@dataclass(frozen=True)
class _Budget:
    max_reasonable_usd: float = 50_000.0
    min_reasonable_usd: float = 50.0


@dataclass(frozen=True)
class _RequiredControls:
    min_controls: int = 2
    must_have_negative: bool = True


@dataclass(frozen=True)
class _ReagentConflict:
    reagents: Tuple[str, str]
    reason: str


REAGENT_COMPATIBILITY: Final[Tuple[_ReagentConflict, ...]] = (
    _ReagentConflict(("EDTA", "PCR"), "EDTA chelates Mg2+ required for PCR"),
    _ReagentConflict(("SDS", "qPCR"), "SDS inhibits polymerases"),
    _ReagentConflict(
        ("formaldehyde", "live cells"), "Fixative kills live cells"
    ),
)

TEMPERATURE: Final = _Temperature()
TIMING: Final = _Timing()
BUDGET: Final = _Budget()
REQUIRED_CONTROLS: Final = _RequiredControls()
