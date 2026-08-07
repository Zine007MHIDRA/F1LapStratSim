"""
race_sim.py

Simulates a full stint (or full race across multiple stints) lap by lap,
applying tyre grip degradation and fuel burn-off each lap, using lap_sim's
forward-backward solver for each individual lap's time.
"""

import numpy as np
from car_model import CarParams
from tyre_model import COMPOUNDS, grip_multiplier
from track_model import MONZA_SEGMENTS, total_length
from lap_sim import simulate_lap

LAP_LENGTH = total_length(MONZA_SEGMENTS)
PIT_STOP_LOSS_S = 24.0  # seconds lost doing a pit stop at Monza (pit lane time delta vs staying out)


def simulate_stint(segments, car: CarParams, compound_name: str, n_laps: int,
                    race_distance_at_stint_start: float = 0.0, step: float = 4.0):
    """Simulate n_laps on one tyre compound. Returns list of lap times (s) and total stint time."""
    compound = COMPOUNDS[compound_name]
    lap_times = []
    race_distance = race_distance_at_stint_start

    for lap_on_tyre in range(1, n_laps + 1):
        g_mult = grip_multiplier(compound, lap_on_tyre)
        result = simulate_lap(segments, car, step=step,
                               race_distance_so_far_m=race_distance,
                               grip_multiplier=g_mult)
        lap_times.append(result["lap_time"])
        race_distance += LAP_LENGTH

    return lap_times, sum(lap_times)


def simulate_race_strategy(segments, car: CarParams, stint_plan, total_laps: int, step: float = 4.0):
    """
    stint_plan: list of (compound_name, n_laps) tuples, e.g.
        [("medium", 25), ("hard", 28)]
    Adds a pit stop time loss between each stint (not after the last one).
    Returns total race time and full lap-by-lap breakdown.
    """
    assert sum(n for _, n in stint_plan) == total_laps, \
        f"Stint plan covers {sum(n for _, n in stint_plan)} laps, race is {total_laps} laps"

    all_lap_times = []
    race_distance = 0.0
    total_time = 0.0

    for i, (compound_name, n_laps) in enumerate(stint_plan):
        lap_times, stint_time = simulate_stint(segments, car, compound_name, n_laps,
                                                race_distance_at_stint_start=race_distance,
                                                step=step)
        all_lap_times.extend(lap_times)
        total_time += stint_time
        race_distance += n_laps * LAP_LENGTH

        if i < len(stint_plan) - 1:  # pit stop after every stint except the last
            total_time += PIT_STOP_LOSS_S

    return {
        "total_time": total_time,
        "lap_times": all_lap_times,
        "stint_plan": stint_plan,
    }


if __name__ == "__main__":
    car = CarParams()
    TOTAL_LAPS = 53  # real Monza GP race distance

    # Try a 1-stop: medium -> hard
    plan_1stop = [("medium", 25), ("hard", 28)]
    res_1stop = simulate_race_strategy(MONZA_SEGMENTS, car, plan_1stop, TOTAL_LAPS)

    t = res_1stop["total_time"]
    print(f"1-stop (M25 -> H28): total race time = {t:.1f}s = "
          f"{int(t//60)}:{t%60:05.2f}")
    print(f"  First lap of race: {res_1stop['lap_times'][0]:.3f}s")
    print(f"  Last lap of medium stint (lap 25): {res_1stop['lap_times'][24]:.3f}s")
    print(f"  First lap on hard (lap 26): {res_1stop['lap_times'][25]:.3f}s")
    print(f"  Last lap of race: {res_1stop['lap_times'][-1]:.3f}s")
