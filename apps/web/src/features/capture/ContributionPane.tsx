/**
 * Left half of the capture desk: whose Wortmeldung, which Redebeitrag, and its wording. Either the
 * desk is writing a new Redebeitrag down (textarea) or it is working on one that exists — then the
 * text is read-only, tinted where it is already covered, and the atomisation tools sit under it.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CornerDownRight, ListChecks, MessageSquareQuote, PencilLine, Plus, TriangleAlert, X } from 'lucide-react';
import type { Contribution, Question, QuestionCapture, Speaker } from '@hv/domain';
import { Badge, Button, EmptyState, Kbd, Panel, SourceIcon, StaleBanner, cx } from '../../components';
import { useActor } from '../../api/actor';
import { actionLabel, useLang, useT } from '../../i18n';
import { relationLabel } from '../../i18n/labels';
import type { FollowUpReference } from './followUp';
import { ContributionText } from './ContributionText';
import { CoverageBar } from './CoverageBar';
import { Field, FIELD_CONTROL, FIELD_TEXTAREA } from './fields';

function timeOf(lang: string, iso: string): string {
  return new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

function Skeleton() {
  const t = useT();
  return (
    <div className="grid gap-2 px-4 py-4">
      <span className="sr-only" role="status">
        {t('capture.loading')}
      </span>
      {[0, 1, 2, 3, 4, 5].map((line) => (
        <span
          key={line}
          aria-hidden="true"
          className={cx('h-3 rounded-full bg-ink-100', line % 3 === 2 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export interface ContributionPaneProps {
  speakers: readonly Speaker[];
  speakerId: string | null;
  onSelectSpeaker: (id: string) => void;
  contributions: readonly Contribution[];
  contribution: Contribution | undefined;
  onSelectContribution: (id: string) => void;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  stale: boolean;
  onReloadStale: () => void;
  canCapture: boolean;
  writing: boolean;
  /**
   * takt-032: a write on this Redebeitrag is in flight (or the Wortmeldung's new version is not yet
   * read back). A loading state, not a right: every way to capture is locked with `aria-disabled`
   * (takt-008, focus stays) and the pane says so with `data-busy`/`aria-busy`.
   */
  busy: boolean;
  /** takt-032: only the input for a further Redebeitrag waits (the Wortmeldung's new version is unknown). */
  submitBusy?: boolean;
  onWrite: (text: string) => Promise<boolean>;
  onCaptureQuestions: (questions: QuestionCapture[]) => Promise<boolean>;
  onOpenSuggest: () => void;
  /** The Einzelfragen of this Redebeitrag, in card order — `ContributionText` numbers its markers by it. */
  questions: readonly Question[];
  hoveredQuestionId: string | null;
  onHoverQuestion: (id: string | null) => void;
  /** Scheibe 046: the reference for the next single capture (chip), set through the dialog the page opens. */
  reference?: FollowUpReference | null;
  onOpenFollowUp?: () => void;
  onClearReference?: () => void;
}

