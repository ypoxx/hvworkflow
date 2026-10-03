/**
 * Scheibe 045 (decision 3): the dialog "Verweigerung vorschlagen". It collects the kind of refusal, the
 * ground from the catalogue (only for "Grund aus Katalog"), the wording for the podium and the internal
 * justification (Begründung), and hands the body to the page, which writes it through `run`.
 *
 * The page renders it only while it is open, keyed to actor and question (090; review finding 3): every
 * opening starts empty, synchronously, and a change of actor or question drops every input. Inputs
 * survive only a refusal of the service while the dialog stays open (409 R-GUARD-09, 422), which the
 * dialog reports itself (`RefusalProblem`) instead of a toast.
 *
 * The marker "Formulierungsbaustein, ungeprüft (E15)" stands beside the wording field, never in it: the
 * body is built from the field contents alone (`buildRefusalProposal`).
 */
import { useId, useState } from 'react';
import type { RefusalProposal } from '@hv/domain';
import { Badge, Button, Dialog, cx } from '../../components';
import { actionLabel, useT } from '../../i18n';
import {
  EMPTY_REFUSAL_FORM,
  buildRefusalProposal,
  nextRefusalForm,
  refusalSubmitBlocked,
  showsTemplateMarker,
} from './refusal';
import type { ProposedRefusalKind, RefusalCatalogue, RefusalForm, RefusalFormEvent, RefusalProblemKey } from './refusal';

const FIELD =
  'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-ink-900 ' +
  'transition-colors duration-100 placeholder:text-ink-400 hover:border-ink-300';

const KINDS: readonly { kind: ProposedRefusalKind; label: 'answers.refusal.kind.noClaim' | 'answers.refusal.kind.withGround' }[] = [
  { kind: 'refusal_no_claim', label: 'answers.refusal.kind.noClaim' },
  { kind: 'refusal_with_ground', label: 'answers.refusal.kind.withGround' },
];

/** The dialog's own message for 409 R-GUARD-09 and 422, with the rule id where there is one (D5). */
export function RefusalProblem({ problem }: { problem: RefusalProblemKey }) {
  const t = useT();
  return (
    <p
      role="alert"
      data-testid="answer-refuse-error"
      className="mt-3 rounded-md border border-line-strong px-3 py-2 text-[13px]"
      style={{ backgroundColor: 'var(--color-tone-danger-bg)', color: 'var(--color-tone-danger-fg)' }}
    >
      {t(problem)}
      {problem === 'answers.refusal.error.guard09' && (
        <span className="ml-1 font-mono text-2xs">
          ({t('toast.rule')} R-GUARD-09)
        </span>
      )}
    </p>
  );
}

