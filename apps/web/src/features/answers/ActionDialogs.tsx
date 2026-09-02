/**
 * The four steps that need a sentence from the person before they may happen: returning, assigning,
 * merging, withdrawing. All of them are modal on purpose — each writes a reason or a target into the
 * event log, and none of them may be triggered by a stray keystroke.
 *
 * The dialogs only collect input. Whether they are offered at all is decided by `_actions` in the
 * detail view, and what the server does with the input is decided by the transition table.
 */
import { useEffect, useRef, useState } from 'react';
import type { Unit } from '@hv/domain';
import { Button, Dialog, cx } from '../../components';
import { useT } from '../../i18n';

const FIELD =
  'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-ink-900 ' +
  'transition-colors duration-100 placeholder:text-ink-400 hover:border-ink-300';

/** Move the caret where the work is; the kit's dialog parks focus on the close button. */
function useDelayedFocus(open: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => ref.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);
  return ref;
}

export function ReasonDialog({
  open,
  onClose,
  title,
  body,
  label,
  placeholder,
  submitLabel,
  danger = false,
  reasonTestId,
  submitTestId,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  danger?: boolean;
  reasonTestId: string;
  submitTestId: string;
  busy: boolean;
  onSubmit: (reason: string) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const ref = useDelayedFocus(open);

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            data-testid={submitTestId}
            disabled={busy || reason.trim() === ''}
            onClick={() => onSubmit(reason.trim())}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="hv-label">{label}</span>
        <textarea
          ref={ref}
          data-testid={reasonTestId}
          rows={3}
          value={reason}
          placeholder={placeholder}
          onChange={(event) => setReason(event.target.value)}
          className={cx(FIELD, 'mt-1 resize-y')}
        />
      </label>
    </Dialog>
  );
}

export function AssignDialog({
  open,
  onClose,
  units,
  current,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  units: readonly Unit[];
  current: string | undefined;
  busy: boolean;
  onSubmit: (unitId: string) => void;
}) {
  const t = useT();
  const [unitId, setUnitId] = useState('');

  useEffect(() => {
    if (open) setUnitId(current ?? units[0]?.id ?? '');
  }, [open, current, units]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('answers.assign.title')}
      description={t('answers.assign.body')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid="answer-assign-submit"
            disabled={busy || unitId === ''}
            onClick={() => onSubmit(unitId)}
          >
            {t('action.question.assign')}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="hv-label">{t('answers.assign.unit')}</span>
        <select
          data-testid="answer-assign-unit"
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
          className={cx(FIELD, 'mt-1')}
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </label>
    </Dialog>
  );
}

export function MergeDialog({
  open,
  onClose,
  busy,
  onResolve,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  /** Looks the number up in the corpus; the interface never guesses an identifier. */
  onResolve: (number: string) => Promise<string | undefined>;
  onSubmit: (targetId: string) => void;
}) {
  const t = useT();
  const [number, setNumber] = useState('');
  const [unknown, setUnknown] = useState(false);

  useEffect(() => {
    if (open) {
      setNumber('');
      setUnknown(false);
    }
  }, [open]);

  const submit = (): void => {
    setUnknown(false);
    void onResolve(number.trim()).then((id) => {
      if (id === undefined) setUnknown(true);
      else onSubmit(id);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('answers.merge.title')}
      description={t('answers.merge.body')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid="answer-merge-submit"
            disabled={busy || number.trim() === ''}
            onClick={submit}
          >
            {t('action.question.merge')}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="hv-label">{t('answers.merge.target')}</span>
        <input
          data-testid="answer-merge-target"
          value={number}
          placeholder={t('answers.merge.placeholder')}
          onChange={(event) => setNumber(event.target.value)}
          className={cx(FIELD, 'mt-1 font-mono')}
        />
      </label>
      {unknown && (
        <p role="alert" className="mt-2 text-2xs text-danger-600">
          {t('answers.merge.unknown')}
        </p>
      )}
    </Dialog>
  );
}
