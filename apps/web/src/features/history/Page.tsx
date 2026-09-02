/** Historie & Suche. Placeholder for slice 003: full-text search and the history of each question. */
import { History } from 'lucide-react';
import { PhasePlaceholder } from '../../app/PhasePlaceholder';

export function HistoryPage() {
  return (
    <PhasePlaceholder
      titleKey="page.history.title"
      descriptionKey="page.history.description"
      icon={History}
      slice="003"
    />
  );
}
