/**
 * Scheibe 055b (decisions 3–5 and 8): the answer field (Feld) — a minimal `contenteditable` area with a narrow toolbar,
 * used in the writing mode (`size="large"`) and in the Beantwortung (`size="compact"`). Who writes sees what the podium
 * shows: bold, italic, highlight and a bulleted list, nothing else (the house format, ADR 0005).
 *
 * The field is only an input surface. Its DOM is the source of nothing but its own draft: after every input the walker
 * (`domToBodyInput`) reads it into the open input form, which the page sends; the core normalises it (055). The content
 * is built from `initial` by `bodyToDom` on the first render and whenever `generation` changes, never by React children
 * (the browser edits the nodes; React must not reconcile them). Otherwise the field is uncontrolled: saving does not
 * rebuild it, and caret and content stay (055 "Entwurf" point 8).
 *
 * What the browser may do is an allowlist (`allowedInputType`); paste and drop are always the field's own: pasted HTML is
 * parsed into an inert document and read by the walker (`parseClipboardHtml`), and only new nodes of the field's six
 * kinds enter the live document — no HTML sink anywhere (Semgrep `no-html-sink`). The editing commands live in
 * `editorCommands.ts` alone.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Bold, Highlighter, Italic, List } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AnswerBodyInput } from '@hv/domain';
import { previewText } from '../../api/answerFormat';
import { cx } from '../../components';
import { useT } from '../../i18n';
import type { TKey } from '../../i18n';
import {
  HIGHLIGHT_FALLBACK,
  bodyToDom,
  caretTarget,
  clipboardInput,
  domToBodyInput,
  marksAt,
  spliceAtCaret,
} from './domToBody';
import type { ModelCaret } from './domToBody';
import { FORMAT_SHORTCUTS, UndoBudget, allowedInputType, deleteSelection, formatChord, prepareEditing, runFormat } from './editorCommands';
import type { FormatCommand } from './editorCommands';

interface FormatButton {
  command: FormatCommand;
  testId: string;
  label: TKey;
  icon: LucideIcon;
}

const BUTTONS: readonly FormatButton[] = [
  { command: 'bold', testId: 'format-bold', label: 'answers.format.bold', icon: Bold },
  { command: 'italic', testId: 'format-italic', label: 'answers.format.italic', icon: Italic },
  { command: 'highlight', testId: 'format-highlight', label: 'answers.format.highlight', icon: Highlighter },
  { command: 'list', testId: 'format-list', label: 'answers.format.list', icon: List },
];

type Pressed = Readonly<Record<FormatCommand, boolean>>;
const NOT_PRESSED: Pressed = { bold: false, italic: false, highlight: false, list: false };
const samePressed = (a: Pressed, b: Pressed): boolean => BUTTONS.every(({ command }) => a[command] === b[command]);

const NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/** The computed highlight token (`--color-tone-warning-bg`), the one colour the field writes. */
function highlightColor(field: HTMLElement): string {
  return getComputedStyle(field).getPropertyValue('--color-tone-warning-bg').trim() || HIGHLIGHT_FALLBACK;
}

/** The end of the field's last piece: where the caret goes when the writing mode opens (054 decision 5). */
function endOf(field: HTMLElement): ModelCaret {
  const last = field.childNodes.length - 1;
  const block = field.childNodes[last];
  const items = block !== undefined && block.nodeName === 'UL' ? block.childNodes.length - 1 : null;
  return { block: Math.max(0, last), item: items, offset: Number.MAX_SAFE_INTEGER };
}

function placeCaret(field: HTMLElement, caret: ModelCaret): void {
  const selection = document.getSelection();
  if (selection === null) return;
  const target = caretTarget(field, caret);
  selection.collapse(target.node as Node, target.offset);
}

function selectionIn(field: HTMLElement): Selection | null {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;
  return field.contains(selection.anchorNode) ? selection : null;
}

export interface AnswerBodyEditorProps {
  testId: string;
  /** The stored or input form the field starts from; `null` for an empty field. */
  initial: AnswerBodyInput | null;
  /** The field rebuilds from `initial` on the first render and when this changes (decision 4). */
  generation: number;
  /** The id of the visible label (`answers.editor.label`). */
  labelId: string;
  /** Further descriptions of the field, after the keys and the hint. */
  describedBy?: string;
  size: 'large' | 'compact';
  onChange: (input: AnswerBodyInput | null) => void;
  /** Every key the field does not consume itself (Ctrl+Enter and Escape always go through). */
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  /** Focus the field with the caret at its end once it is built (the writing mode, 054 decision 5). */
  autoFocusEnd?: boolean;
  className?: string;
}