export function ContributionPane({
  speakers,
  speakerId,
  onSelectSpeaker,
  contributions,
  contribution,
  onSelectContribution,
  loading,
  failed,
  onRetry,
  stale,
  onReloadStale,
  canCapture,
  writing,
  busy,
  submitBusy = false,
  onWrite,
  onCaptureQuestions,
  onOpenSuggest,
  questions,
  hoveredQuestionId,
  onHoverQuestion,
  reference = null,
  onOpenFollowUp,
  onClearReference,
}: ContributionPaneProps) {
  const t = useT();
  const lang = useLang();
  const ids = useId();
  const [draft, setDraft] = useState('');
  const [free, setFree] = useState('');
  const [composing, setComposing] = useState(false);
  /**
   * Slice 090 (review R1, finding 1): typed text belongs to the actor who typed it. A role that
   * also sees this pane (admin, moderation) keeps it mounted across the switch, so the draft, the
   * free question and the open form are emptied in the same render when the actor changes —
   * compared by `id`, never by role (AGENTS.md rule 4).
   */
  const actorId = useActor().id;
  const [textActorId, setTextActorId] = useState(actorId);
  if (textActorId !== actorId) {
    setTextActorId(actorId);
    setDraft('');
    setFree('');
    setComposing(false);
  }
  // takt-008: the field for the next Einzelfrage — where focus goes after either write on this pane.
  const freeInput = useRef<HTMLInputElement | null>(null);
  // Set when a Redebeitrag was written: the form (and the button that held focus) is gone, and the
  // field only mounts once the new Redebeitrag has been read back — focus follows it there.
  const focusFreeOnMount = useRef(false);
  const attachFreeInput = useCallback((element: HTMLInputElement | null) => {
    freeInput.current = element;
    if (element === null || !focusFreeOnMount.current) return;
    focusFreeOnMount.current = false;
    // Only focus that was lost with the unmounted form is moved — never focus the person has
    // already put somewhere else in the meantime.
    const active = document.activeElement;
    if (active === null || active === document.body) element.focus();
  }, []);
  // A second activation before React has re-rendered `writing` (e.g. two clicks in one task) must
  // not write the same Redebeitrag twice.
  const submitting = useRef(false);
  const submittingFree = useRef(false);

  const speaker = speakers.find((s) => s.id === speakerId);
  // Without a Redebeitrag there is nothing to read, so the desk starts writing straight away.
  const showForm = canCapture && (composing || contribution === undefined);

  useEffect(() => {
    setComposing(false);
    setDraft('');
    setFree('');
    focusFreeOnMount.current = false;
  }, [speakerId]);

  const rounds = new Map<number, Speaker[]>();
  for (const entry of speakers) {
    const bucket = rounds.get(entry.round);
    if (bucket === undefined) rounds.set(entry.round, [entry]);
    else bucket.push(entry);
  }

  const submitText = async (): Promise<void> => {
    if (writing || busy || submitBusy || submitting.current || draft.trim() === '') return;
    submitting.current = true;
    // Armed before the write, not after: the in-process demo reads the new Redebeitrag back (and
    // mounts the field) within the same chain of promises, before this function resumes.
    focusFreeOnMount.current = true;
    try {
      const ok = await onWrite(draft.trim());
      if (ok) {
        setDraft('');
        setComposing(false);
      } else {
        focusFreeOnMount.current = false;
      }
    } finally {
      submitting.current = false;
    }
  };

  const addFree = async (): Promise<void> => {
    if (free.trim() === '' || busy || submittingFree.current) return;
    submittingFree.current = true;
    try {
      if (await onCaptureQuestions([{ text: free.trim() }])) setFree('');
      // The draft remains in the field on 412/428 so the operator can compare it after reload.
      freeInput.current?.focus();
    } finally {
      submittingFree.current = false;
    }
  };

  return (
    <div
      data-testid="capture-contribution-pane"
      className="h-full"
      {...(busy || submitBusy ? { 'data-busy': 'true', 'aria-busy': true } : {})}
    >
    <Panel
      className="h-full"
      padded={false}
      bodyClassName="flex min-h-0 flex-col"
      title={t('capture.contribution.label')}
      {...(speaker !== undefined ? { description: speaker.displayName } : {})}
      actions={
        canCapture && contribution !== undefined && !showForm ? (
          <div className="flex items-center gap-2">
            {onOpenFollowUp !== undefined && (
              // Scheibe 046: "Nachfrage zu …" with its key; only where capturing is allowed (design principle 9).
              <Button
                variant="ghost"
                size="sm"
                data-testid="capture-follow-up-open"
                aria-keyshortcuts="Alt+B"
                onClick={onOpenFollowUp}
                icon={<CornerDownRight size={14} strokeWidth={1.75} aria-hidden="true" />}
              >
                {t('capture.followUp.open')}
                <span className="ml-1.5 inline-flex gap-0.5" aria-hidden="true">
                  <Kbd>{t('capture.key.alt')}</Kbd>
                  <Kbd>{t('capture.key.b')}</Kbd>
                </span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              data-testid="capture-contribution-new"
              onClick={() => setComposing(true)}
              icon={<Plus size={14} strokeWidth={2} aria-hidden="true" />}
            >
              {t('capture.contribution.new')}
            </Button>
          </div>
        ) : undefined
      }
      footer={
        contribution !== undefined && !showForm && canCapture ? (
          <div className="flex items-end gap-2 py-1">
            <Field label={t('capture.free.label')} htmlFor={`${ids}-free`} className="flex-1">
              <input
                ref={attachFreeInput}
                id={`${ids}-free`}
                data-testid="capture-free-input"
                className={FIELD_CONTROL}
                value={free}
                placeholder={t('capture.free.placeholder')}
                onChange={(event) => setFree(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void addFree();
                  }
                }}
              />
            </Field>
            <Button
              size="sm"
              variant="secondary"
              data-testid="capture-free-add"
              disabled={free.trim() === ''}
              aria-disabled={busy}
              onClick={() => void addFree()}
              className="h-8"
            >
              {t('capture.free.add')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              data-testid="capture-suggest"
              aria-disabled={busy}
              onClick={() => {
                if (!busy) onOpenSuggest();
              }}
              className="h-8"
              icon={<ListChecks size={14} strokeWidth={1.75} aria-hidden="true" />}
            >
              {t('capture.suggest.open')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {stale && (
        <StaleBanner
          testId="capture-stale-banner"
          message={t('capture.stale.banner')}
          onReload={() => {
            onReloadStale();
            freeInput.current?.focus();
          }}
        />
      )}
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-end gap-3">
          <Field label={t('capture.speaker.label')} htmlFor={`${ids}-speaker`} className="flex-1">
            <select
              id={`${ids}-speaker`}
              data-testid="capture-speaker-select"
              className={FIELD_CONTROL}
              value={speakerId ?? ''}
              onChange={(event) => onSelectSpeaker(event.target.value)}
            >
              {speakerId === null && <option value="">{t('capture.speaker.empty')}</option>}
              {[...rounds.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([round, list]) => (
                  <optgroup key={round} label={t('header.round', { round })}>
                    {list.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {t('capture.speaker.option', {
                          number: entry.number,
                          name: entry.displayName,
                        })}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </Field>
          {contributions.length > 1 && (
            <Field
              label={t('capture.contribution.label')}
              htmlFor={`${ids}-contribution`}
              className="w-64"
            >
              <select
                id={`${ids}-contribution`}
                data-testid="capture-contribution-select"
                className={FIELD_CONTROL}
                value={contribution?.id ?? ''}
                onChange={(event) => onSelectContribution(event.target.value)}
              >
                {contributions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {t('capture.contribution.option', {
                      time: timeOf(lang, entry.capturedAt),
                      chars: entry.text.length,
                    })}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {contribution !== undefined && !showForm && (
          <div className="mt-3 flex items-start gap-6">
            <div className="min-w-0 flex-1">
              <CoverageBar contribution={contribution} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <Badge tone="outline" mono>
                  {timeOf(lang, contribution.capturedAt)}
                </Badge>
                <SourceIcon source={contribution.source} className="text-ink-500" />
              </div>
              {canCapture && (
                <span className="flex items-center gap-1.5 text-2xs text-ink-500">
                  {t('capture.selection.hint')}
                  <Kbd>{t('capture.key.alt')}</Kbd>
                  <Kbd>{t('capture.key.q')}</Kbd>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {speakerId === null ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={t('capture.speaker.empty')}
            description={t('capture.speaker.emptyBody')}
          />
        ) : failed && contribution === undefined ? (
          <EmptyState
            icon={TriangleAlert}
            title={t('capture.error.title')}
            description={t('capture.error.body')}
            action={
              <Button variant="secondary" onClick={onRetry}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : loading && contribution === undefined ? (
          <Skeleton />
        ) : showForm ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <label htmlFor={`${ids}-text`} className="hv-label">
              {t('capture.text.label')}
            </label>
            <textarea
              id={`${ids}-text`}
              data-testid="capture-text"
              className={cx(FIELD_TEXTAREA, 'min-h-40 flex-1')}
              value={draft}
              placeholder={t('capture.text.placeholder')}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              {contribution !== undefined && (
                <Button variant="ghost" onClick={() => setComposing(false)}>
                  {t('capture.contribution.back')}
                </Button>
              )}
              <Button
                variant="primary"
                data-testid="capture-submit"
                // takt-008: locked while writing with `aria-disabled`, not `disabled` — it keeps
                // focus, so a refused write leaves the person where they were. An empty draft
                // still uses `disabled`: while typing, focus is in the text field; after a
                // successful write, `attachFreeInput` above moves it on.
                disabled={draft.trim() === ''}
                aria-disabled={writing || busy || submitBusy}
                onClick={() => void submitText()}
                icon={<PencilLine size={16} strokeWidth={1.75} aria-hidden="true" />}
              >
                {actionLabel(t, 'contribution.capture')}
              </Button>
            </div>
          </div>
        ) : contribution === undefined ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={t('capture.text.empty.title')}
            description={t('capture.text.empty.body')}
          />
        ) : (
          <>
          {canCapture && reference !== null && (
            // Scheibe 046: the chip over the text; it goes with the next single capture only.
            <div className="mb-3 flex">
              <span data-testid="capture-follow-up-chip" className="hv-badge tone-accent inline-flex items-center gap-1.5">
                <CornerDownRight size={12} strokeWidth={1.75} aria-hidden="true" />
                {relationLabel(t, reference.relation, reference.number)}
                <button
                  type="button"
                  data-testid="capture-follow-up-remove"
                  aria-label={t('capture.followUp.remove')}
                  title={t('capture.followUp.remove')}
                  className="-mr-1 rounded-sm p-0.5 hover:bg-ink-100"
                  onClick={onClearReference}
                >
                  <X size={12} strokeWidth={2} aria-hidden="true" />
                </button>
              </span>
            </div>
          )}
          <ContributionText
            contribution={contribution}
            canCapture={canCapture}
            busy={busy}
            onCapture={onCaptureQuestions}
            questions={questions}
            hoveredQuestionId={hoveredQuestionId}
            onHoverQuestion={onHoverQuestion}
          />
          </>
        )}
      </div>
    </Panel>
    </div>
  );
}
