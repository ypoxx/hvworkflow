/**
 * One question, everything that has been written about it, and exactly the steps this person may
 * take on it right now.
 *
 * Nothing on this side is inferred: status, answer versions and approval are read from the record,
 * a lapsed approval is read from the event log, and every button without exception is gated on
 * `question._actions`. What may not be done is not shown — it is not greyed out (principle 9).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Lock, ShieldCheck, ShieldOff, Undo2 } from 'lucide-react';
import type { Ref } from 'react';
import { Link } from 'react-router';
import type { AnswerBodyInput, AnswerVersion, DomainEvent, Question, Unit } from '@hv/domain';
import { TERMINAL_STATUSES } from '@hv/domain';
import { answerBodyOf, sameBody } from '../../api/answerFormat';
import { useActor } from '../../api/actor';
import {
  AnswerText,
  Badge,
  Button,
  KeyValue,
  KeyValueList,
  Panel,
  StageAssignmentBadge,
  StaleBanner,
  StatusBadge,
  Toolbar,
  ToolbarSpacer,
  TrackBadge,
  cx,
} from '../../components';
import { actionLabel, stageAssignmentLabel, trackLabel, useT } from '../../i18n';
import { isDirty } from '../focus/focus';
import type { FocusDraft } from '../focus/focus';
import { AnswerEditor } from './AnswerEditor';
import { afterSave, canSave as mayBeSaved, discard, onRecord, startDraft } from './draft';
import { clockTime, lapsedApproval, latestVersion, sealedApproval, wordDiff } from './lib';
import { groundStatus, latestIsRefusal, refusalKindOf } from './refusal';
import type { RefusalCatalogue } from './refusal';

/**
 * "Änderung gegenüber Version n-1" (point 3): a word-level diff, removed words struck through,
 * added words underlined. Rendered inline so that reading it needs no separate view.
 *
 * Scheibe 055b: the diff stays on `text`. When the wording is the same and only the documents differ (a mark added or
 * taken away, 055 decision 7: still a new version), it says so instead of showing an empty diff.
 */
export function AnswerDiff({
  previous,
  current,
}: {
  previous: Pick<AnswerVersion, 'text' | 'body'>;
  current: Pick<AnswerVersion, 'text' | 'body'>;
}) {
  const t = useT();
  const parts = useMemo(() => wordDiff(previous.text, current.text), [previous.text, current.text]);
  if (previous.text === current.text && !sameBody(answerBodyOf(previous), answerBodyOf(current))) {
    return (
      <p
        data-testid="answer-diff-format-only"
        className="mt-2 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] leading-relaxed text-ink-700"
      >
        {t('answers.version.formatOnly')}
      </p>
    );
  }
  return (
    <p
      data-testid="answer-diff"
      className="mt-2 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
    >
      {parts.map((part, index) => {
        if (part.type === 'equal') return <span key={index}>{part.text} </span>;
        if (part.type === 'removed') {
          return (
            <span
              key={index}
              className="line-through"
              style={{
                backgroundColor: 'var(--color-tone-danger-bg)',
                color: 'var(--color-tone-danger-fg)',
              }}
            >
              {part.text}{' '}
            </span>
          );
        }
        return (
          <span
            key={index}
            className="underline"
            style={{
              backgroundColor: 'var(--color-tone-success-bg)',
              color: 'var(--color-tone-success-fg)',
            }}
          >
            {part.text}{' '}
          </span>
        );
      })}
    </p>
  );
}

export type DetailAction =
  | { kind: 'draft'; body: AnswerBodyInput; sources: string }
  | { kind: 'submit_review' }
  | { kind: 'approve'; version: number }
  | { kind: 'refuse_approve'; version: number }
  | { kind: 'legal_clear'; version?: number }
  | { kind: 'stage' }
  | { kind: 'open-return' }
  | { kind: 'open-assign' }
  | { kind: 'open-merge' }
  | { kind: 'open-withdraw' }
  | { kind: 'open-refusal' };

