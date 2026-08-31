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

from dataclasses import dataclass, replace
from typing import List, Literal, Dict, Optional
import numpy as np


@dataclass
class Segment:
    kind: Literal["straight", "corner"]
    length: float          # meters, arc length for corners
    name: str
    radius: float = None   # meters, only for corners (tighter = smaller)
    direction: int = 0     # 0 = straight, +1 = right-hand turn, -1 = left-hand turn
    drs: bool = False       # True on a straight that carries a DRS activation zone
                            # (2025 cars) / an active-aero X-mode straightline zone
                            # (2026 cars). When no segment on a track sets this,
                            # lap_sim falls back to its "long straight" heuristic.


# --- corner builder ------------------------------------------------------------
# Real corners are specified by (radius, turn angle). Arc length = r * theta, so
# defining them this way keeps a corner's on-track duration physically consistent
# with its radius instead of being a third hand-tuned number. Turn angles are
# also what track_geometry.py integrates to close the 2D loop, so keeping the
# signed sum near +/-360 deg keeps the drawn map's curvature-correction small.

def _corner(name: str, radius: float, angle_deg: float, direction: int) -> Segment:
    return Segment("corner", radius * np.radians(abs(angle_deg)), name,
                   radius=float(radius), direction=int(direction))


def _straight(name: str, length: float, drs: bool = False) -> Segment:
    return Segment("straight", float(length), name, drs=drs)


def _fit_length(segments: List[Segment], target_m: float) -> List[Segment]:
    """Proportionally rescale ONLY the straights so the lap sums to exactly
    target_m. Corner arc lengths (r * theta) are left untouched — they encode
    real geometry — and all closing error is absorbed by the straights, which
    are the least-certain hand-estimated numbers anyway."""
    corner_len = sum(s.length for s in segments if s.kind == "corner")
    straight_len = sum(s.length for s in segments if s.kind == "straight")
    scale = (target_m - corner_len) / straight_len
    if scale <= 0:
        raise ValueError(f"corner arc length {corner_len:.0f} m already exceeds "
                         f"target lap length {target_m:.0f} m")
    return [replace(s, length=s.length * scale) if s.kind == "straight" else s
            for s in segments]


# ============================================================
# MONZA (Autodromo Nazionale Monza) -- 5793 m, driven clockwise (net right-hand bias)
# Chicanes (Rettifilo / Roggia / Ascari) are modeled as two or three linked
# sub-corners with alternating direction, matching how they're actually driven.
# ============================================================
MONZA_SEGMENTS: List[Segment] = [
    Segment("straight", 715, "Start/Finish straight", drs=True),
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
    Segment("straight", 1123, "Back straight (to Ascari)", drs=True),
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
    Segment("straight", 922, "Wellington Straight", drs=True),
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
    Segment("straight", 988, "Hangar Straight", drs=True),
    Segment("corner", 94, "Stowe", radius=120, direction=+1),
    Segment("straight", 395, "Run to Vale"),
    Segment("corner", 24, "Vale (entry)", radius=40, direction=-1),
    Segment("straight", 27, "Vale link"),
    Segment("corner", 24, "Vale (exit)", radius=40, direction=+1),
    Segment("straight", 105, "Run to Club"),
    Segment("corner", 79, "Club", radius=90, direction=+1),
    Segment("straight", 393, "Run to start/finish"),
]


