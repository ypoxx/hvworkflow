/**
 * The header's live read on the backlog: how many Wortmeldungen and Einzelfragen exist, how many are
 * still open, and — as one glance-able bar — where the open ones sit in the workflow. Replaces the
 * four separate counter cells of slice 001 (docs/slices/005-designsystem-erweiterung.md point 8).
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

/** The segments that still count as work in flight — staged and delivered/closed do not. */
const OPEN_KEYS: ReadonlySet<string> = new Set(['captured', 'drafting', 'review', 'approved']);

function sum(byStatus: Meeting['counts']['byStatus'], statuses: readonly QuestionStatus[]): number {
  return statuses.reduce((total, status) => total + byStatus[status], 0);
}

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
  const open =
    meeting === null
      ? null
      : segments.filter((segment) => OPEN_KEYS.has(segment.key)).reduce((sum2, segment) => sum2 + segment.count, 0);

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
      <StatCell
        testId="header-counter-open"
        title={t('header.counter.open.title')}
        label={t('header.counter.open')}
        value={open}
      />

      <span aria-hidden="true" className="h-7 w-px bg-line" />

      {/* The strip itself stays within its own 520px pill (point 8); the stat cells sit outside it. */}
      <div className="max-w-[340px]">
        <ProcessStrip
          compact
          segments={segments}
          {...(total !== null ? { total } : {})}
          testIdPrefix="header-counter"
        />
      </div>
    </div>
  );
}
