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

/**
 * takt-037: the selection is keyed by candidate text (plus the n-th occurrence of an identical sentence),
 * never by array identity or position. A refresh hands over a new `uncovered` array every time; keyed by
 * content the person's choice survives it. Only the unchecked keys are stored, so a candidate that is new
 * is checked without any effect, and the first render is already correct.
 */
export type Selection = ReadonlySet<string>;

export function candidateKeys(candidates: readonly { text: string }[]): string[] {
  const seen = new Map<string, number>();
  return candidates.map((candidate) => {
    const n = seen.get(candidate.text) ?? 0;
    seen.set(candidate.text, n + 1);
    return `${n}\u0000${candidate.text}`;
  });
}

export const initialSelection = (): Selection => new Set<string>();
export const isChecked = (selection: Selection, key: string): boolean => !selection.has(key);
export const checkedCount = (selection: Selection, keys: readonly string[]): number =>
  keys.filter((key) => isChecked(selection, key)).length;

/** Sets one key; keys that are no longer candidates are dropped, so a sentence that returns starts checked. */
export function setChecked(
  selection: Selection,
  keys: readonly string[],
  key: string,
  checked: boolean,
): Selection {
  const next = new Set(keys.filter((k) => selection.has(k) && k !== key));
  if (!checked) next.add(key);
  return next;
}

export const setAllChecked = (keys: readonly string[], checked: boolean): Selection =>
  new Set(checked ? [] : keys);

/** Scheibe 046 (Lesebefund M7): with a set chip, taken-over suggestions go without the reference, and say so. */
export function ReferenceHint({ show }: { show: boolean }) {
  const t = useT();
  if (!show) return null;
  return (
    <p data-testid="capture-suggest-reference-hint" className="mb-3 rounded-md border border-line bg-sunken px-3 py-2 text-[13px] text-ink-700">
      {t('capture.followUp.suggestHint')}
    </p>
  );
}

export function SuggestDialog({
  open,
  contribution,
  locked = false,
  referenceSet = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  contribution: Contribution;
  /** takt-032: a write on this Redebeitrag is in flight; taking over waits for its answer. */
  locked?: boolean;
  /** Scheibe 046: a follow-up reference is set; the taken-over suggestions are sent without it. */
  referenceSet?: boolean;
  onClose: () => void;
  onSubmit: (questions: QuestionCapture[]) => Promise<boolean>;
}) {
  const t = useT();
  const ids = useId();
  const candidates = useMemo(
    () => suggestQuestions(contribution.text, contribution.coverage.uncovered),
    [contribution.text, contribution.coverage.uncovered],
  );
  const keys = useMemo(() => candidateKeys(candidates), [candidates]);
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [busy, setBusy] = useState(false);

  // Reopening starts fresh. The reset happens on close, so the next open renders all checked at once.
  useEffect(() => {
    if (open) return;
    setSelection(initialSelection());
    setBusy(false);
  }, [open]);

  const count = checkedCount(selection, keys);
  const allChecked = candidates.length > 0 && count === candidates.length;

  const submit = async (): Promise<void> => {
    const chosen = candidates.filter((_, index) => isChecked(selection, keys[index]!));
    if (chosen.length === 0 || busy || locked) return;
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
            aria-disabled={locked}
            onClick={() => void submit()}
          >
            {t('capture.suggest.add', { count })}
          </Button>
        </>
      }
    >
      <ReferenceHint show={referenceSet} />
      {candidates.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-500">{t('capture.suggest.empty')}</p>
      ) : (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-2xs text-ink-600">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-accent-600"
              checked={allChecked}
              onChange={(event) => setSelection(setAllChecked(keys, event.target.checked))}
            />
            {t('capture.suggest.all')}
          </label>
          <ul className="max-h-[46vh] overflow-y-auto rounded-md border border-line">
            {candidates.map((candidate, index) => (
              <li
                key={keys[index]!}
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
                    checked={isChecked(selection, keys[index]!)}
                    onChange={(event) =>
                      setSelection((state) =>
                        setChecked(state, keys, keys[index]!, event.target.checked),
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
