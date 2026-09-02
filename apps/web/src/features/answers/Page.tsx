/** Beantwortung. Placeholder for slice 003: work list, answer versions, clearing and approval. */
import { ScrollText } from 'lucide-react';
import { PhasePlaceholder } from '../../app/PhasePlaceholder';

export function AnswersPage() {
  return (
    <PhasePlaceholder
      titleKey="page.answers.title"
      descriptionKey="page.answers.description"
      icon={ScrollText}
      slice="003"
    />
  );
}
