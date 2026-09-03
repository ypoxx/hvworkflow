/**
 * The head of the speakers list: who is at the microphone, and who is called next. This is the one
 * place on the screen that answers "what is the state, what has to be done" in a second
 * (design principle 1); the primary action of the whole view sits here.
 */
import { Mic, MicOff, PencilLine } from 'lucide-react';
import { Link } from 'react-router';
import type { Speaker } from '@hv/domain';
import { Button, Panel, ProgressRing, cx } from '../../components';
import { useT } from '../../i18n';
import { speakerKindLabel } from './labels';
import { SpeakingTimer, useElapsedSeconds } from './SpeakingTimer';

function Identity({
  speaker,
  className,
  nameTestId,
}: {
  speaker: Speaker;
  className?: string;
  /** Set only on the "Am Mikrofon" identity: `next`'s uses the same component and would otherwise
   *  make the testid ambiguous (both are present whenever a speaker is being called). */
  nameTestId?: string;
}) {
  const t = useT();
  return (
    <div className={cx('flex min-w-0 flex-col gap-0.5', className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="font-mono text-[13px] tabular-nums text-ink-500">{speaker.number}</span>
        <span
          {...(nameTestId !== undefined ? { 'data-testid': nameTestId } : {})}
          className="truncate text-[16px] leading-6 font-semibold text-ink-900"
        >
          {speaker.displayName}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-2xs whitespace-nowrap text-ink-500">
        <span>{speakerKindLabel(t, speaker.kind)}</span>
        {speaker.organisation !== undefined && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{speaker.organisation}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span className="shrink-0 font-mono">{t('header.round', { round: speaker.round })}</span>
      </div>
    </div>
  );
}

export function NowSpeaking({
  speaking,
  next,
  busyId,
  onFinish,
  onCall,
}: {
  speaking: Speaker | undefined;
  next: Speaker | undefined;
  busyId: string | null;
  onFinish: (speaker: Speaker) => void;
  onCall: (speaker: Speaker) => void;
}) {
  const t = useT();
  const elapsed = useElapsedSeconds(speaking?.speakingStartedAt);
  const budgetSeconds =
    speaking?.requestedMinutes !== undefined ? speaking.requestedMinutes * 60 : undefined;

  return (
    <div className="grid shrink-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <Panel title={t('speakers.now.title')} className="min-h-[104px]">
        {speaking === undefined ? (
          <p className="flex h-14 items-center text-[13px] text-ink-500">
            {t('speakers.now.empty')}
          </p>
        ) : (
          <div className="flex h-14 flex-wrap items-center gap-4">
            {/*
             * R6 (006 rework): the name needs real priority, not leftover space — `min-w-[220px]`
             * keeps it from being squeezed by the fixed-width blocks that follow, which are grouped
             * into one `shrink-0` unit so they wrap as a whole rather than eating into the name one
             * by one. The "angemeldet {n} min" badge is gone: the ring's max is that same figure.
             */}
            <Identity
              speaker={speaking}
              className="min-w-[220px] flex-1"
              nameTestId="speaker-now-name"
            />
            <div className="flex shrink-0 items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="hv-label">{t('speakers.now.elapsed')}</span>
                <div className="flex items-center gap-2">
                  {elapsed !== null && budgetSeconds !== undefined && (
                    <ProgressRing
                      value={elapsed}
                      max={budgetSeconds}
                      tone={elapsed >= budgetSeconds ? 'warn' : 'accent'}
                      label={t('speakers.now.elapsed')}
                      data-testid="speaker-timer-ring"
                    />
                  )}
                  <SpeakingTimer
                    startedAt={speaking.speakingStartedAt}
                    requestedMinutes={speaking.requestedMinutes}
                    size="lead"
                  />
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="hv-label">{t('speakers.column.questions')}</span>
                <span className="font-mono text-[13px] tabular-nums text-ink-800">
                  {speaking.questionCount}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/capture?speaker=${encodeURIComponent(speaking.id)}`}
                className={cx(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line-strong',
                  'bg-surface px-3 text-[13px] font-medium text-ink-800',
                  'transition-colors duration-100 hover:border-ink-300 hover:bg-ink-50',
                )}
              >
                <PencilLine size={16} strokeWidth={1.75} aria-hidden="true" />
                {t('speakers.toCapture')}
              </Link>
              {speaking._actions.includes('speaker.update') && (
                <Button
                  variant="secondary"
                  disabled={busyId === speaking.id}
                  onClick={() => onFinish(speaking)}
                  icon={<MicOff size={16} strokeWidth={1.75} aria-hidden="true" />}
                >
                  {t('speakers.action.finish')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel title={t('speakers.next.title')} className="min-h-[104px]">
        {next === undefined ? (
          <p className="flex h-14 items-center text-[13px] text-ink-500">
            {t('speakers.next.empty')}
          </p>
        ) : (
          <div className="flex h-14 items-center gap-4">
            <Identity speaker={next} className="flex-1" />
            {next.requestedMinutes !== undefined && (
              <span className="font-mono text-2xs text-ink-500">
                {t('speakers.now.requested', { minutes: next.requestedMinutes })}
              </span>
            )}
            {next._actions.includes('speaker.update') && (
              <Button
                variant="primary"
                data-testid="speaker-call-next"
                disabled={busyId === next.id}
                onClick={() => onCall(next)}
                icon={<Mic size={16} strokeWidth={1.75} aria-hidden="true" />}
              >
                {t('speakers.action.call')}
              </Button>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
