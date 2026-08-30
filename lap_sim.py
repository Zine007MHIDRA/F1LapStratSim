"""
lap_sim.py

Energy-constrained forward-backward speed profile solver -- the standard
quasi-static method for point-mass lap time simulation, extended with an
explicit ERS (hybrid energy) pass.

SOLVE OUTLINE
  1. Corner speed caps from radius + downforce + gear/rev limiter.
  2. Multi-sweep forward/backward convergence with FULL MGU-K deployment
     everywhere -> an energy-unconstrained profile `v_free`.
  3. ERS ENERGY PASS (`_integrate_ers`): walk the lap from the start line
     tracking battery state-of-charge. Deploy MGU-K under acceleration
     (bounded by the 2025 4 MJ/lap deployment budget, or the 2026 battery
     SOC with no MGU-H to refill it), harvest under braking
     (E_regen = eta * P_regen * dt), lift-and-coast harvest on 2026 cruise
     sections. Produces a per-point available MGU-K power that drops to zero
     once the energy runs out -> end-of-straight "clipping".
  4. Re-converge the profile with that per-point ERS power, iterate a few
     times (each pass can only slow the car -> monotone, converges), then
     integrate 1/v for lap time and per-sector splits.

Energy solving is automatic for single-lap / telemetry runs and skipped for
race-stint / strategy runs (`compute_pedals=False`), where sustainable
lap-after-lap deployment makes "full budget every lap" the right model and
the extra passes would 2-3x the optimiser cost.

Outputs (SI units unless noted): speed profile (m/s), lap + sector times (s),
lateral / longitudinal / total G-force vectors, per-straight speed traps
(km/h), and an `ers` diagnostic dict (deployed / harvested Joules, SOC trace,
clipping distance).

LATERAL GRIP RESERVATION: the real lateral-g demand at each point (from local
radius and current speed) is reserved on the friction ellipse during both the
forward (accelerating) and backward (braking) passes.

DRS / 2026 X-mode: segments flagged `drs=True` in track_model define the
activation zones; if a track flags none, any straight longer than
DRS_MIN_STRAIGHT_M is treated as eligible. DRS applies once the car's own
speed there exceeds DRS_SPEED_THRESHOLD_KMH.
"""

import numpy as np

from car_model import (
    CarParams, G, max_corner_speed, max_traction_accel, max_brake_decel,
    drag_force, powertrain_power_w,
)
from track_model import Segment, build_distance_axis, total_length, sector_fractions

DRS_MIN_STRAIGHT_M = 150.0
DRS_SPEED_THRESHOLD_KMH = 200.0
MAX_LATERAL_G = 6.0   # sanity cap for a near-zero-radius point's reserved grip
N_SWEEPS = 3
ERS_ITERS = 3         # forward/backward re-solves after each ERS integration


# ---------------------------------------------------------------------------
# DRS eligibility
# ---------------------------------------------------------------------------

def _drs_eligibility(segments, seg_idx, car: CarParams):
    """Per-point bool: True where DRS / 2026 X-mode straightline aero may be
    used. Prefers explicit `Segment.drs` zones; falls back to the long-straight
    heuristic when a track defines none."""
    if not car.drs_available:
        return np.zeros(len(seg_idx), dtype=bool)
    explicit = any(s.kind == "straight" and s.drs for s in segments)
    if explicit:
        flags = np.array([segments[i].kind == "straight" and segments[i].drs for i in seg_idx])
    else:
        flags = np.array([
            segments[i].kind == "straight" and segments[i].length >= DRS_MIN_STRAIGHT_M
            for i in seg_idx
        ])
    return flags


def _lateral_g(v: float, radius: float) -> float:
    if not np.isfinite(radius) or radius <= 0:
        return 0.0
    return min((v ** 2) / (radius * G), MAX_LATERAL_G)


def _edge_dt(v_profile, ds_arr):
    """Time to traverse each closed-loop edge, using average endpoint speed."""
    v_next = np.roll(v_profile, -1)
    return 2.0 * ds_arr / np.maximum(v_profile + v_next, 1e-6)


