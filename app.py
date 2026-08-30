"""
app.py — F1 Pit-Wall Race Control & Telemetry Simulation Console.

Run locally:
    streamlit run app.py
"""

import time

import numpy as np
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

import theme
from car_model import car_2025, car_2026
from lap_sim import simulate_lap
from map_viz import build_animated_map_figure, build_lap_map_data, build_static_map_figure
from race_sim import pit_loss_for, simulate_race_strategy
from strategy_optimizer import (
    find_best_strategy, format_plan,
    generate_1stop_plans, generate_2stop_plans,
)
from track_model import TRACKS, total_length
from tyre_model import COMPOUNDS
from validation import validate_lap_result

st.set_page_config(
    page_title="F1 Race Control Telemetry",
    page_icon="🏎️",
    layout="wide",
    initial_sidebar_state="expanded",
)
theme.inject_css()

# MGU-K electrical deployment rating per regulation era (kW) — see car_model.py
MGUK_KW = {"2025": 120, "2026": 350}
C = theme.COLORS
CFG = theme.plotly_config()


def _spec_card(car_label, car, is_2026):
    theme.render_html(
        f'<div class="circuit-card">'
        f'<div class="circuit-title">&#9881; SPEC &bull; {car_label}</div>'
        f'<div class="circuit-row"><span class="k">Min Mass</span>'
        f'<span class="v">{car.mass_empty:.0f} kg</span></div>'
        f'<div class="circuit-row"><span class="k">Power Unit</span>'
        f'<span class="v">{car.engine_power/1000:.0f} kW &bull; ~{car.engine_power/735.5:.0f} hp</span></div>'
        f'<div class="circuit-row"><span class="k">MGU-K Deploy</span>'
        f'<span class="v">{MGUK_KW["2026" if is_2026 else "2025"]} kW</span></div>'
        f'<div class="circuit-row"><span class="k">Aero Mode</span>'
        f'<span class="v">{"Dual-state Z / X" if is_2026 else "Fixed wing + DRS"}</span></div>'
        f'</div>'
    )


# ============================================================================
# SIDEBAR — MISSION CONTROL
# ============================================================================
with st.sidebar:
    theme.sidebar_mission_control()

    st.markdown("### Circuit Selection")
    track_name = st.selectbox("Grand Prix Circuit", list(TRACKS.keys()), index=0)
    TRACK = TRACKS[track_name]
    LAP_LENGTH = total_length(TRACK)
    pit_loss = pit_loss_for(track_name)
    theme.render_track_card(track_name, LAP_LENGTH, pit_loss, TRACK)

    st.markdown("### Vehicle Regulations")
    car_choice = st.radio(
        "Aero & Powertrain Package",
        ["2026 Active Aero (Next-Gen)", "2025 Fixed Wing (Current)"],
        index=0,
    )
    is_2026 = car_choice.startswith("2026")
    car = car_2026(track_name) if is_2026 else car_2025(track_name)
    car_label = "2026 ACTIVE AERO" if is_2026 else "2025 FIXED AERO"
    race_car = (car_2026 if is_2026 else car_2025)(track_name, trim="race")
    _spec_card(car_label, car, is_2026)

    with st.expander("Physics Model Engine"):
        st.markdown(
            "Point-mass forward–backward solver: aerodynamic downforce, parasitic "
            "drag, load-sensitive tyre friction-ellipse limits, and fuel-burn "
            "sensitivity.\n\n"
            "- **2026** — 768 kg, 355 kW ICE + 350 kW MGU-K, switchable Z-mode "
            "(corners) / X-mode (straights).\n"
            "- **2025** — 798 kg, 585 kW ICE + 120 kW MGU-K, standard DRS actuation."
        )


# ============================================================================
# HEADER + NAV
# ============================================================================
theme.render_f1_header(track_name, LAP_LENGTH, car_label)

tab_single, tab_compare, tab_custom, tab_opt, tab_map = st.tabs([
    "🏁 Telemetry HUD",
    "⚡ 2025 vs 2026 Delta",
    "🛞 Strategy Planner",
    "🔍 Strategy Optimizer",
    "🗺️ Track Map & GPS",
])


