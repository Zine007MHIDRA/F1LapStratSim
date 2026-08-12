"""
lap_sim.py

Forward-backward speed profile solver — the standard method for point-mass
lap time simulation.

Idea:
  1. Compute the max cornering speed at every point on track (from radius).
  2. Run several FORWARD/BACKWARD sweeps that each only tighten (never
     loosen) the achievable speed at every point:
       FORWARD:  starting from each corner exit, accelerate as hard as
                 possible (engine/grip limited, reserving lateral grip for
                 the corner ahead) until you'd exceed the next constraint.
       BACKWARD: starting from each corner entry, apply max braking
                 backwards along the track (reserving lateral grip for the
                 corner behind) — the latest point you could still be going
                 fast and still slow down in time.
     A single forward+backward pass (what earlier versions of this file
     did) doesn't always converge to a self-consistent profile — e.g. in a
     tightly packed sequence of corners, tightening the entry to corner B
     can retroactively invalidate the exit speed already computed for
     corner A. Repeating the sweep a few times (this version) lets brake
     points and corner exits settle into equilibrium; each sweep can only
     reduce the profile (never increase it), so it's guaranteed to converge.
  3. Integrate 1/v over distance to get lap time.

This mirrors what real vehicle dynamics / lap sim tools do (OptimumLap etc.)

LATERAL GRIP RESERVATION: earlier versions of this file called
max_traction_accel() with lateral_frac hardcoded to 0.0 — meaning the
friction-circle/ellipse machinery for "some grip is already spent cornering"
existed in car_model.py but was never actually exercised during
acceleration. This version computes the real lateral-g demand at each point
(from the local corner radius and current speed) and reserves it properly,
on both the forward (accelerating out of/into a corner) and backward
(braking into a corner) passes.

DRS: for cars with car.drs_available=True (2025-era only — 2026 replaced
DRS with active aero), any straight segment longer than DRS_MIN_STRAIGHT_M
is geometrically DRS-eligible; DRS is applied once the car's own speed at
that point (from the current sweep) exceeds DRS_SPEED_THRESHOLD_KMH. This
mirrors a common real-world heuristic (a fast, low-drag section is where DRS
zones are placed) rather than requiring exact real DRS-zone telemetry, which
this project's hand-built tracks don't have.
"""

import numpy as np
from car_model import CarParams, G, max_corner_speed, max_traction_accel, max_brake_decel, drag_force
from track_model import Segment, build_distance_axis, total_length

DRS_MIN_STRAIGHT_M = 150.0
DRS_SPEED_THRESHOLD_KMH = 200.0
MAX_LATERAL_G = 6.0  # sanity cap so a near-zero-radius point can't demand absurd reserved grip
N_SWEEPS = 3


def _drs_eligibility(segments, seg_idx, car: CarParams):
    """Per-point bool: True if this point is on a straight long enough to
    plausibly carry a DRS zone AND the car has DRS at all."""
    if not car.drs_available:
        return np.zeros(len(seg_idx), dtype=bool)
    eligible = np.array([
        segments[idx].kind == "straight" and segments[idx].length >= DRS_MIN_STRAIGHT_M
        for idx in seg_idx
    ])
    return eligible


def _lateral_g(v: float, radius: float) -> float:
    if not np.isfinite(radius) or radius <= 0:
        return 0.0
    return min((v ** 2) / (radius * G), MAX_LATERAL_G)


