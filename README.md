# F1 Lap Time + Strategy Simulator

A point-mass vehicle dynamics simulator for F1 lap times, tyre degradation,
and pit strategy optimization — built for Monza, structured so any track
can be added.
## Link
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
| Monza | 78.72s | 78.79s (Verstappen) | 82.35s | *not yet raced* (~82.3s est.) |
| Silverstone | 84.97s | 84.89s (Verstappen) | 88.06s | 88.11s (Antonelli) |
| Spa-Francorchamps | 100.53s | 100.56s (Antonelli) | 104.46s | 104.36s (Antonelli) |

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
