/**
 * Scheibe 053 (decision 4): the dialog "An anderen Fachbereich weiterleiten" (forward to another answering unit).
 * Built once here, next to the other write dialogs; the steering view offers it (053), the focus view reuses it (054).
 *
 * It collects a target unit and one of four closed reason codes and hands the body to the page, which writes it
 * through the write door (`useWriteDoor`). Neither is preselected: a preselected target would widen who reads the
 * question to a unit nobody chose (048, MF-14) — deliberately unlike `AssignDialog`. There is no text field, not even
 * for "Sonstiges": the log cannot forget a text (048 decision 4). Before sending, the note says who reads afterwards.
 *
 * The page renders it only while it is open, keyed to actor and question (090): every opening starts empty. Inputs
 * survive only a refusal the dialog reports itself (409 R-GUARD-15, 422).
 */
import { useId, useState } from 'react';
import type { ForwardRequest, Question, Unit } from '@hv/domain';
import { Button, Dialog, cx } from '../../components';
import { actionLabel, useT } from '../../i18n';
import { forwardReasonLabel } from '../../i18n/labels';
import { EMPTY_FORWARD_FORM, FORWARD_REASONS, buildForwardRequest, forwardTargets } from './forward';
import type { ForwardDialogProblem, ForwardForm } from './forward';

const FIELD =
  'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-ink-900 ' +
  'transition-colors duration-100 placeholder:text-ink-400 hover:border-ink-300';

const PROBLEM_KEYS = {
  guard15: 'answers.forward.error.guard15',
  invalid: 'answers.forward.error.invalid',
} as const;

/** The dialog's own message for 409 R-GUARD-15 and 422, with the rule id where there is one (D5). */
export function ForwardProblem({ problem }: { problem: ForwardDialogProblem }) {
  const t = useT();
  return (
    <p
      role="alert"
      data-testid="forward-problem"
      className="rounded-md border border-line-strong px-3 py-2 text-[13px]"
      style={{ backgroundColor: 'var(--color-tone-danger-bg)', color: 'var(--color-tone-danger-fg)' }}
    >
      {t(PROBLEM_KEYS[problem])}
      {problem === 'guard15' && (
        <span className="ml-1 font-mono text-2xs">
          ({t('toast.rule')} R-GUARD-15)
        </span>
      )}
    </p>
  );
}

export function ForwardDialog({
  question,
  units,
  busy,
  onClose,
  onSubmit,
  initialForm,
}: {
  question: Pick<Question, 'number' | 'unitId'>;
  units: readonly Unit[];
  busy: boolean;
  onClose: () => void;
  /** Writes the body; `report` shows a refusal of the service in the dialog (via `forwardProblemHandler`). */
  onSubmit: (request: ForwardRequest, report: (key: ForwardDialogProblem) => void) => void;
  /** For the static test only (Test 6): the pages never pass it, so every opening starts empty. */
  initialForm?: ForwardForm;
}) {
  const t = useT();
  const [form, setForm] = useState<ForwardForm>(initialForm ?? EMPTY_FORWARD_FORM);
  const [problem, setProblem] = useState<ForwardDialogProblem | null>(null);
  const formId = useId();
  const noteId = useId();
  const unitLabelId = useId();

  const current = units.find((unit) => unit.id === question.unitId);
  const targets = forwardTargets(units, question.unitId);
  const request = buildForwardRequest(form);
  const blocked = busy || request === undefined;

  const submit = (): void => {
    if (blocked || request === undefined) return;
    setProblem(null);
    onSubmit(request, setProblem);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={actionLabel(t, 'question.forward')}
      description={t('answers.forward.body')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {/* takt-008: `aria-disabled` keeps focus and lets a keyboard user reach the button. */}
          <Button type="submit" form={formId} variant="primary" data-testid="forward-submit" aria-disabled={blocked}>
            {actionLabel(t, 'question.forward')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <p className="text-[13px] text-ink-900">
          <span className="hv-label mr-2">{t('answers.detail.unit')}</span>
          <span data-testid="forward-current-unit">{current === undefined ? t('common.none') : (current.shortName ?? current.name)}</span>
          <span className="ml-2 font-mono text-2xs text-ink-600">{question.number}</span>
        </p>

        <div>
          <span className="hv-label" id={unitLabelId}>
            {t('answers.forward.unit.label')}
          </span>
          <select
            data-testid="forward-unit"
            aria-labelledby={unitLabelId}
            aria-describedby={noteId}
            aria-required="true"
            value={form.unitId ?? ''}
            onChange={(event) => {
              const unitId = event.target.value;
              setForm((previous) => ({ ...previous, unitId: unitId === '' ? undefined : unitId }));
            }}
            className={cx(FIELD, 'mt-1')}
          >
            <option value="">{t('answers.forward.unit.placeholder')}</option>
            {targets.map((unit) => (
              // The short name, as the list's unit filter and the steering detail name the unit (045).
              <option key={unit.id} value={unit.id}>
                {unit.shortName ?? unit.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="hv-label">{t('answers.forward.reason.label')}</legend>
          <div role="radiogroup" aria-required="true" aria-describedby={noteId} className="mt-1.5 grid gap-1.5">
            {FORWARD_REASONS.map((code) => (
              <label key={code} className="flex items-center gap-2 text-[13px] text-ink-900">
                <input
                  type="radio"
                  name={`${formId}-reason`}
                  value={code}
                  data-testid={`forward-reason-${code}`}
                  checked={form.reasonCode === code}
                  onChange={() => setForm((previous) => ({ ...previous, reasonCode: code }))}
                />
                {forwardReasonLabel(t, code)}
              </label>
            ))}
          </div>
        </fieldset>

        <p
          id={noteId}
          role="note"
          data-testid="forward-readers"
          className="rounded-md border border-status-in-review-bd bg-status-in-review-bg px-3 py-2 text-[13px] text-status-in-review-fg"
        >
          {t('answers.forward.readers')}
        </p>

        {problem !== null && <ForwardProblem problem={problem} />}
      </form>
    </Dialog>
  );
}
