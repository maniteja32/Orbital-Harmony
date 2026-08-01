"""
Animate the Mercury-Venus orbital resonance pattern.

Over 2 Earth years fast-moving Mercury wraps around ~8 times while Venus
completes ~3 orbits (close to a 3:8 relationship), and connecting the two
planets with a line every so often traces a 5-sided crown / star shape.
Saves an animated GIF.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# --- Metrics ---------------------------------------------------------------
MERCURY_RADIUS = 0.39
VENUS_RADIUS = 0.72
MERCURY_PERIOD = 88.0    # days
VENUS_PERIOD = 224.7     # days

# --- Timeframe -------------------------------------------------------------
EARTH_YEAR_DAYS = 365.25
TOTAL_YEARS = 2
TOTAL_DAYS = TOTAL_YEARS * EARTH_YEAR_DAYS
FRAMES = 1000
LINE_EVERY = 5  # only draw a connecting chord every 5 frames (de-clutter)

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
ax.set_xlim(-0.8, 0.8)
ax.set_ylim(-0.8, 0.8)
ax.set_aspect("equal")
ax.axis("off")  # hide axis lines, ticks and frame

# Sun at the origin.
ax.plot(0, 0, "o", color="#ffd21e", markersize=20, zorder=1)

# Planet markers (updated each frame).
(mercury_dot,) = ax.plot([], [], "o", color="#8a8a8a", markersize=7, zorder=3)  # dark grey
(venus_dot,) = ax.plot([], [], "o", color="#ff8c1a", markersize=9, zorder=3)    # orange


def init():
    mercury_dot.set_data([], [])
    venus_dot.set_data([], [])
    return mercury_dot, venus_dot


def update(frame):
    t = times[frame]
    mx, my = position(MERCURY_RADIUS, MERCURY_PERIOD, t)
    vx, vy = position(VENUS_RADIUS, VENUS_PERIOD, t)

    mercury_dot.set_data([mx], [my])
    venus_dot.set_data([vx], [vy])

    # Only add a persistent connecting chord every LINE_EVERY frames so the
    # 5-sided crown stays crisp rather than an overlapping scribble.
    if frame % LINE_EVERY == 0:
        ax.plot([mx, vx], [my, vy], color="#ff1493", linewidth=0.7, alpha=0.3, zorder=2)

    return mercury_dot, venus_dot


anim = FuncAnimation(fig, update, frames=FRAMES, init_func=init, interval=20, blit=False)

anim.save("mercury_venus_crown.gif", writer="pillow", fps=50)
print("Saved mercury_venus_crown.gif")
