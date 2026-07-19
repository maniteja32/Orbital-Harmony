// ============================================================================
// Orbital Harmony — real 3D planet preview renderer for the swipe carousel.
// The carousel previously drew each planet as a flat CSS radial-gradient
// circle (and Saturn's rings as a fake gradient ellipse) — this read as
// cheap/cartoonish next to the actual Three.js solar system. This module
// renders the SAME real planets — same textures, same materials, same ring
// geometry/proportions — as small lit 3D globes instead, by building them
// through the shared planetFactory.js (the single source of truth for
// planet appearance also used by solarSystemEngine.js), using ONE shared
// WebGL canvas per carousel row (not one canvas per planet — keeps the
// WebGL context count low/safe across mobile browsers).
//
// Coordinate trick: the camera is ORTHOGRAPHIC and set up in literal CSS
// PIXEL space (1 world unit = 1 canvas pixel), and every planet's group is
// positioned at its exact scroll-content X offset (in pixels). Panning the
// camera's X position by the DOM track's `scrollLeft` each frame therefore
// keeps the 3D scene in perfect lockstep with native browser scrolling —
// no custom drag/momentum physics needed, the existing scroll-snap DOM
// track still does all of that; this canvas is just a live "window" into a
// simple 3D scene positioned to match it exactly.
// ============================================================================
import * as THREE from 'three';
import { buildPlanetBody } from './planetFactory.js';

// Builds one real planet via the shared factory (same texture, material,
// ring geometry/texture/proportions as the actual Solar System engine) at
// a unit radius (1), positioned/scaled later per-frame by the carousel.
// Only the orbit-less "static preview" wrapper group and the animated
// scale/opacity knobs (for carousel selection/depth) are specific to this
// file — appearance itself is 100% shared, no emissive/glow anywhere.
function buildPreviewPlanet(data) {
  const group = new THREE.Group(); // positioned at the planet's screen-space X; never rotated
  // Front-facing camera here (looks down -Z), unlike the main
  // solarSystemEngine's top-down camera — see planetFactory.js's
  // `tiltAxis` doc for why that changes which axis the tilt/ring use.
  const { tiltGroup, mesh, material, ring } = buildPlanetBody(data, { radius: 1, tiltAxis: 'x' });
  // RESET, applied uniformly to every planet (not just ringed ones):
  // `buildPlanetBody` sets `tiltGroup.rotation.x = data.tilt` (each
  // planet's own real axial tilt — Earth 23.4°, Mars 25°, Saturn 26.73°,
  // Uranus 82°, etc.). For this small carousel icon row, per-planet real
  // tilts made some planets (Saturn, Uranus especially) visually stand out
  // at odd angles relative to their neighbors. Resetting every planet's
  // tiltGroup rotation to zero here means they all render perfectly
  // upright/face-on and consistent with one another — matching how the
  // Solar System's top-down camera view makes every planet read as a
  // plain, consistently-oriented circle (a sphere's own axial tilt barely
  // affects its silhouette from any camera angle; it's the SAME "no planet
  // looks tilted differently than its neighbors" consistency, just reset
  // outright here instead of relying on each real tilt being small).
  tiltGroup.rotation.set(0, 0, 0);
  // `rollGroup` wraps `tiltGroup` in case a diagonal "roll" (rotation
  // around the camera's view axis, Z) is ever wanted on top of the axial
  // tilt — left at its default (0) rotation so it has no effect now.
  const rollGroup = new THREE.Group();
  rollGroup.add(tiltGroup);
  group.add(rollGroup);

  // This preview needs transparency (distant carousel planets fade out) —
  // the shared factory doesn't set that by default (real solar-system
  // planets are always fully opaque).
  material.transparent = true;
  if (ring) {
    ring.material.transparent = true;
    // Saturn's rotational axis (pole-to-pole) is `tiltGroup`'s local Y
    // axis; since `tiltGroup.rotation` is reset to (0,0,0) above, that axis
    // points straight up in world space, unrotated. A planet's ring plane
    // is, BY DEFINITION, its equatorial plane — mathematically
    // perpendicular (90°) to that same rotation axis, always, with no
    // independent tilt/skew/roll of its own. `RingGeometry` is built lying
    // flat in the LOCAL XY plane (normal along local Z); rotating it -90°
    // around local X reorients that plane to be perpendicular to Y (i.e.
    // the local XZ plane) — exactly Saturn's equatorial plane. The ring
    // stays a direct child of `tiltGroup` (the mesh's own group, not a
    // separate sibling group), so it rotates together with Saturn as one
    // single rigid system with no independent rotation, and remains
    // centered/passing through the planet's exact center at all times.
    //
    // A mathematically EXACT 90° (Math.PI / 2) would put the ring plane
    // perfectly edge-on to this front-facing camera — a flat 2D annulus
    // has zero geometric thickness along its own normal, so at exactly
    // edge-on it projects to a zero-width line and disappears entirely.
    // Nudging a few degrees short of that (86° instead of 90°) keeps the
    // ring functionally perpendicular to the rotation axis (visually
    // indistinguishable from true edge-on) while leaving it JUST open
    // enough to always render as a thin, readable horizontal line/sliver
    // through Saturn's equator — never fully invisible — matching how
    // Saturn still reads as "Saturn" in real edge-on astronomy photos.
    const RING_EDGE_ON_SAFETY_DEG = 4;
    ring.rotation.x = -THREE.MathUtils.degToRad(90 - RING_EDGE_ON_SAFETY_DEG);
    // IMPORTANT: the ring's real inner radius is 1.15x the sphere radius
    // (see planetFactory.js) — any presentationScale below ~0.87 shrinks
    // the ring's INNER edge to less than the sphere's own radius, making it
    // clip through/inside the planet instead of surrounding it (a real bug
    // hit here: 0.7 put the inner edge at 0.805x, well inside the sphere).
    // Kept close to 1 (barely tightened) so the ring stays cleanly outside
    // the sphere at every scale.
    ring.userData.presentationScale = 0.94;
  }

  return { group, mesh, material, ring, spinSpeed: (data.rotationSpeed ?? 0.02) * (data.spinDirection ?? 1) };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Array} planets - PLANETS data array
 */
