/**
 * Scheibe 055b (decisions 5 and 6): between the answer field's DOM and the answer format of the core (055).
 *
 * `domToBodyInput` (the walker) reads a tree — the field itself, or a document `DOMParser` made from pasted HTML — and
 * maps what it finds to the open input form `AnswerBodyInput`. It never applies the whitelist (055 decision 1): it
 * reports candidates like `underline`, `heading` or `table`, and the core decides when saving. It reads only text
 * (`data`), tag names and the attribute `style`; no other attribute is ever asked for (no `src`, `href`, `srcset`,
 * `poster`, `data`, `background`), and nothing read becomes an attribute of a new node.
 *
 * `bodyToDom` builds the field's own nodes from a stored or input form: only `p`, `ul`, `li`, `b`, `i`, `span` (with the
 * one background colour of the highlight) and text nodes, always new, through the factory it is given. Nothing of a
 * parsed document ever enters the live one (Codex P1 on #156: defence in depth next to test A2b).
 *
 * Pure: both work on a minimal node interface that real DOM nodes satisfy, so they are testable without jsdom
 * (takt-043) and run unchanged in the browser (e2e A3). `DOMParser` itself is used only in `parseClipboardHtml` below.
 */
import type { AnswerBlockInput, AnswerBodyInput, AnswerInlineInput } from '@hv/domain';

/** The part of a DOM node the walker reads. Real `Node`s satisfy it; `getAttribute` is asked for `style` only. */
export interface WalkNode {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly childNodes: ArrayLike<WalkNode>;
  readonly data?: string;
  readonly parentNode?: WalkNode | null;
  getAttribute?(name: string): string | null;
}

/** What `bodyToDom` needs of a document: element and text factories. `document` satisfies it. */
export interface BuiltElement<N> {
  appendChild(child: N): unknown;
  readonly style: { backgroundColor: string };
}
export interface DomFactory<N> {
  createElement(tag: 'p' | 'ul' | 'li' | 'b' | 'i' | 'span'): N & BuiltElement<N>;
  createTextNode(data: string): N;
}

const ELEMENT = 1;
const TEXT = 3;

/** The background of the highlight when the token cannot be read (tests, a missing stylesheet): `--color-tone-warning-bg`. */
export const HIGHLIGHT_FALLBACK = '#fdf3e4';

/** Elements that give no text at all (their content is code, metadata, an embedded object or a form control). */
const SILENT = new Set([
  'script', 'style', 'template', 'head', 'title', 'meta', 'link', 'xml', 'noscript', 'iframe', 'frame', 'frameset',
  'object', 'embed', 'applet', 'svg', 'math', 'img', 'picture', 'video', 'audio', 'source', 'track', 'canvas', 'map',
  'input', 'textarea', 'select', 'option', 'button', 'base',
]);

/** Elements that begin a block, with the candidate type they report (055 decision 1: the core maps it). */
const BLOCK_TYPES: Readonly<Record<string, string>> = {
  p: 'paragraph', div: 'paragraph', pre: 'paragraph', dt: 'paragraph', dd: 'paragraph', li: 'paragraph',
  section: 'paragraph', article: 'paragraph', header: 'paragraph', footer: 'paragraph', address: 'paragraph',
  figcaption: 'paragraph', caption: 'paragraph', center: 'paragraph', main: 'paragraph', aside: 'paragraph',
  nav: 'paragraph', figure: 'paragraph', hr: 'paragraph',
  h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
  blockquote: 'quote', td: 'table', th: 'table',
};

/** Block-level containers without a type of their own: they end the piece before them, text inside keeps the outer type. */
const CONTAINERS = new Set(['html', 'body', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'dl', 'form', 'fieldset', 'details', 'summary']);

const LISTS = new Set(['ul', 'ol']);

/** The type of a list item's piece inside the builder. */
const ITEM = '\u0000item';

/** Inter-element white space of HTML source: a piece of only this is no piece. */
const SOURCE_WHITE_SPACE = /^[\t\n\f\r ]*$/;

interface Marks {
  bold: boolean;
  italic: boolean;
  highlight: boolean;
  underline: boolean;
  strike: boolean;
}
const NO_MARKS: Marks = { bold: false, italic: false, highlight: false, underline: false, strike: false };
const MARK_ORDER = ['bold', 'italic', 'highlight', 'underline', 'strike'] as const;

