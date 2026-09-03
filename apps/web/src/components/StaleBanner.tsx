/**
 * The 412 case made visible: someone else changed this record first. Reuses the existing warning
 * tint tokens (amber) instead of adding new ones — slice 007 wires this up on a version conflict.
 */
import { useT } from '../i18n';
import { Button } from './Button';

export interface StaleBannerProps {
  message: string;
  onReload: () => void;
  testId?: string;
}

export function StaleBanner({ message, onReload, testId }: StaleBannerProps) {
  const t = useT();
  return (
    <div
      role="status"
      {...(testId !== undefined ? { 'data-testid': testId } : {})}
      className="flex items-center justify-between gap-3 border-y px-3 py-2 text-[13px]"
      style={{
        background: 'var(--color-tone-warning-bg)',
        borderColor: 'var(--color-tone-warning-bd)',
        color: 'var(--color-tone-warning-fg)',
      }}
    >
      <span>{message}</span>
      <Button variant="ghost" size="sm" onClick={onReload}>
        {t('stale.reload')}
      </Button>
    </div>
  );
}
