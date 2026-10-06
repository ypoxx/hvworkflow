/**
 * Scheibe 046: the block "Bezug" in the history detail, under the answer block and over the timeline. It shows the
 * referenced question (Bezugsfrage) of a follow-up question or clarification and the direct follow-ups of the chosen
 * question, each only as far as this person may read it: the view masks the referenced id for a reader of the child
 * who may not read the parent, and then the block says "zu einer nicht sichtbaren Frage" without number, link or
 * fetch (it never fetches an id the view did not deliver). The children come from `listQuestions` with the filter
 * `parentQuestionId`, which applies the read scope per child.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import type { Question } from '@hv/domain';
import { api } from '../../api';
import { useApiVersion } from '../../api/useApiVersion';
import { Badge, Button, StatusBadge } from '../../components';
import { useT } from '../../i18n';
import { relationLabel } from '../../i18n/labels';
import { excerpt } from './lib';

export type Load<T> = { kind: 'none' } | { kind: 'loading' } | { kind: 'ready'; value: T } | { kind: 'error' };

/** What the block reads: the parent only when the view delivered its id; the children of the chosen question. */
export function threadReads(question: Pick<Question, 'id' | 'relation' | 'parentQuestionId'>): { parentId: string | undefined; childrenOf: string } {
  return { parentId: question.relation !== undefined ? question.parentQuestionId : undefined, childrenOf: question.id };
}

export interface ThreadBlockViewProps {
  question: Question;
  parent: Load<Question>;
  children: Load<readonly Question[]>;
  onOpen: (id: string) => void;
  onRetry: () => void;
}

const HIDDEN_KEYS = { follow_up: 'history.thread.hidden.follow_up', clarification: 'history.thread.hidden.clarification' } as const;

export function ThreadBlockView({ question, parent, children, onOpen, onRetry }: ThreadBlockViewProps) {
  const t = useT();
  const titleId = useId();
  const relation = question.relation;
  const loading = parent.kind === 'loading' || children.kind === 'loading';
  const failed = parent.kind === 'error' || children.kind === 'error';
  const kids = children.kind === 'ready' ? children.value : [];
  // Without a relation the block appears only once children are known to exist; with one it holds its place.
  if (relation === undefined && (loading || failed || kids.length === 0)) return null;

  return (
    <section data-testid="history-thread" aria-labelledby={titleId} className="mb-4 rounded-md border border-line px-3 py-3">
      <h3 id={titleId} className="hv-label mb-2">{t('history.thread.title')}</h3>
      {loading ? (
        // A fixed height, so the timeline below does not jump when the block has loaded (design principle 8).
        <div data-testid="history-thread-loading" role="status" aria-busy="true" className="grid h-20 gap-2">
          <span className="sr-only">{t('history.thread.loading')}</span>
          <div aria-hidden="true" className="h-8 animate-pulse rounded-sm bg-ink-50" />
          <div aria-hidden="true" className="h-8 animate-pulse rounded-sm bg-ink-50" />
        </div>
      ) : failed ? (
        <div className="flex items-center gap-3">
          <p className="text-[13px] text-ink-600">{t('history.thread.error')}</p>
          <Button size="sm" variant="secondary" data-testid="history-thread-retry" onClick={onRetry}>{t('common.retry')}</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {relation !== undefined && (
            parent.kind === 'ready' ? (
              <div className="grid gap-1">
                <span className="text-2xs text-ink-600">{t('history.thread.parent')}</span>
                <button
                  type="button"
                  data-testid="history-thread-parent"
                  onClick={() => onOpen(parent.value.id)}
                  className="flex items-center gap-2 rounded-sm text-left hover:bg-ink-25"
                >
                  <Badge tone="neutral">
                    <span className="inline-flex items-center gap-1">
                      <CornerDownRight size={12} strokeWidth={1.75} aria-hidden="true" />
                      {relationLabel(t, relation, parent.value.number)}
                    </span>
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">{excerpt(parent.value.text)}</span>
                  <StatusBadge status={parent.value.status} />
                </button>
                {question.parentAnswerVersion !== undefined && (
                  <span data-testid="history-thread-answer-version" className="text-2xs text-ink-600">
                    {t('history.thread.answerVersion')}{' '}
                    <span className="font-mono tabular-nums">{question.parentAnswerVersion}</span>
                  </span>
                )}
              </div>
            ) : (
              <p data-testid="history-thread-hidden" className="text-[13px] text-ink-700">
                {Object.hasOwn(HIDDEN_KEYS, relation) ? t(HIDDEN_KEYS[relation]) : relation}
              </p>
            )
          )}
          {kids.length > 0 && (
            <div className="grid gap-1">
              <span className="text-2xs text-ink-600">{t('history.thread.children', { count: kids.length })}</span>
              <ul className="grid gap-1">
                {kids.map((kid) => (
                  <li key={kid.id}>
                    <button
                      type="button"
                      data-testid="history-thread-child"
                      data-number={kid.number}
                      onClick={() => onOpen(kid.id)}
                      className="flex w-full items-center gap-2 rounded-sm text-left hover:bg-ink-25"
                    >
                      <span className="font-mono text-2xs tabular-nums text-ink-600">{kid.number}</span>
                      {kid.relation !== undefined && <Badge tone="neutral">{relationLabel(t, kid.relation)}</Badge>}
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">{excerpt(kid.text)}</span>
                      <StatusBadge status={kid.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** The block with its two reads; reloads with every change of the store (`useApiVersion`) and on "Erneut versuchen". */
export function ThreadBlock({ question, onOpen }: { question: Question; onOpen: (id: string) => void }) {
  const version = useApiVersion();
  const [attempt, setAttempt] = useState(0);
  const { parentId, childrenOf } = threadReads(question);
  const key = `${version}:${attempt}:${childrenOf}:${parentId ?? ''}`;
  const [state, setState] = useState<{ key: string; parent: Load<Question>; children: Load<readonly Question[]> } | null>(null);

  useEffect(() => {
    let live = true;
    const parent: Promise<Load<Question>> = parentId === undefined
      ? Promise.resolve({ kind: 'none' })
      : api.getQuestion(parentId).then((value) => ({ kind: 'ready', value }), () => ({ kind: 'error' }));
    const children: Promise<Load<readonly Question[]>> = api.listQuestions({ parentQuestionId: childrenOf })
      .then(({ items }) => ({ kind: 'ready', value: items }), () => ({ kind: 'error' }));
    void Promise.all([parent, children]).then(([p, c]) => { if (live) setState({ key, parent: p, children: c }); });
    return () => { live = false; };
  }, [key, parentId, childrenOf]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // The previous result stays while a reload of the same question runs, so nothing flickers on a store change.
  const shown = state !== null && state.key.endsWith(`:${childrenOf}:${parentId ?? ''}`) ? state : null;
  return (
    <ThreadBlockView
      question={question}
      parent={shown?.parent ?? (parentId === undefined ? { kind: 'none' } : { kind: 'loading' })}
      children={shown?.children ?? { kind: 'loading' }}
      onOpen={onOpen}
      onRetry={retry}
    />
  );
}