# ============================================================
# SPA-FRANCORCHAMPS (Circuit de Spa-Francorchamps) -- 7004 m, longest track
# on the calendar. Corner angles chosen to sum to +-360 deg by construction.
# La Source is kept as a genuine tight right-hand hairpin (its defining,
# unmistakable real-world character); several other corners (Rivage, Pouhon,
# Blanchimont) are drawn as right-handers here even though they're famously
# LEFT-handers in reality -- purely so the loop closes cleanly without
# self-intersecting, same simplification used for Silverstone's Brooklands/
# Luffield. Pouhon (a long double-apex sweeper) is split into two linked
# sub-corners, same technique as the chicanes.
#
# IMPORTANT: this is a flat 2D model -- Spa's signature elevation change
# (Eau Rouge/Raidillon compresses the car uphill by ~40m) is NOT modeled.
# The corner is still here (as a direction change with a representative
# radius), but the physics doesn't know it's a hill, so the extra grip load
# from compression at the bottom of Eau Rouge -- part of why it's so
# famous/difficult in reality -- isn't captured. Adding elevation would mean
# giving car_model.py a slope-dependent gravity component along the track
# direction, which isn't built yet -- noted as a roadmap item in the README.
# ============================================================
SPA_SEGMENTS: List[Segment] = [
    Segment("straight", 130, "Start/Finish straight", drs=True),
    Segment("corner", 65, "La Source", radius=25, direction=+1),
    Segment("straight", 403, "Downhill to Eau Rouge"),
    Segment("corner", 87, "Eau Rouge", radius=250, direction=-1),
    Segment("straight", 24, "Eau Rouge link"),
    Segment("corner", 87, "Raidillon", radius=200, direction=+1),
    Segment("straight", 1776, "Kemmel Straight", drs=True),
    Segment("corner", 63, "Les Combes (entry)", radius=90, direction=+1),
    Segment("straight", 32, "Les Combes link"),
    Segment("corner", 27, "Les Combes (exit)", radius=45, direction=-1),
    Segment("straight", 323, "Run to Malmedy"),
    Segment("corner", 37, "Malmedy", radius=60, direction=-1),
    Segment("straight", 241, "Run to Rivage"),
    Segment("corner", 39, "Rivage", radius=50, direction=+1),
    Segment("straight", 565, "Downhill to Pouhon"),
    Segment("corner", 141, "Pouhon (entry)", radius=180, direction=+1),
    Segment("straight", 24, "Pouhon link"),
    Segment("corner", 126, "Pouhon (exit)", radius=160, direction=+1),
    Segment("straight", 484, "Run to Fagnes"),
    Segment("corner", 24, "Fagnes (entry)", radius=45, direction=-1),
    Segment("straight", 24, "Fagnes link"),
    Segment("corner", 20, "Fagnes (exit)", radius=45, direction=+1),
    Segment("straight", 645, "Run to Stavelot"),
    Segment("corner", 79, "Stavelot", radius=130, direction=+1),
    Segment("straight", 565, "Run to Blanchimont"),
    Segment("corner", 269, "Blanchimont", radius=220, direction=+1),
    Segment("straight", 403, "Run to Bus Stop"),
    Segment("corner", 18, "Bus Stop (entry)", radius=35, direction=-1),
    Segment("straight", 24, "Bus Stop link"),
    Segment("corner", 18, "Bus Stop (exit)", radius=35, direction=+1),
    Segment("straight", 241, "Run to start/finish"),
]


# ============================================================================
# EXPANDED CIRCUIT CATALOGUE
# ============================================================================
# The six circuits below are built with the (radius, turn-angle) corner
# builder and then _fit_length()-scaled so each lap sums to its exact real
# published length. Corner radii are chosen so simulated apex speeds land in
# the right band for a modern F1 car (~2.5-4.5 g lateral); segment order,
# handedness and DRS zones follow the real track.
#
# CALIBRATION STATUS: geometry + DRS + pit loss are representative; the
# per-track aero presets in car_model.py for these six are BALLPARK ONLY
# (TODO markers there). Run calibrate_with_fastf1.py / validate_fastf1.py
# locally against the TRACK_POLE_BENCHMARKS targets to finish tuning.
# ============================================================================

