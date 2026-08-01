//
// LiquidGlassIconButton.jsx
//
// Circular, frosted "Liquid Glass" icon button — the web counterpart of the
// native SwiftUI `LiquidGlassButton` (see ios/OrbitalHarmony/App/
// Components/LiquidGlassButton.swift for the same design language ported
// to native materials). Used for every icon-only control on the Simulation
// screen (trace style, play/pause, reset, speed) — see index.css's
// "Liquid Glass icon buttons" section for the actual visual layers.
//
// Visual layers (back to front, all circular) — REVISED to read as a thin
// floating glass DISC rather than a glossy sphere (see index.css's own
// comments for the full reasoning behind each layer):
//   1. `.glass-btn__base`  — translucent fill + native `backdrop-filter`
//      (refraction via an SVG displacement filter + blur — the actual
//      "see-through, bends what's behind it" glass effect, not just a
//      flat blur).
//   2. `.glass-btn__frost` — a smaller, inset "inner pane" layer with its
//      own faint blur/opacity — simulates the glass having real
//      thickness/a second surface, the biggest contributor to "layered
//      translucency" rather than one flat sheet.
//   3. `.glass-btn__sheen` — MULTIPLE small, soft highlights (not one big
//      hotspot), blended gently so they read as natural light catching
//      curved glass rather than a plastic glare.
//   4. `.glass-btn__rim`   — a thin bright hairline at the very edge, with
//      only a faint hint of chromatic dispersion right at the top (not a
//      strong pink/blue ring).
//   5. `.glass-btn__icon`  — the glyph, softly embedded rather than
//      floating brightly on top.
// `isActive` keeps the brighter rim/sheen/glow even at rest (e.g. Play
// while playing, or a non-default speed step) — independent of the
// momentary `:active` (press) state, which is handled entirely in CSS for
// an instant, gesture-accurate response with no extra JS state.
//
import { forwardRef } from 'react';

const LiquidGlassIconButton = forwardRef(function LiquidGlassIconButton(
  { icon, label, size = 62, isActive = false, pressed, badge, onClick, className = '' },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`glass-btn ${isActive ? 'is-active' : ''} ${className}`.trim()}
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
    >
      <span className="glass-btn__base" aria-hidden="true" />
      <span className="glass-btn__frost" aria-hidden="true" />
      <span className="glass-btn__sheen" aria-hidden="true" />
      <span className="glass-btn__rim" aria-hidden="true" />
      <span className="glass-btn__icon">{icon}</span>
      {badge}
    </button>
  );
});

export default LiquidGlassIconButton;
