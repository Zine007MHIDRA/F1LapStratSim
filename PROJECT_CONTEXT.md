# PROJECT_CONTEXT

Reference notes for anyone continuing this project. Concise + factual.

---

## 1. What this is

A physics-grade Formula 1 **lap-time and pit-strategy simulator** with a
cinematic Streamlit frontend.

- **Repo:** `github.com/Zine007MHIDRA/F1LapStratSim`, branch `main`.
- **Deployed:** `https://f1simulator.streamlit.app` (Streamlit Community Cloud).
  Auto-redeploys on every push to `main`. Main file: `app.py`, Python 3.12.
- **Latest commits:** `21101e3` (6-circuit FastF1 calibration), `3971176`
  (calibration tooling), `a349ea9` (dynamic circuit selection fix), `be85670`
  (cinematic redesign).

---

## 2. Architecture

Pure Python + Streamlit. No database, no external API at runtime, no
persistent state. The engine is a point-mass **quasi-static forward–backward
lap solver**.

**Data flow:** sidebar picks circuit + regulation era → `car_2025/2026(track)`
builds a `CarParams` (per-track aero preset + air density from `TRACK_ENV`) →
`simulate_lap()` / `simulate_race_strategy()` / `find_best_strategy()` →
`theme.py` components + Plotly render the result.

| File | Role | Key symbols |
|---|---|---|
| `app.py` | Streamlit UI. 6 nav views. **Presentation only.** | `VIEWS`, `_goto()`, `_sync_race_laps()`, `_circuit_profile()`, `_outline_figure()` |
| `theme.py` | Design system: tokens, CSS, HUD components, Plotly theme | `inject_css()`, `render_hero()`, `render_nav_brand()`, `render_circuit_hero()`, `render_timing_tower()`, `render_readout_row()`, `render_stint_timeline()`, `render_reg_comparison()`, `themed_layout_kwargs()`, `glow_scatter()`, `build_radar()`, `ASSETS`, `CIRCUIT_PHOTOS`, `_STATIC_CSS`, `_CINEMATIC_CSS` |
| `car_model.py` | Vehicle + powertrain physics | `CarParams`, `air_density()`, `powertrain_power_w()`, `max_traction_accel()`, `max_brake_decel()`, `max_corner_speed()`, `car_2025()`, `car_2026()` |
| `lap_sim.py` | The solver | `simulate_lap()`, `_integrate_ers()`, `_converge()`, `DRS_MIN_STRAIGHT_M` |
| `tyre_model.py` | Compound degradation | `COMPOUNDS` (soft/medium/hard/inter/wet), `grip_multiplier(compound, laps, thermal_load)` |
| `track_model.py` | 9 circuits + metadata | `TRACKS`, `Segment`, `_corner()/_straight()/_fit_length()`, `TRACK_ENV`, `TRACK_POLE_BENCHMARKS`, `TRACK_SECTORS`, `TRACK_TYRE_STRESS`, `TRACK_RACE_LAPS`, `race_laps()`, `tyre_stress()`, `drs_zone_count()`, `sector_fractions()` |
| `race_sim.py` | Lap-by-lap stint/race | `simulate_stint()`, `simulate_race_strategy()`, `pit_loss_for()` |
| `strategy_optimizer.py` | Brute-force strategy search | `find_best_strategy()`, `generate_1stop_plans()`, `generate_2stop_plans()` |
| `track_geometry.py` | 2D circuit reconstruction (turtle graphics) | `compute_track_xy()` |
| `map_viz.py` | Track-map Plotly figures | `build_lap_map_data()`, `build_static_map_figure()`, `build_animated_map_figure()` |
| `validation.py` | Numerical integrity checks | `validate_lap_result()`, `resolution_delta()` |
| `validate_fastf1.py` | Calibration harness: `dry_run()` (offline vs benchmarks), `fastf1_run()` (`--fastf1`, real telemetry), `optimize_track()` (`--optimize`, fits ClA/top_speed_kmh to real lap time) | `dry_run()`, `fastf1_run()`, `optimize_track()` |
| `validate_model.py` | Prints the full validation matrix | — |
| `calibrate_with_fastf1.py` | Older interactive single-track (Monza-only) telemetry overlay CLI, superseded by `validate_fastf1.py --optimize` | — |
| `main.py` | Legacy CLI menu, matplotlib. **Not the app.** | — |
| `tests/test_core.py` | 25 unittest regression tests | — |

