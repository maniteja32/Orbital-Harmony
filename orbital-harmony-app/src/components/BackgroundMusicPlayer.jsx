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

    let disposed = false;
    let playInFlight = false;

    // Mobile Safari/WebView can reject the first few play() calls even after
    // interaction (timing/race around media readiness and gesture handling).
    // Keep lightweight retries wired to future interactions + visibility
    // returns until playback actually starts.
    const unlockEvents = ['pointerdown', 'touchend', 'keydown', 'click'];

    function stopUnlockListeners() {
      unlockEvents.forEach((event) => {
        document.removeEventListener(event, tryPlay, true);
      });
      window.removeEventListener('focus', tryPlay);
      window.removeEventListener('pageshow', tryPlay);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      audio.removeEventListener('canplay', tryPlay);
      audio.removeEventListener('playing', stopUnlockListeners);
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') tryPlay();
    }

    function tryPlay() {
      if (disposed || !enabled || playInFlight) return;
      playInFlight = true;
      const attempt = audio.play();
      if (!attempt || typeof attempt.then !== 'function') {
        playInFlight = false;
        stopUnlockListeners();
        return;
      }
      attempt
        .then(() => {
          playInFlight = false;
          stopUnlockListeners();
        })
        .catch(() => {
          playInFlight = false;
        });
    }

    unlockEvents.forEach((event) => {
      document.addEventListener(event, tryPlay, { passive: true, capture: true });
    });
    window.addEventListener('focus', tryPlay);
    window.addEventListener('pageshow', tryPlay);
    document.addEventListener('visibilitychange', onVisibilityChange);
    audio.addEventListener('canplay', tryPlay);
    audio.addEventListener('playing', stopUnlockListeners);

    tryPlay();

    return () => {
      disposed = true;
      stopUnlockListeners();
    };
  }, [enabled]);

  return (
    <div className="bg-music-player" aria-hidden="true">
      <audio
        ref={audioRef}
        src={MUSIC_SRC}
        loop
        preload="auto"
        playsInline
      />
    </div>
  );
}
