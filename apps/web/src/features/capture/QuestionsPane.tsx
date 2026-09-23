/**
 * Right half of the capture desk: the Einzelfragen taken from this Redebeitrag, newest work at the
 * bottom, each slimmed to number, wording and status (point #21). Classification is one dialog away,
 * owned here because it needs nothing the pane does not already have.
 */
import { useState } from 'react';
import { ScissorsLineDashed, TriangleAlert } from 'lucide-react';
import type { Question } from '@hv/domain';
import { Button, EmptyState, Kbd, Panel, cx } from '../../components';
import { useT } from '../../i18n';
import { ClassifyDialog } from './ClassifyDialog';
import { QuestionCard } from './QuestionCard';

export function QuestionsPane({
  questions,
  loading,
  failed,
  onProblem,
  hoveredQuestionId,
  onHoverQuestion,
}: {
  questions: readonly Question[];
  loading: boolean;
  failed: boolean;
  onProblem: () => void;
  hoveredQuestionId: string | null;
  onHoverQuestion: (id: string | null) => void;
}) {
  const t = useT();
  const [classifying, setClassifying] = useState<Question | null>(null);

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
              onClassify={setClassifying}
              hoveredQuestionId={hoveredQuestionId}
              onHoverQuestion={onHoverQuestion}
            />
          ))}
        </div>
      )}

      <ClassifyDialog
        question={classifying}
        onClose={() => setClassifying(null)}
        onProblem={onProblem}
      />
    </Panel>
  );
}