`simulate_lap()` return dict keys: `s`, `v_profile`, `v_profile_free`,
`v_cap`, `lap_time`, `sector_times`, `sector_bounds_m`, `seg_idx`, `dt_arr`,
`ds_arr`, `g_lat`, `g_long`, `g_total`, `speed_trap_kmh`, `straight_speeds`,
`ers` (dict: `deployed_j`, `harvested_j`, `soc_trace`, `soc_start_j`,
`min_soc_j`, `clip_distance_m`, `ers_power_trace`, `energy_solved`),
`throttle_pct`, `brake_pct`, `accel_mps2`.

**App nav:** `st.radio(key="nav_bar")` (not `st.tabs`) with views
`OVERVIEW · SIMULATOR · CIRCUITS · REGULATIONS · STRATEGY · TRACK MAP`. Buttons
navigate by setting `st.session_state["_goto"]` then `st.rerun()`; the top of
`app.py` reconciles `_goto` into `nav_bar` before the radio is created.

---

## 3. Completed work (this project's history)

1. **UI pass 1** — pit-wall console theme (glassmorphic KPI cards, styled
   widgets, custom tables, Plotly `f1_pitwall` template).
2. **Physics upgrade** ("full solver rewrite"):
   - `air_density(track_temp, altitude)` (ISA barometric) → `CarParams.rho`;
     drag **and** downforce scale with it.
   - Powertrain split: `engine_power` → `ice_power_w` + `mguk_power_w`.
     `_integrate_ers()` walks the lap tracking battery SOC. **2025:** 4 MJ/lap
     MGU-K deployment cap, MGU-H keeps the store full. **2026:** no MGU-H, the
     store depletes → end-of-straight **clipping**. Energy pass runs for
     single-lap/telemetry runs, is **skipped** for race/optimizer runs
     (`compute_pedals=False`) for speed + because sustainable deployment makes
     "full budget every lap" the right race model.
   - `max_brake_decel` capped at `CarParams.max_decel_g` (5.5 g).
   - New solver outputs: sector splits, lat/long/total G, speed traps,
     `v_profile_free` (energy-unconstrained ghost), `ers` diagnostics.
   - `tyre_model`: cold warm-up phase + `thermal_load` argument (circuit
     energy load, from `TRACK_TYRE_STRESS`); inter/wet compounds added.
   - **Kept unchanged deliberately:** friction-ellipse exponent `p=1.6` and
     power-law load sensitivity `mu·(N/mg)^-0.05` (a circle/linear variant
     would have been a regression).
3. **Circuit expansion** — added Monaco, Suzuka, Bahrain, Red Bull Ring,
   Interlagos, COTA (9 total). Geometry from `(radius, turn-angle)` corners +
   `_fit_length()`. DRS zones via `Segment.drs` (all 9 tracks flag them).
4. **Strategy laps auto-sync** — `TRACK_RACE_LAPS` + `race_laps()` +
   `_sync_race_laps()`: the "Total Race Laps" input defaults to the circuit's
   real GP distance, re-syncs on track change, keeps manual ± within a track.
5. **Cinematic redesign** — see §4.
6. **Deploy config** — `DEPLOY.md`, `render.yaml`, `Procfile`, `runtime.txt`
   (python-3.12), `vercel.json` (redirect stub), slim `requirements.txt`
   (streamlit/plotly/numpy only), `requirements-dev.txt` (fastf1/matplotlib).
7. **KPI cards / nav-hero gap / per-circuit photography** — `.tele-card`
   restyled to sharp square-cornered engineering panels matching the timing
   tower; nav↔hero seam tightened; `CIRCUIT_PHOTOS` gives each of the 9
   circuits its own Unsplash photo instead of one shared hue-rotated image.
8. **Full FastF1 calibration** — `validate_fastf1.py --optimize` fits ClA +
   top_speed_kmh per track against real 2025 qualifying telemetry (CdA held
   at its hand-set value; see §5 for why). All 9 circuits now cite a real
   FastF1 lap in `TRACK_POLE_BENCHMARKS`.
9. Commit history was scrubbed of AI-tool attribution trailers and
   force-pushed (owner preference — no AI-assistant attribution in commits
   or code going forward either).

---