# ============================================================================
# TAB 1 — SINGLE LAP TELEMETRY HUD
# ============================================================================
with tab_single:
    theme.section(
        "Qualifying Single-Lap Telemetry",
        "Point-mass performance through every segment — full throttle, braking and lateral-grip limited.",
    )

    with st.container(border=True):
        col_btn, col_res, _ = st.columns([1.6, 2, 3.2])
        with col_btn:
            run_lap = st.button("🚀 Simulate Qualifying Lap", key="single_lap_btn",
                                width="stretch")
        with col_res:
            step_res = st.select_slider(
                "Solver Resolution", options=[1.0, 2.0, 5.0], value=2.0,
                format_func=lambda x: f"{x:.0f} m · {'High' if x <= 1 else ('Standard' if x == 2 else 'Fast')}",
            )

    track_or_car_changed = (
        st.session_state.get("last_lap_track") != track_name
        or st.session_state.get("last_lap_car") != car_label
    )
    if run_lap or "last_lap_result" not in st.session_state or track_or_car_changed:
        with st.spinner(f"Solving {track_name} · {car_label}…"):
            result = simulate_lap(TRACK, car, step=step_res)
            st.session_state["last_lap_result"] = result
            st.session_state["last_lap_track"] = track_name
            st.session_state["last_lap_car"] = car_label
    else:
        result = st.session_state.get("last_lap_result")

    if result:
        t = result["lap_time"]
        report = validate_lap_result(result, car, LAP_LENGTH)
        v_max = result["v_profile"].max() * 3.6
        v_avg = (LAP_LENGTH / t) * 3.6
        v_min = result["v_profile"].min() * 3.6
        if result.get("throttle_pct") is not None:
            full_throttle = np.average(result["throttle_pct"] >= 98.0,
                                       weights=result["ds_arr"]) * 100.0
        else:
            full_throttle = 0.0

        theme.chips([
            (f"{track_name.upper()}", True),
            f"{LAP_LENGTH:,.0f} M",
            car_label,
            f"SOLVER {step_res:.0f} M",
            report.top_speed_source.upper(),
        ])

        theme.render_readout_row([
            ("Lap Time", theme.format_time_local(t), "POLE-POSITION PACE", C["purple"]),
            ("Top Speed", f"{v_max:.1f}", "KM/H · END OF STRAIGHT", C["cyan"]),
            ("Average Speed", f"{v_avg:.1f}", "KM/H · CIRCUIT MEAN", C["amber"]),
            ("Min Corner Speed", f"{v_min:.1f}", "KM/H · TIGHTEST APEX", C["wet"]),
            ("Full Throttle", f"{full_throttle:.0f}%", "OF LAP DISTANCE", C["positive"]),
        ])
        if report.warnings:
            st.warning(" ".join(report.warnings), icon="⚠️")

        # Longitudinal G from the converged speed profile
        dt = np.diff(result["s"]) / np.maximum(result["v_profile"][:-1], 1.0)
        accel_g = np.zeros_like(result["s"])
        accel_g[:-1] = (np.diff(result["v_profile"]) / np.maximum(dt, 1e-4)) / 9.81

        fig = make_subplots(
            rows=3, cols=1, shared_xaxes=True,
            row_heights=[0.5, 0.26, 0.24], vertical_spacing=0.045,
            subplot_titles=("SPEED PROFILE · KM/H",
                            "PEDAL TELEMETRY · THROTTLE & BRAKE %",
                            "LONGITUDINAL ACCELERATION · G"),
        )
        for tr in theme.glow_scatter(
            result["s"], result["v_profile"] * 3.6, C["cyan"], "Speed",
            width=2.6, hovertemplate="Speed %{y:.1f} km/h<extra></extra>",
        ):
            fig.add_trace(tr, row=1, col=1)

        fig.add_trace(go.Scatter(
            x=result["s"], y=result["throttle_pct"], name="Throttle",
            line=dict(width=1.4, color=C["positive"]),
            fill="tozeroy", fillcolor="rgba(0,230,118,0.22)",
            hovertemplate="Throttle %{y:.0f}%<extra></extra>",
        ), row=2, col=1)
        fig.add_trace(go.Scatter(
            x=result["s"], y=result["brake_pct"], name="Brake",
            line=dict(width=1.4, color=C["f1_red"]),
            fill="tozeroy", fillcolor="rgba(255,24,1,0.30)",
            hovertemplate="Brake %{y:.0f}%<extra></extra>",
        ), row=2, col=1)
        fig.add_trace(go.Scatter(
            x=result["s"], y=accel_g, name="Long. G",
            line=dict(width=1.4, color=C["amber"]),
            fill="tozeroy", fillcolor="rgba(255,183,3,0.16)",
            hovertemplate="Accel %{y:.2f} G<extra></extra>",
        ), row=3, col=1)

        fig.update_yaxes(title_text="KM/H", row=1, col=1)
        fig.update_yaxes(title_text="%", range=[0, 105], row=2, col=1)
        fig.update_yaxes(title_text="G", row=3, col=1)
        fig.update_xaxes(title_text="TRACK DISTANCE AROUND LAP · METERS", row=3, col=1)

        sector_edges = [0, LAP_LENGTH / 3, 2 * LAP_LENGTH / 3, LAP_LENGTH]
        theme.add_sector_bands(fig, sector_edges, row=1, col=1)

        fig.update_layout(**theme.themed_layout_kwargs(height=760))
        fig.update_layout(title=f"TELEMETRY LOG · {track_name.upper()} · {theme.format_time_local(t)}")
        theme.style_axes(fig)
        theme.style_annotations(fig)
        st.plotly_chart(fig, config=CFG, width="stretch")

        theme.section("Apex & Corner Telemetry Breakdown")
        theme.render_corner_table(TRACK, result)


