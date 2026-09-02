/** Bühne. Placeholder for slice 003, which builds the large-type podium view. */
import { Presentation } from 'lucide-react';
import { PhasePlaceholder } from '../../app/PhasePlaceholder';

export function StagePage() {
  return (
    <PhasePlaceholder
      titleKey="page.stage.title"
      descriptionKey="page.stage.description"
      icon={Presentation}
      slice="003"
    />
  );
}
