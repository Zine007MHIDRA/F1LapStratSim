"""
track_model.py

Represents a track as a sequence of segments (straights and corners).
Each corner has a radius (how tight) AND a direction (which way it turns) --
the direction field is what lets track_geometry.py reconstruct an actual
2D (x, y) track shape for the top-down map, on top of the same segment
list the lap-time physics already uses.

  direction:  0 on straights
             +1 = right-hand turn
             -1 = left-hand turn

This lets the lap simulator build a distance-based speed profile:
  - straights: no lateral-speed cap, car accelerates freely / brakes for the next corner
  - corners: capped at the max speed the tyres+aero can sustain for that radius

Values below are approximate public-domain characteristics of each circuit
(corner radii / segment lengths / turn directions) -- good enough to build a
representative speed trace and a recognizable (but schematic, not
survey-accurate) track shape. They are NOT scraped from a proprietary
source. Once you pull real FastF1 telemetry locally, calibrate the corner
radii / segment lengths so the simulated speed trace lines up with the
real one -- and real telemetry's X/Y columns give you exact track geometry
too, if you want to replace the hand-built shape entirely.
"""

from dataclasses import dataclass
from typing import List, Literal, Dict
import numpy as np


@dataclass
class Segment:
    kind: Literal["straight", "corner"]
    length: float          # meters, arc length for corners
    name: str
    radius: float = None   # meters, only for corners (tighter = smaller)
    direction: int = 0     # 0 = straight, +1 = right-hand turn, -1 = left-hand turn


# ============================================================
# MONZA (Autodromo Nazionale Monza) -- 5793 m, driven clockwise (net right-hand bias)
# Chicanes (Rettifilo / Roggia / Ascari) are modeled as two or three linked
# sub-corners with alternating direction, matching how they're actually driven.
# ============================================================
MONZA_SEGMENTS: List[Segment] = [
    Segment("straight", 715, "Start/Finish straight"),
    Segment("corner", 25, "Turn 1 Rettifilo (entry)", radius=25, direction=+1),
    Segment("straight", 9, "Rettifilo link"),
    Segment("corner", 20, "Turn 2 Rettifilo (exit)", radius=20, direction=-1),
    Segment("straight", 624, "Run to Curva Grande"),
    Segment("corner", 322, "Curva Grande", radius=230, direction=+1),
    Segment("straight", 284, "Run to Roggia chicane"),
    Segment("corner", 20, "Turn 4 Della Roggia (entry)", radius=20, direction=-1),
    Segment("straight", 9, "Roggia link"),
    Segment("corner", 20, "Turn 5 Della Roggia (exit)", radius=20, direction=+1),
    Segment("straight", 397, "Run to Lesmo 1"),
    Segment("corner", 161, "Turn 6 Lesmo 1", radius=90, direction=+1),
    Segment("straight", 227, "Run to Lesmo 2"),
    Segment("corner", 143, "Turn 7 Lesmo 2", radius=100, direction=+1),
    Segment("straight", 1123, "Back straight (to Ascari)"),
    Segment("corner", 40, "Turn 8 Ascari (entry)", radius=40, direction=-1),
    Segment("straight", 7, "Ascari link 1"),
    Segment("corner", 35, "Turn 9 Ascari (mid)", radius=35, direction=+1),
    Segment("straight", 7, "Ascari link 2"),
    Segment("corner", 40, "Turn 10 Ascari (exit)", radius=40, direction=-1),
    Segment("straight", 761, "Run to Parabolica"),
    Segment("corner", 465, "Turn 11 Parabolica", radius=175, direction=+1),
    Segment("straight", 339, "Run to start/finish"),
]


# ============================================================
# SILVERSTONE (Silverstone Circuit, GP layout) -- 5891 m
# Corner angles below are chosen to sum to +-360 deg by construction
# (a topological requirement for any closed loop), prioritizing a clean,
# recognizable, non-self-intersecting shape over exact real-world handedness
# for every corner. A few directions (Brooklands, Luffield) are flipped from
# their real-world sense to make that possible -- purely a visualization
# simplification, it does not affect the lap-time physics (radius/length
# per corner are still representative of the real corner's character).
# Vale remains a genuine alternating chicane (left-right).
# ============================================================
SILVERSTONE_SEGMENTS: List[Segment] = [
    Segment("straight", 263, "Start/Finish straight"),
    Segment("corner", 126, "Abbey", radius=180, direction=+1),
    Segment("straight", 198, "Run to Village"),
    Segment("corner", 39, "Village/Farm Curve", radius=90, direction=-1),
    Segment("straight", 158, "Run to The Loop"),
    Segment("corner", 39, "The Loop", radius=25, direction=+1),
    Segment("straight", 198, "Run to Aintree"),
    Segment("corner", 24, "Aintree", radius=70, direction=-1),
    Segment("straight", 922, "Wellington Straight"),
    Segment("corner", 37, "Brooklands", radius=60, direction=+1),
    Segment("straight", 132, "Run to Luffield"),
    Segment("corner", 55, "Luffield", radius=35, direction=+1),
    Segment("straight", 198, "Run to Woodcote"),
    Segment("corner", 79, "Woodcote", radius=150, direction=+1),
    Segment("straight", 330, "Run to Copse"),
    Segment("corner", 122, "Copse", radius=200, direction=+1),
    Segment("straight", 527, "Run to Maggotts"),
    Segment("corner", 38, "Maggotts", radius=110, direction=-1),
    Segment("straight", 105, "Run to Becketts"),
    Segment("corner", 37, "Becketts", radius=70, direction=+1),
    Segment("straight", 105, "Run to Chapel"),
    Segment("corner", 31, "Chapel", radius=90, direction=-1),
    Segment("straight", 988, "Hangar Straight"),
    Segment("corner", 94, "Stowe", radius=120, direction=+1),
    Segment("straight", 395, "Run to Vale"),
    Segment("corner", 24, "Vale (entry)", radius=40, direction=-1),
    Segment("straight", 27, "Vale link"),
    Segment("corner", 24, "Vale (exit)", radius=40, direction=+1),
    Segment("straight", 105, "Run to Club"),
    Segment("corner", 79, "Club", radius=90, direction=+1),
    Segment("straight", 393, "Run to start/finish"),
]


TRACKS: Dict[str, List[Segment]] = {
    "Monza": MONZA_SEGMENTS,
    "Silverstone": SILVERSTONE_SEGMENTS,
}

TRACK_PIT_LOSS_S: Dict[str, float] = {
    # Rough real-world pit lane time loss (in vs box vs staying out), track-specific
    "Monza": 24.0,
    "Silverstone": 21.0,
}


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
    for name, segs in TRACKS.items():
        n_corners = sum(1 for seg in segs if seg.kind == "corner")
        net_turn_deg = sum((seg.length / seg.radius) * seg.direction
                            for seg in segs if seg.kind == "corner") * 180 / np.pi
        print(f"{name}: {total_length(segs):.0f} m, {n_corners} corner segments, "
              f"net turn {net_turn_deg:+.0f} deg (should be near +-360)")
