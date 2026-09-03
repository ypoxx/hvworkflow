/**
 * Where a Redebeitrag's wording came from — a glyph instead of a badge, so a dense contribution list
 * does not sprout another pill per row.
 */
import { Keyboard, Mic } from 'lucide-react';
import { useT } from '../i18n';

export interface SourceIconProps {
  source: 'manual' | 'transcript';
  className?: string;
}

export function SourceIcon({ source, className }: SourceIconProps) {
  const t = useT();
  const label = source === 'transcript' ? t('source.transcript') : t('source.manual');
  const Icon = source === 'transcript' ? Mic : Keyboard;
  return <Icon size={14} strokeWidth={1.75} aria-label={label} role="img" className={className} />;
}
