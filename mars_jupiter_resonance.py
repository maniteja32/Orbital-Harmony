"""
Animate the Mars-Jupiter orbital resonance pattern.

Over 12 Earth years Mars completes ~6.4 orbits while Jupiter completes ~1
(close to a 6:1 relationship), and connecting the two planets with a line
every so often maps out a crisp multi-lobed star / rosette. Saves an
animated GIF.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# --- Metrics ---------------------------------------------------------------
MARS_RADIUS = 1.52
JUPITER_RADIUS = 5.2
MARS_PERIOD = 687.0     # days
JUPITER_PERIOD = 4333.0  # days

# --- Timeframe -------------------------------------------------------------
EARTH_YEAR_DAYS = 365.25
TOTAL_YEARS = 12
TOTAL_DAYS = TOTAL_YEARS * EARTH_YEAR_DAYS
FRAMES = 1200
LINE_EVERY = 6  # only draw a connecting chord every 6 frames (de-clutter)

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
ax.set_xlim(-5.5, 5.5)
ax.set_ylim(-5.5, 5.5)
ax.set_aspect("equal")
ax.axis("off")  # hide axis lines, ticks and frame

# Sun at the origin.
ax.plot(0, 0, "o", color="#ffd21e", markersize=18, zorder=1)

# Planet markers (updated each frame).
(mars_dot,) = ax.plot([], [], "o", color="#c1440e", markersize=8, zorder=3)    # red
(jupiter_dot,) = ax.plot([], [], "o", color="#9c6b3f", markersize=11, zorder=3)  # brown


def init():
    mars_dot.set_data([], [])
    jupiter_dot.set_data([], [])
    return mars_dot, jupiter_dot


def update(frame):
    t = times[frame]
    mx, my = position(MARS_RADIUS, MARS_PERIOD, t)
    jx, jy = position(JUPITER_RADIUS, JUPITER_PERIOD, t)

    mars_dot.set_data([mx], [my])
    jupiter_dot.set_data([jx], [jy])

    # Only add a persistent connecting chord every LINE_EVERY frames so the
    # 7 distinct loops stay cleanly mapped rather than blurred together.
    if frame % LINE_EVERY == 0:
        ax.plot([mx, jx], [my, jy], color="#ff6a00", linewidth=0.6, alpha=0.25, zorder=2)

    return mars_dot, jupiter_dot


anim = FuncAnimation(fig, update, frames=FRAMES, init_func=init, interval=20, blit=False)

anim.save("mars_jupiter_star.gif", writer="pillow", fps=50)
print("Saved mars_jupiter_star.gif")
