import { useEffect, useRef } from 'react';

const MUSIC_SRC = '/audio/background-track.mp3';

export function BackgroundMusicPlayer({ enabled }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (enabled) {
      // Play attempts can fail until the user has interacted with the page.
      audio.play().catch(() => {});
      return;
    }

    audio.pause();
  }, [enabled]);

  return (
    <div className="bg-music-player" aria-hidden="true">
      <audio
        ref={audioRef}
        src={MUSIC_SRC}
        loop
        preload="auto"
      />
    </div>
  );
}
