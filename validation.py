"""Validation and provenance checks for simulated lap results.

This module deliberately separates a model output from a calibration claim.
For example, when the speed trace reaches ``car.top_speed_kmh``, the displayed
top speed is gear-cap-limited: it is a configured constraint, not an
independently predicted terminal speed.
"""

from dataclasses import dataclass, field
from typing import Optional

import numpy as np


@dataclass(frozen=True)
class ReferenceEnvelope:
    """Optional evidence-backed acceptance range for a specific scenario."""

    source: str
    lap_time_min_s: Optional[float] = None
    lap_time_max_s: Optional[float] = None
    top_speed_min_kmh: Optional[float] = None
    top_speed_max_kmh: Optional[float] = None


@dataclass
class ValidationReport:
    lap_time_s: float
    top_speed_kmh: float
    integrated_distance_m: float
    expected_distance_m: float
    top_speed_source: str
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def valid(self) -> bool:
        return not self.errors

    @property
    def status(self) -> str:
        if self.errors:
            return "ERROR"
        if self.warnings:
            return "WARNING"
        return "PASS"


def validate_lap_result(result, car, expected_distance_m: float,
                        reference: Optional[ReferenceEnvelope] = None) -> ValidationReport:
    """Check numerical integrity and label where headline values came from."""
    speeds = np.asarray(result["v_profile"], dtype=float)
    dt_arr = np.asarray(result["dt_arr"], dtype=float)
    ds_arr = np.asarray(result["ds_arr"], dtype=float)
    lap_time = float(result["lap_time"])
    top_speed = float(np.max(speeds) * 3.6)
    integrated_distance = float(np.sum(ds_arr))

    gear_limited = (
        car.top_speed_kmh is not None
        and abs(top_speed - car.top_speed_kmh) <= 0.1
    )
    report = ValidationReport(
        lap_time_s=lap_time,
        top_speed_kmh=top_speed,
        integrated_distance_m=integrated_distance,
        expected_distance_m=float(expected_distance_m),
        top_speed_source="configured gear cap" if gear_limited else "physics-limited prediction",
    )

    if not np.all(np.isfinite(speeds)) or not np.all(np.isfinite(dt_arr)):
        report.errors.append("The lap contains non-finite speed or time values.")
    if np.any(speeds <= 0.0) or np.any(dt_arr <= 0.0):
        report.errors.append("The lap contains non-positive speed or time intervals.")
    if abs(integrated_distance - expected_distance_m) > 1e-6:
        report.errors.append(
            f"Integrated distance is {integrated_distance:.3f} m, expected {expected_distance_m:.3f} m."
        )
    if car.top_speed_kmh is not None and top_speed > car.top_speed_kmh + 1e-6:
        report.errors.append(
            f"Top speed {top_speed:.2f} km/h exceeds the configured gear cap "
            f"of {car.top_speed_kmh:.2f} km/h."
        )
    if gear_limited:
        report.warnings.append(
            "Top speed reached the configured gear cap; treat it as a model input, "
            "not an independently predicted real-world maximum."
        )

    if reference is not None:
        checks = (
            (reference.lap_time_min_s, lap_time, "below", "lap time"),
            (reference.lap_time_max_s, lap_time, "above", "lap time"),
            (reference.top_speed_min_kmh, top_speed, "below", "top speed"),
            (reference.top_speed_max_kmh, top_speed, "above", "top speed"),
        )
        for limit, value, direction, label in checks:
            if limit is None:
                continue
            outside = value < limit if direction == "below" else value > limit
            if outside:
                report.warnings.append(
                    f"Simulated {label} ({value:.3f}) is {direction} the reference "
                    f"envelope ({limit:.3f}); source: {reference.source}."
                )

    return report


def resolution_delta(segments, car, simulate_lap, fine_step: float = 1.0,
                     standard_step: float = 2.0) -> float:
    """Absolute lap-time difference between fine and standard discretization."""
    fine = simulate_lap(segments, car, step=fine_step, compute_pedals=False)
    standard = simulate_lap(segments, car, step=standard_step, compute_pedals=False)
    return abs(float(fine["lap_time"]) - float(standard["lap_time"]))
