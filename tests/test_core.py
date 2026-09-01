import unittest

import numpy as np

from car_model import car_2025, car_2026, air_density, AIR_DENSITY
from lap_sim import simulate_lap
from race_sim import simulate_race_strategy
from track_model import (
    MONZA_SEGMENTS, TRACKS, total_length,
    TRACK_POLE_BENCHMARKS, drs_zone_count,
)
from validation import ReferenceEnvelope, resolution_delta, validate_lap_result


class LapSolverRegressionTests(unittest.TestCase):
    def test_integrates_exact_track_length(self):
        for name, segments in TRACKS.items():
            with self.subTest(track=name):
                result = simulate_lap(segments, car_2025(name), step=25.0)
                self.assertAlmostEqual(result["ds_arr"].sum(), total_length(segments), places=8)

    def test_never_exceeds_configured_top_speed(self):
        for factory in (car_2025, car_2026):
            car = factory("Monza")
            result = simulate_lap(MONZA_SEGMENTS, car, step=2.0)
            self.assertLessEqual(
                result["v_profile"].max() * 3.6,
                car.top_speed_kmh + 1e-9,
            )

    def test_start_line_is_not_forced_to_old_216_kmh_boundary(self):
        result = simulate_lap(MONZA_SEGMENTS, car_2025("Monza"), step=2.0)
        self.assertGreater(result["v_profile"][0] * 3.6, 300.0)

    def test_elapsed_time_from_solver_is_monotonic_and_physical(self):
        result = simulate_lap(MONZA_SEGMENTS, car_2025("Monza"), step=10.0)
        elapsed = np.concatenate(([0.0], np.cumsum(result["dt_arr"][:-1])))
        self.assertEqual(len(elapsed), len(result["s"]))
        self.assertTrue(np.all(np.diff(elapsed) > 0.0))
        self.assertGreater(elapsed[-1], 0.9 * result["lap_time"])
        self.assertLess(elapsed[-1], result["lap_time"])


class RaceValidationTests(unittest.TestCase):
    def test_rejects_non_positive_stints(self):
        with self.assertRaises(ValueError):
            simulate_race_strategy(
                MONZA_SEGMENTS,
                car_2025("Monza", trim="race"),
                [("medium", 11), ("hard", -1)],
                total_laps=10,
            )

    def test_rejects_unknown_compounds(self):
        with self.assertRaises(ValueError):
            simulate_race_strategy(
                MONZA_SEGMENTS,
                car_2025("Monza", trim="race"),
                [("ultrasoft", 10)],
                total_laps=10,
            )


class ModelValidationTests(unittest.TestCase):
    def test_gear_limited_speed_is_labeled_as_configured_input(self):
        car = car_2025("Monza")
        result = simulate_lap(MONZA_SEGMENTS, car, step=2.0)
        report = validate_lap_result(result, car, total_length(MONZA_SEGMENTS))
        self.assertTrue(report.valid)
        self.assertEqual(report.top_speed_source, "configured gear cap")
        self.assertTrue(any("model input" in warning for warning in report.warnings))

    def test_reference_envelope_can_flag_an_outlier(self):
        car = car_2025("Monza")
        result = simulate_lap(MONZA_SEGMENTS, car, step=5.0, compute_pedals=False)
        reference = ReferenceEnvelope(source="test fixture", top_speed_max_kmh=350.0)
        report = validate_lap_result(
            result, car, total_length(MONZA_SEGMENTS), reference=reference
        )
        self.assertTrue(any("reference envelope" in warning for warning in report.warnings))

    def test_standard_resolution_is_close_to_fine_resolution(self):
        delta = resolution_delta(MONZA_SEGMENTS, car_2025("Monza"), simulate_lap)
        self.assertLess(delta, 0.02)


class AirDensityTests(unittest.TestCase):
    def test_isa_sea_level_matches_reference(self):
        self.assertAlmostEqual(air_density(15.0, 0.0), AIR_DENSITY, delta=0.005)

    def test_hotter_and_higher_air_is_thinner(self):
        base = air_density(20.0, 0.0)
        self.assertLess(air_density(45.0, 0.0), base)         # hotter -> thinner
        self.assertLess(air_density(20.0, 2000.0), base)      # higher -> thinner

    def test_track_env_feeds_into_car(self):
        # Interlagos sits at ~785 m and runs hot -> noticeably thinner air.
        self.assertLess(car_2025("Interlagos").rho, car_2025("Monaco").rho)


class EnergyPassTests(unittest.TestCase):
    def test_energy_solve_only_slows_the_car(self):
        res = simulate_lap(MONZA_SEGMENTS, car_2025("Monza"), step=3.0, track_name="Monza")
        self.assertTrue(np.all(res["v_profile"] <= res["v_profile_free"] + 1e-6))
        self.assertTrue(res["ers"]["energy_solved"])

    def test_2025_respects_the_4mj_deployment_budget(self):
        res = simulate_lap(MONZA_SEGMENTS, car_2025("Monza"), step=3.0, track_name="Monza")
        self.assertLessEqual(res["ers"]["deployed_j"], 4_000_000.0 + 1.0)
        self.assertGreaterEqual(res["ers"]["clip_distance_m"], 0.0)

    def test_2026_battery_actually_depletes(self):
        res = simulate_lap(TRACKS["Spa-Francorchamps"], car_2026("Spa-Francorchamps"),
                           step=3.0, track_name="Spa-Francorchamps")
        ers = res["ers"]
        # no MGU-H -> the store is genuinely run down over the lap
        self.assertLess(ers["min_soc_j"], 0.5 * ers["soc_start_j"])
        self.assertGreaterEqual(ers["clip_distance_m"], 0.0)

    def test_2026_clips_on_a_power_track(self):
        res = simulate_lap(MONZA_SEGMENTS, car_2026("Monza"), step=3.0, track_name="Monza")
        self.assertGreater(res["ers"]["clip_distance_m"], 0.0)

    def test_race_sims_skip_the_energy_pass_for_speed(self):
        res = simulate_lap(MONZA_SEGMENTS, car_2025("Monza"), step=8.0, compute_pedals=False)
        self.assertFalse(res["ers"]["energy_solved"])