# --- Circuit de Monaco (Monte Carlo) -- 3337 m, clockwise -------------------
MONACO_SEGMENTS: List[Segment] = _fit_length([
    _straight("Start/Finish straight", 175, drs=True),
    _corner("T1 Sainte Devote", 19, 70, +1),
    _straight("Beau Rivage climb", 340),
    _corner("T3 Massenet", 52, 55, -1),
    _corner("T4 Casino Square", 36, 50, +1),
    _straight("Run to Mirabeau", 90),
    _corner("T5 Mirabeau Haute", 24, 65, +1),
    _straight("Run to Fairmont", 55),
    _corner("T6 Fairmont Hairpin", 9, 120, +1),
    _straight("Run to Mirabeau Bas", 45),
    _corner("T7 Mirabeau Bas", 28, 40, +1),
    _corner("T8 Portier", 22, 75, +1),
    _straight("Tunnel", 480),
    _corner("T9 Tunnel exit kink", 190, 30, +1),
    _straight("Tunnel exit braking", 120),
    _corner("T10 Nouvelle Chicane (L)", 14, 55, -1),
    _straight("Chicane link", 12),
    _corner("T11 Nouvelle Chicane (R)", 16, 50, +1),
    _straight("Run to Tabac", 170),
    _corner("T12 Tabac", 38, 60, -1),
    _straight("Run to Piscine", 45),
    _corner("T13 Piscine entry (L)", 48, 45, -1),
    _straight("Piscine link", 20),
    _corner("T14 Piscine entry (R)", 44, 40, +1),
    _straight("Piscine mid", 40),
    _corner("T15 Piscine exit (L)", 26, 50, -1),
    _corner("T16 Piscine exit (R)", 24, 45, +1),
    _straight("Run to Rascasse", 40),
    _corner("T17 La Rascasse", 13, 100, +1),
    _straight("Run to Noghes", 16),
    _corner("T18 Anthony Noghes", 20, 65, +1),
    _straight("Run to start/finish", 150),
], 3337.0)

# --- Suzuka International Racing Course -- 5807 m, figure-8, clockwise -------
# One of the fastest laps on the calendar: the Esses and 130R are near-flat
# for a modern car, so their radii are large; only the hairpin, Degner 2 and
# the Casio Triangle chicane are genuinely slow.
SUZUKA_SEGMENTS: List[Segment] = _fit_length([
    _straight("Pit straight", 300, drs=True),
    _corner("T1", 110, 50, +1),
    _corner("T2", 95, 55, +1),
    _straight("Run to Esses", 140),
    _corner("T3 Esses", 140, 30, -1),
    _corner("T4 Esses", 130, 32, +1),
    _corner("T5 Esses", 125, 30, -1),
    _corner("T6 Esses", 130, 28, +1),
    _corner("T7 Esses", 120, 26, -1),
    _straight("Run to Dunlop", 160),
    _corner("T8 Dunlop Curve", 150, 25, +1),
    _straight("Run to Degner", 230),
    _corner("T9 Degner 1", 70, 45, +1),
    _straight("Degner link", 100),
    _corner("T10 Degner 2", 40, 80, +1),
    _straight("Under the bridge", 260),
    _corner("T11 Hairpin", 25, 190, +1),
    _straight("Run to Spoon", 500),
    _corner("T13 Spoon entry", 90, 50, -1),
    _corner("T14 Spoon exit", 55, 65, -1),
    _straight("Back straight to 130R", 800, drs=True),
    _corner("T15 130R", 250, 40, -1),
    _straight("Run to Casio", 340),
    _corner("T16 Casio Triangle (in)", 18, 65, +1),
    _corner("T17 Casio Triangle (out)", 26, 55, -1),
    _straight("Run to final corner", 200),
    _corner("T18 final corner", 220, 55, +1),
    _straight("Run to line", 260),
], 5807.0)

# --- Bahrain International Circuit (Sakhir) -- 5412 m, clockwise ------------
BAHRAIN_SEGMENTS: List[Segment] = _fit_length([
    _straight("Start/Finish straight", 400, drs=True),
    _corner("T1", 33, 90, +1),
    _straight("Run to T2", 100),
    _corner("T2", 28, 70, -1),
    _corner("T3", 100, 35, +1),
    _straight("Back-of-paddock straight", 500, drs=True),
    _corner("T4", 44, 110, +1),
    _straight("Run to T5", 240),
    _corner("T5", 24, 60, +1),
    _corner("T6", 60, 40, +1),
    _corner("T7", 65, 45, -1),
    _straight("Run to T8", 300),
    _corner("T8", 38, 80, +1),
    _corner("T9", 65, 45, -1),
    _straight("Downhill run to T10", 180),
    _corner("T10", 48, 70, +1),
    _straight("Run to T11", 260),
    _corner("T11", 90, 35, +1),
    _straight("Short chute", 120),
    _corner("T12", 25, 65, -1),
    _corner("T13", 44, 55, +1),
    _straight("Run to T14", 380, drs=True),
    _corner("T14", 90, 45, +1),
    _straight("Run to T15", 150),
    _corner("T15", 55, 40, +1),
    _straight("Run to line", 300),
], 5412.0)