/** The declarations of the `style` attribute, property and value in lower case, without `!important`. */
function styleOf(node: WalkNode): ReadonlyMap<string, string> {
  const raw = node.nodeType === ELEMENT && node.getAttribute !== undefined ? node.getAttribute('style') : null;
  const out = new Map<string, string>();
  if (raw === null || raw === '') return out;
  for (const declaration of raw.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).replace(/!\s*important\s*$/i, '').trim().toLowerCase();
    if (property !== '') out.set(property, value);
  }
  return out;
}

/** Hidden text stays hidden (Word's `mso-hide`, `display:none`), and Word's list bullet gives no text (055c reads it). */
function isHidden(style: ReadonlyMap<string, string>): boolean {
  return (
    style.get('display') === 'none' ||
    style.get('visibility') === 'hidden' ||
    style.get('visibility') === 'collapse' ||
    style.get('mso-hide') === 'all' ||
    style.get('mso-list') === 'ignore'
  );
}

function weight(value: string | undefined, inherited: boolean): boolean {
  if (value === undefined) return inherited;
  if (value === 'bold' || value === 'bolder') return true;
  if (value === 'normal' || value === 'lighter') return false;
  const n = Number(value);
  return Number.isFinite(n) && value !== '' ? n >= 600 : inherited;
}

function slant(value: string | undefined, inherited: boolean): boolean {
  if (value === undefined) return inherited;
  if (value === 'italic' || value.startsWith('oblique')) return true;
  if (value === 'normal') return false;
  return inherited;
}

/** Values that paint no visible background: no highlight. */
const INVISIBLE = new Set([
  'transparent', 'none', 'inherit', 'initial', 'unset', 'revert', 'white', '#fff', '#ffff', '#ffffff', '#ffffffff',
  'rgb(255,255,255)', 'rgba(255,255,255,1)', 'window', 'auto', '',
]);

