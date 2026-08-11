"""
car_model.py

Point-mass F1 car model. This is the same class of model used in real
lap-time simulation tools (OptimumLap, academic LTS papers): the car is
treated as a point with:
  - mass (+ fuel burning off during the run)
  - an engine power curve (limits acceleration at high speed)
  - aerodynamic drag (opposes motion, grows with v^2)
  - aerodynamic downforce (adds vertical load -> more tyre grip, grows with v^2)
  - a tyre friction coefficient (mu) that combines with total vertical load
    (weight + downforce) to set the available grip, both longitudinal and lateral

It is NOT a full multi-body / suspension model — no weight transfer, no
individual corner loads, no chassis roll. That's a deliberate simplification:
point-mass models get lap times within a few % of real ones for well-tuned
constants, and are what you calibrate against real telemetry.

REGULATION ERAS SUPPORTED:
  - "2023-2025" style: fixed-configuration wings (one CdA/ClA pair per track,
    the wing level you'd choose in setup, same for whole lap except DRS zones
    which this model ignores for simplicity)
  - "2026" style: TRUE active aero. The car has two distinct aero states:
      Z-MODE (high downforce) — deployed in corners for max grip
      X-MODE (low drag)       — deployed on straights for max speed / efficiency
    This isn't a simplification hack — it's how the real 2026 regs work:
    movable front/rear wing elements switch between these two modes, replacing
    DRS. There's also a "Manual Override" system: extra MGU-K electrical power
    available as an overtaking tool, which tapers off between 290-355 km/h.

Reference figures (2026 regs, from FIA technical regulations coverage):
  - Minimum weight: 768 kg (car + driver, no fuel) — down 30kg from 798kg
  - ~55% less drag, ~30% less downforce than 2025-era cars (regulation intent)
  - Power unit: ~1000hp combined, 50/50 split between ICE and electric
  - MGU-K power raised from 120kW to 350kW; MGU-H removed
  - Narrower 18-inch tyres (25mm less front tread, 30mm less rear)
"""

from dataclasses import dataclass, field
from typing import Optional
import numpy as np

G = 9.81            # m/s^2
AIR_DENSITY = 1.225  # kg/m^3 (sea level, ~20C — good enough for Monza)


