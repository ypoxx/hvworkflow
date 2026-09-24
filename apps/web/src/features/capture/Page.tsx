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
import { useApiVersion } from '../../api/useApiVersion';
import { EmptyState, PageHeader, Panel, SplitPane, showProblem } from '../../components';
import { getLang, translate, useT } from '../../i18n';
import { ContributionPane } from './ContributionPane';
import { QuestionsPane } from './QuestionsPane';
import { SuggestDialog } from './SuggestDialog';
import { useAsync, useHoveredQuestion } from './useCapture';

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
   */
  const contributionsProbe = useAsync<readonly Contribution[]>(
    () => (speakerId === null ? api.listContributions() : Promise.resolve(NO_CONTRIBUTIONS)),
    NO_CONTRIBUTIONS,
    `cp:${version}:${speakerId === null}`,
  );
  const forbidden =
    contributionsProbe.status === 'forbidden' || contributions.status === 'forbidden';
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
