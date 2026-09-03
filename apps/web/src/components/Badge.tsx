/**
 * Status is shown as a quiet tint, never as a saturated block: at 800 questions a coloured list
 * would be unreadable. The colour comes from a `tone-*` class in `src/styles/index.css` so that the
 * class scanner sees every possible value.
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Mic, Users, Zap } from 'lucide-react';
import type { QuestionStatus, StageAssignment, Track } from '@hv/domain';
import type { TKey } from '../i18n';
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

/**
 * Every status collapses into one of four meanings — waiting, active, done, closed — so colour keeps
 * carrying meaning once a list runs to hundreds of rows (docs/design-prinzipien.md #4). The finer
 * eleven-way `.tone-status-*` tokens in index.css stay defined for components that still need them.
 */
const STATUS_TONE_GROUP: Readonly<Record<QuestionStatus, BadgeTone>> = {
  captured: 'warning',
  classified: 'warning',
  assigned: 'warning',
  in_review: 'warning',
  answer_drafted: 'accent',
  staged: 'accent',
  delivered: 'accent',
  approved: 'success',
  closed: 'neutral',
  withdrawn: 'neutral',
  merged: 'neutral',
};

export function statusTone(status: QuestionStatus): BadgeTone {
  return STATUS_TONE_GROUP[status];
}

const TRACK_TONE: Readonly<Record<Track, string>> = {
  podium: 'tone-track-podium',
  fast_track: 'tone-track-fast',
  expert_track: 'tone-track-expert',
};

/** One glyph per answer track, so the track reads before the label is even parsed. */
const TRACK_ICON: Readonly<Record<Track, LucideIcon>> = {
  podium: Mic,
  fast_track: Zap,
  expert_track: Users,
};

/** Two-letter shorthand for the 20px podium-queue circle; full names live in `stage.*`. */
const STAGE_INITIALS_KEY: Readonly<Record<StageAssignment, TKey>> = {
  supervisory_board_chair: 'stage.initials.supervisory_board_chair',
  ceo: 'stage.initials.ceo',
  cfo: 'stage.initials.cfo',
  board_member: 'stage.initials.board_member',
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
    <span className={cx('hv-badge hv-badge-dot', TONE[statusTone(status)], className)}>
      {statusLabel(t, status)}
    </span>
  );
}

export function TrackBadge({ track, className }: { track: Track; className?: string }) {
  const t = useT();
  const Icon = TRACK_ICON[track];
  return (
    <span className={cx('hv-badge', TRACK_TONE[track], className)}>
      <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
      {trackShortLabel(t, track)}
    </span>
  );
}

export function StageAssignmentBadge({
  assignment,
  variant,
  className,
}: {
  assignment: StageAssignment;
  /** 'initials' renders the 20px podium-queue circle instead of the full-width pill. */
  variant?: 'initials';
  className?: string;
}) {
  const t = useT();
  const fullLabel = stageAssignmentLabel(t, assignment);
  if (variant === 'initials') {
    return (
      <span
        className={cx(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-sunken font-mono text-2xs font-medium text-ink-700',
          className,
        )}
        title={fullLabel}
        aria-label={fullLabel}
      >
        {t(STAGE_INITIALS_KEY[assignment])}
      </span>
    );
  }
  return (
    <span className={cx('hv-badge tone-outline', className)}>{fullLabel}</span>
  );
}
