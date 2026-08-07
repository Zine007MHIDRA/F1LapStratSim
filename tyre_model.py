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

Reference degradation rates below are representative of publicly discussed
Pirelli behavior patterns (soft degrades fastest, hard is flattest, medium
in between) — treat the exact numbers as tunable, to be calibrated against
real stint data (FastF1 gives lap times + tyre life per stint, so you can
fit deg_rate per compound directly from real races).
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
    "soft": TyreCompound("soft", base_grip=1.06, deg_rate_per_lap=0.0130,
                          cliff_lap=14, cliff_severity=0.030, optimal_stint_laps=16),
    "medium": TyreCompound("medium", base_grip=1.00, deg_rate_per_lap=0.0080,
                            cliff_lap=24, cliff_severity=0.022, optimal_stint_laps=27),
    "hard": TyreCompound("hard", base_grip=0.95, deg_rate_per_lap=0.0050,
                          cliff_lap=36, cliff_severity=0.016, optimal_stint_laps=40),
}


MIN_GRIP_FLOOR = 0.35  # a tyre never has literally zero/negative grip -- this
                        # represents "completely shot, driving on the canvas" territory


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
            print(f"  lap {lap:2d}: {g:.3f}" + ("  <- past cliff" if lap > c.cliff_lap else ""))
