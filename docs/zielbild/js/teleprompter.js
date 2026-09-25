/* HV-Tool Zielbild (slice 089): Teleprompter, one device per board member (target slices 056, 057, 058).
   Reference, not product code: no HvApi, no rights (_actions), no i18n dictionary, one synthetic data set.
   Take layout, wording, spacing and interaction from here; build the real thing in apps/web per its slice spec. */
/* ---------- Teleprompter: one device per board member, own set list */
const TP = { scale: 1, wide: false, light: false, list: true, only: false, msg: null, msgDone: false, preview: null, ret: false };
(() => { const p = store.get('hv-proto-stage'); if (p) { TP.scale = Math.min(1.5, Math.max(0.8, Number(p.scale) || 1)); TP.wide = !!p.wide; TP.light = !!p.light; } })();
const savePrefs = () => store.set('hv-proto-stage', { scale: TP.scale, wide: TP.wide, light: TP.light });
const roundQs = () => S.round.map((id) => S.byId.get(id));
const curTP = () => roundQs().find((q) => q.st === 'buehne') || null;
const HOLD_MS = 600;
let holdBtn, holdRaf = 0, holdStart = 0, holdHintT = null;

function tbtn(content, label, fn, key) {
  return h('button', { class: 'tbtn', type: 'button', title: label, 'aria-label': label, 'data-key': key || null, onmousedown: (e) => e.preventDefault(), onclick: fn }, content);
}
function buildTP() {
  const v = $('#v-teleprompter');
  v.append(vhead('Teleprompter', 'Finanzvorstand · eigenes Gerät auf der Bühne'));
  holdBtn = h('button', { class: 'hold', type: 'button', id: 'hold' }, h('span', { class: 'hold-fill' }), h('span', { class: 'hold-l' }, 'Halten: vorgelesen, weiter'), h('span', { class: 'kbd' }, 'Leertaste halten'));
  holdBtn.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); try { holdBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } holdBegin(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => holdBtn.addEventListener(ev, holdCancel));
  v.append(h('div', { class: 'stage', id: 'stage' },
    h('div', { class: 'st-top' },
      h('div', { class: 'st-who' }, h('b', null, 'Finanzvorstand'), h('span', null, 'Antwortrunde 2')),
      h('div', { class: 'st-progress', id: 'st-progress' }),
      h('div', { class: 'st-tools' }, h('span', { class: 'st-rest', id: 'st-rest' }),
        tbtn(h('span', { style: 'font-size:11px' }, 'A'), 'Schrift kleiner', () => setScale(-0.1)),
        tbtn(h('span', { style: 'font-size:16px' }, 'A'), 'Schrift größer', () => setScale(0.1)),
        tbtn(ico('lines', 15), 'Weiter Zeilenabstand', () => { TP.wide = !TP.wide; savePrefs(); renderTP(); }, 'wide'),
        tbtn([ico('sun', 15), h('span', { class: 'notes-label' }, 'Saallicht')], 'Saallicht, helle Anzeige', () => { TP.light = !TP.light; savePrefs(); renderTP(); }, 'light'),
        tbtn([ico('list', 15), h('span', { class: 'notes-label' }, 'Setliste')], 'Setliste zeigen', () => { TP.list = !TP.list; renderTP(); }, 'list'),
        tbtn([ico('max', 15), h('span', { class: 'notes-label' }, 'Nur Bühne')], 'Nur Bühne: alles andere ausblenden', () => setOnly(!TP.only), 'only'))),
    h('div', { class: 'st-msg', id: 'st-msg', hidden: true }),
    h('div', { class: 'st-body' }, h('div', { class: 'st-main', id: 'st-main' }), h('aside', { class: 'st-list', id: 'st-list', 'aria-label': 'Setliste' })),
    h('div', { class: 'st-foot' }, holdBtn, h('div', { class: 'st-retbox', id: 'st-retbox', hidden: true }),
      h('button', { class: 'st-return', id: 'st-return', type: 'button', onclick: () => { TP.ret = true; renderTP(); } }, 'Antwort zurückgeben'))));
}
function setScale(d) { TP.scale = Math.round(Math.min(1.5, Math.max(0.8, TP.scale + d)) * 10) / 10; savePrefs(); renderTP(); }
function answerEl(text) {
  const p = h('p', { class: 'st-answer' });
  for (const s of text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/)) {
    const span = h('span', { class: 'sent' });
    s.split(/(\*\*[^*]+\*\*)/).forEach((part) => { if (/^\*\*[^*]+\*\*$/.test(part)) span.append(h('strong', null, part.slice(2, -2))); else if (part) span.append(part); });
    p.append(span);
  }
  return p;
}
function qBlock(q) {
  const sp = S.speakers[q.sp]; const appr = q.hist.find((x) => x.s === 'frei');
  return [
    h('div', { class: 'st-meta' }, h('span', { class: 'mono' }, q.id), h('span', null, 'Wortmeldung ' + sp.no + ' · ' + sp.name + (sp.org ? ' · ' + sp.org : ''))),
    h('p', { class: 'st-q' }, POOL[q.p].q),
    h('div', { class: 'st-div' }, 'Freigegebene Antwort', h('span', { class: 'st-ok' }, 'Freigegeben' + (appr ? ' ' + fmt(appr.at) : '') + ' · Legal Clearing')),
    answerEl(POOL[q.p].a)];
}
function renderTP() {
  const st = $('#stage');
  st.toggleAttribute('data-light', TP.light);
  st.classList.toggle('nolist', !TP.list);
  st.style.setProperty('--scale', TP.scale);
  st.style.setProperty('--lh', TP.wide ? 1.62 : 1.38);
  $$('.tbtn[data-key]', st).forEach((b) => b.setAttribute('aria-pressed', String(!!TP[b.dataset.key])));
  const qs = roundQs(); const cur = curTP(); const pending = qs.filter((q) => q.st === 'buehne');
  put($('#st-progress'), 
    h('div', { class: 'segs', 'aria-hidden': 'true' }, qs.map((q) => h('span', { class: 'seg ' + (q.st === 'vorgelesen' ? 'done' : q === cur ? 'cur' : q.returned ? 'ret' : '') }))),
    h('span', { class: 'st-count' }, cur ? (qs.indexOf(cur) + 1) + ' von ' + qs.length : 'fertig'));
  $('#st-rest').textContent = pending.length ? 'noch ca. ' + Math.max(1, Math.round(pending.reduce((a, q) => a + secsFor(POOL[q.p].a), 0) / 60)) + ' min' : '';
  const msg = $('#st-msg');
  msg.hidden = !TP.msg;
  if (TP.msg) put(msg, ico('msg', 16), h('b', null, TP.msg.from), h('span', null, TP.msg.text), h('span', { class: 'mono' }, fmt(TP.msg.at)),
    tbtn(ico('x', 14), 'Nachricht ausblenden', () => { TP.msg = null; renderTP(); }));
  const main = $('#st-main');
  if (TP.preview) {
    const q = S.byId.get(TP.preview); const done = q.st === 'vorgelesen';
    put(main, h('div', { class: 'st-preview' }, ico('eye', 16), h('span', null, done ? 'Rückblick auf ' + q.id + ' · vorgelesen ' + fmt(q.dAt) : 'Vorschau auf ' + q.id + ' · noch nicht vorgelesen'),
      tbtn(['Schließen', h('span', { class: 'kbd' }, 'Esc')], 'Vorschau schließen', closePreview)), ...qBlock(q));
  } else if (cur) put(main, ...qBlock(cur));
  else {
    const n = qs.filter((q) => q.st === 'vorgelesen').length;
    put(main, h('div', { class: 'st-done' }, ico('check', 30), h('h3', null, 'Antwortrunde 2 abgeschlossen'),
      h('p', null, n + ' von ' + qs.length + ' Antworten vorgelesen' + (n < qs.length ? ', ' + (qs.length - n) + ' zurückgegeben' : '') + '.'),
      tbtn('Runde neu starten (Demo)', 'Runde neu starten', resetRound)));
  }
  put($('#st-list'), 
    h('div', { class: 'sl-head' }, h('span', null, 'Meine Setliste'), h('span', null, 'Runde 2')),
    h('ol', { class: 'sl' }, qs.map((q, i) => {
      const done = q.st === 'vorgelesen'; const isCur = q === cur; const ret = !done && q.st !== 'buehne';
      const meta = done ? 'vorgelesen ' + fmt(q.dAt) : ret ? 'zurückgegeben' : isCur ? 'jetzt' : 'ca. ' + dur(secsFor(POOL[q.p].a));
      return h('li', null, h('button', { class: 'sl-item' + (done ? ' done' : '') + (isCur ? ' cur' : '') + (TP.preview === q.id ? ' prev' : ''), type: 'button', 'aria-current': isCur ? 'step' : null, onmousedown: (e) => e.preventDefault(), onclick: () => openPreview(q.id) },
        h('span', { class: 'i' }, i + 1), h('span', { class: 't' }, POOL[q.p].q), h('span', { class: 'm' }, h('span', null, q.id), h('span', null, meta))));
    })));
  const dis = !cur || !!TP.preview;
  holdBtn.hidden = TP.ret;
  holdBtn.setAttribute('aria-disabled', String(dis));
  holdBtn.querySelector('.hold-l').textContent = TP.preview ? 'Vorschau offen' : cur ? 'Halten: vorgelesen, weiter' : 'Runde abgeschlossen';
  $('#st-return').hidden = TP.ret || !cur || !!TP.preview;
  const rb = $('#st-retbox'); rb.hidden = !TP.ret;
  if (TP.ret) put(rb, h('span', null, 'Zurück an das Versammlungsbüro. Grund:'),
    ['Zahl nicht mehr aktuell', 'Frage schon beantwortet', 'Anderer Grund'].map((r) => tbtn(r, r, () => doReturn(r))),
    tbtn('Abbrechen', 'Abbrechen', () => { TP.ret = false; renderTP(); }));
}
function openPreview(id) { const cur = curTP(); TP.preview = cur && cur.id === id ? null : id; renderTP(); }
function closePreview() { TP.preview = null; renderTP(); }
function holdBegin() {
  if (holdRaf || holdBtn.getAttribute('aria-disabled') === 'true' || holdBtn.hidden) return;
  holdStart = performance.now();
  clearTimeout(holdHintT);
  holdBtn.querySelector('.hold-l').textContent = 'Weiter halten …';
  const step = (t) => {
    const p = Math.min(1, (t - holdStart) / HOLD_MS);
    holdBtn.style.setProperty('--p', p);
    if (p >= 1) { holdRaf = 0; holdBtn.style.setProperty('--p', 0); deliver(); return; }
    holdRaf = requestAnimationFrame(step);
  };
  holdRaf = requestAnimationFrame(step);
}
function holdCancel() {
  const early = !!holdRaf;
  if (holdRaf) cancelAnimationFrame(holdRaf);
  holdRaf = 0; holdBtn.style.setProperty('--p', 0);
  // Released too soon: say so, then restore the label.
  if (early) { holdBtn.querySelector('.hold-l').textContent = 'Etwas länger halten'; clearTimeout(holdHintT); holdHintT = setTimeout(() => { if (!holdRaf) renderTP(); }, 1300); }
}
function setOnly(on) {
  TP.only = on;
  document.body.classList.toggle('stage-only', on && view === 'teleprompter');
  renderTP();
}
function deliver() {
  const q = curTP(); if (!q || TP.preview) return;
  q.st = 'vorgelesen'; q.dAt = S.now; q.dBy = 'cfo'; q.hist.push({ s: 'vorgelesen', at: S.now });
  renderTP();
  toast(q.id + ' als vorgelesen markiert', { ms: 5000, undo: () => { q.st = 'buehne'; q.dAt = null; q.dBy = null; q.hist.pop(); renderTP(); } });
}
function doReturn(reason) {
  const q = curTP(); if (!q) return;
  q.st = 'erfasst'; q.returned = reason; q.hist.push({ s: 'erfasst', at: S.now }); TP.ret = false;
  renderTP();
  toast(q.id + ' zurückgegeben: ' + reason, { undo: () => { q.st = 'buehne'; q.returned = null; q.hist.pop(); renderTP(); } });
}
function resetRound() {
  for (const q of roundQs().slice(2)) {
    const k = q.hist.findIndex((x) => x.s === 'buehne');
    if (k >= 0) q.hist = q.hist.slice(0, k + 1);
    q.st = 'buehne'; q.dAt = null; q.dBy = null; q.returned = null;
  }
  renderTP();
}
function scheduleMsg() {
  if (TP.msgDone) return; TP.msgDone = true;
  setTimeout(() => {
    const later = roundQs().filter((q) => q.st === 'buehne')[2];
    TP.msg = { from: 'Versammlungsbüro', at: S.now, text: later ? 'Zu ' + later.id + ' kommt ein Nachtrag, in etwa zwei Minuten.' : 'Ein Nachtrag zur Runde folgt.' };
    if (view === 'teleprompter') renderTP();
  }, 3500);
}
