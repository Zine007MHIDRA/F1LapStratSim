"""
app.py — F1 Pit-Wall Race Control & Telemetry Simulation Console.

Run locally:
    streamlit run app.py
"""

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
import time

from car_model import car_2025, car_2026
from track_model import TRACKS, total_length
from lap_sim import simulate_lap
from tyre_model import COMPOUNDS
from race_sim import simulate_race_strategy, pit_loss_for
from strategy_optimizer import find_best_strategy, format_plan, format_time, \
    generate_1stop_plans, generate_2stop_plans
from map_viz import build_lap_map_data, build_static_map_figure, build_animated_map_figure
from validation import validate_lap_result
import theme

st.set_page_config(
    page_title="F1 Race Control Telemetry",
    page_icon="🏎️",
    layout="wide",
    initial_sidebar_state="expanded"
)
theme.inject_css()


# ========================================================
# SIDEBAR: RACE CONTROL CONTROLS & CIRCUIT TELEMETRY
# ========================================================

with st.sidebar:
    st.markdown("""
    <div class="sidebar-header-box">
        <div class="sidebar-title">
            <span>PIT-WALL</span>
            <span class="sidebar-title-badge">PRO v2.0</span>
        </div>
        <div class="sidebar-subtitle">F1 TELEMETRY &amp; DYNAMICS ENGINE</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("### 🏁 Circuit Selection")
    track_name = st.selectbox("Select Grand Prix Track", list(TRACKS.keys()), index=0)
    TRACK = TRACKS[track_name]
    LAP_LENGTH = total_length(TRACK)
    pit_loss = pit_loss_for(track_name)

    # Circuit Quick Fact Card
    theme.render_track_card(track_name, LAP_LENGTH, pit_loss, TRACK)

    st.markdown("### 🏎️ Vehicle Regulations")
    car_choice = st.radio(
        "Aero & Powertrain Specs",
        ["2026 Active Aero (Next-Gen)", "2025 Fixed Wing (Current)"],
        index=0,
    )
    is_2026 = car_choice.startswith("2026")
    car = car_2026(track_name) if is_2026 else car_2025(track_name)
    car_label = "2026 ACTIVE AERO" if is_2026 else "2025 FIXED AERO"
    race_car = car_2026(track_name, trim="race") if is_2026 else car_2025(track_name, trim="race")

    # Vehicle Technical Specs Card
    st.markdown(f"""
    <div style="background:{theme.COLORS['bg_card']};border:1px solid {theme.COLORS['border']};border-radius:8px;padding:0.75rem 0.9rem;margin-bottom:0.8rem;">
        <div style="font-family:{theme.FONT_TECH};font-weight:700;font-size:0.85rem;color:{theme.COLORS['cyan']};text-transform:uppercase;margin-bottom:4px;">
            ⚙️ Specs: {car_label}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:2px 0;">
            <span style="color:{theme.COLORS['text_muted']};">Min Mass</span>
            <span style="font-family:{theme.FONT_MONO};color:#FFF;">{car.mass_empty:.0f} kg</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:2px 0;">
            <span style="color:{theme.COLORS['text_muted']};">Total Power</span>
            <span style="font-family:{theme.FONT_MONO};color:#FFF;">{car.engine_power/1000:.0f} kW (~{car.engine_power/735.5:.0f} hp)</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:2px 0;">
            <span style="color:{theme.COLORS['text_muted']};">Aero Trim</span>
            <span style="font-family:{theme.FONT_MONO};color:{theme.COLORS['amber']};">{'Dual-Mode Z/X' if is_2026 else 'DRS Only'}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    with st.expander("ℹ️ Physics Model Engine"):
        st.markdown(
            "Point-mass forward-backward solver taking into account aerodynamic downforce, "
            "parasitic drag, longitudinal tyre friction circle limits, and fuel-burn load sensitivity.\n\n"
            "• **2026 Specs**: 768 kg, 355 kW ICE + 350 kW MGU-K electric boost, switchable Z-mode (high downforce corners) & X-mode (low drag straights).\n\n"
            "• **2025 Specs**: 798 kg, 585 kW ICE + 120 kW MGU-K, standard DRS flap actuation."
        )


# ========================================================
# MAIN SCREEN: F1 PIT-WALL HEADER & TABS
# ========================================================

theme.render_f1_header(track_name, LAP_LENGTH, car_label)

tab_single, tab_compare, tab_custom, tab_opt, tab_map = st.tabs([
    "🏁 Telemetry HUD",
    "⚡ 2025 vs 2026 Delta",
    "🛞 Strategy Planner",
    "🔍 Strategy Optimizer",
    "🗺️ Track Map & GPS"
])


# ========================================================
# TAB 1: SINGLE LAP TELEMETRY HUD
# ========================================================
with tab_single:
    st.markdown('<div class="section-title">Qualifying Single Lap Telemetry</div>', unsafe_allow_html=True)
    st.caption("Simulate dynamic point-mass performance through all track segments with full throttle, braking, and lateral grip limits.")

    col_btn, col_res, _ = st.columns([1.5, 2, 4])
    with col_btn:
        run_lap = st.button("🚀 SIMULATE QUALIFYING LAP", key="single_lap_btn")
    with col_res:
        step_res = st.select_slider("Simulation Resolution", options=[1.0, 2.0, 5.0], value=2.0, format_func=lambda x: f"{x:.0f}m ({'High' if x<=1.0 else ('Standard' if x==2.0 else 'Fast')})")

    track_or_car_changed = (
        st.session_state.get("last_lap_track") != track_name
        or st.session_state.get("last_lap_car") != car_label
    )

    if run_lap or "last_lap_result" not in st.session_state or track_or_car_changed:
        with st.spinner(f"Computing forward-backward solver for {track_name} ({car_label})..."):
            result = simulate_lap(TRACK, car, step=step_res)
            st.session_state["last_lap_result"] = result
            st.session_state["last_lap_track"] = track_name
            st.session_state["last_lap_car"] = car_label
    else:
        result = st.session_state.get("last_lap_result")

    if result:
        t = result["lap_time"]
        validation_report = validate_lap_result(result, car, LAP_LENGTH)
        v_max = result['v_profile'].max() * 3.6
        v_avg = (LAP_LENGTH / t) * 3.6
        v_min_corner = result['v_profile'].min() * 3.6
        if result.get('throttle_pct') is not None:
            full_throttle_pct = np.average(
                result['throttle_pct'] >= 98.0,
                weights=result['ds_arr'],
            ) * 100.0
        else:
            full_throttle_pct = 0.0

        # Multi-Channel KPI Grid
        theme.render_readout_row([
            ("Lap Time", format_time(t), "POLE POSITION PACE", theme.COLORS["purple"]),
            ("Top Speed", f"{v_max:.1f}", "KM/H &bull; END OF STRAIGHT", theme.COLORS["cyan"]),
            ("Average Speed", f"{v_avg:.1f}", "KM/H &bull; CIRCUIT AVERAGE", theme.COLORS["amber"]),
            ("Min Corner Speed", f"{v_min_corner:.1f}", "KM/H &bull; TIGHTEST APEX", theme.COLORS["soft"]),
            ("Full Throttle %", f"{full_throttle_pct:.0f}%", "OF LAP DISTANCE", theme.COLORS["positive"]),
        ])
        if validation_report.warnings:
            st.warning(" ".join(validation_report.warnings), icon="⚠️")

        # Synchronized Multi-Channel Telemetry Chart
        # Calculate approximate longitudinal acceleration (G-Force)
        dt = np.diff(result["s"]) / np.maximum(result["v_profile"][:-1], 1.0)
        dv = np.diff(result["v_profile"])
        accel_g = np.zeros_like(result["s"])
        accel_g[:-1] = (dv / np.maximum(dt, 1e-4)) / 9.81

        fig = make_subplots(
            rows=3, cols=1, shared_xaxes=True,
            row_heights=[0.50, 0.25, 0.25], vertical_spacing=0.035,
            subplot_titles=("SPEED PROFILE (KM/H)", "PEDAL TELEMETRY: THROTTLE & BRAKE (%)", "LONGITUDINAL ACCELERATION (G)"),
        )
        
        # Speed Trace
        fig.add_trace(go.Scatter(
            x=result["s"], y=result["v_profile"] * 3.6,
            mode="lines", name="Speed (km/h)",
            line=dict(width=2.5, color=theme.COLORS["cyan"]),
            hovertemplate="<b>Dist: %{x:.0f}m</b><br>Speed: %{y:.1f} km/h<extra></extra>",
        ), row=1, col=1)

        # Throttle Trace
        fig.add_trace(go.Scatter(
            x=result["s"], y=result["throttle_pct"],
            mode="lines", name="Throttle %",
            line=dict(width=1.5, color=theme.COLORS["positive"]),
            fill="tozeroy", fillcolor="rgba(0, 230, 118, 0.25)",
            hovertemplate="Throttle: %{y:.0f}%<extra></extra>",
        ), row=2, col=1)

        # Brake Trace
        fig.add_trace(go.Scatter(
            x=result["s"], y=result["brake_pct"],
            mode="lines", name="Brake %",
            line=dict(width=1.5, color=theme.COLORS["f1_red"]),
            fill="tozeroy", fillcolor="rgba(225, 6, 0, 0.35)",
            hovertemplate="Brake: %{y:.0f}%<extra></extra>",
        ), row=2, col=1)

        # Longitudinal G-Force
        fig.add_trace(go.Scatter(
            x=result["s"], y=accel_g,
            mode="lines", name="Longitudinal G",
            line=dict(width=1.5, color=theme.COLORS["amber"]),
            fill="tozeroy", fillcolor="rgba(255, 140, 0, 0.15)",
            hovertemplate="Accel: %{y:.2f} G<extra></extra>",
        ), row=3, col=1)

        fig.update_yaxes(title_text="KM/H", row=1, col=1)
        fig.update_yaxes(title_text="%", range=[0, 105], row=2, col=1)
        fig.update_yaxes(title_text="G", row=3, col=1)
        fig.update_xaxes(title_text="TRACK DISTANCE AROUND LAP (METERS)", row=3, col=1)

        layout_args = theme.themed_layout_kwargs(height=720)
        fig.update_layout(**layout_args)
        fig.update_layout(
            title=f"TELEMETRY LOG &bull; {track_name.upper()} &bull; {format_time(t)}",
            showlegend=True,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        for ann in fig.layout.annotations:
            ann.font = dict(family=theme.FONT_TECH, color=theme.COLORS["text_muted"], size=12, weight=700)
            
        st.plotly_chart(fig, width="stretch")

        # Corner Apex Speeds Breakdown Table
        st.markdown('<div class="section-title">Apex & Corner Telemetry Breakdown</div>', unsafe_allow_html=True)
        theme.render_corner_table(TRACK, result)


# ========================================================
# TAB 2: 2025 VS 2026 HEAD-TO-HEAD COMPARISON
# ========================================================
with tab_compare:
    st.markdown('<div class="section-title">Head-to-Head: 2025 Fixed Aero vs 2026 Active Aero</div>', unsafe_allow_html=True)
    st.caption("Compare how the 2026 dual-state active aerodynamics (low-drag X-mode on straights and high-downforce Z-mode in corners) stacked up against the 2025 regulations on this circuit.")

    if st.button("⚡ RUN COMPARISON ANALYSIS", key="compare_btn"):
        with st.spinner(f"Simulating dual car models for {track_name}..."):
            res_2025 = simulate_lap(TRACK, car_2025(track_name), step=2.0)
            res_2026 = simulate_lap(TRACK, car_2026(track_name), step=2.0)

        t_25 = res_2025["lap_time"]
        t_26 = res_2026["lap_time"]
        delta_t = t_26 - t_25
        delta_str = f"{delta_t:+.2f}s"
        delta_color = theme.COLORS["positive"] if delta_t < 0 else theme.COLORS["negative"]

        top_25 = res_2025['v_profile'].max() * 3.6
        top_26 = res_2026['v_profile'].max() * 3.6

        theme.render_readout_row([
            ("2026 Lap Time", format_time(t_26), "ACTIVE AERO", theme.COLORS["purple"]),
            ("2025 Lap Time", format_time(t_25), "FIXED WING", theme.COLORS["cyan"]),
            ("Lap Delta (26 vs 25)", delta_str, "FASTER (2026)" if delta_t < 0 else "FASTER (2025)", delta_color),
            ("2026 Top Speed", f"{top_26:.1f}", "KM/H (X-MODE)", theme.COLORS["amber"]),
            ("2025 Top Speed", f"{top_25:.1f}", "KM/H (DRS)", theme.COLORS["text_muted"]),
        ])

        # Dual Telemetry Overlay & Delta Speed Chart
        fig_cmp = make_subplots(
            rows=2, cols=1, shared_xaxes=True,
            row_heights=[0.65, 0.35], vertical_spacing=0.04,
            subplot_titles=("SPEED COMPARISON (KM/H)", "SPEED DELTA: 2026 vs 2025 (KM/H)"),
        )

        fig_cmp.add_trace(go.Scatter(
            x=res_2026["s"], y=res_2026["v_profile"] * 3.6,
            mode="lines", name="2026 Active Aero",
            line=dict(color=theme.COLORS["purple"], width=2.5),
        ), row=1, col=1)

        fig_cmp.add_trace(go.Scatter(
            x=res_2025["s"], y=res_2025["v_profile"] * 3.6,
            mode="lines", name="2025 Fixed Aero",
            line=dict(color=theme.COLORS["cyan"], width=2.0, dash="dot"),
        ), row=1, col=1)

        # Delta Speed
        n_min = min(len(res_2025["v_profile"]), len(res_2026["v_profile"]))
        v_delta = (res_2026["v_profile"][:n_min] - res_2025["v_profile"][:n_min]) * 3.6
        s_axis = res_2026["s"][:n_min]

        fig_cmp.add_trace(go.Scatter(
            x=s_axis, y=v_delta,
            mode="lines", name="Δ Speed (2026 - 2025)",
            line=dict(color=theme.COLORS["amber"], width=1.8),
            fill="tozeroy", fillcolor="rgba(255, 140, 0, 0.2)",
        ), row=2, col=1)

        fig_cmp.update_yaxes(title_text="KM/H", row=1, col=1)
        fig_cmp.update_yaxes(title_text="Δ KM/H", row=2, col=1)
        fig_cmp.update_xaxes(title_text="TRACK DISTANCE (METERS)", row=2, col=1)

        fig_cmp.update_layout(**theme.themed_layout_kwargs(height=650))
        fig_cmp.update_layout(
            title=f"COMPARATIVE SPEED TRACE &bull; {track_name.upper()}",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        for ann in fig_cmp.layout.annotations:
            ann.font = dict(family=theme.FONT_TECH, color=theme.COLORS["text_muted"], size=12, weight=700)

        st.plotly_chart(fig_cmp, width="stretch")
    else:
        st.info("Click **⚡ Run Comparison Analysis** to evaluate both regulations side-by-side.")


# ========================================================
# TAB 3: CUSTOM RACE STRATEGY PLANNER
# ========================================================
with tab_custom:
    st.markdown('<div class="section-title">Custom Pit Strategy & Stint Planner</div>', unsafe_allow_html=True)
    st.caption("Models dynamic tyre grip decay, non-linear thermal degradation cliffs, and full-to-empty fuel load burn-off.")

    c_laps, c_stints = st.columns([1, 1])
    with c_laps:
        total_laps = st.number_input("Total Race Laps", min_value=10, max_value=80, value=53, step=1)
    with c_stints:
        n_stints = st.selectbox("Number of Stints", [1, 2, 3], index=1, format_func=lambda x: f"{x} Stint{'s' if x>1 else ''} ({x-1} Pit Stop{'s' if x>1 else ''})")

    compound_names = list(COMPOUNDS.keys())
    stint_inputs = []
    cols = st.columns(n_stints)
    remaining = total_laps
    
    for i in range(n_stints):
        with cols[i]:
            st.markdown(f"**Stint #{i+1}**")
            compound = st.selectbox(f"Compound", compound_names,
                                     index=min(i, len(compound_names)-1), key=f"cust_comp_{i}")
            if i == n_stints - 1:
                laps = remaining
                st.info(f"Laps: **{laps}** (Remainder)")
            else:
                default_laps = max(5, total_laps // n_stints)
                laps = st.number_input(f"Stint Length (Laps)", min_value=1,
                                        max_value=total_laps, value=default_laps, key=f"cust_laps_{i}")
                remaining -= laps
            stint_inputs.append((compound, laps))

    # Live Stint Timeline Visualization
    if sum(l for _, l in stint_inputs) == total_laps and all(l > 0 for _, l in stint_inputs):
        theme.render_stint_timeline(stint_inputs, total_laps)

    if st.button("📊 SIMULATE RACE STRATEGY", key="custom_strat_btn"):
        if stint_inputs[-1][1] <= 0:
            st.error("Stint lengths exceed total race distance. Adjust prior stint lengths.")
        else:
            with st.spinner(f"Simulating {total_laps} race laps with pit stops..."):
                res = simulate_race_strategy(TRACK, race_car, stint_inputs, total_laps,
                                              step=8.0, track_name=track_name)

            t_race = res["total_time"]
            avg_lap = t_race / total_laps
            fastest_lap = min(res["lap_times"])
            slowest_lap = max(res["lap_times"])
            deg_delta = slowest_lap - fastest_lap

            theme.render_readout_row([
                ("Total Race Time", format_time(t_race), f"{n_stints-1} PIT STOPS", theme.COLORS["purple"]),
                ("Average Lap Pace", f"{avg_lap:.3f}", "SECONDS / LAP", theme.COLORS["cyan"]),
                ("Fastest Lap", f"{fastest_lap:.2f}", "S &bull; BEST STINT PACE", theme.COLORS["positive"]),
                ("Pace Degradation", f"+{deg_delta:.2f}s", "WORST VS BEST LAP", theme.COLORS["amber"]),
            ])

            # Lap-by-Lap Pace Progression Chart
            lap_numbers = list(range(1, total_laps + 1))
            fig_stint = go.Figure()

            # Identify stint boundaries
            stint_splits = []
            cum_laps = 0
            for comp, n_l in stint_inputs[:-1]:
                cum_laps += n_l
                stint_splits.append(cum_laps)

            fig_stint.add_trace(go.Scatter(
                x=lap_numbers, y=res["lap_times"],
                mode="lines+markers",
                name="Lap Time",
                line=dict(color=theme.COLORS["cyan"], width=2.5),
                marker=dict(size=6, color=theme.COLORS["amber"], line=dict(width=1, color="#FFF")),
                hovertemplate="<b>Lap %{x}</b><br>Time: %{y:.2f}s<extra></extra>",
            ))

            # Add pit stop indicators
            for split_lap in stint_splits:
                fig_stint.add_vline(
                    x=split_lap + 0.5, line_width=2, line_dash="dash", line_color=theme.COLORS["f1_red"],
                    annotation_text="BOX BOX (PIT)", annotation_position="top left",
                    annotation_font=dict(family=theme.FONT_TECH, color=theme.COLORS["f1_red"], size=11, weight=700)
                )

            fig_stint.update_layout(**theme.themed_layout_kwargs(height=450))
            fig_stint.update_layout(
                title=f"RACE PACE DEGRADATION PROFILE &bull; {format_plan(stint_inputs)}",
                xaxis_title="RACE LAP NUMBER",
                yaxis_title="LAP TIME (SECONDS)",
            )
            st.plotly_chart(fig_stint, width="stretch")


# ========================================================
# TAB 4: STRATEGY OPTIMIZER
# ========================================================
with tab_opt:
    st.markdown('<div class="section-title">Pit-Wall Strategy Optimizer</div>', unsafe_allow_html=True)
    st.caption("Brute-force algorithmic search over all 1-stop and 2-stop tyre compound permutations to identify the theoretical race-winning strategy.")

    col_opt1, col_opt2, col_opt3 = st.columns([1, 1, 1])
    with col_opt1:
        opt_laps = st.number_input("Total Race Laps", min_value=10, max_value=80, value=53, key="opt_laps_inp")
    with col_opt2:
        include_2stop = st.checkbox("Include 2-Stop Strategies", value=True)
    with col_opt3:
        opt_step = st.select_slider("Optimizer Solver Resolution", options=[15.0, 25.0, 40.0], value=25.0,
                                     format_func=lambda x: f"{x:.0f}m ({'Precise' if x<=15 else ('Balanced' if x==25 else 'Fast')})")

    n_plans = len(generate_1stop_plans(opt_laps))
    if include_2stop:
        n_plans += len(generate_2stop_plans(opt_laps))
    st.caption(f"Analyzing **{n_plans}** potential tyre stint combinations on **{track_name}**.")

    if st.button("🏁 EXECUTE OPTIMIZER SEARCH", key="opt_run_btn"):
        with st.spinner(f"Evaluating {n_plans} candidate strategies..."):
            t_start = time.time()
            results = find_best_strategy(TRACK, race_car, opt_laps, include_2stop=include_2stop,
                                          step=float(opt_step), verbose=False, track_name=track_name)
            calc_time = time.time() - t_start

        if results:
            best_time = results[0][0]
            st.success(f"Optimized in **{calc_time:.2f}s** — Evaluated {len(results)} valid strategies!")

            # Display Top Strategy Leaderboard
            theme.render_strategy_table(results, best_time, top_n=10)

            # Top 5 Stint Comparison Visualizer
            st.markdown('<div class="section-title">Top 5 Strategy Timeline Comparison</div>', unsafe_allow_html=True)
            for rank, (t_strat, plan) in enumerate(results[:5]):
                st.markdown(f"**P{rank+1} &bull; Total: {theme.format_time_local(t_strat)} (+{t_strat-best_time:.2f}s)**")
                theme.render_stint_timeline(plan, opt_laps)
        else:
            st.warning("No valid strategies found for the selected parameters. Try increasing the total race laps.")


# ========================================================
# TAB 5: 2D CIRCUIT SPEED MAP & GPS REPLAY
# ========================================================
with tab_map:
    st.markdown('<div class="section-title">Circuit Speed Heatmap & Telemetry GPS Replay</div>', unsafe_allow_html=True)
    st.caption("Visualizes the simulated speed heatmap and interactive client-side car tracker along the reconstructed circuit geometry.")

    map_view = st.radio("Display Mode", ["High-Definition Speed Heatmap", "Animated Lap Replay"], horizontal=True)

    if st.button("🗺️ GENERATE CIRCUIT MAP", key="map_run_btn"):
        with st.spinner("Calculating 2D circuit geometry & speed contour..."):
            map_data = build_lap_map_data(TRACK, car, step=5.0)

        if map_view == "High-Definition Speed Heatmap":
            fig_map = build_static_map_figure(map_data, title=f"{track_name.upper()} SPEED HEATMAP")
        else:
            fig_map = build_animated_map_figure(map_data, title=f"{track_name.upper()} LAP REPLAY")

        st.plotly_chart(fig_map, width="stretch")
    else:
        st.info("Click **🗺️ Generate Circuit Map** to render the track GPS telemetry.")
