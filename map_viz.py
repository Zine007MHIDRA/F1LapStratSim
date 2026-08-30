"""
map_viz.py

Top-down circuit visualisation for the Pit-Wall console.

Combines track_geometry (2D shape) with lap_sim (speed at each point) to
render:
  * a neon speed-heatmap track map with corner numbering, apex markers and
    DRS / active-aero straight highlights
  * a client-side animated GPS lap replay with a glowing car tracker and a
    live speed / delta HUD

Both figures share the `f1_pitwall` Plotly theme registered in theme.py.
"""

import numpy as np
import plotly.graph_objects as go

from track_geometry import compute_track_xy
from lap_sim import simulate_lap, DRS_MIN_STRAIGHT_M
from theme import (
    COLORS, FONT_MONO, FONT_DISPLAY, FONT_TECH,
    themed_layout_kwargs, plotly_config,  # noqa: F401  (re-exported for callers)
)

# Slow -> fast speed ramp (deep violet -> cyan -> green -> amber -> race red),
# mirroring how broadcast speed maps read at a glance.
SPEED_SCALE = [
    [0.00, "#3A0CA3"],
    [0.30, "#4361EE"],
    [0.50, COLORS["cyan"]],
    [0.68, COLORS["positive"]],
    [0.84, COLORS["amber"]],
    [1.00, COLORS["f1_red"]],
]


# ---------------------------------------------------------------------------
# Data assembly
# ---------------------------------------------------------------------------

def build_lap_map_data(segments, car, step: float = 5.0):
    """Runs geometry + physics on one shared distance axis so every index
    lines up: x[i] / y[i] / v_kmh[i] all describe the same point on track."""
    geo = compute_track_xy(segments, step=step)
    lap = simulate_lap(segments, car, step=step)

    n = min(len(geo["x"]), len(lap["v_profile"]))
    return {
        "s": geo["s"][:n],
        "x": geo["x"][:n],
        "y": geo["y"][:n],
        "heading": geo["heading"][:n],
        "v_kmh": lap["v_profile"][:n] * 3.6,
        "seg_idx": geo["seg_idx"][:n],
        "segments": segments,
        "lap_time": lap["lap_time"],
        "elapsed_time": np.concatenate(([0.0], np.cumsum(lap["dt_arr"][:-1])))[:n],
        "correction_factor": geo["correction_factor"],
    }


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _marker_angle_deg(heading_rad):
    """Math heading (rad, CCW from +x) -> Plotly marker.angle (CW from upright)."""
    return (90.0 - np.degrees(heading_rad)) % 360.0


def _direction_arrows(map_data, n_arrows: int = 12):
    n = len(map_data["x"])
    idx = np.linspace(0, n - 1, n_arrows, endpoint=False).astype(int)
    angles = [_marker_angle_deg(map_data["heading"][i]) for i in idx]
    return go.Scatter(
        x=map_data["x"][idx], y=map_data["y"][idx], mode="markers",
        marker=dict(symbol="triangle-up", size=11, color="rgba(255,255,255,0.55)",
                    angle=angles, line=dict(width=1, color=COLORS["bg"])),
        showlegend=False, hoverinfo="skip",
    )


def _corner_labels(map_data):
    """One numbered label at the centroid of each corner segment, pushed
    slightly outward from the racing line."""
    segments = map_data["segments"]
    seg_idx = map_data["seg_idx"]
    x, y = map_data["x"], map_data["y"]
    cx, cy = x.mean(), y.mean()

    lx, ly, lt = [], [], []
    turn = 0
    for i, seg in enumerate(segments):
        if seg.kind != "corner":
            continue
        turn += 1
        mask = seg_idx == i
        if not np.any(mask):
            continue
        mxs, mys = x[mask].mean(), y[mask].mean()
        vx, vy = mxs - cx, mys - cy
        norm = np.hypot(vx, vy) or 1.0
        lx.append(mxs + vx / norm * 55.0)
        ly.append(mys + vy / norm * 55.0)
        lt.append(f"T{turn}")

    return go.Scatter(
        x=lx, y=ly, mode="text", text=lt,
        textfont=dict(family=FONT_TECH, size=11, color=COLORS["text_muted"]),
        showlegend=False, hoverinfo="skip",
    )


def _drs_overlay(map_data):
    """Highlight straights long enough to carry a DRS / X-mode zone."""
    segments = map_data["segments"]
    seg_idx = map_data["seg_idx"]
    drs_mask = np.array([
        segments[i].kind == "straight" and segments[i].length >= DRS_MIN_STRAIGHT_M
        for i in seg_idx
    ])
    xs = np.where(drs_mask, map_data["x"], np.nan)
    ys = np.where(drs_mask, map_data["y"], np.nan)
    return go.Scatter(
        x=xs, y=ys, mode="lines",
        line=dict(color="rgba(0,230,118,0.55)", width=7),
        name="DRS / X-mode zone", hoverinfo="skip",
    )


