"""
Animate the Earth-Venus orbital resonance pattern (the "rose of Venus").

Over 8 Earth years Venus completes ~13 orbits while Earth completes 8
(the 8:13 resonance), and connecting the two planets with a line every so
often traces the classic 5-petaled rose. Saves an animated GIF.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# --- Metrics ---------------------------------------------------------------
EARTH_RADIUS = 1.0
VENUS_RADIUS = 0.72
EARTH_PERIOD = 365.25  # days
VENUS_PERIOD = 224.7   # days

# --- Timeframe -------------------------------------------------------------
TOTAL_YEARS = 8
TOTAL_DAYS = TOTAL_YEARS * EARTH_PERIOD
FRAMES = 1200
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
ax.plot(0, 0, "o", color="#ffd21e", markersize=22, zorder=1)

# Planet markers (updated each frame).
(earth_dot,) = ax.plot([], [], "o", color="#4f86c6", markersize=9, zorder=3)
(venus_dot,) = ax.plot([], [], "o", color="#ff8c1a", markersize=7, zorder=3)


def init():
    earth_dot.set_data([], [])
    venus_dot.set_data([], [])
    return earth_dot, venus_dot


def update(frame):
    t = times[frame]
    ex, ey = position(EARTH_RADIUS, EARTH_PERIOD, t)
    vx, vy = position(VENUS_RADIUS, VENUS_PERIOD, t)

    earth_dot.set_data([ex], [ey])
    venus_dot.set_data([vx], [vy])

    # Only add a persistent connecting chord every LINE_EVERY frames so the
    # accumulated pattern stays clean rather than a dense scribble.
    if frame % LINE_EVERY == 0:
        ax.plot([ex, vx], [ey, vy], color="white", linewidth=0.5, alpha=0.3, zorder=2)

    return earth_dot, venus_dot


anim = FuncAnimation(fig, update, frames=FRAMES, init_func=init, interval=20, blit=False)

anim.save("earth_venus_clean.gif", writer="pillow", fps=50)
print("Saved earth_venus_clean.gif")
