"""
Animate the Earth-Mars orbital resonance pattern.

Over 15 Earth years Earth completes 15 orbits while Mars completes ~8
(the 15:8 resonance), and connecting the two planets with a line every so
often traces a dense, overlapping shield-like shape. Saves an animated GIF.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# --- Metrics ---------------------------------------------------------------
EARTH_RADIUS = 1.0
MARS_RADIUS = 1.52
EARTH_PERIOD = 365.25  # days
MARS_PERIOD = 687.0    # days

# --- Timeframe -------------------------------------------------------------
TOTAL_YEARS = 15
TOTAL_DAYS = TOTAL_YEARS * EARTH_PERIOD
FRAMES = 1500
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
ax.set_xlim(-1.7, 1.7)
ax.set_ylim(-1.7, 1.7)
ax.set_aspect("equal")
ax.axis("off")  # hide axis lines, ticks and frame

# Sun at the origin.
ax.plot(0, 0, "o", color="#ffd21e", markersize=20, zorder=1)

# Planet markers (updated each frame).
(earth_dot,) = ax.plot([], [], "o", color="#4f86c6", markersize=9, zorder=3)
(mars_dot,) = ax.plot([], [], "o", color="#c1440e", markersize=8, zorder=3)


def init():
    earth_dot.set_data([], [])
    mars_dot.set_data([], [])
    return earth_dot, mars_dot


def update(frame):
    t = times[frame]
    ex, ey = position(EARTH_RADIUS, EARTH_PERIOD, t)
    mx, my = position(MARS_RADIUS, MARS_PERIOD, t)

    earth_dot.set_data([ex], [ey])
    mars_dot.set_data([mx], [my])

    # Only add a persistent connecting chord every LINE_EVERY frames, and
    # keep it ultra-thin and very faint so the dense overlapping centre
    # stays readable rather than a solid blob.
    if frame % LINE_EVERY == 0:
        ax.plot([ex, mx], [ey, my], color="#40e0d0", linewidth=0.5, alpha=0.15, zorder=2)

    return earth_dot, mars_dot


anim = FuncAnimation(fig, update, frames=FRAMES, init_func=init, interval=20, blit=False)

anim.save("earth_mars_clean.gif", writer="pillow", fps=50)
print("Saved earth_mars_clean.gif")
