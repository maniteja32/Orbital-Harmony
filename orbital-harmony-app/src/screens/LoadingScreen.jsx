import { useEffect, useState } from 'react';

/** Premium animated loading screen — pure CSS (pulsing sun, self-drawing
 * orbit rings via SVG stroke-dashoffset, orbiting dots) so it renders and
 * animates instantly, no Three.js/WebGL dependency. Auto-advances after a
 * short, intentional beat. */
export default function LoadingScreen({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2400);
    const t2 = setTimeout(onDone, 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div className={`loading-screen${leaving ? ' is-leaving' : ''}`}>
      <div className="loading-scene">
        <svg className="loading-orbits" viewBox="0 0 280 280">
          <circle className="loading-ring loading-ring--1" cx="140" cy="140" r="55" />
          <circle className="loading-ring loading-ring--2" cx="140" cy="140" r="90" />
          <circle className="loading-ring loading-ring--3" cx="140" cy="140" r="125" />
        </svg>
        <div className="loading-sun" />
        <div className="loading-orbit-wrap loading-orbit-wrap--1">
          <div className="loading-planet loading-planet--1" />
        </div>
        <div className="loading-orbit-wrap loading-orbit-wrap--2">
          <div className="loading-planet loading-planet--2" />
        </div>
        <div className="loading-orbit-wrap loading-orbit-wrap--3">
          <div className="loading-planet loading-planet--3" />
        </div>
      </div>
      <div className="loading-text">
        <span className="loading-title">Orbital Harmony</span>
        <span className="loading-dots"><i /><i /><i /></span>
      </div>
    </div>
  );
}
