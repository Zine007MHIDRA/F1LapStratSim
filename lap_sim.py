"""
lap_sim.py

Forward-backward speed profile solver — the standard method for point-mass
lap time simulation.

Idea:
  1. Compute the max cornering speed at every point on track (from radius).
  2. FORWARD PASS: starting from each corner exit, accelerate as hard as
     possible (engine/grip limited) until you'd exceed the next corner's
     max speed, or catch up to another constraint.
  3. BACKWARD PASS: starting from each corner entry, apply max braking
     backwards along the track — this gives the latest point you could
     still be going fast and still slow down in time for the corner.
  4. The actual achievable speed at each point = the MINIMUM of:
       - the corner's own max speed cap
       - the forward-pass (acceleration-limited) speed
       - the backward-pass (braking-limited) speed
  5. Integrate 1/v over distance to get lap time.

This mirrors what real vehicle dynamics / lap sim tools do (OptimumLap etc.)
"""

import numpy as np
from car_model import CarParams, max_corner_speed, max_traction_accel, max_brake_decel
from track_model import Segment, build_distance_axis, total_length


def simulate_lap(segments, car: CarParams, step: float = 2.0,
                  race_distance_so_far_m: float = 0.0, grip_multiplier: float = 1.0):
    """
    Returns dict with:
      s          - distance array (m)
      v_profile  - achievable speed at each point (m/s)
      v_corner_cap - corner speed limit at each point (m/s, inf on straights)
      lap_time   - total lap time (s)
      seg_idx    - segment index per point (for plotting/labels)

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

    # 2. Forward pass (acceleration limited)
    v_fwd = np.copy(v_cap)
    v_fwd[0] = min(v_fwd[0], 60.0)  # assume rolling start speed at s=0 for simplicity
    for i in range(1, n):
        ds = s[i] - s[i - 1]
        v_prev = v_fwd[i - 1]
        a_max = max_traction_accel(v_prev, mass_arr[i], eff_car, lateral_frac=0.0,
                                    aero_mode=aero_mode[i])
        v_possible = np.sqrt(max(v_prev ** 2 + 2 * a_max * ds, 0.0))
        v_fwd[i] = min(v_possible, v_cap[i])

    # 3. Backward pass (braking limited) — iterate backwards from end to start
    v_bwd = np.copy(v_cap)
    for i in range(n - 2, -1, -1):
        ds = s[i + 1] - s[i]
        v_next = v_bwd[i + 1]
        a_brake = max_brake_decel(v_next, mass_arr[i], eff_car, aero_mode=aero_mode[i])
        v_possible = np.sqrt(max(v_next ** 2 + 2 * a_brake * ds, 0.0))
        v_bwd[i] = min(v_possible, v_cap[i])

    # 4. Achievable speed = min of all three constraints
    v_profile = np.minimum(np.minimum(v_fwd, v_bwd), v_cap)
    v_profile = np.maximum(v_profile, 1.0)  # avoid div by zero

    # 5. Integrate lap time: dt = ds / v
    ds_arr = np.diff(s, append=s[-1] + step)
    dt_arr = ds_arr / v_profile
    lap_time = np.sum(dt_arr)

    return {
        "s": s,
        "v_profile": v_profile,
        "v_cap": v_cap,
        "lap_time": lap_time,
        "seg_idx": seg_idx,
        "dt_arr": dt_arr,
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