# --- Red Bull Ring (Spielberg) -- 4318 m, clockwise ------------------------
# Very short lap, only ~10 corners and four long (partly uphill) straights ->
# one of the highest average-speed laps of the year. Only T3 and T4 are heavy
# braking events; the rest are fast kinks.
RED_BULL_RING_SEGMENTS: List[Segment] = _fit_length([
    _straight("Start/Finish straight", 300, drs=True),
    _corner("T1", 120, 30, +1),
    _straight("Uphill run to T3", 620, drs=True),
    _corner("T3 Remus", 55, 75, +1),
    _straight("Run to T4", 480, drs=True),
    _corner("T4 Schlossgold", 60, 65, +1),
    _straight("Run to T5", 260),
    _corner("T5", 110, 40, +1),
    _straight("Run to T6", 300),
    _corner("T6 Rauch", 130, 35, +1),
    _straight("Run to T7", 180),
    _corner("T7 Wurth", 120, 35, -1),
    _straight("Run to T8", 220),
    _corner("T8", 75, 55, +1),
    _straight("Run to T9", 240),
    _corner("T9 Rindt", 110, 45, -1),
    _corner("T10", 130, 40, +1),
    _straight("Run to line", 300),
], 4318.0)

# --- Autodromo Jose Carlos Pace (Interlagos) -- 4309 m, anti-clockwise -----
INTERLAGOS_SEGMENTS: List[Segment] = _fit_length([
    _straight("Reta principal / pit straight", 320, drs=True),
    _corner("T1 Senna S (in)", 30, 80, -1),
    _corner("T2 Senna S (out)", 40, 60, +1),
    _straight("Curva do Sol approach", 120),
    _corner("T3 Curva do Sol", 110, 55, -1),
    _straight("Reta Oposta (back straight)", 640, drs=True),
    _corner("T4 Descida do Lago (in)", 60, 45, -1),
    _corner("T5 Descida do Lago (out)", 70, 40, -1),
    _straight("Run to Ferradura", 200),
    _corner("T6 Ferradura", 42, 70, -1),
    _straight("Run to Laranja", 150),
    _corner("T7 Laranjinha", 38, 50, +1),
    _corner("T8 Pinheirinho", 30, 90, -1),
    _straight("Run to Bico de Pato", 170),
    _corner("T9 Bico de Pato", 24, 110, -1),
    _straight("Run to Mergulho", 130),
    _corner("T10 Mergulho", 85, 40, -1),
    _corner("T11 Juncao", 34, 80, -1),
    _straight("Subida dos boxes (uphill drag)", 590),
    _corner("T12 Subida (in)", 180, 30, -1),
    _corner("T13 Arquibancadas", 160, 35, -1),
    _straight("Run to line", 220),
], 4309.0)

# --- Circuit of the Americas (COTA, Austin) -- 5513 m, anti-clockwise ------
COTA_SEGMENTS: List[Segment] = _fit_length([
    _straight("Start/Finish straight", 320, drs=True),
    _corner("T1 (uphill)", 32, 100, -1),
    _straight("Esses approach", 160),
    _corner("T2 esses", 120, 40, +1),
    _corner("T3 esses", 110, 42, -1),
    _corner("T4 esses", 115, 38, +1),
    _corner("T5 esses", 105, 40, -1),
    _corner("T6 esses", 120, 36, +1),
    _straight("Run to T7", 120),
    _corner("T7", 55, 55, -1),
    _corner("T8", 70, 45, +1),
    _straight("Run to T9", 130),
    _corner("T9", 55, 55, -1),
    _corner("T10", 60, 45, +1),
    _straight("Run to T11", 260),
    _corner("T11 hairpin", 22, 150, -1),
    _straight("Back straight", 1050, drs=True),
    _corner("T12 hairpin", 30, 95, -1),
    _straight("Run to T13", 130),
    _corner("T13", 40, 60, -1),
    _corner("T14", 60, 45, +1),
    _corner("T15", 75, 40, -1),
    _straight("Run to T16", 260),
    _corner("T16", 90, 45, -1),
    _corner("T17", 80, 45, -1),
    _corner("T18", 70, 50, -1),
    _straight("Run to T19", 130),
    _corner("T19", 55, 55, -1),
    _straight("Run to T20", 100),
    _corner("T20", 65, 45, -1),
    _straight("Run to line", 300),
], 5513.0)


