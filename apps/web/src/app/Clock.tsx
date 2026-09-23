/**
 * Wall clock of the meeting venue. Fixed to Europe/Berlin: the minutes in the podium view and in the
 * history are the minutes of the hall, not of the device someone happens to be holding.
 *
 * Point #13 (feedback, slice 020): the projectleitung found the clock too prominent for a figure
 * nobody needs to the second. It now shows HH:MM only, small and muted, and repaints at most once a
 * minute — timed to the real minute change instead of a fixed interval, so it is never more than a
 * moment late.
 */
import { useEffect, useState } from 'react';
import { useT } from '../i18n';

const TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Milliseconds until the wall clock's next minute change. */
function msToNextMinute(now: Date): number {
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

export function Clock() {
  const t = useT();
  const [time, setTime] = useState(() => TIME_FORMAT.format(new Date()));

  useEffect(() => {
    let timer: number;
    const tick = (): void => {
      setTime(TIME_FORMAT.format(new Date()));
      timer = window.setTimeout(tick, msToNextMinute(new Date()));
    };
    timer = window.setTimeout(tick, msToNextMinute(new Date()));
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="hidden shrink-0 flex-col items-end whitespace-nowrap xl:flex">
      <span className="hv-label">
        {t('clock.label')} {t('clock.zone')}
      </span>
      <time
        data-testid="clock-time"
        className="font-mono text-2xs leading-4 font-normal tabular-nums text-ink-500"
      >
        {time}
      </time>
    </div>
  );
}
