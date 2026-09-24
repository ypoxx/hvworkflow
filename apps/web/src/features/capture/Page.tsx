/**
 * Erfassung (slice 002). The desk that turns a speech into records: capture the Redebeitrag on the
 * left, atomise it into Einzelfragen on the right, and see at any moment how much of the wording is
 * covered. Everything runs through `HvApi`; every list refetches on `useApiVersion()`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Eye, Lock } from 'lucide-react';
import { useSearchParams } from 'react-router';
import type { Contribution, Question, QuestionCapture, Speaker } from '@hv/domain';
import { api } from '../../api';
import { useActor } from '../../api/actor';
import { useApiVersion } from '../../api/useApiVersion';
import { EmptyState, PageHeader, Panel, SplitPane, showProblem } from '../../components';
import { getLang, translate, useT } from '../../i18n';
import { ContributionPane } from './ContributionPane';
import { QuestionsPane } from './QuestionsPane';
import { SuggestDialog } from './SuggestDialog';
import { NO_VERDICT, readVerdict, useAsync, useHoveredQuestion } from './useCapture';
import type { ReadVerdict } from './useCapture';

const NO_SPEAKERS: readonly Speaker[] = [];
const NO_CONTRIBUTIONS: readonly Contribution[] = [];
const NO_QUESTIONS: { items: Question[]; total: number } = { items: [], total: 0 };

const problemTitle = (): string => translate(getLang(), 'toast.problem');

export function CapturePage() {
  const t = useT();
  const version = useApiVersion();
  const [searchParams, setSearchParams] = useSearchParams();

  const speakers = useAsync<readonly Speaker[]>(
    () => api.listSpeakers(),
    NO_SPEAKERS,
    `s:${version}`,
  );
  /**
   * The Wortmeldung in the address bar wins — that is the link from the speakers list. Without one
   * the desk starts where the work is: at the microphone, otherwise at the last speech that ended.
   */
  const urlSpeaker = searchParams.get('speaker');
  const [fallbackSpeaker, setFallbackSpeaker] = useState<string | null>(null);
  useEffect(() => {
    if (urlSpeaker !== null || fallbackSpeaker !== null || speakers.data.length === 0) return;
    const list = speakers.data;
    const preferred =
      list.find((s) => s.status === 'speaking') ??
      [...list].reverse().find((s) => s.status === 'finished') ??
      list[0];
    setFallbackSpeaker(preferred?.id ?? null);
  }, [speakers.data, urlSpeaker, fallbackSpeaker]);
  const speakerId = urlSpeaker ?? fallbackSpeaker;

  const selectSpeaker = useCallback(
    (id: string) => setSearchParams({ speaker: id }, { replace: true }),
    [setSearchParams],
  );

  const contributions = useAsync<readonly Contribution[]>(
    () =>
      speakerId === null ? Promise.resolve(NO_CONTRIBUTIONS) : api.listContributions({ speakerId }),
    NO_CONTRIBUTIONS,
    `c:${version}:${speakerId ?? ''}`,
  );
  /**
   * Blocker (review round 2, also Codex P1): `listContributions` (Ziel 1's Hauptabfrage) used to
   * run only once `speakerId` resolved — and `speakerId` only ever comes from a successful
   * `listSpeakers` above. Every role denied `contribution.read` is also denied `speaker.read`
   * (docs/slices/010-lesepfade-leserechte.md Festlegung 4), so `speakers.data` stayed `[]`,
   * `speakerId` stayed `null`, the per-speaker load above never even called the API, and the
   * refused role saw the ordinary "no contribution chosen" empty desk instead of the gestaltete
   * Zustand — with the read-only hint on top of it, since the desk actions probe below still
   * succeeded on `question.read` alone.
   *
   * A second, unconditional call to the very same Hauptabfrage — no `speakerId`, so it runs
   * regardless of whether one was ever resolved — asks the real question ("may this role read
   * Erfassung at all?") directly, rather than inferring an answer from a resolved prerequisite. It
   * never has to know that `contribution.read` and `speaker.read` are always granted together; it
   * just tries the read that decides it.
   *
   * Minor 1 (review round 3): the probe runs only while no Wortmeldung is resolved. Once one is,
   * the per-speaker load above is itself the Hauptabfrage and answers the same question — a second,
   * unfiltered call on every `version` fetched the whole corpus only to throw it away, and on a 500
   * raised a second toast for the same failure.
   *
   * Codex P2-1 on 4f0d231: nor before the Wortmeldung lookup has settled. On a fresh visit without
   * `?speaker`, `speakerId` is `null` at the first render only because `listSpeakers` has not
   * answered yet — the probe used to fetch the whole corpus right then, although a speaker would
   * be resolved a moment later. It now runs only when the lookup has answered and produced no
   * speaker at all (refused, failed, or a meeting without any Wortmeldung).
   *
   * Slice 010c, Ziel 3: "answered" means answered for the current key (`speakers.settled`, actor
   * and `version`). `status` alone still reported the previous key's refusal in the render after a
   * switch from a refused role to one that may read — the probe then fetched the whole corpus
   * unfiltered, although the new role's lookup was about to resolve a Wortmeldung.
   */
  const needsProbe = speakerId === null && speakers.settled && speakers.data.length === 0;
  const contributionsProbe = useAsync<readonly Contribution[]>(
    () => (needsProbe ? api.listContributions() : Promise.resolve(NO_CONTRIBUTIONS)),
    NO_CONTRIBUTIONS,
    `cp:${version}:${needsProbe}`,
  );
  /**
   * The verdict changes only once every read it depends on has answered: while the lookup is
   * reloading, `needsProbe` is briefly false and the probe answers "ready" without asking — that
   * must not lift a refusal for a moment and show the desk in between (design principle 8).
   *
   * Minor 1 (review round 5): "answered" means answered for the key of this render. Right after
   * a key changes, a load still reports the status of its previous key (e.g. the probe's "ready"
   * from `cp:…:false` in the render where the key has just become `cp:…:true`) — that stale status
   * lifted the refusal for one render on every version jump with latency.
   */
  //
  // Slice 010c: the verdict comes from `readVerdict` (useCapture.ts), fed with the one read that
  // actually asked — the probe or the per-speaker load; the other answers "ready" without asking. A
  // refusal belongs to the actor: a plain failure of the same actor's next read keeps it (review
  // round 1, finding 4).
  const actorId = useActor().id;
  const asked = needsProbe ? contributionsProbe : speakerId !== null ? contributions : null;
  const settled = speakers.settled && contributionsProbe.settled && contributions.settled;
  const [shownVerdict, setShownVerdict] = useState<ReadVerdict>(NO_VERDICT);
  const verdict = settled
    ? readVerdict(
        shownVerdict,
        // No read asked (the lookup resolved speakers, the Wortmeldung is not chosen yet): the
        // table row "no reads" — the same actor keeps its verdict, another starts unrefused.
        asked === null ? [] : [{ read: asked.read, key: asked.key }],
        actorId,
      )
    : shownVerdict;
  if (verdict !== shownVerdict) setShownVerdict(verdict);
  const forbidden = verdict.forbidden;
  const [chosenContribution, setChosenContribution] = useState<string | null>(null);
  // The most recent Redebeitrag of this Wortmeldung is the one being worked on.
  const contribution =
    contributions.data.find((c) => c.id === chosenContribution) ??
    contributions.data[contributions.data.length - 1];

  const questions = useAsync(
    () =>
      contribution === undefined
        ? Promise.resolve(NO_QUESTIONS)
        : api.listQuestions({ contributionId: contribution.id }),
    NO_QUESTIONS,
    `q:${version}:${contribution?.id ?? ''}`,
  );

  /**
   * Rights are data (AGENTS.md rule 4). Capturing a Redebeitrag and capturing an Einzelfrage belong
   * to no existing resource, so the contract has no `_actions` list of their own for them; both
   * permissions travel in `question._actions`, which is why the desk reads them from a question —
   * one of this Redebeitrag, or any one of the corpus while this one is still empty.
   */
  const probe = useAsync(() => api.listQuestions({ limit: 1 }), NO_QUESTIONS, `p:${version}`);
  const deskActions = questions.data.items[0]?._actions ?? probe.data.items[0]?._actions ?? [];
  const canCapture = deskActions.includes('question.capture');
  /**
   * M3 (review round 1): an empty or still-loading desk has no question to read `_actions` off, so
   * `deskActions` is `[]` and `canCapture` reads false for EVERY role, not only one without the
   * right — the read-only hint must stay silent until there is a real answer, not a default one.
   */
  const knowsCaptureRight = deskActions.length > 0;

  const [writing, setWriting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  /**
   * Slice 010d, Ziel 1: the proposal dialog belongs to the actor who opened it. On an actor change
   * it closes in the same render (compared by `id`, never by role, AGENTS.md rule 4) — it would
   * otherwise open again over the next actor's desk once its Redebeitrag is read. The classify
   * dialog needs no such rule: it closes with its question, which `useAsync` hands to nobody else.
   */
  const [dialogActorId, setDialogActorId] = useState(actorId);
  if (dialogActorId !== actorId) {
    setDialogActorId(actorId);
    setSuggestOpen(false);
  }

  const writeContribution = useCallback(
    async (text: string): Promise<boolean> => {
      if (speakerId === null) return false;
      setWriting(true);
      try {
        // A new Redebeitrag has no version yet, so there is nothing to match against.
        const created = await api.captureContribution({ speakerId, text, source: 'manual' });
        setChosenContribution(created.id);
        return true;
      } catch (error: unknown) {
        showProblem(error, problemTitle());
        contributions.reload();
        return false;
      } finally {
        setWriting(false);
      }
    },
    [speakerId, contributions],
  );

  const captureQuestions = useCallback(
    async (items: QuestionCapture[]): Promise<boolean> => {
      if (contribution === undefined || items.length === 0) return false;
      try {
        // No toast: the new cards and the rising Restabdeckung are the answer (design principle 8).
        await api.captureQuestions(contribution.id, items);
        return true;
      } catch (error: unknown) {
        showProblem(error, problemTitle());
        questions.reload();
        contributions.reload();
        return false;
      }
    },
    [contribution, questions, contributions],
  );

  const refetch = useCallback(() => {
    questions.reload();
    contributions.reload();
  }, [questions, contributions]);

  const { hoveredQuestionId, onHoverQuestion } = useHoveredQuestion();

  return (
    <div className="flex h-full min-h-125 flex-col gap-5">
      <PageHeader
        title={t('page.capture.title')}
        description={t('page.capture.description')}
        {...(!forbidden && knowsCaptureRight && !canCapture
          ? {
              // m3 (review round 1): the header's own meta slot, next to the title — not a loose
              // line that shifts the split pane below it.
              actions: (
                <span
                  data-testid="capture-readonly-hint"
                  className="flex items-center gap-1.5 text-[13px] text-ink-600"
                >
                  <Eye size={14} strokeWidth={1.75} aria-hidden="true" />
                  {t('capture.readonly.hint')}
                </span>
              ),
            }
          : {})}
      />

      {forbidden ? (
        // Minor 5 (review round 2): `role="status"` marks the refusal as a status message. Nit 6
        // (review round 3): a live region mounted together with its content is often not
        // announced, so this is a hint to assistive technology, not a guaranteed announcement.
        <div data-testid="capture-forbidden" role="status" className="grid min-h-0 flex-1">
          <Panel bodyClassName="grid place-items-center">
            <EmptyState
              icon={Lock}
              title={t('capture.forbidden.title')}
              description={t('capture.forbidden.body')}
              className="w-full max-w-xl"
            />
          </Panel>
        </div>
      ) : (
        <SplitPane
          storageKey="hv-capture-split-v1"
          initial={55}
          className="min-h-0 flex-1"
          left={
            <ContributionPane
              speakers={speakers.data}
              speakerId={speakerId}
              onSelectSpeaker={selectSpeaker}
              contributions={contributions.data}
              contribution={contribution}
              onSelectContribution={setChosenContribution}
              loading={contributions.status === 'loading'}
              failed={contributions.status === 'error'}
              onRetry={contributions.reload}
              canCapture={canCapture}
              writing={writing}
              onWrite={writeContribution}
              onCaptureQuestions={(items) => void captureQuestions(items)}
              onOpenSuggest={() => setSuggestOpen(true)}
              questions={questions.data.items}
              hoveredQuestionId={hoveredQuestionId}
              onHoverQuestion={onHoverQuestion}
            />
          }
          right={
            <QuestionsPane
              questions={questions.data.items}
              loading={questions.status === 'loading'}
              failed={questions.status === 'error'}
              onProblem={refetch}
              hoveredQuestionId={hoveredQuestionId}
              onHoverQuestion={onHoverQuestion}
            />
          }
        />
      )}

      {contribution !== undefined && (
        <SuggestDialog
          open={suggestOpen}
          contribution={contribution}
          onClose={() => setSuggestOpen(false)}
          onSubmit={captureQuestions}
        />
      )}
    </div>
  );
}
