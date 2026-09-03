/**
 * The time-budget ring next to the mm:ss timer in "Am Mikrofon" (docs/design-prinzipien.md #2:
 * dense but legible; 28 px ring, tone accent until the requested minutes are used up, warn after).
 *
 * The kit's `ProgressRing` (apps/web/src/components/Progress.tsx) already renders exactly this
 * visual, but its props carry no way to attach a `data-testid` (or any other DOM attribute) to the
 * one element that also has to carry `aria-valuenow` — and the kit is out of this slice's allowed
 * files. Composed locally instead, with the same constants and tone tokens as the kit component, so
 * the two stay visually identical; reported as an open finding (kit gap) in the slice report.
 */
import type { ProgressTone } from '../../components';

const RING_SIZE = 28;
const STROKE = 3;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TRACK = 'var(--color-ink-150)';

const FILL: Readonly<Record<ProgressTone, string>> = {
  accent: 'var(--color-accent-500)',
  warn: 'var(--color-tone-warning-fg)',
  muted: 'var(--color-ink-400)',
};

export function TimerRing({
  value,
  max,
  tone,
  label,
  testId,
}: {
  value: number;
  max: number;
  tone: ProgressTone;
  label: string;
  testId: string;
}) {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const offset = CIRCUMFERENCE * (1 - ratio);
  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      data-testid={testId}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={TRACK}
          strokeWidth={STROKE}
        />
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
    </span>
  );
}
