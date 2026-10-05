/**
 * Scheibe 055b, Test 3: the pure parts of the editing commands. `formatChord` maps a key press to one of the four
 * format commands, `'blocked'` for Ctrl+U (no underline in the house format) or `null`; never with Alt or AltGr (German
 * keyboards: AltGr is Ctrl+Alt), never while an input method composes, letters in either case. `allowedInputType` is
 * the allowlist of `beforeinput`: everything else is prevented, paste and drop go through the field's own handler.
 */
import { describe, expect, it } from 'vitest';
import { FORMAT_SHORTCUTS, UndoBudget, allowedInputType, formatChord } from './editorCommands';

const key = (k: string, over: Partial<Parameters<typeof formatChord>[0]> = {}) =>
  formatChord({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over });

describe('formatChord (Test 3)', () => {
  it('Ctrl and Cmd with B, I; with Shift H and L; upper and lower case', () => {
    for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
      expect(key('b', mod)).toBe('bold');
      expect(key('B', mod)).toBe('bold');
      expect(key('i', mod)).toBe('italic');
      expect(key('I', mod)).toBe('italic');
      expect(key('H', { ...mod, shiftKey: true })).toBe('highlight');
      expect(key('h', { ...mod, shiftKey: true })).toBe('highlight');
      expect(key('L', { ...mod, shiftKey: true })).toBe('list');
      expect(key('l', { ...mod, shiftKey: true })).toBe('list');
      expect(key('u', mod)).toBe('blocked');
      expect(key('U', { ...mod, shiftKey: true })).toBe('blocked');
    }
  });

  it('H and L need Shift; B and I with Shift are nothing of ours', () => {
    expect(key('h', { ctrlKey: true })).toBeNull();
    expect(key('l', { ctrlKey: true })).toBeNull();
    expect(key('B', { ctrlKey: true, shiftKey: true })).toBeNull();
    expect(key('I', { ctrlKey: true, shiftKey: true })).toBeNull();
  });

  it('null with Alt, with AltGr, while composing, without a modifier, for Enter', () => {
    expect(key('b', { ctrlKey: true, altKey: true })).toBeNull();
    expect(key('b', { ctrlKey: true, altGraph: true })).toBeNull();
    expect(key('u', { ctrlKey: true, altKey: true })).toBeNull();
    expect(key('b', { ctrlKey: true, isComposing: true })).toBeNull();
    expect(key('b')).toBeNull();
    expect(key('Enter', { ctrlKey: true })).toBeNull();
    expect(key('Enter', { metaKey: true })).toBeNull();
  });

  it('the shortcuts named for aria-keyshortcuts', () => {
    expect(FORMAT_SHORTCUTS).toEqual({
      bold: 'Control+B Meta+B',
      italic: 'Control+I Meta+I',
      highlight: 'Control+Shift+H Meta+Shift+H',
      list: 'Control+Shift+L Meta+Shift+L',
    });
  });
});

describe('allowedInputType (Test 3)', () => {
  it('the allowlist of decision 4', () => {
    for (const type of [
      'insertText', 'insertReplacementText', 'insertCompositionText', 'insertFromComposition', 'insertParagraph',
      'insertLineBreak', 'insertFromYank', 'insertTranspose', 'deleteContentBackward', 'deleteContentForward',
      'deleteWordBackward', 'deleteWordForward', 'deleteSoftLineBackward', 'deleteHardLineForward', 'deleteByCut',
      'deleteByDrag', 'deleteContent', 'deleteEntireSoftLine', 'deleteByComposition', 'deleteCompositionText',
      'historyUndo', 'historyRedo', 'formatBold', 'formatItalic', 'insertUnorderedList',
    ]) {
      expect(allowedInputType(type), type).toBe(true);
    }
  });

  it('everything else is prevented', () => {
    for (const type of [
      'formatUnderline', 'formatStrikeThrough', 'formatSuperscript', 'formatFontName', 'formatFontColor', 'formatBackColor',
      'formatJustifyCenter', 'formatIndent', 'formatOutdent', 'formatRemove', 'formatSetBlockTextDirection',
      'formatSetInlineTextDirection', 'insertLink', 'insertOrderedList', 'insertHorizontalRule', 'insertFromPaste',
      'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYankX', 'deletex', '', 'unknownType',
    ]) {
      expect(allowedInputType(type), type).toBe(false);
    }
  });
});

describe('UndoBudget (decision 5, before-build point 4)', () => {
  it('after a rebuild nothing can be undone or redone', () => {
    const budget = new UndoBudget();
    budget.rebuilt();
    expect(budget.allows('historyUndo')).toBe(false);
    expect(budget.allows('historyRedo')).toBe(false);
  });

  it('one run of typing is one step; undo once, then the rebuild is the wall; redo what was undone', () => {
    const budget = new UndoBudget();
    budget.rebuilt();
    for (const type of ['insertText', 'insertText', 'deleteContentBackward', 'insertParagraph']) expect(budget.allows(type)).toBe(true);
    expect(budget.allows('historyUndo')).toBe(true);
    expect(budget.allows('historyUndo')).toBe(false);
    expect(budget.allows('historyRedo')).toBe(true);
    expect(budget.allows('historyRedo')).toBe(false);
  });

  it('an interruption starts a new step; a format command on a selection is a step, on a caret not; new typing drops redo', () => {
    const budget = new UndoBudget();
    budget.rebuilt();
    budget.allows('insertText');
    budget.interrupt();
    budget.allows('insertText');
    budget.formatted(true);
    budget.formatted(false);
    expect(budget.allows('historyUndo')).toBe(true);
    expect(budget.allows('historyUndo')).toBe(true);
    expect(budget.allows('historyUndo')).toBe(true);
    expect(budget.allows('historyUndo')).toBe(false);
    budget.allows('insertText');
    expect(budget.allows('historyRedo')).toBe(false);
  });
});
