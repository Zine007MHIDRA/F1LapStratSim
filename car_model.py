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

from track_model import track_environment

G = 9.81                    # m/s^2, gravitational acceleration
AIR_DENSITY = 1.225         # kg/m^3, ISA sea level @ 15 C (fallback default)
R_SPECIFIC_AIR = 287.05     # J/(kg.K), specific gas constant for dry air
P0_SEA_LEVEL = 101_325.0    # Pa


def air_density(track_temp_c: float = 15.0, altitude_m: float = 0.0) -> float:
    """Real air density rho [kg/m^3] from surface temperature and elevation.

    Static pressure follows the ISA barometric formula up to the troposphere:
        p(h) = p0 * (1 - 2.25577e-5 * h) ** 5.25588        [Pa]
    and density from the ideal gas law with the *track surface* air temperature
    (the boundary layer the car actually runs in is hotter than the reported
    air temp, so track_temp_c is the right input here):
        rho = p / (R_specific * T),   T = track_temp_c + 273.15   [K]

    Worked examples:
      Monza    (162 m, 42 C track): ~1.10 kg/m^3   (-10 % vs 1.225 -> less drag)
      Interlagos (785 m, 45 C):     ~0.99 kg/m^3   (-19 %, notably power/grip limited)
      Monaco   (10 m, 40 C):        ~1.11 kg/m^3
    """
    p = P0_SEA_LEVEL * (1.0 - 2.25577e-5 * max(altitude_m, 0.0)) ** 5.25588
    t_kelvin = track_temp_c + 273.15
    return p / (R_SPECIFIC_AIR * t_kelvin)


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

    # --- Air density (set per-track from car_model.air_density()) ------------
    # Both drag and downforce scale linearly with rho, so hot/high circuits
    # (Interlagos ~0.99, Mexico would be ~0.9) meaningfully reduce grip AND
    # drag relative to a cool sea-level track.
    rho: float = AIR_DENSITY

    # --- Hybrid powertrain / ERS energy model ------------------------------
    # When ice_power_w is set, the solver uses an explicit ICE + MGU-K split
    # with a lap-level energy budget (see lap_sim._integrate_ers), producing
    # end-of-straight "clipping" once deployment energy runs out. When it is
    # None, the legacy combined `engine_power` (+ manual override taper) path
    # is used instead, preserving older ad-hoc CarParams() behaviour.
    ice_power_w: Optional[float] = None          # combustion-engine crank power
    mguk_power_w: float = 120_000.0              # MGU-K deployment power (reg cap)
    mguk_deploy_budget_j: Optional[float] = 4_000_000.0
    #   per-LAP MGU-K deployment limit. 2025 reg = 4 MJ/lap; MGU-H keeps the
    #   store topped so this budget, not the battery, is the binding limit.
    #   Set None for 2026 (no per-lap cap -- deployment is battery-SOC limited).
    battery_capacity_j: float = 4_000_000.0      # usable energy store capacity
    battery_start_j: Optional[float] = None      # SOC at start line; None => full
    regen_power_w: float = 120_000.0             # max harvest power under braking
    regen_efficiency: float = 0.85               # brake energy -> stored energy
    has_mgu_h: bool = True                       # True (2025): MGU-H tops the ES
    #                                              continuously. False (2026):
    #                                              removed -> SOC can be depleted.
    ers_enabled: bool = True                     # master switch for the energy pass

    # --- Braking limit ----------------------------------------------------
    # Carbon-carbon discs + slick grip + downforce let modern F1 cars pull
    # ~5-6 g of deceleration at high speed; grip/aero already bound this in
    # max_brake_decel, and this is a hard ceiling for the low-speed regime.
    max_decel_g: float = 5.5

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


