/**
 * One Einzelfrage as it leaves the capture desk: number, wording, state — nothing else (point #21,
 * feedback, slice 020). The classification (Antwortpfad, Bühnenzuordnung) that used to sit on the
 * card lives behind the explicit "Klassifizieren" action in `ClassifyDialog` now, rendered only when
 * `question._actions` allows it (AGENTS.md rule 4) — until slice 053 moves it to the Steuerungsansicht.
 */
import { useEffect, useState } from 'react';
import { CornerDownRight, Tag } from 'lucide-react';
import type { Question } from '@hv/domain';
import { api } from '../../api';
import { Badge, Button, StatusBadge, cx } from '../../components';
import { actionLabel, useT } from '../../i18n';
import type { Translate } from '../../i18n';
import { relationLabel } from '../../i18n/labels';

/**
 * Scheibe 046: the id whose number the card resolves — only one the view delivered. A masked reference (the reader
 * may not read the referenced question) has no id, so nothing is fetched for it.
 */
export function parentToResolve(question: Pick<Question, 'relation' | 'parentQuestionId'>): string | undefined {
  return question.relation !== undefined ? question.parentQuestionId : undefined;
}
/** "Nachfrage zu F-0012" with a resolved number; only the relation without one (masked, not yet loaded, 404). */
export function referenceBadgeText(t: Translate, relation: string, number: string | null | undefined): string {
  return relationLabel(t, relation, number ?? undefined);
}

/** Resolves the number once per load of the card; a 404 (outside the read scope) leaves it unresolved. */
function useParentNumber(parentId: string | undefined): string | null {
  const [resolved, setResolved] = useState<{ id: string; number: string | null } | null>(null);
  useEffect(() => {
    if (parentId === undefined) return undefined;
    let live = true;
    api.getQuestion(parentId).then(
      (parent) => { if (live) setResolved({ id: parentId, number: parent.number }); },
      // 404 (outside the read scope) or a failed read: the badge keeps the relation alone.
      () => { if (live) setResolved({ id: parentId, number: null }); },
    );
    return () => { live = false; };
  }, [parentId]);
  return resolved !== null && resolved.id === parentId ? resolved.number : null;
}

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
  const parentNumber = useParentNumber(parentToResolve(question));

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
        {question.relation !== undefined && (
          // Scheibe 046: neutral, no status colour for a reference (design principle 4).
          <Badge tone="neutral">
            <span data-testid="capture-question-reference" className="inline-flex items-center gap-1">
              <CornerDownRight size={12} strokeWidth={1.75} aria-hidden="true" />
              {referenceBadgeText(t, question.relation, parentNumber)}
            </span>
          </Badge>
        )}
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
