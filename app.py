"""
app.py — RACE SIMULATOR · a cinematic Formula 1 lap-time & pit-strategy platform.

The physics engine (car_model / lap_sim / tyre_model / race_sim /
strategy_optimizer / track_model) is untouched — this file is presentation:
a cinematic hero, a broadcast navigation bar, and six pit-wall views that all
draw on the same simulation calls.

Run locally:  streamlit run app.py
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
from track_geometry import compute_track_xy
from track_model import (
    TRACKS, total_length, race_laps, tyre_stress, drs_zone_count,
    track_metadata, track_country, track_location, track_flag,
    track_full_name, track_characteristics, track_direction,
)
from tyre_model import COMPOUNDS
from validation import validate_lap_result

st.set_page_config(
    page_title="Race Simulator · F1 Strategy Platform",
    page_icon="🏁",
    layout="wide",
    initial_sidebar_state="expanded",
)
theme.inject_css()

MGUK_KW = {"2025": 120, "2026": 350}
C = theme.COLORS
CFG = theme.plotly_config()

VIEWS = ["OVERVIEW", "SIMULATOR", "CIRCUITS", "REGULATIONS", "STRATEGY", "TRACK MAP"]

# ---------------------------------------------------------------------------
# GLOBAL STATE: Single source of truth for selected circuit
# ---------------------------------------------------------------------------
track_list = list(TRACKS.keys())
if "selected_track" not in st.session_state or st.session_state["selected_track"] not in track_list:
    st.session_state["selected_track"] = track_list[0]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _clamp(v, lo=4.0, hi=100.0):
    return max(lo, min(hi, v))


def _sync_race_laps(widget_key: str):
    """Auto-sync a 'Total Race Laps' input to the selected circuit's real GP
    distance, re-syncing on track change while keeping manual +/- adjustments."""
    guard = f"_racelaps_track_{widget_key}"
    cur_track = st.session_state.get("selected_track", track_list[0])
    if st.session_state.get(guard) != cur_track:
        st.session_state[widget_key] = race_laps(cur_track)
        st.session_state[guard] = cur_track


def _goto(view: str):
    """Queue a navigation change (honoured at the top of the next run)."""
    st.session_state["_goto"] = view
    st.rerun()


def _spec_card(label, car, is_2026):
    ice = (car.ice_power_w or car.engine_power) / 1000.0
    mguk = car.mguk_power_w / 1000.0
    budget = ("4.0 MJ / lap cap" if car.mguk_deploy_budget_j
              else f"{car.battery_capacity_j/1e6:.1f} MJ store · no MGU-H")
    theme.render_html(
        f'<div class="circuit-card">'
        f'<div class="circuit-title">&#9881; {label}</div>'
        f'<div class="circuit-row"><span class="k">Min Mass</span><span class="v">{car.mass_empty:.0f} kg</span></div>'
        f'<div class="circuit-row"><span class="k">Hybrid Output</span>'
        f'<span class="v">{ice + mguk:.0f} kW · ~{(ice + mguk) * 1000 / 735.5:.0f} hp</span></div>'
        f'<div class="circuit-row"><span class="k">ICE / MGU-K</span><span class="v">{ice:.0f} + {mguk:.0f} kW</span></div>'
        f'<div class="circuit-row"><span class="k">ERS Budget</span><span class="v">{budget}</span></div>'
        f'<div class="circuit-row"><span class="k">Air Density</span><span class="v">{car.rho:.3f} kg/m&sup3;</span></div>'
        f'<div class="circuit-row"><span class="k">Aero</span>'
        f'<span class="v">{"Active Z / X" if is_2026 else "Fixed wing + DRS"}</span></div>'
        f'</div>'
    )


def _circuit_profile(name, segments, car):
    """Real circuit facts + 0-100 character ratings, computed from geometry."""
    meta = track_metadata(name)
    n_corners = sum(1 for s in segments if s.kind == "corner")
    lap_len = total_length(segments)
    straights = [s.length for s in segments if s.kind == "straight"]
    straight_pct = sum(straights) / lap_len * 100 if lap_len else 0
    longest = max(straights) if straights else 0
    drs = drs_zone_count(segments)
    stress = tyre_stress(name)
    cla = getattr(car, "corner_ClA", None) or car.ClA

    facts = [
        (f"{meta.flag} {meta.country}", "VENUE / REGION"),
        (f"{n_corners}", "TURNS"),
        (f"{lap_len/1000:.3f} KM", "LAP LENGTH"),
        (f"{race_laps(name)}", "RACE LAPS"),
        (f"{drs}", "DRS ZONES"),
        (f"~{pit_loss_for(name):.0f}s", "PIT LOSS"),
    ]
    traits = [
        ("Speed",      _clamp((straight_pct - 38) / 42 * 100), f"{straight_pct:.0f}% FLAT"),
        ("Overtaking", _clamp(drs * 26 + longest / 22),        f"{drs} DRS · {longest:.0f}m"),
        ("Tyre Wear",  _clamp((stress - 0.75) / 0.62 * 100),   f"{stress:.2f}x STRESS"),
        ("Downforce",  _clamp((cla - 1.2) / 2.7 * 100),        f"ClA {cla:.2f}"),
    ]
    return facts, traits


def _outline_figure(segments, height=320):
    geo = compute_track_xy(segments, step=6.0)
    x, y = geo["x"], geo["y"]
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=x, y=y, mode="lines",
                             line=dict(color="rgba(225,6,0,0.16)", width=13), hoverinfo="skip"))
    fig.add_trace(go.Scatter(x=x, y=y, mode="lines",
                             line=dict(color=C["f1_red"], width=2.4), hoverinfo="skip"))
    fig.add_trace(go.Scatter(x=[x[0]], y=[y[0]], mode="markers",
                             marker=dict(symbol="square", size=11, color="#fff"), hoverinfo="skip"))
    fig.update_layout(**theme.themed_layout_kwargs(height=height, transparent=True, unified_hover=False))
    fig.update_layout(title=dict(text=""), showlegend=False, margin=dict(t=10, b=10, l=10, r=10),
                      xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
                      yaxis=dict(visible=False))
    return fig


# ---------------------------------------------------------------------------
# CONTROL PANEL  (sidebar)
# ---------------------------------------------------------------------------
with st.sidebar:
    theme.sidebar_mission_control()

    st.markdown("### Race Configuration")

    def _on_sidebar_track_change():
        st.session_state["selected_track"] = st.session_state["sidebar_track_select"]

    current_track_idx = track_list.index(st.session_state["selected_track"])
    track_name = st.selectbox(
        "Grand Prix Circuit",
        track_list,
        index=current_track_idx,
        key="sidebar_track_select",
        on_change=_on_sidebar_track_change,
    )
    st.session_state["selected_track"] = track_name

    TRACK = TRACKS[track_name]
    LAP_LENGTH = total_length(TRACK)
    pit_loss = pit_loss_for(track_name)
    meta = track_metadata(track_name)
    theme.render_track_card(
        track_name, LAP_LENGTH, pit_loss, TRACK,
        country=meta.country, flag=meta.flag, location=meta.location,
    )

    st.markdown("### The Machine")
    car_choice = st.radio(
        "Regulation Package",
        ["2026 Active Aero (Next-Gen)", "2025 Fixed Wing (Current)"],
        index=0,
    )
    is_2026 = car_choice.startswith("2026")
    car = car_2026(track_name) if is_2026 else car_2025(track_name)
    car_label = "2026 ACTIVE AERO" if is_2026 else "2025 FIXED AERO"
    race_car = (car_2026 if is_2026 else car_2025)(track_name, trim="race")
    _spec_card(f"SPEC · {car_label}", car, is_2026)

    with st.expander("Physics Model Engine"):
        st.markdown(
            "Energy-constrained point-mass forward–backward solver: real air "
            "density from track temp + elevation, load-sensitive tyre "
            "friction-ellipse, fuel burn-off, a 5.5 g carbon-brake ceiling, and "
            "an ERS energy pass (deploy vs harvest → end-of-straight clipping).\n\n"
            "- **2026** — 768 kg, 400 kW ICE + 350 kW MGU-K, **no MGU-H** so the "
            "4 MJ store depletes; switchable Z-mode / X-mode active aero.\n"
            "- **2025** — 798 kg, ~660 kW ICE + 120 kW MGU-K, 4 MJ/lap "
            "deployment cap (MGU-H keeps the store topped), DRS."
        )


# ---------------------------------------------------------------------------
# NAVIGATION
# ---------------------------------------------------------------------------
if "_goto" in st.session_state:
    st.session_state["nav_bar"] = st.session_state.pop("_goto")

theme.render_nav_brand("SYSTEM READY")
view = st.radio("Navigation", VIEWS, horizontal=True, key="nav_bar",
                label_visibility="collapsed")


# ===========================================================================
# OVERVIEW
# ===========================================================================
if view == "OVERVIEW":
    theme.render_hero(
        app_name="RACE SIMULATOR",
        tagline="Simulate. Strategize. Race.",
        description=("A physics-grade Formula 1 lap-time and pit-strategy engine. "
                     "Point-mass vehicle dynamics, hybrid-ERS energy management and "
                     "tyre thermal modelling across nine Grand Prix circuits."),
        stats=[("9", "Grand Prix circuits"), ("2", "Regulation eras"),
               ("768 KG", "2026 min mass"), ("~1000 HP", "Hybrid output")],
    )
    cta_l, cta_r = st.columns([1, 2.4])
    with cta_l:
        if st.button("▶   START SIMULATION", key="cta_start", width="stretch"):
            _goto("SIMULATOR")
    with cta_r:
        st.markdown("")

    theme.section("What the engine models",
                  "Every number on the platform comes from the same solver — no lookup tables.")
    a, b, c = st.columns(3)
    with a:
        with st.container(border=True):
            theme.render_html(
                '<div style="font-family:var(--font-display);font-weight:700;letter-spacing:.1em;'
                'text-transform:uppercase;color:#fff;font-size:1rem;">Lap-time solver</div>'
                '<p style="color:var(--text-muted);font-size:.86rem;line-height:1.6;margin-top:.5rem;">'
                'Forward–backward speed profile with friction-ellipse grip, downforce, real air '
                'density and a gear-limited top speed. Outputs sector splits, apex speeds, speed '
                'traps and lateral / longitudinal G.</p>')
    with b:
        with st.container(border=True):
            theme.render_html(
                '<div style="font-family:var(--font-display);font-weight:700;letter-spacing:.1em;'
                'text-transform:uppercase;color:#fff;font-size:1rem;">ERS energy pass</div>'
                '<p style="color:var(--text-muted);font-size:.86rem;line-height:1.6;margin-top:.5rem;">'
                'Battery state-of-charge around the lap: MGU-K deploy under power, regen under '
                'braking. 2025 runs a 4 MJ/lap cap; 2026 has no MGU-H, so the store empties and the '
                'car clips on long straights.</p>')
    with c:
        with st.container(border=True):
            theme.render_html(
                '<div style="font-family:var(--font-display);font-weight:700;letter-spacing:.1em;'
                'text-transform:uppercase;color:#fff;font-size:1rem;">Tyre &amp; strategy</div>'
                '<p style="color:var(--text-muted);font-size:.86rem;line-height:1.6;margin-top:.5rem;">'
                'Warm-up, thermal plateau and cliff degradation per compound, amplified by each '
                'circuit\'s energy load. A brute-force optimiser then ranks every 1- and 2-stop '
                'plan for the fastest race.</p>')

    theme.section("Jump in")
    j1, j2, j3 = st.columns(3)
    with j1:
        if st.button("🏁  Run a qualifying lap", key="ov_sim", width="stretch"):
            _goto("SIMULATOR")
    with j2:
        if st.button("🗺  Explore the circuits", key="ov_ct", width="stretch"):
            _goto("CIRCUITS")
    with j3:
        if st.button("🛞  Optimise a strategy", key="ov_st", width="stretch"):
            _goto("STRATEGY")


# ===========================================================================
# SIMULATOR  —  pit-wall telemetry HUD
# ===========================================================================
elif view == "SIMULATOR":
    theme.render_f1_header(track_name, LAP_LENGTH, car_label, air_density=car.rho)
    theme.section("Qualifying Single-Lap Telemetry",
                  "Point-mass performance through every segment — full throttle, braking and lateral-grip limited.")

    cfg_col, main_col, cond_col = st.columns([1.35, 2.85, 1.35], gap="medium")

    with cfg_col:
        with st.container(border=True):
            st.markdown("**RUN CONTROL**")
            step_res = st.select_slider(
                "Solver resolution", options=[1.0, 2.0, 5.0], value=2.0,
                format_func=lambda x: f"{x:.0f}m",
            )
            run_lap = st.button("▶  RUN LAP", key="single_lap_btn", width="stretch")
            theme.render_html(
                f'<div style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-dim);'
                f'margin-top:.7rem;line-height:1.9;letter-spacing:.03em;">'
                f'CIRCUIT&nbsp;&middot;&nbsp;<span style="color:var(--text-muted);">{track_name.upper()}</span><br>'
                f'MACHINE&nbsp;&middot;&nbsp;<span style="color:var(--text-muted);">{car_label}</span><br>'
                f'LENGTH&nbsp;&middot;&nbsp;<span style="color:var(--text-muted);">{LAP_LENGTH:,.0f} M</span></div>')

    track_or_car_changed = (
        st.session_state.get("last_lap_track") != track_name
        or st.session_state.get("last_lap_car") != car_label
    )
    if run_lap or "last_lap_result" not in st.session_state or track_or_car_changed:
        with st.status(f"INITIALISING RACE MODEL · {track_name.upper()}", expanded=True) as status:
            st.write("Reconstructing circuit geometry")
            st.write("Solving forward–backward speed profile")
            result = simulate_lap(TRACK, car, step=step_res, track_name=track_name)
            st.write("Integrating ERS energy budget & tyre load")
            st.write("Deriving sector splits, G-forces and speed traps")
            st.session_state["last_lap_result"] = result
            st.session_state["last_lap_track"] = track_name
            st.session_state["last_lap_car"] = car_label
            status.update(label=f"RACE MODEL COMPLETE · {theme.format_time_local(result['lap_time'])}",
                          state="complete", expanded=False)
    else:
        result = st.session_state.get("last_lap_result")

    if result:
        t = result["lap_time"]
        report = validate_lap_result(result, car, LAP_LENGTH)
        v_max = result["v_profile"].max() * 3.6
        v_avg = (LAP_LENGTH / t) * 3.6
        v_min = result["v_profile"].min() * 3.6
        s1, s2, s3 = result["sector_times"]
        b1, b2 = result["sector_bounds_m"]
        g_lat_max = float(np.max(result["g_lat"]))
        g_brake_max = float(-np.min(result["g_long"]))
        ers = result["ers"]

        with cond_col:
            with st.container(border=True):
                st.markdown("**SECTOR SPLITS**")
                theme.render_html(
                    f'<div style="font-family:var(--font-mono);font-size:1rem;line-height:2.2;white-space:nowrap;">'
                    f'<span style="color:var(--accent-cyan);font-size:.75rem;">S1</span>&nbsp;&nbsp;{s1:.3f}<br>'
                    f'<span style="color:var(--accent-amber);font-size:.75rem;">S2</span>&nbsp;&nbsp;{s2:.3f}<br>'
                    f'<span style="color:#B026FF;font-size:.75rem;">S3</span>&nbsp;&nbsp;{s3:.3f}</div>')
            with st.container(border=True):
                st.markdown("**ERS · THIS LAP**")
                theme.render_html(
                    f'<div style="font-family:var(--font-mono);font-size:.8rem;line-height:2.1;color:var(--text-muted);white-space:nowrap;">'
                    f'DEPLOY&nbsp;&nbsp;<b style="color:#fff;">{ers["deployed_j"]/1e6:.2f} MJ</b><br>'
                    f'HARVEST&nbsp;&nbsp;<b style="color:var(--accent-green);">{ers["harvested_j"]/1e6:.2f} MJ</b><br>'
                    f'CLIP&nbsp;&nbsp;<b style="color:var(--race-red);">{ers["clip_distance_m"]:.0f} m</b></div>')

        with main_col:
            theme.render_readout_row([
                ("Lap Time", theme.format_time_local(t), "POLE-POSITION PACE", C["purple"]),
                ("Speed Trap", f"{result['speed_trap_kmh']:.1f}", "KM/H · FASTEST STRAIGHT", C["cyan"]),
                ("Average Speed", f"{v_avg:.1f}", "KM/H · CIRCUIT MEAN", C["amber"]),
                ("Min Corner Speed", f"{v_min:.1f}", "KM/H · TIGHTEST APEX", C["wet"]),
                ("Peak Lateral", f"{g_lat_max:.1f}g", "MAX CORNERING LOAD", C["positive"]),
                ("Peak Braking", f"{g_brake_max:.1f}g", "MAX DECELERATION", C["f1_red"]),
            ])
            if report.warnings:
                st.warning(" ".join(report.warnings), icon="⚠️")

            s_m = result["s"]
            fig = make_subplots(
                rows=4, cols=1, shared_xaxes=True,
                row_heights=[0.40, 0.20, 0.20, 0.20], vertical_spacing=0.04,
                subplot_titles=("SPEED PROFILE · KM/H  (dashed = energy-unconstrained)",
                                "PEDAL TELEMETRY · THROTTLE & BRAKE %",
                                "G-FORCE · LATERAL / LONGITUDINAL / TOTAL",
                                "ERS · MGU-K DEPLOYMENT kW & BATTERY SOC %"),
            )
            for tr in theme.glow_scatter(
                s_m, result["v_profile"] * 3.6, C["cyan"], "Speed",
                width=2.6, hovertemplate="Speed %{y:.1f} km/h<extra></extra>",
            ):
                fig.add_trace(tr, row=1, col=1)
            fig.add_trace(go.Scatter(
                x=s_m, y=result["v_profile_free"] * 3.6, name="No energy limit",
                line=dict(width=1.1, color="rgba(255,255,255,0.35)", dash="dot"),
                hoverinfo="skip"), row=1, col=1)

            fig.add_trace(go.Scatter(
                x=s_m, y=result["throttle_pct"], name="Throttle",
                line=dict(width=1.4, color=C["positive"]),
                fill="tozeroy", fillcolor="rgba(47,191,113,0.22)",
                hovertemplate="Throttle %{y:.0f}%<extra></extra>"), row=2, col=1)
            fig.add_trace(go.Scatter(
                x=s_m, y=result["brake_pct"], name="Brake",
                line=dict(width=1.4, color=C["f1_red"]),
                fill="tozeroy", fillcolor="rgba(225,6,0,0.32)",
                hovertemplate="Brake %{y:.0f}%<extra></extra>"), row=2, col=1)

            fig.add_trace(go.Scatter(x=s_m, y=result["g_lat"], name="Lateral g",
                                     line=dict(width=1.3, color=C["cyan"]),
                                     hovertemplate="Lat %{y:.2f} g<extra></extra>"), row=3, col=1)
            fig.add_trace(go.Scatter(x=s_m, y=result["g_long"], name="Long. g",
                                     line=dict(width=1.3, color=C["amber"]),
                                     hovertemplate="Long %{y:.2f} g<extra></extra>"), row=3, col=1)
            fig.add_trace(go.Scatter(x=s_m, y=result["g_total"], name="Total g",
                                     line=dict(width=1.0, color="rgba(255,255,255,0.4)"),
                                     hovertemplate="Total %{y:.2f} g<extra></extra>"), row=3, col=1)

            fig.add_trace(go.Scatter(
                x=s_m, y=ers["ers_power_trace"] / 1e3, name="MGU-K kW",
                line=dict(width=1.3, color=C["teal"]),
                fill="tozeroy", fillcolor="rgba(59,201,219,0.18)",
                hovertemplate="MGU-K %{y:.0f} kW<extra></extra>"), row=4, col=1)
            soc_pct = ers["soc_trace"] / max(ers["soc_start_j"], 1.0) * 100.0
            fig.add_trace(go.Scatter(
                x=s_m, y=soc_pct, name="Battery SOC %",
                line=dict(width=1.3, color=C["purple"]),
                hovertemplate="SOC %{y:.0f}%<extra></extra>"), row=4, col=1)

            fig.update_yaxes(title_text="KM/H", row=1, col=1)
            fig.update_yaxes(title_text="%", range=[0, 105], row=2, col=1)
            fig.update_yaxes(title_text="G", row=3, col=1)
            fig.update_yaxes(title_text="kW / %", row=4, col=1)
            fig.update_xaxes(title_text="TRACK DISTANCE AROUND LAP · METERS", row=4, col=1)
            theme.add_sector_bands(fig, [0, b1, b2, LAP_LENGTH], row=1, col=1)
            fig.update_layout(**theme.themed_layout_kwargs(height=880))
            fig.update_layout(title=f"TELEMETRY LOG · {track_name.upper()} · {theme.format_time_local(t)}")
            theme.style_axes(fig)
            theme.style_annotations(fig)
            st.plotly_chart(fig, config=CFG, width="stretch")

        theme.section("Apex & Corner Telemetry Breakdown")
        theme.render_corner_table(TRACK, result)


# ===========================================================================
# CIRCUITS  —  the circuit experience
# ===========================================================================
elif view == "CIRCUITS":
    # In-page circuit selector bar for instant dynamic switching
    theme.section("Grand Prix Circuit Selection",
                  "Explore layout geometry, aerodynamic character and telemetry benchmarks across all championship tracks.")

    c_sel, c_info = st.columns([1.4, 2.6], gap="medium")
    with c_sel:
        def _on_circuits_tab_track_change():
            st.session_state["selected_track"] = st.session_state["circuits_tab_track_select"]
            st.session_state["sidebar_track_select"] = st.session_state["circuits_tab_track_select"]

        active_idx = track_list.index(st.session_state["selected_track"])
        chosen_track = st.selectbox(
            "Select Grand Prix Venue",
            track_list,
            index=active_idx,
            key="circuits_tab_track_select",
            on_change=_on_circuits_tab_track_change,
        )
        if chosen_track != track_name:
            st.session_state["selected_track"] = chosen_track
            st.session_state["sidebar_track_select"] = chosen_track
            st.rerun()

    with c_info:
        meta_info = track_metadata(st.session_state["selected_track"])
        theme.render_html(
            f'<div style="display:flex;align-items:center;gap:14px;padding:0.6rem 0.9rem;'
            f'background:rgba(255,255,255,0.025);border:1px solid var(--line-solid);border-radius:4px;">'
            f'<span style="font-size:1.8rem;line-height:1;">{meta_info.flag}</span>'
            f'<div>'
            f'<div style="font-family:var(--font-display);font-size:0.95rem;font-weight:700;color:#fff;letter-spacing:0.05em;">{meta_info.full_name}</div>'
            f'<div style="font-family:var(--font-tech);font-size:0.75rem;color:var(--text-muted);letter-spacing:0.08em;text-transform:uppercase;">{meta_info.location} &bull; {meta_info.direction} &bull; LAP RECORD: {meta_info.lap_record}</div>'
            f'</div></div>'
        )

    # Re-fetch active track objects based on the updated session state
    current_track_name = st.session_state["selected_track"]
    CURR_TRACK = TRACKS[current_track_name]
    CURR_LAP_LENGTH = total_length(CURR_TRACK)
    curr_pit_loss = pit_loss_for(current_track_name)
    curr_meta = track_metadata(current_track_name)

    facts, traits = _circuit_profile(current_track_name, CURR_TRACK, car)
    subtitle = (f"{sum(1 for s in CURR_TRACK if s.kind == 'corner')} turns · "
                f"{drs_zone_count(CURR_TRACK)} DRS zones · driven {curr_meta.direction.lower()}")

    theme.render_circuit_hero(
        current_track_name, subtitle, facts, traits,
        country=curr_meta.country, location=curr_meta.location, flag=curr_meta.flag,
        full_name=curr_meta.full_name, characteristics=curr_meta.characteristics,
    )

    lay, ray = st.columns([1.5, 1.1], gap="large")
    with lay:
        theme.section("Circuit character",
                      "Ratings derived from the segment model — straight fraction, DRS geometry, "
                      "tyre energy load and cornering downforce.")
        theme.render_track_card(
            current_track_name, CURR_LAP_LENGTH, curr_pit_loss, CURR_TRACK,
            country=curr_meta.country, flag=curr_meta.flag, location=curr_meta.location,
        )
    with ray:
        theme.section("Layout Geometry")
        st.plotly_chart(_outline_figure(CURR_TRACK, height=360),
                        config=theme.plotly_config(static=True),
                        width="stretch")

    theme.section("Corner-by-corner reference",
                  f"Apex / entry / exit speeds from the current machine's qualifying lap at {current_track_name}.")
    ck = f"{current_track_name}|{car_label}"
    if st.session_state.get("_circ_key") != ck:
        with st.spinner(f"Solving a reference lap at {current_track_name}…"):
            st.session_state["_circ_result"] = simulate_lap(CURR_TRACK, car, step=3.0, track_name=current_track_name)
            st.session_state["_circ_key"] = ck
    theme.render_corner_table(CURR_TRACK, st.session_state["_circ_result"])



# ===========================================================================
# REGULATIONS  —  2025 vs 2026
# ===========================================================================
elif view == "REGULATIONS":
    theme.render_f1_header(track_name, LAP_LENGTH, car_label, air_density=car.rho)
    theme.section("2025 Fixed Aero vs 2026 Active Aero",
                  "Dual-state active aero (low-drag X-mode straights / high-downforce Z-mode corners) "
                  "against the 2025 package on this circuit.")

    c25, c26 = car_2025(track_name), car_2026(track_name)
    left, right = st.columns([1, 1.15], gap="large")

    with left:
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
    with right:
        cats = ["CORNER DF", "LOW DRAG", "LIGHTNESS", "ELEC POWER", "TOP SPEED"]
        radar = theme.build_radar(
            cats,
            [
                ("2025 Fixed Aero", [
                    _clamp(c25.ClA / 3.5 * 100, 0), _clamp((1 - c25.CdA / 1.2) * 100, 0),
                    _clamp((820 - c25.mass_empty) / 70 * 100, 0), _clamp(MGUK_KW["2025"] / 350 * 100, 0),
                    _clamp((c25.top_speed_kmh - 320) / 60 * 100, 0),
                ], C["cyan"]),
                ("2026 Active Aero", [
                    _clamp(c26.corner_ClA / 3.5 * 100, 0), _clamp((1 - c26.straight_CdA / 1.2) * 100, 0),
                    _clamp((820 - c26.mass_empty) / 70 * 100, 0), _clamp(MGUK_KW["2026"] / 350 * 100, 0),
                    _clamp((c26.top_speed_kmh - 320) / 60 * 100, 0),
                ], C["purple"]),
            ],
            height=430, title="REGULATION PACKAGE ENVELOPE",
        )
        st.plotly_chart(radar, config=CFG, width="stretch")

    if st.button("⚡  RUN HEAD-TO-HEAD", key="compare_btn"):
        with st.status(f"Simulating both packages at {track_name.upper()}", expanded=True) as status:
            st.write("Solving 2025 fixed-wing lap")
            res25 = simulate_lap(TRACK, c25, step=2.0, track_name=track_name)
            st.write("Solving 2026 active-aero lap")
            res26 = simulate_lap(TRACK, c26, step=2.0, track_name=track_name)
            status.update(label="HEAD-TO-HEAD COMPLETE", state="complete", expanded=False)

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
        fig.add_trace(go.Scatter(x=res25["s"], y=res25["v_profile"] * 3.6, name="2025 Fixed Aero",
                                 line=dict(color=C["cyan"], width=2.0, dash="dot")), row=1, col=1)
        n = min(len(res25["v_profile"]), len(res26["v_profile"]))
        v_delta = (res26["v_profile"][:n] - res25["v_profile"][:n]) * 3.6
        fig.add_trace(go.Scatter(x=res26["s"][:n], y=v_delta, name="Δ Speed",
                                 line=dict(color=C["amber"], width=1.6),
                                 fill="tozeroy", fillcolor="rgba(245,166,35,0.18)"), row=2, col=1)
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
        st.info("Run the head-to-head to overlay both speed traces and the lap-time delta.")


# ===========================================================================
# STRATEGY  —  planner + optimizer, timing-tower results
# ===========================================================================
elif view == "STRATEGY":
    theme.section("Pit Strategy", f"{track_name} · {race_laps(track_name)}-lap Grand Prix · "
                  f"~{pit_loss_for(track_name):.0f}s pit loss · {tyre_stress(track_name):.2f}x tyre stress")

    plan_tab, opt_tab = st.tabs(["  STINT PLANNER  ", "  RACE OPTIMISER  "])

    # ---- planner ----
    with plan_tab:
        _sync_race_laps("custom_laps_inp")
        with st.container(border=True):
            c_laps, c_stints = st.columns(2)
            with c_laps:
                total_laps = st.number_input(
                    "Total Race Laps", 5, 90, step=1, key="custom_laps_inp",
                    help=f"Synced to the {track_name} GP distance — adjust as needed.")
            with c_stints:
                n_stints = st.selectbox(
                    "Stint Count", [1, 2, 3], index=1,
                    format_func=lambda x: f"{x} stint{'s' if x > 1 else ''} · {x-1} stop{'s' if x != 2 else ''}")
            _gp = race_laps(track_name)
            st.caption(f"Auto-synced to the {track_name} Grand Prix distance ({_gp} laps)."
                       + ("" if total_laps == _gp else f"  Adjusted: {total_laps - _gp:+d} laps."))

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

        if st.button("📊  SIMULATE RACE STRATEGY", key="custom_strat_btn"):
            if stint_inputs[-1][1] <= 0:
                st.error("Stint lengths exceed the race distance — reduce an earlier stint.")
            else:
                with st.status(f"Simulating {total_laps} laps with pit stops", expanded=True) as status:
                    st.write("Running lap-by-lap tyre degradation & fuel burn")
                    res = simulate_race_strategy(TRACK, race_car, stint_inputs, total_laps,
                                                 step=8.0, track_name=track_name)
                    status.update(label="RACE SIMULATION COMPLETE", state="complete", expanded=False)

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
                    hovertemplate="<b>Lap %{x}</b> · %{y:.2f}s<extra></extra>"))
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

    # ---- optimiser ----
    with opt_tab:
        _sync_race_laps("opt_laps_inp")
        with st.container(border=True):
            o1, o2, o3 = st.columns(3)
            with o1:
                opt_laps = st.number_input(
                    "Total Race Laps", 5, 90, step=1, key="opt_laps_inp",
                    help=f"Synced to the {track_name} GP distance — adjust as needed.")
            with o2:
                include_2stop = st.checkbox("Include 2-stop strategies", value=True)
            with o3:
                opt_step = st.select_slider(
                    "Solver Resolution", options=[15.0, 25.0, 40.0], value=25.0,
                    format_func=lambda x: f"{x:.0f} m · {'Precise' if x <= 15 else ('Balanced' if x == 25 else 'Fast')}")

        n_plans = len(generate_1stop_plans(opt_laps))
        if include_2stop:
            n_plans += len(generate_2stop_plans(opt_laps))
        gp_laps = race_laps(track_name)
        laps_chip = (f"{opt_laps} LAPS" if opt_laps == gp_laps
                     else f"{opt_laps} LAPS ({opt_laps - gp_laps:+d} vs GP)")
        theme.chips([f"{n_plans} CANDIDATE STRATEGIES", (track_name.upper(), True),
                     (laps_chip, opt_laps != gp_laps), f"{gp_laps}-LAP GP DISTANCE"])
        st.caption("Brute-force search — the 'Fast' resolution is recommended for the hosted demo.")

        if st.button("🏁  EXECUTE OPTIMISER SEARCH", key="opt_run_btn"):
            with st.status(f"Evaluating {n_plans} candidate strategies", expanded=True) as status:
                st.write("Simulating every 1- and 2-stop compound permutation")
                t0 = time.time()
                results = find_best_strategy(TRACK, race_car, opt_laps, include_2stop=include_2stop,
                                             step=float(opt_step), verbose=False, track_name=track_name)
                calc_time = time.time() - t0
                status.update(label=f"OPTIMISED IN {calc_time:.1f}s · {len(results)} STRATEGIES",
                              state="complete", expanded=False)

            if results:
                best = results[0][0]
                theme.render_timing_tower(results, best, top_n=10)
                theme.section("Top 5 strategy timelines")
                for rank, (t_strat, plan) in enumerate(results[:5]):
                    st.markdown(f"**P{rank+1} · {theme.format_time_local(t_strat)}**  (+{t_strat - best:.2f}s)")
                    theme.render_stint_timeline(plan, opt_laps,
                                                delta_vs=(t_strat - best) if rank else None)
            else:
                st.warning("No valid strategies for these parameters — try more race laps.")


# ===========================================================================
# TRACK MAP
# ===========================================================================
elif view == "TRACK MAP":
    theme.render_f1_header(track_name, LAP_LENGTH, car_label, air_density=car.rho)
    theme.section("Circuit Speed Heatmap & GPS Replay",
                  "Reconstructed circuit geometry with a simulated speed heatmap and a client-side lap replay.")

    map_view = st.radio("Display Mode",
                        ["High-Definition Speed Heatmap", "Animated Lap Replay"], horizontal=True)

    if st.button("🗺  GENERATE CIRCUIT MAP", key="map_run_btn"):
        with st.status(f"Reconstructing {track_name.upper()} geometry & speed contour", expanded=True) as status:
            st.write("Walking the segment model into 2D coordinates")
            map_data = build_lap_map_data(TRACK, car, step=5.0)
            st.write("Mapping simulated speed onto the racing line")
            if map_view == "High-Definition Speed Heatmap":
                fig_map = build_static_map_figure(map_data, title=f"{track_name.upper()} · SPEED HEATMAP")
            else:
                fig_map = build_animated_map_figure(map_data, title=f"{track_name.upper()} · LAP REPLAY")
            status.update(label="CIRCUIT MAP READY", state="complete", expanded=False)
        st.plotly_chart(fig_map, config=CFG, width="stretch")
    else:
        st.info("Generate the map to render the circuit's speed-coloured GPS trace.")