export function createPlanetPreviewRow(canvas, planets) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
  camera.position.z = 400;

  // A SINGLE directional "sunlight" source, like the actual Solar System
  // engine's Sun — this is what makes a sphere actually read as a sphere:
  // one side clearly lit, one side clearly darker, a real terminator/
  // shading gradient across the globe. Ambient is kept deliberately LOW
  // (just enough that the dark side isn't pure crushed black on a small
  // icon) rather than the previous high-ambient/dual-symmetric-light setup
  // that lit both sides almost equally and made every planet look like a
  // flat, evenly-exposed cutout image instead of a real lit 3D body.
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const key = new THREE.DirectionalLight(0xfff2df, 2.1);
  key.position.set(-140, 90, 260);
  scene.add(key);

  const entries = new Map(); // key -> { group, mesh, material, ring, spinSpeed }
  planets.forEach((data) => {
    const entry = buildPreviewPlanet(data);
    scene.add(entry.group);
    entries.set(data.key, entry);
  });

  let rafId = null;
  const clock = new THREE.Clock();

  function setLayout(positionsPx) {
    // positionsPx: { [planetKey]: contentRelativeCenterXInPixels }
    entries.forEach((entry, key2) => {
      if (positionsPx[key2] != null) entry.group.position.x = positionsPx[key2];
    });
  }

  function setViewport(scrollLeft, clientWidth, clientHeight, dpr) {
    renderer.setPixelRatio(Math.min(dpr || 1, 2));
    renderer.setSize(clientWidth, clientHeight, false);
    camera.left = -clientWidth / 2;
    camera.right = clientWidth / 2;
    camera.top = clientHeight / 2;
    camera.bottom = -clientHeight / 2;
    // Pan the camera to track native scroll — see file header for the math.
    camera.position.x = scrollLeft + clientWidth / 2;
    camera.updateProjectionMatrix();
  }

  // radiusPx: the planet's own resting radius in pixels (DISPLAY_SCALE
  // already folded in by the caller); scale/opacity/dim mirror the same
  // continuous swipe-distance-driven values the DOM layer used to drive via
  // CSS custom properties. Deliberately no emissive/glow boost anywhere —
  // the selected planet stands out via scale + full brightness + realistic
  // single-key-light shading alone, not an artificial glow.
  function setPlanetState(key2, { radiusPx, scale, opacity, dim, disabled }) {
    const entry = entries.get(key2);
    if (!entry) return;
    const r = radiusPx * scale;
    entry.mesh.scale.setScalar(r);
    entry.material.opacity = disabled ? Math.min(opacity, 0.35) : opacity;
    // Disabled = already picked as the OTHER slot's planet: desaturate by
    // tinting the real texture toward flat gray (MeshStandardMaterial's
    // `color` multiplies the texture) instead of full white/no tint;
    // otherwise dim toward gray as the planet drifts away from center
    // (three.js has no CSS-filter brightness()/contrast() equivalent, so
    // this real material-color multiply stands in for that same "selected
    // pops, distant fades flat" contrast).
    entry.material.color.setScalar(disabled ? 0.4 : dim);
    if (entry.ring) {
      // presentationScale (Saturn only, see buildPreviewPlanet) tightens
      // the real ring's footprint for this small carousel icon's spacing,
      // on top of the same dynamic depth/selection scale as the sphere.
      entry.ring.scale.setScalar(r * (entry.ring.userData.presentationScale ?? 1));
      entry.ring.material.opacity = disabled ? Math.min(opacity, 0.35) : opacity;
      entry.ring.material.color.setScalar(disabled ? 0.4 : dim);
    }
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    const delta = Math.min(clock.getDelta(), 0.05);
    entries.forEach((entry) => {
      entry.mesh.rotation.y += delta * entry.spinSpeed;
    });
    renderer.render(scene, camera);
  }

  return {
    setLayout,
    setViewport,
    setPlanetState,
    start() {
      if (rafId == null) tick();
    },
    destroy() {
      if (rafId != null) cancelAnimationFrame(rafId);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    },
  };
}
