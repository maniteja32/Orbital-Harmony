import { useState } from 'react';
import { ArrowLeft, Download, Camera, MessageCircle, MoreHorizontal, Link2, Check } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { PatternGlyph } from '../components/PatternGlyph.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { useAppStore } from '../store/useAppStore.js';
import { formatCosmicSignatureDate } from '../utils/cosmicSignature.js';

function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Screen 10 — Share Pattern. Preview of the current figure plus quick
 *  share targets and a copy-link action. */
export default function SharePatternScreen({ onBack }) {
  const { planetA, planetB, snapshot, patternMode, cosmicDate } = useAppStore();
  const isCosmic = patternMode === 'cosmic';
  const a = planetA ? PLANETS_BY_KEY[planetA] : null;
  const b = planetB ? PLANETS_BY_KEY[planetB] : null;
  const cosmicDateLabel = formatCosmicSignatureDate(cosmicDate);
  const title = isCosmic
    ? `Cosmic Signature${cosmicDateLabel ? ` · ${cosmicDateLabel}` : ''}`
    : a && b
      ? `${a.name} · ${b.name}`
      : 'Cosmic Signature';

  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = `https://orbital-harmony.app/p/${(a?.key ?? 'cosmic')}-${b?.key ?? 'signature'}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard may be unavailable — still show the confirmation */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Space Harmony — ${title}`, text: `${title} orbital pattern` });
      }
    } catch {
      /* user dismissed / unsupported */
    }
  };

  const targets = [
    { key: 'download', label: 'Download', icon: Download, onClick: () => downloadDataUrl(snapshot, 'orbital-harmony.png') },
    { key: 'instagram', label: 'Instagram', icon: Camera, onClick: nativeShare },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, onClick: nativeShare },
    { key: 'more', label: 'More', icon: MoreHorizontal, onClick: nativeShare },
  ];

  return (
    <div className="screen screen--share">
      <div className="mode-topbar">
        <button
          type="button"
          className="back-button back-button--icon"
          onClick={onBack}
          aria-label="Back to your pattern"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="screen__header screen__header--mode">
        <h1>Share</h1>
      </div>

      <div className="share-preview">
        {snapshot ? (
          <img src={snapshot} alt={title} />
        ) : (
          <span className="share-preview__glyph" aria-hidden="true">
            <PatternGlyph seedA={5} seedB={3} d={5} size={220} strokeWidth={0.5} />
          </span>
        )}
        <span className="share-preview__title">{title}</span>
      </div>

      <div className="share-targets">
        {targets.map(({ key, label, icon: Icon, onClick }) => (
          <button key={key} type="button" className="share-target" onClick={onClick}>
            <span className="share-target__icon">
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="share-target__label">{label}</span>
          </button>
        ))}
      </div>

      <div className="screen__actions">
        <GlassButton tone="primary" className="w-full h-11 text-base font-medium" onClick={copyLink}>
          {copied ? (
            <span className="share-copied">
              <Check size={18} strokeWidth={2.4} aria-hidden="true" /> Link copied
            </span>
          ) : (
            <span className="share-copied">
              <Link2 size={18} strokeWidth={2} aria-hidden="true" /> Copy Link
            </span>
          )}
        </GlassButton>
      </div>
    </div>
  );
}
