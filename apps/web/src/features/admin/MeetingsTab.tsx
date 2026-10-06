/**
 * Scheibe 041: the General Meetings, read only — title, date and state per entry; the one managed here carries a
 * badge. Creating, cloning and choosing another one follow with 041b; nothing is offered that does not exist (D9).
 */
import { useCallback, useEffect, useState } from 'react';
import type { Meeting } from '@hv/domain';
import { api } from '../../api';
import { useApiVersion } from '../../api/useApiVersion';
import { Badge, Panel, TBody, TD, TH, THead, TR, Table } from '../../components';
import { useLang, useT } from '../../i18n';
import type { TKey } from '../../i18n';
import { EmptyList, LoadingRows, ReadFailed } from './parts';
import { formatBerlinDate } from './time';

const STATE_KEYS: Readonly<Record<Meeting['status'], TKey>> = {
  preparation: 'meeting.state.preparation',
  running: 'meeting.state.running',
  closed: 'meeting.state.closed',
};

type Read = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; meetings: readonly Meeting[] };

export function MeetingsTab({ currentId }: { currentId: string | undefined }) {
  const t = useT();
  const lang = useLang();
  const version = useApiVersion();
  const [tick, setTick] = useState(0);
  const [read, setRead] = useState<Read>({ status: 'loading' });
  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    api.listMeetings().then(
      (meetings) => {
        if (!cancelled) setRead({ status: 'ready', meetings });
      },
      () => {
        if (!cancelled) setRead({ status: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [version, tick]);

  return (
    <Panel title={t('admin.tab.meetings')} padded={false} className="h-full" bodyClassName="overflow-auto">
      {read.status === 'loading' && <LoadingRows rows={2} />}
      {read.status === 'failed' && <ReadFailed onRetry={reload} />}
      {read.status === 'ready' && read.meetings.length === 0 && <EmptyList text={t('admin.meetings.empty')} />}
      {read.status === 'ready' && read.meetings.length > 0 && (
        <Table>
          <THead>
            <tr>
              <TH>{t('admin.meetings.col.title')}</TH>
              <TH>{t('admin.meetings.col.date')}</TH>
              <TH>{t('admin.meetings.col.state')}</TH>
            </tr>
          </THead>
          <TBody>
            {read.meetings.map((meeting) => (
              <TR key={meeting.id}>
                <TD data-testid="admin-meeting-row" data-id={meeting.id}>
                  <span className="font-medium text-ink-900">{meeting.title}</span>
                  {meeting.id === currentId && (
                    <Badge tone="outline" className="ml-2">
                      {t('admin.meetings.current')}
                    </Badge>
                  )}
                </TD>
                <TD mono>{formatBerlinDate(meeting.date, lang)}</TD>
                <TD>
                  <Badge tone="accent" dot>
                    {t(STATE_KEYS[meeting.status])}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Panel>
  );
}