def _track_base_traces(map_data, idx, glow_width=13):
    """Layered neon track ribbon: outer glow -> mid halo -> dark core."""
    x, y = map_data["x"][idx], map_data["y"][idx]
    return [
        go.Scatter(x=x, y=y, mode="lines", showlegend=False, hoverinfo="skip",
                   line=dict(color="rgba(0,240,255,0.10)", width=glow_width + 10)),
        go.Scatter(x=x, y=y, mode="lines", showlegend=False, hoverinfo="skip",
                   line=dict(color="rgba(0,240,255,0.18)", width=glow_width)),
        go.Scatter(x=x, y=y, mode="lines", showlegend=False, hoverinfo="skip",
                   line=dict(color="#0C1018", width=4)),
    ]


def _start_finish_marker(map_data, size=16):
    return go.Scatter(
        x=[map_data["x"][0]], y=[map_data["y"][0]], mode="markers+text",
        marker=dict(symbol="square", size=size, color=COLORS["positive"],
                    line=dict(width=2, color="#fff")),
        text=["  S/F"], textposition="middle right",
        textfont=dict(family=FONT_TECH, size=12, color=COLORS["positive"]),
        name="Start / Finish", showlegend=False, hoverinfo="skip",
    )


def _map_layout(title, height):
    kw = themed_layout_kwargs(height=height, transparent=True, unified_hover=False)
    kw.update(
        title=dict(text=title, font=dict(family=FONT_DISPLAY, color="#FFFFFF", size=16),
                   x=0.012, xanchor="left"),
        xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
        yaxis=dict(visible=False),
        margin=dict(t=52, b=26, l=20, r=20),
        legend=dict(orientation="h", yanchor="bottom", y=-0.04, xanchor="left", x=0,
                    bgcolor="rgba(0,0,0,0)", font=dict(family=FONT_TECH, size=10,
                                                       color=COLORS["text_muted"])),
        plot_bgcolor="rgba(9,12,18,0.55)",
    )
    return kw


# ---------------------------------------------------------------------------
# Static speed heatmap
# ---------------------------------------------------------------------------

def build_static_map_figure(map_data, title="Track Speed Map", downsample_to: int = 700):
    n = len(map_data["x"])
    idx = np.linspace(0, n - 1, min(downsample_to, n)).astype(int)

    fig = go.Figure()
    for tr in _track_base_traces(map_data, idx):
        fig.add_trace(tr)
    fig.add_trace(_drs_overlay(map_data))

    fig.add_trace(go.Scatter(
        x=map_data["x"][idx], y=map_data["y"][idx], mode="markers",
        marker=dict(
            size=7, color=map_data["v_kmh"][idx], colorscale=SPEED_SCALE,
            showscale=True, line=dict(width=0),
            colorbar=dict(
                title=dict(text="SPEED<br>KM/H", font=dict(family=FONT_TECH, size=11, color=COLORS["text"])),
                tickfont=dict(family=FONT_MONO, size=10, color=COLORS["text_muted"]),
                outlinecolor=COLORS["border_solid"], outlinewidth=1,
                bgcolor="rgba(11,14,20,0.7)", thickness=14, len=0.72, x=1.01,
            ),
        ),
        customdata=map_data["s"][idx],
        hovertemplate="<b>%{customdata:.0f} m</b> &bull; %{marker.color:.0f} km/h<extra></extra>",
        showlegend=False,
    ))

    fig.add_trace(_corner_labels(map_data))
    fig.add_trace(_direction_arrows(map_data))
    fig.add_trace(_start_finish_marker(map_data))

    fig.update_layout(**_map_layout(title, height=640))
    return fig


# ---------------------------------------------------------------------------
# Animated GPS lap replay
# ---------------------------------------------------------------------------

