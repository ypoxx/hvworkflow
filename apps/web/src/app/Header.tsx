/**
 * The permanent band at the top: which meeting, how much work is in the system right now, what time
 * it is in the hall, who is looking, in which language. Everything else on screen may change; these
 * five facts must be readable at a glance from two metres away.
 */
import { Keyboard } from 'lucide-react';
import type { Meeting } from '@hv/domain';
import { Badge, Button } from '../components';
import { useT } from '../i18n';
import type { TKey } from '../i18n';
import { Clock } from './Clock';
import { DemoControls } from './DemoControls';
import { HeaderStrip } from './HeaderStrip';
import { LanguageToggle } from './LanguageToggle';
import { RoleSwitcher } from './RoleSwitcher';

const STATE_KEYS: Readonly<Record<Meeting['status'], TKey>> = {
  preparation: 'meeting.state.preparation',
  running: 'meeting.state.running',
  closed: 'meeting.state.closed',
};

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

      <div data-testid="header-meeting-title" className="min-w-[300px] shrink">
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

      <HeaderStrip meeting={meeting} />

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
