/**
 * A distribution shown as one quiet stacked bar plus its numbers underneath: colour alone never has
 * to carry the count (docs/design-prinzipien.md #4), so the bar stays legible at 800 questions.
 */
import type { BadgeTone } from './Badge';
import { cx } from './cx';

export interface ProcessStripSegment {
  key: string;
  label: string;
  count: number;
  tone: BadgeTone | 'muted';
}

export interface ProcessStripProps {
  segments: ProcessStripSegment[];
  /** Denominator for bar widths; defaults to the sum of segment counts. */
  total?: number;
  selected?: string[];
  onSelect?: (key: string) => void;
  /** Hides the label of a zero-count segment instead of showing it muted. */
  compact?: boolean;
  /** One line, 10px labels, no wrap — for a tight space like the header (design review, 005). */
  dense?: boolean;
  testIdPrefix?: string;
}

/** The existing tone tokens double as bar fills — no new colours for this slice (index.css #005 point 9). */
const BAR_FILL: Readonly<Record<BadgeTone | 'muted', string>> = {
  neutral: 'var(--color-tone-neutral-fg)',
  accent: 'var(--color-tone-accent-fg)',
  success: 'var(--color-tone-success-fg)',
  warning: 'var(--color-tone-warning-fg)',
  danger: 'var(--color-tone-danger-fg)',
  outline: 'var(--color-ink-600)',
  muted: 'var(--color-ink-400)',
};

export function ProcessStrip({
  segments,
  total,
  selected,
  onSelect,
  compact = false,
  dense = false,
  testIdPrefix,
}: ProcessStripProps) {
  const denominator = total ?? segments.reduce((sum, segment) => sum + segment.count, 0);
  const shownLabels = compact ? segments.filter((segment) => segment.count > 0) : segments;

  return (
    <div className="flex flex-col gap-1">
      <div
        aria-hidden="true"
        className="flex h-1.5 w-full overflow-hidden rounded-[3px] bg-ink-150"
      >
        {segments.map((segment) => {
          const pct = denominator > 0 ? (segment.count / denominator) * 100 : 0;
          const isSelected = selected?.includes(segment.key) ?? false;
          return (
            <span
              key={segment.key}
              style={{
                width: `${pct}%`,
                backgroundColor: BAR_FILL[segment.tone],
                opacity: isSelected ? 1 : 0.6,
              }}
              className="h-full"
            />
          );
        })}
      </div>

      <div
        className={cx(
          'flex items-baseline gap-x-3',
          dense ? 'flex-nowrap' : 'flex-wrap gap-y-0.5',
        )}
      >
        {shownLabels.map((segment) => {
          const zero = segment.count === 0;
          const isSelected = selected?.includes(segment.key) ?? false;
          const testId = testIdPrefix !== undefined ? `${testIdPrefix}-${segment.key}` : undefined;
          const content = (
            <>
              <span
                className={cx(
                  dense ? 'text-[10px] font-medium tracking-[0.06em] text-ink-500 uppercase' : 'hv-label',
                  zero && 'text-ink-300',
                )}
              >
                {segment.label}
              </span>
              <span
                className={cx(
                  'font-mono text-[12px] leading-4 tabular-nums',
                  zero ? 'text-ink-300' : 'text-ink-800',
                )}
              >
                {segment.count}
              </span>
            </>
          );
          if (onSelect !== undefined) {
            return (
              <button
                key={segment.key}
                type="button"
                aria-pressed={isSelected}
                {...(testId !== undefined ? { 'data-testid': testId } : {})}
                onClick={() => onSelect(segment.key)}
                className={cx(
                  '-mx-1 flex shrink-0 items-baseline gap-1 rounded-sm px-1 whitespace-nowrap transition-colors',
                  isSelected ? 'bg-accent-50' : 'hover:bg-ink-50',
                )}
              >
                {content}
              </button>
            );
          }
          return (
            <span
              key={segment.key}
              {...(testId !== undefined ? { 'data-testid': testId } : {})}
              className="flex shrink-0 items-baseline gap-1 whitespace-nowrap"
            >
              {content}
            </span>
          );
        })}
      </div>
    </div>
  );
}
