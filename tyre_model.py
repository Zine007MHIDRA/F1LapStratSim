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
    deg_rate_per_lap: float   # linear grip loss per lap
    cliff_lap: int            # lap number where degradation accelerates
    cliff_severity: float     # extra grip loss per lap after cliff_lap
    optimal_stint_laps: int   # rough real-world usable stint length


COMPOUNDS = {
    "soft": TyreCompound("soft", base_grip=1.010, deg_rate_per_lap=0.0020,
                          cliff_lap=15, cliff_severity=0.0080, optimal_stint_laps=16),
    "medium": TyreCompound("medium", base_grip=1.000, deg_rate_per_lap=0.0010,
                            cliff_lap=26, cliff_severity=0.0045, optimal_stint_laps=27),
    "hard": TyreCompound("hard", base_grip=0.990, deg_rate_per_lap=0.0005,
                          cliff_lap=38, cliff_severity=0.0028, optimal_stint_laps=40),
}


MIN_GRIP_FLOOR = 0.75  # a real tyre is essentially undriveable well before it
                        # would mathematically reach zero grip -- a team pits
                        # long before this territory. Also keeps the extreme
                        # tail (a stint pushed absurdly past its optimal
                        # length) from producing runaway, physically
                        # meaningless lap times through the sim's grip
                        # sensitivity described above.


def grip_multiplier(compound: TyreCompound, laps_on_tyre: int) -> float:
    """Returns a multiplier to apply to car.tyre_mu. 1.0 = fresh baseline grip."""
    linear_loss = compound.deg_rate_per_lap * laps_on_tyre
    cliff_loss = 0.0
    if laps_on_tyre > compound.cliff_lap:
        cliff_loss = compound.cliff_severity * (laps_on_tyre - compound.cliff_lap)
    return max(compound.base_grip - linear_loss - cliff_loss, MIN_GRIP_FLOOR)


if __name__ == "__main__":
    for name, c in COMPOUNDS.items():
        print(f"\n{name.upper()} tyre grip multiplier over stint:")
        for lap in [1, 5, 10, 15, 20, 25, 30, 35, 40]:
            g = grip_multiplier(c, lap)
            print(f"  lap {lap:2d}: {g:.4f}" + ("  <- past cliff" if lap > c.cliff_lap else ""))

