/**
 * The podium itself. Design principle 10: this is a different device — large type, maximum
 * contrast, two keys, no navigation. It has to be readable from two metres, so the question is set
 * at 28px and the approved answer at 24px, both in ink-900/ink-800 on white, with nothing else
 * competing for attention.
 *
 * The two buttons are built here rather than taken from the kit: the kit's buttons are 28 and 32
 * pixels high, which is right for a dense console and far too small for the person reading out.
 */
import type { ReactNode } from 'react';
import { CornerUpLeft, Presentation, Undo2 } from 'lucide-react';
import type { Question, StageView } from '@hv/domain';
import { Badge, EmptyState, Kbd, StageAssignmentBadge, cx } from '../../components';
import { useT } from '../../i18n';
import { approvedAnswer, clockTime } from './lib';

interface PodiumProps {
  stage: StageView;
  busy: boolean;
  /** Rendered only when the record allows it — `_actions` decides, never a role. */
  onNext: () => void;
  onReturn: () => void;
}

function PodiumButton({
  variant,
  testId,
  hint,
  disabled,
  onClick,
  children,
}: {
  variant: 'primary' | 'secondary';
  testId: string;
  hint: ReactNode;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-16 min-w-64 flex-1 items-center justify-center gap-3 rounded-lg border',
        'px-6 text-[18px] font-semibold transition-colors duration-100',
        'disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary'
          ? 'border-accent-600 bg-accent-600 text-white hover:border-accent-700 hover:bg-accent-700'
          : 'border-line-strong bg-surface text-ink-800 hover:border-ink-300 hover:bg-ink-50',
      )}
    >
      {children}
      <span
        className={cx(
          'text-2xs font-medium',
          variant === 'primary' ? 'text-accent-100' : 'text-ink-500',
        )}
      >
        {hint}
      </span>
    </button>
  );
}

function QueueItem({ question }: { question: Question }) {
  const t = useT();
  return (
    <li
      data-testid="stage-queue-item"
      data-number={question.number}
      className="flex items-start gap-2.5 border-b border-line py-2 last:border-b-0"
    >
      <span className="mt-0.5 shrink-0 font-mono text-2xs tabular-nums text-ink-500">
        {question.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] text-ink-700">{question.text}</span>
        <span className="mt-0.5 block truncate text-2xs text-ink-400">
          {question.speakerDisplayName ?? t('common.none')}
        </span>
      </span>
    </li>
  );
}

export function Podium({ stage, busy, onNext, onReturn }: PodiumProps) {
  const t = useT();
  const current = stage.current;

  if (current === null) {
    return (
      <div data-testid="stage-current" className="flex min-h-0 flex-1 items-center justify-center">
        <EmptyState
          icon={Presentation}
          title={t('stage.current.empty.title')}
          description={t('stage.current.empty.body')}
          className="max-w-xl"
        />
      </div>
    );
  }

  const answer = approvedAnswer(current);
  const approval = current.approval;
  const mayDeliver = current._actions.includes('question.deliver');
  const mayReturn = current._actions.includes('question.return');

  return (
    <div data-testid="stage-current" className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-3">
          <span className="hv-label">{t('stage.current.label')}</span>
          <span
            data-testid="stage-current-number"
            className="font-mono text-[20px] leading-6 font-medium tabular-nums text-ink-900"
          >
            {current.number}
          </span>
          <span data-testid="stage-assignment" title={t('stage.assignment.label')}>
            {current.stageAssignment === undefined ? (
              <Badge tone="outline">{t('common.none')}</Badge>
            ) : (
              <StageAssignmentBadge assignment={current.stageAssignment} />
            )}
          </span>
          <span className="text-[13px] text-ink-500">
            {t('stage.speaker.label')}: {current.speakerDisplayName ?? t('common.none')}
          </span>
        </div>

        <p
          data-testid="stage-current-text"
          className="mt-4 max-w-4xl text-[28px] leading-9 font-medium tracking-[-0.01em] text-ink-900"
        >
          {current.text}
        </p>

        <div className="mt-8 max-w-4xl border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hv-label">{t('stage.answer.label')}</span>
            {approval !== undefined && answer !== undefined && (
              <span className="rounded-sm border border-status-approved-bd bg-status-approved-bg px-1.5 py-0.5 text-2xs font-medium text-status-approved-fg">
                {t('answers.approval.sealed', {
                  version: approval.answerVersion,
                  actor: approval.approvedBy.displayName ?? approval.approvedBy.id,
                  time: clockTime(approval.approvedAt),
                })}
              </span>
            )}
          </div>
          <p
            data-testid="stage-answer"
            data-prepared={answer !== undefined}
            className={cx(
              'mt-3 text-[24px] leading-8',
              answer === undefined ? 'text-ink-500 italic' : 'text-ink-800',
            )}
          >
            {answer !== undefined
              ? answer.text
              : current.track === 'podium'
                ? t('stage.answer.podium')
                : t('stage.answer.none')}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-3">
        {mayDeliver && (
          <PodiumButton
            variant="primary"
            testId="stage-next"
            disabled={busy}
            onClick={onNext}
            hint={<Kbd>{t('stage.key.next')}</Kbd>}
          >
            {t('action.question.deliver')}
          </PodiumButton>
        )}
        {mayReturn && (
          <PodiumButton
            variant="secondary"
            testId="stage-return"
            disabled={busy}
            onClick={onReturn}
            hint={<Kbd>{t('stage.key.return')}</Kbd>}
          >
            <Undo2 size={18} strokeWidth={1.75} aria-hidden="true" />
            {t('stage.return.label')}
          </PodiumButton>
        )}
      </div>
    </div>
  );
}

export function StageQueue({ stage }: { stage: StageView }) {
  const t = useT();
  const shown = stage.queue.slice(0, 8);
  const rest = stage.queue.length - shown.length;

  return (
    <div data-testid="stage-queue" className="flex min-h-0 flex-col">
      <div className="flex items-baseline justify-between">
        <span className="hv-label">{t('stage.queue.title')}</span>
        <span className="font-mono text-2xs tabular-nums text-ink-400">{stage.queue.length}</span>
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-500">
          <CornerUpLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('stage.queue.empty')}
        </p>
      ) : (
        <>
          <ul aria-label={t('stage.queue.label')} className="mt-1 min-h-0 flex-1 overflow-y-auto">
            {shown.map((question) => (
              <QueueItem key={question.id} question={question} />
            ))}
          </ul>
          {rest > 0 && (
            <p className="mt-2 shrink-0 text-2xs text-ink-400">
              {t('stage.queue.more', { n: rest })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
