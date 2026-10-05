/**
 * Scheibe 055b, Test 2: the walker `domToBodyInput` and its inverse `bodyToDom`, on test nodes of the minimal node
 * interface (no jsdom, takt-043). The walker maps what it finds and never applies the whitelist (055 decision 1); it
 * reads text, tag names and the `style` attribute only; `bodyToDom` builds new nodes of six kinds and never reuses an
 * input node. The same functions run against a real DOM in e2e A3.
 */
import { describe, expect, it } from 'vitest';
import type { AnswerBody, AnswerBodyInput } from '@hv/domain';
import { answerBodyOf, previewAnswer } from '../../api/answerFormat';
import { bodyToDom, caretTarget, clipboardInput, domToBodyInput, marksAt, plainTextToInput, spliceAtCaret } from './domToBody';
import type { DomFactory, WalkNode } from './domToBody';

/** A test node after the minimal interface; it records every attribute the walker asks for. */
interface TestNode extends WalkNode {
  childNodes: TestNode[];
  parentNode: TestNode | null;
  attributes: Record<string, string>;
}
const asked: string[] = [];

function node(nodeType: number, nodeName: string, attributes: Record<string, string>, children: TestNode[], data?: string): TestNode {
  const self: TestNode = {
    nodeType,
    nodeName,
    childNodes: children,
    parentNode: null,
    attributes,
    ...(data !== undefined ? { data } : {}),
    getAttribute(name: string): string | null {
      asked.push(name);
      return attributes[name] ?? null;
    },
  };
  for (const child of children) child.parentNode = self;
  return self;
}
const el = (tag: string, attrs: Record<string, string> | TestNode | string = {}, ...children: (TestNode | string)[]): TestNode => {
  const all = typeof attrs === 'string' || 'nodeType' in attrs ? [attrs, ...children] : children;
  const attributes = typeof attrs === 'string' || 'nodeType' in attrs ? {} : (attrs as Record<string, string>);
  return node(1, tag.toUpperCase(), attributes, all.map((c) => (typeof c === 'string' ? text(c) : (c as TestNode))));
};
const text = (data: string): TestNode => node(3, '#text', {}, [], data);
const comment = (data: string): TestNode => node(8, '#comment', {}, [], data);
const root = (...children: (TestNode | string)[]): TestNode => node(11, '#document-fragment', {}, children.map((c) => (typeof c === 'string' ? text(c) : c)));

const walk = (...children: (TestNode | string)[]): AnswerBodyInput | null => domToBodyInput(root(...children));
const para = (...content: AnswerBodyInput['blocks'][number]['content'] & object): AnswerBodyInput['blocks'][number] => ({ type: 'paragraph', content });
const run = (t: string, ...marks: string[]) => (marks.length > 0 ? { text: t, marks } : { text: t });

