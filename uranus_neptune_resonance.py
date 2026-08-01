"""
Animate the Uranus-Neptune orbital resonance pattern.

Over 500 Earth years the pair moves through their near-2:1 alignment cycle,
and connecting the two planets with a line every so often traces a sharp
3-pointed star. Saves an animated GIF.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# --- Metrics ---------------------------------------------------------------
URANUS_RADIUS = 19.22
NEPTUNE_RADIUS = 30.05
URANUS_PERIOD = 30687.0   # days
NEPTUNE_PERIOD = 60190.0  # days

# --- Timeframe -------------------------------------------------------------
EARTH_YEAR_DAYS = 365.25
TOTAL_YEARS = 500
TOTAL_DAYS = TOTAL_YEARS * EARTH_YEAR_DAYS
FRAMES = 2000
LINE_EVERY = 10  # only draw a connecting chord every 10 frames (de-clutter)

# Simulated time (days) at each frame.
times = np.linspace(0.0, TOTAL_DAYS, FRAMES)


def position(radius, period, t_days):
    """Current (x, y) of a planet on a circular orbit at time t (days)."""
    angle = 2.0 * np.pi * t_days / period
    return radius * np.cos(angle), radius * np.sin(angle)


# --- Environment -----------------------------------------------------------
plt.style.use("dark_background")
fig, ax = plt.subplots(figsize=(6, 6))
fig.patch.set_facecolor("black")
ax.set_facecolor("black")
ax.set_xlim(-32.0, 32.0)
ax.set_ylim(-32.0, 32.0)
ax.set_aspect("equal")
ax.axis("off")  # hide axis lines, ticks and frame

# Sun at the origin.
ax.plot(0, 0, "o", color="#ffd21e", markersize=15, zorder=1)

# Planet markers (updated each frame).
(uranus_dot,) = ax.plot([], [], "o", color="#7fffd4", markersize=9, zorder=3)   # aquamarine
(neptune_dot,) = ax.plot([], [], "o", color="#3a3af0", markersize=10, zorder=3)  # deep indigo blue


def init():
    uranus_dot.set_data([], [])
    neptune_dot.set_data([], [])
    return uranus_dot, neptune_dot


def update(frame):
    t = times[frame]
    ux, uy = position(URANUS_RADIUS, URANUS_PERIOD, t)
    nx, ny = position(NEPTUNE_RADIUS, NEPTUNE_PERIOD, t)

    uranus_dot.set_data([ux], [uy])
    neptune_dot.set_data([nx], [ny])

    # Only add a persistent connecting chord every LINE_EVERY frames so the
    # sharp 3-pointed star resolves cleanly rather than filling in.
    if frame % LINE_EVERY == 0:
        ax.plot([ux, nx], [uy, ny], color="#00f0ff", linewidth=0.5, alpha=0.18, zorder=2)

    return uranus_dot, neptune_dot


anim = FuncAnimation(fig, update, frames=FRAMES, init_func=init, interval=20, blit=False)

anim.save("uranus_neptune_star.gif", writer="pillow", fps=50)
print("Saved uranus_neptune_star.gif")
