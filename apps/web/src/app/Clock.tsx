/**
 * Wall clock of the meeting venue. Fixed to Europe/Berlin: the minutes in the podium view and in the
 * history are the minutes of the hall, not of the device someone happens to be holding.
 */
import { useEffect, useState } from 'react';
import { useT } from '../i18n';

const TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function Clock() {
  const t = useT();
  const [time, setTime] = useState(() => TIME_FORMAT.format(new Date()));

  useEffect(() => {
    // Four ticks a second so the display never skips one; React bails out on an unchanged string.
    const timer = window.setInterval(() => setTime(TIME_FORMAT.format(new Date())), 250);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hidden flex-col items-end lg:flex">
      <span className="hv-label">
        {t('clock.label')} {t('clock.zone')}
      </span>
      <time className="font-mono text-[15px] leading-5 font-medium tabular-nums text-ink-900">
        {time}
      </time>
    </div>
  );
}
