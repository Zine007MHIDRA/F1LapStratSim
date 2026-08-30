# F1 Lap Time + Strategy Simulator

An energy-constrained point-mass vehicle dynamics simulator for F1 lap times,
tyre degradation, and pit strategy optimization. Nine Grand Prix circuits,
2025 and 2026 power-unit regulations, and an explicit ERS (hybrid energy)
model that reproduces end-of-straight "clipping".

## What's in here

| File | What it does |
|---|---|
| `track_model.py` | 9 circuits as straight/corner segment lists with turn direction, DRS zones, pit loss, ambient env, tyre-stress and pole benchmarks |
| `track_geometry.py` | Converts a track's segments into 2D (x, y) coordinates for the map view |
| `car_model.py` | Point-mass car physics: hybrid powertrain (ICE + MGU-K), real air density, drag/downforce, load-sensitive tyre grip, 5.5 g brake ceiling |
| `lap_sim.py` | Energy-constrained forward-backward solver → speed trace, sector times, G-force vectors, ERS diagnostics |
| `tyre_model.py` | Warm-up → thermal-plateau → cliff degradation per compound (soft/medium/hard + inter/wet), circuit thermal-load sensitive |
| `race_sim.py` | Runs a full stint/race lap-by-lap with degrading tyres and fuel burn-off |
| `strategy_optimizer.py` | Brute-force search over pit strategies to find the fastest |
| `map_viz.py` | Builds the speed-colored top-down track map + animated lap replay |
| `main.py` | **Interactive CLI menu — run this** |
| `app.py` | **Interactive web app (Streamlit) — run this for the browser version** |
| `theme.py` | Visual identity — dark pit-wall theme, CSS injection, HUD components, Plotly theme |
| `validate_fastf1.py` | Multi-circuit calibration harness: sim vs FastF1 telemetry, reports lap-time / top-speed / speed-trace MAE (dry-run mode works offline) |
| `calibrate_with_fastf1.py` | Single-circuit interactive telemetry overlay (run locally, needs internet) |

## Circuits

FastF1-calibrated (within ~0.6 s of real pole): **Monza, Silverstone,
Spa-Francorchamps**.

Ballpark (representative geometry + DRS + pit loss; per-track aero presets
are `# TODO calibrate` markers — finish with `validate_fastf1.py` locally):
**Monaco, Suzuka, Bahrain, Red Bull Ring, Interlagos, COTA**.

Current dry-run lap-time MAE vs `TRACK_POLE_BENCHMARKS`: ~1.0 s (2025),
~1.1 s (2026). Run `python validate_fastf1.py` for the live table.

## Car generations supported

The simulator supports two car "eras", both track-specific (see
"Cross-track calibration" below for why):

- **`car_2025(track_name)`** — fixed-wing car (pre-2026 regs).
- **`car_2026(track_name)`** — current active-aero regs. Models Z-mode (high
  downforce, corners) and X-mode (low drag, straights) as genuinely
  different aero states, a 400 kW ICE + 350 kW MGU-K split, and **no MGU-H**
  so the energy store depletes and the car clips on long straights.

`main.py` and `app.py` both ask which track first, then pass it into the car
factory automatically.

## Qualifying trim vs. race trim

Both car factories take a `trim` argument:

- **`trim="qualifying"`** (default) — light fuel (15kg), peak tyre grip,
  full engine mode. This is what's tuned against real pole times (see
  "Cross-track calibration" below), and what the Single Lap tab / Track
  Map use.
- **`trim="race"`** — full race-start fuel load (110kg for 2025, 90kg for
  2026), and slightly more conservative tyre grip and engine power,
  representing race-mode running rather than a single qualifying-spec hot
  lap. Aero (`CdA`/`ClA`) and gear-limited top speed are unchanged between
  the two trims — a team's wing choice and gear ratios don't change between
  qualifying and the race, only fuel load and how hard the car is pushed.

This exists because reusing the qualifying-tuned car across a whole
race distance (as earlier versions of this project did) meant the
strategy optimizer and custom-strategy simulator were running
unrealistically fast — a car that's light enough and pushed hard enough to
match a real pole time isn't sustainable for 50+ laps. `race_sim.py` (and
therefore both the Custom Strategy and Strategy Optimizer tabs) now uses
`trim="race"`; the Single Lap tab and Track Map still use `trim="qualifying"`.

