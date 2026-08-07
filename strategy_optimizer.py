"""
strategy_optimizer.py

Brute-force search over pit strategies (1-stop and 2-stop, all compound
combinations, stint length combinations) to find the theoretical fastest
total race time.

This is deliberately exhaustive rather than clever (no dynamic programming /
gradient search) — with a fast enough per-lap sim (race_sim runs a 53-lap
race in <1s), brute force over a reasonable grid is simpler to trust and
plenty fast.
"""

import itertools
from car_model import CarParams
from track_model import MONZA_SEGMENTS
from race_sim import simulate_race_strategy, pit_loss_for

COMPOUND_NAMES = ["soft", "medium", "hard"]


def generate_1stop_plans(total_laps: int, min_stint: int = 8, lap_grid: int = 3):
    """All (compound_A, laps_A), (compound_B, laps_B) combos covering total_laps."""
    plans = []
    for c1, c2 in itertools.product(COMPOUND_NAMES, repeat=2):
        if c1 == c2:
            continue  # F1 rule: must use 2 different dry compounds in a race
        for laps1 in range(min_stint, total_laps - min_stint + 1, lap_grid):
            laps2 = total_laps - laps1
            if laps2 < min_stint:
                continue
            plans.append([(c1, laps1), (c2, laps2)])
    return plans


def generate_2stop_plans(total_laps: int, min_stint: int = 8, lap_grid: int = 6):
    """All 3-stint combos covering total_laps, must include >=2 distinct compounds."""
    plans = []
    for c1, c2, c3 in itertools.product(COMPOUND_NAMES, repeat=3):
        if len({c1, c2, c3}) < 2:
            continue
        for laps1 in range(min_stint, total_laps - 2 * min_stint + 1, lap_grid):
            for laps2 in range(min_stint, total_laps - laps1 - min_stint + 1, lap_grid):
                laps3 = total_laps - laps1 - laps2
                if laps3 < min_stint:
                    continue
                plans.append([(c1, laps1), (c2, laps2), (c3, laps3)])
    return plans


def find_best_strategy(segments, car: CarParams, total_laps: int, include_2stop: bool = True,
                        step: float = 20.0, verbose: bool = True, track_name: str = None):
    all_plans = generate_1stop_plans(total_laps)
    if include_2stop:
        all_plans += generate_2stop_plans(total_laps)

    if verbose:
        print(f"Evaluating {len(all_plans)} candidate strategies...")

    results = []
    for plan in all_plans:
        res = simulate_race_strategy(segments, car, plan, total_laps, step=step, track_name=track_name)
        results.append((res["total_time"], plan))

    results.sort(key=lambda x: x[0])
    return results


def format_plan(plan):
    return " -> ".join(f"{c.upper()}({n})" for c, n in plan)


def format_time(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


if __name__ == "__main__":
    car = CarParams()
    TOTAL_LAPS = 53

    results = find_best_strategy(MONZA_SEGMENTS, car, TOTAL_LAPS, include_2stop=True,
                                  step=20.0, track_name="Monza")

    print(f"\nTop 10 strategies for Monza ({TOTAL_LAPS} laps, "
          f"pit loss = {pit_loss_for('Monza')}s):\n")
    for i, (t, plan) in enumerate(results[:10]):
        gap = t - results[0][0]
        gap_str = f"+{gap:.1f}s" if gap > 0 else "BEST"
        print(f"{i+1:2d}. {format_plan(plan):40s} {format_time(t)}   {gap_str}")

    print(f"\nWorst strategy for comparison:")
    t, plan = results[-1]
    print(f"    {format_plan(plan):40s} {format_time(t)}   +{t - results[0][0]:.1f}s")
