/**
 * Scheibe 041 (decision 3): "Entziehen" — a sentence naming subject id and role, an optional reason (at most 500
 * characters; blank sends none) and the primary action. A refusal (R-ADM-08) stays in the dialog with its rule id.
 */
import { useId, useState } from 'react';
import type { Role } from '@hv/domain';
import { Button, Dialog } from '../../components';
import { roleLabel, useT } from '../../i18n';
import { Field, ProblemNote, TEXTAREA_CONTROL } from './parts';
import type { DialogProblem } from './problems';

export function RevokeDialog({
  subjectId,
  role,
  busy,
  problem,
  onClose,
  onSubmit,
}: {
  subjectId: string;
  role: Role;
  busy: boolean;
  problem?: DialogProblem;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const formId = useId();
  const reasonId = useId();
  const hintId = useId();

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('admin.revoke.title')}
      description={t('admin.revoke.body', { subject: subjectId, role: roleLabel(t, role) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="danger" data-testid="admin-revoke-submit" aria-disabled={busy}>
            {t('admin.revoke.submit')}
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
          if (!busy) onSubmit(reason);
        }}
      >
        <Field label={t('admin.revoke.reason')} htmlFor={reasonId} optional hint={t('admin.revoke.reason.hint')} hintId={hintId}>
          <textarea
            id={reasonId}
            data-testid="admin-revoke-reason"
            className={TEXTAREA_CONTROL}
            maxLength={500}
            value={reason}
            aria-describedby={hintId}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        {problem !== undefined && <ProblemNote problem={problem} />}
      </form>
    </Dialog>
  );
}
