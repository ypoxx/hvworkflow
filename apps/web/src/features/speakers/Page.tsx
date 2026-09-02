/** Wortmeldeliste. Placeholder for slice 002, which builds rounds, speaking time and reordering. */
import { ListOrdered } from 'lucide-react';
import { PhasePlaceholder } from '../../app/PhasePlaceholder';

export function SpeakersPage() {
  return (
    <PhasePlaceholder
      titleKey="page.speakers.title"
      descriptionKey="page.speakers.description"
      icon={ListOrdered}
      slice="002"
    />
  );
}
