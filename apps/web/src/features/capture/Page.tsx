/**
 * Erfassung. Placeholder for slice 002; it already lays out the split the capture desk will work in,
 * contribution on the left and the questions taken from it on the right.
 */
import { PencilLine, ScissorsLineDashed } from 'lucide-react';
import { Badge, EmptyState, PageHeader, Panel, SplitPane } from '../../components';
import { useT } from '../../i18n';

export function CapturePage() {
  const t = useT();
  return (
    <div className="flex h-full min-h-125 flex-col gap-5">
      <PageHeader
        title={t('page.capture.title')}
        description={t('page.capture.description')}
        actions={<Badge tone="accent">{t('placeholder.badge', { slice: '002' })}</Badge>}
      />
      <SplitPane
        storageKey="hv-capture-split-v1"
        initial={55}
        className="min-h-0 flex-1"
        left={
          <Panel title={t('placeholder.left')} className="h-full">
            <EmptyState
              icon={PencilLine}
              title={t('placeholder.title')}
              description={t('placeholder.body', { phase: t('placeholder.left'), slice: '002' })}
            />
          </Panel>
        }
        right={
          <Panel title={t('placeholder.right')} className="h-full">
            <EmptyState
              icon={ScissorsLineDashed}
              title={t('placeholder.title')}
              description={t('placeholder.body', { phase: t('placeholder.right'), slice: '002' })}
            />
          </Panel>
        }
      />
    </div>
  );
}