## 4. Cinematic redesign details

- `theme._CINEMATIC_CSS` is appended after `_STATIC_CSS`; its `:root` block
  overrides the console tokens to a **red-primary** palette (`--race-red
  #E10600`, deep-obsidian `#0B0B0D`/`#070707`, floodlight radial glows, SVG
  film grain).
- `theme.ASSETS` / `theme.CIRCUIT_PHOTOS` — openly-licensed Unsplash
  motorsport photography, served from
  `images.unsplash.com/photo-<id>?auto=format&fit=crop&w=<>&q=<>&fm=webp`.
  **Unsplash License** = free commercial use, no attribution required. Always
  rendered behind heavy dark gradient + vignette overlays; text never on a
  bright photo. Each of the 9 circuits has its own `CIRCUIT_PHOTOS` entry plus
  a light per-track saturation/contrast grade in `CIRCUIT_TINT`.
- Components: `render_hero()` (full-bleed, start-gantry light strip, live
  status pill, headline/tagline/stats), `render_nav_brand()`, broadcast nav
  strip (styled `st.radio`, red active underline, sticky),
  `render_circuit_hero()` + trait bars, `render_timing_tower()` (P1/P2/P3
  strategy leaderboard). Tactile dark-metal buttons with a red accent edge.
  Motion: `rise` / `pulse-dot`, guarded by `prefers-reduced-motion`.
  Responsive: every `st.columns` row stacks vertically below 1000px.
- `app.py` SIMULATOR view = 3-column pit-wall (run control / telemetry HUD /
  sector + ERS panels). CIRCUITS = experience page (hero, fact rail, trait
  ratings computed from the segment model, `_outline_figure()` track shape).
  STRATEGY = planner + optimiser `st.tabs`. `st.status()` loading sequences
  wrap the real solver calls.
- Streamlit toolbar / header chrome hidden via CSS.

**Important CSS quirk:** `inject_css()` emits the stylesheet as **three
separate minified `<style>` blocks** (`_prep_css()` strips comments +
whitespace). A single large multiline `<style>` string gets a middle chunk
silently dropped by Streamlit's Markdown parser. Keep it minified + split.

Widget-specific styling uses the `.st-key-<widget_key>` class that Streamlit
(≥1.39) puts on a keyed widget's container — e.g. `.st-key-nav_bar`,
`.st-key-cta_start`, `.st-key-single_lap_btn`.

---

## 5. Calibration status

`validate_fastf1.py` (dry-run, offline) vs `TRACK_POLE_BENCHMARKS` — **all 9
circuits now cite a real FastF1 lap**:

- **2025 lap-time MAE ≈ 0.34 s** (down from ≈1.0 s before the 6-track pass),
  RMSE ≈ 0.52 s, n=9.
- **2026 lap-time MAE ≈ 1.12 s**, n=3 — only Monza/Silverstone/Spa have a
  2026 benchmark; the other 6 circuits' `y2026` is still `None` (out of scope
  for the last pass, needs 2026 FastF1 data + a chosen benchmark source).
- Per-track 2025 deltas: Monza +0.38, Silverstone +0.61, Spa +0.92, Suzuka
  +0.01, Bahrain −0.12, Red Bull Ring +0.00, Interlagos +0.00, COTA −0.02,
  **Monaco +1.04 (known residual, see below)**.
- **How the fit works** (`validate_fastf1.py::optimize_track`): fits `ClA` +
  `top_speed_kmh` to match the real qualifying lap time; `CdA` is held at its
  hand-set value. Two things were found empirically and are documented in
  code comments where relevant:
  1. The **point-wise speed-trace MAE stays 50-70 km/h regardless of
     aero**, on every track — the schematic segment lists (turn radius/angle
     in a representative order) don't correspond corner-by-corner to
     FastF1's real distance axis, so trace-matching isn't a usable fitting
     signal here. It's reported as a diagnostic only.
  2. **CdA is barely identifiable from lap time alone** once `top_speed_kmh`
     pins the gearing cap — a free CdA+ClA search produced physically
     backwards results (Suzuka landing more drag than Monaco). Hence CdA
     stays at its hand-set value; only `ClA` is fit.