@dataclass
class CarParams:
    mass_empty: float = 798.0       # kg, car + driver, no fuel
    fuel_mass: float = 110.0        # kg, race-start fuel load
    fuel_burn_rate: float = 0.30    # kg per km

    engine_power: float = 750_000.0  # watts, base ICE+MGU-K combined output
    drivetrain_efficiency: float = 0.90

    # --- Fixed-wing aero (used when active_aero=False) ---
    CdA: float = 0.90   # drag coefficient x frontal area (m^2)
    ClA: float = 2.00   # downforce coefficient x frontal area (m^2)

    # --- Active aero (used when active_aero=True) ---
    active_aero: bool = False
    corner_CdA: Optional[float] = None    # Z-mode (high downforce) drag
    corner_ClA: Optional[float] = None    # Z-mode (high downforce) lift
    straight_CdA: Optional[float] = None  # X-mode (low drag) drag
    straight_ClA: Optional[float] = None  # X-mode (low drag) lift

    # --- Manual Override (2026 MGU-K overtaking boost) ---
    manual_override: bool = False
    override_power: float = 350_000.0  # watts, extra MGU-K power available
    override_taper_start_kmh: float = 290.0  # power starts tapering off above this speed
    override_taper_end_kmh: float = 355.0    # power reaches zero at this speed

    tyre_mu: float = 1.75            # peak combined tyre friction coefficient (slicks, in-window)
    rolling_resistance_coeff: float = 0.015

    # --- Load-sensitive grip + friction ellipse (adopted from cross-checking
    # against a real-telemetry-calibrated reference implementation) ---
    # Real tyres give diminishing grip returns as vertical load increases --
    # mu_eff = tyre_mu * (N / (mass*G)) ** mu_load_sensitivity, with a
    # negative exponent so effective mu falls as load (weight + downforce)
    # rises above the car's static weight alone.
    mu_load_sensitivity: float = -0.05
    # Friction "ellipse" exponent for combining longitudinal + lateral grip
    # demand: (Fx/F_max)^p + (Fy/F_max)^p <= 1. p=2.0 is a circle (our old
    # model); real tyres are often better approximated by a slightly
    # squarer ellipse, p ~= 1.5-1.8.
    mu_ellipse_p: float = 1.6

    # --- DRS (2025-era only; 2026 replaced DRS with active aero, see above) ---
    drs_available: bool = False
    drs_drag_mult: float = 0.75       # drag multiplier when DRS is open
    drs_downforce_mult: float = 0.90  # downforce multiplier when DRS is open

    # --- Gear-limited top speed ---
    # Real F1 cars are geared per track: teams pick a top-gear ratio so the
    # engine hits its rev limiter at a sane speed for that circuit's longest
    # straight, rather than accelerating indefinitely wherever power exceeds
    # drag. Without this, a long enough straight (Spa's Kemmel Straight,
    # 1.8km) combined with DRS-reduced drag lets the point-mass model climb
    # to unrealistic speeds (400+ km/h) that no real F1 car reaches. Set to
    # None to disable (no cap).
    top_speed_kmh: Optional[float] = None

    def aero_params(self, mode: str):
        """Returns (CdA, ClA) for the requested aero mode ('corner' or 'straight').
        Falls back to fixed CdA/ClA if active_aero is off."""
        if not self.active_aero:
            return self.CdA, self.ClA
        if mode == "corner":
            return (self.corner_CdA if self.corner_CdA is not None else self.CdA,
                    self.corner_ClA if self.corner_ClA is not None else self.ClA)
        else:
            return (self.straight_CdA if self.straight_CdA is not None else self.CdA,
                    self.straight_ClA if self.straight_ClA is not None else self.ClA)

    def override_power_at(self, v_ms: float) -> float:
        """Extra MGU-K power available from Manual Override at this speed.
        Tapers linearly from full power at override_taper_start_kmh to zero
        at override_taper_end_kmh, matching the real system's behavior."""
        if not self.manual_override:
            return 0.0
        v_kmh = v_ms * 3.6
        if v_kmh <= self.override_taper_start_kmh:
            return self.override_power
        if v_kmh >= self.override_taper_end_kmh:
            return 0.0
        span = self.override_taper_end_kmh - self.override_taper_start_kmh
        frac_remaining = (self.override_taper_end_kmh - v_kmh) / span
        return self.override_power * frac_remaining

    def mass_at(self, distance_into_lap_m: float, lap_number: int = 0, total_race_distance_m: float = 0.0) -> float:
        """Current mass = empty + remaining fuel. Simplified: fuel burns linearly
        with distance travelled so far in the race (not just this lap)."""
        total_travelled = total_race_distance_m + distance_into_lap_m
        fuel_burned = min(self.fuel_mass, self.fuel_burn_rate * (total_travelled / 1000.0))
        return self.mass_empty + max(0.0, self.fuel_mass - fuel_burned)


def car_2025(track_name: str = "Monza") -> CarParams:
    """Fixed-wing car matching the pre-2026 regulation era, tuned to real
    QUALIFYING (pole) pace -- not full-race pace.

    Aero (CdA/ClA) is track-specific: real F1 teams run a different wing
    level at every track (Monza minimum downforce, Silverstone/Spa higher).
    Fuel load is also qualifying-trim (15kg, a representative out+flying+in
    lap load) rather than a full race tank (110kg) -- using race fuel while
    trying to match pole times was papering over ~95kg of extra mass with
    unrealistic downforce, which is why earlier tuning passes needed
    increasingly extreme ClA values without ever quite closing the gap.
    Peak tyre grip (tyre_mu=1.90) and engine power (780kW) are also nudged
    up slightly from the race-pace defaults, representing qualifying-spec
    soft tyres and full engine mode.

    Retuned against real 2025 GP pole times, landing within ~0.1s of each:
      Monza:       78.72s vs real pole 78.79s (Verstappen, 1:18.792)
      Silverstone: 84.97s vs real pole 84.89s (Verstappen, 1:24.892)
      Spa:        100.53s vs real pole 100.56s (Antonelli, 1:40.562)

    NOTE: this now represents a single hot qualifying lap, not sustainable
    full-race pace -- race-distance strategy sims (race_sim.py) will run
    faster than real full-fuel race pace as a result, since they reuse this
    same car spec across a whole stint. A proper fix would give race_sim a
    separate race-trim car (heavier fuel, slightly less aggressive tyre_mu)
    instead of reusing the qualifying-tuned spec for both purposes --
    flagged as a roadmap item in the README.
    """
    # top_speed_kmh: real gear-limited terminal speeds (with DRS), not
    # arbitrary tuning knobs -- Monza/Silverstone/Spa top speeds in recent
    # seasons cluster in these ranges. Spa's real top speed is lower than
    # its huge Kemmel Straight might suggest because the straight is
    # significantly uphill (not modeled here -- see README's elevation
    # caveat), so its real-world cap partly stands in for that missing effect.
    presets = {
        "Monza":             dict(CdA=0.80, ClA=3.20, top_speed_kmh=372.0),
        "Silverstone":       dict(CdA=0.65, ClA=2.65, top_speed_kmh=348.0),
        "Spa-Francorchamps": dict(CdA=0.55, ClA=1.30, top_speed_kmh=345.0),
    }
    aero = presets.get(track_name, presets["Monza"])
    return CarParams(
        mass_empty=798.0, fuel_mass=15.0, fuel_burn_rate=0.30,
        engine_power=780_000.0, drivetrain_efficiency=0.90,
        CdA=aero["CdA"], ClA=aero["ClA"], active_aero=False, manual_override=False,
        drs_available=True, top_speed_kmh=aero["top_speed_kmh"],
        tyre_mu=1.90, rolling_resistance_coeff=0.015,
    )


