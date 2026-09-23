/**
 * "Klassifizieren" (point #21, feedback, slice 020): the one place Antwortpfad and Bühnenzuordnung
 * are chosen for an Einzelfrage, reached only through the explicit action on the card and only when
 * `question._actions` allows it — never rendered inline on the card any more (AGENTS.md rule 4). The
 * Tagesordnungspunkt is not asked here either (point #23): it stays an optional field of the model,
 * just not queried from this desk.
 */
import { useEffect, useId, useState } from 'react';
import type { Classification, Question, StageAssignment, Track } from '@hv/domain';
import { STAGE_ASSIGNMENTS, TRACKS, etagOf } from '@hv/domain';
import { api } from '../../api';
import { Button, Dialog, cx, showProblem } from '../../components';
import { actionLabel, getLang, stageAssignmentLabel, translate, trackLabel, useT } from '../../i18n';
import { Field, FIELD_CONTROL } from './fields';

export function ClassifyDialog({
  question,
  onClose,
  onProblem,
}: {
  /** `null` keeps the dialog mounted-but-closed, the same pattern as `MoveDialog` (speakers). */
  question: Question | null;
  onClose: () => void;
  onProblem: () => void;
}) {
  const t = useT();
  const ids = useId();
  const [track, setTrack] = useState<Track | undefined>(undefined);
  const [stage, setStage] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Re-opening on the same or a different question always starts from the record, never from a
  // stale draft of a previous card.
  useEffect(() => {
    if (question === null) return;
    setTrack(question.track);
    setStage(question.stageAssignment ?? '');
    setBusy(false);
  }, [question]);

  const save = async (): Promise<void> => {
    if (question === null || track === undefined || busy) return;
    setBusy(true);
    const input: Classification = {
      track,
      ...(stage !== '' ? { stageAssignment: stage as StageAssignment } : {}),
    };
    try {
      await api.classifyQuestion(question.id, input, { ifMatch: etagOf(question.version) });
      onClose();
    } catch (error: unknown) {
      showProblem(error, translate(getLang(), 'toast.problem'));
      onProblem();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={question !== null}
      onClose={onClose}
      title={actionLabel(t, 'question.classify')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid="classify-save"
            disabled={busy || track === undefined}
            onClick={() => void save()}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      {question !== null && (
        <div className="grid gap-3">
          <p className="text-[13px] leading-6 text-ink-700">
            <span className="font-mono text-ink-500">{question.number}</span> {question.text}
          </p>
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
          <Field label={t('capture.classify.stage')} htmlFor={`${ids}-stage`}>
            <select
              id={`${ids}-stage`}
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
      )}
    </Dialog>
  );
}
