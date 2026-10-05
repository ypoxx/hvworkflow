/**
 * Scheibe 055b (decision 2): the answer of the chosen question in the history, above its timeline — the latest version
 * of `Question.answers`, through the one renderer (`AnswerText`), as the podium and the Beantwortung show it. No new
 * read: the question comes from the corpus the page already loads, which this person already reads. A refusal as latest
 * version carries its badge; its justification is never shown. Without a version there is no block.
 */
import { useId } from 'react';
import type { Question } from '@hv/domain';
import { AnswerText, Badge } from '../../components';
import { useT } from '../../i18n';
import { refusalKindOf } from '../answers/refusal';

export function AnswerBlock({ question }: { question: Pick<Question, 'answers'> | null }) {
  const t = useT();
  const titleId = useId();
  const latest = question?.answers[question.answers.length - 1];
  if (latest === undefined) return null;
  return (
    <section data-testid="history-answer" aria-labelledby={titleId} className="mb-4 rounded-md border border-line bg-sunken px-3 py-3">
      <h3 id={titleId} className="flex flex-wrap items-center gap-2">
        {/* D5: the version number in mono, as in the Beantwortung. */}
        <Badge tone="accent" mono>
          {t('history.answer.title', { version: latest.version })}
        </Badge>
        {refusalKindOf(latest) !== 'answer' && <Badge tone="warning">{t('answers.refusal.badge')}</Badge>}
      </h3>
      <AnswerText answer={latest} className="mt-2 text-[13px] leading-relaxed text-ink-900" />
    </section>
  );
}
