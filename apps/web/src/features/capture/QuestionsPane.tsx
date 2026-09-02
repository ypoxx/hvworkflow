/**
 * Right half of the capture desk: the Einzelfragen taken from this Redebeitrag, newest work at the
 * bottom, each with its classification. This is the list that everything downstream — Zuweisung,
 * Antwortentwurf, Bühne — is built on.
 */
import { ScissorsLineDashed, TriangleAlert } from 'lucide-react';
import type { AgendaItem, Question } from '@hv/domain';
import { Button, EmptyState, Kbd, Panel, cx } from '../../components';
import { useT } from '../../i18n';
import { QuestionCard } from './QuestionCard';

export function QuestionsPane({
  questions,
  agendaItems,
  loading,
  failed,
  onProblem,
}: {
  questions: readonly Question[];
  agendaItems: readonly AgendaItem[];
  loading: boolean;
  failed: boolean;
  onProblem: () => void;
}) {
  const t = useT();

  return (
    <Panel
      className="h-full"
      padded={false}
      bodyClassName="min-h-0 overflow-y-auto"
      title={t('capture.questions.title')}
      description={t('capture.questions.count', { count: questions.length })}
    >
      {failed && questions.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={TriangleAlert}
            title={t('capture.error.questions')}
            description={t('capture.error.body')}
            action={
              <Button variant="secondary" onClick={onProblem}>
                {t('common.retry')}
              </Button>
            }
          />
        </div>
      ) : loading && questions.length === 0 ? (
        <div aria-hidden="true" className="grid gap-3 p-4">
          {[0, 1, 2].map((card) => (
            <span key={card} className={cx('h-24 rounded-md border border-line bg-ink-25')} />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={ScissorsLineDashed}
            title={t('capture.questions.empty.title')}
            description={t('capture.questions.empty.body')}
            action={
              <span className="flex items-center gap-1.5 text-2xs text-ink-500">
                {t('capture.selection.hint')}
                <Kbd>{t('capture.key.alt')}</Kbd>
                <Kbd>{t('capture.key.q')}</Kbd>
              </span>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 p-4">
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              agendaItems={agendaItems}
              onProblem={onProblem}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
