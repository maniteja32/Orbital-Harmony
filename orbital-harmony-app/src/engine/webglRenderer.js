import * as THREE from 'three';

export function createWebGLRenderer(canvas, options = {}) {
  const context = canvas.getContext('webgl2', options);
  if (context) {
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
    context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  return new THREE.WebGLRenderer({ ...options, canvas, ...(context ? { context } : {}) });
}