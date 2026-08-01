// ============================================================================
// Orbital Harmony — SINGLE SOURCE OF TRUTH for how a "planet" actually
// looks: real texture loading (with the same saturation boost) and real
// mesh/material/ring construction, shared by EVERY screen that renders a
// planet (Solar System browse, Reveal/Result pattern screens via
// solarSystemEngine.js, and the Planet Select swipe carousel via
// planetPreviewEngine.js). Neither of those engines should build its own
// copy of this logic — they both import from here, so a planet's texture,
// material params, ring geometry/texture, and proportions are identical
// everywhere in the app by construction, not by convention.
//
// The ONE thing that legitimately differs between call sites is the
// camera's viewing direction, which determines which local axis a tilt (and
// a ring's lie-flat flip) needs to rotate around — see `tiltAxis` below.
// That's a real geometric necessity, not a visual/asset difference: the
// texture, material, ring proportions, and lighting philosophy are all
// still exactly the same regardless of which axis is used.
// ============================================================================
import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

export function loadPlanetTexture(path, { srgb = true, saturate = false } = {}) {
  const cacheKey = saturate ? `${path}::sat` : path;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const tex = textureLoader.load(path, saturate ? boostTextureSaturation : undefined);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  // Bumped from 4 — at the small on-screen sizes planets render at (e.g.
  // the zoomed-out Solar System overview), mipmapping/minification was
  // smoothing surface detail into a flatter, duller-looking average color
  // more than necessary; a higher anisotropy keeps more of the source
  // detail/contrast through that downsampling.
  tex.anisotropy = 8;
  textureCache.set(cacheKey, tex);
  return tex;
}

// Redraws a loaded texture's image through a canvas so planets read as more
// vivid/colorful on-screen (saturate + a touch of contrast/brightness) —
// cheap, one-time, no full post-processing/bloom pipeline needed. Runs once
// per texture right after its image finishes loading (passed as the
// TextureLoader `onLoad` callback, which receives the Texture itself), then
// swaps `texture.image` to the boosted canvas and flags `needsUpdate` so
// Three.js re-uploads the adjusted pixels to the GPU.
//
// IMPORTANT — done with MANUAL PER-PIXEL math, NOT Canvas 2D `ctx.filter`:
// `ctx.filter` is only supported in Safari/iPadOS/iOS 17+. On older iPads it
// is silently ignored, so the boost never applied there and planets rendered
// at their raw, duller/desaturated colors while looking vivid on a
// newer-Safari Mac. Per-pixel math produces the SAME result on every device
// and WebKit version. The math mirrors the old CSS filter order
// (saturate 185% -> contrast 116% -> brightness 108%).
function boostTextureSaturation(texture, amount = 1.85) {
  const img = texture.image;
  if (!img || !img.width) return;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const sat = amount; // saturate(185%)
    const con = 1.16; // contrast(116%)
    const bri = 1.08; // brightness(108%)
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      // saturate: push each channel away from the pixel's luminance
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * sat;
      g = lum + (g - lum) * sat;
      b = lum + (b - lum) * sat;
      // contrast around mid-grey (128), then brightness
      r = ((r - 128) * con + 128) * bri;
      g = ((g - 128) * con + 128) * bri;
      b = ((b - 128) * con + 128) * bri;
      data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // getImageData throws only on a cross-origin "tainted" canvas; the
    // textures are same-origin (/textures/*), so this is just a safety net —
    // fall back to the un-boosted (but still correct) image.
  }
  texture.image = canvas;
  texture.needsUpdate = true;
}

/**
 * Builds one real planet body: sphere with its real (saturation-boosted)
 * texture, optional real clouds/atmosphere, and — for ringed planets — the
 * exact same real ring geometry/texture/UV-remap and proportions used
 * everywhere else in the app. This is a pure "what does the planet look
 * like" builder — orbital motion (pivot/distance/startAngle), self-spin
 * animation, and moons are the CALLER's responsibility (they're simulation
 * concerns, not asset/appearance concerns), so every screen stays free to
 * drive this body however it needs to (orbiting, static preview, etc.).
 *
 * @param {object} data - a PLANETS entry (data/planets.js)
 * @param {object} [opts]
 * @param {number} [opts.radius] - overrides data.radius for SCALE only;
 *   ring/cloud/atmosphere proportions stay exactly the same ratios
 *   (1.15x/2.3x/1.03x/1.06x) relative to whichever radius is used, so a
 *   carousel icon and the real solar system both stay correctly
 *   proportioned even though their absolute sizes differ.
 * @param {'z'|'x'} [opts.tiltAxis] - which local axis the axial tilt (and
 *   ring lie-flat flip) rotates around, purely a function of the camera's
 *   viewing direction: 'z' for a TOP-DOWN camera (solarSystemEngine.js),
 *   'x' for a FRONT-FACING camera (planetPreviewEngine.js). Rotating a tilt
 *   around an axis PARALLEL to the view direction only rolls it in the
 *   image plane and never reads as a real 3D tilt/opens a ring into an
 *   ellipse — the axis must be perpendicular to the view direction.
 */
export function buildPlanetBody(data, { radius = data.radius, tiltAxis = 'z' } = {}) {
  const tiltGroup = new THREE.Group();
  if (tiltAxis === 'x') {
    tiltGroup.rotation.x = THREE.MathUtils.degToRad(data.tilt ?? 0);
  } else {
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(data.tilt ?? 0);
  }

  const geometry = new THREE.SphereGeometry(radius, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    map: loadPlanetTexture(data.texture, { saturate: true }),
    roughness: 0.85,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  tiltGroup.add(mesh);

  let clouds = null;
  if (data.hasClouds) {
    const cloudGeo = new THREE.SphereGeometry(radius * 1.03, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      alphaMap: loadPlanetTexture(data.cloudTexture, { srgb: false }),
      transparent: true,
      // Without an explicit opacity cap, the alphaMap alone drives alpha
      // (bright/white cloud-covered pixels in the texture render at FULL
      // opacity, 1.0), which blankets the whole globe and hides the actual
      // planet surface underneath almost entirely.
      opacity: 0.1,
      depthWrite: false,
      roughness: 1,
    });
    clouds = new THREE.Mesh(cloudGeo, cloudMat);
    mesh.add(clouds);
  }

  let atmosphere = null;
  if (data.hasAtmosphere) {
    const atmoGeo = new THREE.SphereGeometry(radius * 1.06, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x5fa8ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    });
    atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    mesh.add(atmosphere);
  }

  let ring = null;
  if (data.hasRings) {
    const inner = radius * 1.15;
    const outer = radius * 2.3;
    const ringGeo = new THREE.RingGeometry(inner, outer, 96, 1);
    const posAttr = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v3.fromBufferAttribute(posAttr, i);
      const dist = v3.length();
      const t = (dist - inner) / (outer - inner);
      uv.setXY(i, t, 0.5);
    }
    const ringMat = new THREE.MeshBasicMaterial({
      map: loadPlanetTexture(data.ringTexture, { srgb: false }),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    ring = new THREE.Mesh(ringGeo, ringMat);
    if (tiltAxis === 'z') {
      // RingGeometry natively lies in the XY plane facing the camera; a
      // TOP-DOWN camera needs it flipped flat into the XZ plane first.
      ring.rotation.x = Math.PI / 2;
    }
    // Sibling of mesh (both children of tiltGroup) so the ring shares the
    // planet's tilt but does NOT spin with the mesh's own fast self-rotation.
    tiltGroup.add(ring);
  }

  return { tiltGroup, mesh, material, clouds, atmosphere, ring };
}