The resulting gap is a believable 4-5 seconds slower per lap at race-start
fuel vs. qualifying pace across all three tracks and both car generations —
consistent with the real-world rule of thumb that a full tank costs
roughly 3-5s a lap at these track lengths. As a sanity check, this also
means race-trim's first-lap pace should land a bit slower than the real
fastest lap of the actual race (which happens on low fuel, late in a
stint) — which it does, by 0.5-2.7s depending on track, exactly the
direction and rough scale you'd expect.

**What this doesn't fix on its own**: tyre degradation curves needed their
own separate calibration pass — see "Tyre degradation calibration" below.

## Tyre degradation calibration

`tyre_model.py`'s degradation constants (`deg_rate_per_lap`,
`cliff_severity`, `base_grip` per compound) went through the same kind of
fix as qualifying-vs-race trim above: an earlier version produced a
genuinely broken result — a strategy running softs 26 laps (well past
their real ~15-18 lap life) could produce a single lap over 50 seconds
slower than a fresh lap, nothing like real F1.

The root cause: `grip_multiplier` feeds directly into the car's `tyre_mu`,
and this project's physics engine turns out to be *far* more sensitive to
that value than the original constants assumed — roughly **0.35-0.4
seconds of lap time per 1% of grip lost** near a fresh tyre (measured
directly by running `simulate_lap()` at a sweep of `grip_multiplier`
values and reading the actual resulting lap time). The original constants
read more like "the deg_rate value directly in seconds," which is off by
roughly two orders of magnitude given that real sensitivity.

Fixed by reverse-engineering the compound constants FROM the sim's
measured sensitivity, targeting realistic real-world figures:
- Fresh-tyre performance gap between compounds: ~0.3-0.4s per compound
  step (~0.6-0.8s soft-to-hard) — matches how Pirelli spaces compounds in
  reality.
- Pre-cliff degradation: soft ~0.07s/lap, medium ~0.04s/lap, hard
  ~0.02s/lap — all checked against actual simulated lap times, not just
  the raw grip-multiplier curve.
- Post-cliff: still a real, felt step change, but bounded to a believable
  range instead of runaway — even softs pushed to lap 40 (absurdly
  overextended) now cost +11.8s cumulative, not +50s on a single lap.
- Raised `MIN_GRIP_FLOOR` from 0.35 to 0.75 — a real tyre is essentially
  undriveable well before it would mathematically reach 35% of peak grip;
  a team pits long before that territory, and the old floor was mostly
  there to (partially) contain the runaway behavior this fix addresses
  more directly.

This is still a sensitivity-checked first pass, not fitted to real stint
data — see "Known simplifications" below for the natural next step
(fitting these constants directly from real FastF1 stint data instead).

## Cross-track calibration

Earlier versions used one fixed aero spec for every track, and separately,
were calibrated against real *fastest-race-lap* times. Both turned out to
be wrong in ways that compounded:

1. One aero spec for every track isn't how real F1 works -- teams run a
   different wing level at every circuit (Monza minimum downforce,
   Silverstone/Spa considerably more).
2. Comparing against fastest-race-lap while modeling a full-fuel
   (110kg/90kg) car was inconsistent with what people actually compare
   these sims against in practice -- real qualifying (pole) pace, which
   runs on a near-empty tank (~15kg), qualifying-spec soft tyres, and full
   engine mode.

