/**
 * "Wortmeldung aufnehmen": the form the meeting office fills in while the person is still at the
 * desk. Name is the only required entry; everything else has a sensible default so that the dialog
 * can be finished with two keystrokes.
 */
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { SpeakerRegistration } from '@hv/domain';
import { Button, Dialog } from '../../components';
import { actionLabel, useT } from '../../i18n';
import { Field, FIELD_CONTROL } from './fields';

export function RegisterDialog({
  open,
  onClose,
  rounds,
  defaultRound,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  rounds: readonly number[];
  defaultRound: number;
  onSubmit: (input: SpeakerRegistration) => Promise<boolean>;
}) {
  const t = useT();
  const ids = useId();
  const [displayName, setDisplayName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [round, setRound] = useState(defaultRound);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName('');
    setOrganisation('');
    setRound(defaultRound);
    setBusy(false);
  }, [open, defaultRound]);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (displayName.trim() === '' || busy) return;
    setBusy(true);
    const ok = await onSubmit({
      displayName: displayName.trim(),
      round,
      ...(organisation.trim() !== '' ? { organisation: organisation.trim() } : {}),
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={actionLabel(t, 'speaker.register')}
      description={t('speakers.register.hint')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={`${ids}-form`}
            data-testid="speaker-register-submit"
            disabled={busy || displayName.trim() === ''}
          >
            {t('speakers.register.submit')}
          </Button>
        </>
      }
    >
      <form id={`${ids}-form`} onSubmit={submit} className="grid gap-4">
        <Field label={t('speakers.field.name')} htmlFor={`${ids}-name`}>
          <input
            id={`${ids}-name`}
            data-testid="speaker-register-name"
            className={FIELD_CONTROL}
            value={displayName}
            required
            placeholder={t('speakers.field.name.placeholder')}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>
        <Field label={t('speakers.field.organisation')} htmlFor={`${ids}-org`}>
          <input
            id={`${ids}-org`}
            className={FIELD_CONTROL}
            value={organisation}
            placeholder={t('speakers.field.organisation.placeholder')}
            onChange={(event) => setOrganisation(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 items-end gap-3">
          <Field label={t('speakers.field.round')} htmlFor={`${ids}-round`}>
            <select
              id={`${ids}-round`}
              className={FIELD_CONTROL}
              value={round}
              onChange={(event) => setRound(Number.parseInt(event.target.value, 10))}
            >
              {rounds.map((value) => (
                <option key={value} value={value}>
                  {t('header.round', { round: value })}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
