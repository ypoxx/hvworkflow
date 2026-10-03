/**
 * Scheibe 045: the refusal (Verweigerung) in the interface, as pure helpers without React. The answer
 * view, the podium and the history read the same rules from here: which kind a version is, what is
 * known about its catalogue ground, how the wording is prefilled from a template (Formulierungsbaustein)
 * and when the marker "ungeprüft" stands beside it, what is sent, and which refusals of the service the
 * dialog reports itself.
 *
 * Nothing here decides a right: whether a refusal may be proposed or approved is `_actions`, and whether
 * the justification (Begründung) is shown is whether the record carries it (044a §6).
 */
import type { AnswerVersion, Question, RefusalGround, RefusalProposal } from '@hv/domain';
import type { TKey } from '../../i18n';
import { problemStatus } from './lib';

export type RefusalKind = 'answer' | 'refusal_no_claim' | 'refusal_with_ground';
export type ProposedRefusalKind = Exclude<RefusalKind, 'answer'>;
export type CatalogueStatus = 'loading' | 'ready' | 'failed';

/** The catalogue as a view holds it (`useRefusalGrounds`). */
export interface RefusalCatalogue {
  readonly status: CatalogueStatus;
  readonly grounds: readonly RefusalGround[];
}

/** Limits of the contract, counted in code points like `codePointLength` in packages/domain/src/api.ts. */
export const TEXT_MAX = 20000;
export const JUSTIFICATION_MAX = 4000;

/** Code points, not UTF-16 units: a native `maxLength` would cut an emoji text at about half the limit. */
export function codePointLength(value: string): number {
  return [...value].length;
}

/** The kind of a version; a version without `answerKind` is an answer. */
export function refusalKindOf(version: AnswerVersion | undefined): RefusalKind {
  const kind = version?.answerKind;
  return kind === 'refusal_no_claim' || kind === 'refusal_with_ground' ? kind : 'answer';
}

export function latestIsRefusal(question: Pick<Question, 'answers'>): boolean {
  return refusalKindOf(question.answers[question.answers.length - 1]) !== 'answer';
}

/** Some version in the record carries a justification — then the return dialog warns (decision 4). */
export function carriesJustification(question: Pick<Question, 'answers'>): boolean {
  return question.answers.some((answer) => answer.refusalJustification !== undefined);
}

export interface GroundStatus {
  entry?: RefusalGround;
  unverified: boolean;
  changed: boolean;
}

/**
 * What is known about the ground of a version, fail-safe (table of decision 1): without a loaded
 * catalogue the ground counts as unverified and nothing is claimed to have changed; a ground missing
 * from a loaded catalogue counts as unverified and changed.
 */
export function groundStatus(
  version: AnswerVersion,
  grounds: readonly RefusalGround[],
  status: CatalogueStatus,
): GroundStatus {
  if (status !== 'ready') return { unverified: true, changed: false };
  const entry = grounds.find((ground) => ground.id === version.refusalGroundId);
  if (entry === undefined) return { unverified: true, changed: true };
  return { entry, unverified: entry.legalRef.verified === false, changed: entry.hash !== version.refusalGroundHash };
}

/** The state of the dialog. `lastTemplate` is the template last put into the field. */
export interface RefusalForm {
  kind: ProposedRefusalKind | undefined;
  groundId: string | undefined;
  text: string;
  justification: string;
  lastTemplate: string | undefined;
  fromTemplate: boolean;
}

export const EMPTY_REFUSAL_FORM: RefusalForm = {
  kind: undefined,
  groundId: undefined,
  text: '',
  justification: '',
  lastTemplate: undefined,
  fromTemplate: false,
};

export type RefusalFormEvent =
  | { type: 'kind'; kind: ProposedRefusalKind }
  | { type: 'ground'; groundId: string | undefined }
  | { type: 'text'; text: string }
  | { type: 'justification'; justification: string };

/** Puts the template of the chosen ground into the field, unless the person has typed something else. */
function prefill(form: RefusalForm, grounds: readonly RefusalGround[]): RefusalForm {
  const template = grounds.find((ground) => ground.id === form.groundId)?.stageText;
  if (template === undefined) return form;
  if (form.text.trim() !== '' && form.text !== form.lastTemplate) return form;
  return { ...form, text: template, lastTemplate: template, fromTemplate: true };
}

