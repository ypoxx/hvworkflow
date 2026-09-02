/**
 * The running speaking time. One second is the right resolution for a chairperson who has to decide
 * whether to intervene; the figure turns amber the moment the requested minutes are used up.
 */
import { useEffect, useState } from 'react';
import { cx } from '../../components';
import { useT } from '../../i18n';
import { formatElapsed } from './labels';

function useElapsedSeconds(startedAt: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === undefined) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  if (startedAt === undefined) return null;
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return null;
  return Math.max(0, Math.floor((now - started) / 1000));
}

export function SpeakingTimer({
  startedAt,
  requestedMinutes,
  size = 'row',
}: {
  startedAt: string | undefined;
  requestedMinutes?: number | undefined;
  size?: 'row' | 'lead';
}) {
  const t = useT();
  const elapsed = useElapsedSeconds(startedAt);
  if (elapsed === null) return <span className="text-ink-300">—</span>;
  const over = requestedMinutes !== undefined && elapsed >= requestedMinutes * 60;
  return (
    <span
      className={cx(
        'font-mono tabular-nums',
        size === 'lead' ? 'text-[24px] leading-7 font-medium' : 'text-[13px]',
        over ? 'text-tone-warning-fg' : 'text-ink-800',
      )}
      {...(over ? { title: t('speakers.now.over') } : {})}
    >
      {formatElapsed(elapsed)}
    </span>
  );
}
