/**
 * Scheibe 041 (decision 4): remove one master-data entry. A sentence with the entry's name and the primary action; the
 * service refuses while the entry is in use (R-ADM-02), and the refusal stays in the dialog with its rule id.
 */
import { Button, Dialog } from '../../components';
import { useT } from '../../i18n';
import { ProblemNote } from './parts';
import type { DialogProblem } from './problems';

export function RemoveDialog({
  name,
  busy,
  problem,
  onClose,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  problem?: DialogProblem;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('admin.remove.title')}
      description={t('admin.remove.body', { name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-testid="admin-remove-cancel">
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            data-testid="admin-remove-submit"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) onConfirm();
            }}
          >
            {t('admin.remove.submit')}
          </Button>
        </>
      }
    >
      {problem !== undefined ? <ProblemNote problem={problem} /> : undefined}
    </Dialog>
  );
}
