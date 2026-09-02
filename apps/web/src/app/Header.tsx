/**
 * The permanent band at the top: which meeting, how much work is in the system right now, what time
 * it is in the hall, who is looking, in which language. Everything else on screen may change; these
 * five facts must be readable at a glance from two metres away.
 */
import { Keyboard } from 'lucide-react';
import type { Meeting } from '@hv/domain';
import { Badge, Button, cx } from '../components';
import { useT } from '../i18n';
import type { TKey, Translate } from '../i18n';
import { Clock } from './Clock';
import { DemoControls } from './DemoControls';
import { LanguageToggle } from './LanguageToggle';
import { RoleSwitcher } from './RoleSwitcher';

const STATE_KEYS: Readonly<Record<Meeting['status'], TKey>> = {
  preparation: 'meeting.state.preparation',
  running: 'meeting.state.running',
  closed: 'meeting.state.closed',
};

interface CounterSpec {
  testId: string;
  labelKey: TKey;
  titleKey: TKey;
  field: keyof Meeting['counts'];
  emphasis?: boolean;
}

const COUNTERS: readonly CounterSpec[] = [
  {
    testId: 'header-counter-speakers',
    labelKey: 'header.counter.speakers',
    titleKey: 'header.counter.speakers.title',
    field: 'speakers',
  },
  {
    testId: 'header-counter-questions',
    labelKey: 'header.counter.questions',
    titleKey: 'header.counter.questions.title',
    field: 'questions',
  },
  {
    testId: 'header-counter-open',
    labelKey: 'header.counter.open',
    titleKey: 'header.counter.open.title',
    field: 'open',
  },
  {
    testId: 'header-counter-staged',
    labelKey: 'header.counter.staged',
    titleKey: 'header.counter.staged.title',
    field: 'staged',
    emphasis: true,
  },
];

function Counter({
  spec,
  meeting,
  t,
}: {
  spec: CounterSpec;
  meeting: Meeting | null;
  t: Translate;
}) {
  const value = meeting === null ? null : meeting.counts[spec.field];
  const highlight = spec.emphasis === true && value !== null && value > 0;
  return (
    <div
      data-testid={spec.testId}
      title={t(spec.titleKey)}
      className="flex flex-col items-end whitespace-nowrap"
    >
      <span className="hv-label">{t(spec.labelKey)}</span>
      <span
        className={cx(
          'font-mono text-[15px] leading-5 font-medium tabular-nums',
          value === null ? 'text-ink-300' : highlight ? 'text-accent-700' : 'text-ink-900',
        )}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

export function Header({
  meeting,
  onOpenShortcuts,
}: {
  meeting: Meeting | null;
  onOpenShortcuts: () => void;
}) {
  const t = useT();
  return (
    <header
      role="banner"
      className="sticky top-0 z-40 flex h-header shrink-0 items-center gap-4 border-b border-line bg-surface px-4"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-900 font-mono text-2xs font-medium tracking-tight text-white"
        >
          HV
        </span>
        <div className="hidden flex-col leading-tight 2xl:flex">
          <span className="text-[13px] font-semibold text-ink-900">{t('app.name')}</span>
          <span className="hv-label">{t('app.tagline')}</span>
        </div>
      </div>

      <span aria-hidden="true" className="h-7 w-px bg-line" />

      <div data-testid="header-meeting-title" className="min-w-0 shrink">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[13px] font-semibold text-ink-900">
            {meeting?.title ?? t('header.meeting')}
          </h1>
          {meeting !== null && (
            <Badge tone="outline" dot>
              {t(STATE_KEYS[meeting.status])}
            </Badge>
          )}
        </div>
        <p className="truncate text-2xs text-ink-500">
          {meeting === null
            ? t('boot.title')
            : `${meeting.legalEntity ?? ''} · ${t('header.round', { round: meeting.currentRound })}`}
        </p>
      </div>

      <span className="flex-1" />

      <div
        aria-label={t('header.counters')}
        className="hidden shrink-0 items-center gap-4 rounded-md border border-line bg-sunken px-3 py-1 lg:flex"
      >
        {COUNTERS.map((spec) => (
          <Counter key={spec.testId} spec={spec} meeting={meeting} t={t} />
        ))}
      </div>

      <Clock />

      <span aria-hidden="true" className="h-7 w-px bg-line" />

      <div className="flex items-center gap-2">
        <RoleSwitcher />
        <LanguageToggle />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={t('shortcuts.open')}
          title={t('shortcuts.open')}
          onClick={onOpenShortcuts}
          icon={<Keyboard size={16} strokeWidth={1.75} aria-hidden="true" />}
        />
        <DemoControls />
      </div>
    </header>
  );
}
