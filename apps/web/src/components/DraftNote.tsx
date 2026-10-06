/**
 * Scheibe 060 (decisions 5 and 6): the quiet lines of the draft buffer next to the answer field — "in diesem Browser
 * zwischengespeichert · HH:MM:SS" (only after the write completed; no live region, it is not news), "Ungespeicherter
 * Entwurf von HH:MM wiederhergestellt", and once "Keine Sicherung auf diesem Gerät möglich". Times in mono (D5).
 *
 * The kept line says "in this browser", not "on this device": a private window drops IndexedDB when it closes, and the
 * window is not detected (no reliable interface; probing quota or storage APIs would be a device fingerprint, nit N4).
 * Its help sentence is the `title` and, for a screen reader, the description.
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../i18n';
import type { TKey } from '../i18n';

const two = (n: number): string => String(n).padStart(2, '0');

function clock(ms: number, seconds: boolean): string {
  const at = new Date(ms);
  const base = `${two(at.getHours())}:${two(at.getMinutes())}`;
  return seconds ? `${base}:${two(at.getSeconds())}` : base;
}

/** The sentence with its `{time}` placeholder replaced by the time in mono. */
function withTime(template: string, time: string): ReactNode {
  const [before, after = ''] = template.split('{time}');
  return (
    <>
      {before}
      <span className="font-mono">{time}</span>
      {after}
    </>
  );
}

export interface DraftNoteProps {
  kind: 'kept' | 'restored' | 'unavailable';
  /** Milliseconds since the epoch (kept: the completed write; restored: the last change of the restored text). */
  time?: number;
}

export function DraftNote({ kind, time }: DraftNoteProps) {
  const t = useT();
  const helpId = useId();
  if (kind === 'unavailable') {
    return (
      <span data-testid="draft-unavailable" className="text-2xs text-ink-600">
        {t('common.draft.unavailable')}
      </span>
    );
  }
  const key: TKey = kind === 'kept' ? 'common.draft.kept' : 'common.draft.restored';
  const sentence = withTime(t(key), time === undefined ? '' : clock(time, kind === 'kept'));
  if (kind === 'restored') {
    return (
      <p data-testid="draft-restored" className="mt-0.5 text-2xs text-ink-600">
        {sentence}
      </p>
    );
  }
  const help = t('common.draft.keptHelp');
  return (
    <span data-testid="draft-kept" className="text-2xs text-ink-600" title={help} aria-describedby={helpId}>
      {sentence}
      <span id={helpId} hidden>
        {help}
      </span>
    </span>
  );
}
