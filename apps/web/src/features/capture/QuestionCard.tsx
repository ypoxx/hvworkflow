/**
 * One Einzelfrage as it leaves the capture desk: number, wording, state — and the classification,
 * which is where the answer track (Antwortpfad), the Tagesordnungspunkt and the Bühnenzuordnung are
 * decided. The controls appear only when `question._actions` says the actor may classify this
 * question right now; otherwise the card is a read-only record (AGENTS.md rule 4).
 */
import { useEffect, useState } from 'react';
import { PencilLine } from 'lucide-react';
import type { AgendaItem, Classification, Question, StageAssignment, Track } from '@hv/domain';
import { STAGE_ASSIGNMENTS, TRACKS, etagOf } from '@hv/domain';
import { api } from '../../api';
import { Button, StageAssignmentBadge, StatusBadge, TrackBadge, cx, showProblem } from '../../components';
import { getLang, stageAssignmentLabel, trackLabel, translate, useT } from '../../i18n';
import { Field, FIELD_CONTROL } from './fields';

export function QuestionCard({
  question,
  agendaItems,
  onProblem,
  hoveredQuestionId,
  onHoverQuestion,
}: {
  question: Question;
  agendaItems: readonly AgendaItem[];
  onProblem: () => void;
  hoveredQuestionId: string | null;
  onHoverQuestion: (id: string | null) => void;
}) {
  const t = useT();
  const mayClassify = question._actions.includes('question.classify');
  const [track, setTrack] = useState<Track | undefined>(question.track);
  const [agendaItemId, setAgendaItemId] = useState(question.agendaItemId ?? '');
  const [stage, setStage] = useState<string>(question.stageAssignment ?? '');
  const [busy, setBusy] = useState(false);
  /**
   * Point 6: a card mounted on a question that is already beyond `captured` starts collapsed to a
   * summary line; one still `captured` starts open, as before. Computed once at mount on purpose —
   * classifying this very card must not make it jump shut under the desk's cursor (design
   * principle 8), so the status changing afterwards never recomputes this.
   */
  const [expanded, setExpanded] = useState(question.status === 'captured');

  // A refetch must not throw away what the desk has just chosen: only a real change resets the draft.
  useEffect(() => {
    setTrack(question.track);
    setAgendaItemId(question.agendaItemId ?? '');
    setStage(question.stageAssignment ?? '');
  }, [question.version, question.track, question.agendaItemId, question.stageAssignment]);

  const dirty =
    track !== question.track ||
    agendaItemId !== (question.agendaItemId ?? '') ||
    stage !== (question.stageAssignment ?? '');

  const save = async (): Promise<void> => {
    if (track === undefined || busy) return;
    setBusy(true);
    const input: Classification = {
      track,
      ...(agendaItemId !== '' ? { agendaItemId } : {}),
      ...(stage !== '' ? { stageAssignment: stage as StageAssignment } : {}),
    };
    try {
      // The changed badges on this card are the confirmation; a toast would only add noise.
      await api.classifyQuestion(question.id, input, { ifMatch: etagOf(question.version) });
    } catch (error: unknown) {
      showProblem(error, translate(getLang(), 'toast.problem'));
      onProblem();
    } finally {
      setBusy(false);
    }
  };

  const agendaItem = agendaItems.find((item) => item.id === question.agendaItemId);

  return (
    <article
      data-testid="capture-question-card"
      data-number={question.number}
      onMouseEnter={() => onHoverQuestion(question.id)}
      onMouseLeave={() => onHoverQuestion(null)}
      onFocus={() => onHoverQuestion(question.id)}
      onBlur={() => onHoverQuestion(null)}
      className={cx(
        'rounded-md border border-line bg-surface p-3 transition-shadow duration-100',
        hoveredQuestionId === question.id && 'outline outline-2 outline-offset-2 outline-accent-500',
      )}
    >
      <header className="flex items-center gap-2">
        <span className="font-mono text-2xs tabular-nums text-ink-500">{question.number}</span>
        <StatusBadge status={question.status} />
        {question.track !== undefined && <TrackBadge track={question.track} />}
        <span className="ml-auto text-2xs text-ink-400">
          {question.span === undefined
            ? t('capture.question.unmarked')
            : t('capture.question.marked')}
        </span>
      </header>

      <p className="mt-2 text-[13px] leading-6 text-ink-800">{question.text}</p>

      {mayClassify && !expanded && (
        <div
          data-testid="capture-classification-summary"
          className="mt-3 flex items-center gap-2 border-t border-line pt-3"
        >
          {question.track !== undefined && <TrackBadge track={question.track} />}
          {agendaItem !== undefined && (
            <span className="text-2xs text-ink-600">
              {t('capture.classify.agenda.short', { number: agendaItem.number })}
            </span>
          )}
          {question.stageAssignment !== undefined && (
            <StageAssignmentBadge assignment={question.stageAssignment} variant="initials" />
          )}
          <Button
            variant="ghost"
            size="sm"
            data-testid="card-classification-toggle"
            onClick={() => setExpanded(true)}
            icon={<PencilLine size={14} strokeWidth={1.75} aria-hidden="true" />}
            className="ml-auto"
          >
            {t('capture.classify.change')}
          </Button>
        </div>
      )}

      {mayClassify && expanded && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3">
          <div>
            <span className="hv-label">{t('capture.classify.track')}</span>
            <div
              role="group"
              aria-label={t('capture.classify.track')}
              className="mt-1 grid grid-cols-3 gap-1"
            >
              {TRACKS.map((value) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`classify-track-${value}`}
                  aria-pressed={track === value}
                  disabled={busy}
                  onClick={() => setTrack(value)}
                  className={cx(
                    'min-h-7 rounded-md border px-2 py-1 text-2xs leading-tight font-medium',
                    'transition-colors duration-100 disabled:opacity-45',
                    track === value
                      ? 'border-accent-500 bg-accent-50 text-accent-700'
                      : 'border-line-strong bg-surface text-ink-600 hover:bg-ink-50',
                  )}
                >
                  {trackLabel(t, value)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t('capture.classify.agenda')} htmlFor={`${question.id}-agenda`}>
              <select
                id={`${question.id}-agenda`}
                data-testid="classify-agenda"
                className={FIELD_CONTROL}
                value={agendaItemId}
                disabled={busy}
                onChange={(event) => setAgendaItemId(event.target.value)}
              >
                <option value="">{t('common.none')}</option>
                {agendaItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t('capture.classify.agenda.option', {
                      number: item.number,
                      title: item.title,
                    })}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('capture.classify.stage')} htmlFor={`${question.id}-stage`}>
              <select
                id={`${question.id}-stage`}
                data-testid="classify-stage"
                className={FIELD_CONTROL}
                value={stage}
                disabled={busy}
                onChange={(event) => setStage(event.target.value)}
              >
                <option value="">{t('common.none')}</option>
                {STAGE_ASSIGNMENTS.map((value) => (
                  <option key={value} value={value}>
                    {stageAssignmentLabel(t, value)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              data-testid="classify-save"
              disabled={busy || track === undefined || !dirty}
              onClick={() => void save()}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
