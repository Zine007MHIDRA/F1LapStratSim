# F1 Lap Time + Strategy Simulator

A point-mass vehicle dynamics simulator for F1 lap times, tyre degradation,
and pit strategy optimization — built for Monza, structured so any track
can be added.

## Link to the app
**`https://u49dslx5aub9xmappx5y8ss.streamlit.app/`**

## What's in here

| File | What it does |
|---|---|
| `track_model.py` | Defines each track as a sequence of straights/corners, with turn direction (Monza + Silverstone built in) |
| `track_geometry.py` | Converts a track's segments into 2D (x, y) coordinates for the map view |
| `car_model.py` | Point-mass car physics: engine, drag, downforce, tyre grip |
| `lap_sim.py` | Forward-backward solver — turns track+car into a speed trace and lap time |
| `tyre_model.py` | Grip degradation curves per compound (soft/medium/hard) |
| `race_sim.py` | Runs a full stint/race lap-by-lap with degrading tyres |
| `strategy_optimizer.py` | Brute-force search over pit strategies to find the fastest |
| `map_viz.py` | Builds the speed-colored top-down track map + animated lap replay |
| `main.py` | **Interactive CLI menu — run this** |
| `app.py` | **Interactive web app (Streamlit) — run this for the browser version** |
| `calibrate_with_fastf1.py` | Compares the sim against real F1 telemetry (run locally, needs internet) |

## Car generations supported

The simulator supports two car "eras", both track-specific (see
"Cross-track calibration" below for why):

- **`car_2025(track_name)`** — fixed-wing car (pre-2026 regs).
- **`car_2026(track_name)`** — current active-aero regs. Models Z-mode (high
  downforce, used in corners) and X-mode (low drag, used on straights) as
  genuinely different aero states, plus the Manual Override MGU-K boost.

`main.py` and `app.py` both ask which track first, then pass it into the car
factory automatically.

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

| Track | 2025 sim | Real 2025 pole | 2026 sim | Real 2026 pole |
|---|---|---|---|---|
| Monza | 78.78s | 78.79s (Verstappen) | 82.28s | *not yet raced* (~82.3s est.) |
| Silverstone | 84.92s | 84.89s (Verstappen) | 88.07s | 88.11s (Antonelli) |
| Spa-Francorchamps | 100.56s | 100.56s (Antonelli) | 104.34s | 104.36s (Antonelli) |

(Retuned again after the physics engine rework below -- landed within 0.05s
at every track despite the underlying model changing substantially, which
is a good sign the model's degrees of freedom are doing real work rather
than overfitting to one specific set of assumptions.)

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

- **Option 1** gives you a lap time and a speed-vs-distance plot.
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

## Known simplifications (roadmap for improvement)

- **DRS zones are a geometric heuristic, not real telemetry** — any straight
  segment longer than 150m becomes DRS-eligible once the car's own speed
  passes 200 km/h. Real DRS zones have specific FIA-defined activation/
  deactivation points that don't perfectly track "long enough straight,
  fast enough already." Pulling real DRS zone boundaries from FastF1
  telemetry (it has a DRS channel) would fix this properly — same
  local-only-execution caveat as `calibrate_with_fastf1.py`.
- **Load-sensitivity and friction-ellipse constants are estimated, not
  fitted** — `mu_load_sensitivity=-0.05` and `mu_ellipse_p=1.6` are
  reasonable literature-typical values, not fitted to this project's real
  telemetry (we don't have any loaded yet — see the calibration section).
  Once real telemetry is available locally, these are two more parameters
  worth fitting alongside the aero constants.

- **Race strategy sims use qualifying-trim fuel/grip for every lap**
  (see "Cross-track calibration" above) — `car_2025()`/`car_2026()` are
  tuned to match real pole times on a light qualifying fuel load, but
  `race_sim.py` reuses that same spec across a full race distance. A
  dedicated race-trim car (heavier fuel, slightly lower peak tyre grip)
  would make strategy-optimizer results closer to realistic full-race pace.

- **Monza's tuned aero doesn't reflect real relative downforce levels**
  (see "Cross-track calibration" above) — it's compensating for the
  track-map closure correction's effect on corner arc lengths, not modeling
  a real wing choice. Reworking `track_model.py`'s Monza corner lengths to
  be shorter/more realistic (while still closing the geometry loop) and
  re-tuning `ClA` down afterward would fix this properly.
- No weight transfer / suspension model (point-mass only)
- No wet-weather tyre compounds or track evolution
- No traffic / overtaking / safety car modeling in the strategy optimizer
- Pit stop loss is a fixed constant (`PIT_STOP_LOSS_S` in `race_sim.py`),
  not track-specific pit lane geometry
- Tyre degradation curves are illustrative, not fitted to real stint data yet
  (FastF1 gives you real lap times + tyre life per stint — a good next
  project is fitting `deg_rate_per_lap` per compound from real races)
- **2026 "clipping" not modeled**: real 2026 cars show the MGU-K battery
  depleting mid-straight, so top speed actually *drops* before the braking
  zone on long straights instead of monotonically rising. The current model
  only tapers override power by speed, not by cumulative energy deployed —
  adding a per-lap energy budget (deployed Joules vs available battery
  capacity) is the natural next step for 2026 accuracy
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