- **Monaco's ~1.0 s residual survives even at the top of the ClA search
  range** — likely a track-geometry (the schematic's corner radii/order) or
  `tyre_mu` gap rather than an aero one. Flagged in `car_model.py`'s Monaco
  preset comment and given a wider tolerance (1.3 s vs 0.3 s) in
  `tests/test_core.py::ExpandedCatalogueTests`.
- `car_2026` uses `battery_capacity_j = 5.4 MJ` (> the 4 MJ regulation store)
  as a tuning knob so the 2025→2026 delta lands at a realistic ~+1 s here
  rather than over-clipping. 2026-era aero presets for the 6 newer circuits
  are still un-calibrated (`# TODO` in `car_model.py`'s `car_2026()`).

---

## 6. Constraints

- **Vercel cannot host this app.** Streamlit is a stateful Tornado WebSocket
  server; Vercel is stateless serverless with a 10–60 s function cap (the
  optimizer alone takes 70 s+). Real hosts: Streamlit Cloud (current), Render
  (`render.yaml` ready), Hugging Face Spaces. Vercel is only usable as a
  redirect front-door — `vercel.json` has a placeholder-URL stub for that.
- **FastF1 calibration needs live internet** to the F1 timing servers.
  `validate_fastf1.py` without `--fastf1`/`--optimize` runs the dry-run
  comparison offline; with them, results are cached under `./f1_cache`
  (gitignored) after the first run.
- Local env: Streamlit **1.62**, Python **3.14**. Deploy pinned to Python
  **3.12** (`runtime.txt`, devcontainer). `requirements.txt` app-only;
  `.streamlit/config.toml` has default `fileWatcherType` (hot-reload on).
- **No driver / team / results data exists** — the app simulates **one car**.
  Do **not** fabricate a driver roster. The "timing tower" is the strategy
  leaderboard, and "REGULATIONS" (2025 vs 2026) fills the nav slot a
  "DRIVERS" page would take.
- **No AI-tool attribution** in commits or code (owner preference). Omit any
  AI co-author trailer on future commits.
- Physics is point-mass (no weight transfer, no suspension, no elevation
  slope force — elevation only feeds air density). Track maps are schematic
  (turtle-graphics with a loop-closure correction), not survey-accurate —
  this is also why full speed-trace fidelity against FastF1 telemetry is
  currently limited (see §5).

---

## 7. Known rough edges

- Optimizer is brute force — ~70 s for a 53-lap "Balanced" search; can look
  hung on a free-tier CPU. UI copy recommends the "Fast" resolution.
- 6 of 9 circuits' 2026-era aero presets are still un-calibrated (`# TODO` in
  `car_2026()`), and those 6 have no 2026 pole benchmark at all yet.
- Monaco's 2025 lap-time fit has a ~1.0 s residual that aero calibration
  alone can't close (see §5) — needs a track-geometry or `tyre_mu` look.
- Full speed-trace fidelity vs real telemetry is ~50-70 km/h MAE for the 6
  newer circuits (vs ~5-10 km/h for the corner-matched Monza/Silverstone/Spa)
  because the schematic segment order doesn't correspond point-for-point to
  FastF1's real distance axis. Lap-time and top-speed fidelity are unaffected
  by this — only a full speed-trace overlay would look off.

---

## 8. Current state & next steps

**State:** all of the above committed and pushed to `main`; auto-deploying to
`f1simulator.streamlit.app`. Working tree clean. All 25 tests pass.

**Candidate next steps:**
1. 2026-era calibration for the 6 newer circuits, once a 2026 FastF1 season
   and a chosen benchmark source exist — same `validate_fastf1.py --optimize`
   flow with `--era 2026`.
2. Investigate Monaco's residual lap-time gap — likely means revisiting the
   schematic corner radii (the 9 m hairpin, 13 m La Rascasse, etc.) or
   `tyre_mu`, not aero.
3. Corner-by-corner track-geometry calibration against FastF1 position data,
   if full speed-trace fidelity (not just lap time) becomes a priority.
4. Make the optimizer feel responsive on the hosted demo (lower default
   resolution/lap count, or move to a background job).
5. Optionally wire the `vercel.json` redirect once a stable public URL is
   chosen.

**Workflow:** run locally with `streamlit run app.py`. Test with
`python -m unittest discover -s tests`. Validate physics with
`python validate_model.py`, `python validate_fastf1.py` (offline), or
`python validate_fastf1.py --optimize` (real telemetry, needs internet).
Push to `main` to deploy.
