/**
 * Where a Redebeitrag's wording came from — a glyph instead of a badge, so a dense contribution list
 * does not sprout another pill per row.
 */
import { FileText, Keyboard, Mic } from 'lucide-react';
import type { Contribution } from '@hv/domain';
import { useT } from '../i18n';

export interface SourceIconProps {
  source: Contribution['source'];
  className?: string;
}

export function SourceIcon({ source, className }: SourceIconProps) {
  const t = useT();
  const label = source === 'transcript' ? t('source.transcript') : source === 'paper' ? t('source.paper') : t('source.manual');
  const Icon = source === 'transcript' ? Mic : source === 'paper' ? FileText : Keyboard;
  return <Icon size={14} strokeWidth={1.75} aria-label={label} role="img" className={className} />;
}
