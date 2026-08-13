"""
app.py — Streamlit web front-end for the F1 lap/strategy simulator.

Run locally:
    streamlit run app.py

Deploy for free:
    Push this repo to GitHub, then deploy at https://share.streamlit.io
    (Streamlit Community Cloud) — point it at app.py. Free, public, no
    credit card. See README.md for the full walkthrough.
"""

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import time

from car_model import car_2025, car_2026
from track_model import TRACKS, total_length
from lap_sim import simulate_lap
from tyre_model import COMPOUNDS
from race_sim import simulate_race_strategy, pit_loss_for
from strategy_optimizer import find_best_strategy, format_plan, format_time, \
    generate_1stop_plans, generate_2stop_plans
from map_viz import build_lap_map_data, build_static_map_figure, build_animated_map_figure
import theme

st.set_page_config(page_title="F1 Lap + Strategy Simulator", layout="wide")
theme.inject_css()


# ---------- Sidebar: track + car generation ----------
st.sidebar.title("F1 Simulator")

track_name = st.sidebar.selectbox("Track", list(TRACKS.keys()))
TRACK = TRACKS[track_name]
LAP_LENGTH = total_length(TRACK)
st.sidebar.caption(f"{LAP_LENGTH:.0f} m, pit loss ≈ {pit_loss_for(track_name):.0f}s")

car_choice = st.sidebar.radio(
    "Car generation",
    ["2026 (active aero, current regs)", "2025 (fixed wing)"],
)
car = car_2026(track_name) if car_choice.startswith("2026") else car_2025(track_name)
car_label = "2026 ACTIVE AERO" if car_choice.startswith("2026") else "2025 FIXED WING"
# Separate race-trim car (full fuel, race-mode tyres/engine) for the race
# strategy tabs -- the sidebar selection above is qualifying-trim (tuned to
# real pole times), which is unrealistically light/fast to reuse across an
# entire race distance. See car_model.py's car_2025()/car_2026() docstrings.
race_car = car_2026(track_name, trim="race") if car_choice.startswith("2026") else car_2025(track_name, trim="race")

with st.sidebar.expander("About this model"):
    st.markdown(
        "Point-mass vehicle dynamics simulator: engine power, aero drag/"
        "downforce, and tyre grip combine to produce a physically consistent "
        "speed trace via a forward-backward solver. Constants are tuned to "
        "match reported real-world lap time deltas, not fitted to raw "
        "telemetry yet.\n\n"
        "**Track maps are schematic**, not survey-accurate: corner "
        "tightness/direction is built from public reference info, adjusted "
        "so the shape forms a clean closed loop. The drawn line is the "
        "single path implied by each corner's assumed radius, not a true "
        "track-width-aware racing-line optimization — see the README."
    )

theme.render_header(track_name, LAP_LENGTH, car_label)

tab1, tab2, tab3, tab4 = st.tabs([
    "🏁 Single Lap", "🛞 Custom Strategy", "🔍 Strategy Optimizer", "🗺️ Track Map"
])


# ---------- Tab 1: Single lap ----------
with tab1:
    st.subheader("Fastest lap simulation")
    if st.button("Simulate lap", key="single_lap_btn"):
        with st.spinner("Solving forward-backward speed profile..."):
            result = simulate_lap(TRACK, car, step=2.0)

        t = result["lap_time"]
        theme.render_readout_row([
            ("Lap Time", format_time(t), None, theme.COLORS["amber"]),
            ("Top Speed", f"{result['v_profile'].max()*3.6:.1f}", "km/h", theme.COLORS["cyan"]),
            ("Avg Speed", f"{(LAP_LENGTH/t)*3.6:.1f}", "km/h", theme.COLORS["purple"]),
        ])

        fig = make_subplots(
            rows=3, cols=1, shared_xaxes=True,
            row_heights=[0.5, 0.25, 0.25], vertical_spacing=0.04,
            subplot_titles=("SPEED (KM/H)", "THROTTLE (%)", "BRAKE (%)"),
        )
        fig.add_trace(go.Scatter(
            x=result["s"], y=result["v_profile"] * 3.6,
            mode="lines", name="Speed", line=dict(width=2.5, color=theme.COLORS["cyan"]),
        ), row=1, col=1)
        fig.add_trace(go.Scatter(
            x=result["s"], y=result["throttle_pct"],
            mode="lines", name="Throttle", line=dict(width=0),
            fill="tozeroy", fillcolor="rgba(0,230,118,0.5)",
        ), row=2, col=1)
        fig.add_trace(go.Scatter(
            x=result["s"], y=result["brake_pct"],
            mode="lines", name="Brake", line=dict(width=0),
            fill="tozeroy", fillcolor="rgba(255,59,59,0.5)",
        ), row=3, col=1)
        fig.update_yaxes(range=[0, 105], row=2, col=1)
        fig.update_yaxes(range=[0, 105], row=3, col=1)
        fig.update_xaxes(title_text="DISTANCE AROUND LAP (M)", row=3, col=1)
        fig.update_layout(**theme.themed_layout_kwargs(height=700))
        fig.update_layout(title=f"{track_name} — {format_time(t)}", showlegend=False)
        for ann in fig.layout.annotations:
            ann.font = dict(family=theme.FONT_MONO, color=theme.COLORS["text_dim"], size=11)
        st.plotly_chart(fig, use_container_width=True)
        st.caption(
            "Throttle/brake are derived from the simulated speed profile "
            "(actual acceleration vs. the theoretical max at that point), "
            "not independent driver inputs — so they're internally "
            "consistent with the speed trace by construction, not an "
            "independent model of driver behavior."
        )
    else:
        st.info("Click **Simulate lap** to run the physics engine.")


