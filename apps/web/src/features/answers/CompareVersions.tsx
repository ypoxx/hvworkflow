/**
 * Scheibe 060 (decision 7): "Fassungen vergleichen" — one's own unsaved text next to the version someone else saved while
 * it was written. It stands where the answer field stands, in the same frame; nothing here writes. Exactly one primary
 * action ("Mit meiner Fassung weiter", D2), "Version n übernehmen" with what it costs, "Zurück zum Text" and Escape.
 *
 * Both columns render through `AnswerText` only (no other sink): the left one the preview of the input form the field
 * holds, the right one the stored document of the version (nit N1). The right column follows live updates without moving
 * the focus; a polite live region at its heading says the new number. The word diff is computed only while its
 * `<details>` is open (nit N2: `wordDiff` needs memory of the order n·m).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AnswerBodyInput, AnswerVersion } from '@hv/domain';
import { answerBodyOf, previewAnswer, previewText } from '../../api/answerFormat';
import { AnswerText, Badge, Button } from '../../components';
import { useT } from '../../i18n';
import { clockTime, splitSources, wordDiff } from './lib';
import { refusalKindOf } from './refusal';

/** Escape returns to the text; `preventDefault` keeps the writing mode open (`shouldLeaveWriting` reads it). */
export function compareKeyDown(event: { key: string; preventDefault: () => void }, onBack: () => void): void {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  onBack();
}

/** A sentence with placeholders, the named ones replaced by nodes (version and time in mono, D5). */
function fill(template: string, parts: Readonly<Record<string, ReactNode>>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((piece, index) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return name !== undefined && name in parts ? <span key={index}>{parts[name]}</span> : piece;
  });
}

function Sources({ sources }: { sources: readonly string[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {sources.map((source) => (
        <Badge key={source} tone="outline">
          {source}
        </Badge>
      ))}
    </div>
  );
}

function WordDiff({ from, to }: { from: string; to: string }) {
  const parts = useMemo(() => wordDiff(from, to), [from, to]);
  return (
    <p className="mt-2 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
      {parts.map((part, index) =>
        part.type === 'equal' ? (
          <span key={index}>{part.text} </span>
        ) : (
          <span
            key={index}
            className={part.type === 'removed' ? 'line-through' : 'underline'}
            style={part.type === 'removed'
              ? { backgroundColor: 'var(--color-tone-danger-bg)', color: 'var(--color-tone-danger-fg)' }
              : { backgroundColor: 'var(--color-tone-success-bg)', color: 'var(--color-tone-success-fg)' }}
          >
            {part.text}{' '}
          </span>
        ),
      )}
    </p>
  );
}

export interface CompareVersionsProps {
  /** What the field holds (input form) and its sources line. */
  mine: { body: AnswerBodyInput | null; sources: string };
  /** The version the right column shows: the newest of the record, followed live. */
  theirs: AnswerVersion;
  /** Opened by an act of the person: the focus goes to the heading (never on a live update). */
  autoFocus: boolean;
  onKeepMine: (shownVersion: number) => void;
  onTakeTheirs: (shownVersion: number) => void;
  onBack: () => void;
  /** The diff starts open (tests only; the person opens it). */
  initialDiffOpen?: boolean;
}

export function CompareVersions({ mine, theirs, autoFocus, onKeepMine, onTakeTheirs, onBack, initialDiffOpen = false }: CompareVersionsProps) {
  const t = useT();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const hintId = useId();
  const [diffOpen, setDiffOpen] = useState(initialDiffOpen);
  // Only when it opens (the value at mount): a live update of the right column never moves the focus (D8).
  const focusOnOpen = useRef(autoFocus);
  useEffect(() => {
    if (focusOnOpen.current) titleRef.current?.focus();
  }, []);

  const mineBody = previewAnswer(mine.body);
  const mineText = previewText(mine.body);
  const refusal = refusalKindOf(theirs) !== 'answer';
  const theirsBody = refusal ? null : answerBodyOf(theirs);
  const theirsText = refusal ? '' : theirs.text;
  const author = theirs.createdBy.displayName ?? theirs.createdBy.id;
  const mono = (value: string | number) => <span className="font-mono tabular-nums">{value}</span>;

  return (
    <section
      data-testid="compare-versions"
      onKeyDown={(event) => compareKeyDown(event, onBack)}
      className="rounded-lg border border-line-strong bg-sunken p-3"
    >
      <h3 ref={titleRef} data-testid="compare-title" tabIndex={-1} className="text-[13px] font-semibold text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-accent-600">
        {t('answers.compare.title')}
      </h3>
      <p className="mt-0.5 text-[13px] text-ink-700">{t('answers.compare.intro', { version: theirs.version })}</p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div data-testid="compare-mine" className="min-w-0 rounded-md border border-line bg-surface px-3 py-2.5">
          <span className="hv-label">{t('answers.compare.mine')}</span>
          <AnswerText answer={{ text: mineText, ...(mineBody !== null ? { body: mineBody } : {}) }} className="mt-1 text-[13px] leading-relaxed text-ink-800 select-text" />
          <Sources sources={splitSources(mine.sources)} />
        </div>
        <div data-testid="compare-theirs" className="min-w-0 rounded-md border border-line bg-surface px-3 py-2.5">
          <span data-testid="compare-theirs-head" aria-live="polite" className="hv-label">
            {fill(t('answers.compare.theirs'), {
              version: mono(theirs.version),
              author,
              time: mono(clockTime(theirs.createdAt)),
            })}
          </span>
          {refusal ? (
            <p className="mt-1 rounded-md border border-line-strong bg-ink-50 px-3 py-2 text-[13px] text-ink-700">
              {t('answers.refusal.editorHint')}
            </p>
          ) : (
            <>
              <AnswerText answer={{ text: theirsText, ...(theirsBody !== null ? { body: theirsBody } : {}) }} className="mt-1 text-[13px] leading-relaxed text-ink-800 select-text" />
              <Sources sources={theirs.sources ?? []} />
            </>
          )}
        </div>
      </div>

      <details
        data-testid="compare-diff"
        open={diffOpen}
        onToggle={(event) => setDiffOpen((event.currentTarget as HTMLDetailsElement).open)}
        className="mt-3"
      >
        <summary className="cursor-pointer text-2xs font-medium text-ink-600">{t('answers.compare.diff')}</summary>
        {diffOpen && <WordDiff from={theirsText} to={mineText} />}
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" data-testid="compare-back" onClick={onBack}>
          {t('answers.compare.back')}
        </Button>
        <span className="flex-1" />
        <span className="flex flex-col items-end gap-1">
          <Button size="sm" variant="secondary" data-testid="compare-take-theirs" aria-describedby={hintId} onClick={() => onTakeTheirs(theirs.version)}>
            {t('answers.compare.takeTheirs', { version: theirs.version })}
          </Button>
          <span id={hintId} className="text-2xs text-ink-600">
            {t('answers.compare.takeTheirsHint')}
          </span>
        </span>
        <Button size="sm" variant="primary" data-testid="compare-keep-mine" onClick={() => onKeepMine(theirs.version)}>
          {t('answers.compare.keepMine')}
        </Button>
      </div>
    </section>
  );
}
