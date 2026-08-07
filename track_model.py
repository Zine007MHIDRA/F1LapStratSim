"""
track_model.py

Represents a track as a sequence of segments (straights and corners).
Each corner is defined by a radius (meters). Each straight by a length (meters).

This lets the lap simulator build a distance-based speed profile:
  - straights: no lateral-speed cap, car accelerates freely / brakes for the next corner
  - corners: capped at the max speed the tyres+aero can sustain for that radius

MONZA (Autodromo Nazionale Monza) reference layout.
Values below are approximate public-domain characteristics of the circuit
(corner radii / segment lengths), good enough to build a representative
speed trace. They are NOT scraped from a proprietary source, and should be
treated as a first pass — once you pull real FastF1 telemetry locally, we
calibrate the corner radii / segment lengths so the simulated speed trace
lines up with the real one.

Total lap distance target: ~5793 m (official Monza lap length)
"""

from dataclasses import dataclass
from typing import List, Literal
import numpy as np


@dataclass
class Segment:
    kind: Literal["straight", "corner"]
    length: float          # meters, arc length for corners
    name: str
    radius: float = None   # meters, only for corners (tighter = smaller)


# Approximate Monza segment breakdown.
# Named corners follow the real sequence: start/finish -> Turn 1/2 (Rettifilo) ->
# Curva Grande -> Della Roggia chicane -> Lesmo 1 -> Lesmo 2 -> back straight ->
# Ascari chicane -> Parabolica -> start/finish straight.
# Straight lengths scaled (x1.261) from a first draft so total lap length
# matches the official 5793 m Monza lap distance.
MONZA_SEGMENTS: List[Segment] = [
    Segment("straight", 794, "Start/Finish straight"),
    Segment("corner", 45, "Turn 1-2 Rettifilo chicane", radius=22),
    Segment("straight", 694, "Run to Curva Grande"),
    Segment("corner", 180, "Curva Grande", radius=230),
    Segment("straight", 315, "Run to Roggia chicane"),
    Segment("corner", 40, "Turn 4-5 Della Roggia chicane", radius=20),
    Segment("straight", 441, "Run to Lesmo 1"),
    Segment("corner", 90, "Turn 6 Lesmo 1", radius=90),
    Segment("straight", 252, "Run to Lesmo 2"),
    Segment("corner", 80, "Turn 7 Lesmo 2", radius=100),
    Segment("straight", 1248, "Back straight (to Ascari)"),
    Segment("corner", 130, "Turn 8-9-10 Ascari chicane", radius=45),
    Segment("straight", 845, "Run to Parabolica"),
    Segment("corner", 260, "Turn 11 Parabolica", radius=175),
    Segment("straight", 379, "Run to start/finish"),
]


def total_length(segments: List[Segment]) -> float:
    return sum(s.length for s in segments)


def build_distance_axis(segments: List[Segment], step: float = 2.0):
    """
    Returns:
      s        - 1D array of distance markers (m) around the lap, spaced `step` apart
      radius_at- 1D array same length as s: local corner radius at that point
                 (np.inf on straights = "no lateral speed cap")
      seg_idx  - which segment index each sample belongs to (for labeling/debug)
    """
    s_list = []
    radius_list = []
    seg_idx_list = []
    cursor = 0.0
    for i, seg in enumerate(segments):
        n_pts = max(1, int(round(seg.length / step)))
        local_s = np.linspace(0, seg.length, n_pts, endpoint=False)
        for ls in local_s:
            s_list.append(cursor + ls)
            radius_list.append(seg.radius if seg.kind == "corner" else np.inf)
            seg_idx_list.append(i)
        cursor += seg.length

    return np.array(s_list), np.array(radius_list), np.array(seg_idx_list)


if __name__ == "__main__":
    print(f"Monza total modeled length: {total_length(MONZA_SEGMENTS):.0f} m "
          f"(official: 5793 m)")
    s, r, idx = build_distance_axis(MONZA_SEGMENTS, step=2.0)
    print(f"Distance samples: {len(s)}")
    n_corners = sum(1 for seg in MONZA_SEGMENTS if seg.kind == "corner")
    print(f"Corners modeled: {n_corners}")
