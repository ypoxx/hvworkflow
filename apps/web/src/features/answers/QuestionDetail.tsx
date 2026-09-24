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
import { Link } from 'react-router';
import type { DomainEvent, Question, Unit } from '@hv/domain';
import { TERMINAL_STATUSES } from '@hv/domain';
import {
  Badge,
  Button,
  KeyValue,
  KeyValueList,
  Panel,
  StageAssignmentBadge,
  StatusBadge,
  Toolbar,
  ToolbarSpacer,
  TrackBadge,
  cx,
} from '../../components';
import { actionLabel, stageAssignmentLabel, trackLabel, useT } from '../../i18n';
import { AnswerEditor } from './AnswerEditor';
import { clockTime, lapsedApproval, latestVersion, sealedApproval, wordDiff } from './lib';

/**
 * "Änderung gegenüber Version n-1" (point 3): a word-level diff, removed words struck through,
 * added words underlined. Rendered inline so that reading it needs no separate view.
 */
function AnswerDiff({ previous, current }: { previous: string; current: string }) {
  const parts = useMemo(() => wordDiff(previous, current), [previous, current]);
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
  | { kind: 'draft'; text: string; sources: string }
  | { kind: 'submit_review' }
  | { kind: 'approve'; version: number }
  | { kind: 'stage' }
  | { kind: 'open-return' }
  | { kind: 'open-assign' }
  | { kind: 'open-merge' }
  | { kind: 'open-withdraw' };

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
  /** Bumped by the page after a version was written; the editor then starts empty again. */
  draftResetToken: number;
  onAction: (action: DetailAction) => void;
}

function VersionCard({
  version,
  author,
  at,
  text,
  sources,
  previousText,
  latest,
  open,
  onToggle,
}: {
  version: number;
  author: string;
  at: string;
  text: string;
  sources: readonly string[] | undefined;
  /** The text of version n-1, when there is one — carries the diff toggle (point 3). */
  previousText: string | undefined;
  latest: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const [showDiff, setShowDiff] = useState(false);
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
        type="button"
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
        {latest && <span className="text-2xs text-ink-500">{t('answers.version.latest')}</span>}
        <span className="ml-auto flex items-center gap-3">
          <span className="truncate text-2xs text-ink-500">{author}</span>
          <span className="font-mono text-2xs tabular-nums text-ink-400">{clockTime(at)}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5">
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink-800">{text}</p>
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
          {previousText !== undefined && (
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
              {showDiff && <AnswerDiff previous={previousText} current={text} />}
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
  onAction,
}: QuestionDetailProps) {
  const t = useT();
  const latest = latestVersion(question);
  const [open, setOpen] = useState<readonly number[]>(latest === undefined ? [] : [latest]);
  const [draft, setDraft] = useState('');
  const [sources, setSources] = useState('');

  useEffect(() => {
    if (latest === undefined) return;
    setOpen((previous) => (previous.includes(latest) ? previous : [...previous, latest]));
  }, [latest]);

  // takt-008: adjusted during render, not in an effect — the render that unlocks the editor's
  // button (`busy` false again) must already carry the emptied draft. An effect would commit one
  // frame with the old text and an enabled button, and a quick second Enter would save it twice.
  const [resetSeen, setResetSeen] = useState(draftResetToken);
  if (resetSeen !== draftResetToken) {
    setResetSeen(draftResetToken);
    setDraft('');
    setSources('');
  }

  /**
   * takt-008: "Zur Prüfung" and "Freigeben" leave the command bar together with the step they
   * take (`_actions` no longer offers them), and the focus they held falls to `<body>`. It is
   * moved to the block that shows the outcome — the new status or the Freigabe — so the person
   * (and a screen reader) lands on what just happened, and a second Enter there changes nothing.
   *
   * Review round 1, finding 4: the marker is settled when the write is — `busy` falls only once the
   * page shows the new version (or the write was refused, answers/Page.tsx), so that is the render
   * in which the button is either gone (success) or still there (refusal); either way the marker is
   * cleared. A different question remounts this component (`key={question.id}`), which clears it too.
   */
  const approvalBlock = useRef<HTMLDivElement>(null);
  const stepTaken = useRef<'submit' | 'approve' | null>(null);

  const unit = useMemo(
    () => units.find((candidate) => candidate.id === question.unitId),
    [units, question.unitId],
  );

  const may = question._actions;
  const mayDraft = may.includes('answer.draft');
  const maySubmit = may.includes('question.submit_review');
  const mayApprove = may.includes('question.approve');
  const mayStage = may.includes('question.stage');
  const mayReturn = may.includes('question.return');
  const mayAssign = may.includes('question.assign');
  const mayMerge = may.includes('question.merge');
  const mayWithdraw = may.includes('question.withdraw');

  useEffect(() => {
    if (busy) return;
    const taken = stepTaken.current;
    stepTaken.current = null;
    if (taken === null) return;
    const active = document.activeElement;
    if (active === null || active === document.body) approvalBlock.current?.focus();
  }, [busy]);

  const dirty = draft.trim() !== '';
  // Exactly one primary action (D2): the step that moves this question on — unless something is
  // written in the editor, then saving it is what the person is doing.
  const primary: 'draft' | 'approve' | 'submit' | 'stage' | 'none' =
    dirty && mayDraft
      ? 'draft'
      : mayApprove
        ? 'approve'
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
    mayWithdraw || mayMerge || mayAssign || mayReturn || maySubmit || mayApprove || mayStage;
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
                  stepTaken.current = 'submit';
                  onAction({ kind: 'submit_review' });
                }}
              >
                {actionLabel(t, 'question.submit_review')}
              </Button>
            )}
            {mayApprove && latest !== undefined && (
              <Button
                data-testid="answer-approve"
                variant={primary === 'approve' ? 'primary' : 'secondary'}
                aria-disabled={busy}
                onClick={() => {
                  stepTaken.current = 'approve';
                  onAction({ kind: 'approve', version: latest });
                }}
              >
                {t('answers.approve.label', { version: latest })}
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
                    version={answer.version}
                    author={answer.createdBy.displayName ?? answer.createdBy.id}
                    at={answer.createdAt}
                    text={answer.text}
                    sources={answer.sources}
                    previousText={question.answers[index - 1]?.text}
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

          {mayDraft && (
            <AnswerEditor
              text={draft}
              sources={sources}
              busy={busy}
              primary={primary === 'draft'}
              hasApproval={question.approval !== undefined}
              onText={setDraft}
              onSources={setSources}
              onDiscard={() => {
                setDraft('');
                setSources('');
              }}
              // No guard of its own: a locked button (`aria-disabled`: busy or empty) never calls
              // this — Button.tsx swallows the click — and a second press in the same task before
              // the lock renders is refused by the page's own write lock.
              onSave={() => onAction({ kind: 'draft', text: draft, sources })}
            />
          )}
        </div>
      </div>
    </Panel>
  );
}
