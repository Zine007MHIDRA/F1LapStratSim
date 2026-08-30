"""
tyre_model.py

Tyre degradation model. Two effects, both grounded in how F1 tyres actually
behave and publicly discussed by teams/Pirelli:

  1. GRIP FALLOFF: as a tyre ages, peak available grip (mu) drops.
     Softer compounds start with higher grip but fall off faster.
  2. Non-linear "cliff": after a certain lap count, degradation accelerates
     sharply (thermal degradation / graining setting in) rather than staying
     linear the whole stint.

Model: grip_multiplier(laps_on_tyre) = 1 - deg_rate*laps - cliff_penalty(laps)

CALIBRATION NOTE (important): grip_multiplier feeds directly into
car_model.py's tyre_mu, and lap_sim.py's physics engine turns out to be
*highly* sensitive to that value -- roughly 0.35-0.4s of lap time per 1%
of grip lost near a fresh tyre (measured directly: simulate_lap() with
grip_multiplier=0.98 costs about +0.73s at Monza vs 1.00). An earlier
version of these constants was designed assuming a far less sensitive
relationship (more like the deg_rate values reading directly as lap-time
seconds), which produced absurd results at the tail -- a softs stint pushed
to lap 26 was producing a single lap over 50s slower than a fresh lap,
nothing like real F1.

The values below were instead reverse-engineered FROM the sim's actual
measured sensitivity, targeting realistic real-world per-lap degradation
(~0.03-0.08s/lap early in a stint, before the cliff) and a realistic
fresh-tyre performance gap between compounds (~0.3-0.4s per compound step,
~0.6-0.8s soft-to-hard) -- both checked by running simulate_lap() at each
lap count and reading the actual resulting lap time, not just eyeballing
the grip_multiplier curve. Still treat these as a first pass: they're
sensitivity-checked against this project's own physics, not fitted to real
stint data (FastF1 gives real lap times + tyre life per stint, which would
let you fit deg_rate per compound directly from real races -- see README).
"""

from dataclasses import dataclass


@dataclass
class TyreCompound:
    name: str
    base_grip: float          # relative to a common baseline (1.0 = medium reference)
    deg_rate_per_lap: float   # linear grip loss per lap (thermal plateau phase)
    cliff_lap: int            # lap number where degradation accelerates
    cliff_severity: float     # extra grip loss per lap after cliff_lap
    optimal_stint_laps: int   # rough real-world usable stint length
    warmup_laps: float = 2.0  # laps to reach peak grip from cold
    warmup_penalty: float = 0.020    # grip deficit on the very first flying lap
    thermal_sensitivity: float = 1.0  # how strongly this compound reacts to a
    #                                   high-energy circuit (softs overheat fastest)
    sub_compounds: str = ""   # FIA C-grade range this maps to (cosmetic)


# Non-linear degradation: cold warm-up phase -> linear thermal plateau ->
# steep thermal cliff. deg_rate / cliff constants stay as previously
# sensitivity-checked against this sim's own grip response (~0.35 s/lap per
# 1% grip); warm-up and thermal_sensitivity are additive on top.
COMPOUNDS = {
    "soft":   TyreCompound("soft",   base_grip=1.010, deg_rate_per_lap=0.0020,
                           cliff_lap=15, cliff_severity=0.0080, optimal_stint_laps=16,
                           warmup_laps=1.0, warmup_penalty=0.012, thermal_sensitivity=1.35,
                           sub_compounds="C3 / C4 / C5"),
    "medium": TyreCompound("medium", base_grip=1.000, deg_rate_per_lap=0.0010,
                           cliff_lap=26, cliff_severity=0.0045, optimal_stint_laps=27,
                           warmup_laps=2.0, warmup_penalty=0.018, thermal_sensitivity=1.10,
                           sub_compounds="C2 / C3"),
    "hard":   TyreCompound("hard",   base_grip=0.990, deg_rate_per_lap=0.0005,
                           cliff_lap=38, cliff_severity=0.0028, optimal_stint_laps=40,
                           warmup_laps=3.0, warmup_penalty=0.028, thermal_sensitivity=0.85,
                           sub_compounds="C1 / C2"),
    # Wet-weather compounds. This sim has no wet-track model, so on a DRY
    # circuit they simply read as slow, high-deg options (which is correct --
    # nobody runs inters/wets on a dry line). Present so the planner / race
    # sim accept them for wet-race what-ifs.
    "inter":  TyreCompound("inter",  base_grip=0.930, deg_rate_per_lap=0.0060,
                           cliff_lap=18, cliff_severity=0.0090, optimal_stint_laps=20,
                           warmup_laps=1.0, warmup_penalty=0.015, thermal_sensitivity=1.5,
                           sub_compounds="Cinturato Green"),
    "wet":    TyreCompound("wet",    base_grip=0.870, deg_rate_per_lap=0.0035,
                           cliff_lap=28, cliff_severity=0.0060, optimal_stint_laps=30,
                           warmup_laps=1.0, warmup_penalty=0.010, thermal_sensitivity=1.6,
                           sub_compounds="Cinturato Blue"),
}

DRY_COMPOUNDS = ("soft", "medium", "hard")


MIN_GRIP_FLOOR = 0.75  # a real tyre is essentially undriveable well before it
                        # would mathematically reach zero grip -- a team pits
                        # long before this territory. Also keeps the extreme
                        # tail (a stint pushed absurdly past its optimal
                        # length) from producing runaway, physically
                        # meaningless lap times through the sim's grip
                        # sensitivity described above.


def grip_multiplier(compound: TyreCompound, laps_on_tyre: int,
                    thermal_load: float = 1.0) -> float:
    """Multiplier to apply to car.tyre_mu. 1.0 = fresh, in-window baseline grip.

    Phases:
      * WARM-UP   -- lap 1 starts warmup_penalty below peak, recovering
                     linearly over `warmup_laps`.
      * PLATEAU   -- linear deg_rate_per_lap loss, amplified on high-energy
                     circuits by thermal_load * thermal_sensitivity.
      * CLIFF     -- past cliff_lap, cliff_severity adds on top (also
                     thermally amplified) -- the steep drop-off.

    thermal_load: 1.0 = neutral circuit; >1 = high lateral-energy /
    traction-heavy / hot track (Bahrain, Suzuka); <1 = low-energy (Monaco).
    """
    thermal = 1.0 + (thermal_load - 1.0) * compound.thermal_sensitivity
    thermal = max(thermal, 0.5)

    warmup_loss = compound.warmup_penalty * max(0.0, 1.0 - (laps_on_tyre - 1) / max(compound.warmup_laps, 1e-6))
    linear_loss = compound.deg_rate_per_lap * laps_on_tyre * thermal
    cliff_loss = 0.0
    if laps_on_tyre > compound.cliff_lap:
        cliff_loss = compound.cliff_severity * (laps_on_tyre - compound.cliff_lap) * thermal

    return max(compound.base_grip - warmup_loss - linear_loss - cliff_loss, MIN_GRIP_FLOOR)


if __name__ == "__main__":
    for name, c in COMPOUNDS.items():
        print(f"\n{name.upper()} tyre grip multiplier over stint:")
        for lap in [1, 5, 10, 15, 20, 25, 30, 35, 40]:
            g = grip_multiplier(c, lap)
            print(f"  lap {lap:2d}: {g:.4f}" + ("  <- past cliff" if lap > c.cliff_lap else ""))