export function AnswerBodyEditor({
  testId,
  initial,
  generation,
  labelId,
  describedBy,
  size,
  onChange,
  onKeyDown,
  autoFocusEnd = false,
  className,
}: AnswerBodyEditorProps) {
  const t = useT();
  const baseId = useId();
  const fieldId = `${baseId}-field`;
  const keysId = `${baseId}-keys`;
  const hintId = `${baseId}-hint`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const builtGeneration = useRef<number | null>(null);
  const savedRange = useRef<Range | null>(null);
  const budget = useRef(new UndoBudget());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [empty, setEmpty] = useState(() => previewText(initial) === '');
  const [pressed, setPressed] = useState<Pressed>(NOT_PRESSED);
  const [activeButton, setActiveButton] = useState(0);

  /** The walker reads the field after every change; an empty field reports `null`. */
  const emit = (): void => {
    const field = fieldRef.current;
    if (field === null) return;
    setEmpty(field.textContent === '');
    onChangeRef.current(domToBodyInput(field));
  };

  const updatePressed = (): void => {
    const field = fieldRef.current;
    if (field === null) return;
    const selection = selectionIn(field);
    if (selection === null) return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
    const next = marksAt(selection.anchorNode as Node, field);
    setPressed((previous) => (samePressed(previous, next) ? previous : next));
  };

  // Built from `initial` on the first render and when `generation` changes — never on another render.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (field === null || builtGeneration.current === generation) return;
    const first = builtGeneration.current === null;
    builtGeneration.current = generation;
    field.replaceChildren(...bodyToDom(document, initial, highlightColor(field)));
    budget.current.rebuilt();
    setEmpty(field.textContent === '');
    if (first && autoFocusEnd) {
      prepareEditing(document);
      field.focus();
      placeCaret(field, endOf(field));
    }
  }, [generation, initial, autoFocusEnd]);

  // Native listeners: React's `onBeforeInput` carries no `inputType`, and paste and drop must be taken before the browser.
  useEffect(() => {
    const field = fieldRef.current;
    if (field === null) return;

    const onBeforeInput = (event: InputEvent): void => {
      if (!allowedInputType(event.inputType) || !budget.current.allows(event.inputType)) event.preventDefault();
    };

    /** Paste and drop: read, splice into the model at the caret, rebuild the whole field once (decision 5). */
    const insertTransfer = (data: DataTransfer | null, at: { x: number; y: number } | null): void => {
      if (data === null) return;
      const pasted = clipboardInput(data.getData('text/html'), data.getData('text/plain'));
      // Only files or images: nothing is inserted.
      if (pasted === null) return;
      const selection = document.getSelection();
      if (selection === null) return;
      if (at !== null) {
        const point = document.caretPositionFromPoint?.(at.x, at.y);
        const range = point !== null && point !== undefined ? null : document.caretRangeFromPoint?.(at.x, at.y);
        const node = point?.offsetNode ?? range?.startContainer;
        const offset = point?.offset ?? range?.startOffset ?? 0;
        if (node !== undefined && field.contains(node)) selection.collapse(node, offset);
      }
      if (selectionIn(field) === null) placeCaret(field, endOf(field));
      if (!selection.isCollapsed) deleteSelection(document);
      if (selection.rangeCount === 0) return;
      // The caret is an empty node of our own, found by identity in the walk (review 055b, finding 1), never by text.
      const caretNode = document.createTextNode('');
      selection.getRangeAt(0).insertNode(caretNode);
      const spliced = spliceAtCaret(domToBodyInput(field, caretNode), pasted);
      if (spliced === null) {
        caretNode.remove();
        return;
      }
      field.replaceChildren(...bodyToDom(document, spliced.body, highlightColor(field)));
      placeCaret(field, spliced.caret);
      budget.current.rebuilt();
      emit();
      updatePressed();
    };

    const onPaste = (event: ClipboardEvent): void => {
      event.preventDefault();
      insertTransfer(event.clipboardData, null);
    };
    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      field.focus();
      insertTransfer(event.dataTransfer, { x: event.clientX, y: event.clientY });
    };
    // Dragging within the field is off; dropping from outside goes through `onDrop`.
    const onDragStart = (event: DragEvent): void => event.preventDefault();
    const onMouseDown = (): void => budget.current.interrupt();
    const onSelectionChange = (): void => updatePressed();

    field.addEventListener('beforeinput', onBeforeInput);
    field.addEventListener('paste', onPaste);
    field.addEventListener('drop', onDrop);
    field.addEventListener('dragstart', onDragStart);
    field.addEventListener('mousedown', onMouseDown);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      field.removeEventListener('beforeinput', onBeforeInput);
      field.removeEventListener('paste', onPaste);
      field.removeEventListener('drop', onDrop);
      field.removeEventListener('dragstart', onDragStart);
      field.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
    // The handlers read refs and stable setters only (empty list of dependencies on purpose).
  }, []);

  /** Runs a format command on the selection in the field (restored when the toolbar had the focus). */
  const apply = (command: FormatCommand): void => {
    const field = fieldRef.current;
    if (field === null) return;
    if (document.activeElement !== field) field.focus();
    let selection = selectionIn(field);
    if (selection === null && savedRange.current !== null && field.contains(savedRange.current.startContainer)) {
      const restored = document.getSelection();
      restored?.removeAllRanges();
      restored?.addRange(savedRange.current);
      selection = selectionIn(field);
    }
    if (selection === null) {
      placeCaret(field, endOf(field));
      selection = selectionIn(field);
    }
    if (selection === null) return;
    const collapsed = selection.isCollapsed;
    const before = marksAt(selection.anchorNode as Node, field);
    prepareEditing(document);
    runFormat(document, command, highlightColor(field), command === 'highlight' && before.highlight);
    budget.current.formatted(command === 'list' || !collapsed);
    emit();
    updatePressed();
  };

  const onFieldKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const chord = formatChord({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
      altGraph: event.getModifierState('AltGraph'),
    });
    if (chord === 'blocked') {
      event.preventDefault();
      return;
    }
    if (chord !== null) {
      event.preventDefault();
      apply(chord);
      return;
    }
    if (NAVIGATION_KEYS.has(event.key)) budget.current.interrupt();
    onKeyDown?.(event);
  };

  /** One tab stop for the toolbar; arrows, Home and End move within it (decision 4, D8). */
  const onToolbarKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const last = BUTTONS.length - 1;
    const next =
      event.key === 'ArrowRight' ? (activeButton === last ? 0 : activeButton + 1)
        : event.key === 'ArrowLeft' ? (activeButton === 0 ? last : activeButton - 1)
          : event.key === 'Home' ? 0
            : event.key === 'End' ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActiveButton(next);
    buttonRefs.current[next]?.focus();
  };

  // A mouse press on a toggle keeps the focus (and the selection) in the field.
  const keepFocus = (event: ReactMouseEvent<HTMLButtonElement>): void => event.preventDefault();

  const large = size === 'large';
  return (
    <div className={cx('flex min-h-0 flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div
          role="toolbar"
          aria-label={t('answers.format.toolbar')}
          aria-controls={fieldId}
          onKeyDown={onToolbarKeyDown}
          className="flex items-center gap-1"
        >
          {BUTTONS.map(({ command, testId: buttonTestId, label, icon: Icon }, index) => (
            <button
              key={command}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              type="button"
              data-testid={buttonTestId}
              tabIndex={index === activeButton ? 0 : -1}
              aria-pressed={pressed[command]}
              aria-label={t(label)}
              title={t(label)}
              aria-keyshortcuts={FORMAT_SHORTCUTS[command]}
              onMouseDown={keepFocus}
              onFocus={() => setActiveButton(index)}
              onClick={() => apply(command)}
              className={cx(
                'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-100',
                pressed[command]
                  ? 'border-line-strong bg-ink-100 text-ink-900'
                  : 'border-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              <Icon size={15} strokeWidth={pressed[command] ? 2.25 : 1.75} aria-hidden="true" />
            </button>
          ))}
        </div>
        <span id={hintId} className="text-2xs text-ink-600">
          {t('answers.format.hint')}
        </span>
      </div>
      <div className={cx('relative flex min-h-0 flex-col', large && 'flex-1')}>
        {empty && (
          <span
            aria-hidden="true"
            data-testid={`${testId}-placeholder`}
            className={cx(
              'pointer-events-none absolute text-ink-600',
              large ? 'left-3 top-2.5 text-[15px] leading-relaxed' : 'left-2.5 top-2 text-[13px] leading-relaxed',
            )}
          >
            {t('answers.editor.placeholder')}
          </span>
        )}
        <div
          ref={fieldRef}
          id={fieldId}
          data-testid={testId}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelId}
          aria-describedby={[keysId, hintId, describedBy].filter((id) => id !== undefined && id !== '').join(' ')}
          {...(empty ? { 'aria-placeholder': t('answers.editor.placeholder') } : {})}
          lang="de"
          spellCheck
          onInput={emit}
          onKeyDown={onFieldKeyDown}
          onFocus={() => prepareEditing(document)}
          onBlur={() => budget.current.interrupt()}
          className={cx(
            'w-full overflow-y-auto rounded-md border border-line bg-surface text-ink-900 transition-colors duration-100',
            'hover:border-ink-300 [&>*+*]:mt-[0.5em] [&_ul]:list-disc [&_ul]:pl-[1.25em]',
            // D1 (review 055b, finding 6): a highlighted run looks as on the podium, the warning foreground on its ground.
            '[&_span[style*=background-color]]:text-tone-warning-fg',
            large ? 'min-h-[12rem] flex-1 px-3 py-2.5 text-[15px] leading-relaxed' : 'min-h-[8.5rem] px-2.5 py-2 text-[13px] leading-relaxed',
          )}
        />
      </div>
      <span id={keysId} className="text-2xs text-ink-600">
        {t('answers.format.keys')}
      </span>
    </div>
  );
}
