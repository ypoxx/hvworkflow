/**
 * Scheibe 041 (decision 2): the frame of the Verwaltung — the heading, one line naming the managed meeting with its
 * state and version (D1, D5), and the six tabs (WAI-ARIA tabs: arrows, Home, End, `aria-controls`). Without the right
 * the page shows only the locked state, naming the right, never a role (D9). Presentational: the page passes the data.
 */
import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ShieldOff } from 'lucide-react';
import type { Meeting } from '@hv/domain';
import { Badge, EmptyState, PageHeader, Panel, cx } from '../../components';
import { actionLabel, useT } from '../../i18n';
import type { Lang, TKey } from '../../i18n';
import type { Access } from './access';
import { ADMIN_TABS, rovingTarget } from './tabs';
import type { AdminTabId } from './tabs';
import { formatBerlinDate } from './time';

const STATE_KEYS: Readonly<Record<Meeting['status'], TKey>> = {
  preparation: 'meeting.state.preparation',
  running: 'meeting.state.running',
  closed: 'meeting.state.closed',
};

/** The tab id → the id of its panel, for `aria-controls` and `aria-labelledby`. */
const panelId = (base: string, tab: AdminTabId): string => `${base}-panel-${tab}`;
const tabId = (base: string, tab: AdminTabId): string => `${base}-tab-${tab}`;

function MeetingLine({ meeting, lang }: { meeting: Meeting | null; lang: Lang }) {
  const t = useT();
  if (meeting === null) {
    return <p className="text-[13px] text-ink-600">{t('admin.meeting.loading')}</p>;
  }
  return (
    <p data-testid="admin-meeting" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-800">
      <span className="hv-label">{t('admin.meeting.label')}</span>
      <span className="font-semibold text-ink-900">{meeting.title}</span>
      <span className="font-mono tabular-nums text-ink-600">{formatBerlinDate(meeting.date, lang)}</span>
      <Badge tone="accent" dot>
        {t(STATE_KEYS[meeting.status])}
      </Badge>
      {meeting.legalEntity !== undefined && <span className="text-ink-600">{meeting.legalEntity}</span>}
      <span className="text-ink-600">
        {t('admin.meeting.version')}{' '}
        <span data-testid="admin-meeting-version" className="font-mono tabular-nums text-ink-900">
          {meeting.version}
        </span>
      </span>
    </p>
  );
}

export function AdminLayout({
  meeting,
  access,
  tab,
  onTab,
  lang,
  children,
}: {
  meeting: Meeting | null;
  access: Access;
  tab: AdminTabId;
  onTab: (tab: AdminTabId) => void;
  lang: Lang;
  /** The panel of the selected tab. */
  children: ReactNode;
}) {
  const t = useT();
  const base = useId();
  const tabRefs = useRef<Partial<Record<AdminTabId, HTMLButtonElement | null>>>({});

  if (access.status === 'forbidden') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PageHeader title={t('page.admin.title')} description={t('page.admin.description')} />
        <div data-testid="admin-forbidden" role="status" className="min-h-0 flex-1">
          <Panel className="h-full" bodyClassName="flex items-center justify-center">
            <EmptyState
              icon={ShieldOff}
              title={t('admin.forbidden.title')}
              description={t('admin.forbidden.body', { right: actionLabel(t, 'admin.roles.manage') })}
            />
          </Panel>
        </div>
      </div>
    );
  }

  const index = ADMIN_TABS.findIndex((entry) => entry.id === tab);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const target = rovingTarget(event.key, index, ADMIN_TABS.length, 'horizontal');
    if (target === undefined) return;
    event.preventDefault();
    const next = ADMIN_TABS[target]!.id;
    onTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader title={t('page.admin.title')} description={t('page.admin.description')} />
      <MeetingLine meeting={meeting} lang={lang} />
      <div role="tablist" aria-label={t('admin.tabs.label')} className="flex shrink-0 gap-1 border-b border-line">
        {ADMIN_TABS.map((entry) => {
          const selected = entry.id === tab;
          return (
            <button
              key={entry.id}
              ref={(element) => {
                tabRefs.current[entry.id] = element;
              }}
              type="button"
              role="tab"
              id={tabId(base, entry.id)}
              data-testid={entry.testId}
              aria-selected={selected}
              aria-controls={panelId(base, entry.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTab(entry.id)}
              onKeyDown={onKeyDown}
              className={cx(
                '-mb-px h-9 border-b-2 px-3 text-[13px] font-medium transition-colors duration-100',
                selected ? 'border-accent-600 text-ink-900' : 'border-transparent text-ink-600 hover:text-ink-900',
              )}
            >
              {t(entry.labelKey)}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId(base, tab)}
        aria-labelledby={tabId(base, tab)}
        data-testid={`admin-panel-${tab}`}
        className="min-h-0 flex-1"
      >
        {children}
      </div>
    </div>
  );
}
