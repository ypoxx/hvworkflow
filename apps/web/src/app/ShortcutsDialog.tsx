/**
 * The shortcuts, written down. A tool that is operated under time pressure has to teach its own
 * keyboard, otherwise the shortcuts exist only for the person who built them.
 */
import { Fragment } from 'react';
import { Dialog, Kbd, TBody, TD, TH, THead, TR, Table } from '../components';
import { useT } from '../i18n';
import type { TKey } from '../i18n';
import { getNavigationShortcutRange } from './featureRegistry';

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();

  const { min, max } = getNavigationShortcutRange();

  const rows: readonly { keys: readonly string[]; descriptionKey: TKey }[] = [
    {
      keys: ['Alt', String(min), '…', String(max)] as readonly string[],
      descriptionKey: 'shortcuts.nav' as const,
    },
    { keys: ['Alt', 'N'], descriptionKey: 'shortcuts.collapse' as const },
    { keys: ['?'], descriptionKey: 'shortcuts.help' as const },
    { keys: ['Esc'], descriptionKey: 'shortcuts.close' as const },
  ];

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
          {rows.map((row, index) => (
            <TR key={`${row.descriptionKey}-${index}`}>
              <TD>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  {row.keys.map((key, keyIndex) => (
                    <Fragment key={`${key}-${keyIndex}`}>
                      {keyIndex > 0 && key !== '…' && <span className="text-ink-400">+</span>}
                      {key === '…' ? (
                        <span className="text-ink-400">{key}</span>
                      ) : (
                        <Kbd>{key}</Kbd>
                      )}
                    </Fragment>
                  ))}
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
