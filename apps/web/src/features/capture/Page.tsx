/**
 * Erfassung (slice 002). The desk that turns a speech into records: capture the Redebeitrag on the
 * left, atomise it into Einzelfragen on the right, and see at any moment how much of the wording is
 * covered. Everything runs through `HvApi`; every list refetches on `useApiVersion()`.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { AgendaItem, Contribution, Question, QuestionCapture, Speaker } from '@hv/domain';
import { api } from '../../api';
import { useApiVersion } from '../../api/useApiVersion';
import { PageHeader, SplitPane, showProblem } from '../../components';
import { getLang, translate, useT } from '../../i18n';
import { ContributionPane } from './ContributionPane';
import { QuestionsPane } from './QuestionsPane';
import { SuggestDialog } from './SuggestDialog';
import { useAsync } from './useCapture';

const NO_SPEAKERS: readonly Speaker[] = [];
const NO_CONTRIBUTIONS: readonly Contribution[] = [];
const NO_AGENDA: readonly AgendaItem[] = [];
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
  const agenda = useAsync<readonly AgendaItem[]>(
    () => api.listAgendaItems(),
    NO_AGENDA,
    `a:${version}`,
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

  return (
    <div className="flex h-full min-h-125 flex-col gap-5">
      <PageHeader title={t('page.capture.title')} description={t('page.capture.description')} />

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
          />
        }
        right={
          <QuestionsPane
            questions={questions.data.items}
            agendaItems={agenda.data}
            loading={questions.status === 'loading'}
            failed={questions.status === 'error'}
            onProblem={refetch}
          />
        }
      />

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
