/**
 * A distribution shown as one quiet stacked bar plus its numbers: colour alone never has to carry the
 * count (docs/design-prinzipien.md #4), so the bar stays legible at 800 questions. Two renderings
 * share one bar: the labelled row (a full label + count per segment, for a page with room to spare —
 * slice 007's answers desk) and `dense` (the header: the bar plus, where a segment is wide enough to
 * hold it, its count — full detail lives in a hover/focus popover, never behind a scroll).
 */
import { useState } from 'react';
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
  /** Hides the label of a zero-count segment instead of showing it muted. Labelled mode only. */
  compact?: boolean;
  /** Bar plus a hover/focus legend, sized in px — for a tight space like the header (005 rework). */
  dense?: boolean;
  /** Pixel width of the bar in `dense` mode; also the denominator for the "wide enough" cutoff. */
  width?: number;
  /** The full distribution as one sentence, e.g. "Distribution: captured 75, …" — `dense`'s aria-label. */
  legend?: string;
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

/** A segment's count prints under the bar only once its slice is wide enough to hold it without crowding. */
const MIN_LABELLED_PX = 28;

function BarRow({
  segments,
  denominator,
  selected,
  widthPx,
}: {
  segments: ProcessStripSegment[];
  denominator: number;
  selected: string[] | undefined;
  widthPx?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex h-1.5 overflow-hidden rounded-[3px] bg-ink-150"
      style={widthPx !== undefined ? { width: `${widthPx}px` } : { width: '100%' }}
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
  );
}

/**
 * The header's rendering: the bar, a per-segment count where it fits, and — the detail that does not
 * fit — a popover on hover or focus. Nothing is ever reachable only by scrolling (design review, 005).
 */
function DenseStrip({
  segments,
  denominator,
  width,
  legend,
}: {
  segments: ProcessStripSegment[];
  denominator: number;
  width: number;
  legend: string | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      role="group"
      tabIndex={0}
      {...(legend !== undefined ? { 'aria-label': legend } : {})}
      className="relative"
      style={{ width: `${width}px` }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <BarRow segments={segments} denominator={denominator} selected={undefined} widthPx={width} />

      <div aria-hidden="true" className="mt-1 flex" style={{ width: `${width}px` }}>
        {segments.map((segment) => {
          const px = denominator > 0 ? (segment.count / denominator) * width : 0;
          return (
            <span
              key={segment.key}
              style={{ width: `${px}px` }}
              className="flex shrink-0 justify-center overflow-hidden"
            >
              {px >= MIN_LABELLED_PX && (
                <span className="font-mono text-[10px] text-ink-600 tabular-nums">{segment.count}</span>
              )}
            </span>
          );
        })}
      </div>

      {open && (
        <div
          data-testid="header-strip-legend"
          aria-hidden="true"
          className="absolute top-full left-0 z-50 mt-1 w-60 rounded-md border border-ink-200 bg-surface p-2 shadow-[0_16px_40px_-12px_rgba(31,30,28,0.28)]"
        >
          {segments.map((segment) => (
            <div key={segment.key} className="flex items-center gap-2 px-1 py-1">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: BAR_FILL[segment.tone] }}
              />
              <span className="flex-1 truncate text-[12px] text-ink-700">{segment.label}</span>
              <span className="font-mono text-[12px] tabular-nums text-ink-900">{segment.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelledStrip({
  segments,
  denominator,
  selected,
  onSelect,
  compact,
  testIdPrefix,
}: {
  segments: ProcessStripSegment[];
  denominator: number;
  selected: string[] | undefined;
  onSelect: ((key: string) => void) | undefined;
  compact: boolean;
  testIdPrefix: string | undefined;
}) {
  const shownLabels = compact ? segments.filter((segment) => segment.count > 0) : segments;

  return (
    <div className="flex flex-col gap-1">
      <BarRow segments={segments} denominator={denominator} selected={selected} />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {shownLabels.map((segment) => {
          const zero = segment.count === 0;
          const isSelected = selected?.includes(segment.key) ?? false;
          const testId = testIdPrefix !== undefined ? `${testIdPrefix}-${segment.key}` : undefined;
          const content = (
            <>
              <span className={cx('hv-label', zero && 'text-ink-300')}>{segment.label}</span>
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
                  '-mx-1 flex items-baseline gap-1 rounded-sm px-1 transition-colors',
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
              className="flex items-baseline gap-1"
            >
              {content}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ProcessStrip({
  segments,
  total,
  selected,
  onSelect,
  compact = false,
  dense = false,
  width,
  legend,
  testIdPrefix,
}: ProcessStripProps) {
  const denominator = total ?? segments.reduce((sum, segment) => sum + segment.count, 0);

  if (dense) {
    return <DenseStrip segments={segments} denominator={denominator} width={width ?? 0} legend={legend} />;
  }

  return (
    <LabelledStrip
      segments={segments}
      denominator={denominator}
      selected={selected}
      onSelect={onSelect}
      compact={compact}
      testIdPrefix={testIdPrefix}
    />
  );
}