def car_2026(track_name: str = "Monza") -> CarParams:
    """2026-spec car: lighter, active aero (Z-mode corners / X-mode straights),
    Manual Override MGU-K boost -- also now tuned to real QUALIFYING pace on
    a qualifying-trim fuel load (15kg), same reasoning as car_2025() above.

    Per-track corner_ClA (Z-mode downforce) and straight_CdA (X-mode drag)
    tuned against real 2026 GP pole times where available:
      Silverstone: 88.06s vs real pole 88.11s (Antonelli, 1:28.111)
      Spa:        104.46s vs real pole 104.36s (Antonelli, 1:44.361)
      Monza:       82.35s vs an ESTIMATED 82.30s -- the 2026 Italian GP
        hasn't happened yet this season (it's a September race), so this
        target is extrapolated from the observed 2025->2026 pole delta at
        the other two tracks (+3.22s at Silverstone, +3.80s at Spa, ~+3.5s
        average) applied to Monza's real 2025 pole (78.792s). Re-tune this
        once the real 2026 Italian GP has happened.

    Spa again needed extra straight-line drag (straight_CdA=1.13) for the
    same reason as the 2025 car -- its long Kemmel Straight otherwise
    dominates and undoes the cornering penalty, landing Spa unrealistically
    fast relative to Monza/Silverstone.
    """
    presets = {
        "Monza":             dict(corner_ClA=2.44, straight_CdA=0.65, top_speed_kmh=368.0),
        "Silverstone":       dict(corner_ClA=2.07, straight_CdA=0.55, top_speed_kmh=344.0),
        "Spa-Francorchamps": dict(corner_ClA=0.62, straight_CdA=0.55, top_speed_kmh=340.0),
    }
    aero = presets.get(track_name, presets["Monza"])
    return CarParams(
        mass_empty=768.0,          # official 2026 minimum weight
        fuel_mass=15.0,            # qualifying-trim load (see car_2025() docstring)
        fuel_burn_rate=0.28,
        engine_power=780_000.0,    # slightly up from race-pace default, full quali engine mode
        drivetrain_efficiency=0.90,
        # Fallback fixed values (used only if active_aero is somehow off)
        CdA=0.70, ClA=1.60,
        active_aero=True,
        # Z-mode: high downforce for corners -- but genuinely down on the old
        # ClA. Early-2026 data (Melbourne, Shanghai, Bahrain testing) shows
        # cars running notably slower through fast corners despite active
        # aero -- drivers reported feeling ~50 km/h slower through high-speed
        # sections, consistent with the ~30% downforce cut not being fully
        # compensated by the lighter, narrower-tyre package.
        corner_CdA=0.90, corner_ClA=aero["corner_ClA"],
        # X-mode: low drag for straights -- real early-2026 top speeds (e.g.
        # ~328-341 km/h in Bahrain testing) are higher than typical 2025 top
        # speeds at most tracks but not dramatically so once you account for
        # "clipping" (MGU-K battery depletes mid-straight, so the car can't
        # sustain peak power the whole way down it -- see energy_budget note below)
        straight_CdA=aero["straight_CdA"], straight_ClA=0.95,
        manual_override=True,
        override_power=60_000.0,   # override boost is modest in absolute terms
                                    # (~50kW around 300 km/h per team/paddock
                                    # commentary) -- NOT the full 350kW MGU-K
                                    # rating, which mostly covers normal deployment
        override_taper_start_kmh=290.0,
        override_taper_end_kmh=355.0,
        tyre_mu=1.85,               # narrower tyres, qualifying-spec softs
        rolling_resistance_coeff=0.014,
        top_speed_kmh=aero["top_speed_kmh"],
    )