# ============================================================================
# TAB 2 — 2025 vs 2026 HEAD-TO-HEAD
# ============================================================================
with tab_compare:
    theme.section(
        "Head-to-Head · 2025 Fixed Aero vs 2026 Active Aero",
        "Dual-state active aero (low-drag X-mode straights / high-downforce Z-mode corners) against the 2025 package on this circuit.",
    )

    c25, c26 = car_2025(track_name), car_2026(track_name)

    def _clamp(v):
        return max(0.0, min(100.0, v))

    theme.render_reg_comparison([
        {"label": "MIN MASS · kg", "a_val": f"{c25.mass_empty:.0f}", "b_val": f"{c26.mass_empty:.0f}",
         "a_frac": c25.mass_empty / 820, "b_frac": c26.mass_empty / 820},
        {"label": "Z-MODE DOWNFORCE · ClA", "a_val": f"{c25.ClA:.2f}", "b_val": f"{c26.corner_ClA:.2f}",
         "a_frac": c25.ClA / max(c25.ClA, c26.corner_ClA), "b_frac": c26.corner_ClA / max(c25.ClA, c26.corner_ClA)},
        {"label": "X-MODE DRAG · CdA", "a_val": f"{c25.CdA:.2f}", "b_val": f"{c26.straight_CdA:.2f}",
         "a_frac": c25.CdA / max(c25.CdA, c26.straight_CdA), "b_frac": c26.straight_CdA / max(c25.CdA, c26.straight_CdA)},
        {"label": "MGU-K DEPLOY · kW", "a_val": f"{MGUK_KW['2025']}", "b_val": f"{MGUK_KW['2026']}",
         "a_frac": MGUK_KW["2025"] / MGUK_KW["2026"], "b_frac": 1.0},
        {"label": "GEAR-CAP TOP SPEED · km/h", "a_val": f"{c25.top_speed_kmh:.0f}", "b_val": f"{c26.top_speed_kmh:.0f}",
         "a_frac": c25.top_speed_kmh / max(c25.top_speed_kmh, c26.top_speed_kmh),
         "b_frac": c26.top_speed_kmh / max(c25.top_speed_kmh, c26.top_speed_kmh)},
    ])

    cats = ["CORNER DF", "LOW DRAG", "LIGHTNESS", "ELEC POWER", "TOP SPEED"]
    radar = theme.build_radar(
        cats,
        [
            ("2025 Fixed Aero", [
                _clamp(c25.ClA / 3.5 * 100),
                _clamp((1 - c25.CdA / 1.2) * 100),
                _clamp((820 - c25.mass_empty) / 70 * 100),
                _clamp(MGUK_KW["2025"] / 350 * 100),
                _clamp((c25.top_speed_kmh - 320) / 60 * 100),
            ], C["cyan"]),
            ("2026 Active Aero", [
                _clamp(c26.corner_ClA / 3.5 * 100),
                _clamp((1 - c26.straight_CdA / 1.2) * 100),
                _clamp((820 - c26.mass_empty) / 70 * 100),
                _clamp(MGUK_KW["2026"] / 350 * 100),
                _clamp((c26.top_speed_kmh - 320) / 60 * 100),
            ], C["purple"]),
        ],
        height=430, title="REGULATION PACKAGE ENVELOPE",
    )
    st.plotly_chart(radar, config=CFG, width="stretch")

    if st.button("⚡ Run Comparison Analysis", key="compare_btn"):
        with st.spinner(f"Simulating both regulation packages at {track_name}…"):
            res25 = simulate_lap(TRACK, c25, step=2.0)
            res26 = simulate_lap(TRACK, c26, step=2.0)

        t25, t26 = res25["lap_time"], res26["lap_time"]
        dt = t26 - t25
        dcol = C["positive"] if dt < 0 else C["negative"]
        top25, top26 = res25["v_profile"].max() * 3.6, res26["v_profile"].max() * 3.6

        theme.render_readout_row([
            ("2026 Lap Time", theme.format_time_local(t26), "ACTIVE AERO", C["purple"],
             (f"{dt:+.2f}s vs 25", "up" if dt < 0 else "down")),
            ("2025 Lap Time", theme.format_time_local(t25), "FIXED WING", C["cyan"]),
            ("Lap Delta", f"{dt:+.2f}s", "2026 FASTER" if dt < 0 else "2025 FASTER", dcol),
            ("2026 Top Speed", f"{top26:.1f}", "KM/H · X-MODE", C["amber"], f"{top26 - top25:+.1f}"),
            ("2025 Top Speed", f"{top25:.1f}", "KM/H · DRS", C["text_muted"]),
        ])

        fig = make_subplots(
            rows=2, cols=1, shared_xaxes=True, row_heights=[0.64, 0.36], vertical_spacing=0.05,
            subplot_titles=("SPEED COMPARISON · KM/H", "SPEED DELTA · 2026 − 2025 · KM/H"),
        )
        for tr in theme.glow_scatter(res26["s"], res26["v_profile"] * 3.6, C["purple"],
                                     "2026 Active Aero", width=2.6):
            fig.add_trace(tr, row=1, col=1)
        fig.add_trace(go.Scatter(
            x=res25["s"], y=res25["v_profile"] * 3.6, name="2025 Fixed Aero",
            line=dict(color=C["cyan"], width=2.0, dash="dot"),
        ), row=1, col=1)

        n = min(len(res25["v_profile"]), len(res26["v_profile"]))
        v_delta = (res26["v_profile"][:n] - res25["v_profile"][:n]) * 3.6
        fig.add_trace(go.Scatter(
            x=res26["s"][:n], y=v_delta, name="Δ Speed",
            line=dict(color=C["amber"], width=1.6),
            fill="tozeroy", fillcolor="rgba(255,183,3,0.18)",
        ), row=2, col=1)

        fig.update_yaxes(title_text="KM/H", row=1, col=1)
        fig.update_yaxes(title_text="Δ KM/H", row=2, col=1)
        fig.update_xaxes(title_text="TRACK DISTANCE · METERS", row=2, col=1)
        theme.add_sector_bands(fig, [0, LAP_LENGTH / 3, 2 * LAP_LENGTH / 3, LAP_LENGTH], row=1, col=1)

        fig.update_layout(**theme.themed_layout_kwargs(height=640))
        fig.update_layout(title=f"COMPARATIVE SPEED TRACE · {track_name.upper()}")
        theme.style_axes(fig)
        theme.style_annotations(fig)
        st.plotly_chart(fig, config=CFG, width="stretch")
    else:
        st.info("Run the comparison to overlay both speed traces and the lap-time delta.")


