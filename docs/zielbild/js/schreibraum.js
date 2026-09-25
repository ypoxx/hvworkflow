/* HV-Tool Zielbild (slice 089): Schreibraum, the Finance desk writes one answer (target slices 054, 055).
   Reference, not product code: no HvApi, no rights (_actions), no i18n dictionary, one synthetic data set.
   Take layout, wording, spacing and interaction from here; build the real thing in apps/web per its slice spec. */
/* ---------- Schreibraum: the Finance desk writes one answer at a time */
const SR = { cur: S.mine[0], drafts: {}, found: [], confirm: false, focus: false, taken: {}, hitOpen: false };
for (const id of S.mine) { const q = S.byId.get(id); if (q.st !== 'fachbereich') SR.drafts[id] = null; }
const curSR = () => (SR.cur ? S.byId.get(SR.cur) : null);
let editor;

/* Numbers with a unit are checked; years and page numbers are not. "40 und 60 Prozent" shares the unit. */
const NUM_RE = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(-fache|\s?(?:Prozent|%|Millionen Euro|Milliarden Euro|Euro|Cent))?/g;
function scanNumbers(text) {
  const out = [];
  for (const m of text.matchAll(NUM_RE)) {
    const before = text.slice(Math.max(0, m.index - 7), m.index);
    if (/(Seite|S\.)\s$/.test(before)) continue;
    let unit = (m[3] || '').trim();
    let end = m.index + m[0].length;
    if (!unit) {
      const after = text.slice(end, end + 32);
      const mm = after.match(/^\s?(?:und|bis|oder)\s\d[\d.,]*\s?(Prozent|%|Millionen Euro|Milliarden Euro|Euro|Cent)/);
      if (!mm) continue;
      unit = mm[1];
    }
    if (unit === '%') unit = 'Prozent';
    const num = m[1] + (m[2] ? ',' + m[2] : '');
    out.push({ start: m.index, end, key: unit === '-fache' ? num + '-fache' : num + ' ' + unit });
  }
  return out;
}
function saveCaret(root) {
  const sel = getSelection();
  if (!sel.rangeCount || document.activeElement !== root) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer)) return null;
  const pre = document.createRange(); pre.selectNodeContents(root);
  pre.setEnd(r.startContainer, r.startOffset); const start = pre.toString().length;
  pre.setEnd(r.endContainer, r.endOffset); const end = pre.toString().length;
  return { start, end };
}
function restoreCaret(root, c) {
  if (!c) return;
  const at = (target) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let acc = 0, n;
    while ((n = w.nextNode())) { if (acc + n.nodeValue.length >= target) return [n, target - acc]; acc += n.nodeValue.length; }
    return [root, root.childNodes.length];
  };
  const [sn, so] = at(c.start), [en, eo] = at(c.end);
  const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
}
function markNumbers(root) {
  const caret = saveCaret(root);
  root.querySelectorAll('span.num').forEach((sp) => sp.replaceWith(...sp.childNodes));
  root.normalize();
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; let n;
  while ((n = w.nextNode())) nodes.push(n);
  const found = [];
  for (const node of nodes) {
    const hits = scanNumbers(node.nodeValue);
    const local = [];
    for (let i = hits.length - 1; i >= 0; i--) {
      const hit = hits[i]; const f = factFor(hit.key);
      const r = document.createRange(); r.setStart(node, hit.start); r.setEnd(node, hit.end);
      const span = h('span', { class: 'num ' + f.st });
      r.surroundContents(span);
      local.unshift({ key: hit.key, st: f.st, src: f.src, fix: f.fix || null, el: span });
    }
    found.push(...local);
  }
  restoreCaret(root, caret);
  return found;
}
function setEditorText(text) {
  const paras = text ? text.split(/\n+/) : [''];
  put(editor, ...paras.map((t) => h('p', null, t || h('br'))));
}
function flashNum(el) {
  if (!el || !el.isConnected) return;
  el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400);
}