describe('domToBodyInput: marks (Test 2 a–d)', () => {
  it('(a) b, strong, font-weight 700/bold/600 are bold; 500 not; font-weight:normal cancels, an inner 700 wins', () => {
    expect(walk(el('p', el('b', 'x'), el('strong', 'y')))).toEqual({ blocks: [para(run('xy', 'bold'))] });
    for (const weight of ['700', 'bold', '600', 'bolder']) {
      expect(walk(el('p', el('span', { style: `font-weight: ${weight}` }, 'x')))).toEqual({ blocks: [para(run('x', 'bold'))] });
    }
    expect(walk(el('p', el('span', { style: 'font-weight:500' }, 'x')))).toEqual({ blocks: [para(run('x'))] });
    expect(walk(el('b', { style: 'font-weight:normal' }, el('p', 'a ', el('span', { style: 'font-weight:700' }, 'b')))))
      .toEqual({ blocks: [para(run('a '), run('b', 'bold'))] });
    expect(walk(el('p', el('b', el('span', { style: 'font-weight:400' }, 'x'))))).toEqual({ blocks: [para(run('x'))] });
  });

  it('(b) i, em, font-style italic/oblique are italic; font-style:normal cancels', () => {
    expect(walk(el('p', el('i', 'a'), el('em', 'b'), el('span', { style: 'font-style:italic' }, 'c'), el('span', { style: 'font-style: oblique' }, 'd'))))
      .toEqual({ blocks: [para(run('abcd', 'italic'))] });
    expect(walk(el('p', el('i', 'a', el('span', { style: 'font-style:normal' }, 'b'))))).toEqual({ blocks: [para(run('a', 'italic'), run('b'))] });
  });

  it('(c) mark, background, background-color, mso-highlight are highlight; transparent, white and friends not; a td background not', () => {
    for (const style of ['background:yellow', 'background-color:#ff0', 'mso-highlight:yellow', 'background-color: rgb(253, 243, 228)']) {
      expect(walk(el('p', el('span', { style }, 'x')))).toEqual({ blocks: [para(run('x', 'highlight'))] });
    }
    expect(walk(el('p', el('mark', 'x')))).toEqual({ blocks: [para(run('x', 'highlight'))] });
    for (const value of ['transparent', 'white', '#fff', '#ffffff', 'rgb(255, 255, 255)', 'inherit', 'initial', 'none', 'WHITE']) {
      expect(walk(el('p', el('span', { style: `background-color:${value}` }, 'x')))).toEqual({ blocks: [para(run('x'))] });
    }
    expect(walk(el('table', el('tr', el('td', { style: 'background:yellow' }, 'x'))))).toEqual({ blocks: [{ type: 'table', content: [run('x')] }] });
    // Visible is the background of the ancestor: a transparent child inside a highlighted span stays highlighted.
    expect(walk(el('p', el('span', { style: 'background:yellow' }, el('span', { style: 'background:transparent' }, 'x')))))
      .toEqual({ blocks: [para(run('x', 'highlight'))] });
  });

  it('(d) u → underline, s/strike/del → strike (candidates, the core decides)', () => {
    expect(walk(el('p', el('u', 'a'), el('s', 'b'), el('strike', 'c'), el('del', 'd'))))
      .toEqual({ blocks: [para(run('a', 'underline'), run('bcd', 'strike'))] });
    expect(walk(el('p', el('b', el('i', el('mark', el('u', el('s', 'x'))))))))
      .toEqual({ blocks: [para(run('x', 'bold', 'italic', 'highlight', 'underline', 'strike'))] });
  });
});

describe('domToBodyInput: blocks (Test 2 e–f)', () => {
  it('(e) h2 heading, blockquote quote, td table; ol/ul lists with items, nested lists flat, a block in a block splits', () => {
    expect(walk(el('h2', 'T'), el('blockquote', 'Q'), el('table', el('tbody', el('tr', el('td', 'A'), el('th', 'B'))))))
      .toEqual({ blocks: [{ type: 'heading', content: [run('T')] }, { type: 'quote', content: [run('Q')] }, { type: 'table', content: [run('A')] }, { type: 'table', content: [run('B')] }] });
    expect(walk(el('ol', el('li', 'a'), el('li', 'b')), el('ul', el('li', 'c'))))
      .toEqual({ blocks: [{ type: 'list', items: [[run('a')], [run('b')]] }, { type: 'list', items: [[run('c')]] }] });
    expect(walk(el('ul', el('li', 'a', el('ul', el('li', 'b'), el('li', 'c')), 'd'))))
      .toEqual({ blocks: [{ type: 'list', items: [[run('a')], [run('b')], [run('c')], [run('d')]] }] });
    expect(walk(el('div', 'vor', el('p', 'im'), 'nach'))).toEqual({ blocks: [para(run('vor')), para(run('im')), para(run('nach'))] });
    expect(walk('frei', el('p', 'p'), 'auch')).toEqual({ blocks: [para(run('frei')), para(run('p')), para(run('auch'))] });
    expect(walk(el('dl', el('dt', 'a'), el('dd', 'b')), el('section', 's'), el('figcaption', 'f'))).toEqual({ blocks: [para(run('a')), para(run('b')), para(run('s')), para(run('f'))] });
  });

  it('(f) br ends a paragraph or item and starts one of the same kind; a br at the end of a block gives nothing', () => {
    expect(walk(el('p', 'a', el('br'), 'b'))).toEqual({ blocks: [para(run('a')), para(run('b'))] });
    expect(walk(el('ul', el('li', 'a', el('br'), 'b')))).toEqual({ blocks: [{ type: 'list', items: [[run('a')], [run('b')]] }] });
    expect(walk(el('p', 'a', el('br')), el('p', el('br')))).toEqual({ blocks: [para(run('a'))] });
    expect(walk()).toBeNull();
    expect(walk(el('p'), '\n  ')).toBeNull();
  });
});