def car_2025(track_name: str = "Monza", trim: str = "qualifying") -> CarParams:
    """Fixed-wing car matching the pre-2026 regulation era.

    trim="qualifying" (default): a single hot lap -- light fuel (15kg),
    peak tyre grip, full engine mode. Tuned to real QUALIFYING (pole) pace.
    trim="race": full race-start fuel load, slightly more conservative tyre
    grip and engine mode -- see car_2025_race_notes below for why and how
    this was calibrated. Aero (CdA/ClA) and top speed are unchanged between
    the two -- a team's wing choice and gear ratios don't change between
    qualifying and the race, only fuel load and how hard the tyres/engine
    are pushed lap after lap.

    Aero (CdA/ClA) is track-specific: real F1 teams run a different wing
    level at every track (Monza minimum downforce, Silverstone/Spa higher).

    Retuned against real 2025 GP pole times (trim="qualifying"), landing
    within ~0.1s of each:
      Monza:       78.72s vs real pole 78.79s (Verstappen, 1:18.792)
      Silverstone: 84.97s vs real pole 84.89s (Verstappen, 1:24.892)
      Spa:        100.53s vs real pole 100.56s (Antonelli, 1:40.562)

    See car_2025_race_notes / README for trim="race" calibration.
    """
    # top_speed_kmh: real gear-limited terminal speeds (with DRS), not
    # arbitrary tuning knobs. Spa's real top speed is lower than its huge
    # Kemmel Straight might suggest because that straight is significantly
    # uphill (not modeled), so its cap partly stands in for that.
    #
    # CALIBRATION STATUS: Monza / Silverstone / Spa are FastF1-tuned (~0.1s).
    # The other six are BALLPARK ONLY -- TODO: tune CdA / ClA / top_speed_kmh
    # against TRACK_POLE_BENCHMARKS with validate_fastf1.py locally.
    presets = {
        "Monza":             dict(CdA=0.80, ClA=3.20, top_speed_kmh=372.0),
        "Silverstone":       dict(CdA=0.65, ClA=2.65, top_speed_kmh=348.0),
        "Spa-Francorchamps": dict(CdA=0.55, ClA=1.38, top_speed_kmh=345.0),
        "Monaco":            dict(CdA=1.05, ClA=3.95, top_speed_kmh=295.0),   # TODO calibrate
        "Suzuka":            dict(CdA=0.78, ClA=3.05, top_speed_kmh=322.0),   # TODO calibrate
        "Bahrain":           dict(CdA=0.70, ClA=3.05, top_speed_kmh=330.0),   # TODO calibrate
        "Red Bull Ring":     dict(CdA=0.60, ClA=2.35, top_speed_kmh=330.0),   # TODO calibrate
        "Interlagos":        dict(CdA=0.80, ClA=2.95, top_speed_kmh=320.0),   # TODO calibrate
        "COTA":              dict(CdA=0.82, ClA=3.10, top_speed_kmh=330.0),   # TODO calibrate
    }
    aero = presets.get(track_name, presets["Monza"])
    env = track_environment(track_name)
    if trim == "race":
        fuel_mass, fuel_burn_rate = 110.0, 0.30
        ice_power_w, tyre_mu = 630_000.0, 1.75
    else:
        fuel_mass, fuel_burn_rate = 15.0, 0.30
        ice_power_w, tyre_mu = 660_000.0, 1.90
    return CarParams(
        mass_empty=798.0, fuel_mass=fuel_mass, fuel_burn_rate=fuel_burn_rate,
        engine_power=ice_power_w + 120_000.0,   # combined figure for display/legacy
        drivetrain_efficiency=0.90,
        CdA=aero["CdA"], ClA=aero["ClA"], active_aero=False, manual_override=False,
        drs_available=True, top_speed_kmh=aero["top_speed_kmh"],
        tyre_mu=tyre_mu, rolling_resistance_coeff=0.015,
        rho=air_density(env["track_temp_c"], env["altitude_m"]),
        # 2025 hybrid: ~560-660 kW ICE + 120 kW MGU-K (reg cap), 4 MJ/lap
        # deployment limit, MGU-H keeps the store topped between deploys.
        ice_power_w=ice_power_w, mguk_power_w=120_000.0,
        mguk_deploy_budget_j=4_000_000.0, battery_capacity_j=4_000_000.0,
        regen_power_w=120_000.0, regen_efficiency=0.85, has_mgu_h=True,
    )


