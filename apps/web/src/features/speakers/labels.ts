/**
 * Speaker vocabulary. `src/i18n/labels.ts` covers question statuses, tracks and podium assignments;
 * the state of a speaker appears only on this screen, so its lookup
 * lives next to it. The maps use domain values as keys — a display lookup, never a rights decision
 * (AGENTS.md rule 4).
 */
import type { SpeakerStatus } from '@hv/domain';
import type { BadgeTone } from '../../components';
import type { TKey, Translate } from '../../i18n';

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

export function speakerStateLabel(t: Translate, status: SpeakerStatus): string {
  return t(STATE_KEYS[status]);
}