interface QuestionDetailProps {
  question: Question;
  /** The events of this question; carries the fact of a lapsed approval. Empty, and meaningless,
   *  while `historyForbidden` is true. */
  history: readonly DomainEvent[];
  /** Major (review round 2): `getQuestionHistory` is a Nebenabfrage of this one question, fetched
   *  and can fail on its own — this shows the refused state exactly where the lapsed-approval note
   *  would otherwise stand, instead of silently pretending there never was one. */
  historyForbidden: boolean;
  units: readonly Unit[];
  busy: boolean;
  /** Bumped by the page after a version was written (only on that question, 010d Ziel 3); the sent text becomes the
   *  draft's base (takt-048 decision 6). */
  draftResetToken: number;
  /**
   * Scheibe 045 (decision 5, Fokusziel 'version'): bumped by the page after a refusal was written for
   * this question at `version`; the focus then goes to the card of the new latest version once a record
   * read after the write is shown.
   */
  versionFocus: { token: number; version: number };
  /** Scheibe 045: the catalogue of refusal grounds of this actor (`useRefusalGrounds`). */
  catalogue: RefusalCatalogue;
  onAction: (action: DetailAction) => void;
}

/**
 * Scheibe 045 (decision 5): what a refusal version says beyond its wording — the ground by its title (or
 * its id, when the loaded catalogue does not know it), "ungeprüft", a ground changed since the proposal
 * (latest version only; a fact, not a right), and the justification exactly when the record carries it.
 */
function RefusalFacts({ answer, latest, catalogue }: { answer: AnswerVersion; latest: boolean; catalogue: RefusalCatalogue }) {
  const t = useT();
  const kind = refusalKindOf(answer);
  const status = kind === 'refusal_with_ground' ? groundStatus(answer, catalogue.grounds, catalogue.status) : undefined;
  return (
    <>
      {status !== undefined && (
        <p data-testid="answer-refusal-ground" className="mt-2.5 flex flex-wrap items-baseline gap-2 text-[13px] text-ink-800">
          <span className="hv-label">{t('answers.refusal.ground.label')}</span>
          {status.entry !== undefined ? (
            <span>{status.entry.title}</span>
          ) : (
            <span>
              <span className="font-mono text-2xs">{answer.refusalGroundId ?? ''}</span>{' '}
              <span className="text-ink-600">{t('answers.refusal.ground.unknown', { id: answer.refusalGroundId ?? '' })}</span>
            </span>
          )}
          {status.unverified && <Badge tone="warning">{t('answers.refusal.ground.unverified')}</Badge>}
        </p>
      )}
      {status !== undefined && status.changed && latest && (
        <p data-testid="answer-refusal-changed" className="mt-2 rounded-md border border-line-strong bg-ink-50 px-3 py-2 text-[13px] text-ink-700">
          {t('answers.refusal.ground.changed')}
        </p>
      )}
      {answer.refusalJustification !== undefined && (
        <div data-testid="answer-refusal-justification" className="mt-2.5">
          <span className="hv-label">{t('answers.refusal.justification.label')}</span>
          <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-800">{answer.refusalJustification}</p>
        </div>
      )}
    </>
  );
}

