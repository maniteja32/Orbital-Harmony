import { Music2, VolumeX } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

export function GlobalMusicToggle() {
  const enabled = useAppStore((s) => s.backgroundMusicEnabled);
  const setEnabled = useAppStore((s) => s.setBackgroundMusicEnabled);

  return (
    <button
      type="button"
      className={`icon-button global-music-toggle${enabled ? ' is-active' : ''}`}
      onClick={() => setEnabled(!enabled)}
      aria-pressed={enabled}
      aria-label={enabled ? 'Turn off background music' : 'Turn on background music'}
      title={enabled ? 'Background music on' : 'Background music off'}
    >
      {enabled ? <Music2 size={20} strokeWidth={1.9} aria-hidden="true" /> : <VolumeX size={20} strokeWidth={1.9} aria-hidden="true" />}
    </button>
  );
}
