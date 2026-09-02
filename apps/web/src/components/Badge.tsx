/**
 * Status is shown as a quiet tint, never as a saturated block: at 800 questions a coloured list
 * would be unreadable. The colour comes from a `tone-*` class in `src/styles/index.css` so that the
 * class scanner sees every possible value.
 */
import type { ReactNode } from 'react';
import type { QuestionStatus, StageAssignment, Track } from '@hv/domain';
import { stageAssignmentLabel, statusLabel, trackShortLabel, useT } from '../i18n';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'outline';

const TONE: Readonly<Record<BadgeTone, string>> = {
  neutral: 'tone-neutral',
  accent: 'tone-accent',
  success: 'tone-success',
  warning: 'tone-warning',
  danger: 'tone-danger',
  outline: 'tone-outline',
};

const STATUS_TONE: Readonly<Record<QuestionStatus, string>> = {
  captured: 'tone-status-captured',
  classified: 'tone-status-classified',
  assigned: 'tone-status-assigned',
  answer_drafted: 'tone-status-answer-drafted',
  in_review: 'tone-status-in-review',
  approved: 'tone-status-approved',
  staged: 'tone-status-staged',
  delivered: 'tone-status-delivered',
  closed: 'tone-status-closed',
  withdrawn: 'tone-status-withdrawn',
  merged: 'tone-status-merged',
};

const TRACK_TONE: Readonly<Record<Track, string>> = {
  podium: 'tone-track-podium',
  fast_track: 'tone-track-fast',
  expert_track: 'tone-track-expert',
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Leading dot; used where the badge stands in a dense list and the word alone is too quiet. */
  dot?: boolean;
  mono?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot = false, mono = false, title, className, children }: BadgeProps) {
  return (
    <span
      className={cx('hv-badge', TONE[tone], dot && 'hv-badge-dot', mono && 'font-mono', className)}
      {...(title !== undefined ? { title } : {})}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: QuestionStatus; className?: string }) {
  const t = useT();
  return (
    <span className={cx('hv-badge hv-badge-dot', STATUS_TONE[status], className)}>
      {statusLabel(t, status)}
    </span>
  );
}

export function TrackBadge({ track, className }: { track: Track; className?: string }) {
  const t = useT();
  return (
    <span className={cx('hv-badge', TRACK_TONE[track], className)}>{trackShortLabel(t, track)}</span>
  );
}

export function StageAssignmentBadge({
  assignment,
  className,
}: {
  assignment: StageAssignment;
  className?: string;
}) {
  const t = useT();
  return (
    <span className={cx('hv-badge tone-outline', className)}>
      {stageAssignmentLabel(t, assignment)}
    </span>
  );
}
