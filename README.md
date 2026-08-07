# F1 Lap Time + Strategy Simulator

A point-mass vehicle dynamics simulator for F1 lap times, tyre degradation,
and pit strategy optimization — built for Monza, structured so any track
can be added.

## What's in here

| File | What it does |
|---|---|
| `track_model.py` | Defines the track as a sequence of straights/corners (Monza built in) |
| `car_model.py` | Point-mass car physics: engine, drag, downforce, tyre grip |
| `lap_sim.py` | Forward-backward solver — turns track+car into a speed trace and lap time |
| `tyre_model.py` | Grip degradation curves per compound (soft/medium/hard) |
| `race_sim.py` | Runs a full stint/race lap-by-lap with degrading tyres |
| `strategy_optimizer.py` | Brute-force search over pit strategies to find the fastest |
| `main.py` | **Interactive menu — run this** |
| `calibrate_with_fastf1.py` | Compares the sim against real F1 telemetry (run locally, needs internet) |

## Car generations supported

The simulator supports two car "eras", both for Monza:

- **`car_2025()`** — fixed-wing car (pre-2026 regs). Calibrated against real
  2023 Monza qualifying telemetry — lap time lands within ~5s of real pole pace.
- **`car_2026()`** — current active-aero regs. Models Z-mode (high downforce,
  used in corners) and X-mode (low drag, used on straights) as genuinely
  different aero states, plus the Manual Override MGU-K boost. Tuned to match
  *reported real-world deltas* from the first 2026 races (Melbourne, Shanghai,
  Bahrain testing): cars running ~2-3s slower than 2025 overall despite higher
  top speeds, because the ~30% downforce cut hurts fast corners more than
  active aero's straight-line gains make up for. This is NOT yet fitted to raw
  2026 telemetry — see the calibration section below.

`main.py` asks which car generation to use at startup.

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

## Known simplifications (roadmap for improvement)

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
