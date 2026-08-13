import * as THREE from 'three';

export function createWebGLRenderer(canvas, options = {}) {
  let context = null;
  try {
    context = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
  } catch {
    context = null;
  }
  if (context) {
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
    context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  return new THREE.WebGLRenderer({ ...options, canvas, ...(context ? { context } : {}) });
}