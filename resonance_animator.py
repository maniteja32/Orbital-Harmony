"""
Orbital-resonance pattern renderer — production-ready, config-driven.

Draws the "string-art" chord pattern between two planets orbiting the Sun,
animated with matplotlib's FuncAnimation and saved as a GIF.

Design goals:
  * Screen-space auto-scaling, fully decoupled from real AU distances — every
    pair is laid out in the SAME rigid -1.0..1.0 box with the inner planet
    locked to radius 0.50 and the outer to 0.95, so the geometry always fills
    the frame identically no matter which two bodies are chosen.
  * Real orbital PERIODS are kept, so the motion/resonance stays physically
    accurate; only the spatial radii are normalized.
  * Anti-fan-artifact: each chord stores a STATIC snapshot of BOTH planet
    positions at its own timestamp in a persistent history; later frames never
    re-anchor an existing chord to a planet's moving position.
  * Time-based trace interval (in DAYS) — the pattern draws one chord every
    `interval` simulated days, independent of the animation frame rate, so the
    density is tuned per pair rather than by frame-skipping.
  * A single LineCollection holds the whole history (fast even for the
    ~11k-chord Saturn/Uranus mandala).
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from matplotlib.collections import LineCollection

# =====================================================================
# 🛠️  SELECTOR — choose the combination to render.
# Options: 'mercury_venus', 'mercury_earth', 'earth_venus', 'earth_mars',
#          'mars_jupiter', 'jupiter_saturn', 'saturn_uranus', 'uranus_neptune'
# =====================================================================
PLANET_PAIR = 'earth_venus'

# --- Normalized layout (decoupled from real-world AU scaling) --------------
R_INNER = 0.50    # inner planet — fixed normalized orbital radius
R_OUTER = 0.95    # outer planet — fixed normalized orbital radius (frames the view)
VIEW_LIMIT = 1.0  # rigid -1..1 coordinate boundary on both axes
LINE_WIDTH = 0.5  # ultra-thin tracking lines
ANIM_FRAMES = 720  # animation length (time-lapse); trace density is time-based, not this

# Real sidereal periods (days). `p_in` = inner (shorter period, faster),
# `p_out` = outer (longer period). Motion uses these unchanged.
_PERIOD = {
    'mercury': 88.0, 'venus': 224.7, 'earth': 365.25, 'mars': 687.0,
    'jupiter': 4332.6, 'saturn': 10759.2, 'uranus': 30687.0, 'neptune': 60190.0,
}

# --- Core planetary configuration database ---------------------------------
# Each entry: display name, inner/outer real periods, total simulation time
# (Earth years), trace interval (days), line colour and alpha (10–25%).
CONFIGS = {
    'mercury_venus': {
        'name': 'Mercury & Venus', 'p_in': _PERIOD['mercury'], 'p_out': _PERIOD['venus'],
        'years': 2, 'interval': 1.2, 'color': '#FF9933', 'alpha': 0.25,
    },
    'mercury_earth': {
        'name': 'Mercury & Earth', 'p_in': _PERIOD['mercury'], 'p_out': _PERIOD['earth'],
        'years': 4, 'interval': 1.8, 'color': '#CC99FF', 'alpha': 0.18,
    },
    'earth_venus': {
        'name': 'Earth & Venus', 'p_in': _PERIOD['venus'], 'p_out': _PERIOD['earth'],
        'years': 8, 'interval': 2.8, 'color': '#00FFFF', 'alpha': 0.22,
    },
    'earth_mars': {
        'name': 'Earth & Mars', 'p_in': _PERIOD['earth'], 'p_out': _PERIOD['mars'],
        'years': 15, 'interval': 4.0, 'color': '#40E0D0', 'alpha': 0.15,
    },
    'mars_jupiter': {
        'name': 'Mars & Jupiter', 'p_in': _PERIOD['mars'], 'p_out': _PERIOD['jupiter'],
        'years': 12, 'interval': 5.5, 'color': '#FF3366', 'alpha': 0.20,
    },
    'jupiter_saturn': {
        'name': 'Jupiter & Saturn', 'p_in': _PERIOD['jupiter'], 'p_out': _PERIOD['saturn'],
        'years': 60, 'interval': 18.0, 'color': '#BA55D3', 'alpha': 0.20,
    },
    'saturn_uranus': {
        'name': 'Saturn & Uranus', 'p_in': _PERIOD['saturn'], 'p_out': _PERIOD['uranus'],
        'years': 1680, 'interval': 55.0, 'color': '#FFFFFF', 'alpha': 0.10,
    },
    'uranus_neptune': {
        'name': 'Uranus & Neptune', 'p_in': _PERIOD['uranus'], 'p_out': _PERIOD['neptune'],
        'years': 500, 'interval': 75.0, 'color': '#00FFCC', 'alpha': 0.15,
    },
}

# --- Active selection ------------------------------------------------------
c = CONFIGS[PLANET_PAIR]
TOTAL_DAYS = c['years'] * 365.25   # simulation clock upper bound = cycle close
INTERVAL = c['interval']


def position(radius, period, day):
    """Static (x, y) of a planet on its normalized circle at time `day`."""
    angle = 2.0 * np.pi * day / period
    return radius * np.cos(angle), radius * np.sin(angle)


# --- Scene setup -----------------------------------------------------------
plt.style.use('dark_background')
fig, ax = plt.subplots(figsize=(8, 8))
fig.patch.set_facecolor('black')
ax.set_facecolor('black')
ax.set_xlim(-VIEW_LIMIT, VIEW_LIMIT)
ax.set_ylim(-VIEW_LIMIT, VIEW_LIMIT)
ax.set_aspect('equal')
ax.axis('off')  # hidden axis markings
ax.set_title(c['name'], color='white', fontsize=14, pad=10)

# Sun + planet markers.
ax.plot(0, 0, 'o', color='#FFD700', markersize=14, zorder=3)
(inner_dot,) = ax.plot([], [], 'o', color='#E6E6E6', markersize=5, zorder=4)
(outer_dot,) = ax.plot([], [], 'o', color='#4A90E2', markersize=7, zorder=4)

# Persistent static-segment history (the "anti-fan" drawing array). A single
# LineCollection renders the whole history efficiently.
segments = []
trace = LineCollection([], colors=c['color'], linewidths=LINE_WIDTH, alpha=c['alpha'], zorder=2)
ax.add_collection(trace)

# Simulated-clock cursor for the NEXT chord to emit (kept outside `update`
# so it persists across frames without pulling old endpoints).
_state = {'next_trace_day': 0.0}


def frame_to_day(frame):
    """Map an animation frame to a point on the simulation clock [0, TOTAL_DAYS]."""
    if ANIM_FRAMES <= 1:
        return TOTAL_DAYS
    return (frame / (ANIM_FRAMES - 1)) * TOTAL_DAYS


def update(frame):
    day = frame_to_day(frame)

    # Emit every chord whose timestamp has now arrived. Each captures a STATIC
    # snapshot of BOTH planets at its own `d`, pushed once into the persistent
    # history — never re-anchored to the planets' later positions.
    while _state['next_trace_day'] <= day + 1e-9 and _state['next_trace_day'] <= TOTAL_DAYS + 1e-9:
        d = _state['next_trace_day']
        ax1, ay1 = position(R_INNER, c['p_in'], d)
        bx2, by2 = position(R_OUTER, c['p_out'], d)
        segments.append([(ax1, ay1), (bx2, by2)])
        _state['next_trace_day'] += INTERVAL
    trace.set_segments(segments)

    # Live planet markers at the current clock position.
    ix, iy = position(R_INNER, c['p_in'], day)
    ox, oy = position(R_OUTER, c['p_out'], day)
    inner_dot.set_data([ix], [iy])
    outer_dot.set_data([ox], [oy])

    return [trace, inner_dot, outer_dot]


# blit=False so the accumulating static history redraws cleanly every frame.
anim = FuncAnimation(fig, update, frames=ANIM_FRAMES, interval=20, blit=False)

output_filename = f"{PLANET_PAIR}_resonance.gif"
n_lines = int(TOTAL_DAYS / INTERVAL) + 1
print(f"Rendering {c['name']}: {c['years']} Earth yr, {INTERVAL}-day interval "
      f"(~{n_lines} chords) → {output_filename}")
anim.save(output_filename, writer='pillow', fps=50)
print(f"Saved {output_filename}")