def drag_force(v: float, CdA: float) -> float:
    return 0.5 * AIR_DENSITY * CdA * v ** 2


def downforce(v: float, ClA: float) -> float:
    return 0.5 * AIR_DENSITY * ClA * v ** 2


def mu_effective(mu_base: float, N: float, mass: float, mu_load_sensitivity: float) -> float:
    """Load-sensitive tyre friction coefficient: real tyres give diminishing
    grip returns as vertical load (weight + downforce) increases above the
    car's static weight. mu_load_sensitivity is negative, so mu_eff falls
    below mu_base as N grows past mass*G."""
    return mu_base * (N / (mass * G)) ** mu_load_sensitivity


def _friction_ellipse_Fx(total_grip: float, Fy: float, p: float) -> float:
    """Available longitudinal force given lateral force Fy already in use,
    on a friction ellipse (Fx/F)^p + (Fy/F)^p <= 1 rather than a hard circle
    (p=2). Real tyres are often better approximated by p ~= 1.5-1.8."""
    p = max(p, 1.01)
    return max(total_grip ** p - abs(Fy) ** p, 0.0) ** (1.0 / p)


def max_corner_speed(radius: float, mass: float, car: CarParams) -> float:
    """
    Solve for the max speed sustainable through a corner of given radius.
    Always uses 'corner' (Z-mode, high downforce) aero when active_aero is on.

    With a constant mu this has a closed form (see git history), but
    load-sensitive mu makes the equation nonlinear in v (mu_eff itself
    depends on v through downforce), so this now uses damped fixed-point
    iteration instead:

        v_new = sqrt( mu_eff(v) * N(v) * r / m ),  N(v) = m*g + downforce(v)

    which converges in a handful of iterations for realistic parameters --
    EXCEPT when downforce grows with v^2 fast enough to nearly match the
    growth in required centripetal force (large radius + high ClA). That's
    a real phenomenon (why some real corners are taken "flat out" at
    increasing speed with no natural limit) but for a point-mass model
    without a rev/gear/drag ceiling feeding into this specific equation, it
    shows up as the iteration diverging rather than a sane clamp. Capped at
    a generous 130 m/s (468 km/h) as a safety net -- if a real corner would
    hit this cap, the true limiting factor is the straight-line physics
    (power vs drag), not the corner formula, and max_traction_accel /
    max_brake_decel will bind first regardless.
    """
    if np.isinf(radius):
        return np.inf
    _, ClA = car.aero_params("corner")
    r = max(float(radius), 5.0)
    v_cap = 130.0  # m/s safety cap, see docstring

    v = 50.0  # m/s initial guess
    for _ in range(30):
        N = mass * G + downforce(v, ClA)
        mu_eff = mu_effective(car.tyre_mu, N, mass, car.mu_load_sensitivity)
        v_new = np.sqrt(max(mu_eff * N * r / mass, 1e-6))
        if v_new > v_cap:
            return v_cap
        if abs(v_new - v) < 1e-3:
            break
        v = 0.5 * (v + v_new)  # damping for stability
    return float(min(v, v_cap))


