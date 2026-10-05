/**
 * Scheibe 054 (decision 4): one of "Meine Fragen" as the person answering needs it — the return reason first, then the
 * reason it came to this unit, the wording and the Wortmeldung as the core delivers it, the latest answer version to
 * read, and exactly the actions `focusActions` derives from `_actions` (never a role, never the status, AGENTS.md R4/R5).
 * No versions list, no comparison, no history, no approval block: those stay in the Beantwortung. The justification of
 * a refusal is never shown, only its badge and the wording of the version.
 */
import { useId } from 'react';
import type { DomainEvent, Question, Unit } from '@hv/domain';
import { AnswerText, Badge, Button, Panel, StatusBadge, Toolbar, ToolbarSpacer } from '../../components';
import { actionLabel, useT } from '../../i18n';
import type { Translate } from '../../i18n';
import { forwardReasonLabel } from '../../i18n/labels';
import { latestIsRefusal } from '../answers/refusal';
import { READING_TARGET_SECONDS, focusActions, formatReading, lastForward, readingSeconds } from './focus';
import type { FocusAction } from './focus';

/** The label of an action button. "Weiterleiten" and "An anderen Fachbereich weiterleiten" come from the action keys. */
export function focusActionLabel(t: Translate, action: FocusAction, dirty: boolean): string {
  switch (action) {
    case 'save':
      return t('answers.editor.save');
    case 'submit':
      return actionLabel(t, 'question.submit_review');
    case 'forward':
      return actionLabel(t, 'question.forward');
    case 'write':
      return dirty ? t('focus.write.continue') : t('focus.write.open');
  }
}

/** The return reason (Rückgabegrund), in full, as the first block (048 "Hinweise 054"). */
export function ReturnedNote({ reason }: { reason: string }) {
  const t = useT();
  return (
    <p
      role="note"
      data-testid="focus-returned"
      className="rounded-md border border-status-in-review-bd bg-status-in-review-bg px-3 py-2 text-[13px] text-status-in-review-fg"
    >
      <span className="hv-label mr-2 text-status-in-review-fg">{t('answers.detail.returned')}</span>
      {reason}
    </p>
  );
}

/** Feedback Z5: how long reading the text aloud takes, at 130 words per minute; over two minutes said in words (D4). */
export function ReadingTime({ text }: { text: string }) {
  const t = useT();
  const helpId = useId();
  const seconds = readingSeconds(text);
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-2xs text-ink-600">
      <span data-testid="focus-reading-time" data-seconds={seconds} aria-describedby={helpId} className="tabular-nums">
        {t('focus.reading.time', { time: formatReading(seconds) })}
      </span>
      {seconds > READING_TARGET_SECONDS && (
        <span data-testid="focus-reading-over" className="font-medium text-ink-800">
          {t('focus.reading.over')}
        </span>
      )}
      <span id={helpId} className="sr-only">
        {t('focus.reading.help')}
      </span>
    </p>
  );
}

const unitLabel = (units: readonly Unit[], unitId: string | undefined): string | undefined => {
  const unit = units.find((candidate) => candidate.id === unitId);
  return unit === undefined ? undefined : (unit.shortName ?? unit.name);
};

export function FocusDetail({
  question,
  units,
  history,
  dirty,
  busy,
  onAction,
}: {
  question: Question;
  units: readonly Unit[];
  /** The events of this question (empty without `history.read`): the source of the last forward. */
  history: readonly DomainEvent[];
  /** Unsaved text of the writing mode for this question. */
  dirty: boolean;
  /** The write door is taken (takt-008): buttons stay focusable but do nothing. */
  busy: boolean;
  onAction: (action: FocusAction) => void;
}) {
  const t = useT();
  const { primary, secondary } = focusActions(question._actions, { dirty, writing: false });
  const forward = lastForward(history, question.unitId);
  const latest = question.answers[question.answers.length - 1];
  const refusal = latestIsRefusal(question);

  const button = (action: FocusAction, isPrimary: boolean) => (
    <Button
      key={action}
      size="sm"
      {...(isPrimary ? { 'data-primary': 'true' } : {})}
      variant={isPrimary ? 'primary' : 'secondary'}
      data-testid={`focus-${action}`}
      aria-disabled={busy}
      onClick={() => {
        if (!busy) onAction(action);
      }}
    >
      {focusActionLabel(t, action, dirty)}
    </Button>
  );

  return (
    <Panel
      className="h-full"
      padded={false}
      bodyClassName="flex min-h-0 flex-col"
      title={
        <span className="flex items-center gap-2">
          {/* Focus target after a hand-over without a primary action (takt-008), never a Tab stop of its own. */}
          <span
            tabIndex={-1}
            data-testid="focus-detail-number"
            className="font-mono text-[13px] text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            {question.number}
          </span>
          <StatusBadge status={question.status} />
          {refusal && <Badge tone="warning">{t('answers.refusal.badge')}</Badge>}
        </span>
      }
      description={
        <span data-testid="focus-detail-unit">{unitLabel(units, question.unitId) ?? t('common.none')}</span>
      }
      footer={
        primary === undefined && secondary.length === 0 ? undefined : (
          <div data-testid="focus-actions">
            <Toolbar label={t('answers.detail.actions')}>
              {secondary.map((action) => button(action, false))}
              <ToolbarSpacer />
              {primary !== undefined && button(primary, true)}
            </Toolbar>
          </div>
        )
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          {question.returnReason !== undefined && <ReturnedNote reason={question.returnReason} />}

          {forward !== undefined && (
            <p data-testid="focus-forwarded" className="text-[13px] text-ink-700">
              {t('focus.forwarded', {
                from: unitLabel(units, forward.fromUnitId) ?? t('common.none'),
                reason: forwardReasonLabel(t, forward.reasonCode),
              })}
            </p>
          )}

          <div>
            <span className="hv-label">{t('answers.detail.label')}</span>
            <p data-testid="focus-detail-text" className="mt-1 text-[16px] leading-6 text-ink-900">
              {question.text}
            </p>
            <p className="mt-2 text-2xs text-ink-600">
              <span className="hv-label mr-2">{t('answers.detail.speaker')}</span>
              <span data-testid="focus-detail-speaker">{question.speakerDisplayName ?? t('common.none')}</span>
            </p>
          </div>

          <section aria-label={t('focus.latest.title')} className="rounded-md border border-line bg-sunken px-3 py-3">
            <h3 className="hv-label">{t('focus.latest.title')}</h3>
            {latest === undefined ? (
              <p data-testid="focus-latest-none" className="mt-1 text-[13px] text-ink-600">
                {t('focus.latest.none')}
              </p>
            ) : (
              <div data-testid="focus-latest" className="mt-1 space-y-2">
                {refusal && <Badge tone="warning">{t('answers.refusal.badge')}</Badge>}
                {/* Scheibe 055b: the one renderer (the podium shows this version the same way); the reading time stays on `text`. */}
                <AnswerText answer={latest} className="text-[13px] leading-relaxed text-ink-900" />
                {latest.sources !== undefined && latest.sources.length > 0 && (
                  <p className="text-2xs text-ink-600">
                    <span className="hv-label mr-2">{t('answers.editor.sources.label')}</span>
                    {latest.sources.join('; ')}
                  </p>
                )}
                <ReadingTime text={latest.text} />
              </div>
            )}
          </section>

          {dirty && (
            <p
              data-testid="focus-draft-unsaved"
              className="rounded-md border border-line-strong bg-ink-50 px-3 py-2 text-[13px] text-ink-700"
            >
              {t('focus.draft.unsaved')}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