function paints(value: string | undefined): boolean {
  if (value === undefined) return false;
  const v = value.replace(/\s+/g, '');
  if (INVISIBLE.has(v) || v.includes('url(') || v.includes('gradient(')) return false;
  if (/^rgba\(.*,0(\.0*)?\)$/.test(v) || /^#[0-9a-f]{6}00$/.test(v)) return false;
  return true;
}

/** The marks of an element from its parent's: the nearest explicit statement wins, as CSS inherits (decision 6). */
function marksOf(parent: Marks, tag: string, style: ReadonlyMap<string, string>, block: boolean): Marks {
  const bold = weight(style.get('font-weight'), parent.bold || tag === 'b' || tag === 'strong');
  const italic = slant(style.get('font-style'), parent.italic || tag === 'i' || tag === 'em');
  // The background of a block (Word's table cell) is not a highlight; an inline ancestor's is visible behind its text.
  const ownHighlight =
    tag === 'mark' || paints(style.get('background-color')) || paints(style.get('background')) || paints(style.get('mso-highlight'));
  const highlight = block ? false : parent.highlight || ownHighlight;
  const underline = parent.underline || tag === 'u';
  const strike = parent.strike || tag === 's' || tag === 'strike' || tag === 'del';
  return { bold, italic, highlight, underline, strike };
}

const markList = (marks: Marks): string[] => MARK_ORDER.filter((mark) => marks[mark]);
const sameList = (a: readonly string[] | undefined, b: readonly string[]): boolean =>
  (a ?? []).length === b.length && (a ?? []).every((mark, i) => mark === b[i]);

/** Collects pieces (paragraph-like blocks and list items) and groups the items into lists. */
class Builder {
  readonly blocks: AnswerBlockInput[] = [];
  private runs: AnswerInlineInput[] = [];
  type = 'paragraph';
  /** New items join the last block when it is a list started by the current outermost list element. */
  listOpen = false;

  text(data: string, marks: Marks): void {
    if (data === '') return;
    const list = markList(marks);
    const last = this.runs[this.runs.length - 1];
    if (last !== undefined && sameList(last.marks, list)) last.text += data;
    else this.runs.push(list.length > 0 ? { text: data, marks: list } : { text: data });
  }

  flush(): void {
    const runs = this.runs;
    this.runs = [];
    if (runs.every((run) => SOURCE_WHITE_SPACE.test(run.text))) return;
    if (this.type === ITEM) {
      const last = this.blocks[this.blocks.length - 1];
      if (this.listOpen && last !== undefined && last.type === 'list' && last.items !== undefined) last.items.push(runs);
      else {
        this.blocks.push({ type: 'list', items: [runs] });
        this.listOpen = true;
      }
    } else {
      this.blocks.push({ type: this.type, content: runs });
      this.listOpen = false;
    }
  }
}

function walkChildren(node: WalkNode, builder: Builder, marks: Marks, listDepth: number): void {
  const children = node.childNodes;
  for (let i = 0; i < children.length; i += 1) walkNode(children[i]!, builder, marks, listDepth);
}

function walkNode(node: WalkNode, builder: Builder, marks: Marks, listDepth: number): void {
  if (node.nodeType === TEXT) {
    builder.text(node.data ?? '', marks);
    return;
  }
  // Comments (Word's conditional comments too), processing instructions, doctype: nothing.
  if (node.nodeType !== ELEMENT) return;
  const tag = node.nodeName.toLowerCase();
  if (SILENT.has(tag)) return;
  const style = styleOf(node);
  if (isHidden(style)) return;
  if (tag === 'br') {
    builder.flush();
    return;
  }
  const isList = LISTS.has(tag);
  const blockType = BLOCK_TYPES[tag];
  const isBlock = isList || blockType !== undefined || CONTAINERS.has(tag);
  const own = marksOf(marks, tag, style, isBlock);
  if (!isBlock) {
    walkChildren(node, builder, own, listDepth);
    return;
  }
  // A block in a block splits: the piece before, the piece inside, the piece after (decision 6).
  builder.flush();
  const outer = builder.type;
  if (isList) {
    if (listDepth === 0) builder.listOpen = false;
    builder.type = ITEM;
    walkChildren(node, builder, own, listDepth + 1);
  } else {
    if (blockType !== undefined) builder.type = listDepth > 0 ? ITEM : blockType;
    walkChildren(node, builder, own, listDepth);
  }
  builder.flush();
  builder.type = outer;
}

/**
 * The walker: the children of `root` as an input form, or `null` when they hold no piece of text. Nested lists become
 * flat (E6), `br` ends a paragraph or item, the text stays raw (white space and characters are the core's, N3/N4).
 */
export function domToBodyInput(root: WalkNode): AnswerBodyInput | null {
  const builder = new Builder();
  walkChildren(root, builder, NO_MARKS, 0);
  builder.flush();
  return builder.blocks.length === 0 ? null : { blocks: builder.blocks };
}

/** The pressed state of the toolbar at a node of the field, by the walker's rule (decision 4: `aria-pressed`). */
export function marksAt(node: WalkNode, root: WalkNode): { bold: boolean; italic: boolean; highlight: boolean; list: boolean } {
  const chain: WalkNode[] = [];
  let current: WalkNode | null | undefined = node.nodeType === ELEMENT ? node : node.parentNode;
  while (current !== null && current !== undefined && current !== root) {
    chain.unshift(current);
    current = current.parentNode;
  }
  const none = { bold: false, italic: false, highlight: false, list: false };
  if (current !== root) return none;
  let marks = NO_MARKS;
  let list = false;
  for (const element of chain) {
    if (element.nodeType !== ELEMENT) continue;
    const tag = element.nodeName.toLowerCase();
    const isBlock = LISTS.has(tag) || BLOCK_TYPES[tag] !== undefined || CONTAINERS.has(tag);
    if (LISTS.has(tag) || tag === 'li') list = true;
    marks = marksOf(marks, tag, styleOf(element), isBlock);
  }
  return { bold: marks.bold, italic: marks.italic, highlight: marks.highlight, list };
}

type RunLike = { text: string; marks?: readonly string[] };

function appendRuns<N>(doc: DomFactory<N>, parent: N & BuiltElement<N>, runs: readonly RunLike[] | undefined, highlight: string): number {
  let appended = 0;
  for (const run of runs ?? []) {
    if (typeof run.text !== 'string' || run.text === '') continue;
    const marks = Array.isArray(run.marks) ? run.marks : [];
    let child: N = doc.createTextNode(run.text);
    if (marks.includes('highlight')) {
      const span = doc.createElement('span');
      span.style.backgroundColor = highlight;
      span.appendChild(child);
      child = span;
    }
    if (marks.includes('italic')) {
      const i = doc.createElement('i');
      i.appendChild(child);
      child = i;
    }
    if (marks.includes('bold')) {
      const b = doc.createElement('b');
      b.appendChild(child);
      child = b;
    }
    parent.appendChild(child);
    appended += 1;
  }
  return appended;
}

/**
 * The field's nodes for a stored or input form, all new: a list block → `ul` with one `li` per item, every other block →
 * one `p` per piece; marks → `b`, `i` and a `span` with the highlight's background, the elements the browser's editing
 * commands toggle (decision 4). Unknown marks become text, unknown block types paragraphs; empty pieces give nothing.
 */
export function bodyToDom<N>(doc: DomFactory<N>, body: AnswerBodyInput | null, highlight: string = HIGHLIGHT_FALLBACK): N[] {
  const out: N[] = [];
  for (const block of body?.blocks ?? []) {
    const pieces: (readonly RunLike[] | undefined)[] = [block.content, ...(block.items ?? [])];
    if (block.type === 'list') {
      const ul = doc.createElement('ul');
      let items = 0;
      for (const piece of pieces) {
        if (piece === undefined) continue;
        const li = doc.createElement('li');
        if (appendRuns(doc, li, piece, highlight) === 0) continue;
        ul.appendChild(li);
        items += 1;
      }
      if (items > 0) out.push(ul);
      continue;
    }
    for (const piece of pieces) {
      if (piece === undefined || !piece.some((run) => typeof run.text === 'string' && run.text !== '')) continue;
      const p = doc.createElement('p');
      appendRuns(doc, p, piece, highlight);
      out.push(p);
    }
  }
  return out;
}

/** A caret position in the field's model: block (child of the field), list item (or `null`), UTF-16 offset in the piece. */
export interface ModelCaret {
  block: number;
  item: number | null;
  offset: number;
}

function textNodesOf(node: WalkNode, out: WalkNode[]): WalkNode[] {
  for (let i = 0; i < node.childNodes.length; i += 1) {
    const child = node.childNodes[i]!;
    if (child.nodeType === TEXT) out.push(child);
    else if (child.nodeType === ELEMENT) textNodesOf(child, out);
  }
  return out;
}

/** The DOM point of a model position (the field was just built by `bodyToDom`); past the end means the end of the piece. */
export function caretTarget(root: WalkNode, caret: ModelCaret): { node: WalkNode; offset: number } {
  const block = root.childNodes[caret.block];
  if (block === undefined) return { node: root, offset: root.childNodes.length };
  let target = block;
  if (caret.item !== null) {
    const items: WalkNode[] = [];
    for (let i = 0; i < block.childNodes.length; i += 1) {
      const child = block.childNodes[i]!;
      if (child.nodeType === ELEMENT && child.nodeName.toLowerCase() === 'li') items.push(child);
    }
    target = items[Math.min(caret.item, items.length - 1)] ?? block;
  }
  const texts = textNodesOf(target, []);
  let remaining = Math.max(0, caret.offset);
  for (const text of texts) {
    const length = (text.data ?? '').length;
    if (remaining <= length) return { node: text, offset: remaining };
    remaining -= length;
  }
  const last = texts[texts.length - 1];
  return last !== undefined ? { node: last, offset: (last.data ?? '').length } : { node: target, offset: 0 };
}

/**
 * Where a paste or drop lands (decision 5): the field's model is read with a sentinel at the caret. Two characters of
 * the Private Use Area, which nobody types and the core never sees (the sentinel is gone before anything is sent).
 */
export const CARET_SENTINEL = '\uE055\uE05B';

interface Piece {
  /** `ITEM` for a list item, else the block type. */
  type: string;
  runs: AnswerInlineInput[];
}

const piecesOf = (body: AnswerBodyInput | null): Piece[] =>
  (body?.blocks ?? []).flatMap((block): Piece[] => {
    const pieces = [block.content, ...(block.items ?? [])].filter((piece): piece is AnswerInlineInput[] => piece !== undefined);
    return pieces.map((runs) => ({ type: block.type === 'list' ? ITEM : block.type, runs: runs.map((run) => ({ ...run })) }));
  });

const pieceLength = (runs: readonly AnswerInlineInput[]): number => runs.reduce((sum, run) => sum + run.text.length, 0);

/**
 * Splices the pasted input into the field's model at the sentinel: the text before the caret continues with the first
 * pasted piece, the last pasted piece continues with the text after it. Returns the new model and the caret at the end
 * of what was inserted; `null` when the sentinel is not in the model.
 */
export function spliceAtSentinel(field: AnswerBodyInput | null, pasted: AnswerBodyInput | null): { body: AnswerBodyInput | null; caret: ModelCaret } | null {
  const pieces = piecesOf(field);
  let at = -1;
  let left: AnswerInlineInput[] = [];
  let right: AnswerInlineInput[] = [];
  for (const [index, piece] of pieces.entries()) {
    const runIndex = piece.runs.findIndex((run) => run.text.includes(CARET_SENTINEL));
    if (runIndex < 0) continue;
    const run = piece.runs[runIndex]!;
    const cut = run.text.indexOf(CARET_SENTINEL);
    const before = run.text.slice(0, cut);
    const after = run.text.slice(cut + CARET_SENTINEL.length);
    const withText = (text: string): AnswerInlineInput[] => (text === '' ? [] : [{ ...run, text }]);
    left = [...piece.runs.slice(0, runIndex), ...withText(before)];
    right = [...withText(after), ...piece.runs.slice(runIndex + 1)];
    at = index;
    break;
  }
  if (at < 0) return null;
  const host = pieces[at]!;
  const inserted = piecesOf(pasted);
  const middle: Piece[] = [];
  let caretPiece: number;
  let caretOffset: number;
  if (inserted.length === 0) {
    middle.push({ type: host.type, runs: [...left, ...right] });
    caretPiece = 0;
    caretOffset = pieceLength(left);
  } else if (inserted.length === 1) {
    middle.push({ type: host.type, runs: [...left, ...inserted[0]!.runs, ...right] });
    caretPiece = 0;
    caretOffset = pieceLength(left) + pieceLength(inserted[0]!.runs);
  } else {
    const first = inserted[0]!;
    const last = inserted[inserted.length - 1]!;
    middle.push({ type: host.type, runs: [...left, ...first.runs] });
    middle.push(...inserted.slice(1, -1));
    middle.push({ type: last.type, runs: [...last.runs, ...right] });
    caretPiece = middle.length - 1;
    caretOffset = pieceLength(last.runs);
  }
  const all = [...pieces.slice(0, at), ...middle, ...pieces.slice(at + 1)];
  const caretIndex = at + caretPiece;
  // Regroup: consecutive items form one list; empty pieces fall away except the one holding the caret.
  const blocks: AnswerBlockInput[] = [];
  let caret: ModelCaret = { block: 0, item: null, offset: 0 };
  for (const [index, piece] of all.entries()) {
    const holdsCaret = index === caretIndex;
    if (piece.runs.length === 0 && !holdsCaret) continue;
    const last = blocks[blocks.length - 1];
    if (piece.type === ITEM) {
      if (last !== undefined && last.type === 'list' && last.items !== undefined) last.items.push(piece.runs);
      else blocks.push({ type: 'list', items: [piece.runs] });
      const list = blocks[blocks.length - 1]!;
      if (holdsCaret) caret = { block: blocks.length - 1, item: (list.items?.length ?? 1) - 1, offset: caretOffset };
    } else {
      blocks.push({ type: piece.type, content: piece.runs });
      if (holdsCaret) caret = { block: blocks.length - 1, item: null, offset: caretOffset };
    }
  }
  const nonEmpty = blocks.some((block) => (block.content ?? []).length > 0 || (block.items ?? []).some((item) => item.length > 0));
  return { body: nonEmpty ? { blocks } : null, caret };
}

/** Plain text: one paragraph per line (CR LF, CR, LF), as 055's L reads a text. */
export function plainTextToInput(text: string): AnswerBodyInput | null {
  const blocks = text
    .split(/\r\n|\r|\n/)
    .filter((line) => line !== '')
    .map((line): AnswerBlockInput => ({ type: 'paragraph', content: [{ text: line }] }));
  return blocks.length === 0 ? null : { blocks };
}

/**
 * Pasted HTML as an input form. The only `DOMParser` of the interface: the parsed document has no browsing context, and
 * the walker only reads it — no node of it is imported, adopted, moved or cloned into the live document (decision 5).
 * Whether a browser fetches anything for it anyway is not assumed but proven by e2e A2b.
 */
export function parseClipboardHtml(html: string): AnswerBodyInput | null {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return domToBodyInput(parsed);
}
