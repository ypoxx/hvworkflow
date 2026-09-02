/** The facts of the day, in the words of the house. Present on every phase until its screen exists. */
import type { Meeting } from '@hv/domain';
import { Badge, KeyValue, KeyValueList, Panel } from '../components';
import { useT } from '../i18n';
import type { TKey } from '../i18n';
import { useMeeting } from './useMeeting';

const STATE_KEYS: Readonly<Record<Meeting['status'], TKey>> = {
  preparation: 'meeting.state.preparation',
  running: 'meeting.state.running',
  closed: 'meeting.state.closed',
};

const DATE_FORMAT: Readonly<Record<string, Intl.DateTimeFormatOptions>> = {
  de: { day: '2-digit', month: 'long', year: 'numeric' },
  en: { day: 'numeric', month: 'long', year: 'numeric' },
};

export function MeetingPanel() {
  const t = useT();
  const meeting = useMeeting();
  if (meeting === null) return null;

  const date = new Intl.DateTimeFormat(document.documentElement.lang, {
    ...DATE_FORMAT[document.documentElement.lang === 'en' ? 'en' : 'de'],
    timeZone: 'Europe/Berlin',
  }).format(new Date(meeting.date));

  return (
    <Panel title={t('meeting.panel')}>
      <KeyValueList>
        <KeyValue label={t('meeting.title')}>{meeting.title}</KeyValue>
        <KeyValue label={t('meeting.legalEntity')}>
          {meeting.legalEntity ?? t('common.none')}
        </KeyValue>
        <KeyValue label={t('meeting.date')}>{date}</KeyValue>
        <KeyValue label={t('meeting.round')} mono>
          {meeting.currentRound}
        </KeyValue>
        <KeyValue label={t('meeting.state')}>
          <Badge tone="accent" dot>
            {t(STATE_KEYS[meeting.status])}
          </Badge>
        </KeyValue>
        <KeyValue label={t('meeting.corpus')}>
          {t('meeting.corpus.value', {
            questions: meeting.counts.questions,
            speakers: meeting.counts.speakers,
          })}
        </KeyValue>
      </KeyValueList>
    </Panel>
  );
}
