/** Subtle, occasional "shooting star" decoration for the gap between the
 * Planet A / Planet B carousels on the Select screen — purely CSS-driven
 * (no JS timers/randomness needed): each meteor is a long (16-22s) CSS
 * animation that's invisible for almost its whole cycle and only streaks
 * across briefly near the start, so with `animation-iteration-count:
 * infinite` it naturally repeats every ~16-22s. Two meteors with
 * different durations/delays/start positions/angles (see index.css'
 * `.meteor--1`/`.meteor--2`) drift in and out of sync with each other for
 * a more organic, less mechanically-repeating feel than a single looping
 * meteor would. Purely decorative — aria-hidden, no pointer events. */
export function MeteorField() {
  return (
    <div className="meteor-field" aria-hidden="true">
      <span className="meteor meteor--1" />
      <span className="meteor meteor--2" />
    </div>
  );
}