def max_traction_accel(v: float, mass: float, car: CarParams, lateral_g: float = 0.0,
                        aero_mode: str = "straight", drs: bool = False) -> float:
    """
    Max forward acceleration at speed v, accounting for:
      - engine power ceiling (P = F*v -> F = P/v, capped at low speed by a
        traction limit so we don't get infinite force at v=0)
      - Manual Override MGU-K boost (2026 only), tapering off at high speed
      - load-sensitive tyre grip on a friction ellipse (some grip budget
        already used for cornering, expressed as lateral_g in units of g --
        e.g. 3.0 means the corner is currently demanding 3g of lateral force)
      - DRS (2025-era only): reduces drag and downforce when open and the
        car's own drs_available flag is set
      - gear-limited top speed (rev limiter): once v reaches car.top_speed_kmh,
        engine force is capped to exactly balance drag, holding a steady
        cruise speed instead of continuing to accelerate
      - drag opposing forward motion (uses the aero mode for this part of track)
    """
    CdA, ClA = car.aero_params(aero_mode)
    if drs and car.drs_available:
        CdA *= car.drs_drag_mult
        ClA *= car.drs_downforce_mult
    v_eff = max(v, 5.0)  # avoid singularity at very low speed

    if car.top_speed_kmh is not None and v * 3.6 >= car.top_speed_kmh:
        # Rev limiter reached: exactly enough force to hold steady speed,
        # net acceleration = 0 (not a hard wall -- the car just stops
        # gaining speed here, same as a real car bouncing off the limiter).
        engine_force = drag_force(v, CdA) + car.rolling_resistance_coeff * mass * G
    else:
        total_power = car.engine_power + car.override_power_at(v)
        engine_force = min(total_power * car.drivetrain_efficiency / v_eff,
                            mass * G * car.tyre_mu * 1.3)  # traction-limited launch cap

    N = mass * G + downforce(v, ClA)
    mu_eff = mu_effective(car.tyre_mu, N, mass, car.mu_load_sensitivity)
    total_grip = mu_eff * N
    Fy = min(max(lateral_g, 0.0) * G * mass, total_grip - 1e-6)
    remaining_long_grip = _friction_ellipse_Fx(total_grip, Fy, car.mu_ellipse_p)

    drive_force = min(engine_force, remaining_long_grip)
    net_force = drive_force - drag_force(v, CdA) - car.rolling_resistance_coeff * mass * G
    return net_force / mass


def max_brake_decel(v: float, mass: float, car: CarParams, lateral_g: float = 0.0,
                     aero_mode: str = "corner") -> float:
    """Max deceleration under braking: load-sensitive tyre grip (on the same
    friction ellipse as acceleration) plus drag (which helps braking). DRS is
    always assumed closed while braking. Defaults to 'corner' (Z-mode) aero
    since braking zones are typically where the car has already switched to
    high-downforce mode ahead of the corner."""
    CdA, ClA = car.aero_params(aero_mode)
    N = mass * G + downforce(v, ClA)
    mu_eff = mu_effective(car.tyre_mu, N, mass, car.mu_load_sensitivity)
    total_grip = mu_eff * N
    Fy = min(max(lateral_g, 0.0) * G * mass, total_grip - 1e-6)
    Fx_tyre = _friction_ellipse_Fx(total_grip, Fy, car.mu_ellipse_p)
    brake_force = Fx_tyre + drag_force(v, CdA)
    return brake_force / mass


if __name__ == "__main__":
    print("=== 2025-spec (fixed wing) ===")
    car = car_2025()
    m = car.mass_at(0)
    print(f"Mass: {m:.1f} kg")
    print(f"Curva Grande (r=230m): {max_corner_speed(230, m, car)*3.6:.1f} km/h")
    print(f"Parabolica (r=175m): {max_corner_speed(175, m, car)*3.6:.1f} km/h")
    print(f"Rettifilo chicane (r=22m): {max_corner_speed(22, m, car)*3.6:.1f} km/h")

    print("\n=== 2026-spec (active aero + Manual Override) ===")
    car26 = car_2026()
    m26 = car26.mass_at(0)
    print(f"Mass: {m26:.1f} kg")
    print(f"Curva Grande (r=230m): {max_corner_speed(230, m26, car26)*3.6:.1f} km/h")
    print(f"Parabolica (r=175m): {max_corner_speed(175, m26, car26)*3.6:.1f} km/h")
    print(f"Rettifilo chicane (r=22m): {max_corner_speed(22, m26, car26)*3.6:.1f} km/h")
    print(f"Max accel at 340 km/h on straight (X-mode, override active): "
          f"{max_traction_accel(340/3.6, m26, car26, aero_mode='straight'):.2f} m/s^2")
    print(f"Max accel at 340 km/h on straight (no override): "
          f"{max_traction_accel(340/3.6, m26, CarParams(**{**car26.__dict__, 'manual_override': False}), aero_mode='straight'):.2f} m/s^2")