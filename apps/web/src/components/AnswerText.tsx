/**
 * Scheibe 055b (decision 1, ADR 0005 "ein Renderer"): the one component that shows an answer version — on the podium,
 * in the Beantwortung (where it is approved), in the focus view and in the history. Same version, same markup.
 *
 * Its source is the projection only (`Question.answers[n]`, the stored form after the read variant), never the payload
 * of an event (055 decision 10). It narrows the whitelist once more (ADR 0005 "Risiko"): two block types, three marks,
 * everything else falls back to a paragraph or to plain text. React elements and text nodes only; no attribute comes
 * from data except a `lang` from its own list. No font, no size, no colour except the highlight: everything inherits
 * from the view (feedback #31), so the podium at 24 px and the focus view at 13 px are structured alike (spacing in em).
 */
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { AnswerInline, AnswerVersion } from '@hv/domain';
import { cx } from './cx';

/** The languages this renderer sets as `lang` (E21: German only). Anything else gets no attribute at all. */
const RENDER_LANGUAGES: readonly string[] = ['de'];

/** The one colour of the house format: an existing token pair, ≥ 4.5:1 on light and on the dark podium. */
const HIGHLIGHT_STYLE = { backgroundColor: 'var(--color-tone-warning-bg)', color: 'var(--color-tone-warning-fg)' } as const;

/** One run, nested in the canonical order strong > em > mark; an unknown mark falls away, its text stays. */
function renderRun(run: AnswerInline, key: number): ReactNode {
  const marks: readonly string[] = Array.isArray(run.marks) ? run.marks : [];
  let node: ReactNode = typeof run.text === 'string' ? run.text : '';
  if (marks.includes('highlight')) node = <mark style={HIGHLIGHT_STYLE}>{node}</mark>;
  if (marks.includes('italic')) node = <em>{node}</em>;
  if (marks.includes('bold')) node = <strong>{node}</strong>;
  return <Fragment key={key}>{node}</Fragment>;
}

const runsOf = (runs: unknown): AnswerInline[] => (Array.isArray(runs) ? (runs as AnswerInline[]) : []);

export function AnswerText({ answer, className }: { answer: Pick<AnswerVersion, 'body' | 'text'>; className?: string }) {
  const body = answer.body;
  if (body === undefined || body === null || !Array.isArray(body.blocks)) {
    // Broken old data, or a service before 0.4.4: the text as it was shown before 055b.
    return (
      <div data-answer-text="true" className={className}>
        <p className="whitespace-pre-wrap">{answer.text}</p>
      </div>
    );
  }
  const language: unknown = body.language;
  const lang = typeof language === 'string' && RENDER_LANGUAGES.includes(language) ? { lang: language } : {};
  return (
    <div data-answer-text="true" {...lang} className={cx('space-y-[0.75em]', className)}>
      {body.blocks.map((block, index) =>
        block.type === 'list' && Array.isArray(block.items) ? (
          <ul key={index} className="list-disc space-y-[0.25em] pl-[1.25em]">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{runsOf(item).map(renderRun)}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{runsOf((block as { content?: unknown }).content).map(renderRun)}</p>
        ),
      )}
    </div>
  );
}
