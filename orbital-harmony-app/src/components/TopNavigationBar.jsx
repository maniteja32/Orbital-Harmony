import { useLayoutEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';

/** Reusable top navigation bar component with centered title and back button.
 * Provides consistent alignment and styling across all screens.
 */
export function TopNavigationBar({ title, onBack, icon: Icon = ArrowLeft }) {
  const titleRef = useRef(null);

  useLayoutEffect(() => {
    const titleElement = titleRef.current;
    if (!titleElement) return undefined;

    const fitTitle = () => {
      const maxSize = 18;
      const minSize = 10;
      const availableWidth = titleElement.clientWidth;
      const styles = getComputedStyle(titleElement);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context || availableWidth <= 0) return;
      context.font = `${styles.fontStyle} ${styles.fontWeight} ${maxSize}px ${styles.fontFamily}`;
      const letterSpacing = maxSize * 0.01 * Math.max(0, title.length - 1);
      const renderedWidth = context.measureText(title).width + letterSpacing;
      const targetWidth = Math.max(0, availableWidth - 4);
      const fittedSize = Math.max(minSize, Math.min(maxSize, maxSize * (targetWidth / renderedWidth)));
      titleElement.style.setProperty('--topbar-title-size', `${fittedSize.toFixed(2)}px`);
    };

    const resizeObserver = new ResizeObserver(fitTitle);
    resizeObserver.observe(titleElement);
    fitTitle();
    document.fonts?.ready.then(fitTitle);

    return () => resizeObserver.disconnect();
  }, [title]);

  return (
    <div className="mode-topbar mode-topbar--title">
      <button
        type="button"
        className="back-button back-button--icon"
        onClick={onBack}
        aria-label="Back"
      >
        <Icon size={24} strokeWidth={2} aria-hidden="true" />
      </button>
      <h1 ref={titleRef} className="topbar-title" title={title}>{title}</h1>
      <span />
    </div>
  );
}