describe('domToBodyInput: what gives no text (Test 2 g–h)', () => {
  it('(g) script, style, template, head, title, meta, xml, noscript, iframe, svg, img, comments, hidden and mso-list:Ignore give nothing', () => {
    const silent = ['script', 'style', 'template', 'head', 'title', 'meta', 'xml', 'noscript', 'iframe', 'svg', 'math', 'object', 'embed', 'button', 'textarea', 'select', 'input', 'link'];
    for (const tag of silent) expect(walk(el('p', 'a', el(tag, 'GEHEIM'), 'b'))).toEqual({ blocks: [para(run('ab'))] });
    expect(walk(el('p', 'a', el('img', { src: 'x', alt: 'GEHEIM' }), 'b'))).toEqual({ blocks: [para(run('ab'))] });
    expect(walk(el('p', 'a', comment('GEHEIM'), comment('[if !supportLists]'), 'b'))).toEqual({ blocks: [para(run('ab'))] });
    for (const style of ['display:none', 'visibility: hidden', 'mso-hide:all', 'mso-list:Ignore', 'DISPLAY: NONE !important']) {
      expect(walk(el('p', 'a', el('span', { style }, 'GEHEIM'), 'b'))).toEqual({ blocks: [para(run('ab'))] });
    }
    expect(walk(el('p', 'zum ', el('a', { href: 'https://example.invalid/' }, 'Link')))).toEqual({ blocks: [para(run('zum Link'))] });
  });

  it('(h) the text stays raw: U+00A0, U+200B and line breaks stay in the run', () => {
    expect(walk(el('p', 'a\u00A0b\u200Bc\r\nd  e'))).toEqual({ blocks: [para(run('a\u00A0b\u200Bc\r\nd  e'))] });
  });
});

/** A recording factory: every element it makes and every text node, by kind. */
interface FakeEl extends TestNode {
  style: { backgroundColor: string };
  appendChild(child: TestNode): void;
}
function factory(): DomFactory<TestNode> & { made: string[] } {
  const made: string[] = [];
  return {
    made,
    createElement(tag: string) {
      made.push(tag);
      const self = node(1, tag.toUpperCase(), {}, []) as FakeEl;
      self.style = { backgroundColor: '' };
      self.getAttribute = (name: string) => {
        asked.push(name);
        return name === 'style' && self.style.backgroundColor !== '' ? `background-color: ${self.style.backgroundColor}` : null;
      };
      self.appendChild = (child: TestNode) => {
        child.parentNode = self;
        self.childNodes.push(child);
      };
      return self;
    },
    createTextNode(data: string) {
      made.push('#text');
      return text(data);
    },
  };
}

const DOCS: AnswerBody[] = [
  { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'Eins.' }] }] },
  { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold'] }, { text: ' steigt ' }, { text: 'deutlich', marks: ['italic', 'highlight'] }, { text: '.' }] }] },
  { language: 'de', blocks: [{ type: 'list', items: [[{ text: 'a', marks: ['bold', 'italic', 'highlight'] }], [{ text: 'b' }]] }] },
  { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'Vor' }] }, { type: 'list', items: [[{ text: 'x' }]] }, { type: 'paragraph', content: [{ text: 'Nach', marks: ['highlight'] }] }] },
  { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'A', marks: ['bold'] }, { text: 'B', marks: ['bold', 'italic'] }, { text: 'C', marks: ['italic'] }] }] },
];

