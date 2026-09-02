/**
 * Scaffolding for a phase whose screen is built in a later slice. It is deliberately explicit about
 * what is missing instead of showing an empty page — a reviewer must never wonder whether something
 * broke. Slices 002 and 003 replace the pages that use it.
 */
import type { LucideIcon } from 'lucide-react';
import { Badge, EmptyState, PageHeader, Panel } from '../components';
import { useT } from '../i18n';
import type { TKey } from '../i18n';
import { MeetingPanel } from './MeetingPanel';

export function PhasePlaceholder({
  titleKey,
  descriptionKey,
  icon,
  slice,
}: {
  titleKey: TKey;
  descriptionKey: TKey;
  icon: LucideIcon;
  slice: string;
}) {
  const t = useT();
  return (
    <div className="flex h-full min-h-125 flex-col gap-5">
      <PageHeader
        title={t(titleKey)}
        description={t(descriptionKey)}
        actions={<Badge tone="accent">{t('placeholder.badge', { slice })}</Badge>}
      />
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel bodyClassName="grid">
          <EmptyState
            icon={icon}
            title={t('placeholder.title')}
            description={t('placeholder.body', { phase: t(titleKey), slice })}
          />
        </Panel>
        <MeetingPanel />
      </div>
    </div>
  );
}
