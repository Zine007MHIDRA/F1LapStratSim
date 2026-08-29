"""
map_viz.py

Combines track_geometry (2D shape) with lap_sim (speed at each point) to
build a top-down, speed-colored track map, plus an animated marker showing
the car's position as it completes a lap -- the "watch it do the lap"
visualization.
"""

import numpy as np
import plotly.graph_objects as go

from track_geometry import compute_track_xy
from lap_sim import simulate_lap
from theme import COLORS, FONT_MONO, FONT_DISPLAY, FONT_TECH


def build_lap_map_data(segments, car, step: float = 5.0):
    """Runs both the geometry and physics on the same distance axis so
    every index lines up: map_data['x'][i] / ['y'][i] / ['v'][i] all refer
    to the same point on track."""
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
        "lap_time": lap["lap_time"],
        # elapsed_time[i] is the simulated time at point i. dt_arr includes
        # the closing edge from the final sample back to start/finish.
        "elapsed_time": np.concatenate(([0.0], np.cumsum(lap["dt_arr"][:-1])))[:n],
        "correction_factor": geo["correction_factor"],
    }


def _marker_angle_deg(heading_rad):
    """Converts our math heading (radians, CCW from +x axis) to the
    clockwise-from-upright rotation Plotly's marker.angle expects."""
    return (90.0 - np.degrees(heading_rad)) % 360.0


def _direction_arrow_trace(map_data, n_arrows: int = 10):
    """Direction arrows showing the racing line travel direction."""
    n = len(map_data["x"])
    idx = np.linspace(0, n - 1, n_arrows, endpoint=False).astype(int)
    angles = [_marker_angle_deg(map_data["heading"][i]) for i in idx]
    return go.Scatter(
        x=map_data["x"][idx], y=map_data["y"][idx],
        mode="markers",
        marker=dict(symbol="triangle-up", size=14, color=COLORS["cyan"],
                    angle=angles, line=dict(width=1.5, color=COLORS["bg"])),
        showlegend=False, hoverinfo="skip",
    )


def build_static_map_figure(map_data, title="Track Speed Map", downsample_to: int = 600):
    """High-definition Speed-colored track map with neon heatmap & Start/Finish marker."""
    n = len(map_data["x"])
    idx = np.linspace(0, n - 1, min(downsample_to, n)).astype(int)

    fig = go.Figure()
    
    # Outer ambient glow line
    fig.add_trace(go.Scatter(
        x=map_data["x"][idx], y=map_data["y"][idx],
        mode="lines", line=dict(color="rgba(0, 229, 255, 0.15)", width=12),
        showlegend=False, hoverinfo="skip",
    ))
    
    # Base track contour
    fig.add_trace(go.Scatter(
        x=map_data["x"][idx], y=map_data["y"][idx],
        mode="lines", line=dict(color=COLORS["border_highlight"], width=3),
        showlegend=False, hoverinfo="skip",
    ))
    
    # Speed heatmap markers
    fig.add_trace(go.Scatter(
        x=map_data["x"][idx], y=map_data["y"][idx],
        mode="markers",
        marker=dict(
            size=8, color=map_data["v_kmh"][idx],
            colorscale="Plasma", showscale=True,
            colorbar=dict(
                title=dict(text="SPEED (KM/H)", font=dict(family=FONT_TECH, size=12, color=COLORS["text"])),
                tickfont=dict(family=FONT_MONO, size=10, color=COLORS["text_muted"]),
                outlinecolor=COLORS["border"],
                outlinewidth=1,
                bgcolor="rgba(20, 26, 36, 0.8)",
                thickness=16,
                len=0.75,
            ),
        ),
        text=[f"Position: {map_data['s'][i]:.0f}m<br>Speed: {map_data['v_kmh'][i]:.1f} km/h" for i in idx],
        hovertemplate="<b>%{text}</b><extra></extra>",
        showlegend=False,
    ))
    
    # Start / Finish line marker
    fig.add_trace(go.Scatter(
        x=[map_data["x"][0]], y=[map_data["y"][0]],
        mode="markers+text",
        marker=dict(symbol="star", size=18, color=COLORS["positive"],
                    line=dict(width=2, color="#FFFFFF")),
        text=["🏁 START/FINISH"],
        textposition="top center",
        textfont=dict(family=FONT_TECH, size=12, color=COLORS["positive"]),
        showlegend=False,
        name="Start/Finish",
    ))
    
    # Direction arrows
    fig.add_trace(_direction_arrow_trace(map_data))
    
    fig.update_layout(
        title=dict(text=title, font=dict(family=FONT_DISPLAY, color="#FFFFFF", size=16)),
        xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
        yaxis=dict(visible=False),
        height=620,
        paper_bgcolor="rgba(16, 21, 30, 0.8)",
        plot_bgcolor="rgba(12, 16, 24, 0.9)",
        font=dict(family=FONT_MONO, color=COLORS["text_muted"]),
        margin=dict(t=50, b=20, l=20, r=20),
    )
    return fig