describe('bodyToDom (Test 2 i–j)', () => {
  it('(i) walker(bodyToDom(b)) through the read variant gives b for five documents; only p, ul, li, b, i, span and text', () => {
    for (const doc of DOCS) {
      const f = factory();
      const nodes = bodyToDom(f, doc);
      expect(previewAnswer(domToBodyInput(root(...nodes)))).toEqual(doc);
      expect(f.made.every((kind) => ['p', 'ul', 'li', 'b', 'i', 'span', '#text'].includes(kind))).toBe(true);
    }
  });

  it('(i) unknown marks and block types of an input become text and paragraph; empty input gives no node', () => {
    const f = factory();
    const nodes = bodyToDom(f, { blocks: [{ type: 'heading', content: [{ text: 'T', marks: ['underline'] }] }] });
    expect(f.made).toEqual(['p', '#text']);
    expect(domToBodyInput(root(...nodes))).toEqual({ blocks: [para(run('T'))] });
    expect(bodyToDom(factory(), null)).toEqual([]);
  });

  it('(j) the walker asks only for style, never src, href, srcset, poster, data or background; no input node reaches the output', () => {
    asked.length = 0;
    const urls = { src: 'u', href: 'u', srcset: 'u', poster: 'u', data: 'u', background: 'u' };
    const input = root(el('p', urls, el('b', urls, 'fett'), el('img', urls), el('video', urls, 'v')), el('table', urls, el('tr', el('td', urls, 'z'))));
    const result = domToBodyInput(input);
    expect(new Set(asked)).toEqual(new Set(['style']));
    const all: TestNode[] = [];
    const collect = (n: TestNode): void => {
      all.push(n);
      n.childNodes.forEach(collect);
    };
    collect(input);
    const out = bodyToDom(factory(), result);
    const outAll: TestNode[] = [];
    const collectOut = (n: TestNode): void => {
      outAll.push(n);
      n.childNodes.forEach(collectOut);
    };
    out.forEach(collectOut);
    expect(outAll.length).toBeGreaterThan(0);
    expect(outAll.some((n) => all.includes(n))).toBe(false);
  });
});

describe('marksAt and caretTarget (decision 4/5)', () => {
  it('marksAt reads the marks of a text node by the walker rule, up to the root; list when inside an li', () => {
    const t = text('x');
    const field = root(el('ul', el('li', el('b', el('span', { style: 'background-color: rgb(253, 243, 228)' }, t)))));
    expect(marksAt(t, field)).toEqual({ bold: true, italic: false, highlight: true, list: true });
    const plain = text('y');
    const field2 = root(el('p', el('b', { style: 'font-weight:normal' }, plain)));
    expect(marksAt(plain, field2)).toEqual({ bold: false, italic: false, highlight: false, list: false });
  });

  it('caretTarget finds the text node and offset of a position in the model', () => {
    const a = text('ab');
    const b = text('cd');
    const field = root(el('p', 'x'), el('ul', el('li', 'y'), el('li', el('b', a), b)));
    expect(caretTarget(field, { block: 1, item: 1, offset: 3 })).toEqual({ node: b, offset: 1 });
    expect(caretTarget(field, { block: 1, item: 1, offset: 2 })).toEqual({ node: a, offset: 2 });
    expect(caretTarget(field, { block: 1, item: 1, offset: 99 })).toEqual({ node: b, offset: 2 });
    const empty = el('p');
    expect(caretTarget(root(empty), { block: 0, item: null, offset: 0 })).toEqual({ node: empty, offset: 0 });
  });
});

