"""
validate_fastf1.py

Calibration / validation harness for the lap-time engine.

Two modes:

  DRY-RUN (default, no network)     python validate_fastf1.py
    Compares simulated qualifying lap times against the hard-coded
    TRACK_POLE_BENCHMARKS in track_model.py and reports the Mean Absolute
    Error (MAE) and RMSE in lap time across all circuits, per era.

  FASTF1 (real telemetry)           python validate_fastf1.py --fastf1 --year 2025
    Additionally downloads each circuit's real qualifying session, takes the
    fastest lap, and computes:
      * lap-time error (s)
      * top-speed error (km/h)
      * full speed-trace MAE (km/h) after resampling both traces onto a
        common 1 m distance grid  -- this is the honest "telemetry fidelity"
        number, dominated by apex-speed and braking-point accuracy.
    Requires `pip install fastf1` and unrestricted internet (FastF1 pulls
    from the F1 live-timing servers). Results are cached under ./f1_cache.

The engine is a point-mass quasi-static solver; ~0.3-1.5 s lap-time MAE and
~5-10 km/h speed-trace MAE is the expected accuracy band for this class of
model without per-corner telemetry fitting.
"""

from __future__ import annotations

import argparse
import math
import os
import sys

import numpy as np

from car_model import car_2025, car_2026
from lap_sim import simulate_lap
from track_model import TRACKS, TRACK_POLE_BENCHMARKS, total_length

CACHE_DIR = os.path.join(os.path.dirname(__file__), "f1_cache")

# our track name -> (FastF1 event identifier, needs 'Q' session)
FASTF1_EVENT = {
    "Monza": "Italian Grand Prix",
    "Silverstone": "British Grand Prix",
    "Spa-Francorchamps": "Belgian Grand Prix",
    "Monaco": "Monaco Grand Prix",
    "Suzuka": "Japanese Grand Prix",
    "Bahrain": "Bahrain Grand Prix",
    "Red Bull Ring": "Austrian Grand Prix",
    "Interlagos": "São Paulo Grand Prix",
    "COTA": "United States Grand Prix",
}


# ---------------------------------------------------------------------------
# metrics
# ---------------------------------------------------------------------------

def _mae(errors):
    errors = [e for e in errors if e is not None and not math.isnan(e)]
    return float(np.mean(np.abs(errors))) if errors else float("nan")


def _rmse(errors):
    errors = [e for e in errors if e is not None and not math.isnan(e)]
    return float(np.sqrt(np.mean(np.square(errors)))) if errors else float("nan")


def _resample_trace(dist, speed, lap_len, n=None):
    """Resample (distance, speed) onto a uniform grid over [0, lap_len)."""
    n = n or max(int(lap_len), 500)
    grid = np.linspace(0.0, lap_len, n, endpoint=False)
    order = np.argsort(dist)
    return grid, np.interp(grid, np.asarray(dist)[order], np.asarray(speed)[order])


def _fmt(x, spec="6.2f"):
    return "   -  " if x is None or (isinstance(x, float) and math.isnan(x)) else format(x, spec)


# ---------------------------------------------------------------------------
# dry-run: sim vs stored benchmark
# ---------------------------------------------------------------------------

def dry_run(step: float = 2.0):
    print("\nDRY-RUN VALIDATION  (simulated lap vs TRACK_POLE_BENCHMARKS)\n")
    header = f"{'CIRCUIT':22s} {'LEN(m)':>7s}  {'SIM 25':>8s} {'REF 25':>8s} {'d25':>7s}   " \
             f"{'SIM 26':>8s} {'REF 26':>8s} {'d26':>7s}"
    print(header)
    print("-" * len(header))

    err25, err26 = [], []
    for name, segs in TRACKS.items():
        bench = TRACK_POLE_BENCHMARKS.get(name, {})
        r25 = simulate_lap(segs, car_2025(name), step=step, track_name=name)["lap_time"]
        r26 = simulate_lap(segs, car_2026(name), step=step, track_name=name)["lap_time"]
        ref25 = bench.get("y2025")
        ref26 = bench.get("y2026")
        d25 = (r25 - ref25) if ref25 else None
        d26 = (r26 - ref26) if ref26 else None
        if d25 is not None:
            err25.append(d25)
        if d26 is not None:
            err26.append(d26)
        print(f"{name:22s} {total_length(segs):7.0f}  "
              f"{r25:8.2f} {_fmt(ref25, '8.2f')} {_fmt(d25, '+7.2f')}   "
              f"{r26:8.2f} {_fmt(ref26, '8.2f')} {_fmt(d26, '+7.2f')}")

    print("-" * len(header))
    print(f"2025  lap-time MAE = {_mae(err25):.3f} s   RMSE = {_rmse(err25):.3f} s   (n={len(err25)})")
    print(f"2026  lap-time MAE = {_mae(err26):.3f} s   RMSE = {_rmse(err26):.3f} s   (n={len(err26)})")
    print("\nNote: only Monza / Silverstone / Spa benchmarks are FastF1-verified; "
          "the rest are approximate real poles (see TRACK_POLE_BENCHMARKS 'source').")