def _edge_accel(v_profile, ds_arr):
    """Longitudinal acceleration on each edge, a = (v_next^2 - v^2) / (2 ds)."""
    v_next = np.roll(v_profile, -1)
    return (v_next ** 2 - v_profile ** 2) / (2.0 * np.maximum(ds_arr, 1e-6))


# ---------------------------------------------------------------------------
# ERS energy pass
# ---------------------------------------------------------------------------

def _integrate_ers(v_profile, ds_arr, dt_arr, aero_mode, car: CarParams):
    """Walk one lap from the start line tracking battery state-of-charge and
    return (ers_power_per_point[W], diagnostics).

    2025 (has_mgu_h=True): MGU-H continuously refills the store, so the binding
        limit is the 4 MJ/lap MGU-K deployment budget. Clipping shows up late
        in the lap once that budget is spent.
    2026 (has_mgu_h=False): no refill -> the 4 MJ store genuinely depletes.
        Deployment is SOC-limited; braking regen (up to regen_power_w) and
        light lift-and-coast harvesting top it back up. Heavy clipping on long
        straights (Kemmel, Bahrain back straight, COTA back straight).
    """
    n = len(v_profile)
    a_edge = _edge_accel(v_profile, ds_arr)

    ers_power = np.zeros(n)
    soc_trace = np.zeros(n)
    clip_flags = np.zeros(n, dtype=bool)

    cap = car.battery_capacity_j
    battery = car.battery_start_j if car.battery_start_j is not None else cap
    budget = car.mguk_deploy_budget_j
    deployed_j = 0.0
    harvested_j = 0.0
    regen_j_per_s = car.regen_power_w * car.regen_efficiency

    for i in range(n):
        dt = dt_arr[i]
        a = a_edge[i]

        if a > 0.15:                                  # accelerating -> deploy
            want_j = car.mguk_power_w * dt
            avail_j = want_j
            if budget is not None:
                avail_j = min(avail_j, max(budget - deployed_j, 0.0))
            if not car.has_mgu_h:
                avail_j = min(avail_j, max(battery, 0.0))
            frac = avail_j / want_j if want_j > 1e-9 else 0.0
            ers_power[i] = car.mguk_power_w * frac
            deployed_j += avail_j
            battery -= avail_j
            # "clipping": MGU-K can't supply full power at speed, either because
            # the 2025 lap budget is spent or the 2026 store is (near) empty.
            near_empty = (not car.has_mgu_h) and battery < 0.05 * cap
            if v_profile[i] * 3.6 > 150.0 and (frac < 0.9 or near_empty):
                clip_flags[i] = True

        elif a < -0.15:                               # braking -> harvest
            harv_j = regen_j_per_s * dt
            if not car.has_mgu_h:
                harv_j = min(harv_j, max(cap - battery, 0.0))
                battery += harv_j
            harvested_j += harv_j

        else:                                         # cruise
            if not car.has_mgu_h:                     # 2026 lift-and-coast harvest
                harv_j = min(0.35 * regen_j_per_s * dt, max(cap - battery, 0.0))
                battery += harv_j
                harvested_j += harv_j

        if car.has_mgu_h:                             # MGU-H keeps the store full
            battery = cap
        soc_trace[i] = battery

    return ers_power, {
        "deployed_j": float(deployed_j),
        "harvested_j": float(harvested_j),
        "soc_trace": soc_trace,
        "soc_start_j": float(car.battery_start_j if car.battery_start_j is not None else cap),
        "min_soc_j": float(soc_trace.min()),
        "deploy_budget_j": budget,
        "clip_distance_m": float((clip_flags * ds_arr).sum()),
        "clip_flags": clip_flags,
        "ers_power_trace": ers_power,
    }


# ---------------------------------------------------------------------------
# Pedal / throttle-brake reconstruction
# ---------------------------------------------------------------------------

