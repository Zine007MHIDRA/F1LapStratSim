"""
map_viz.py

Combines track_geometry (2D shape) with lap_sim (speed at each point) to
build a top-down, speed-colored track map, plus an animated marker showing
the car's position as it completes a lap -- the "watch it do the lap"
visualization.

CAVEAT (repeated from track_geometry.py because it matters here specifically):
the path shown is the single line implied by each corner's assumed radius in
the physics model, not a true track-width-aware racing line optimization.
Real racing lines use the FULL width of the track (straightening the corner
by using the outside kerb on entry/exit and clipping the apex) to maximize
effective corner radius. Our model already assumes a "reasonable" radius per
corner (tighter than the track's painted edges, representing a competent
line) but doesn't compute or draw an alternative to compare against. Adding
true racing-line optimization would need track width boundaries and a
curvature-minimization solve -- noted as a roadmap item.
"""

import numpy as np
import plotly.graph_objects as go

from track_geometry import compute_track_xy
from lap_sim import simulate_lap


def build_lap_map_data(segments, car, step: float = 5.0):
    """Runs both the geometry and physics on the same distance axis so
    every index lines up: map_data['x'][i] / ['y'][i] / ['v'][i] all refer
    to the same point on track."""
    geo = compute_track_xy(segments, step=step)
    lap = simulate_lap(segments, car, step=step)

    # both built from the same build_distance_axis(segments, step) call
    # internally, so their distance arrays match in length and position
    n = min(len(geo["x"]), len(lap["v_profile"]))
    return {
        "s": geo["s"][:n],
        "x": geo["x"][:n],
        "y": geo["y"][:n],
        "v_kmh": lap["v_profile"][:n] * 3.6,
        "seg_idx": geo["seg_idx"][:n],
        "lap_time": lap["lap_time"],
        "correction_factor": geo["correction_factor"],
    }


def build_static_map_figure(map_data, title="Track map", downsample_to: int = 500):
    """Speed-colored track outline (no animation) -- markers packed close
    together to read as a continuous colored line, common in real telemetry
    tools' 'speed map' views."""
    n = len(map_data["x"])
    idx = np.linspace(0, n - 1, min(downsample_to, n)).astype(int)

    fig = go.Figure()
    # thin gray line underneath for continuity between colored dots
    fig.add_trace(go.Scatter(
        x=map_data["x"][idx], y=map_data["y"][idx],
        mode="lines", line=dict(color="lightgray", width=2),
        showlegend=False, hoverinfo="skip",
    ))
    fig.add_trace(go.Scatter(
        x=map_data["x"][idx], y=map_data["y"][idx],
        mode="markers",
        marker=dict(
            size=7, color=map_data["v_kmh"][idx],
            colorscale="Turbo", showscale=True,
            colorbar=dict(title="km/h"),
        ),
        text=[f"{v:.0f} km/h" for v in map_data["v_kmh"][idx]],
        hovertemplate="%{text}<extra></extra>",
        showlegend=False,
    ))
    fig.update_layout(
        title=title,
        xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
        yaxis=dict(visible=False),
        height=600,
        plot_bgcolor="white",
    )
    return fig


def build_animated_map_figure(map_data, title="Lap replay", n_frames: int = 150):
    """Same speed-colored track, plus a car marker that animates around the
    lap via Plotly's built-in play/pause frames -- runs entirely client-side
    once loaded."""
    n = len(map_data["x"])
    static_idx = np.linspace(0, n - 1, min(500, n)).astype(int)
    frame_idx = np.linspace(0, n - 1, min(n_frames, n)).astype(int)

    base_traces = [
        go.Scatter(x=map_data["x"][static_idx], y=map_data["y"][static_idx],
                    mode="lines", line=dict(color="lightgray", width=2),
                    showlegend=False, hoverinfo="skip"),
        go.Scatter(x=map_data["x"][static_idx], y=map_data["y"][static_idx],
                    mode="markers",
                    marker=dict(size=6, color=map_data["v_kmh"][static_idx],
                                colorscale="Turbo", showscale=True,
                                colorbar=dict(title="km/h", x=1.15)),
                    showlegend=False, hoverinfo="skip"),
        go.Scatter(x=[map_data["x"][0]], y=[map_data["y"][0]],
                    mode="markers", marker=dict(size=16, color="black", symbol="circle"),
                    name="Car", showlegend=False),
    ]

    frames = []
    for fi in frame_idx:
        t_at_frame = map_data["lap_time"] * (map_data["s"][fi] / map_data["s"][-1])
        frames.append(go.Frame(
            data=[go.Scatter(x=[map_data["x"][fi]], y=[map_data["y"][fi]])],
            traces=[2],
            name=str(fi),
            layout=go.Layout(
                annotations=[dict(
                    text=f"{map_data['v_kmh'][fi]:.0f} km/h &nbsp;|&nbsp; t={t_at_frame:.1f}s",
                    x=0.02, y=0.98, xref="paper", yref="paper",
                    showarrow=False, font=dict(size=16),
                )]
            ),
        ))

    fig = go.Figure(data=base_traces, frames=frames)
    fig.update_layout(
        title=title,
        xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
        yaxis=dict(visible=False),
        height=650,
        plot_bgcolor="white",
        updatemenus=[dict(
            type="buttons", showactive=False,
            y=1, x=1.05, xanchor="left", yanchor="top",
            buttons=[
                dict(label="▶ Play", method="animate",
                     args=[None, dict(frame=dict(duration=40, redraw=True),
                                       fromcurrent=True, transition=dict(duration=0))]),
                dict(label="⏸ Pause", method="animate",
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
            x=0, y=0, len=1.0, currentvalue=dict(visible=False),
        )],
    )
    return fig