function VersionCard({
  answer,
  catalogue,
  headerRef,
  version,
  author,
  at,
  sources,
  previous,
  latest,
  open,
  onToggle,
}: {
  answer: AnswerVersion;
  catalogue: RefusalCatalogue;
  /** The card header of the latest version: focus target after a refusal was written (Fokusziel 'version'). */
  headerRef?: Ref<HTMLButtonElement>;
  version: number;
  author: string;
  at: string;
  sources: readonly string[] | undefined;
  /** Version n-1, when there is one — carries the diff toggle (point 3). */
  previous: AnswerVersion | undefined;
  latest: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const [showDiff, setShowDiff] = useState(false);
  const kind = refusalKindOf(answer);
  return (
    <div
      data-testid="answer-version"
      data-version={version}
      className={cx(
        'overflow-hidden rounded-md border',
        latest ? 'border-line-strong bg-surface' : 'border-line bg-sunken',
      )}
    >
      <button
        ref={headerRef}
        type="button"
        data-testid="answer-version-toggle"
        aria-expanded={open}
        aria-label={t('answers.version.toggle', { version })}
        onClick={onToggle}
        className="flex h-9 w-full items-center gap-2 px-2.5 text-left transition-colors duration-100 hover:bg-ink-25"
      >
        {open ? (
          <ChevronDown size={14} strokeWidth={1.75} className="text-ink-400" aria-hidden="true" />
        ) : (
          <ChevronRight size={14} strokeWidth={1.75} className="text-ink-400" aria-hidden="true" />
        )}
        <Badge tone={latest ? 'accent' : 'neutral'} mono>
          {t('answers.version.label', { version })}
        </Badge>
        {kind !== 'answer' && (
          // D4: danger only as a badge.
          <Badge tone="danger">
            {t(kind === 'refusal_no_claim' ? 'answers.refusal.kind.noClaim' : 'answers.refusal.kind.withGround')}
          </Badge>
        )}
        {latest && <span className="text-2xs text-ink-500">{t('answers.version.latest')}</span>}
        <span className="ml-auto flex items-center gap-3">
          <span className="truncate text-2xs text-ink-500">{author}</span>
          <span className="font-mono text-2xs tabular-nums text-ink-400">{clockTime(at)}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5">
          {kind !== 'answer' && <span className="hv-label">{t('answers.refusal.text.label')}</span>}
          {/* Scheibe 055b: the one renderer — the podium shows the approved version exactly like this (Recht/Freigabe). */}
          <AnswerText answer={answer} className="text-[13px] leading-relaxed text-ink-800" />
          {kind !== 'answer' && <RefusalFacts answer={answer} latest={latest} catalogue={catalogue} />}
          {sources !== undefined && sources.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="hv-label">{t('answers.version.sources')}</span>
              {sources.map((source) => (
                <Badge key={source} tone="outline">
                  {source}
                </Badge>
              ))}
            </div>
          )}
          {previous !== undefined && (
            <>
              <button
                type="button"
                data-testid="answer-diff-toggle"
                aria-expanded={showDiff}
                onClick={() => setShowDiff((value) => !value)}
                className={cx(
                  'mt-2.5 inline-flex h-6 items-center rounded-sm px-1.5 text-2xs font-medium',
                  'text-ink-500 transition-colors duration-100 hover:bg-ink-50 hover:text-ink-700',
                )}
              >
                {t('answers.diff.toggle', { previous: version - 1 })}
              </button>
              {showDiff && <AnswerDiff previous={previous} current={answer} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function QuestionDetail({
  question,
  history,
  historyForbidden,
  units,
  busy,
  draftResetToken,
  versionFocus,
  catalogue,
  onAction,
}: QuestionDetailProps) {
  const t = useT();
  const latest = latestVersion(question);
  const [open, setOpen] = useState<readonly number[]>(latest === undefined ? [] : [latest]);
  const actorId = useActor().id;
  /**
   * takt-048: the draft starts with the latest answer version (`draftBase`, as the focus view; empty over a refusal). It
   * is the focus view's `FocusDraft`: the input form, its sources and the base it started from; `generation` rebuilds
   * the field (055b decision 7). This component is keyed per question, so a new question starts a new draft.
   */
  const [draft, setDraft] = useState<FocusDraft>(() => startDraft(actorId, question));
  // What `onSave` sent, for `afterSave` once the page reports the write done (`draftResetToken`).
  const [sent, setSent] = useState<{ body: AnswerBodyInput; sources: string; version: number } | null>(null);

  useEffect(() => {
    if (latest === undefined) return;
    setOpen((previous) => (previous.includes(latest) ? previous : [...previous, latest]));
  }, [latest]);

  /**
   * takt-008: every adjustment of the draft below happens during render, not in an effect — the render that unlocks the
   * editor's button (`busy` false again) must already carry the settled draft. An effect would commit one frame with an
   * unsettled draft and an open button, and a quick second Enter would save it twice. The three steps run in one pass
   * on one value, in this order, so none overwrites another.
   */
  const [draftActorId, setDraftActorId] = useState(actorId);
  const [resetSeen, setResetSeen] = useState(draftResetToken);
  const [recordSeen, setRecordSeen] = useState(question);
  if (draftActorId !== actorId || resetSeen !== draftResetToken || recordSeen !== question) {
    let next = draft;
    // takt-048, decision 2 (090, 010d Ziel 1): another actor starts a new draft from the record, compared by `id`,
    // never by role (AGENTS.md R4). The new actor sees the record, never the previous actor's text.
    if (draftActorId !== actorId) {
      setDraftActorId(actorId);
      next = startDraft(actorId, question, draft.generation + 1);
      setSent(null);
    } else if (resetSeen !== draftResetToken && sent !== null) {
      // takt-048, decision 6: the own version was written — its text is the new base; the field is not rebuilt, and
      // what was typed while saving stays and counts as a change.
      next = afterSave(next, sent, sent.version);
      setSent(null);
    }
    if (resetSeen !== draftResetToken) setResetSeen(draftResetToken);
    // takt-048, decision 2: a new record of this question is compared with the draft (`writingOutcome`): one's own
    // version moves the base, a foreign version over an unchanged draft is shown, over a changed one the notice stands.
    if (recordSeen !== question) {
      setRecordSeen(question);
      next = onRecord(next, question).draft;
    }
    if (next !== draft) setDraft(next);
  }

  /**
   * takt-008: "Zur Prüfung" and "Freigeben" leave the command bar together with the step they
   * take (`_actions` no longer offers them), and the focus they held falls to `<body>`. It is
   * moved to the block that shows the outcome — the new status or the Freigabe — so the person
   * (and a screen reader) lands on what just happened, and a second Enter there changes nothing.
   *
   * Review round 1, finding 4: the marker is settled with the write. A different question remounts
   * this component (`key={question.id}`), which clears it too.
   *
   * Slice 010c, Ziel 6 (N1 of takt-008's Nachprüfung): the marker holds the record the step was
   * taken on, and is settled only once a record read after it is on screen. After a refusal the
   * lock falls at once (answers/Page.tsx) while the page still shows the old copy; a 412 means the
   * record did move, and the step's button leaves only with the re-read — clearing the marker when
   * the lock fell dropped the focus to `<body>` right then.
   */
  const approvalBlock = useRef<HTMLDivElement>(null);
  const legalClearanceBlock = useRef<HTMLDivElement>(null);
  const latestCard = useRef<HTMLButtonElement>(null);
  // Scheibe 045: 'version' holds the version the refusal was written against; the card is focused once
  // a newer record is shown (decision 5, review finding 14).
  const stepTaken = useRef<
    { question: Question; target: 'approval' | 'legal' } | { fromVersion: number; target: 'version' } | null
  >(null);
  // The page bumps the token in the write's `onDone`. Declared before the focus effect below, so in the
  // commit that carries a new token the marker is set before that effect reads it.
  const focusSeen = useRef(versionFocus.token);
  useEffect(() => {
    if (focusSeen.current === versionFocus.token) return;
    focusSeen.current = versionFocus.token;
    stepTaken.current = { fromVersion: versionFocus.version, target: 'version' };
  }, [versionFocus]);

  const unit = useMemo(
    () => units.find((candidate) => candidate.id === question.unitId),
    [units, question.unitId],
  );

  const may = question._actions;
  const mayDraft = may.includes('answer.draft');
  const maySubmit = may.includes('question.submit_review');
  const mayApprove = may.includes('question.approve');
  const mayLegalClear = may.includes('question.legal.clear');
  const mayStage = may.includes('question.stage');
  const mayReturn = may.includes('question.return');
  const mayAssign = may.includes('question.assign');
  const mayMerge = may.includes('question.merge');
  const mayWithdraw = may.includes('question.withdraw');
  const mayRefusePropose = may.includes('question.refuse.propose');
  const mayRefuseApprove = may.includes('question.refuse.approve');
  const refusalLatest = latestIsRefusal(question);

  useEffect(() => {
    const taken = stepTaken.current;
    if (busy || taken === null) return;
    if (taken.target === 'legal' && question !== taken.question) {
      stepTaken.current = null;
      legalClearanceBlock.current?.focus();
      return;
    }
    if (taken.target === 'version') {
      if (question.version !== taken.fromVersion) {
        stepTaken.current = null;
        latestCard.current?.focus();
      }
      return;
    }
    const active = document.activeElement;
    if (active === null || active === document.body) {
      stepTaken.current = null;
      approvalBlock.current?.focus();
      return;
    }
    // The button kept its focus: the step is settled once a record read after it is shown.
    if (question !== taken.question) stepTaken.current = null;
  }, [busy, question, versionFocus]);

  // takt-048, decision 3: changed against the base (the latest version or what was saved last), not merely non-empty.
  const dirty = isDirty(draft);
  const saveable = mayBeSaved(draft, { mayDraft, busy });
  // Exactly one primary action (D2): the step that moves this question on — unless the draft in the
  // editor is changed, then saving it is what the person is doing (takt-048, decision 5).
  // Scheibe 045: approving a refusal stands where approving an answer stands (R-GUARD-12/13 exclude each
  // other); proposing a refusal is never primary.
  const primary: 'draft' | 'legal_clear' | 'approve' | 'refuse_approve' | 'submit' | 'stage' | 'none' =
    dirty && mayDraft
      ? 'draft'
      : mayLegalClear
        ? 'legal_clear'
      : mayApprove
        ? 'approve'
      : mayRefuseApprove
        ? 'refuse_approve'
        : maySubmit
          ? 'submit'
          : mayStage
            ? 'stage'
            : mayDraft
              ? 'draft'
              : 'none';

  const seal = sealedApproval(question);
  const lapsed = lapsedApproval(question, history);
  // A question that has come to rest (closed, withdrawn, merged) offers nothing; then the command
  // bar is not empty, it is gone.
  const hasSteps =
    mayWithdraw || mayMerge || mayAssign || mayReturn || maySubmit || mayLegalClear || mayApprove || mayStage ||
    mayRefusePropose || mayRefuseApprove;
  /**
   * Point #26 (feedback, slice 020): "Wieso kann ich hier nicht rein?" — a role without any editing
   * action for this question used to leave an empty command bar with no explanation. `_actions`
   * alone decides this, never the role name (AGENTS.md rule 4).
   *
   * m3 (review round 1): a question that has come to rest — delivered or one of the terminal
   * statuses — offers nobody a next step, in any role; the StatusBadge already says so, so the hint
   * would only repeat it. It is read from `question.status`, not inferred, the same way `hasSteps`'
   * own comment already treats "come to rest" as a status fact.
   */
  const atRest = question.status === 'delivered' || TERMINAL_STATUSES.includes(question.status);
  const mayEditAnything = atRest || hasSteps || mayDraft;

  return (
    <Panel
      className="h-full"
      padded={false}
      bodyClassName="flex min-h-0 flex-col"
      title={
        <span className="flex items-center gap-2">
          <span data-testid="answers-detail-number" className="font-mono text-[13px] text-ink-900">
            {question.number}
          </span>
          <StatusBadge status={question.status} />
          {question.track !== undefined && <TrackBadge track={question.track} />}
          {question.stageAssignment !== undefined && (
            <StageAssignmentBadge assignment={question.stageAssignment} />
          )}
        </span>
      }
      description={question.speakerDisplayName ?? t('common.none')}
      footer={
        !mayEditAnything ? (
          <p data-testid="answers-readonly-hint" className="flex items-center gap-1.5 text-ink-600">
            <Eye size={13} strokeWidth={1.75} aria-hidden="true" />
            {t('answers.readonly.hint')}
          </p>
        ) : hasSteps ? (
          <Toolbar label={t('answers.detail.actions')}>
            {mayWithdraw && (
              <Button
                size="sm"
                variant="ghost"
                data-testid="answer-withdraw"
                disabled={busy}
                onClick={() => onAction({ kind: 'open-withdraw' })}
              >
                {actionLabel(t, 'question.withdraw')}
              </Button>
            )}
            {mayMerge && (
              <Button
                size="sm"
                variant="ghost"
                data-testid="answer-merge"
                disabled={busy}
                onClick={() => onAction({ kind: 'open-merge' })}
              >
                {actionLabel(t, 'question.merge')}
              </Button>
            )}
            <ToolbarSpacer />
            {mayRefusePropose && (
              <Button
                data-testid="answer-refuse"
                variant="secondary"
                disabled={busy}
                onClick={() => onAction({ kind: 'open-refusal' })}
              >
                {actionLabel(t, 'question.refuse.propose')}
              </Button>
            )}
            {mayAssign && (
              <Button
                data-testid="answer-assign"
                disabled={busy}
                onClick={() => onAction({ kind: 'open-assign' })}
              >
                {actionLabel(t, 'question.assign')}
              </Button>
            )}
            {mayReturn && (
              <Button
                data-testid="answer-return"
                icon={<Undo2 size={15} strokeWidth={1.75} aria-hidden="true" />}
                disabled={busy}
                onClick={() => onAction({ kind: 'open-return' })}
              >
                {actionLabel(t, 'question.return')}
              </Button>
            )}
            {maySubmit && (
              <Button
                data-testid="answer-submit-review"
                variant={primary === 'submit' ? 'primary' : 'secondary'}
                // takt-008: `aria-disabled` keeps focus while the step is written (Button.tsx).
                aria-disabled={busy}
                onClick={() => {
                  stepTaken.current = { question, target: 'approval' };
                  onAction({ kind: 'submit_review' });
                }}
              >
                {actionLabel(t, 'question.submit_review')}
              </Button>
            )}
            {mayLegalClear && (
              <Button
                data-testid="answer-legal-clear"
                variant={primary === 'legal_clear' ? 'primary' : 'secondary'}
                aria-disabled={busy}
                onClick={() => {
                  stepTaken.current = { question, target: 'legal' };
                  onAction(latest === undefined ? { kind: 'legal_clear' } : { kind: 'legal_clear', version: latest });
                }}
              >
                {latest === undefined
                  ? t('answers.legalClear.podium')
                  : t('answers.legalClear.label', { version: latest })}
              </Button>
            )}
            {mayApprove && latest !== undefined && (
              <Button
                data-testid="answer-approve"
                variant={primary === 'approve' ? 'primary' : 'secondary'}
                aria-disabled={busy}
                onClick={() => {
                  stepTaken.current = { question, target: 'approval' };
                  onAction({ kind: 'approve', version: latest });
                }}
              >
                {t('answers.approve.label', { version: latest })}
              </Button>
            )}
            {mayRefuseApprove && latest !== undefined && (
              <Button
                data-testid="answer-refuse-approve"
                variant={primary === 'refuse_approve' ? 'primary' : 'secondary'}
                aria-disabled={busy}
                onClick={() => {
                  stepTaken.current = { question, target: 'approval' };
                  onAction({ kind: 'refuse_approve', version: latest });
                }}
              >
                {t('answers.refusal.approve.label', { version: latest })}
              </Button>
            )}
            {mayStage && (
              <Button
                data-testid="answer-stage"
                variant={primary === 'stage' ? 'primary' : 'secondary'}
                disabled={busy}
                onClick={() => onAction({ kind: 'stage' })}
              >
                {actionLabel(t, 'question.stage')}
              </Button>
            )}
          </Toolbar>
        ) : undefined
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <div>
            <span className="hv-label">{t('answers.detail.label')}</span>
            <p className="mt-1 text-[16px] leading-6 text-ink-900">{question.text}</p>
          </div>

          <KeyValueList className="grid-cols-2 sm:grid-cols-3">
            <KeyValue label={t('answers.detail.speaker')}>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="truncate">{question.speakerDisplayName ?? t('common.none')}</span>
                {/* The capture desk opens on this Wortmeldung — the question came out of its Redebeitrag. */}
                <Link
                  data-testid="answers-detail-contribution"
                  to={`/capture?speaker=${encodeURIComponent(question.speakerId)}`}
                  className="text-2xs text-accent-600 underline underline-offset-2 hover:text-accent-700"
                >
                  {t('answers.detail.contributionLink')}
                </Link>
              </span>
            </KeyValue>
            <KeyValue label={t('answers.detail.track')}>
              {question.track === undefined ? t('common.none') : trackLabel(t, question.track)}
            </KeyValue>
            <KeyValue label={t('answers.detail.unit')}>{unit?.name ?? t('common.none')}</KeyValue>
            <KeyValue label={t('answers.detail.stageAssignment')}>
              {question.stageAssignment === undefined
                ? t('common.none')
                : stageAssignmentLabel(t, question.stageAssignment)}
            </KeyValue>
          </KeyValueList>

          {question.returnReason !== undefined && (
            <p className="rounded-md border border-status-in-review-bd bg-status-in-review-bg px-3 py-2 text-[13px] text-status-in-review-fg">
              <span className="hv-label mr-2 text-status-in-review-fg">
                {t('answers.detail.returned')}
              </span>
              {question.returnReason}
            </p>
          )}

          <div
            ref={approvalBlock}
            data-testid="approval-block"
            // Focus target only (see `stepTaken`), never a Tab stop of its own; a named group so that
            // a screen reader says what it has landed on (review round 1, finding 6).
            tabIndex={-1}
            role="group"
            aria-label={t('answers.approval.group')}
            className={cx(
              'flex items-center gap-2 rounded-md border px-3 py-2',
              seal !== undefined
                ? 'border-status-approved-bd bg-status-approved-bg'
                : 'border-line bg-sunken',
            )}
          >
            {seal !== undefined ? (
              <>
                <ShieldCheck
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-status-approved-fg"
                  aria-hidden="true"
                />
                <span className="text-[13px] font-medium text-status-approved-fg">
                  {t('answers.approval.sealed', {
                    version: seal.answerVersion,
                    actor: seal.approvedBy.displayName ?? seal.approvedBy.id,
                    time: clockTime(seal.approvedAt),
                  })}
                </span>
              </>
            ) : (
              <>
                <span className="hv-label">{t('answers.status.label')}</span>
                <StatusBadge status={question.status} />
              </>
            )}
          </div>

          {question.legalClearance !== undefined && (
            <div
              ref={legalClearanceBlock}
              data-testid="legal-clearance-block"
              tabIndex={-1}
              role="group"
              aria-label={t('answers.legalClear.group')}
              className="flex items-center gap-2 rounded-md border border-status-approved-bd bg-status-approved-bg px-3 py-2 text-[13px] font-medium text-status-approved-fg"
            >
              <ShieldCheck size={16} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
              <span>
                {question.legalClearance.answerVersion === undefined
                  ? t('answers.legalClear.podiumSealed')
                  : t('answers.legalClear.sealed', { version: question.legalClearance.answerVersion })}
              </span>
            </div>
          )}

          {/* Major (review round 2): the Nebenabfrage `getQuestionHistory` failed for this one
           * question — put the refused state exactly where its finding (a lapsed approval) would
           * otherwise stand, `role="status"` marks it as a status message (minor 5) — a
           * hint to assistive technology, not a guaranteed announcement: a live region mounted
           * together with its content is often not announced (nit 6, review round 3). */}
          {historyForbidden && (
            <p
              data-testid="answers-history-forbidden"
              role="status"
              className="flex items-center gap-2 rounded-md border border-line-strong bg-ink-50 px-3 py-2 text-[13px] text-ink-600"
            >
              <Lock size={16} strokeWidth={1.75} className="shrink-0 text-ink-400" aria-hidden="true" />
              {t('answers.history.forbidden')}
            </p>
          )}

          {/* A seal the newest text has voided. Read from the event log, never from the status. */}
          {lapsed !== undefined && (
            <p
              data-testid="approval-lapsed"
              className="flex items-center gap-2 rounded-md border border-line-strong bg-ink-50 px-3 py-2 text-[13px] text-ink-600"
            >
              <ShieldOff
                size={16}
                strokeWidth={1.75}
                className="shrink-0 text-ink-400"
                aria-hidden="true"
              />
              {t('answers.approval.lapsed', { previous: lapsed.previous, current: lapsed.current })}
            </p>
          )}

          <div className="space-y-2">
            <span className="hv-label">{t('answers.versions.title')}</span>
            {/* Slice 013 (axe, goal 1): ink-500 measured 3.74:1 here — below 4.5:1. ink-600 is an
             * existing token elsewhere in the same panel (e.g. the lapsed-approval hint above) and
             * clears WCAG AA at this size. */}
            {question.answers.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong bg-sunken px-3 py-3 text-[13px] text-ink-600">
                {question.track === 'podium'
                  ? t('answers.versions.podium')
                  : t('answers.versions.empty.body')}
              </p>
            ) : (
              <div className="space-y-1.5">
                {question.answers.map((answer, index) => (
                  <VersionCard
                    key={answer.version}
                    answer={answer}
                    catalogue={catalogue}
                    {...(answer.version === latest ? { headerRef: latestCard } : {})}
                    version={answer.version}
                    author={answer.createdBy.displayName ?? answer.createdBy.id}
                    at={answer.createdAt}
                    sources={answer.sources}
                    previous={question.answers[index - 1]}
                    latest={answer.version === latest}
                    open={open.includes(answer.version)}
                    onToggle={() =>
                      setOpen((previous) =>
                        previous.includes(answer.version)
                          ? previous.filter((version) => version !== answer.version)
                          : [...previous, answer.version],
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {mayDraft && refusalLatest && (
            // R-TRANS-03 unchanged: a draft over a refusal is allowed; the person learns what it does.
            <p data-testid="answer-editor-refusal-hint" className="rounded-md border border-line-strong bg-ink-50 px-3 py-2 text-[13px] text-ink-700">
              {t('answers.refusal.editorHint')}
            </p>
          )}
          {mayDraft && draft.rebase && (
            // takt-048, decision 2: a newer version arrived over changed text; the text stays until "Neu laden".
            <StaleBanner
              testId="answer-editor-rebase"
              message={t('answers.editor.rebase')}
              onReload={() => setDraft(startDraft(actorId, question, draft.generation + 1))}
            />
          )}
          {mayDraft && (
            <AnswerEditor
              body={draft.body}
              generation={draft.generation}
              sources={draft.sources}
              busy={busy}
              canSave={saveable}
              dirty={dirty}
              primary={primary === 'draft'}
              hasApproval={question.approval !== undefined}
              onBody={(body) => setDraft((current) => ({ ...current, body }))}
              onSources={(sources) => setDraft((current) => ({ ...current, sources }))}
              onDiscard={() => setDraft((current) => discard(current, question))}
              // A locked button (`aria-disabled`) never calls this — Button.tsx swallows the click — and a second
              // press in the same task before the lock renders is refused by the page's own write lock. takt-048,
              // decision 3: checked once more here, so no other way of saving sends an unchanged draft.
              onSave={() => {
                if (!saveable || draft.body === null) return;
                setSent({ body: draft.body, sources: draft.sources, version: question.answers.length + 1 });
                onAction({ kind: 'draft', body: draft.body, sources: draft.sources });
              }}
            />
          )}
        </div>
      </div>
    </Panel>
  );
}