TRACKS: Dict[str, List[Segment]] = {
    "Monza": MONZA_SEGMENTS,
    "Silverstone": SILVERSTONE_SEGMENTS,
    "Spa-Francorchamps": SPA_SEGMENTS,
    "Monaco": MONACO_SEGMENTS,
    "Suzuka": SUZUKA_SEGMENTS,
    "Bahrain": BAHRAIN_SEGMENTS,
    "Red Bull Ring": RED_BULL_RING_SEGMENTS,
    "Interlagos": INTERLAGOS_SEGMENTS,
    "COTA": COTA_SEGMENTS,
}

TRACK_PIT_LOSS_S: Dict[str, float] = {
    # Real-world pit lane time loss (in vs box vs staying out), track-specific.
    "Monza": 24.0,
    "Silverstone": 21.0,
    "Spa-Francorchamps": 20.0,
    "Monaco": 25.0,
    "Suzuka": 22.5,
    "Bahrain": 23.5,
    "Red Bull Ring": 20.5,
    "Interlagos": 21.5,
    "COTA": 22.0,
}

# Ambient environment per circuit, used by car_model.air_density() to compute a
# real air density (drag + downforce both scale with rho) instead of a fixed
# 1.225 kg/m^3. altitude_m from public elevation data; track_temp_c is a
# representative dry qualifying-session surface temp.
TRACK_ENV: Dict[str, dict] = {
    "Monza":             dict(altitude_m=162, track_temp_c=42.0, air_temp_c=27.0),
    "Silverstone":       dict(altitude_m=153, track_temp_c=30.0, air_temp_c=19.0),
    "Spa-Francorchamps": dict(altitude_m=401, track_temp_c=28.0, air_temp_c=17.0),
    "Monaco":            dict(altitude_m=10,  track_temp_c=40.0, air_temp_c=24.0),
    "Suzuka":            dict(altitude_m=45,  track_temp_c=35.0, air_temp_c=20.0),
    "Bahrain":           dict(altitude_m=7,   track_temp_c=29.0, air_temp_c=26.0),
    "Red Bull Ring":     dict(altitude_m=678, track_temp_c=44.0, air_temp_c=26.0),
    "Interlagos":        dict(altitude_m=785, track_temp_c=45.0, air_temp_c=24.0),
    "COTA":              dict(altitude_m=220, track_temp_c=40.0, air_temp_c=28.0),
}

# Qualifying pole-lap benchmarks for automated validation. The first three are
# the FastF1-verified targets already used to calibrate the built-in cars; the
# rest are approximate real poles from recent seasons (UNVERIFIED here -- confirm
# with validate_fastf1.py locally before trusting the MAE).
TRACK_POLE_BENCHMARKS: Dict[str, dict] = {
    "Monza":             dict(y2025=78.79, y2026=82.30, top_speed_kmh=372, source="2025 Verstappen 1:18.792 (FastF1)"),
    "Silverstone":       dict(y2025=84.89, y2026=88.11, top_speed_kmh=305, source="2025 Verstappen / 2026 Antonelli (FastF1)"),
    "Spa-Francorchamps": dict(y2025=100.56, y2026=104.36, top_speed_kmh=345, source="2025/2026 Antonelli (FastF1)"),
    "Monaco":            dict(y2025=69.95, y2026=None, top_speed_kmh=295, source="2025 Norris 1:09.954 (approx, unverified)"),
    "Suzuka":            dict(y2025=86.98, y2026=None, top_speed_kmh=320, source="2025 Verstappen 1:26.983 (approx, unverified)"),
    "Bahrain":           dict(y2025=89.84, y2026=None, top_speed_kmh=325, source="2025 Piastri 1:29.841 (approx, unverified)"),
    "Red Bull Ring":     dict(y2025=63.97, y2026=None, top_speed_kmh=320, source="2025 Norris 1:03.971 (approx, unverified)"),
    "Interlagos":        dict(y2025=70.70, y2026=None, top_speed_kmh=320, source="dry ref ~2023 Verstappen 1:10.727 (approx, unverified)"),
    "COTA":              dict(y2025=92.14, y2026=None, top_speed_kmh=330, source="2025 Verstappen 1:32.143 (approx, unverified)"),
}