def build_animated_map_figure(map_data, title="Lap Replay Telemetry", n_frames: int = 160):
    """Client-side animated lap replay with high-contrast car tracker and dynamic HUD readout."""
    n = len(map_data["x"])
    static_idx = np.linspace(0, n - 1, min(500, n)).astype(int)
    # Sample uniformly in simulated time rather than uniformly in distance,
    # so the marker visibly slows for corners and accelerates on straights.
    elapsed = map_data["elapsed_time"]
    target_times = np.linspace(0.0, elapsed[-1], min(n_frames, n))
    frame_idx = np.searchsorted(elapsed, target_times, side="left")
    frame_idx = np.clip(frame_idx, 0, n - 1)

    car_angle_0 = _marker_angle_deg(map_data["heading"][0])
    base_traces = [
        # Ambient track glow
        go.Scatter(x=map_data["x"][static_idx], y=map_data["y"][static_idx],
                    mode="lines", line=dict(color="rgba(0, 229, 255, 0.15)", width=10),
                    showlegend=False, hoverinfo="skip"),
        # Thin background line
        go.Scatter(x=map_data["x"][static_idx], y=map_data["y"][static_idx],
                    mode="lines", line=dict(color=COLORS["border_highlight"], width=2.5),
                    showlegend=False, hoverinfo="skip"),
        # Speed dots
        go.Scatter(x=map_data["x"][static_idx], y=map_data["y"][static_idx],
                    mode="markers",
                    marker=dict(size=6, color=map_data["v_kmh"][static_idx],
                                colorscale="Plasma", showscale=True,
                                colorbar=dict(
                                    title=dict(text="KM/H", font=dict(family=FONT_TECH, size=11, color=COLORS["text"])),
                                    tickfont=dict(family=FONT_MONO, size=10, color=COLORS["text_muted"]),
                                    bgcolor="rgba(20, 26, 36, 0.8)",
                                    thickness=14,
                                    len=0.7,
                                    x=1.1,
                                )),
                    showlegend=False, hoverinfo="skip"),
        _direction_arrow_trace(map_data),
        # Start/Finish line
        go.Scatter(
            x=[map_data["x"][0]], y=[map_data["y"][0]],
            mode="markers",
            marker=dict(symbol="star", size=14, color=COLORS["positive"]),
            showlegend=False, hoverinfo="skip",
        ),
        # Dynamic Animated Car Marker (Glowing Red / Amber F1 Arrow)
        go.Scatter(x=[map_data["x"][0]], y=[map_data["y"][0]],
                    mode="markers",
                    marker=dict(symbol="triangle-up", size=24, color=COLORS["f1_red"],
                                angle=car_angle_0, line=dict(width=2, color="#FFFFFF")),
                    name="Car", showlegend=False),
    ]

    frames = []
    for fi in frame_idx:
        t_at_frame = map_data["elapsed_time"][fi]
        car_angle = _marker_angle_deg(map_data["heading"][fi])
        cur_v = map_data["v_kmh"][fi]
        cur_s = map_data["s"][fi]
        
        frames.append(go.Frame(
            data=[go.Scatter(x=[map_data["x"][fi]], y=[map_data["y"][fi]],
                              marker=dict(angle=car_angle))],
            traces=[5],
            name=str(fi),
            layout=go.Layout(
                annotations=[dict(
                    text=(f"<span style='color:{COLORS['cyan']};font-size:1.3rem;font-weight:800;font-family:{FONT_MONO};'>{cur_v:.0f} KM/H</span><br>"
                          f"<span style='color:{COLORS['text_muted']};font-size:0.85rem;font-family:{FONT_MONO};'>T: {t_at_frame:.2f}s | POS: {cur_s:.0f}m</span>"),
                    x=0.03, y=0.96, xref="paper", yref="paper",
                    showarrow=False, align="left",
                    bgcolor="rgba(16, 21, 30, 0.85)",
                    bordercolor=COLORS["border"],
                    borderwidth=1,
                    borderpad=8,
                )]
            ),
        ))

    fig = go.Figure(data=base_traces, frames=frames)
    fig.update_layout(
        title=dict(text=title, font=dict(family=FONT_DISPLAY, color="#FFFFFF", size=16)),
        xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
        yaxis=dict(visible=False),
        height=660,
        paper_bgcolor="rgba(16, 21, 30, 0.8)",
        plot_bgcolor="rgba(12, 16, 24, 0.9)",
        font=dict(family=FONT_MONO, color=COLORS["text_muted"]),
        updatemenus=[dict(
            type="buttons", showactive=False,
            y=1.0, x=1.02, xanchor="left", yanchor="top",
            bgcolor="rgba(20, 26, 36, 0.9)", bordercolor=COLORS["border"],
            font=dict(family=FONT_TECH, color=COLORS["text"], size=12, weight=700),
            buttons=[
                dict(label="▶ PLAY REPLAY", method="animate",
                     args=[None, dict(frame=dict(duration=35, redraw=True),
                                       fromcurrent=True, transition=dict(duration=0))]),
                dict(label="⏸ PAUSE", method="animate",
                     args=[[None], dict(frame=dict(duration=0, redraw=False),
                                         mode="immediate")]),
            ],
        )],
        sliders=[dict(
            steps=[dict(method="animate",
                        args=[[str(fi)], dict(mode="immediate",
                                               frame=dict(duration=0, redraw=True))],
                        label="")
                   for fi in frame_idx],
            x=0, y=-0.02, len=1.0, currentvalue=dict(visible=False),
            bgcolor="rgba(20, 26, 36, 0.8)", bordercolor=COLORS["border"],
            activebgcolor=COLORS["f1_red"],
        )],
        margin=dict(t=50, b=30, l=20, r=20),
    )
    return fig
