/**
 * Scheibe 041 (decision 3): "Rolle zuordnen". Subject id (with the ids already in the table as suggestions — data, no
 * names), role (from the rights table, none preselected), optional answering unit, optional expiry in Berlin time. It
 * sends exactly the contract fields that are set (`assignInput`); no person and no deputy (041b). The service checks
 * every assignment; a refusal stays in the dialog with its rule id, and so do the inputs.
 */
import { useId, useState } from 'react';
import type { RoleAssignmentCreate, Unit } from '@hv/domain';
import type { RoleCard } from '../../api/roleCards';
import { Button, Dialog } from '../../components';
import { actionLabel, roleLabel, useT } from '../../i18n';
import { EMPTY_ASSIGN_FORM, assignInput, expiresInvalid } from './assignments';
import type { AssignForm } from './assignments';
import { FIELD_CONTROL, Field, ProblemNote } from './parts';
import type { DialogProblem } from './problems';

export function AssignDialog({
  cards,
  units,
  subjects,
  busy,
  problem,
  onClose,
  onSubmit,
  initialForm,
}: {
  cards: readonly RoleCard[];
  units: readonly Unit[];
  /** The subject ids already in the table, offered as suggestions. */
  subjects: readonly string[];
  busy: boolean;
  problem?: DialogProblem;
  onClose: () => void;
  onSubmit: (input: RoleAssignmentCreate) => void;
  /** For the static test only; the page never passes it, so every opening starts empty. */
  initialForm?: AssignForm;
}) {
  const t = useT();
  const [form, setForm] = useState<AssignForm>(initialForm ?? EMPTY_ASSIGN_FORM);
  const formId = useId();
  const ids = {
    subject: useId(),
    subjectHint: useId(),
    subjects: useId(),
    role: useId(),
    unit: useId(),
    unitHint: useId(),
    expires: useId(),
    expiresHint: useId(),
  };
  const input = assignInput(form);
  const blocked = busy || input === undefined;
  const invalidExpiry = expiresInvalid(form);
  const card = cards.find((entry) => entry.role === form.role);

  return (
    <Dialog
      open
      onClose={onClose}
      title={actionLabel(t, 'admin.roles.manage')}
      description={t('admin.assign.body')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-testid="admin-assign-cancel">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" data-testid="admin-assign-submit" aria-disabled={blocked}>
            {t('admin.assign.submit')}
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
          if (!blocked && input !== undefined) onSubmit(input);
        }}
      >
        <Field label={t('admin.assign.subject')} htmlFor={ids.subject} hint={t('admin.assign.subject.hint')} hintId={ids.subjectHint}>
          <input
            id={ids.subject}
            data-testid="admin-assign-subject"
            className={`${FIELD_CONTROL} font-mono`}
            value={form.subjectId}
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            list={ids.subjects}
            aria-required="true"
            aria-describedby={ids.subjectHint}
            onChange={(event) => {
              const subjectId = event.target.value;
              setForm((previous) => ({ ...previous, subjectId }));
            }}
          />
          <datalist id={ids.subjects}>
            {subjects.map((subject) => (
              <option key={subject} value={subject} />
            ))}
          </datalist>
        </Field>

        <Field label={t('admin.assign.role')} htmlFor={ids.role}>
          <select
            id={ids.role}
            data-testid="admin-assign-role"
            className={FIELD_CONTROL}
            value={form.role}
            aria-required="true"
            onChange={(event) => {
              const chosen = cards.find((entry) => entry.role === event.target.value);
              setForm((previous) => ({ ...previous, role: chosen?.role ?? '' }));
            }}
          >
            <option value="">{t('admin.assign.role.placeholder')}</option>
            {cards.map((entry) => (
              <option key={entry.role} value={entry.role}>
                {roleLabel(t, entry.role)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={t('admin.assign.unit')}
          htmlFor={ids.unit}
          optional
          {...(card?.unitBound === true ? { hint: t('admin.assign.unit.boundHint'), hintId: ids.unitHint } : {})}
        >
          <select
            id={ids.unit}
            data-testid="admin-assign-unit"
            className={FIELD_CONTROL}
            value={form.unitId}
            {...(card?.unitBound === true ? { 'aria-describedby': ids.unitHint } : {})}
            onChange={(event) => {
              const unitId = event.target.value;
              setForm((previous) => ({ ...previous, unitId }));
            }}
          >
            <option value="">{t('admin.assign.unit.none')}</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.shortName ?? unit.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={t('admin.assign.expires')}
          htmlFor={ids.expires}
          optional
          hint={invalidExpiry ? t('admin.assign.expires.invalid') : t('admin.assign.expires.hint')}
          hintId={ids.expiresHint}
        >
          <input
            id={ids.expires}
            type="datetime-local"
            data-testid="admin-assign-expires"
            className={`${FIELD_CONTROL} font-mono`}
            value={form.expires}
            aria-invalid={invalidExpiry}
            aria-describedby={ids.expiresHint}
            onChange={(event) => {
              const expires = event.target.value;
              setForm((previous) => ({ ...previous, expires }));
            }}
          />
        </Field>

        {problem !== undefined && <ProblemNote problem={problem} />}
      </form>
    </Dialog>
  );
}
