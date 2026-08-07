"""
main.py

Interactive entry point for the F1 lap time + strategy simulator.
Run this file and use the menu.

    python3 main.py
"""

import sys
import matplotlib.pyplot as plt

from car_model import CarParams, car_2025, car_2026
from track_model import MONZA_SEGMENTS, total_length
from lap_sim import simulate_lap
from tyre_model import COMPOUNDS
from race_sim import simulate_race_strategy, PIT_STOP_LOSS_S
from strategy_optimizer import find_best_strategy, format_plan, format_time, generate_1stop_plans, generate_2stop_plans

TRACK_NAME = "Monza"
TRACK = MONZA_SEGMENTS


def choose_car():
    print("\nWhich car generation?")
    print("1. 2025-spec (fixed wing, pre-active-aero era)")
    print("2. 2026-spec (active aero + Manual Override, current regs)")
    choice = input("Choose (1/2) [default 2]: ").strip()
    if choice == "1":
        print("Using 2025-spec car.")
        return car_2025()
    print("Using 2026-spec car (active aero, ~30% less downforce, Manual Override).")
    return car_2026()


def menu():
    print(f"""
========================================
  F1 LAP + STRATEGY SIMULATOR — {TRACK_NAME}
========================================
1. Simulate a single fastest lap (+ speed trace plot)
2. Simulate a custom race strategy
3. Auto-search for the best strategy
4. Show / edit car parameters
5. Exit
""")
    return input("Choose an option (1-5): ").strip()


def option_single_lap(car):
    result = simulate_lap(TRACK, car, step=2.0)
    t = result["lap_time"]
    print(f"\nLap time: {format_time(t)}  ({t:.3f}s)")
    print(f"Top speed: {result['v_profile'].max()*3.6:.1f} km/h")
    print(f"Average speed: {(total_length(TRACK)/t)*3.6:.1f} km/h")

    show = input("Show speed trace plot? (y/n): ").strip().lower()
    if show == "y":
        plt.figure(figsize=(11, 4))
        plt.plot(result["s"], result["v_profile"] * 3.6)
        plt.xlabel("Distance around lap (m)")
        plt.ylabel("Speed (km/h)")
        plt.title(f"{TRACK_NAME} — simulated speed trace ({format_time(t)})")
        plt.grid(alpha=0.3)
        plt.tight_layout()
        outpath = "speed_trace.png"
        plt.savefig(outpath, dpi=130)
        print(f"Saved plot to {outpath}")
        try:
            plt.show()
        except Exception:
            pass


def option_custom_strategy(car):
    print(f"\nAvailable compounds: {list(COMPOUNDS.keys())}")
    total_laps = int(input("Total race laps (e.g. 53 for Monza): ").strip())

    n_stints = int(input("Number of stints (1 = no stops, 2 = one-stop, 3 = two-stop): ").strip())
    plan = []
    laps_remaining = total_laps
    for i in range(n_stints):
        compound = input(f"  Stint {i+1} compound {list(COMPOUNDS.keys())}: ").strip().lower()
        if compound not in COMPOUNDS:
            print(f"  Unknown compound '{compound}', defaulting to 'medium'")
            compound = "medium"
        if i == n_stints - 1:
            laps = laps_remaining
            print(f"  Stint {i+1} laps: {laps} (remaining laps, auto-filled)")
        else:
            laps = int(input(f"  Stint {i+1} laps: ").strip())
        plan.append((compound, laps))
        laps_remaining -= laps

    if laps_remaining != 0 and n_stints > 0:
        # only matters if the last stint wasn't auto-filled correctly
        pass

    res = simulate_race_strategy(TRACK, car, plan, total_laps, step=8.0)
    t = res["total_time"]
    print(f"\nStrategy: {format_plan(plan)}")
    print(f"Total race time: {format_time(t)}  ({t:.1f}s)")
    print(f"Average lap time: {t/total_laps:.3f}s")
    print(f"Slowest lap: {max(res['lap_times']):.3f}s   "
          f"Fastest lap: {min(res['lap_times']):.3f}s")


def option_optimize(car):
    total_laps = int(input("Total race laps (e.g. 53 for Monza): ").strip())
    include_2stop = input("Include 2-stop strategies? (y/n, slower): ").strip().lower() == "y"
    print("Resolution: higher step = faster but less precise physics")
    step = input("Distance step in meters [default 20]: ").strip()
    step = float(step) if step else 20.0

    n_plans = len(generate_1stop_plans(total_laps))
    if include_2stop:
        n_plans += len(generate_2stop_plans(total_laps))
    est_time = n_plans * (0.21 * (15 / step))  # rough scaling from earlier profiling
    print(f"\nAbout to evaluate ~{n_plans} strategies (roughly {est_time:.0f}s estimated)...")
    confirm = input("Continue? (y/n): ").strip().lower()
    if confirm != "y":
        return

    results = find_best_strategy(TRACK, car, total_laps, include_2stop=include_2stop, step=step)
    print(f"\nTop 10 strategies for {TRACK_NAME} ({total_laps} laps, pit loss = {PIT_STOP_LOSS_S}s):\n")
    for i, (t, plan) in enumerate(results[:10]):
        gap = t - results[0][0]
        gap_str = f"+{gap:.1f}s" if gap > 0 else "BEST"
        print(f"{i+1:2d}. {format_plan(plan):40s} {format_time(t)}   {gap_str}")


def option_car_params(car):
    print("\nCurrent car parameters:")
    for field, value in car.__dict__.items():
        print(f"  {field}: {value}")

    edit = input("\nEdit a parameter? (enter field name, or blank to skip): ").strip()
    if edit and hasattr(car, edit):
        new_val = input(f"New value for {edit}: ").strip()
        try:
            setattr(car, edit, float(new_val))
            print(f"Updated {edit} = {new_val}")
        except ValueError:
            print("Invalid number, no change made.")
    return car


def main():
    car = choose_car()
    print("F1 lap + strategy simulator loaded. Track: Monza (5793m).")
    print("NOTE: physics constants are a first-pass model, tuned to match")
    print("reported real-world deltas (2026 vs 2025) rather than fitted to")
    print("raw telemetry. Calibrate further with calibrate_with_fastf1.py")
    print("(run locally, needs internet access to F1 timing servers).")

    while True:
        choice = menu()
        if choice == "1":
            option_single_lap(car)
        elif choice == "2":
            option_custom_strategy(car)
        elif choice == "3":
            option_optimize(car)
        elif choice == "4":
            car = option_car_params(car)
        elif choice == "5":
            print("Bye!")
            sys.exit(0)
        else:
            print("Invalid choice, try again.")


if __name__ == "__main__":
    main()
