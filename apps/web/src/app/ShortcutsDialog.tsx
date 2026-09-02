/**
 * The shortcuts, written down. A tool that is operated under time pressure has to teach its own
 * keyboard, otherwise the shortcuts exist only for the person who built them.
 */
import { Fragment } from 'react';
import { Dialog, Kbd, TBody, TD, TH, THead, TR, Table } from '../components';
import { useT } from '../i18n';
import type { TKey } from '../i18n';

const ROWS: readonly { keys: readonly string[]; descriptionKey: TKey }[] = [
  { keys: ['Alt', '1'], descriptionKey: 'shortcuts.nav' },
  { keys: ['Alt', 'N'], descriptionKey: 'shortcuts.collapse' },
  { keys: ['?'], descriptionKey: 'shortcuts.help' },
  { keys: ['Esc'], descriptionKey: 'shortcuts.close' },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t('shortcuts.title')}>
      <Table>
        <THead>
          <TR>
            <TH className="w-36">{t('shortcuts.column.key')}</TH>
            <TH>{t('shortcuts.column.action')}</TH>
          </TR>
        </THead>
        <TBody>
          {ROWS.map((row) => (
            <TR key={row.descriptionKey}>
              <TD>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  {row.keys.map((key, index) => (
                    <Fragment key={key}>
                      {index > 0 && <span className="text-ink-400">+</span>}
                      <Kbd>{key}</Kbd>
                    </Fragment>
                  ))}
                  {row.keys[0] === 'Alt' && row.keys[1] === '1' && (
                    <span className="text-ink-400">…5</span>
                  )}
                </span>
              </TD>
              <TD>{t(row.descriptionKey)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Dialog>
  );
}