class LapOutputTests(unittest.TestCase):
    def test_sector_times_sum_to_lap_time(self):
        res = simulate_lap(MONZA_SEGMENTS, car_2025("Monza"), step=3.0, track_name="Monza")
        self.assertAlmostEqual(sum(res["sector_times"]), res["lap_time"], delta=0.05)

    def test_g_force_vectors_are_consistent_and_bounded(self):
        res = simulate_lap(MONZA_SEGMENTS, car_2025("Monza"), step=3.0, track_name="Monza")
        self.assertTrue(np.all(np.isfinite(res["g_total"])))
        self.assertLess(np.max(res["g_lat"]), 6.5)
        np.testing.assert_allclose(
            res["g_total"], np.hypot(res["g_lat"], res["g_long"]), rtol=1e-6)

    def test_speed_trap_is_the_fastest_straight(self):
        res = simulate_lap(MONZA_SEGMENTS, car_2025("Monza"), step=3.0, track_name="Monza")
        self.assertAlmostEqual(res["speed_trap_kmh"], max(res["straight_speeds"].values()), places=6)


class ExpandedCatalogueTests(unittest.TestCase):
    NEW_TRACKS = ("Monaco", "Suzuka", "Bahrain", "Red Bull Ring", "Interlagos", "COTA")

    def test_all_new_tracks_simulate_and_have_drs_zones(self):
        for name in self.NEW_TRACKS:
            with self.subTest(track=name):
                self.assertIn(name, TRACKS)
                self.assertGreaterEqual(drs_zone_count(TRACKS[name]), 1)
                res = simulate_lap(TRACKS[name], car_2025(name), step=6.0, track_name=name)
                self.assertGreater(res["lap_time"], 40.0)
                self.assertTrue(np.all(np.isfinite(res["v_profile"])))

    def test_new_tracks_are_within_ballpark_of_benchmark_poles(self):
        # "Ballpark" acceptance -- these six are not FastF1-calibrated yet.
        for name in self.NEW_TRACKS:
            ref = TRACK_POLE_BENCHMARKS[name]["y2025"]
            sim = simulate_lap(TRACKS[name], car_2025(name), step=4.0, track_name=name)["lap_time"]
            with self.subTest(track=name):
                self.assertLess(abs(sim - ref), 4.0, f"{name}: sim {sim:.2f}s vs ref {ref:.2f}s")


class CircuitMetadataTests(unittest.TestCase):
    REQUIRED_CIRCUITS = ["Monza", "Monaco", "Silverstone", "Spa-Francorchamps", "Suzuka"]

    def test_every_track_has_valid_metadata(self):
        from track_model import TRACK_METADATA, track_metadata, track_country, track_location, track_flag, track_full_name, track_characteristics
        for name in TRACKS.keys():
            with self.subTest(track=name):
                self.assertIn(name, TRACK_METADATA)
                meta = track_metadata(name)
                self.assertEqual(meta.name, name)
                self.assertTrue(len(track_country(name)) > 0)
                self.assertTrue(len(track_location(name)) > 0)
                self.assertTrue(len(track_flag(name)) > 0)
                self.assertTrue(len(track_full_name(name)) > 0)
                self.assertTrue(len(track_characteristics(name)) > 0)

    def test_required_circuits_have_distinct_data(self):
        from track_model import track_metadata, race_laps, pit_loss_for
        circuit_profiles = set()
        countries = set()
        lengths = set()

        for name in self.REQUIRED_CIRCUITS:
            meta = track_metadata(name)
            countries.add(meta.country)
            lap_len = round(total_length(TRACKS[name]))
            lengths.add(lap_len)
            n_laps = race_laps(name)
            n_corners = sum(1 for s in TRACKS[name] if s.kind == "corner")
            p_loss = pit_loss_for(name)
            circuit_profiles.add((name, meta.country, lap_len, n_laps, n_corners, p_loss))

        # Every required circuit has a distinct country and unique overall profile
        self.assertEqual(len(countries), len(self.REQUIRED_CIRCUITS))
        self.assertEqual(len(lengths), len(self.REQUIRED_CIRCUITS))
        self.assertEqual(len(circuit_profiles), len(self.REQUIRED_CIRCUITS))


    def test_unknown_circuit_neutral_fallback_does_not_default_to_monza(self):
        from track_model import track_metadata
        meta = track_metadata("Kyalami")
        self.assertEqual(meta.name, "Kyalami")
        self.assertNotEqual(meta.country, "Italy")
        self.assertEqual(meta.country, "International")
        self.assertEqual(meta.flag, "🏁")


if __name__ == "__main__":
    unittest.main()