Retuned against real 2025/2026 GP **pole times** (2026 Antonelli poles at
Silverstone/Spa; 2026 Monza is an estimate since that race hasn't happened
yet this season -- see `car_2026()`'s docstring), on a qualifying-trim fuel
load, landing within ~0.1s at every track:

| Track | 2025 sim | Real 2025 pole | 2026 sim | Real 2026 pole | Top speed (2025/2026) |
|---|---|---|---|---|---|
| Monza | 78.74s | 78.79s (Verstappen) | 82.21s | *not yet raced* (~82.3s est.) | 372 / 368 km/h |
| Silverstone | 84.89s | 84.89s (Verstappen) | 88.11s | 88.11s (Antonelli) | 348 / 344 km/h |
| Spa-Francorchamps | 100.58s | 100.56s (Antonelli) | 104.39s | 104.36s (Antonelli) | 345 / 340 km/h |

(Retuned twice after the physics engine rework below -- once for the rework
itself, once more after adding a gear-limited top-speed cap that the rework
had exposed a need for. Landed within 0.09s of every pole time both times,
with top speeds now in a realistic range too -- see "Gear-limited top
speed" below for why that needed its own fix.)

**Important trade-off to know about:** because this now targets a single
qualifying-spec hot lap (light fuel, peak tyre grip, full engine mode),
`race_sim.py`'s full-race strategy simulations will come out faster than
realistic full-race pace -- they reuse this same qualifying-tuned car for
every lap of a stint, rather than a heavier race-trim car. Giving
`race_sim.py` its own race-trim car spec (heavier fuel, slightly lower peak
grip) instead of reusing the qualifying-tuned one is the natural next fix --
noted as a roadmap item below.

**Also still true:** Monza's tuned `ClA=3.60` is NOT a realistic downforce
value -- real Monza runs the *lowest* downforce of any track, the opposite
of what that number implies. It's compensating for a side effect of
`track_geometry.py`'s closure correction (Monza's corner arc lengths were
extended so the drawn map forms a clean closed loop, costing several
seconds of lap time). See "Known simplifications" below.

## Physics engine rework (adopted from a reference implementation)

After comparing against a different, more sophisticated F1 lap-time
simulator (one that pulls real FastF1 telemetry directly rather than
hand-building track geometry -- see its `TrackDiscretization`/`VehicleModel`
classes if you want the original), several physics upgrades were ported in:

- **Load-sensitive tyre grip**: `mu_eff = tyre_mu * (N / (mass*G)) **
  mu_load_sensitivity`. Real tyres give diminishing grip returns as vertical
  load (weight + downforce) increases -- previously `tyre_mu` was flat
  regardless of load, which was likely part of why Monza needed such an
  unrealistic `ClA` to hit its target lap time (a flat-mu model has to
  overcorrect with grip everywhere a load-sensitive one wouldn't).
- **Tunable friction ellipse** (`mu_ellipse_p`, default 1.6) instead of a
  hard circle (`p=2.0`) for combining longitudinal and lateral grip demand.
- **A real bug fix**: `max_traction_accel()` always had a `lateral_frac`
  parameter for reserving grip budget during cornering-while-accelerating,
  but `lap_sim.py`'s forward pass called it with `lateral_frac=0.0` --
  always. The friction-circle/ellipse machinery existed but was never
  actually exercised. This version computes real lateral-g demand from the
  local corner radius and current speed on both the forward and backward
  passes, and reserves it properly.
- **DRS modeling for the 2025 car** (`car_2025()` now sets
  `drs_available=True`) -- previously absent entirely, despite real
  2025-era cars using DRS extensively on the main straights. Applied
  geometrically on straights longer than `DRS_MIN_STRAIGHT_M` (150m) once
  the car's own speed exceeds `DRS_SPEED_THRESHOLD_KMH` (200 km/h) -- a
  heuristic, since the hand-built tracks don't have real DRS-zone telemetry
  to draw the boundary from.
- **Multi-sweep forward/backward convergence** (`N_SWEEPS = 3`) instead of
  one independent forward pass + one independent backward pass + `min()`.
  A single pass each doesn't always converge to a self-consistent profile
  in tightly packed corner sequences (e.g. chicanes) -- tightening the
  entry to corner B can retroactively invalidate the exit speed already
  computed for corner A. Repeated sweeps let the profile settle; each sweep
  can only tighten (never loosen) the speed at any point, so it's
  guaranteed to converge monotonically.
- **A safety cap on the corner-speed solver**: load-sensitive mu makes
  `max_corner_speed()`'s equation nonlinear (no closed form), so it now
  uses damped fixed-point iteration -- which can diverge for very large
  radius + very high `ClA` combinations (the same "corner taken flat out at
  any speed" phenomenon the old closed-form solution used to clamp
  explicitly). Capped at 130 m/s (468 km/h): if a real corner would hit
  this cap, the true limiting factor is straight-line physics (power vs
  drag), not the corner formula.
- **Gear-limited top speed** (`top_speed_kmh` on `CarParams`): adding DRS
  above without this produced genuinely unrealistic top speeds -- 417 km/h
  on Spa's Kemmel Straight, caught after the fact by comparing sim output
  against real top speeds rather than just lap times. Real F1 cars are
  geared per track (teams pick a top-gear ratio so the engine hits its rev
  limiter at a sane speed for that circuit's longest straight) rather than
  accelerating indefinitely wherever power exceeds drag. Modeled as a soft
  cap: the car accelerates normally up to `top_speed_kmh`, then engine
  force is capped to exactly balance drag, holding a steady cruise instead
  of a hard discontinuity. Set per-track from real reference top speeds
  (Monza 372/368 km/h for 2025/2026, Silverstone 348/344, Spa 345/340 --
  Spa's real top speed being lower than its long straight might suggest is
  partly because the Kemmel Straight is significantly uphill, an elevation
  effect this model still doesn't capture -- see "Known simplifications").

All three tracks were retuned against the same real pole-time targets after
these changes (see table above) -- the physics changed substantially
(DRS alone was worth about 1.4s at Monza) but the tuned constants only
needed modest adjustment to land back within 0.05s of every target, which
was reassuring rather than alarming: it suggests the aero constants are
absorbing genuine track-to-track differences rather than being pure
compensating hacks (though the Monza-specific caveat above still applies).

## Setup

```bash
# 1. Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run it
python3 main.py
```

Requires Python 3.9+.

## Using the interactive menu

```
1. Simulate a single fastest lap (+ speed trace plot)
2. Simulate a custom race strategy
3. Auto-search for the best strategy
4. Show / edit car parameters
5. Exit
```

- **Option 1** gives you a lap time and a speed/throttle/brake trace plot
  (throttle and brake are derived from the speed profile's implied
  acceleration, not independently modeled driver inputs).
- **Option 2** lets you manually define a strategy, e.g. `medium(25) -> hard(28)`,
  and see the total race time with tyre degradation applied lap by lap.
- **Option 3** brute-force searches strategies (1-stop and optionally 2-stop)
  and ranks them by total race time. This can take anywhere from a few
  seconds to a couple minutes depending on the resolution (`step`) you choose
  — coarser step = faster but less precise.
- **Option 4** lets you tweak car parameters (mass, engine power, drag,
  downforce, tyre grip) directly and re-run.

## Calibrating against real data (important — do this next)

The physics constants right now (`car_2025()` / `car_2026()` in `car_model.py`)
are tuned to match **reported deltas** (real lap times, real "X% slower"
headlines), not fitted directly to raw telemetry. To calibrate properly:

```bash
pip install fastf1   # already in requirements.txt
python3 calibrate_with_fastf1.py
```

Choose 2023 (fixed-wing) or 2026 (active aero) when prompted. This downloads
a real Monza qualifying session via FastF1, pulls the fastest lap's real speed
trace, and plots it against the simulator's output so you can see exactly
where they diverge (which corner, which straight). Note: FastF1's support for
2026-season data depends on your installed FastF1 version having picked up
the new car/PU schema — if the download fails, try `pip install -U fastf1`
or check https://docs.fastf1.dev for current 2026 support status.

Then adjust in `car_model.py`:

- **2025 car** too slow/fast overall → adjust `tyre_mu`, `ClA`, or `engine_power`
- **2026 car** too slow/fast overall → adjust `corner_ClA` (cornering grip) or
  `straight_CdA`/`override_power` (straight-line pace)
- Specific corner too slow/fast → check that corner's `radius` in
  `track_model.py` against the real corner (radii here are estimates)

Repeat until the simulated trace tracks the real one within ~0.5s.

## Extending to other tracks

Add a new `Segment` list in `track_model.py` (e.g. `SILVERSTONE_SEGMENTS`),
following the same straight/corner pattern, then swap `TRACK = MONZA_SEGMENTS`
in `main.py`. Corner radii and straight lengths can be derived from real
FastF1 telemetry (X/Y position data lets you compute curvature directly) —
that's the natural next step once Monza is calibrated.

## Track map & lap replay

The web app's "Track Map" tab (and `map_viz.py` if you want to script it)
draws a top-down view of the track colored by simulated speed, plus an
animated marker that runs a full lap using Plotly's play/pause frames.

**How the 2D shape is built:** `track_model.py` now stores a turn
*direction* (+1 right, -1 left) for every corner, not just a radius.
`track_geometry.py` walks the segment list "turtle graphics" style —
accumulating heading and position — to produce (x, y) coordinates. Two
correction steps make this close into a clean loop: total heading change is
scaled to exactly ±360° (any simple closed loop must satisfy this), and any
remaining start/end position gap is distributed smoothly across the lap (a
standard surveying "closing error" adjustment).

**Important caveats:**
- The map is a **schematic shape**, not a survey-accurate track outline.
  Corner angles are chosen to close cleanly and look recognizable, not
  measured from real track data — Silverstone's `Brooklands`/`Luffield`
  directions were even flipped from their real-world sense purely to make
  the loop close without a huge distortion factor. If you want an accurate
  outline, pull real X/Y telemetry via FastF1 (it has exact position data)
  and replace the hand-built segments with it.
- The drawn line is the **single path already implied by each corner's
  assumed radius** in the physics model — it is NOT a true racing-line
  optimization. A real racing-line solver needs track-width boundaries
  (inside/outside kerb positions) and a curvature-minimization solve to find
  the genuinely fastest path across the full width of the track. That's a
  good next step, not yet built.

## Adding another track

1. In `track_model.py`, add a new `Segment` list (corners now need a
   `direction` too: `+1` for right-hand, `-1` for left-hand). See Spa's
   comment block for a worked example of picking angles that sum to ±360°
   by construction, including how a few corners' real-world handedness got
   flipped purely to keep the shape from self-intersecting.
2. Register it in the `TRACKS` dict and `TRACK_PIT_LOSS_S` dict.
3. Run `python3 track_geometry.py` — it prints the closure correction
   factor for every registered track and saves `track_shapes_test.png` so
   you can eyeball the shape before using it. A factor far from 1.0 **is
   not the main risk** — as Spa showed, a factor near 1.0 can still produce
   a self-intersecting shape if a few corners carry very large angles that
   fight each other. Prefer many modest-angle corners (20–70°) over several
   large ones (90°+) — that's what actually fixed Spa's self-intersection,
   not the closure factor.
4. That's it — `main.py` and `app.py` both pick up new tracks automatically
   from the `TRACKS` dict.

## Running the web app locally

```bash
streamlit run app.py
```

Opens at `http://localhost:8501` — sidebar picks the car generation, and
three tabs cover single-lap simulation, custom strategy testing, and the
strategy optimizer, all backed by the same physics engine as the CLI.

## Deploying for free (Streamlit Community Cloud)

This gets you a public URL (e.g. `yourname-f1sim.streamlit.app`) at zero
cost — no credit card, no server to manage. Steps:

1. **Push this project to GitHub.**
   ```bash
   git init
   git add .
   git commit -m "F1 lap + strategy simulator"
   git branch -M main
   git remote add origin https://github.com/<your-username>/f1sim.git
   git push -u origin main
   ```
   (Create the empty repo on GitHub first if you haven't — github.com/new)

2. **Go to [share.streamlit.io](https://share.streamlit.io)** and sign in
   with your GitHub account (free).

3. Click **"New app"**, pick your `f1sim` repo, branch `main`, and set the
   main file path to `app.py`.

4. Click **Deploy**. First build takes a minute or two (installs
   `requirements.txt`); after that it's live at a public URL you can share.

5. **Updating later:** every time you `git push` to `main`, the deployed app
   auto-redeploys. No redeployment step needed.

**Free tier limits to know about:** Streamlit Community Cloud apps sleep
after a period of inactivity and wake up on the next visit (a few seconds'
delay), and there's a modest RAM ceiling (~1GB) — fine for this project, but
if you ever add heavier simulations (more tracks, wider strategy search
grids), keep the `step` slider defaults conservative in `app.py` so a single
optimizer run doesn't time out or exceed memory on the free tier.

**Alternative free host:** [Hugging Face Spaces](https://huggingface.co/spaces)
also hosts Streamlit apps for free — create a Space, choose the Streamlit SDK,
and push the same files there instead (or in addition).

## Advanced physics upgrades (energy-constrained rework)

The solver was extended from a pure power-vs-grip model to an
**energy-constrained** one, and the car model split the powertrain and made
the air real.

### Hybrid powertrain + ERS energy management (`car_model.py`, `lap_sim.py`)

`engine_power` (one combined number) was split into `ice_power_w` +
`mguk_power_w`, and `lap_sim` now runs an **ERS energy pass**
(`_integrate_ers`) after the unconstrained speed profile converges:

- walks one lap from the start line tracking battery **state-of-charge**;
- deploys MGU-K under acceleration, harvests
  `E_regen = η · P_regen · dt` under braking (plus light lift-and-coast
  harvest on 2026 cruise sections);
- **2025**: MGU-H keeps the store topped, so the binding limit is the
  **4 MJ/lap deployment budget** — clipping appears late in the lap once
  it's spent;
- **2026**: no MGU-H, so the ~4 MJ store genuinely depletes — heavy clipping
  on the long straights (Kemmel, Bahrain / COTA back straights);
- the resulting per-point MGU-K power (0 W when clipped) is fed back into a
  re-converge; each pass can only slow the car, so it's monotone.

The energy pass is automatic for single-lap / telemetry runs and **skipped
for race-stint / optimizer runs** (`compute_pedals=False`) — sustainable
lap-after-lap deployment makes "full budget every lap" the right race model,
and the extra passes would 2-3× the optimizer cost.

`simulate_lap()` now also returns `sector_times`, `g_lat` / `g_long` /
`g_total` (units of g), `speed_trap_kmh`, per-straight `straight_speeds`,
`v_profile_free` (the unconstrained profile), and an `ers` diagnostics dict.

### Real air density (`car_model.air_density`)

`AIR_DENSITY = 1.225` was a fallback; `CarParams.rho` is now computed
per-circuit from the ISA barometric formula using
`TRACK_ENV[track].altitude_m` and a representative `track_temp_c`. Both drag
and downforce scale with it, so Interlagos (~785 m, hot → ρ≈0.99) is
visibly more power- and grip-limited than sea-level Monaco.

### Braking, tyres, DRS

- `max_brake_decel` is capped at `CarParams.max_decel_g` (5.5 g) — a hard
  carbon-brake ceiling for the low-speed regime.
- `tyre_model.grip_multiplier` gained a **cold warm-up phase** and a
  `thermal_load` argument; `race_sim` passes `track_model.tyre_stress(track)`
  so high-energy circuits (Bahrain, Suzuka) degrade tyres faster. Inter/wet
  compounds are defined (read as slow on a dry line, as they should).
- DRS zones are now **explicit** (`Segment.drs`), with the old
  "long straight" heuristic kept as a fallback for tracks that flag none.

### What did NOT change

The friction-ellipse exponent (`mu_ellipse_p = 1.6`) and load-sensitivity
form (`mu_eff = mu · (N/mg)^-0.05`) are kept as-is — they already express
the requested physics and are the calibrated values; the spec's circle
(p = 2) and linear `mu = mu0 - k·Fz` forms would be a regression here.
Elevation feeds air density but not yet a slope-force term.

### Recalibration note

The powertrain split + real air density + clipping shifted every lap time,
so the per-track aero presets were re-tuned. Monza / Silverstone / Spa land
within ~0.6 s of their real poles (was ~0.1 s — the FastF1 loop in
`validate_fastf1.py --fastf1` is needed to close that last bit); the 2026
gap to 2025 (~+1 s at those tracks) now comes out of the energy model
rather than a hand-set delta.

## Known simplifications (roadmap for improvement)

- **Throttle/brake traces are derived, not independently modeled** — after
  the speed profile converges, throttle%/brake% at each point come from
  comparing the actual implied acceleration against the theoretical max
  available there (same physics that built the speed profile in the first
  place). This means they're internally consistent with the speed trace by
  construction, but they're not modeling driver behavior/inputs
  independently — a real driver's throttle trace has habits, hesitations,
  and imperfections a "theoretically optimal" derived trace won't show. A
  cruise-throttle estimate (partial throttle to balance drag at a constant
  cornering speed) fills in points where accel is ~0, rather than showing 0%.
- **DRS zones are now explicit but hand-placed** — each track flags its
  activation straights via `Segment.drs` (see `drs_zone_count()`), matching
  the real number of zones per circuit. They're still placed by hand, not
  pulled from FastF1's DRS telemetry channel, and activation is still gated
  on a 200 km/h speed threshold rather than exact FIA detection points. The
  old "straight longer than 150 m" heuristic remains as a fallback for any
  track that flags no zones.
- **Load-sensitivity and friction-ellipse constants are estimated, not
  fitted** — `mu_load_sensitivity=-0.05` and `mu_ellipse_p=1.6` are
  reasonable literature-typical values, not fitted to this project's real
  telemetry (we don't have any loaded yet — see the calibration section).
  Once real telemetry is available locally, these are two more parameters
  worth fitting alongside the aero constants.

- **Tyre degradation curves are sensitivity-checked, not fitted to real
  data** — see "Tyre degradation calibration" above. `deg_rate_per_lap`/
  `cliff_severity`/`base_grip` in `tyre_model.py` were reverse-engineered
  from the sim's own measured grip sensitivity to hit realistic real-world
  per-lap-time targets, but they're still a first pass, not fitted against
  real stint data. FastF1 gives real lap times + tyre life per stint, which
  would let you fit these directly from real races.

- **Monza's tuned aero doesn't reflect real relative downforce levels**
  (see "Cross-track calibration" above) — it's compensating for the
  track-map closure correction's effect on corner arc lengths, not modeling
  a real wing choice. Reworking `track_model.py`'s Monza corner lengths to
  be shorter/more realistic (while still closing the geometry loop) and
  re-tuning `ClA` down afterward would fix this properly.
- No weight transfer / suspension model (point-mass only)
- Inter/wet compounds exist but there is **no wet-track model** — they only
  read as slow dry options; no track evolution / rubbering-in
- No traffic / overtaking / safety car modeling in the strategy optimizer
- Pit loss is now track-specific (`TRACK_PIT_LOSS_S` per circuit) but still a
  single number, not simulated pit-lane geometry / speed-limit length
- Tyre degradation curves (incl. the new warm-up and thermal-load terms) are
  sensitivity-checked, not fitted to real stint data — FastF1 lap times +
  tyre life per stint would let you fit `deg_rate_per_lap` /
  `thermal_sensitivity` per compound directly
- **2026 "clipping" is now modeled** (see "Advanced physics upgrades"):
  `lap_sim._integrate_ers` tracks battery SOC around the lap and drops
  MGU-K power to zero once the energy runs out, so 2026 cars derate toward
  ICE-only power at the end of long straights. Still first-pass: the
  deploy/harvest strategy is greedy (deploy whenever accelerating) rather
  than an optimal energy-management solve, and the effective store size
  (`battery_capacity_j`) is a calibration knob, not a measured value.
- **Track maps are schematic, not survey-accurate** (see "Track map & lap
  replay" above) — corner angles are hand-tuned to close the loop cleanly,
  not measured from real track geometry
- **No true racing-line optimization** — the drawn/animated path is the
  single line implied by each corner's assumed radius, not a solve across
  the track's actual width. Needs track-width boundary data + a
  curvature-minimization algorithm (e.g. minimum-curvature or optimal
  control lap-time solvers used in real race engineering) to add properly
- **No elevation modeling** — Spa's Eau Rouge/Raidillon compression (a
  genuinely famous ~40m uphill climb that loads the tyres extra hard at the
  bottom) isn't captured; the physics is flat 2D. Adding it means giving
  `car_model.py` a slope-dependent gravity component along the track
  direction at each point
