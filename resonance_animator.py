import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# =====================================================================
# 🛠️ CHOOSE YOUR CONFIGURATION HERE
# Available choices: 'earth_venus', 'earth_mars', 'jupiter_saturn',
#                    'mars_jupiter', 'saturn_uranus', 'uranus_neptune',
#                    'mercury_venus', 'mercury_earth'
# =====================================================================
PLANET_PAIR = 'earth_venus'

# Precise astronomical configs optimized to prevent overcrowding
CONFIGS = {
    'earth_venus': {
        'name': 'Earth & Venus (5-Petaled Rose)',
        'r1': 0.72, 'r2': 1.0, 'p1': 224.7, 'p2': 365.25,
        'years': 8, 'frames': 1200, 'skip': 8, 'limit': 1.2, 'color': '#00FFFF', 'alpha': 0.25
    },
    'earth_mars': {
        'name': 'Earth & Mars (Asymmetrical Shield)',
        'r1': 1.0, 'r2': 1.52, 'p1': 365.25, 'p2': 687.0,
        'years': 15, 'frames': 1500, 'skip': 10, 'limit': 1.7, 'color': '#40E0D0', 'alpha': 0.15
    },
    'jupiter_saturn': {
        'name': 'Jupiter & Saturn (Royal Crown)',
        'r1': 5.20, 'r2': 9.58, 'p1': 4332.6, 'p2': 10759.2,
        'years': 60, 'frames': 2000, 'skip': 12, 'limit': 10.5, 'color': '#BA55D3', 'alpha': 0.25
    },
    'mars_jupiter': {
        'name': 'Mars & Jupiter (7-Lobed Star)',
        'r1': 1.52, 'r2': 5.20, 'p1': 687.0, 'p2': 4332.6,
        'years': 12, 'frames': 1200, 'skip': 6, 'limit': 5.5, 'color': '#FF3366', 'alpha': 0.25
    },
    'saturn_uranus': {
        'name': 'Saturn & Uranus (Detailed Mandala)',
        'r1': 9.58, 'r2': 19.22, 'p1': 10759.2, 'p2': 30687.0,
        'years': 1680, 'frames': 3000, 'skip': 15, 'limit': 21.0, 'color': '#FFFFFF', 'alpha': 0.10
    },
    'uranus_neptune': {
        'name': 'Uranus & Neptune (Tri-Star)',
        'r1': 19.22, 'r2': 30.05, 'p1': 30687.0, 'p2': 60190.0,
        'years': 500, 'frames': 2000, 'skip': 10, 'limit': 32.0, 'color': '#00FFCC', 'alpha': 0.20
    },
    'mercury_venus': {
        'name': 'Mercury & Venus (Hyper-Speed Crown)',
        'r1': 0.39, 'r2': 0.72, 'p1': 88.0, 'p2': 224.7,
        'years': 2, 'frames': 1000, 'skip': 5, 'limit': 0.8, 'color': '#FF9933', 'alpha': 0.30
    },
    'mercury_earth': {
        'name': 'Mercury & Earth (Concentric Sunburst)',
        'r1': 0.39, 'r2': 1.0, 'p1': 88.0, 'p2': 365.25,
        'years': 4, 'frames': 1500, 'skip': 8, 'limit': 1.2, 'color': '#CC99FF', 'alpha': 0.20
    }
}

# Extract active selection parameters
c = CONFIGS[PLANET_PAIR]

# 1. Setup Scene Layout
plt.style.use('dark_background')
fig, ax = plt.subplots(figsize=(8, 8))
ax.set_xlim(-c['limit'], c['limit'])
ax.set_ylim(-c['limit'], c['limit'])
ax.axis('off')
ax.set_title(c['name'], color='white', fontsize=14, pad=10)

# 2. Timeline and Math Logic
total_days = c['years'] * 365.25
time_steps = np.linspace(0, total_days, c['frames'])

# Core Trigonometric Array calculations
theta1 = 2 * np.pi * time_steps / c['p1']
theta2 = 2 * np.pi * time_steps / c['p2']

x1, y1 = c['r1'] * np.cos(theta1), c['r1'] * np.sin(theta1)
x2, y2 = c['r2'] * np.cos(theta2), c['r2'] * np.sin(theta2)

# 3. Dynamic Visual Elements
sun = ax.plot(0, 0, 'o', color='#FFD700', markersize=14)
p1_dot, = ax.plot([], [], 'o', color='#E6E6E6', markersize=5)
p2_dot, = ax.plot([], [], 'o', color='#4A90E2', markersize=7)

lines_history = []

# 4. Animation Update Frame function
def update(frame):
    # Smooth planet markers movement tracking
    p1_dot.set_data([x1[frame]], [y1[frame]])
    p2_dot.set_data([x2[frame]], [y2[frame]])

    # FIXES VARIABLE MISMATCH & OVERCROWDING:
    # Strictly connects planet 1 (x1, y1) directly to planet 2 (x2, y2)
    # Skipping frames using modulation avoids messy string collisions
    if frame % c['skip'] == 0:
        line, = ax.plot([x1[frame], x2[frame]], [y1[frame], y2[frame]],
                        color=c['color'], alpha=c['alpha'], linewidth=0.6)
        lines_history.append(line)

    return [p1_dot, p2_dot] + lines_history

# 5. Compile and output local file asset
ani = FuncAnimation(fig, update, frames=c['frames'], interval=12, blit=True)

output_filename = f"{PLANET_PAIR}_resonance.gif"
print(f"Generating smooth layout for {c['name']}...")
print("This renders efficiently and prevents overlapping bugs.")

# Saves smoothly to your active directory layout workspace
ani.save(output_filename, writer='pillow', fps=50)
plt.show()