def car_2026(track_name: str = "Monza", trim: str = "qualifying") -> CarParams:
    """2026-spec car: lighter, active aero (Z-mode corners / X-mode straights),
    Manual Override MGU-K boost.

    trim="qualifying" (default) vs trim="race": same reasoning as
    car_2025() above -- fuel load and how hard tyres/engine are pushed
    differ, aero and gearing (top speed) don't.

    Per-track corner_ClA (Z-mode downforce) and straight_CdA (X-mode drag)
    tuned against real 2026 GP pole times where available (trim="qualifying"):
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
    # CALIBRATION STATUS: Silverstone / Spa are FastF1-tuned; Monza is an
    # estimate (2026 race not yet run). The other six are BALLPARK ONLY --
    # TODO: tune corner_ClA / straight_CdA / top_speed_kmh locally.
    presets = {
        "Monza":             dict(corner_ClA=2.44, straight_CdA=0.65, top_speed_kmh=368.0),
        "Silverstone":       dict(corner_ClA=2.07, straight_CdA=0.55, top_speed_kmh=344.0),
        "Spa-Francorchamps": dict(corner_ClA=0.62, straight_CdA=0.55, top_speed_kmh=340.0),
        "Monaco":            dict(corner_ClA=2.85, straight_CdA=0.95, top_speed_kmh=292.0),  # TODO
        "Suzuka":            dict(corner_ClA=2.35, straight_CdA=0.62, top_speed_kmh=318.0),  # TODO
        "Bahrain":           dict(corner_ClA=2.10, straight_CdA=0.58, top_speed_kmh=324.0),  # TODO
        "Red Bull Ring":     dict(corner_ClA=1.85, straight_CdA=0.50, top_speed_kmh=326.0),  # TODO
        "Interlagos":        dict(corner_ClA=2.25, straight_CdA=0.64, top_speed_kmh=316.0),  # TODO
        "COTA":              dict(corner_ClA=2.40, straight_CdA=0.66, top_speed_kmh=326.0),  # TODO
    }
    aero = presets.get(track_name, presets["Monza"])
    env = track_environment(track_name)
    if trim == "race":
        fuel_mass, fuel_burn_rate = 90.0, 0.28
        ice_power_w, tyre_mu = 400_000.0, 1.72
    else:
        fuel_mass, fuel_burn_rate = 15.0, 0.28
        ice_power_w, tyre_mu = 400_000.0, 1.85
    return CarParams(
        mass_empty=768.0,          # official 2026 minimum weight
        fuel_mass=fuel_mass,
        fuel_burn_rate=fuel_burn_rate,
        engine_power=ice_power_w + 350_000.0,   # combined figure for display/legacy
        drivetrain_efficiency=0.90,
        rho=air_density(env["track_temp_c"], env["altitude_m"]),
        # 2026 hybrid: ~50/50 split -- 400 kW ICE + 350 kW MGU-K, NO MGU-H, so
        # the 4 MJ energy store is genuinely depletable and the car derates
        # ("clips") toward ICE-only power at the end of long straights.
        ice_power_w=ice_power_w, mguk_power_w=350_000.0,
        mguk_deploy_budget_j=None,          # no per-lap cap -- SOC is the limit
        # 4 MJ store, but drivers manage deployment + lift-and-coast so the
        # effective per-lap energy is higher; ~5.4 MJ reproduces the observed
        # real 2025->2026 pole delta (~+3 to +4 s) rather than over-clipping.
        battery_capacity_j=5_400_000.0, battery_start_j=5_400_000.0,
        regen_power_w=350_000.0, regen_efficiency=0.90, has_mgu_h=False,
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
        # Manual Override is superseded: MGU-K deployment (incl. its overtake
        # boost) is now modelled explicitly by the ERS energy pass.
        manual_override=False,
        tyre_mu=tyre_mu,
        rolling_resistance_coeff=0.014,
        top_speed_kmh=aero["top_speed_kmh"],
    )


def drag_force(v: float, CdA: float, rho: float = AIR_DENSITY) -> float:
    """Aerodynamic drag [N] = 0.5 * rho * CdA * v^2."""
    return 0.5 * rho * CdA * v ** 2


def downforce(v: float, ClA: float, rho: float = AIR_DENSITY) -> float:
    """Aerodynamic downforce [N] = 0.5 * rho * ClA * v^2 (added to vertical load)."""
    return 0.5 * rho * ClA * v ** 2


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
        N = mass * G + downforce(v, ClA, car.rho)
        mu_eff = mu_effective(car.tyre_mu, N, mass, car.mu_load_sensitivity)
        v_new = np.sqrt(max(mu_eff * N * r / mass, 1e-6))
        if v_new > v_cap:
            return v_cap
        if abs(v_new - v) < 1e-3:
            break
        v = 0.5 * (v + v_new)  # damping for stability
    return float(min(v, v_cap))


def powertrain_power_w(car: CarParams, v: float, ers_power_w: Optional[float] = None) -> float:
    """Total crank power [W] available at speed v.

    ers_power_w:
      * None  -> the solver isn't doing explicit energy management. Use the
                 full MGU-K rating (ice_power_w + mguk_power_w) if the car has
                 the split defined, else the legacy combined `engine_power`
                 plus the manual-override taper.
      * float -> the exact MGU-K power the energy pass has granted at this
                 point on track (0 during clipping, up to mguk_power_w).
    """
    if car.ice_power_w is not None:
        mguk = car.mguk_power_w if ers_power_w is None else max(0.0, ers_power_w)
        return car.ice_power_w + mguk
    # legacy combined-power path
    extra = car.override_power_at(v) if ers_power_w is None else max(0.0, ers_power_w)
    return car.engine_power + extra


def max_traction_accel(v: float, mass: float, car: CarParams, lateral_g: float = 0.0,
                        aero_mode: str = "straight", drs: bool = False,
                        ers_power_w: Optional[float] = None) -> float:
    """
    Max forward acceleration [m/s^2] at speed v, accounting for:
      - hybrid powertrain power ceiling: ICE + MGU-K deployment (P = F*v ->
        F = P/v), with MGU-K power set by the ERS energy pass via ers_power_w
        (0 W once the lap's deployment budget / battery SOC is spent -> the
        "clipping" you see at the end of long straights). Capped at low speed
        by a traction limit so force isn't infinite at v=0.
      - load-sensitive tyre grip on a friction ellipse (grip already spent
        cornering is passed in as lateral_g, in units of g)
      - DRS (2025-era): reduces drag and downforce when open
      - gear/rev limiter: at car.top_speed_kmh, drive force exactly balances
        drag (net accel -> 0), not a hard wall
      - aerodynamic drag (density rho and aero mode for this part of track)
    """
    CdA, ClA = car.aero_params(aero_mode)
    if drs and car.drs_available:
        CdA *= car.drs_drag_mult
        ClA *= car.drs_downforce_mult
    rho = car.rho
    v_eff = max(v, 5.0)  # avoid singularity at very low speed

    if car.top_speed_kmh is not None and v * 3.6 >= car.top_speed_kmh:
        # Rev limiter reached: exactly enough force to hold steady speed.
        engine_force = drag_force(v, CdA, rho) + car.rolling_resistance_coeff * mass * G
    else:
        total_power = powertrain_power_w(car, v, ers_power_w)
        engine_force = min(total_power * car.drivetrain_efficiency / v_eff,
                            mass * G * car.tyre_mu * 1.3)  # traction-limited launch cap

    N = mass * G + downforce(v, ClA, rho)
    mu_eff = mu_effective(car.tyre_mu, N, mass, car.mu_load_sensitivity)
    total_grip = mu_eff * N
    Fy = min(max(lateral_g, 0.0) * G * mass, total_grip - 1e-6)
    remaining_long_grip = _friction_ellipse_Fx(total_grip, Fy, car.mu_ellipse_p)

    drive_force = min(engine_force, remaining_long_grip)
    net_force = drive_force - drag_force(v, CdA, rho) - car.rolling_resistance_coeff * mass * G
    return net_force / mass


def max_brake_decel(v: float, mass: float, car: CarParams, lateral_g: float = 0.0,
                     aero_mode: str = "corner") -> float:
    """Max deceleration under braking: load-sensitive tyre grip (on the same
    friction ellipse as acceleration) plus drag (which helps braking). DRS is
    always assumed closed while braking. Defaults to 'corner' (Z-mode) aero
    since braking zones are typically where the car has already switched to
    high-downforce mode ahead of the corner. Deceleration is capped at
    car.max_decel_g (carbon-brake + tyre ceiling, ~5.5 g) so the low-speed
    regime -- where tyre grip alone could imply more -- stays physical."""
    CdA, ClA = car.aero_params(aero_mode)
    rho = car.rho
    N = mass * G + downforce(v, ClA, rho)
    mu_eff = mu_effective(car.tyre_mu, N, mass, car.mu_load_sensitivity)
    total_grip = mu_eff * N
    Fy = min(max(lateral_g, 0.0) * G * mass, total_grip - 1e-6)
    Fx_tyre = _friction_ellipse_Fx(total_grip, Fy, car.mu_ellipse_p)
    brake_force = Fx_tyre + drag_force(v, CdA, rho)
    return min(brake_force / mass, car.max_decel_g * G)


if __name__ == "__main__":
    print("=== 2025-spec (fixed wing) ===")
    car = car_2025()
    m = car.mass_at(0)
    print(f"Mass: {m:.1f} kg")
    print(f"Curva Grande (r=230m): {max_corner_speed(230, m, car)*3.6:.1f} km/h")
    print(f"Parabolica (r=175m): {max_corner_speed(175, m, car)*3.6:.1f} km/h")
    print(f"Rettifilo chicane (r=22m): {max_corner_speed(22, m, car)*3.6:.1f} km/h")

    print(f"Air density (Monza): {car.rho:.3f} kg/m^3")

    print("\n=== 2026-spec (active aero, 400kW ICE + 350kW MGU-K, no MGU-H) ===")
    car26 = car_2026()
    m26 = car26.mass_at(0)
    print(f"Mass: {m26:.1f} kg   Air density: {car26.rho:.3f} kg/m^3")
    print(f"Curva Grande (r=230m): {max_corner_speed(230, m26, car26)*3.6:.1f} km/h")
    print(f"Parabolica (r=175m): {max_corner_speed(175, m26, car26)*3.6:.1f} km/h")
    print(f"Rettifilo chicane (r=22m): {max_corner_speed(22, m26, car26)*3.6:.1f} km/h")
    print(f"Max accel at 340 km/h (full MGU-K deploy): "
          f"{max_traction_accel(340/3.6, m26, car26, aero_mode='straight', ers_power_w=350_000):.2f} m/s^2")
    print(f"Max accel at 340 km/h (clipped, ICE only): "
          f"{max_traction_accel(340/3.6, m26, car26, aero_mode='straight', ers_power_w=0.0):.2f} m/s^2")