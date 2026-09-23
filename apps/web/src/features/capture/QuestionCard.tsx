/**
 * One Einzelfrage as it leaves the capture desk: number, wording, state — nothing else (point #21,
 * feedback, slice 020). The classification (Antwortpfad, Bühnenzuordnung) that used to sit on the
 * card lives behind the explicit "Klassifizieren" action in `ClassifyDialog` now, rendered only when
 * `question._actions` allows it (AGENTS.md rule 4) — until slice 053 moves it to the Steuerungsansicht.
 */
import type { Question } from '@hv/domain';
import { Button, StatusBadge, cx } from '../../components';
import { actionLabel, useT } from '../../i18n';

export function QuestionCard({
  question,
  onClassify,
  hoveredQuestionId,
  onHoverQuestion,
}: {
  question: Question;
  onClassify: (question: Question) => void;
  hoveredQuestionId: string | null;
  onHoverQuestion: (id: string | null) => void;
}) {
  const t = useT();
  const mayClassify = question._actions.includes('question.classify');

  return (
    <article
      data-testid="capture-question-card"
      data-number={question.number}
      onMouseEnter={() => onHoverQuestion(question.id)}
      onMouseLeave={() => onHoverQuestion(null)}
      onFocus={() => onHoverQuestion(question.id)}
      onBlur={() => onHoverQuestion(null)}
      className={cx(
        'rounded-md border border-line bg-surface p-3 transition-shadow duration-100',
        hoveredQuestionId === question.id && 'outline outline-2 outline-offset-2 outline-accent-500',
      )}
    >
      <header className="flex items-center gap-2">
        <span className="font-mono text-2xs tabular-nums text-ink-500">{question.number}</span>
        <StatusBadge status={question.status} />
        {mayClassify && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="capture-classify-open"
            className="ml-auto"
            onClick={() => onClassify(question)}
          >
            {actionLabel(t, 'question.classify')}
          </Button>
        )}
      </header>

      <p className="mt-2 text-[13px] leading-6 text-ink-800">{question.text}</p>
    </article>
  );
}