def build_animated_map_figure(map_data, title="Lap Replay Telemetry", n_frames: int = 180):
    n = len(map_data["x"])
    static_idx = np.linspace(0, n - 1, min(560, n)).astype(int)

    # Sample frames uniformly in simulated TIME so the marker visibly slows
    # for corners and surges on the straights.
    elapsed = map_data["elapsed_time"]
    target_times = np.linspace(0.0, elapsed[-1], min(n_frames, n))
    frame_idx = np.clip(np.searchsorted(elapsed, target_times, side="left"), 0, n - 1)

    ang0 = _marker_angle_deg(map_data["heading"][0])
    base = _track_base_traces(map_data, static_idx, glow_width=10)
    base += [
        go.Scatter(
            x=map_data["x"][static_idx], y=map_data["y"][static_idx], mode="markers",
            marker=dict(size=5, color=map_data["v_kmh"][static_idx], colorscale=SPEED_SCALE,
                        showscale=True, line=dict(width=0),
                        colorbar=dict(
                            title=dict(text="KM/H", font=dict(family=FONT_TECH, size=10, color=COLORS["text"])),
                            tickfont=dict(family=FONT_MONO, size=9, color=COLORS["text_muted"]),
                            bgcolor="rgba(11,14,20,0.7)", thickness=12, len=0.66, x=1.01,
                            outlinecolor=COLORS["border_solid"], outlinewidth=1)),
            showlegend=False, hoverinfo="skip"),
        _corner_labels(map_data),
        _direction_arrows(map_data),
        _start_finish_marker(map_data, size=13),
        # car halo
        go.Scatter(x=[map_data["x"][0]], y=[map_data["y"][0]], mode="markers",
                   marker=dict(symbol="circle", size=26, color="rgba(255,24,1,0.28)"),
                   showlegend=False, hoverinfo="skip"),
        # car
        go.Scatter(x=[map_data["x"][0]], y=[map_data["y"][0]], mode="markers",
                   marker=dict(symbol="triangle-up", size=17, color=COLORS["f1_red"],
                               angle=ang0, line=dict(width=2, color="#fff")),
                   name="Car", showlegend=False, hoverinfo="skip"),
    ]
    halo_i, car_i = len(base) - 2, len(base) - 1

    v_max = float(np.max(map_data["v_kmh"])) or 1.0
    frames = []
    for fi in frame_idx:
        cur_v = map_data["v_kmh"][fi]
        cur_s = map_data["s"][fi]
        t_at = map_data["elapsed_time"][fi]
        ang = _marker_angle_deg(map_data["heading"][fi])
        bar = "&#9608;" * int(round(cur_v / v_max * 16))
        frames.append(go.Frame(
            name=str(fi),
            data=[
                go.Scatter(x=[map_data["x"][fi]], y=[map_data["y"][fi]]),
                go.Scatter(x=[map_data["x"][fi]], y=[map_data["y"][fi]],
                           marker=dict(angle=ang)),
            ],
            traces=[halo_i, car_i],
            layout=go.Layout(annotations=[dict(
                text=(f"<span style='color:{COLORS['cyan']};font-size:1.35rem;font-weight:800;"
                      f"font-family:{FONT_MONO};'>{cur_v:5.0f} KM/H</span><br>"
                      f"<span style='color:{COLORS['amber']};font-family:{FONT_MONO};font-size:0.8rem;'>{bar}</span><br>"
                      f"<span style='color:{COLORS['text_muted']};font-size:0.8rem;font-family:{FONT_MONO};'>"
                      f"T {t_at:6.2f}s &bull; POS {cur_s:5.0f} m</span>"),
                x=0.02, y=0.97, xref="paper", yref="paper", showarrow=False, align="left",
                bgcolor="rgba(9,12,18,0.86)", bordercolor=COLORS["border_solid"],
                borderwidth=1, borderpad=9,
            )]),
        ))

    fig = go.Figure(data=base, frames=frames)
    fig.update_layout(**_map_layout(title, height=680))
    fig.update_layout(
        updatemenus=[dict(
            type="buttons", showactive=False, direction="right",
            y=1.0, x=1.0, xanchor="right", yanchor="top", pad=dict(r=4, t=4),
            bgcolor="rgba(11,14,20,0.9)", bordercolor=COLORS["border_solid"],
            font=dict(family=FONT_TECH, color=COLORS["text"], size=11),
            buttons=[
                dict(label="&#9654; PLAY", method="animate",
                     args=[None, dict(frame=dict(duration=32, redraw=True),
                                      fromcurrent=True, transition=dict(duration=0))]),
                dict(label="&#9208; PAUSE", method="animate",
                     args=[[None], dict(frame=dict(duration=0, redraw=False), mode="immediate")]),
            ],
        )],
        sliders=[dict(
            steps=[dict(method="animate", label="",
                        args=[[str(fi)], dict(mode="immediate",
                                              frame=dict(duration=0, redraw=True))])
                   for fi in frame_idx],
            x=0, y=-0.02, len=1.0, currentvalue=dict(visible=False),
            bgcolor="rgba(11,14,20,0.8)", bordercolor=COLORS["border_solid"],
            activebgcolor=COLORS["f1_red"], transition=dict(duration=0),
        )],
    )
    return fig