function buildSR() {
  const v = $('#v-schreibraum');
  v.append(vhead('Schreibraum', 'Fachbereich Finanzen · nur die eigenen Fragen'));
  editor = h('div', { class: 'editor', id: 'editor', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Antworttext', lang: 'de', spellcheck: 'true', 'data-ph': 'Antwort im Wortlaut, so wie sie auf der Bühne vorgelesen wird.' });
  let timer = null;
  editor.addEventListener('input', () => {
    editor.classList.toggle('is-empty', !editor.innerText.trim());
    SR.confirm = false; renderReadTime();
    const fw = $('.forward'); if (fw) fw.disabled = !editor.innerText.trim();
    clearTimeout(timer); timer = setTimeout(() => { markAndCheck(); if (SR.cur) SR.drafts[SR.cur] = editor.innerHTML; }, 350);
  });
  editor.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
  editor.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); forward(false); } });
  editor.addEventListener('pointerover', (e) => { const el = e.target.closest && e.target.closest('.num'); if (!el) return; const f = SR.found.find((x) => x.el === el); if (f) showTip(e, FACT_LABEL[f.st] + ' · ' + f.key, f.src + (f.fix ? '\nKorrektur per Klick in der Prüfung: ' + f.fix : '')); });
  editor.addEventListener('pointerout', (e) => { if (e.target.closest && e.target.closest('.num')) hideTip(); });

  const fmtBtn = (label, content, fn) => h('button', { class: 'tb', type: 'button', 'data-fmt': '', 'aria-label': label, title: label, onmousedown: (e) => e.preventDefault(), onclick: () => { fn(); editor.dispatchEvent(new Event('input')); } }, content);
  const toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Formatierung' },
    fmtBtn('Fett', h('b', null, 'B'), () => document.execCommand('bold')),
    fmtBtn('Kursiv', h('i', { style: 'font-family:Georgia,serif' }, 'I'), () => document.execCommand('italic')),
    fmtBtn('Hervorheben', ico('mark', 16), highlight),
    fmtBtn('Aufzählung', ico('list', 16), () => document.execCommand('insertUnorderedList')),
    h('span', { class: 'sep' }),
    h('span', { class: 'fmt-note' }, 'Hausformat: Schrift und Größe kommen von der Ansicht'),
    h('span', { class: 'grow' }),
    h('button', { class: 'tb', type: 'button', 'data-act': 'focus', 'aria-pressed': 'false', 'aria-label': 'Vollbild', title: 'Vollbild', onclick: toggleFocus }, ico('max', 16)));

  const writer = h('section', { class: 'panel writer', id: 'sr-writer', 'aria-label': 'Antwort schreiben' },
    toolbar, editor,
    h('div', { class: 'wfoot' },
      h('div', { class: 'readtime' },
        h('div', { class: 'rt-top' }, h('span', { id: 'rt-note' }, 'Vorlesezeit'), h('span', { class: 'mono', id: 'rt-val' }, '0:00 von 2:00')),
        h('div', { class: 'rt-bar' }, h('div', { class: 'rt-fill', id: 'rt-fill', style: 'width:0%' }))),
      h('div', { class: 'acts', id: 'sr-acts' }),
      h('div', { class: 'confirm', id: 'sr-confirm', hidden: true })));

  v.append(h('div', { class: 'sr', id: 'sr' },
    h('nav', { class: 'panel sr-list', id: 'sr-list', 'aria-label': 'Meine Fragen' }),
    h('div', { class: 'sr-main' }, h('section', { class: 'panel qcard', id: 'sr-q' }), h('div', { id: 'sr-hit' }), writer),
    h('div', { class: 'sr-side', id: 'sr-side' }, h('section', { class: 'panel side checks', id: 'sr-checks' }), h('section', { class: 'panel side', id: 'sr-src' }))));
  document.execCommand('styleWithCSS', false, false);
}
function highlight() {
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const r = sel.getRangeAt(0);
  if (!editor.contains(r.commonAncestorContainer)) return;
  const m = document.createElement('mark');
  try { r.surroundContents(m); } catch (e) { m.append(r.extractContents()); r.insertNode(m); }
}
function toggleFocus() {
  SR.focus = !SR.focus;
  $('#sr').classList.toggle('focus', SR.focus);
  const b = $('[data-act="focus"]'); b.setAttribute('aria-pressed', String(SR.focus));
  put(b, ico(SR.focus ? 'min' : 'max', 16));
  b.setAttribute('aria-label', SR.focus ? 'Vollbild beenden' : 'Vollbild');
}

