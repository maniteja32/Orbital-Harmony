/** Simple, premium crossfade/slide-up transition for whole-screen swaps.
 *  Remounting via `key` (done by the caller) retriggers the CSS animation
 *  below — no animation library needed for a single-direction wizard flow. */
export default function ScreenTransition({ children }) {
  return <div className="screen-transition">{children}</div>;
}