def _pedal_trace(s, v_profile, radius, mass_arr, aero_mode, drs_eligible, eff_car, ers_power):
    """Derive throttle% / brake% (0-100, like real telemetry channels) from the
    converged speed profile, using the same physics -- and the same per-point
    ERS power -- that built it."""
    n = len(v_profile)
    throttle_pct = np.zeros(n)
    brake_pct = np.zeros(n)
    accel_mps2 = np.zeros(n)

    for i in range(1, n):
        ds = s[i] - s[i - 1]
        if ds <= 0:
            continue
        v_prev, v_cur = v_profile[i - 1], v_profile[i]
        a_actual = (v_cur ** 2 - v_prev ** 2) / (2 * ds)
        accel_mps2[i] = a_actual

        lat_g = _lateral_g(v_prev, radius[i])
        drs_now = bool(drs_eligible[i]) and (v_prev * 3.6 > DRS_SPEED_THRESHOLD_KMH)
        ep = float(ers_power[i])

        if a_actual > 0.05:
            a_max = max_traction_accel(v_prev, mass_arr[i], eff_car, lateral_g=lat_g,
                                       aero_mode=aero_mode[i], drs=drs_now, ers_power_w=ep)
            throttle_pct[i] = float(np.clip(a_actual / max(a_max, 1e-6) * 100, 0, 100))
        elif a_actual < -0.05:
            a_brake = max_brake_decel(v_prev, mass_arr[i], eff_car, lateral_g=lat_g,
                                      aero_mode=aero_mode[i])
            brake_pct[i] = float(np.clip(abs(a_actual) / max(a_brake, 1e-6) * 100, 0, 100))
        else:
            CdA, _ = eff_car.aero_params(aero_mode[i])
            drag_and_rolling = (drag_force(v_prev, CdA, eff_car.rho)
                                + eff_car.rolling_resistance_coeff * mass_arr[i] * G)
            total_power = powertrain_power_w(eff_car, v_prev, ep)
            v_eff = max(v_prev, 5.0)
            engine_force_max = min(total_power * eff_car.drivetrain_efficiency / v_eff,
                                   mass_arr[i] * G * eff_car.tyre_mu * 1.3)
            throttle_pct[i] = float(np.clip(drag_and_rolling / max(engine_force_max, 1e-6) * 100, 0, 100))

    if n > 1:
        throttle_pct[0] = throttle_pct[1]
        brake_pct[0] = brake_pct[1]
        accel_mps2[0] = accel_mps2[1]

    return throttle_pct, brake_pct, accel_mps2


# ---------------------------------------------------------------------------
# Forward / backward sweeps
# ---------------------------------------------------------------------------

def _forward_pass(v_ceiling, ds_arr, radius, mass_arr, aero_mode, drs_eligible, eff_car, ers_power):
    """Propagate acceleration constraints around the closed lap, using the
    per-point MGU-K power granted by the energy pass."""
    n = len(v_ceiling)
    v = np.copy(v_ceiling)
    seed = int(np.argmin(v))
    for offset in range(1, n + 1):
        i = (seed + offset) % n
        prev = (i - 1) % n
        ds = ds_arr[prev]
        v_prev = v[prev]
        lat_g = _lateral_g(v_prev, radius[prev])
        drs_now = bool(drs_eligible[prev]) and (v_prev * 3.6 > DRS_SPEED_THRESHOLD_KMH)
        a = max_traction_accel(v_prev, mass_arr[prev], eff_car, lateral_g=lat_g,
                               aero_mode=aero_mode[prev], drs=drs_now,
                               ers_power_w=float(ers_power[prev]))
        v_possible = np.sqrt(max(v_prev ** 2 + 2 * a * ds, 0.0))
        v[i] = min(v_possible, v_ceiling[i])
    return v


def _backward_pass(v_ceiling, ds_arr, radius, mass_arr, aero_mode, eff_car):
    """Propagate braking constraints backward around the closed lap."""
    n = len(v_ceiling)
    v = np.copy(v_ceiling)
    seed = int(np.argmin(v))
    for offset in range(1, n + 1):
        i = (seed - offset) % n
        nxt = (i + 1) % n
        ds = ds_arr[i]
        v_next = v[nxt]
        lat_g = _lateral_g(v_next, radius[i])
        a_brake = max_brake_decel(v_next, mass_arr[i], eff_car, lateral_g=lat_g, aero_mode=aero_mode[i])
        v_possible = np.sqrt(max(v_next ** 2 + 2 * a_brake * ds, 0.0))
        v[i] = min(v_possible, v_ceiling[i])
    return v


