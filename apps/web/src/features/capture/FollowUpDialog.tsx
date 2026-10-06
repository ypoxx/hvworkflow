/**
 * Scheibe 046: the dialog "Bezug setzen" of the capture desk. The person chooses the kind (Nachfrage preselected,
 * or Klarstellung) and finds the referenced question by number or keyword; arrows and Enter choose a hit, Escape
 * closes (the page then returns the focus to the button "Nachfrage zu …"). The search reads only through `HvApi`
 * (`listQuestions`, passed in), so it never shows a question this person may not read.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { Question, QuestionRelation } from '@hv/domain';
import { Button, Dialog, StatusBadge, cx } from '../../components';
import { useLang, useT } from '../../i18n';
import { relationLabel } from '../../i18n/labels';
import { FIELD_CONTROL } from './fields';
import { createFollowUpSearch, moveActive, type FollowUpReference, type SearchState } from './followUp';

/** The relations of contract 0.4.6 in their display order (`QUESTION_RELATIONS` of the domain; type-only import here). */
const RELATIONS: readonly QuestionRelation[] = ['follow_up', 'clarification'];

const excerpt = (text: string, max = 140): string => (text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`);

/** The capture time of a hit as the desk shows times (Berlin), so twins with the same wording can be told apart. */
function timeOf(lang: string, iso: string): string {
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' }).format(new Date(iso));
}

/** Number · speaker · time: the second line of a hit and the confirmation line (design D1). */
function HitMeta({ question, lang, testId }: { question: Question; lang: string; testId?: string }) {
  return (
    <span {...(testId !== undefined ? { 'data-testid': testId } : {})} className="flex items-center gap-1.5 text-[12px] text-ink-600">
      <span className="font-mono tabular-nums">{question.number}</span>
      {question.speakerDisplayName !== undefined && (<><span aria-hidden="true">·</span><span>{question.speakerDisplayName}</span></>)}
      <span aria-hidden="true">·</span>
      <span className="font-mono tabular-nums">{timeOf(lang, question.createdAt)}</span>
    </span>
  );
}

export interface FollowUpPanelProps {
  relation: QuestionRelation;
  onRelation: (relation: QuestionRelation) => void;
  query: string;
  onQuery: (query: string) => void;
  state: SearchState;
  active: number;
  chosenId: string | null;
  onChoose: (question: Question) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onRetry: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/** The body of the dialog, without the modal frame: rendered statically in the unit tests. */
export function FollowUpPanel({ relation, onRelation, query, onQuery, state, active, chosenId, onChoose, onKeyDown, onRetry, inputRef }: FollowUpPanelProps) {
  const t = useT();
  const lang = useLang();
  const ids = useId();
  const items = state.kind === 'results' ? state.items : [];
  const chosen = chosenId === null ? undefined : items.find((question) => question.id === chosenId);
  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-1.5">
        <legend className="hv-label mb-1">{t('capture.followUp.kind')}</legend>
        <div className="flex gap-4">
          {RELATIONS.map((code) => (
            <label key={code} className="flex items-center gap-2 text-[13px] text-ink-800">
              <input
                type="radio"
                name={`${ids}-relation`}
                value={code}
                data-testid={`capture-follow-up-relation-${code}`}
                className="h-3.5 w-3.5 accent-accent-600"
                checked={relation === code}
                onChange={() => onRelation(code)}
              />
              {relationLabel(t, code)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <label htmlFor={`${ids}-search`} className="hv-label">{t('capture.followUp.search')}</label>
        <input
          ref={inputRef}
          id={`${ids}-search`}
          data-testid="capture-follow-up-search"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={`${ids}-hits`}
          aria-autocomplete="list"
          {...(active >= 0 && items[active] !== undefined ? { 'aria-activedescendant': `${ids}-hit-${active}` } : {})}
          className={FIELD_CONTROL}
          value={query}
          autoComplete="off"
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {/* Fixed height for every state, so nothing jumps while the hits arrive (design principle 8). */}
      {/* Focusable, so the hits can also be scrolled with the keyboard (axe scrollable-region-focusable). */}
      <div tabIndex={0} aria-label={t('capture.followUp.search')} className="h-72 overflow-y-auto rounded-md border border-line">
        {state.kind === 'empty' ? (
          <p className="px-3 py-6 text-center text-[13px] text-ink-600">{t('capture.followUp.hint')}</p>
        ) : state.kind === 'loading' ? (
          <div role="status" aria-busy="true" className="grid gap-2 p-3">
            <span className="sr-only">{t('capture.followUp.loading')}</span>
            {[0, 1, 2, 3].map((row) => <div key={row} aria-hidden="true" className="h-12 animate-pulse rounded-sm bg-ink-200" />)}
          </div>
        ) : state.kind === 'none' ? (
          <p className="px-3 py-6 text-center text-[13px] text-ink-600">{t('capture.followUp.none')}</p>
        ) : state.kind === 'error' ? (
          <div className="grid justify-items-center gap-3 px-3 py-6 text-center">
            <p className="text-[13px] text-ink-600">{t('capture.followUp.error')}</p>
            <Button size="sm" variant="secondary" data-testid="capture-follow-up-retry" onClick={onRetry}>{t('common.retry')}</Button>
          </div>
        ) : (
          <ul id={`${ids}-hits`} role="listbox" aria-label={t('capture.followUp.search')}>
            {items.map((question, index) => (
              <li
                key={question.id}
                id={`${ids}-hit-${index}`}
                role="option"
                aria-selected={index === active}
                data-testid="capture-follow-up-hit"
                data-number={question.number}
                data-status={question.status}
                data-chosen={question.id === chosenId ? 'true' : 'false'}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChoose(question)}
                className={cx(
                  // The house selection (Table, WorkList): accent background and a left bar for the active row.
                  'flex cursor-pointer items-start gap-3 border-b border-l-2 border-line px-3 py-2 transition-colors duration-100 last:border-b-0',
                  index === active ? 'border-l-accent-600 bg-accent-50' : 'border-l-transparent hover:bg-ink-50',
                  question.id === chosenId && 'outline outline-2 -outline-offset-2 outline-accent-500',
                )}
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-[13px] leading-5 text-ink-800">{excerpt(question.text)}</span>
                  <HitMeta question={question} lang={lang} testId="capture-follow-up-hit-meta" />
                </span>
                <StatusBadge status={question.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {chosen !== undefined && (
        // Design D1: the reference cannot be changed afterwards (R-LINK-02), so the choice is named before it is set.
        <p data-testid="capture-follow-up-chosen" className="flex items-center gap-2 text-[13px] text-ink-800">
          <span className="font-medium">{t('capture.followUp.chosen')}</span>
          <HitMeta question={chosen} lang={lang} />
        </p>
      )}
    </div>
  );
}

export function FollowUpDialog({
  open,
  onClose,
  onSubmit,
  search,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reference: FollowUpReference) => void;
  search: (query: string) => Promise<readonly Question[]>;
}) {
  const t = useT();
  const [relation, setRelation] = useState<QuestionRelation>('follow_up');
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'empty' });
  const [active, setActive] = useState(-1);
  const [chosen, setChosen] = useState<Question | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const runner = useRef<ReturnType<typeof createFollowUpSearch> | null>(null);
  const searchRef = useRef(search);
  useEffect(() => { searchRef.current = search; }, [search]);

  useEffect(() => {
    if (!open) return undefined;
    const current = createFollowUpSearch((q) => searchRef.current(q), (next) => { setState(next); setActive(-1); });
    runner.current = current;
    // The modal frame focuses its first control after this effect; the search field takes the focus right after.
    const focus = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      clearTimeout(focus);
      current.dispose();
      runner.current = null;
      // Reopening starts fresh.
      setRelation('follow_up');
      setQuery('');
      setState({ kind: 'empty' });
      setActive(-1);
      setChosen(null);
    };
  }, [open]);

  const items = state.kind === 'results' ? state.items : [];
  // The active hit stays in view while the arrows move through a list longer than the box.
  useEffect(() => {
    if (active < 0) return;
    document.querySelector('[data-testid="capture-follow-up-hit"][aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  const submit = (): void => {
    if (chosen === null) return;
    onSubmit({ parentQuestionId: chosen.id, number: chosen.number, relation });
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => moveActive(index, event.key === 'ArrowDown' ? 1 : -1, items.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Enter chooses the active hit; once it is chosen, the next Enter sets the reference (review 10).
      const hit = items[active];
      if (hit !== undefined && hit.id !== chosen?.id) setChosen(hit);
      else if (chosen !== null) submit();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={t('capture.followUp.title')}
      description={t('capture.followUp.description')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" data-testid="capture-follow-up-submit" disabled={chosen === null} onClick={submit}>
            {t('capture.followUp.title')}
          </Button>
        </>
      }
    >
      <FollowUpPanel
        relation={relation}
        onRelation={setRelation}
        query={query}
        onQuery={(value) => { setQuery(value); setChosen(null); runner.current?.update(value); }}
        state={state}
        active={active}
        chosenId={chosen?.id ?? null}
        onChoose={(question) => { setChosen(question); setActive(items.indexOf(question)); }}
        onKeyDown={onKeyDown}
        onRetry={() => runner.current?.retry()}
        inputRef={inputRef}
      />
    </Dialog>
  );
}
