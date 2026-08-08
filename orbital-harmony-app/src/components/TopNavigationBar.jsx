import { ArrowLeft } from 'lucide-react';

/** Reusable top navigation bar component with centered title and back button.
 * Provides consistent alignment and styling across all screens.
 */
export function TopNavigationBar({ title, onBack, icon: Icon = ArrowLeft }) {
  return (
    <div className="mode-topbar">
      <button
        type="button"
        className="back-button back-button--icon"
        onClick={onBack}
        aria-label="Back"
      >
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      <h1 className="topbar-title">{title}</h1>
      <span />
    </div>
  );
}
