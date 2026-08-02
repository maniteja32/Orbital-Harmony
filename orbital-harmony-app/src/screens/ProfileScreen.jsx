import { ArrowLeft, User, BarChart3, Trophy, Settings, Info, HelpCircle, ChevronRight } from 'lucide-react';
import { BottomNav } from '../components/BottomNav.jsx';

/** Screen 11 — Profile & Settings. Guest identity, a settings/menu list, and
 *  the persistent bottom tab bar. Rows are placeholders for now (no auth or
 *  settings store yet) — wired as buttons so they're ready to route later. */
const ROWS = [
  { key: 'stats', label: 'My Stats', icon: BarChart3 },
  { key: 'achievements', label: 'Achievements', icon: Trophy },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'about', label: 'About Orbital Harmony', icon: Info },
  { key: 'help', label: 'Help & Feedback', icon: HelpCircle },
];

export default function ProfileScreen({ onBack }) {
  return (
    <div className="screen screen--profile">
      <div className="mode-topbar">
        <button
          type="button"
          className="back-button back-button--icon"
          onClick={onBack}
          aria-label="Back to home"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="screen__header screen__header--mode">
        <h1>Profile</h1>
      </div>

      <div className="profile-scroll">
        <div className="profile-hero">
          <span className="profile-avatar" aria-hidden="true">
            <User size={30} strokeWidth={1.6} />
          </span>
          <span className="profile-name">Guest User</span>
          <span className="profile-sub">Sign in to save your patterns across devices</span>
        </div>

        <div className="profile-list">
          {ROWS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className="profile-row">
              <span className="profile-row__icon">
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="profile-row__label">{label}</span>
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" className="profile-row__chevron" />
            </button>
          ))}
        </div>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
