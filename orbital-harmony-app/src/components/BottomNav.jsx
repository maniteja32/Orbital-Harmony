import { Home, Orbit, Heart, User } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Persistent bottom tab bar for the "root" destinations (Home / Explore /
 * Collection / Profile), matching the product wireframe. Rendered by the
 * screens that are reachable as tabs (Collection, Profile); pass `active`
 * to force which tab reads as current.
 */
const TABS = [
  { key: 'system', label: 'Home', icon: Home },
  { key: 'select', label: 'Explore', icon: Orbit },
  { key: 'collection', label: 'Collection', icon: Heart },
  { key: 'profile', label: 'Profile', icon: User },
];

export function BottomNav({ active }) {
  const screen = useAppStore((s) => s.screen);
  const goTo = useAppStore((s) => s.goTo);
  const setPatternMode = useAppStore((s) => s.setPatternMode);
  const setCosmicDate = useAppStore((s) => s.setCosmicDate);
  const current = active ?? screen;

  const handle = (key) => {
    if (key === current) return;
    if (key === 'select') {
      // Explore always starts a fresh two-planet pick.
      setPatternMode('explore');
      setCosmicDate(null);
    }
    goTo(key);
  };

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = current === key;
        return (
          <button
            key={key}
            type="button"
            className={`bottom-nav__tab${isActive ? ' is-active' : ''}`}
            onClick={() => handle(key)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNav;
