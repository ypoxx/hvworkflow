/**
 * Speaker vocabulary. `src/i18n/labels.ts` covers question statuses, tracks and podium assignments;
 * the kind of a Wortmeldung and the state of a speaker appear only on this screen, so their lookup
 * lives next to it. The maps use domain values as keys — a display lookup, never a rights decision
 * (AGENTS.md rule 4).
 */
import type { LucideIcon } from 'lucide-react';
import { Briefcase, User, Users } from 'lucide-react';
import type { SpeakerKind, SpeakerStatus } from '@hv/domain';
import type { BadgeTone } from '../../components';
import type { TKey, Translate } from '../../i18n';

const KIND_KEYS: Readonly<Record<SpeakerKind, TKey>> = {
  shareholder: 'speakers.kind.shareholder',
  proxy: 'speakers.kind.proxy',
  association: 'speakers.kind.association',
};

/** One glyph per Wortmeldung kind, so "Art" reads before the label is even parsed (point 4). */
export const KIND_ICON: Readonly<Record<SpeakerKind, LucideIcon>> = {
  shareholder: User,
  proxy: Briefcase,
  association: Users,
};

const STATE_KEYS: Readonly<Record<SpeakerStatus, TKey>> = {
  waiting: 'speakers.state.waiting',
  speaking: 'speakers.state.speaking',
  finished: 'speakers.state.finished',
  withdrawn: 'speakers.state.withdrawn',
};

/** Quiet tints only: at 118 rows a coloured list would be unreadable (design principle 4). */
export const STATE_TONE: Readonly<Record<SpeakerStatus, BadgeTone>> = {
  waiting: 'neutral',
  speaking: 'accent',
  finished: 'outline',
  withdrawn: 'danger',
};

export function speakerKindLabel(t: Translate, kind: SpeakerKind): string {
  return t(KIND_KEYS[kind]);
}

export function speakerStateLabel(t: Translate, status: SpeakerStatus): string {
  return t(STATE_KEYS[status]);
}

/** mm:ss; the minutes may pass 59 — a speech that runs long must stay readable at a glance. */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
