"""
track_geometry.py

Converts a track's segment list (from track_model.py) into 2D (x, y)
coordinates, so we can draw a top-down map and place the car on it.

Approach ("turtle graphics"): walk along the track integrating heading and
position:
  heading += (ds / radius) * direction
  x += ds * cos(heading)
  y += ds * sin(heading)

Real circuits are closed loops, so total heading change over one lap must be
exactly +-360 degrees (a topological fact for any simple closed loop) --
our hand-estimated corner angles won't always land exactly there, so we
apply a single proportional correction factor to all corner curvature so the
drawn track forms a closed loop instead of visibly drifting apart at the
start/finish line.

IMPORTANT CAVEAT: this correction is for VISUALIZATION ONLY. It does not
feed back into the physics (lap_sim uses the segment radii directly,
unaffected by this module). If the correction factor is large, the drawn
map's corners will look tighter/looser than their physics radius actually
implies -- treat the resulting shape as a recognizable schematic, not a
survey-accurate track map.
"""

import numpy as np
from track_model import build_distance_axis


def compute_track_xy(segments, step: float = 5.0):
    """
    Returns dict with:
      s            - distance array (m)
      x, y         - 2D coordinates (meters, arbitrary origin/orientation)
      heading      - heading angle (radians) at each point
      seg_idx      - segment index per point
      correction_factor - how much corner curvature was scaled to close the loop
                           (1.0 = no correction needed; far from 1.0 = the hand-built
                           corner angles didn't naturally sum to 360 degrees)
    """
    s, radius, seg_idx = build_distance_axis(segments, step=step)
    n = len(s)
    ds_arr = np.diff(s, append=s[-1] + step)

    direction = np.array([segments[idx].direction if segments[idx].kind == "corner" else 0
                           for idx in seg_idx])
    safe_radius = np.where(np.isinf(radius), 1.0, radius)
    raw_dtheta = np.where(np.isinf(radius), 0.0, (ds_arr / safe_radius) * direction)

    raw_total_turn = raw_dtheta.sum()
    target_total_turn = np.sign(raw_total_turn) * 2 * np.pi if raw_total_turn != 0 else 2 * np.pi
    correction_factor = target_total_turn / raw_total_turn if abs(raw_total_turn) > 1e-9 else 1.0

    dtheta = raw_dtheta * correction_factor

    # heading BEFORE each step (so the first point starts at heading=0)
    heading = np.concatenate(([0.0], np.cumsum(dtheta)[:-1]))

    dx = ds_arr * np.cos(heading)
    dy = ds_arr * np.sin(heading)
    x = np.concatenate(([0.0], np.cumsum(dx)[:-1]))
    y = np.concatenate(([0.0], np.cumsum(dy)[:-1]))

    # Position closure correction: matching total heading change doesn't
    # guarantee the path returns to its start point (a spiral can have the
    # same property). Distribute the start/end gap smoothly across the lap
    # (linear ramp by distance fraction) -- a standard surveying "closing
    # error" adjustment, so the drawn track forms a clean closed loop
    # instead of visibly not meeting itself at the start/finish line.
    total_length = s[-1] + step
    gap_x = x[-1] + ds_arr[-1] * np.cos(heading[-1]) - x[0]
    gap_y = y[-1] + ds_arr[-1] * np.sin(heading[-1]) - y[0]
    frac = s / total_length
    x = x - gap_x * frac
    y = y - gap_y * frac

    return {
        "s": s, "x": x, "y": y, "heading": heading,
        "seg_idx": seg_idx, "correction_factor": correction_factor,
    }


if __name__ == "__main__":
    import matplotlib.pyplot as plt
    from track_model import TRACKS

    fig, axes = plt.subplots(1, len(TRACKS), figsize=(7 * len(TRACKS), 7))
    if len(TRACKS) == 1:
        axes = [axes]

    for ax, (name, segs) in zip(axes, TRACKS.items()):
        geo = compute_track_xy(segs, step=5.0)
        ax.plot(geo["x"], geo["y"], linewidth=2)
        ax.plot(geo["x"][0], geo["y"][0], 'go', markersize=10, label="Start/Finish")
        ax.set_title(f"{name} (correction factor: {geo['correction_factor']:.2f}x)")
        ax.set_aspect("equal")
        ax.legend()
        print(f"{name}: correction factor = {geo['correction_factor']:.3f}, "
              f"start-end gap before correction would have been large if != ~1.0")
        # closure check: distance between first and last point
        gap = np.hypot(geo["x"][-1] - geo["x"][0], geo["y"][-1] - geo["y"][0])
        print(f"  Start/end point gap: {gap:.1f} m (should be small vs {segs and 'lap length'})")

    plt.tight_layout()
    plt.savefig("track_shapes_test.png", dpi=120)
    print("\nSaved track_shapes_test.png")
