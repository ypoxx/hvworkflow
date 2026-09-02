/**
 * "In Runde verschieben": a Wortmeldung that was registered too early or postponed by the chair
 * moves to the end of another round.
 */
import { useEffect, useId, useState } from 'react';
import type { Speaker } from '@hv/domain';
import { Button, Dialog } from '../../components';
import { useT } from '../../i18n';
import { Field, FIELD_CONTROL } from './fields';

export function MoveDialog({
  speaker,
  rounds,
  onClose,
  onSubmit,
}: {
  speaker: Speaker | null;
  rounds: readonly number[];
  onClose: () => void;
  onSubmit: (speaker: Speaker, round: number) => Promise<boolean>;
}) {
  const t = useT();
  const ids = useId();
  const [round, setRound] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (speaker === null) return;
    setRound(speaker.round);
    setBusy(false);
  }, [speaker]);

  const submit = async (): Promise<void> => {
    if (speaker === null || busy) return;
    setBusy(true);
    const ok = await onSubmit(speaker, round);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open={speaker !== null}
      onClose={onClose}
      size="sm"
      title={t('speakers.action.move')}
      description={t('speakers.register.hint')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid="speaker-move-submit"
            disabled={busy || speaker === null || round === speaker.round}
            onClick={() => void submit()}
          >
            {t('speakers.move.submit')}
          </Button>
        </>
      }
    >
      {speaker !== null && (
        <div className="grid gap-3">
          <p className="text-[13px] text-ink-700">
            <span className="font-mono text-ink-500">{speaker.number}</span> {speaker.displayName}
          </p>
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
      )}
    </Dialog>
  );
}
