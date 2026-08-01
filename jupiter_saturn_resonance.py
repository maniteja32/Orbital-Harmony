"""
Animate the Jupiter-Saturn orbital resonance pattern (the "great crown").

Over 60 Earth years Jupiter completes ~5 orbits while Saturn completes ~2
(the 5:2 "great inequality" resonance), and connecting the two planets with
a line every so often traces a sharp triangular / crown-like figure.
Saves an animated GIF.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# --- Metrics ---------------------------------------------------------------
JUPITER_RADIUS = 5.2
SATURN_RADIUS = 9.58
JUPITER_PERIOD = 4333.0   # days (~11.86 years)
SATURN_PERIOD = 10759.0   # days (~29.46 years)

# --- Timeframe -------------------------------------------------------------
EARTH_YEAR_DAYS = 365.25
TOTAL_YEARS = 60
TOTAL_DAYS = TOTAL_YEARS * EARTH_YEAR_DAYS
FRAMES = 2000
LINE_EVERY = 12  # only draw a connecting chord every 12 frames (de-clutter)

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
ax.set_xlim(-10.0, 10.0)
ax.set_ylim(-10.0, 10.0)
ax.set_aspect("equal")
ax.axis("off")  # hide axis lines, ticks and frame

# Sun at the origin.
ax.plot(0, 0, "o", color="#ffd21e", markersize=18, zorder=1)

# Planet markers (updated each frame).
(jupiter_dot,) = ax.plot([], [], "o", color="#d2b48c", markersize=11, zorder=4)  # tan/beige
(saturn_dot,) = ax.plot([], [], "o", color="#f5e7a3", markersize=10, zorder=4)   # pale yellow
# Flat "ring" representation around Saturn (updated each frame).
(saturn_ring,) = ax.plot([], [], "-", color="#e8d98a", linewidth=1.2, alpha=0.7, zorder=3)

# Precompute a unit ellipse for Saturn's flat ring (drawn foreshortened).
_theta = np.linspace(0.0, 2.0 * np.pi, 60)
_ring_x = np.cos(_theta) * 0.75
_ring_y = np.sin(_theta) * 0.28


def init():
    jupiter_dot.set_data([], [])
    saturn_dot.set_data([], [])
    saturn_ring.set_data([], [])
    return jupiter_dot, saturn_dot, saturn_ring


def update(frame):
    t = times[frame]
    jx, jy = position(JUPITER_RADIUS, JUPITER_PERIOD, t)
    sx, sy = position(SATURN_RADIUS, SATURN_PERIOD, t)

    jupiter_dot.set_data([jx], [jy])
    saturn_dot.set_data([sx], [sy])
    saturn_ring.set_data(_ring_x + sx, _ring_y + sy)

    # Only add a persistent connecting chord every LINE_EVERY frames so the
    # accumulated crown stays crisp rather than a solid fill.
    if frame % LINE_EVERY == 0:
        ax.plot([jx, sx], [jy, sy], color="#b026ff", linewidth=0.6, alpha=0.2, zorder=2)

    return jupiter_dot, saturn_dot, saturn_ring


anim = FuncAnimation(fig, update, frames=FRAMES, init_func=init, interval=20, blit=False)

anim.save("jupiter_saturn_crown.gif", writer="pillow", fps=50)
print("Saved jupiter_saturn_crown.gif")