export function RefusalDialog({
  catalogue,
  busy,
  onClose,
  onSubmit,
  initialForm,
}: {
  catalogue: RefusalCatalogue;
  busy: boolean;
  onClose: () => void;
  /** Writes the body; `report` shows a refusal of the service in the dialog (via `refusalProblemHandler`). */
  onSubmit: (proposal: RefusalProposal, report: (key: RefusalProblemKey) => void) => void;
  /** For the static test only (Test 6): the page never passes it, so every opening starts empty. */
  initialForm?: RefusalForm;
}) {
  const t = useT();
  const [form, setForm] = useState<RefusalForm>(initialForm ?? EMPTY_REFUSAL_FORM);
  const [problem, setProblem] = useState<RefusalProblemKey | null>(null);
  const formId = useId();
  const markerId = useId();
  const helpId = useId();
  const groundInfoId = useId();

  const update = (event: RefusalFormEvent): void => setForm((previous) => nextRefusalForm(previous, event, catalogue.grounds));

  const blocked = busy || refusalSubmitBlocked(form, catalogue.status);
  const marker = showsTemplateMarker(form, catalogue.grounds, catalogue.status);
  const chosen = catalogue.status === 'ready' ? catalogue.grounds.find((ground) => ground.id === form.groundId) : undefined;

  const submit = (): void => {
    if (blocked) return;
    const proposal = buildRefusalProposal(form);
    if (proposal === undefined) return;
    setProblem(null);
    onSubmit(proposal, setProblem);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={actionLabel(t, 'question.refuse.propose')}
      description={t('answers.refusal.body')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {/* takt-008: `aria-disabled` keeps focus and lets a keyboard user reach the button (E7). */}
          <Button type="submit" form={formId} variant="primary" data-testid="answer-refuse-submit" aria-disabled={blocked}>
            {actionLabel(t, 'question.refuse.propose')}
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
        <fieldset>
          <legend className="hv-label">{t('answers.refusal.kind.label')}</legend>
          <div role="radiogroup" aria-required="true" className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
            {KINDS.map(({ kind, label }) => (
              <label key={kind} className="flex items-center gap-2 text-[13px] text-ink-900">
                <input
                  type="radio"
                  name={`${formId}-kind`}
                  value={kind}
                  data-testid={`answer-refuse-kind-${kind}`}
                  checked={form.kind === kind}
                  onChange={() => update({ type: 'kind', kind })}
                />
                {t(label)}
              </label>
            ))}
          </div>
        </fieldset>

        {form.kind === 'refusal_with_ground' && (
          <div>
            <span className="hv-label" id={`${formId}-ground-label`}>
              {t('answers.refusal.ground.label')}
            </span>
            {catalogue.status === 'loading' && (
              // Principle 8: a line of the field's height in the field's place, so nothing jumps.
              <p data-testid="answer-refuse-ground-loading" className="mt-1 flex h-8 items-center text-[13px] text-ink-600">
                {t('answers.refusal.ground.loading')}
              </p>
            )}
            {catalogue.status === 'failed' && (
              <p role="status" data-testid="answer-refuse-ground-failed" className="mt-1 rounded-md border border-line-strong bg-ink-50 px-3 py-2 text-[13px] text-ink-700">
                {t('answers.refusal.ground.failed')}
              </p>
            )}
            {catalogue.status === 'ready' && (
              <>
                <select
                  data-testid="answer-refuse-ground"
                  aria-labelledby={`${formId}-ground-label`}
                  {...(chosen !== undefined ? { 'aria-describedby': groundInfoId } : {})}
                  value={form.groundId ?? ''}
                  onChange={(event) => update({ type: 'ground', groundId: event.target.value === '' ? undefined : event.target.value })}
                  className={cx(FIELD, 'mt-1')}
                >
                  <option value="">{t('answers.refusal.ground.placeholder')}</option>
                  {catalogue.grounds.map((ground) => (
                    <option key={ground.id} value={ground.id}>
                      {ground.title}
                    </option>
                  ))}
                </select>
                {chosen !== undefined && (
                  <div id={groundInfoId} data-testid="answer-refuse-ground-info" className="mt-2 rounded-md border border-line bg-sunken px-3 py-2">
                    <p className="flex flex-wrap items-baseline gap-2 text-[13px] text-ink-900">
                      <span>{chosen.title}</span>
                      {chosen.legalRef.verified === false && (
                        <span data-testid="answer-refuse-ground-unverified">
                          <Badge tone="warning">{t('answers.refusal.ground.unverified')}</Badge>
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-2xs text-ink-600">
                      <span className="hv-label mr-1.5">{t('answers.refusal.ground.citation')}</span>
                      {chosen.legalRef.citation}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div>
          <label className="block">
            <span className="hv-label">{t('answers.refusal.text.label')}</span>
            <textarea
              data-testid="answer-refuse-text"
              rows={4}
              value={form.text}
              {...(marker ? { 'aria-describedby': markerId } : {})}
              onChange={(event) => update({ type: 'text', text: event.target.value })}
              className={cx(FIELD, 'mt-1 resize-y')}
            />
          </label>
          {marker && (
            <p id={markerId} data-testid="answer-refuse-marker" className="mt-1 text-2xs font-medium text-status-in-review-fg">
              {t('answers.refusal.text.marker')}
            </p>
          )}
        </div>

        <div>
          <label className="block">
            <span className="hv-label">{t('answers.refusal.justification.label')}</span>
            <textarea
              data-testid="answer-refuse-justification"
              rows={3}
              value={form.justification}
              aria-describedby={helpId}
              onChange={(event) => update({ type: 'justification', justification: event.target.value })}
              className={cx(FIELD, 'mt-1 resize-y')}
            />
          </label>
          <p id={helpId} className="mt-1 text-2xs text-ink-600">
            {t('answers.refusal.justification.help')}
          </p>
        </div>

        {problem !== null && <RefusalProblem problem={problem} />}
      </form>
    </Dialog>
  );
}