def _pedal_trace(s, v_profile, radius, mass_arr, aero_mode, drs_eligible, eff_car):
    """
    Derives throttle%/brake% (0-100, like real telemetry channels) from the
    final converged v_profile, for display alongside the speed trace.

    At each point, computes the actual acceleration implied by the speed
    profile (a = (v_i^2 - v_i-1^2) / 2*ds), then normalizes it against the
    theoretical max accel/brake available at that point (same physics used
    to build the profile) to get a 0-100% throttle or brake reading.

    Points where the car is neither accelerating nor braking (e.g. holding
    a constant cornering speed at v_cap) get a "cruise throttle" — the
    partial throttle needed to exactly balance drag at that speed — matching
    how real telemetry shows partial throttle through fast, flat-out corners
    rather than 0%.
    """
    n = len(v_profile)
    throttle_pct = np.zeros(n)
    brake_pct = np.zeros(n)
    accel_mps2 = np.zeros(n)

    for i in range(1, n):
        ds = s[i] - s[i - 1]
        if ds <= 0:
            continue
        v_prev = v_profile[i - 1]
        v_cur = v_profile[i]
        a_actual = (v_cur ** 2 - v_prev ** 2) / (2 * ds)
        accel_mps2[i] = a_actual

        lat_g = _lateral_g(v_prev, radius[i])
        drs_now = bool(drs_eligible[i]) and (v_prev * 3.6 > DRS_SPEED_THRESHOLD_KMH)

        if a_actual > 0.05:
            a_max = max_traction_accel(v_prev, mass_arr[i], eff_car, lateral_g=lat_g,
                                        aero_mode=aero_mode[i], drs=drs_now)
            throttle_pct[i] = float(np.clip(a_actual / max(a_max, 1e-6) * 100, 0, 100))
        elif a_actual < -0.05:
            a_brake = max_brake_decel(v_prev, mass_arr[i], eff_car, lateral_g=lat_g, aero_mode=aero_mode[i])
            brake_pct[i] = float(np.clip(abs(a_actual) / max(a_brake, 1e-6) * 100, 0, 100))
        else:
            # Cruising at constant speed (e.g. holding the corner cap): the
            # partial throttle that exactly balances drag at this speed.
            CdA, _ = eff_car.aero_params(aero_mode[i])
            drag_and_rolling = drag_force(v_prev, CdA) + eff_car.rolling_resistance_coeff * mass_arr[i] * G
            total_power = eff_car.engine_power + eff_car.override_power_at(v_prev)
            v_eff = max(v_prev, 5.0)
            engine_force_max = min(total_power * eff_car.drivetrain_efficiency / v_eff,
                                    mass_arr[i] * G * eff_car.tyre_mu * 1.3)
            throttle_pct[i] = float(np.clip(drag_and_rolling / max(engine_force_max, 1e-6) * 100, 0, 100))

    # first point: mirror the second so there's no artificial zero at s=0
    if n > 1:
        throttle_pct[0] = throttle_pct[1]
        brake_pct[0] = brake_pct[1]
        accel_mps2[0] = accel_mps2[1]

    return throttle_pct, brake_pct, accel_mps2


def _forward_pass(v_ceiling, s, radius, mass_arr, aero_mode, drs_eligible, eff_car):
    n = len(v_ceiling)
    v = np.copy(v_ceiling)
    v[0] = min(v[0], 60.0)  # assume rolling start speed at s=0 for simplicity
    for i in range(1, n):
        ds = s[i] - s[i - 1]
        v_prev = v[i - 1]
        lat_g = _lateral_g(v_prev, radius[i])
        drs_now = bool(drs_eligible[i]) and (v_prev * 3.6 > DRS_SPEED_THRESHOLD_KMH)
        a = max_traction_accel(v_prev, mass_arr[i], eff_car, lateral_g=lat_g,
                                aero_mode=aero_mode[i], drs=drs_now)
        v_possible = np.sqrt(max(v_prev ** 2 + 2 * a * ds, 0.0))
        v[i] = min(v_possible, v_ceiling[i])
    return v


def _backward_pass(v_ceiling, s, radius, mass_arr, aero_mode, eff_car):
    n = len(v_ceiling)
    v = np.copy(v_ceiling)
    for i in range(n - 2, -1, -1):
        ds = s[i + 1] - s[i]
        v_next = v[i + 1]
        lat_g = _lateral_g(v_next, radius[i])
        a_brake = max_brake_decel(v_next, mass_arr[i], eff_car, lateral_g=lat_g, aero_mode=aero_mode[i])
        v_possible = np.sqrt(max(v_next ** 2 + 2 * a_brake * ds, 0.0))
        v[i] = min(v_possible, v_ceiling[i])
    return v


