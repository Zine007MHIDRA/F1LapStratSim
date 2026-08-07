"""
calibrate_with_fastf1.py

Run this LOCALLY (not in a restricted sandbox) — it needs real internet
access to the F1 live timing / data servers that FastF1 pulls from.

What it does:
  1. Downloads a real session (choose 2023 for the fixed-wing era, or 2026
     for the current active-aero regs)
  2. Pulls the fastest lap's telemetry (speed vs distance)
  3. Plots it next to our simulated speed trace so you can visually compare
  4. Prints real corner-by-corner min speeds so you can tune the radius /
     tyre_mu / ClA / CdA (or corner_ClA/straight_CdA for 2026) values in
     track_model.py and car_model.py until the simulated trace lines up
     with reality.

First run:
  pip install fastf1
  python3 calibrate_with_fastf1.py
(FastF1 caches downloaded data locally after the first run, so subsequent
 runs are much faster.)
"""

import os
import matplotlib.pyplot as plt
import numpy as np

from car_model import CarParams, car_2025, car_2026
from track_model import MONZA_SEGMENTS, total_length
from lap_sim import simulate_lap

CACHE_DIR = os.path.join(os.path.dirname(__file__), "f1_cache")


def main():
    try:
        import fastf1
    except ImportError:
        print("FastF1 not installed. Run: pip install fastf1")
        return

    os.makedirs(CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)

    print("Which season to calibrate against?")
    print("1. 2023 Monza Qualifying (fixed-wing era -- use with car_2025())")
    print("2. 2026 Monza Qualifying (active aero era -- use with car_2026())")
    print("   NOTE: FastF1 support for 2026 sessions depends on your installed")
    print("   FastF1 version having a schema update for the new car/PU data.")
    print("   If it fails, update FastF1 (pip install -U fastf1) or check")
    print("   https://docs.fastf1.dev for 2026 season support status.")
    choice = input("Choose (1/2) [default 1]: ").strip()

    if choice == "2":
        year, sim_car, car_label = 2026, car_2026(), "2026-spec (active aero)"
    else:
        year, sim_car, car_label = 2023, car_2025(), "2025-spec (fixed wing)"

    print(f"\nDownloading {year} Monza Qualifying session (first run may take a minute)...")
    session = fastf1.get_session(year, "Monza", "Q")
    session.load()

    fastest_lap = session.laps.pick_fastest()
    telemetry = fastest_lap.get_car_data().add_distance()

    real_distance = telemetry["Distance"].to_numpy()
    real_speed_kmh = telemetry["Speed"].to_numpy()
    real_lap_time = fastest_lap["LapTime"].total_seconds()

    print(f"\nReal fastest lap: {fastest_lap['Driver']} — {real_lap_time:.3f}s")
    print(f"Real top speed: {real_speed_kmh.max():.1f} km/h")

    # Our simulation
    sim_result = simulate_lap(MONZA_SEGMENTS, sim_car, step=2.0)
    sim_distance = sim_result["s"]
    sim_speed_kmh = sim_result["v_profile"] * 3.6
    sim_lap_time = sim_result["lap_time"]

    print(f"\nSimulated lap ({car_label}): {sim_lap_time:.3f}s")
    print(f"Simulated top speed: {sim_speed_kmh.max():.1f} km/h")
    print(f"\nDelta: {sim_lap_time - real_lap_time:+.3f}s "
          f"({(sim_lap_time/real_lap_time - 1)*100:+.1f}%)")

    print("\n--- Tuning suggestions ---")
    if sim_lap_time > real_lap_time + 0.5:
        if year == 2026:
            print("Sim is SLOWER than real: try increasing corner_ClA (more Z-mode")
            print("downforce) or straight_CdA reduction (more X-mode efficiency) in car_2026()")
        else:
            print("Sim is SLOWER than real: try increasing tyre_mu, ClA, or engine_power in car_model.py")
    elif sim_lap_time < real_lap_time - 0.5:
        if year == 2026:
            print("Sim is FASTER than real: try decreasing corner_ClA (less cornering grip)")
            print("in car_2026() -- early-2026 cars are notably grip-limited in fast corners")
        else:
            print("Sim is FASTER than real: try decreasing tyre_mu or ClA (sim car has too much grip)")
    else:
        print("Sim lap time is within ~0.5s of real — good calibration!")

    plt.figure(figsize=(12, 5))
    plt.plot(real_distance, real_speed_kmh, label=f"Real ({fastest_lap['Driver']}, {real_lap_time:.2f}s)", linewidth=2)
    plt.plot(sim_distance, sim_speed_kmh, label=f"Simulated ({sim_lap_time:.2f}s)", linewidth=2, linestyle="--")
    plt.xlabel("Distance (m)")
    plt.ylabel("Speed (km/h)")
    plt.title(f"Monza {year}: Real telemetry vs simulated speed trace ({car_label})")
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    outname = f"calibration_comparison_{year}.png"
    plt.savefig(outname, dpi=130)
    print(f"\nSaved comparison plot to {outname}")
    try:
        plt.show()
    except Exception:
        pass


if __name__ == "__main__":
    main()
