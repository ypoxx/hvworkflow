/**
 * A quiet read on one ratio — never a spinner: the value stays a number a screen reader can announce,
 * not just a shape in motion (docs/design-prinzipien.md #8: skeletons and numbers, not spinners).
 */
import type { ReactNode } from 'react';
import { cx } from './cx';

export type ProgressTone = 'accent' | 'warn' | 'muted';

const TRACK = 'var(--color-ink-150)';

/** Reuses existing tone tokens; 'warn' borrows the warning badge's foreground shade. */
const FILL: Readonly<Record<ProgressTone, string>> = {
  accent: 'var(--color-accent-500)',
  warn: 'var(--color-tone-warning-fg)',
  muted: 'var(--color-ink-400)',
};

function ratio(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

export interface ProgressBarProps {
  value: number;
  max: number;
  tone?: ProgressTone;
  /** Accessible name; the bar carries no visible caption of its own. */
  label?: string;
  className?: string;
}

export function ProgressBar({ value, max, tone = 'accent', label, className }: ProgressBarProps) {
  const percent = ratio(value, max) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...(label !== undefined ? { 'aria-label': label } : {})}
      className={cx('h-1 w-full overflow-hidden rounded-full', className)}
      style={{ background: TRACK }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-100"
        style={{ width: `${percent}%`, background: FILL[tone] }}
      />
    </div>
  );
}

export interface ProgressRingProps {
  value: number;
  max: number;
  tone?: ProgressTone;
  label?: string;
  /** Short text placed in the centre of the ring, e.g. a percentage. */
  children?: ReactNode;
  className?: string;
}

const RING_SIZE = 28;
const STROKE = 3;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ value, max, tone = 'accent', label, children, className }: ProgressRingProps) {
  const percent = ratio(value, max);
  const offset = CIRCUMFERENCE * (1 - percent);
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...(label !== undefined ? { 'aria-label': label } : {})}
      className={cx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} fill="none" stroke={TRACK} strokeWidth={STROKE} />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={FILL[tone]}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          className="transition-[stroke-dashoffset] duration-100"
        />
      </svg>
      {children !== undefined && (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-medium tabular-nums text-ink-800">
          {children}
        </span>
      )}
    </div>
  );
}
