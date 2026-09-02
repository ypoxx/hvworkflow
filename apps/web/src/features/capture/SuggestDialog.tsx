/**
 * "Nach Sätzen vorschlagen": the fast lane for a long Redebeitrag. The desk checks what is really a
 * question of record and takes the whole selection in one call, so the Einzelfragen of one speech
 * carry consecutive numbers.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import type { Contribution, QuestionCapture } from '@hv/domain';
import { Button, Dialog } from '../../components';
import { useT } from '../../i18n';
import { suggestQuestions } from './sentences';

export function SuggestDialog({
  open,
  contribution,
  onClose,
  onSubmit,
}: {
  open: boolean;
  contribution: Contribution;
  onClose: () => void;
  onSubmit: (questions: QuestionCapture[]) => Promise<boolean>;
}) {
  const t = useT();
  const ids = useId();
  const candidates = useMemo(
    () => suggestQuestions(contribution.text, contribution.coverage.uncovered),
    [contribution.text, contribution.coverage.uncovered],
  );
  const [checked, setChecked] = useState<readonly boolean[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChecked(candidates.map(() => true));
    setBusy(false);
  }, [open, candidates]);

  const count = checked.filter(Boolean).length;
  const allChecked = candidates.length > 0 && count === candidates.length;

  const submit = async (): Promise<void> => {
    const chosen = candidates.filter((_, index) => checked[index] === true);
    if (chosen.length === 0 || busy) return;
    setBusy(true);
    const ok = await onSubmit(
      chosen.map((candidate) => ({
        text: candidate.text,
        span: { start: candidate.start, end: candidate.end },
      })),
    );
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t('capture.suggest.open')}
      description={t('capture.suggest.hint')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid="capture-suggest-add"
            disabled={busy || count === 0}
            onClick={() => void submit()}
          >
            {t('capture.suggest.add', { count })}
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-500">{t('capture.suggest.empty')}</p>
      ) : (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-2xs text-ink-600">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-accent-600"
              checked={allChecked}
              onChange={(event) => setChecked(candidates.map(() => event.target.checked))}
            />
            {t('capture.suggest.all')}
          </label>
          <ul className="max-h-[46vh] overflow-y-auto rounded-md border border-line">
            {candidates.map((candidate, index) => (
              <li
                key={`${candidate.start}-${candidate.end}`}
                className="border-b border-line last:border-b-0"
              >
                <label
                  htmlFor={`${ids}-${index}`}
                  className="flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors duration-100 hover:bg-ink-25"
                >
                  <input
                    id={`${ids}-${index}`}
                    type="checkbox"
                    data-testid="capture-suggest-item"
                    title={t('capture.suggest.item', { index: index + 1 })}
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-accent-600"
                    checked={checked[index] === true}
                    onChange={(event) =>
                      setChecked((state) =>
                        state.map((value, i) => (i === index ? event.target.checked : value)),
                      )
                    }
                  />
                  <span className="font-mono text-2xs text-ink-400">{index + 1}</span>
                  <span className="text-[13px] leading-6 text-ink-800">{candidate.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
