/**
 * "Wortmeldung aufnehmen": the form the meeting office fills in while the person is still at the
 * desk. Name is the only required entry; everything else has a sensible default so that the dialog
 * can be finished with two keystrokes.
 */
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { SpeakerKind, SpeakerRegistration } from '@hv/domain';
import { Button, Dialog } from '../../components';
import { actionLabel, useT } from '../../i18n';
import { Field, FIELD_CONTROL } from './fields';
import { speakerKindLabel } from './labels';

const KINDS: readonly SpeakerKind[] = ['shareholder', 'proxy', 'association'];

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
  const [kind, setKind] = useState<SpeakerKind>('shareholder');
  const [round, setRound] = useState(defaultRound);
  const [minutes, setMinutes] = useState('5');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName('');
    setOrganisation('');
    setKind('shareholder');
    setRound(defaultRound);
    setMinutes('5');
    setBusy(false);
  }, [open, defaultRound]);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (displayName.trim() === '' || busy) return;
    setBusy(true);
    const parsed = Number.parseInt(minutes, 10);
    const ok = await onSubmit({
      displayName: displayName.trim(),
      kind,
      round,
      ...(organisation.trim() !== '' ? { organisation: organisation.trim() } : {}),
      ...(Number.isFinite(parsed) && parsed > 0 ? { requestedMinutes: parsed } : {}),
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
          <Field label={t('speakers.field.kind')} htmlFor={`${ids}-kind`}>
            <select
              id={`${ids}-kind`}
              className={FIELD_CONTROL}
              value={kind}
              onChange={(event) => setKind(event.target.value as SpeakerKind)}
            >
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {speakerKindLabel(t, value)}
                </option>
              ))}
            </select>
          </Field>
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
          <Field label={t('speakers.field.minutes')} htmlFor={`${ids}-minutes`}>
            <input
              id={`${ids}-minutes`}
              type="number"
              min={1}
              max={60}
              inputMode="numeric"
              className={`${FIELD_CONTROL} font-mono tabular-nums`}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
