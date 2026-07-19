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
  // `rollGroup` wraps `tiltGroup` so a diagonal "roll" (rotation around the
  // camera's view axis, Z) can be applied to the ALREADY tilted+yawed
  // Saturn system as a whole, in screen space — leaning its vertical
  // rotation axis left/right — without fighting Euler-order interactions
  // with tiltGroup's own internal X/Y rotation (rollGroup is the OUTER
  // parent, so its rotation is composed last, purely in view space).
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
    // axis. A planet's ring plane is, BY DEFINITION, its equatorial plane
    // — mathematically perpendicular (90°) to that same rotation axis,
    // always, with no independent tilt/skew/roll of its own. `RingGeometry`
    // is built lying flat in the LOCAL XY plane (normal along local Z);
    // rotating it -90° around local X reorients that plane to be
    // perpendicular to Y (i.e. the local XZ plane) — exactly Saturn's
    // equatorial plane. This is a FIXED, presentation-independent flip —
    // it only orients the ring geometry into "lying flat on the equator";
    // it carries no elevation/tilt of its own.
    ring.rotation.x = -Math.PI / 2;
    // The actual presentation tilt (how "open" the ellipse looks) and yaw
    // (the diagonal sweep) are applied to `tiltGroup` itself instead of to
    // the ring alone — `tiltGroup` is the SHARED parent of both the mesh
    // and the ring, so both rotate together as one single rigid object.
    // Previously the elevation lived only on the ring's own local
    // rotation, which opened/tilted the ring correctly but left the
    // sphere sitting perfectly upright underneath — Saturn's own band
    // texture never reflected that tilt, so the planet looked like a
    // separate object from its rings. Moving the elevation here instead
    // means Saturn's rotational axis itself now tilts to match the ring
    // plane, and its bands visibly follow the same orientation the rings
    // imply. A smaller elevation (15° instead of 30°) shows less of
    // Saturn's north pole face-on (less "looking down from above"), while
    // still composing with the ring's fixed -90° flip to keep the ring
    // itself open/visible (rotations about the same local X axis simply
    // add: -90° + 15° = -75°) — only the SPHERE's pole visibility changes
    // here, not how the rings look.
    tiltGroup.rotation.x = THREE.MathUtils.degToRad(15);
    // Rotate the whole Saturn system — sphere + ring together, as one
    // rigid unit, no independent ring rotation — around the vertical (Y)
    // axis, applied to `tiltGroup` itself (the shared parent of both mesh
    // and ring) so it's a true single-body yaw, like turning a physical
    // model left/right rather than moving the planet or rings alone.
    tiltGroup.rotation.y = THREE.MathUtils.degToRad(30);
    // Per the reference image: the whole Saturn system's vertical
    // (pole-to-pole) axis should lean toward the LEFT, not stay perfectly
    // upright. Applied on `rollGroup` (the OUTER wrapper around
    // `tiltGroup`) rather than mixed into tiltGroup's own rotation, so this
    // roll is composed last, purely in screen space, on top of the
    // already-tilted-and-yawed system as a single rigid whole — the
    // planet and rings lean together, identically, with no relative
    // change between them.
    rollGroup.rotation.z = THREE.MathUtils.degToRad(30);
    // IMPORTANT: the ring's real inner radius is 1.15x the sphere radius
    // (see planetFactory.js) — any presentationScale below ~0.87 shrinks
    // the ring's INNER edge to less than the sphere's own radius, making it
    // clip through/inside the planet instead of surrounding it (a real bug
    // hit here: 0.7 put the inner edge at 0.805x, well inside the sphere).
    // Kept close to 1 (barely tightened) so the ring stays cleanly outside
    // the sphere at every scale.
    ring.userData.presentationScale = 0.94;
  }

  // Real per-planet rotation speeds (same values solarSystemEngine.js
  // uses) are quite slow up close — e.g. Earth is only ~1°/sec — so at a
  // glance the small carousel icons read as static over a few seconds.
  // A carousel-only visibility multiplier keeps each planet's relative
  // speed/direction differences intact (Venus still visibly slower/
  // backwards, Jupiter still fastest, etc.) while making the spin clearly
  // noticeable as a "living" preview; the actual Solar System scene's
  // speeds are untouched.
  const CAROUSEL_SPIN_VISIBILITY_MULTIPLIER = 15;
  const spinSpeed = (data.rotationSpeed ?? 0.02) * (data.spinDirection ?? 1) * CAROUSEL_SPIN_VISIBILITY_MULTIPLIER;

  return { group, mesh, material, ring, spinSpeed };
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