def _converge(v_cap, ds_arr, radius, mass_arr, aero_mode, drs_eligible, eff_car, ers_power, n_sweeps):
    v = np.copy(v_cap)
    for _ in range(max(n_sweeps, 1)):
        v = np.minimum(v, _forward_pass(v, ds_arr, radius, mass_arr, aero_mode,
                                        drs_eligible, eff_car, ers_power))
        v = np.minimum(v, _backward_pass(v, ds_arr, radius, mass_arr, aero_mode, eff_car))
    return v


# ---------------------------------------------------------------------------
# Top-level lap simulation
# ---------------------------------------------------------------------------

def simulate_lap(segments, car: CarParams, step: float = 2.0,
                 race_distance_so_far_m: float = 0.0, grip_multiplier: float = 1.0,
                 n_sweeps: int = N_SWEEPS, compute_pedals: bool = True,
                 energy_solve: bool = None, track_name: str = None):
    """
    Returns a dict with (SI units unless noted):
      s               distance array (m)
      v_profile       achievable speed at each point (m/s)
      v_profile_free  energy-UNCONSTRAINED speed profile (m/s) for comparison
      v_cap           corner/gear speed limit at each point (m/s, inf on straights)
      lap_time        total lap time (s)
      sector_times    [S1, S2, S3] split times (s)
      sector_bounds_m (S1_end, S2_end) distances (m)
      seg_idx         segment index per point
      dt_arr, ds_arr  per-edge time (s) and distance (m)
      g_lat, g_long, g_total   G-force vectors (units of g) per point
      speed_trap_kmh  fastest straight-line speed on the lap (km/h)
      straight_speeds {segment_name: max speed km/h} for every straight
      ers             energy diagnostics dict (deployed_j, harvested_j,
                      soc_trace, min_soc_j, clip_distance_m, ers_power_trace, ...)
      throttle_pct, brake_pct, accel_mps2   (throttle/brake None unless compute_pedals)

    grip_multiplier scales tyre_mu (tyre wear: a worn tyre has < 1.0).
    energy_solve   None -> auto (on for telemetry runs, off for race/strategy
                   runs where compute_pedals is False); True/False to force.
    """
    s, radius, seg_idx = build_distance_axis(segments, step=step)
    n = len(s)
    lap_length = total_length(segments)
    ds_arr = np.diff(s, append=lap_length)

    eff_car = CarParams(**{**car.__dict__, "tyre_mu": car.tyre_mu * grip_multiplier})
    mass_arr = np.array([car.mass_at(si, total_race_distance_m=race_distance_so_far_m) for si in s])

    # 1. Corner + gear speed caps
    v_cap = np.array([max_corner_speed(r, mass_arr[i], eff_car) for i, r in enumerate(radius)])
    if eff_car.top_speed_kmh is not None:
        v_cap = np.minimum(v_cap, eff_car.top_speed_kmh / 3.6)

    aero_mode = np.where(np.isinf(radius), "straight", "corner")
    drs_eligible = _drs_eligibility(segments, seg_idx, eff_car)

    if energy_solve is None:
        energy_solve = bool(compute_pedals and eff_car.ers_enabled and eff_car.ice_power_w is not None)

    # 2. Energy-unconstrained convergence (full MGU-K everywhere)
    ers_power = np.full(n, eff_car.mguk_power_w)
    v = _converge(v_cap, ds_arr, radius, mass_arr, aero_mode, drs_eligible, eff_car, ers_power, n_sweeps)
    v_free = np.maximum(v, 1.0)

    # 3. ERS energy pass + re-converge (monotone: each pass can only slow the car)
    ers_info = None
    if energy_solve:
        for _ in range(ERS_ITERS):
            dt_tmp = _edge_dt(np.maximum(v, 1.0), ds_arr)
            ers_power, ers_info = _integrate_ers(np.maximum(v, 1.0), ds_arr, dt_tmp, aero_mode, eff_car)
            v = _converge(v_cap, ds_arr, radius, mass_arr, aero_mode, drs_eligible,
                          eff_car, ers_power, n_sweeps)

    v_profile = np.maximum(v, 1.0)

    # 4. Integrate lap + sector times
    dt_arr = _edge_dt(v_profile, ds_arr)
    lap_time = float(np.sum(dt_arr))

    f1, f2 = sector_fractions(track_name)
    b1, b2 = f1 * lap_length, f2 * lap_length
    cum_dist = np.cumsum(ds_arr)
    cum_time = np.cumsum(dt_arr)
    i1 = min(int(np.searchsorted(cum_dist, b1)), n - 1)
    i2 = min(int(np.searchsorted(cum_dist, b2)), n - 1)
    t1 = float(cum_time[i1])
    t2 = float(cum_time[i2])
    sector_times = [t1, max(t2 - t1, 0.0), max(lap_time - t2, 0.0)]

    # 5. G-force vectors
    g_lat = np.where(np.isfinite(radius),
                     v_profile ** 2 / (np.where(np.isfinite(radius), radius, 1.0) * G), 0.0)
    g_lat = np.clip(g_lat, 0.0, MAX_LATERAL_G)
    a_edge = _edge_accel(v_profile, ds_arr)
    g_long = a_edge / G
    g_total = np.hypot(g_lat, g_long)

    # 6. Speed traps (per straight) + headline trap
    straight_speeds = {}
    for idx, seg in enumerate(segments):
        if seg.kind == "straight":
            m = seg_idx == idx
            if np.any(m):
                straight_speeds[seg.name] = float(np.max(v_profile[m]) * 3.6)
    speed_trap_kmh = (max(straight_speeds.values()) if straight_speeds
                      else float(v_profile.max() * 3.6))

    # 7. Pedal traces (optional -- an extra O(n) physics pass)
    if compute_pedals:
        throttle_pct, brake_pct, accel_mps2 = _pedal_trace(
            s, v_profile, radius, mass_arr, aero_mode, drs_eligible, eff_car, ers_power)
    else:
        throttle_pct = brake_pct = None
        accel_mps2 = a_edge.copy()
        if n > 1:
            accel_mps2[-1] = accel_mps2[-2]

    if ers_info is None:  # energy pass skipped -> report full deployment, zero clip
        ers_info = {
            "deployed_j": float(np.sum(ers_power * dt_arr)),
            "harvested_j": 0.0,
            "soc_trace": np.full(n, eff_car.battery_capacity_j),
            "soc_start_j": float(eff_car.battery_capacity_j),
            "min_soc_j": float(eff_car.battery_capacity_j),
            "deploy_budget_j": eff_car.mguk_deploy_budget_j,
            "clip_distance_m": 0.0,
            "clip_flags": np.zeros(n, dtype=bool),
            "ers_power_trace": ers_power,
            "energy_solved": False,
        }
    else:
        ers_info["energy_solved"] = True

    return {
        "s": s,
        "v_profile": v_profile,
        "v_profile_free": v_free,
        "v_cap": v_cap,
        "lap_time": lap_time,
        "sector_times": sector_times,
        "sector_bounds_m": (b1, b2),
        "seg_idx": seg_idx,
        "dt_arr": dt_arr,
        "ds_arr": ds_arr,
        "g_lat": g_lat,
        "g_long": g_long,
        "g_total": g_total,
        "speed_trap_kmh": speed_trap_kmh,
        "straight_speeds": straight_speeds,
        "ers": ers_info,
        "throttle_pct": throttle_pct,
        "brake_pct": brake_pct,
        "accel_mps2": accel_mps2,
    }


if __name__ == "__main__":
    from track_model import TRACKS
    from car_model import car_2025, car_2026

    for name in TRACKS:
        r25 = simulate_lap(TRACKS[name], car_2025(name), step=3.0, track_name=name)
        r26 = simulate_lap(TRACKS[name], car_2026(name), step=3.0, track_name=name)
        s25 = "  ".join(f"{t:5.1f}" for t in r25["sector_times"])
        print(f"{name:20s} 2025 {r25['lap_time']:7.2f}s  S[{s25}]  "
              f"trap {r25['speed_trap_kmh']:5.1f}  clip {r25['ers']['clip_distance_m']:5.0f}m   "
              f"| 2026 {r26['lap_time']:7.2f}s  clip {r26['ers']['clip_distance_m']:5.0f}m")