/** The next state of the dialog (decision 3, binding): typed text is never overwritten. */
export function nextRefusalForm(
  form: RefusalForm,
  event: RefusalFormEvent,
  grounds: readonly RefusalGround[],
): RefusalForm {
  switch (event.type) {
    case 'kind': {
      const next = { ...form, kind: event.kind };
      if (event.kind === 'refusal_with_ground') return prefill(next, grounds);
      // An untouched template leaves with the ground; an edited one stays and keeps its marker.
      if (form.lastTemplate !== undefined && form.text === form.lastTemplate) {
        return { ...next, text: '', lastTemplate: undefined, fromTemplate: false };
      }
      return next;
    }
    case 'ground':
      return prefill({ ...form, groundId: event.groundId }, grounds);
    case 'text':
      return event.text.trim() === ''
        ? { ...form, text: event.text, lastTemplate: undefined, fromTemplate: false }
        : { ...form, text: event.text };
    case 'justification':
      return { ...form, justification: event.justification };
  }
}

/**
 * The marker "Formulierungsbaustein, ungeprüft (E15)" beside the field: the text comes from a template,
 * is not blank, and that template is not verified. If the template can no longer be found (catalogue
 * not loaded, or the text outlived its ground), it counts as unverified.
 */
export function showsTemplateMarker(
  form: RefusalForm,
  grounds: readonly RefusalGround[],
  status: CatalogueStatus,
): boolean {
  if (!form.fromTemplate || form.text.trim() === '') return false;
  if (status !== 'ready') return true;
  const origin = grounds.find((ground) => ground.stageText === form.lastTemplate);
  return origin === undefined || origin.legalRef.verified === false;
}

/** Submitting is locked until the input is complete and inside the limits. */
export function refusalSubmitBlocked(form: RefusalForm, status: CatalogueStatus): boolean {
  if (form.kind === undefined) return true;
  if (form.kind === 'refusal_with_ground' && (status !== 'ready' || form.groundId === undefined)) return true;
  const text = form.text.trim();
  const justification = form.justification.trim();
  if (text === '' || justification === '') return true;
  return codePointLength(text) > TEXT_MAX || codePointLength(justification) > JUSTIFICATION_MAX;
}

/** The body that is sent: only the field contents, trimmed; the marker is never part of it. */
export function buildRefusalProposal(form: RefusalForm): RefusalProposal | undefined {
  if (form.kind === undefined) return undefined;
  const base = { text: form.text.trim(), refusalJustification: form.justification.trim() };
  if (form.kind === 'refusal_no_claim') return { answerKind: 'refusal_no_claim', ...base };
  return {
    answerKind: 'refusal_with_ground',
    text: base.text,
    ...(form.groundId !== undefined ? { refusalGroundId: form.groundId } : {}),
    refusalJustification: base.refusalJustification,
  };
}

export type RefusalProblemKey = Extract<TKey, 'answers.refusal.error.guard09' | 'answers.refusal.error.invalid'>;

function ruleIdOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
}

/** The refusals the dialog reports itself (409 R-GUARD-09, 422); every other one goes its usual way. */
export function refusalProblemKey(error: unknown): RefusalProblemKey | undefined {
  const status = problemStatus(error);
  if (status === 409 && ruleIdOf(error) === 'R-GUARD-09') return 'answers.refusal.error.guard09';
  if (status === 422) return 'answers.refusal.error.invalid';
  return undefined;
}

/**
 * The `onProblem` of the refusal dialog for `run` (answers/Page.tsx): its own refusals are shown in the
 * dialog and handled (no toast); a 412 closes the dialog while its question is still shown and leaves the
 * notice "Stand veraltet" to `run`; everything else goes on to the toast with the dialog left open.
 */
export function refusalProblemHandler(
  show: (key: RefusalProblemKey) => void,
  close: () => void,
): (error: unknown, stillShown: () => boolean) => boolean {
  return (error, stillShown) => {
    const key = refusalProblemKey(error);
    if (key !== undefined) {
      show(key);
      return true;
    }
    if (problemStatus(error) === 412 && stillShown()) close();
    return false;
  };
}
