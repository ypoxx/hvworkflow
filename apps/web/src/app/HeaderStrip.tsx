/**
 * The header's live read on the backlog: how many Wortmeldungen and Einzelfragen exist, and — as one
 * glance-able bar — where the open ones sit in the workflow. Replaces the four separate counter cells
 * of slice 001 (docs/slices/005-designsystem-erweiterung.md point 8). The strip itself is `dense`: bar
 * plus a count under any segment wide enough to hold one; the full breakdown is a hover/focus popover,
 * never a scroll (design review, 005 rework round 2) — nothing in the header is reachable only by
 * scrolling it. "Offen" stays in the DOM for tests and screen readers but is not a visible cell.
 */
import type { Meeting, QuestionStatus } from '@hv/domain';
import { ProcessStrip, statusTone } from '../components';
import type { TKey } from '../i18n';
import { useT } from '../i18n';

interface SegmentSpec {
  key: string;
  labelKey: TKey;
  statuses: readonly QuestionStatus[];
  /** Which status's tone (point 4) stands for the whole segment. */
  primary: QuestionStatus;
}

const SEGMENTS: readonly SegmentSpec[] = [
  {
    key: 'captured',
    labelKey: 'process.segment.captured',
    statuses: ['captured', 'classified', 'assigned'],
    primary: 'captured',
  },
  { key: 'drafting', labelKey: 'process.segment.drafting', statuses: ['answer_drafted'], primary: 'answer_drafted' },
  { key: 'review', labelKey: 'process.segment.review', statuses: ['in_review'], primary: 'in_review' },
  { key: 'approved', labelKey: 'process.segment.approved', statuses: ['approved'], primary: 'approved' },
  { key: 'staged', labelKey: 'process.segment.staged', statuses: ['staged'], primary: 'staged' },
  // Delivered and closed both mean "nothing left to do"; one segment, delivered's tone.
  { key: 'delivered', labelKey: 'process.segment.delivered', statuses: ['delivered', 'closed'], primary: 'delivered' },
];

function sum(byStatus: Meeting['counts']['byStatus'], statuses: readonly QuestionStatus[]): number {
  return statuses.reduce((total, status) => total + byStatus[status], 0);
}

/**
 * Fixed, not measured: the "wide enough to print a number" cutoff and the pill's total width both
 * need to be deterministic (and testable), not dependent on a `ResizeObserver` render pass.
 */
const STRIP_WIDTH_PX = 180;

/** One label-above/count-below cell, the same shape the header has always used for a headline number. */
function StatCell({
  testId,
  title,
  label,
  value,
}: {
  testId: string;
  title: string;
  label: string;
  value: number | null;
}) {
  return (
    <div data-testid={testId} title={title} className="flex flex-col items-end whitespace-nowrap">
      <span className="hv-label">{label}</span>
      <span className="font-mono text-[15px] leading-5 font-medium tabular-nums text-ink-900">
        {value ?? '—'}
      </span>
    </div>
  );
}

export function HeaderStrip({ meeting }: { meeting: Meeting | null }) {
  const t = useT();
  const byStatus = meeting?.counts.byStatus ?? null;

  const segments = SEGMENTS.map((spec) => ({
    key: spec.key,
    label: t(spec.labelKey),
    count: byStatus === null ? 0 : sum(byStatus, spec.statuses),
    tone: statusTone(spec.primary),
  }));
  const total = meeting?.counts.questions ?? null;
  // The one true "open" figure is the domain's own count (it includes the podium queue); never
  // recompute it from a subset of strip segments, or it silently drifts from the nav badge.
  const open = meeting === null ? null : meeting.counts.open;
  // The strip's aria-label: one sentence carrying every segment, so a screen reader gets the whole
  // distribution without needing to hover the popover at all.
  const legend = t(
    'process.strip.legend',
    Object.fromEntries(segments.map((segment): [string, number] => [segment.key, segment.count])),
  );

  return (
    <div
      aria-label={t('header.counters')}
      className="hidden shrink-0 items-center gap-3 rounded-md border border-line bg-sunken px-3 py-1 lg:flex"
    >
      <StatCell
        testId="header-counter-speakers"
        title={t('header.counter.speakers.title')}
        label={t('header.counter.speakers')}
        value={meeting === null ? null : meeting.counts.speakers}
      />

      <span aria-hidden="true" className="h-7 w-px bg-line" />

      <StatCell
        testId="header-counter-questions"
        title={t('header.counter.questions.title')}
        label={t('header.counter.questions')}
        value={total}
      />

      <span aria-hidden="true" className="h-7 w-px bg-line" />

      <ProcessStrip dense segments={segments} width={STRIP_WIDTH_PX} legend={legend} {...(total !== null ? { total } : {})} />

      {/* Kept for tests and assistive tech; not a visible cell (design review: the pill must fit
          next to the meeting title at 1440px). Content, not presentation, so no `hidden` attribute. */}
      <span data-testid="header-counter-open" title={t('header.counter.open.title')} className="sr-only">
        {t('header.counter.open')}: {open ?? '—'}
      </span>
    </div>
  );
}