describe('answerBodyOf feeds bodyToDom (055 L)', () => {
  it('a version without body starts the field from its text', () => {
    const f = factory();
    const nodes = bodyToDom(f, answerBodyOf({ text: 'eins\nzwei' }));
    expect(nodes.length).toBe(2);
  });
});

describe('spliceAtCaret, clipboardInput and plainTextToInput (decision 5)', () => {
  /** Reads a field of test nodes with the caret node where the field would insert it. */
  const read = (field: TestNode, caretNode: TestNode): AnswerBodyInput | null => domToBodyInput(field, caretNode);

  it('one pasted piece continues the paragraph at the caret; the caret stands after it', () => {
    const caret = text('');
    const field = root(el('p', 'ab', caret, 'cd'));
    const result = spliceAtCaret(read(field, caret), { blocks: [para(run('X', 'bold'))] });
    expect(result).toEqual({ body: { blocks: [para(run('ab'), run('X', 'bold'), run('cd'))] }, caret: { block: 0, item: null, offset: 3 } });
  });

  it('several pieces: the first joins the text before, the last the text after; items stay in their list', () => {
    const caret = text('');
    const field = root(el('p', 'vor'), el('ul', el('li', 'a', caret, 'b')));
    const pasted: AnswerBodyInput = { blocks: [para(run('P1')), { type: 'list', items: [[run('L1')], [run('L2')]] }] };
    const result = spliceAtCaret(read(field, caret), pasted);
    expect(result?.body).toEqual({ blocks: [para(run('vor')), { type: 'list', items: [[run('a'), run('P1')], [run('L1')], [run('L2'), run('b')]] }] });
    expect(result?.caret).toEqual({ block: 1, item: 2, offset: 2 });
  });

  it('an empty paragraph holding the caret keeps its place; without the caret node nothing happens', () => {
    const caret = text('');
    const field = root(el('p', 'eins'), el('p', caret));
    expect(spliceAtCaret(read(field, caret), { blocks: [para(run('zwei'))] })).toEqual({
      body: { blocks: [para(run('eins')), para(run('zwei'))] },
      caret: { block: 1, item: null, offset: 4 },
    });
    expect(spliceAtCaret(domToBodyInput(root(el('p', 'eins'))), { blocks: [para(run('x'))] })).toBeNull();
  });

  it('review finding 1: old sentinel characters in the field or the paste neither move the caret nor survive', () => {
    // Repro: "Alt\uE055\uE05Bteil" (a version saved with the old text sentinel), caret at the end, paste "NEU".
    const caret = text('');
    const field = root(el('p', 'Alt\uE055\uE05Bteil', caret));
    const result = spliceAtCaret(read(field, caret), { blocks: [para(run('N\uE055EU\uE05B'))] });
    expect(result).toEqual({ body: { blocks: [para(run('Altteil'), run('NEU'))] }, caret: { block: 0, item: null, offset: 10 } });
    expect(JSON.stringify(result)).not.toMatch(/[\uE055\uE05B]/);
  });

  it('nit 8: HTML without text falls back to the plain text; neither gives nothing', () => {
    expect(clipboardInput('<img src="x">', 'eins\nzwei', () => null)).toEqual({ blocks: [para(run('eins')), para(run('zwei'))] });
    expect(clipboardInput('<b>a</b>', 'b', () => ({ blocks: [para(run('a', 'bold'))] }))).toEqual({ blocks: [para(run('a', 'bold'))] });
    expect(clipboardInput('', 'nur Text', () => { throw new Error('not parsed'); })).toEqual({ blocks: [para(run('nur Text'))] });
    expect(clipboardInput('', '', () => null)).toBeNull();
  });

  it('plain text: one paragraph per line (CR LF, CR, LF); empty lines and empty text give nothing', () => {
    expect(plainTextToInput('a\r\nb\rc\n\nd')).toEqual({ blocks: [para(run('a')), para(run('b')), para(run('c')), para(run('d'))] });
    expect(plainTextToInput('')).toBeNull();
  });
});
