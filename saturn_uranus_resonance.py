"""
Animate the Saturn-Uranus orbital resonance pattern (the "mandala matrix").

Over 1680 Earth years Saturn completes ~57 orbits while Uranus completes
~20 (the 57:20 resonance), and connecting the two planets with a line every
so often resolves into an incredibly detailed, ultra-dense mandala. Saves
an animated GIF.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# --- Metrics ---------------------------------------------------------------
SATURN_RADIUS = 9.58
URANUS_RADIUS = 19.22
SATURN_PERIOD = 10759.0  # days
URANUS_PERIOD = 30687.0  # days

# --- Timeframe -------------------------------------------------------------
EARTH_YEAR_DAYS = 365.25
TOTAL_YEARS = 1680
TOTAL_DAYS = TOTAL_YEARS * EARTH_YEAR_DAYS
FRAMES = 3000
LINE_EVERY = 15  # only draw a connecting chord every 15 frames (de-clutter)

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
ax.set_xlim(-21.0, 21.0)
ax.set_ylim(-21.0, 21.0)
ax.set_aspect("equal")
ax.axis("off")  # hide axis lines, ticks and frame

# Sun at the origin.
ax.plot(0, 0, "o", color="#ffd21e", markersize=16, zorder=1)

# Planet markers (updated each frame).
(saturn_dot,) = ax.plot([], [], "o", color="#f5e7a3", markersize=9, zorder=3)   # pale yellow
(uranus_dot,) = ax.plot([], [], "o", color="#a3d8f0", markersize=10, zorder=3)  # light blue


def init():
    saturn_dot.set_data([], [])
    uranus_dot.set_data([], [])
    return saturn_dot, uranus_dot


def update(frame):
    t = times[frame]
    sx, sy = position(SATURN_RADIUS, SATURN_PERIOD, t)
    ux, uy = position(URANUS_RADIUS, URANUS_PERIOD, t)

    saturn_dot.set_data([sx], [sy])
    uranus_dot.set_data([ux], [uy])

    # Only add a persistent connecting chord every LINE_EVERY frames, kept
    # ultra-thin and very faint so the dense overlapping mandala matrix
    # resolves cleanly instead of filling into a solid disc.
    if frame % LINE_EVERY == 0:
        ax.plot([sx, ux], [sy, uy], color="#c8d0dc", linewidth=0.4, alpha=0.1, zorder=2)

    return saturn_dot, uranus_dot


anim = FuncAnimation(fig, update, frames=FRAMES, init_func=init, interval=20, blit=False)

anim.save("saturn_uranus_mandala.gif", writer="pillow", fps=50)
print("Saved saturn_uranus_mandala.gif")