# ============================================================================
# TAB 3 — CUSTOM STRATEGY PLANNER
# ============================================================================
with tab_custom:
    theme.section(
        "Custom Pit Strategy & Stint Planner",
        "Models tyre grip decay, non-linear thermal cliffs and full-to-empty fuel burn-off.",
    )

    with st.container(border=True):
        c_laps, c_stints = st.columns(2)
        with c_laps:
            total_laps = st.number_input("Total Race Laps", 10, 80, 53, 1)
        with c_stints:
            n_stints = st.selectbox(
                "Stint Count", [1, 2, 3], index=1,
                format_func=lambda x: f"{x} stint{'s' if x > 1 else ''} · {x-1} stop{'s' if x != 2 else ''}",
            )

        compound_names = list(COMPOUNDS.keys())
        stint_inputs = []
        cols = st.columns(n_stints)
        remaining = total_laps
        for i in range(n_stints):
            with cols[i]:
                st.markdown(f"**Stint {i+1}**")
                compound = st.selectbox("Compound", compound_names,
                                        index=min(i, len(compound_names) - 1), key=f"cust_comp_{i}")
                if i == n_stints - 1:
                    laps = remaining
                    st.caption(f"Laps: {laps} (remainder)")
                else:
                    laps = st.number_input("Stint length (laps)", 1, total_laps,
                                           max(5, total_laps // n_stints), key=f"cust_laps_{i}")
                    remaining -= laps
                stint_inputs.append((compound, laps))

    if sum(l for _, l in stint_inputs) == total_laps and all(l > 0 for _, l in stint_inputs):
        theme.render_stint_timeline(stint_inputs, total_laps)

    if st.button("📊 Simulate Race Strategy", key="custom_strat_btn"):
        if stint_inputs[-1][1] <= 0:
            st.error("Stint lengths exceed the race distance — reduce an earlier stint.")
        else:
            with st.spinner(f"Simulating {total_laps} laps with pit stops…"):
                res = simulate_race_strategy(TRACK, race_car, stint_inputs, total_laps,
                                             step=8.0, track_name=track_name)

            t_race = res["total_time"]
            avg_lap = t_race / total_laps
            fastest, slowest = min(res["lap_times"]), max(res["lap_times"])

            theme.render_readout_row([
                ("Total Race Time", theme.format_time_local(t_race), f"{n_stints-1} PIT STOP(S)", C["purple"]),
                ("Average Lap", f"{avg_lap:.3f}", "SECONDS / LAP", C["cyan"]),
                ("Fastest Lap", f"{fastest:.2f}", "S · BEST STINT PACE", C["positive"]),
                ("Pace Degradation", f"+{slowest - fastest:.2f}s", "WORST vs BEST LAP", C["amber"]),
            ])

            lap_numbers = list(range(1, total_laps + 1))
            fig = go.Figure()

            # compound bands
            cursor = 0
            for comp, n_l in stint_inputs:
                fill, _ = theme.COMPOUND_COLORS.get(comp, (C["cyan"], "#fff"))
                rgb = theme._hex_to_rgb(fill)
                fig.add_vrect(x0=cursor + 0.5, x1=cursor + n_l + 0.5,
                              fillcolor=f"rgba({rgb[0]},{rgb[1]},{rgb[2]},0.08)",
                              line_width=0, layer="below")
                cursor += n_l

            fig.add_trace(go.Scatter(
                x=lap_numbers, y=res["lap_times"], mode="lines+markers", name="Lap Time",
                line=dict(color=C["cyan"], width=2.4),
                marker=dict(size=5, color=C["amber"], line=dict(width=1, color="#fff")),
                hovertemplate="<b>Lap %{x}</b> · %{y:.2f}s<extra></extra>",
            ))

            cum = 0
            for comp, n_l in stint_inputs[:-1]:
                cum += n_l
                fig.add_vline(x=cum + 0.5, line_width=2, line_dash="dash", line_color=C["f1_red"],
                              annotation_text="BOX BOX", annotation_position="top left",
                              annotation_font=dict(family=theme.FONT_TECH, color=C["f1_red"], size=11))

            fig.update_layout(**theme.themed_layout_kwargs(height=440, unified_hover=False))
            fig.update_layout(title=f"RACE PACE DEGRADATION · {format_plan(stint_inputs)}",
                              xaxis_title="RACE LAP", yaxis_title="LAP TIME · SECONDS")
            theme.style_axes(fig, spikes=False)
            st.plotly_chart(fig, config=CFG, width="stretch")


# ============================================================================
# TAB 4 — STRATEGY OPTIMIZER
# ============================================================================
with tab_opt:
    theme.section(
        "Pit-Wall Strategy Optimizer",
        "Exhaustive search over every 1-stop and 2-stop compound permutation for the theoretical race-winning strategy.",
    )

    with st.container(border=True):
        o1, o2, o3 = st.columns(3)
        with o1:
            opt_laps = st.number_input("Total Race Laps", 10, 80, 53, key="opt_laps_inp")
        with o2:
            include_2stop = st.checkbox("Include 2-stop strategies", value=True)
        with o3:
            opt_step = st.select_slider(
                "Solver Resolution", options=[15.0, 25.0, 40.0], value=25.0,
                format_func=lambda x: f"{x:.0f} m · {'Precise' if x <= 15 else ('Balanced' if x == 25 else 'Fast')}",
            )

    n_plans = len(generate_1stop_plans(opt_laps))
    if include_2stop:
        n_plans += len(generate_2stop_plans(opt_laps))
    theme.chips([f"{n_plans} CANDIDATE STRATEGIES", (track_name.upper(), True), f"{opt_laps} LAPS"])

    if st.button("🏁 Execute Optimizer Search", key="opt_run_btn"):
        with st.spinner(f"Evaluating {n_plans} candidate strategies…"):
            t0 = time.time()
            results = find_best_strategy(TRACK, race_car, opt_laps, include_2stop=include_2stop,
                                        step=float(opt_step), verbose=False, track_name=track_name)
            calc_time = time.time() - t0

        if results:
            best = results[0][0]
            st.success(f"Optimised in {calc_time:.2f}s — {len(results)} valid strategies evaluated.")
            theme.render_strategy_table(results, best, top_n=10)

            theme.section("Top 5 Strategy Timelines")
            for rank, (t_strat, plan) in enumerate(results[:5]):
                st.markdown(
                    f"**P{rank+1} · {theme.format_time_local(t_strat)}** "
                    f"(+{t_strat - best:.2f}s)"
                )
                theme.render_stint_timeline(plan, opt_laps,
                                            delta_vs=(t_strat - best) if rank else None)
        else:
            st.warning("No valid strategies for these parameters — try more race laps.")


# ============================================================================
# TAB 5 — CIRCUIT SPEED MAP & GPS REPLAY
# ============================================================================
with tab_map:
    theme.section(
        "Circuit Speed Heatmap & GPS Telemetry Replay",
        "Reconstructed circuit geometry with a simulated speed heatmap and a client-side lap replay.",
    )

    map_view = st.radio("Display Mode",
                        ["High-Definition Speed Heatmap", "Animated Lap Replay"],
                        horizontal=True)

    if st.button("🗺️ Generate Circuit Map", key="map_run_btn"):
        with st.spinner("Reconstructing 2D circuit geometry & speed contour…"):
            map_data = build_lap_map_data(TRACK, car, step=5.0)

        if map_view == "High-Definition Speed Heatmap":
            fig_map = build_static_map_figure(map_data, title=f"{track_name.upper()} · SPEED HEATMAP")
        else:
            fig_map = build_animated_map_figure(map_data, title=f"{track_name.upper()} · LAP REPLAY")

        st.plotly_chart(fig_map, config=CFG, width="stretch")
    else:
        st.info("Generate the map to render the circuit's speed-coloured GPS trace.")
