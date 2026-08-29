"""Run the numerical/provenance validation matrix for all built-in cars/tracks."""

from car_model import car_2025, car_2026
from lap_sim import simulate_lap
from track_model import TRACKS, total_length
from validation import resolution_delta, validate_lap_result


def main():
    print("TRACK                 CAR   LAP TIME   TOP SPEED   SOURCE                 1m-2m DELTA  STATUS")
    print("-" * 104)
    for track_name, segments in TRACKS.items():
        for generation, factory in (("2025", car_2025), ("2026", car_2026)):
            car = factory(track_name)
            result = simulate_lap(segments, car, step=2.0, compute_pedals=False)
            report = validate_lap_result(result, car, total_length(segments))
            delta = resolution_delta(segments, car, simulate_lap)
            print(
                f"{track_name:21s} {generation:4s}  {report.lap_time_s:8.3f}s  "
                f"{report.top_speed_kmh:8.1f}   {report.top_speed_source:22s} "
                f"{delta:8.4f}s  {report.status}"
            )
            for warning in report.warnings:
                print(f"  WARNING: {warning}")
            for error in report.errors:
                print(f"  ERROR: {error}")


if __name__ == "__main__":
    main()
