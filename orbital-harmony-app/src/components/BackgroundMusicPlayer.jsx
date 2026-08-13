import { useEffect, useRef } from 'react';

const MUSIC_SRC = '/audio/background-track.mp3';

export function BackgroundMusicPlayer({ enabled }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    if (!enabled) {
      audio.pause();
      return undefined;
    }

    // Browsers block real autoplay until the page has had at least one user
    // interaction, so the very first play() call here (fired the moment the
    // home screen mounts) is expected to reject silently — retrying on the
    // first tap/key anywhere is what actually starts the music as early as
    // possible instead of waiting for the user to find the mute button.
    const tryPlay = () => audio.play().catch(() => {});
    tryPlay();

    const events = ['pointerdown', 'keydown'];
    events.forEach((event) => document.addEventListener(event, tryPlay, { once: true }));
    return () => {
      events.forEach((event) => document.removeEventListener(event, tryPlay));
    };
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