# Sector split points as fraction-of-lap-distance (S1 end, S2 end). Real F1
# timing sectors are roughly even thirds; a couple of tracks skew (Monaco S3
# is short, Spa S1 ends before Les Combes). Used by lap_sim for sector times.
TRACK_SECTORS: Dict[str, tuple] = {
    "Monza":             (0.35, 0.66),
    "Silverstone":       (0.33, 0.67),
    "Spa-Francorchamps": (0.28, 0.62),
    "Monaco":            (0.38, 0.72),
    "Suzuka":            (0.36, 0.66),
    "Bahrain":           (0.34, 0.63),
    "Red Bull Ring":     (0.30, 0.60),
    "Interlagos":        (0.34, 0.64),
    "COTA":              (0.32, 0.66),
}


# Relative tyre thermal / energy stress per circuit (1.0 = neutral). Drives
# tyre_model.grip_multiplier(thermal_load=...): high-traction, high-lateral-G,
# hot-surface tracks chew tyres faster; smooth low-speed tracks are gentle.
TRACK_TYRE_STRESS: Dict[str, float] = {
    "Monza":             0.95,
    "Silverstone":       1.22,
    "Spa-Francorchamps": 1.10,
    "Monaco":            0.78,
    "Suzuka":            1.28,
    "Bahrain":           1.35,
    "Red Bull Ring":     1.00,
    "Interlagos":        1.05,
    "COTA":              1.15,
}


def tyre_stress(track_name: Optional[str]) -> float:
    return TRACK_TYRE_STRESS.get(track_name, 1.0)


# Championship race distance (laps) per circuit -- the real Grand Prix lap
# count. Used to auto-populate the strategy planner / optimiser; the user can
# still add or drop laps from this default.
TRACK_RACE_LAPS: Dict[str, int] = {
    "Monza":             53,
    "Silverstone":       52,
    "Spa-Francorchamps": 44,
    "Monaco":            78,
    "Suzuka":            53,
    "Bahrain":           57,
    "Red Bull Ring":     71,
    "Interlagos":        71,
    "COTA":              56,
}

# FIA race distance target: at least 305 km (Monaco historically the exception).
_RACE_DISTANCE_M = 305_000.0


def race_laps(track_name: Optional[str]) -> int:
    """Real Grand Prix lap count for a circuit. Falls back to the number of
    laps needed to cover ~305 km when the track isn't in TRACK_RACE_LAPS."""
    if track_name in TRACK_RACE_LAPS:
        return TRACK_RACE_LAPS[track_name]
    segs = TRACKS.get(track_name)
    if segs:
        return max(10, round(_RACE_DISTANCE_M / total_length(segs)))
    return 53


def track_environment(track_name: Optional[str]) -> dict:
    """Ambient conditions for a circuit; ISA-ish sea-level defaults if unknown."""
    return TRACK_ENV.get(track_name, dict(altitude_m=100, track_temp_c=30.0, air_temp_c=20.0))


def pole_benchmark(track_name: Optional[str]) -> Optional[dict]:
    return TRACK_POLE_BENCHMARKS.get(track_name)


def sector_fractions(track_name: Optional[str]) -> tuple:
    return TRACK_SECTORS.get(track_name, (1 / 3, 2 / 3))


def drs_zone_count(segments: List[Segment]) -> int:
    return sum(1 for s in segments if s.kind == "straight" and s.drs)


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