# ---------- Tab 2: Custom strategy ----------
with tab2:
    st.subheader("Test a specific pit strategy")
    st.caption(
        "Uses race-trim car (full-fuel start, race-mode tyres/engine) — "
        "slower than the Single Lap tab's qualifying pace by design, since "
        "no real car sustains qualifying trim for a whole race distance."
    )

    total_laps = st.number_input("Total race laps", min_value=10, max_value=80, value=53)
    n_stints = st.selectbox("Number of stints", [1, 2, 3], index=1)

    compound_names = list(COMPOUNDS.keys())
    stint_inputs = []
    cols = st.columns(n_stints)
    remaining = total_laps
    for i in range(n_stints):
        with cols[i]:
            st.markdown(f"**Stint {i+1}**")
            compound = st.selectbox(f"Compound {i+1}", compound_names,
                                     index=min(i, len(compound_names)-1), key=f"comp_{i}")
            if i == n_stints - 1:
                laps = remaining
                st.write(f"Laps: {laps} (auto-filled)")
            else:
                default_laps = max(8, total_laps // n_stints)
                laps = st.number_input(f"Laps on stint {i+1}", min_value=1,
                                        max_value=total_laps, value=default_laps, key=f"laps_{i}")
                remaining -= laps
            stint_inputs.append((compound, laps))

    if st.button("Simulate strategy", key="custom_strategy_btn"):
        if stint_inputs[-1][1] < 0:
            st.error("Stint lengths add up to more than the total race laps — reduce an earlier stint.")
        else:
            with st.spinner(f"Simulating {total_laps} laps..."):
                res = simulate_race_strategy(TRACK, race_car, stint_inputs, total_laps, step=8.0,
                                              track_name=track_name)

            t = res["total_time"]
            theme.render_readout_row([
                ("Total Race Time", format_time(t), None, theme.COLORS["amber"]),
                ("Avg Lap", f"{t/total_laps:.3f}", "sec", theme.COLORS["cyan"]),
                ("Fastest Lap", f"{min(res['lap_times']):.2f}", "sec", theme.COLORS["positive"]),
                ("Slowest Lap", f"{max(res['lap_times']):.2f}", "sec", theme.COLORS["negative"]),
            ])

            fig = go.Figure()
            fig.add_trace(go.Scatter(
                y=res["lap_times"], mode="lines+markers", name="Lap time",
                line=dict(color=theme.COLORS["cyan"], width=2),
                marker=dict(size=5, color=theme.COLORS["amber"]),
            ))
            fig.update_layout(**theme.themed_layout_kwargs(height=400))
            fig.update_layout(
                xaxis_title="LAP NUMBER", yaxis_title="LAP TIME (S)",
                title=f"Lap times — {format_plan(stint_inputs)}",
            )
            st.plotly_chart(fig, use_container_width=True)


# ---------- Tab 3: Strategy optimizer ----------
with tab3:
    st.subheader("Search for the fastest strategy")
    st.caption("Brute-force search over 1-stop and (optionally) 2-stop combinations.")
    st.caption("Uses race-trim car (full-fuel start) — same reasoning as the Custom Strategy tab.")

    opt_laps = st.number_input("Total race laps", min_value=10, max_value=80, value=53, key="opt_laps")
    include_2stop = st.checkbox("Include 2-stop strategies (slower search)", value=False)
    step = st.slider("Simulation resolution (m) — higher = faster, less precise",
                      min_value=10, max_value=40, value=25, step=5)

    n_plans = len(generate_1stop_plans(opt_laps))
    if include_2stop:
        n_plans += len(generate_2stop_plans(opt_laps))
    st.caption(f"Will evaluate ~{n_plans} candidate strategies at step={step}m.")

    if st.button("Run optimizer", key="optimizer_btn"):
        with st.spinner(f"Evaluating ~{n_plans} strategies — this can take a while..."):
            t0 = time.time()
            results = find_best_strategy(TRACK, race_car, opt_laps, include_2stop=include_2stop,
                                          step=float(step), verbose=False, track_name=track_name)
            elapsed = time.time() - t0

        st.success(f"Done in {elapsed:.1f}s")
        best_time = results[0][0]
        theme.render_strategy_table(results, best_time)


# ---------- Tab 4: Track map ----------
with tab4:
    st.subheader(f"{track_name} — top-down speed map")
    st.caption(
        "Colored by simulated speed, with arrows showing the direction of "
        "travel. The line shown is the model's implied racing line (one "
        "path per corner radius assumption), not a true track-width "
        "optimization — see 'About this model' in the sidebar."
    )

    view_mode = st.radio("View", ["Static speed map", "Animated lap replay"], horizontal=True)

    if st.button("Generate map", key="map_btn"):
        with st.spinner("Simulating lap + building track geometry..."):
            map_data = build_lap_map_data(TRACK, car, step=5.0)

        st.caption(f"Lap time: {format_time(map_data['lap_time'])}  |  "
                   f"geometry closure correction: {map_data['correction_factor']:.2f}x")

        if view_mode == "Static speed map":
            fig = build_static_map_figure(map_data, title=f"{track_name} speed map")
        else:
            fig = build_animated_map_figure(map_data, title=f"{track_name} lap replay")

        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Click **Generate map** to build the track visualization.")
