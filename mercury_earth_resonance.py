"""
Animate the Mercury-Earth orbital resonance pattern (the "sunburst").

Over 4 Earth years Mercury wraps around ~16.6 times while Earth completes
4 orbits, and connecting the two planets with a line every so often maps
out an intricate, multi-layered sunburst. Saves an animated GIF.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# --- Metrics ---------------------------------------------------------------
MERCURY_RADIUS = 0.39
EARTH_RADIUS = 1.0
MERCURY_PERIOD = 88.0    # days
EARTH_PERIOD = 365.25    # days

# --- Timeframe -------------------------------------------------------------
TOTAL_YEARS = 4
TOTAL_DAYS = TOTAL_YEARS * EARTH_PERIOD
FRAMES = 1500
LINE_EVERY = 8  # only draw a connecting chord every 8 frames (de-clutter)

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
ax.set_xlim(-1.2, 1.2)
ax.set_ylim(-1.2, 1.2)
ax.set_aspect("equal")
ax.axis("off")  # hide axis lines, ticks and frame

# Sun at the origin.
ax.plot(0, 0, "o", color="#ffd21e", markersize=20, zorder=1)

# Planet markers (updated each frame).
(mercury_dot,) = ax.plot([], [], "o", color="#9a9a9a", markersize=7, zorder=3)  # grey
(earth_dot,) = ax.plot([], [], "o", color="#4f86c6", markersize=9, zorder=3)    # blue


def init():
    mercury_dot.set_data([], [])
    earth_dot.set_data([], [])
    return mercury_dot, earth_dot


def update(frame):
    t = times[frame]
    mx, my = position(MERCURY_RADIUS, MERCURY_PERIOD, t)
    ex, ey = position(EARTH_RADIUS, EARTH_PERIOD, t)

    mercury_dot.set_data([mx], [my])
    earth_dot.set_data([ex], [ey])

    # Only add a persistent connecting chord every LINE_EVERY frames so the
    # multi-layered sunburst stays legible rather than a solid disc.
    if frame % LINE_EVERY == 0:
        ax.plot([mx, ex], [my, ey], color="#b57edc", linewidth=0.5, alpha=0.2, zorder=2)

    return mercury_dot, earth_dot


anim = FuncAnimation(fig, update, frames=FRAMES, init_func=init, interval=20, blit=False)

anim.save("mercury_earth_sunburst.gif", writer="pillow", fps=50)
print("Saved mercury_earth_sunburst.gif")
