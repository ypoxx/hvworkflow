/**
 * Scheibe 055b (decisions 4 and 8): the editing commands of the answer field — the only place of the interface that
 * calls `document.execCommand`. The command is deprecated without a replacement; keeping every call here keeps it
 * replaceable (a library would be owner question 2). It is used only for what the browser does well on the field's own
 * nodes: toggling bold, italic, the highlight's background and the bulleted list, and deleting a selection before a
 * paste. It never inserts markup (`insertHTML` is forbidden, Semgrep `no-html-sink`).
 *
 * The pure helpers — `formatChord` (which key press is which command) and `allowedInputType` (which `beforeinput` the
 * field lets the browser perform) — are tested without a DOM (Test 3).
 */

export type FormatCommand = 'bold' | 'italic' | 'highlight' | 'list';

/** `aria-keyshortcuts` of the four toggles (Word-like; owner question 3). */
export const FORMAT_SHORTCUTS: Readonly<Record<FormatCommand, string>> = {
  bold: 'Control+B Meta+B',
  italic: 'Control+I Meta+I',
  highlight: 'Control+Shift+H Meta+Shift+H',
  list: 'Control+Shift+L Meta+Shift+L',
};

/**
 * The format command of a key press: Ctrl or Cmd with B or I (without Shift), with Shift and H or L; `'blocked'` for
 * Ctrl/Cmd+U (there is no underline in the house format, and the browser's would vanish on saving); otherwise `null`.
 * Never with Alt or AltGr (German keyboards: AltGr is Ctrl+Alt), never while an input method composes. Enter is
 * `isSaveChord`'s, never ours.
 */
export function formatChord(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
  altGraph?: boolean;
}): FormatCommand | 'blocked' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.altGraph === true || event.isComposing === true) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : '';
  if (key === 'u') return 'blocked';
  if (!event.shiftKey && key === 'b') return 'bold';
  if (!event.shiftKey && key === 'i') return 'italic';
  if (event.shiftKey && key === 'h') return 'highlight';
  if (event.shiftKey && key === 'l') return 'list';
  return null;
}

/**
 * The `beforeinput` types the field lets the browser perform: typing, input methods, line and paragraph breaks,
 * deleting, undo and redo, and the three formats the house knows. Everything else is prevented — underline, strike,
 * fonts, colours, alignment, indent, text direction (bidi), links, ordered lists, rules — so the field never shows a
 * formatting that saving would drop. Paste and drop are the field's own (`insertFromPaste`/`insertFromDrop` never pass).
 */
const ALLOWED_INPUT_TYPES: ReadonlySet<string> = new Set([
  'insertText', 'insertReplacementText', 'insertCompositionText', 'insertFromComposition', 'insertParagraph',
  'insertLineBreak', 'insertFromYank', 'insertTranspose',
  'deleteWordBackward', 'deleteWordForward', 'deleteSoftLineBackward', 'deleteSoftLineForward', 'deleteEntireSoftLine',
  'deleteHardLineBackward', 'deleteHardLineForward', 'deleteByDrag', 'deleteByCut', 'deleteContent',
  'deleteContentBackward', 'deleteContentForward', 'deleteByComposition', 'deleteCompositionText',
  'historyUndo', 'historyRedo', 'formatBold', 'formatItalic', 'insertUnorderedList',
]);

export function allowedInputType(inputType: string): boolean {
  return ALLOWED_INPUT_TYPES.has(inputType);
}

/** Input types that are typing (with the deletions they count as editing for `UndoBudget`). */
const TYPING: ReadonlySet<string> = new Set([
  'insertText', 'insertReplacementText', 'insertCompositionText', 'insertFromComposition', 'insertParagraph', 'insertLineBreak',
]);

/** Once per page: no inline CSS from the bold and italic commands, paragraphs (not `div`) on Enter. */
export function prepareEditing(doc: Document): void {
  doc.execCommand('styleWithCSS', false, 'false');
  doc.execCommand('defaultParagraphSeparator', false, 'p');
}

/**
 * Runs one format command on the current selection of the field. The highlight is the browser's `hiliteColor` with the
 * computed value of `--color-tone-warning-bg`, and `transparent` to take it away (`active`: the selection carries it).
 */
export function runFormat(doc: Document, command: FormatCommand, highlight: string, active: boolean): void {
  if (command === 'bold') doc.execCommand('bold');
  else if (command === 'italic') doc.execCommand('italic');
  else if (command === 'list') doc.execCommand('insertUnorderedList');
  else doc.execCommand('hiliteColor', false, active ? 'transparent' : highlight);
}

/** Deletes the selection the way the browser does (blocks joined), before a paste or drop lands at the caret. */
export function deleteSelection(doc: Document): void {
  doc.execCommand('delete');
}

/** Input types that change the text without being undo or redo: they continue or start a step of the browser's undo. */
const EDITING = (inputType: string): boolean => TYPING.has(inputType) || inputType.startsWith('delete');

/**
 * Decision 5, "Schutz des Rückgängig", as before-build point 4 found it in Chromium: after the field rebuilt its content
 * by script (paste, drop, a new version), the browser's undo history still holds steps on nodes that are gone; undoing
 * into them and redoing produced a state that never was (text doubled). So undo and redo are allowed only within the
 * steps made since the last rebuild, counted from below: one per run of typing (the browser may split a run into more
 * steps, never fewer) and one per format command that changed a selection. Undoing past them is prevented — nothing is
 * lost, only the paste itself cannot be undone (055c brings that).
 */
export class UndoBudget {
  private undoable = 0;
  private redoable = 0;
  private typing = false;

  /** The field's content was replaced by script: nothing before it may be undone. */
  rebuilt(): void {
    this.undoable = 0;
    this.redoable = 0;
    this.typing = false;
  }

  /** The caret moved or the field lost focus: the next typing starts a new step. */
  interrupt(): void {
    this.typing = false;
  }

  /** A format command ran; `changed` when it changed the text's nodes (a selection, or the list). */
  formatted(changed: boolean): void {
    this.typing = false;
    if (!changed) return;
    this.undoable += 1;
    this.redoable = 0;
  }

  /** Whether the browser may perform this allowed `beforeinput`; counts the steps as it goes. */
  allows(inputType: string): boolean {
    if (inputType === 'historyUndo') {
      this.typing = false;
      if (this.undoable === 0) return false;
      this.undoable -= 1;
      this.redoable += 1;
      return true;
    }
    if (inputType === 'historyRedo') {
      this.typing = false;
      if (this.redoable === 0) return false;
      this.redoable -= 1;
      this.undoable += 1;
      return true;
    }
    if (EDITING(inputType)) {
      if (!this.typing) this.undoable += 1;
      this.typing = true;
      this.redoable = 0;
    } else if (inputType === 'formatBold' || inputType === 'formatItalic' || inputType === 'insertUnorderedList') {
      this.formatted(true);
    }
    return true;
  }
}