function renderSRList() {
  const mine = S.mine.map((id) => S.byId.get(id));
  const todo = mine.filter((q) => q.st === 'fachbereich').sort(byC);
  const done = mine.filter((q) => q.st !== 'fachbereich').sort(byC);
  const item = (q) => {
    const age = S.now - q.c; const open = q.st === 'fachbereich';
    return h('button', { class: 'li' + (open ? '' : ' fwd'), type: 'button', 'aria-current': String(q.id === SR.cur), onclick: () => selectSR(q.id) },
      h('span', { class: 'no' }, q.id),
      open ? h('span', { class: 'age ' + ageCls(age) }, Math.round(age) + ' min') : null,
      h('span', { class: 'txt' }, POOL[q.p].q),
      h('span', { class: 'meta' },
        open && EXPECT[q.p] ? chip('accent', ico('book', 12), 'Treffer ' + EXPECT[q.p].v) : null,
        open ? null : chip(q.st === 'frei' || q.st === 'vorgelesen' ? 'ok' : '', LABEL[q.st])));
  };
  $('#sr-list').classList.toggle('open', !!SR.listOpen);
  put($('#sr-list'), 
    h('div', { class: 'lh' }, h('span', { class: 'cap' }, 'Zu beantworten'), h('span', { class: 'cnt' }, todo.length)),
    todo.length ? todo.map(item) : h('p', { class: 'muted', style: 'padding:4px 10px 10px' }, 'Nichts offen.'),
    done.length ? h('div', { class: 'lh fwd-h' }, h('span', { class: 'cap' }, 'Weitergeleitet'), h('span', { class: 'cnt' }, done.length)) : null,
    done.map(item),
    h('button', { class: 'btn sm ghost list-toggle', type: 'button', 'aria-expanded': String(!!SR.listOpen), onclick: () => { SR.listOpen = !SR.listOpen; renderSRList(); } }, ico(SR.listOpen ? 'chevU' : 'chevD', 14), SR.listOpen ? 'Weniger zeigen' : 'Alle ' + mine.length + ' Fragen zeigen'));
}
function renderSRQ() {
  const box = $('#sr-q'); const q = curSR();
  if (!q) {
    put(box, h('div', { class: 'empty' }, ico('check', 22), h('b', null, 'Alles weitergeleitet'), h('p', null, 'Neue Fragen erscheinen hier, sobald die Koordination sie dir zuweist.')));
    return;
  }
  const sp = S.speakers[q.sp];
  put(box, 
    h('div', { class: 'q-meta' }, h('span', { class: 'qno' }, q.id), chip('', 'Wortmeldung ' + sp.no), chip('', 'Bühne: ' + STAGES[q.stage]), q.st === 'fachbereich' ? ageChip(S.now - q.c, true) : chip('', LABEL[q.st])),
    h('p', { class: 'q-text' }, POOL[q.p].q));
}
function renderSRHit() {
  const box = $('#sr-hit'); const q = curSR();
  put(box, );
  if (!q || q.st !== 'fachbereich') return;
  const ex = EXPECT[q.p];
  if (!ex) {
    const near = NEAR[q.p];
    box.append(h('section', { class: 'hit none' },
      h('div', { class: 'hit-head' }, ico('book', 16), h('b', null, 'Kein Treffer in der Erwartungskarte')),
      h('p', { class: 'hit-sub' }, near ? 'Ähnlich, aber nicht passend: ' + near.v + ' „' + near.t + '“ (' + near.m + ' %). Diese Antwort wird neu geschrieben.' : 'Diese Antwort wird neu geschrieben.')));
    return;
  }
  const taken = SR.taken[q.id];
  const diffs = SR.found.filter((x) => x.fix && POOL[q.p].a.includes(x.fix));
  box.append(h('section', { class: 'hit' + (SR.hitOpen ? ' open' : ''), 'aria-label': 'Treffer in der Erwartungskarte' },
    h('div', { class: 'hit-head' }, ico('book', 16), h('b', null, 'Vorbereitete Antwort'), h('span', { class: 'mono' }, ex.v),
      h('span', { class: 'match', title: 'Übereinstimmung mit der Frage' }, h('span', { class: 'meter' }, h('i', { style: 'width:' + ex.m + '%' })), h('span', { class: 'mono' }, ex.m + ' %'))),
    h('p', { class: 'hit-text' }, POOL[q.p].a),
    diffs.length && !taken ? h('p', { class: 'hit-diff' }, ico('alert', 14), 'Dein Entwurf weicht ab: ' + diffs.map((x) => x.key + ' statt ' + x.fix).join(', ') + '.') : null,
    h('div', { class: 'hit-foot' },
      h('span', { class: 'hit-sub' }, 'Freigegeben am ' + ex.at + ' · ' + ex.from),
      h('div', { class: 'hit-acts' },
        h('button', { class: 'btn sm ghost', type: 'button', 'aria-expanded': String(SR.hitOpen), onclick: () => { SR.hitOpen = !SR.hitOpen; renderSRHit(); } }, SR.hitOpen ? 'Weniger' : 'Ganz lesen'),
        taken ? chip('ok', ico('check', 13), 'Übernommen') : h('button', { class: 'btn sm accent', type: 'button', onclick: takeOver }, 'Übernehmen')))));
}
function takeOver() {
  const q = curSR(); if (!q || !EXPECT[q.p] || q.st !== 'fachbereich') return;
  const before = editor.innerHTML;
  setEditorText(POOL[q.p].a);
  SR.taken[q.id] = true; SR.drafts[q.id] = editor.innerHTML;
  markAndCheck(); renderSRHit();
  toast(EXPECT[q.p].v + ' übernommen', { undo: () => { editor.innerHTML = before; SR.taken[q.id] = false; SR.drafts[q.id] = before; markAndCheck(); renderSRHit(); } });
}
function renderChecks() {
  const f = SR.found; const n = { ok: 0, none: 0, conflict: 0 };
  f.forEach((x) => n[x.st]++);
  const hasText = !!editor.innerText.trim();
  put($('#sr-checks'), 
    h('h3', { class: 'cap' }, 'Prüfung vor Legal Clearing'),
    hasText ? h('div', { class: 'ck-sum' }, chip('ok' + (n.ok ? '' : ' zero'), n.ok + ' belegt'), chip('warn' + (n.none ? '' : ' zero'), n.none + ' ohne Beleg'), chip('crit' + (n.conflict ? '' : ' zero'), n.conflict + ' Widerspruch')) : null,
    f.length ? h('div', { class: 'ck-list' }, f.map((x) => h('div', { class: 'ck ' + x.st },
      h('button', { class: 'ck-main', type: 'button', onclick: () => flashNum(x.el) },
        ico(x.st === 'ok' ? 'check' : x.st === 'none' ? 'help' : 'alert', 16), h('span', { class: 'v' }, x.key), h('span', { class: 'l' }, FACT_LABEL[x.st]), h('span', { class: 's' }, x.src)),
      x.fix && editor.contentEditable === 'true' ? h('button', { class: 'btn sm fix', type: 'button', onclick: () => applyFix(x) }, ico('check', 13), x.fix + ' einsetzen') : null)))
      : h('p', { class: 'muted' }, hasText ? 'Keine Zahlen im Text.' : 'Noch kein Antworttext.'),
    h('p', { class: 'fine' }, 'Legal sieht dieselben Markierungen. Die Prüfung ersetzt keine Freigabe.'));
  const srcs = [...new Set(f.filter((x) => x.st === 'ok').map((x) => x.src))];
  put($('#sr-src'), h('h3', { class: 'cap' }, 'Belege zur Antwort'),
    srcs.length ? h('ul', { class: 'srcs' }, srcs.map((s) => h('li', null, ico('file', 15), s))) : h('p', { class: 'muted' }, 'Noch keine Belege. Sie ergeben sich aus den geprüften Zahlen.'));
}
function applyFix(x) {
  const q = curSR(); if (!q || !x.el.isConnected) return;
  const before = editor.innerHTML;
  x.el.textContent = x.fix;
  markAndCheck(); SR.drafts[q.id] = editor.innerHTML;
  toast(x.key + ' durch ' + x.fix + ' ersetzt', { undo: () => { editor.innerHTML = before; SR.drafts[q.id] = before; markAndCheck(); } });
}
function renderReadTime() {
  const s = secsFor(editor.innerText);
  $('#rt-val').textContent = dur(s) + ' von 2:00';
  const fill = $('#rt-fill'); fill.style.width = Math.min(100, s / 120 * 100) + '%'; fill.classList.toggle('over', s > 120);
  $('#rt-note').textContent = s > 120 ? 'Vorlesezeit, länger als das Ziel' : 'Vorlesezeit';
}
function renderSRFoot() {
  const q = curSR(); const acts = $('#sr-acts'); const conf = $('#sr-confirm');
  if (!q) { put(acts, ); conf.hidden = true; return; }
  renderReadTime();
  if (q.st !== 'fachbereich') {
    conf.hidden = true;
    const at = q.hist.find((x) => x.s === 'legal');
    put(acts, chip(q.st === 'frei' || q.st === 'vorgelesen' ? 'ok' : '', ico('check', 13), LABEL[q.st] + (at ? ' · weitergeleitet ' + fmt(at.at) : '')));
    return;
  }
  const empty = !editor.innerText.trim();
  put(acts, 
    h('span', { class: 'kbd-hint', 'aria-hidden': 'true' }, h('span', { class: 'kbd' }, 'Strg'), '+', h('span', { class: 'kbd' }, '↵')),
    h('button', { class: 'btn primary forward', type: 'button', disabled: empty, onclick: () => forward(false) }, 'Weiterleiten an Legal Clearing', ico('arrow', 16)));
  const conflicts = SR.found.filter((f) => f.st === 'conflict');
  if (SR.confirm && conflicts.length) {
    conf.hidden = false;
    put(conf, ico('alert', 16),
      h('span', null, conflicts.length === 1 ? 'Eine Zahl widerspricht einer schon vorgelesenen Antwort. Legal sieht die Markierung.' : conflicts.length + ' Zahlen widersprechen schon vorgelesenen Antworten. Legal sieht die Markierungen.'),
      h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { SR.confirm = false; renderSRFoot(); flashNum(conflicts[0].el); } }, 'Zur Zahl'),
      h('button', { class: 'btn sm', type: 'button', id: 'confirm-go', onclick: () => forward(true) }, 'Trotzdem weiterleiten'));
  } else conf.hidden = true;
}
function markAndCheck() {
  SR.found = markNumbers(editor);
  editor.classList.toggle('is-empty', !editor.innerText.trim());
  renderChecks(); renderSRFoot(); renderSRHit();
}
function loadEditor() {
  const q = curSR(); const w = $('#sr-writer');
  w.hidden = !q; $('#sr-side').hidden = !q;
  if (!q) { SR.found = []; return; }
  const html = SR.drafts[q.id];
  if (html) editor.innerHTML = html; else setEditorText(q.st === 'fachbereich' ? (DRAFT[q.p] || '') : POOL[q.p].a);
  const editable = q.st === 'fachbereich';
  editor.contentEditable = editable ? 'true' : 'false';
  $$('#sr-writer .tb[data-fmt]').forEach((b) => { b.disabled = !editable; });
  markAndCheck();
}
function renderSR(load) { renderSRList(); renderSRQ(); renderSRHit(); if (load) loadEditor(); else renderSRFoot(); }
function selectSR(id) {
  if (SR.cur && editor.contentEditable === 'true') SR.drafts[SR.cur] = editor.innerHTML;
  SR.cur = id; SR.confirm = false; SR.hitOpen = false;
  renderSR(true);
}
function nextTodo() { return S.mine.map((id) => S.byId.get(id)).filter((q) => q.st === 'fachbereich').sort(byC)[0] || null; }
function forward(force) {
  const q = curSR();
  if (!q || q.st !== 'fachbereich' || !editor.innerText.trim()) return;
  markAndCheck();
  if (!force && SR.found.some((f) => f.st === 'conflict')) { SR.confirm = true; renderSRFoot(); $('#confirm-go').focus(); return; }
  SR.drafts[q.id] = editor.innerHTML; SR.confirm = false;
  q.st = 'legal'; q.hist.push({ s: 'legal', at: S.now });
  const next = nextTodo(); SR.cur = next ? next.id : null;
  renderSR(true);
  toast(q.id + ' an Legal Clearing weitergeleitet', { undo: () => { q.st = 'fachbereich'; q.hist.pop(); SR.cur = q.id; renderSR(true); } });
}
