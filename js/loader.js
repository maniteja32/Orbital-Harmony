// ============================================================================
// Orbital Harmony — premium loader animation.
// Deliberately plain HTML/CSS/JS with NO dependency on Three.js (or any
// module import), so it renders and starts animating immediately, before
// the (much heavier) 3D engine has even finished downloading. All motion
// otherwise visible in the loader — the pulsing sun, self-drawing orbit
// rings, and orbiting planets — is pure CSS (GPU/compositor-friendly
// transforms and SVG stroke-dashoffset), so this script only needs to
// handle the starfield/particle canvas.
// ============================================================================
(function () {
  var canvas = document.getElementById('loaderStars');
  var loadingEl = document.getElementById('loading');
  if (!canvas || !loadingEl) return;

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var stars = [];
  var particles = [];
  var rafId = null;
  var running = true;

  function resize() {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // A modest star count keeps this trivially cheap (well under 1ms/frame),
  // leaving plenty of headroom for a smooth 60fps loader animation.
  var STAR_COUNT = 160;
  for (var i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: (Math.random() * 1.4 + 0.3) * dpr,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.0015 + 0.0006,
    });
  }

  // Subtle drifting dust particles for extra depth, per the "subtle particle
  // effects" requirement — slow, faint, and few in number so they stay subtle.
  var PARTICLE_COUNT = 36;
  for (var j = 0; j < PARTICLE_COUNT; j++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.12 * dpr,
      vy: (Math.random() - 0.5) * 0.12 * dpr,
      r: (Math.random() * 1.1 + 0.4) * dpr,
      alpha: Math.random() * 0.25 + 0.08,
    });
  }

  function draw(time) {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var si = 0; si < stars.length; si++) {
      var s = stars[si];
      var twinkle = 0.5 + 0.5 * Math.sin(time * s.speed + s.phase);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 230, 255, ' + (0.25 + twinkle * 0.5) + ')';
      ctx.fill();
    }

    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      else if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      else if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(143, 180, 255, ' + p.alpha + ')';
      ctx.fill();
    }

    rafId = requestAnimationFrame(draw);
  }
  rafId = requestAnimationFrame(draw);

  // Stop the animation loop (and free up the main thread) the moment the
  // main app adds the "hidden" class — no point burning frames on a canvas
  // that's fading out and about to be irrelevant.
  var observer = new MutationObserver(function () {
    if (loadingEl.classList.contains('hidden')) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    }
  });
  observer.observe(loadingEl, { attributes: true, attributeFilter: ['class'] });
})();