def simulate_lap(segments, car: CarParams, step: float = 2.0,
                  race_distance_so_far_m: float = 0.0, grip_multiplier: float = 1.0,
                  n_sweeps: int = N_SWEEPS, compute_pedals: bool = True):
    """
    Returns dict with:
      s          - distance array (m)
      v_profile  - achievable speed at each point (m/s)
      v_corner_cap - corner speed limit at each point (m/s, inf on straights)
      lap_time   - total lap time (s)
      seg_idx    - segment index per point (for plotting/labels)
      throttle_pct, brake_pct, accel_mps2 - only populated if compute_pedals=True
        (this is a real extra O(n) physics pass, worth skipping for race/
        strategy sims that run simulate_lap hundreds of times and never look
        at pedal data — see race_sim.py)

    grip_multiplier: scales tyre_mu (used later for tyre degradation —
    a worn tyre has grip_multiplier < 1.0)
    """
    s, radius, seg_idx = build_distance_axis(segments, step=step)
    n = len(s)

    # Effective car params for this lap (grip degraded by tyre wear if applicable)
    eff_car = CarParams(**{**car.__dict__, "tyre_mu": car.tyre_mu * grip_multiplier})

    # Mass at each point (fuel burns off across the lap)
    mass_arr = np.array([car.mass_at(si, total_race_distance_m=race_distance_so_far_m) for si in s])

    # 1. Corner speed caps
    v_cap = np.array([max_corner_speed(r, mass_arr[i], eff_car) for i, r in enumerate(radius)])

    # Aero mode per point: 'corner' (Z-mode/high downforce) inside corners,
    # 'straight' (X-mode/low drag) on straights. For fixed-wing cars
    # (active_aero=False) this has no effect — aero_params() ignores mode.
    aero_mode = np.where(np.isinf(radius), "straight", "corner")
    drs_eligible = _drs_eligibility(segments, seg_idx, eff_car)

    # 2. Multi-sweep forward/backward convergence. Each pass can only
    # tighten (reduce) the profile relative to the ceiling passed in, so
    # this is guaranteed to converge monotonically.
    v = np.copy(v_cap)
    v[0] = min(v[0], 60.0)
    for _ in range(max(n_sweeps, 1)):
        v_fwd = _forward_pass(v, s, radius, mass_arr, aero_mode, drs_eligible, eff_car)
        v = np.minimum(v, v_fwd)
        v_bwd = _backward_pass(v, s, radius, mass_arr, aero_mode, eff_car)
        v = np.minimum(v, v_bwd)

    v_profile = np.maximum(v, 1.0)  # avoid div by zero

    # 3. Integrate lap time: dt = ds / v
    ds_arr = np.diff(s, append=s[-1] + step)
    dt_arr = ds_arr / v_profile
    lap_time = np.sum(dt_arr)

    # 4. Derive throttle/brake traces from the final converged speed profile
    #    (skippable — see compute_pedals docstring note above)
    if compute_pedals:
        throttle_pct, brake_pct, accel_mps2 = _pedal_trace(
            s, v_profile, radius, mass_arr, aero_mode, drs_eligible, eff_car)
    else:
        throttle_pct = brake_pct = accel_mps2 = None

    return {
        "s": s,
        "v_profile": v_profile,
        "v_cap": v_cap,
        "lap_time": lap_time,
        "seg_idx": seg_idx,
        "dt_arr": dt_arr,
        "throttle_pct": throttle_pct,
        "brake_pct": brake_pct,
        "accel_mps2": accel_mps2,
    }


if __name__ == "__main__":
    from track_model import MONZA_SEGMENTS
    from car_model import car_2025, car_2026

    print("=== 2025-spec car ===")
    result25 = simulate_lap(MONZA_SEGMENTS, car_2025())
    t25 = result25['lap_time']
    print(f"Lap time: {t25:.3f}s ({int(t25//60)}:{t25%60:05.2f})")
    print(f"Top speed: {result25['v_profile'].max()*3.6:.1f} km/h")

    print("\n=== 2026-spec car (active aero + Manual Override) ===")
    result26 = simulate_lap(MONZA_SEGMENTS, car_2026())
    t26 = result26['lap_time']
    print(f"Lap time: {t26:.3f}s ({int(t26//60)}:{t26%60:05.2f})")
    print(f"Top speed: {result26['v_profile'].max()*3.6:.1f} km/h")
    print(f"\nDelta vs 2025: {t26-t25:+.3f}s")