# ---------------------------------------------------------------------------
# fastf1: sim vs real telemetry
# ---------------------------------------------------------------------------

def fastf1_run(year: int, era: str = "auto", step: float = 2.0, only=None):
    try:
        import fastf1
    except ImportError:
        print("FastF1 not installed. Run:  pip install fastf1", file=sys.stderr)
        sys.exit(1)

    os.makedirs(CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)

    factory = car_2026 if (era == "2026" or (era == "auto" and year >= 2026)) else car_2025
    print(f"\nFASTF1 VALIDATION  year={year}  car={factory.__name__}  (fastest qualifying lap)\n")
    header = f"{'CIRCUIT':22s}  {'SIM':>8s} {'REAL':>8s} {'dLAP':>7s}   " \
             f"{'SIMvmax':>8s} {'REALvmax':>9s} {'dVMAX':>7s}   {'TRACE MAE':>9s}"
    print(header)
    print("-" * len(header))

    lap_err, vmax_err, trace_mae = [], [], []
    targets = only or list(TRACKS.keys())
    for name in targets:
        if name not in TRACKS:
            print(f"{name:22s}  (unknown track)")
            continue
        segs = TRACKS[name]
        try:
            session = fastf1.get_session(year, FASTF1_EVENT.get(name, name), "Q")
            session.load(telemetry=True, laps=True, weather=False)
            lap = session.laps.pick_fastest()
            tel = lap.get_car_data().add_distance()
            real_dist = tel["Distance"].to_numpy()
            real_speed = tel["Speed"].to_numpy()
            real_lap = lap["LapTime"].total_seconds()
        except Exception as exc:  # noqa: BLE001 - many network/parsing failure modes
            print(f"{name:22s}  FastF1 load failed: {exc}")
            continue

        sim = simulate_lap(segs, factory(name), step=step, track_name=name)
        sim_lap = sim["lap_time"]
        sim_speed_kmh = sim["v_profile"] * 3.6
        sim_vmax = float(sim_speed_kmh.max())
        real_vmax = float(np.nanmax(real_speed))

        lap_len = total_length(segs)
        _, sim_rs = _resample_trace(sim["s"], sim_speed_kmh, lap_len)
        # scale real distance axis onto our schematic lap length before comparing
        real_scaled = real_dist * (lap_len / max(real_dist.max(), 1.0))
        _, real_rs = _resample_trace(real_scaled, real_speed, lap_len)
        mae = float(np.mean(np.abs(sim_rs - real_rs)))

        lap_err.append(sim_lap - real_lap)
        vmax_err.append(sim_vmax - real_vmax)
        trace_mae.append(mae)
        print(f"{name:22s}  {sim_lap:8.2f} {real_lap:8.2f} {sim_lap-real_lap:+7.2f}   "
              f"{sim_vmax:8.1f} {real_vmax:9.1f} {sim_vmax-real_vmax:+7.1f}   {mae:9.1f}")

    print("-" * len(header))
    print(f"lap-time   MAE = {_mae(lap_err):6.3f} s      RMSE = {_rmse(lap_err):6.3f} s")
    print(f"top-speed  MAE = {_mae(vmax_err):6.2f} km/h   RMSE = {_rmse(vmax_err):6.2f} km/h")
    print(f"speed-trace MAE = {np.mean(trace_mae):6.2f} km/h  (mean of per-lap trace MAE)")


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fastf1", action="store_true", help="use real FastF1 telemetry (needs internet)")
    ap.add_argument("--year", type=int, default=2025, help="season to validate against (FastF1 mode)")
    ap.add_argument("--era", choices=["auto", "2025", "2026"], default="auto", help="which car model")
    ap.add_argument("--step", type=float, default=2.0, help="solver resolution (m)")
    ap.add_argument("--track", action="append", help="restrict to this track (repeatable)")
    args = ap.parse_args()

    if args.fastf1:
        fastf1_run(args.year, era=args.era, step=args.step, only=args.track)
    else:
        dry_run(step=args.step)


if __name__ == "__main__":
    main()
