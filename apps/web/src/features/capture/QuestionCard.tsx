/**
 * One Einzelfrage as it leaves the capture desk: number, wording, state — nothing else (point #21,
 * feedback, slice 020). The classification (Antwortpfad, Bühnenzuordnung) that used to sit on the
 * card lives behind the explicit "Klassifizieren" action in `ClassifyDialog` now, rendered only when
 * `question._actions` allows it (AGENTS.md rule 4) — until slice 053 moves it to the Steuerungsansicht.
 */
import { Tag } from 'lucide-react';
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
          // m4 (review round 1): "secondary" with a Tag icon reads as an action, not a label —
          // "ghost" with plain text next to a status badge looked like one more piece of metadata.
          <Button
            variant="secondary"
            size="sm"
            data-testid="capture-classify-open"
            className="ml-auto"
            onClick={() => onClassify(question)}
            icon={<Tag size={14} strokeWidth={1.75} aria-hidden="true" />}
          >
            {actionLabel(t, 'question.classify')}
          </Button>
        )}
      </header>

      <p className="mt-2 text-[13px] leading-6 text-ink-800">{question.text}</p>
    </article>
  );
}
