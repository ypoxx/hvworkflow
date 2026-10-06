/**
 * Scheibe 041 (decision 4): add or edit one master-data entry — one dialog, one whole-list replacement with exactly
 * this change. The fields come from `FIELDS` per kind; the primary action stays locked while a required field is empty
 * or a number is not a whole number from 1. A refusal stays in the dialog with its rule id, and so do the inputs.
 */
import { useId, useState } from 'react';
import { Button, Dialog } from '../../components';
import { useT } from '../../i18n';
import type { TKey } from '../../i18n';
import { FIELDS, entryOf } from './entries';
import type { EntryForm } from './entries';
import type { MasterInputs, MasterKind } from './masterData';
import { FIELD_CONTROL, Field, ProblemNote } from './parts';
import type { DialogProblem } from './problems';

export function EntryDialog<K extends MasterKind>({
  kind,
  titleKey,
  bodyKey,
  initial,
  busy,
  problem,
  onClose,
  onSubmit,
}: {
  kind: K;
  titleKey: TKey;
  bodyKey: TKey;
  initial: EntryForm;
  busy: boolean;
  problem?: DialogProblem;
  onClose: () => void;
  onSubmit: (entry: Omit<MasterInputs[K], 'id'>) => void;
}) {
  const t = useT();
  const [form, setForm] = useState<EntryForm>(initial);
  const formId = useId();
  const base = useId();
  const entry = entryOf(kind, form);
  const blocked = busy || entry === undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(titleKey)}
      description={t(bodyKey)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-testid="admin-entry-cancel">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" data-testid="admin-entry-submit" aria-disabled={blocked}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!blocked && entry !== undefined) onSubmit(entry);
        }}
      >
        {FIELDS[kind].map((field) => {
          const id = `${base}-${field.name}`;
          const hintId = `${id}-hint`;
          return (
            <Field
              key={field.name}
              label={t(field.labelKey)}
              htmlFor={id}
              optional={!field.required}
              {...(field.hintKey !== undefined ? { hint: t(field.hintKey), hintId } : {})}
            >
              <input
                id={id}
                data-testid={`admin-entry-${field.name}`}
                className={field.mono === true ? `${FIELD_CONTROL} font-mono` : FIELD_CONTROL}
                value={form[field.name] ?? ''}
                autoComplete="off"
                {...(field.numeric === true ? { inputMode: 'numeric' as const, pattern: '[0-9]*' } : {})}
                {...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {})}
                {...(field.required ? { 'aria-required': true } : {})}
                {...(field.hintKey !== undefined ? { 'aria-describedby': hintId } : {})}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((previous) => ({ ...previous, [field.name]: value }));
                }}
              />
            </Field>
          );
        })}
        {problem !== undefined && <ProblemNote problem={problem} />}
      </form>
    </Dialog>
  );
}
