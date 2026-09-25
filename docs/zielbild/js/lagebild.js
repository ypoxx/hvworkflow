/* HV-Tool Zielbild (slice 089): Lagebild, the meeting office overview (target slices 061, 087, 050).
   Reference, not product code: no HvApi, no rights (_actions), no i18n dictionary, one synthetic data set.
   Take layout, wording, spacing and interaction from here; build the real thing in apps/web per its slice spec. */
/* ---------- Lagebild: the meeting office sees the whole flow */
const LB = { sel: S.mine[0], table: false, onlyOpen: false, open: new Set(), live: !reduced, timer: null,
  wid: { sp: 8, at: 939, top: 'TOP 6 · Billigung des Vergütungsberichts', kind: 'Widerspruch zur Niederschrift', handed: null } };
const dotEls = new Map();
const RATE = 9; // clearances per 15 minutes, the pace the forecasts assume
const lastAt = (q) => q.hist[q.hist.length - 1].at;
const count = (st) => S.qs.filter((q) => q.st === st).length;

function buildLB() {
  const v = $('#v-lagebild');
  v.append(vhead('Lagebild', 'Versammlungsbüro · alle Einzelfragen auf einen Blick'));
  const legend = h('div', { class: 'legend', 'aria-label': 'Legende' },
    h('span', { class: 'lg' }, h('i', { class: 'sw fresh' }), 'unter 15 min'),
    h('span', { class: 'lg' }, h('i', { class: 'sw warn' }), '15 bis 45 min'),
    h('span', { class: 'lg' }, h('i', { class: 'sw crit' }), 'über 45 min'),
    h('span', { class: 'lg' }, h('i', { class: 'sw done' }), 'vorgelesen'));
  const liveBtn = h('button', { class: 'btn sm', type: 'button', 'data-act': 'live', 'aria-pressed': String(LB.live), onclick: () => { LB.live = !LB.live; updateSim(); renderLiveBtn(); } });
  const tableBtn = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: (e) => { LB.table = !LB.table; e.currentTarget.setAttribute('aria-pressed', String(LB.table)); renderFlow(); } }, ico('table', 14), 'Tabelle');
  const map = h('div', { class: 'flow-map', id: 'flow-map' }, h('div', { class: 'cols', id: 'flow-cols' }), h('div', { class: 'dots', id: 'flow-dots' }));
  map.addEventListener('pointermove', (e) => {
    const d = e.target.closest && e.target.closest('.dot');
    if (!d) { hideTip(); return; }
    const q = S.byId.get(d.dataset.id);
    const age = Math.round(S.now - q.c);
    showTip(e, q.id + ' · ' + LABEL[q.st], (q.st === 'vorgelesen' ? 'vorgelesen ' + fmt(q.dAt) + ' · ' + STAGES[q.dBy] : 'offen seit ' + age + ' min · ' + (q.st === 'erfasst' ? 'noch nicht zugewiesen' : UNITS[q.unit])) + '\n' + POOL[q.p].q);
  });
  map.addEventListener('pointerleave', hideTip);
  map.addEventListener('click', (e) => { const d = e.target.closest && e.target.closest('.dot'); if (!d) return; LB.sel = d.dataset.id; renderFlow(); renderDetail(); });
  v.append(h('div', { class: 'lb' },
    h('div', { id: 'lb-alarm' }),
    h('div', { class: 'sum', id: 'lb-sum' }),
    h('section', { class: 'panel flow', 'aria-labelledby': 'flow-h' },
      h('div', { class: 'fhead' }, h('h3', { id: 'flow-h' }, 'Fluss der Einzelfragen'), legend, h('div', { class: 'fctl' }, liveBtn, tableBtn)),
      map, h('div', { id: 'flow-table', hidden: true }), h('div', { class: 'fdetail', id: 'flow-detail' })),
    h('section', { class: 'panel wall', 'aria-labelledby': 'wall-h' },
      h('div', { class: 'whead' }, h('h3', { id: 'wall-h' }, 'Rednerwand'), h('span', { class: 'wsum', id: 'wall-sum' }),
        h('div', { class: 'legend', style: 'margin-left:auto' }, h('span', { class: 'lg' }, h('i', { class: 'wd done' }), 'beantwortet'), h('span', { class: 'lg' }, h('i', { class: 'wd open' }), 'offen, Rand zeigt das Alter')),
        ),
      h('div', { id: 'wall-rows' }))));
  renderLiveBtn();
  new ResizeObserver(() => { if (view === 'lagebild') renderFlow(); }).observe(map);
}
function renderLiveBtn() {
  const b = $('[data-act="live"]');
  b.setAttribute('aria-pressed', String(LB.live));
  put(b, ico(LB.live ? 'pause' : 'play', 14), LB.live ? 'Live' : 'Pausiert');
  b.title = LB.live ? 'Zeitraffer anhalten' : 'Zeitraffer starten, eine Minute je 2,5 Sekunden';
}
function renderAlarm() {
  const w = LB.wid; const sp = S.speakers[w.sp]; const box = $('#lb-alarm');
  if (!w.handed) {
    put(box, h('div', { class: 'alarm' }, ico('shield', 18),
      h('div', { class: 'al-t' }, h('b', null, w.kind), h('span', null, 'Wortmeldung ' + sp.no + ' · ' + sp.name + ' · ' + fmt(w.at) + ' · ' + w.top)),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { w.handed = S.now; renderAlarm(); toast('An den Notar übergeben, Empfang bestätigt'); } }, 'An Notar übergeben')));
  } else {
    put(box, h('div', { class: 'alarm done' }, ico('check', 18),
      h('div', { class: 'al-t' }, h('b', null, w.kind + ' an den Notar übergeben'), h('span', null, fmt(w.handed) + ' · Empfang bestätigt · Wortmeldung ' + sp.no + ' · ' + w.top))));
  }
}
function sparkline(bins) {
  const W = 104, H = 34, max = Math.max(...bins, 1), n = bins.length;
  const pts = bins.map((v, i) => [(i / (n - 1)) * (W - 8) + 4, H - 4 - (v / max) * (H - 10)]);
  const line = pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = 'M' + pts[0][0] + ',' + (H - 2) + ' L' + line.replace(/ /g, ' L') + ' L' + pts[n - 1][0] + ',' + (H - 2) + ' Z';
  const last = pts[n - 1];
  const s = document.createElement('span');
  s.innerHTML = '<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
    '<path d="' + area + '" style="fill:var(--ink-4);opacity:.12"/>' +
    '<polyline points="' + line + '" style="fill:none;stroke:var(--ink-4);stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>' +
    '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" style="fill:var(--accent);stroke:var(--surface);stroke-width:2"/></svg>';
  return s.firstChild;
}
function tile(label, val, sub, extraHead, cls, extraVal) {
  return h('div', { class: 'panel tile ' + (cls || '') }, h('div', { class: 'tile-h' }, h('span', { class: 'cap' }, label), extraHead),
    h('div', { class: 'tile-v' }, h('span', { class: 'val' }, String(val)), extraVal), h('span', { class: 'sub' }, sub));
}
function renderSum() {
  const open = S.qs.filter((q) => q.st !== 'vorgelesen');
  const sorted = [...open].sort(byC); const oldest = sorted[0]; const next = sorted.slice(1, 4);
  const legal = count('legal'), frei = count('frei'), done = count('vorgelesen');
  const need = Math.max(0, 20 - frei);
  const bins = Array.from({ length: 12 }, (_, i) => S.qs.filter((q) => q.c >= S.now - 60 + i * 5 && q.c < S.now - 55 + i * 5).length);
  const age = oldest ? S.now - oldest.c : 0; const sp = oldest ? S.speakers[oldest.sp] : null;
  put($('#lb-sum'), 
    h('div', { class: 'panel tile hero' },
      h('span', { class: 'cap' }, 'Älteste unbeantwortete Frage'),
      h('div', { class: 'hero-row' }, h('span', { class: 'val' }, String(Math.round(age)), h('small', null, 'min')), ageChip(age)),
      oldest ? h('span', { class: 'sub' }, oldest.id + ' · ' + LABEL[oldest.st] + (oldest.st !== 'erfasst' ? ' ' + UNITS[oldest.unit] : '') + ' · Wortmeldung ' + sp.no) : null,
      oldest && oldest.mine && oldest.st === 'fachbereich' ? h('button', { class: 'btn sm', type: 'button', onclick: () => openInSR(oldest.id) }, 'Im Schreibraum öffnen', ico('arrow', 14)) : null,
      next.length ? h('div', { class: 'hero-next' }, h('span', { class: 'cap' }, 'Danach die ältesten'), h('ol', null, next.map((q) => h('li', null, h('span', { class: 'mono' }, q.id), h('span', null, LABEL[q.st] + (q.st !== 'erfasst' ? ' · ' + UNITS[q.unit] : '')), h('span', { class: 'mono age ' + ageCls(S.now - q.c) }, Math.round(S.now - q.c) + ' min'))))) : null),
    tile('Offene Einzelfragen', open.length, 'von ' + S.qs.length + ' erfassten · ' + done + ' vorgelesen'),
    tile('Im Legal Clearing', legal, 'abgebaut ca. ' + fmt(S.now + legal / RATE * 15) + ' bei ' + RATE + ' Freigaben je 15 min', legal >= 12 ? chip('warn', ico('alert', 12), 'Engpass') : null, 'tile-legal'),
    tile('Nächste Antwortrunde', Math.min(frei, 20) + ' von 20', need ? 'freigegeben, voll ca. ' + fmt(S.now + need / RATE * 15) : 'bereit zur Zusammenstellung', null, 'tile-round'),
    tile('Zulauf je 5 min', bins[11], 'letzte Stunde, neue Einzelfragen', null, 'tile-in', sparkline(bins)));
}
function renderFlow() {
  const map = $('#flow-map'); const table = $('#flow-table');
  map.hidden = LB.table; table.hidden = !LB.table;
  if (LB.table) { renderFlowTable(); return; }
  const W = map.clientWidth; if (!W) return;
  const wide = W >= 700;
  const groups = {}; ORDER.forEach((s) => { groups[s] = []; });
  S.qs.forEach((q) => groups[q.st].push(q));
  ORDER.forEach((s) => groups[s].sort(byC));
  const pos = new Map(); const cols = []; let H = 0;
  const HEAD = wide ? 86 : 80;
  ORDER.forEach((s, ci) => {
    const done = s === 'vorgelesen'; const d = done ? 9 : 16;
    const x0 = wide ? ci * (W / 6) : 0; const cw = wide ? W / 6 : W; const y0 = wide ? 0 : H;
    const per = Math.max(1, Math.floor((cw - 20) / d));
    groups[s].forEach((q, i) => pos.set(q.id, [x0 + 10 + (i % per) * d, y0 + HEAD + Math.floor(i / per) * d]));
    const hgt = HEAD + Math.max(1, Math.ceil(groups[s].length / per)) * d + 14;
    cols.push({ s, x: x0, y: y0, w: cw, hgt });
    H = wide ? Math.max(H, hgt) : H + hgt;
  });
  map.style.height = H + 'px';
  const busiest = ['fachbereich', 'legal', 'frei', 'buehne'].reduce((a, b) => (groups[b].length > groups[a].length ? b : a));
  put($('#flow-cols'), ...cols.map((c, i) => h('div', { class: 'col' + (i === 0 || !wide ? ' first' : ''), style: 'left:' + c.x + 'px;top:' + c.y + 'px;width:' + c.w + 'px;height:' + (wide ? H : c.hgt) + 'px' + (wide ? '' : ';border-top:' + (i ? '1px solid var(--line)' : '0')) },
    h('div', { class: 'colh' }, h('span', { class: 'cap' }, LABEL[c.s]),
      h('span', { class: 'n' }, groups[c.s].length, c.s === busiest && groups[c.s].length >= 12 ? chip('warn', ico('alert', 12), 'Engpass') : null),
      // Pace: how many arrived at this station in the last 15 minutes.
      h('span', { class: 'in', title: 'In den letzten 15 Minuten hier angekommen' }, '+' + S.qs.filter((q) => q.hist.some((x) => x.s === c.s && x.at >= S.now - 15)).length + ' in 15 min')))));
  const layer = $('#flow-dots'); const fresh = dotEls.size > 0;
  for (const q of S.qs) {
    const [x, y] = pos.get(q.id);
    const cls = 'dot ' + (q.st === 'vorgelesen' ? 'done' : ageCls(S.now - q.c)) + (q.mine ? ' mine' : '') + (q.id === LB.sel ? ' sel' : '');
    let el = dotEls.get(q.id);
    if (!el) {
      el = h('div', { class: cls, 'data-id': q.id });
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (fresh && !reduced) { el.style.opacity = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; })); }
      layer.append(el); dotEls.set(q.id, el);
    } else { el.className = cls; el.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
    const size = q.st === 'vorgelesen' ? 6 : 10;
    el.style.width = el.style.height = size + 'px';
  }
  map.setAttribute('aria-label', 'Fluss: ' + ORDER.map((s) => LABEL[s] + ' ' + groups[s].length).join(', ') + '. Die Tabelle zeigt dieselben Zahlen.');
  map.setAttribute('role', 'img');
}
function renderFlowTable() {
  const rows = ORDER.map((s) => {
    const qs = S.qs.filter((q) => q.st === s); const c = { fresh: 0, warn: 0, crit: 0 };
    if (s !== 'vorgelesen') qs.forEach((q) => { c[ageCls(S.now - q.c)]++; });
    const cells = s === 'vorgelesen' ? ['–', '–', '–'] : [c.fresh, c.warn, c.crit];
    return h('tr', null, h('th', { scope: 'row' }, LABEL[s]), cells.map((v) => h('td', { class: 'mono' }, v)), h('td', { class: 'mono' }, qs.length));
  });
  put($('#flow-table'), h('div', { class: 'tscroll' }, h('table', null,
    h('thead', null, h('tr', null, ['Stand', 'unter 15 min', '15 bis 45 min', 'über 45 min', 'gesamt'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', null, rows))));
}
function renderDetail() {
  const box = $('#flow-detail'); const q = LB.sel ? S.byId.get(LB.sel) : null;
  if (!q) { put(box, h('p', { class: 'muted' }, 'Klick auf einen Punkt zeigt den Faden der Frage: wann sie wo war.')); return; }
  const sp = S.speakers[q.sp]; const si = ORDER.indexOf(q.st);
  const stations = ORDER.map((s, i) => {
    const e = [...q.hist].reverse().find((x) => x.s === s);
    let t = '';
    if (i <= si && e) t = fmt(e.at);
    if (i === si && s !== 'vorgelesen' && e) t += ' · seit ' + Math.max(0, Math.round(S.now - e.at)) + ' min';
    if (s === 'vorgelesen' && q.dAt) t = fmt(q.dAt) + ' · ' + STAGES[q.dBy];
    return h('li', { class: 'stn' + (i < si ? ' on' : i === si ? ' cur' : '') }, h('span', { class: 'pt' }), h('span', { class: 'sl' }, LABEL[s]), h('span', { class: 'st mono' }, t || ' '));
  });
  put(box, 
    h('div', { class: 'fd-head' }, h('span', { class: 'qno' }, q.id), h('span', { class: 'fd-who' }, 'Wortmeldung ' + sp.no + ' · ' + sp.name),
      chip('', q.st === 'erfasst' ? 'noch nicht zugewiesen' : UNITS[q.unit]), chip('', 'Bühne: ' + STAGES[q.stage]),
      q.mine && q.st === 'fachbereich' ? h('button', { class: 'btn sm', type: 'button', onclick: () => openInSR(q.id) }, 'Im Schreibraum öffnen', ico('arrow', 14)) : null,
      h('button', { class: 'tb fd-x', type: 'button', 'aria-label': 'Faden schließen', onclick: () => { LB.sel = null; renderFlow(); renderDetail(); } }, ico('x', 16))),
    h('p', { class: 'fd-q' }, POOL[q.p].q),
    h('ol', { class: 'thread', 'aria-label': 'Faden der Frage' }, stations));
}
function renderWall() {
  const openRows = [], doneRows = []; let withOpen = 0, total = 0, worst = 0, doneSp = 0, doneQs = 0;
  for (const sp of S.speakers) {
    const qs = sp.qs.map((id) => S.byId.get(id));
    const open = qs.filter((q) => q.st !== 'vorgelesen');
    const speaking = sp.k === S.speakers.length - 1;
    if (!qs.length && !speaking) continue;
    total++;
    if (open.length) withOpen++;
    open.forEach((q) => { worst = Math.max(worst, S.now - q.c); });
    const target = open.length || speaking ? openRows : doneRows;
    if (target === doneRows) { doneSp++; doneQs += qs.length; }
    const ex = LB.open.has(sp.k);
    target.push(h('button', { class: 'wrow', type: 'button', 'aria-expanded': String(ex), onclick: () => { if (ex) LB.open.delete(sp.k); else LB.open.add(sp.k); renderWall(); } },
      h('span', { class: 'wno' }, pad(sp.no)),
      h('span', { class: 'wname' }, h('b', null, sp.name), h('span', null, sp.org || 'Aktionärin oder Aktionär'), speaking ? chip('accent', 'spricht gerade') : null),
      h('span', { class: 'wdots', 'aria-hidden': 'true' }, qs.map((q) => h('i', { class: 'wd ' + (q.st === 'vorgelesen' ? 'done' : 'open ' + ageCls(S.now - q.c)) }))),
      h('span', { class: 'wcnt', 'aria-label': (qs.length - open.length) + ' von ' + qs.length + ' beantwortet' }, (qs.length - open.length) + '/' + qs.length),
      ico(ex ? 'chevU' : 'chevD', 16, 'wchev')));
    if (ex) target.push(h('div', { class: 'wexp' }, qs.length ? qs.map((q) => {
      const doneQ = q.st === 'vorgelesen'; const a = S.now - q.c;
      return h('div', { class: 'wq' }, h('span', { class: 'mono' }, q.id), h('span', null, POOL[q.p].q),
        h('span', { class: 'wq-s ' + (doneQ ? 'ok' : ageCls(a)) }, ico(doneQ ? 'check' : 'clock', 13), doneQ ? 'vorgelesen ' + fmt(q.dAt) + ' · ' + STAGES[q.dBy] : LABEL[q.st] + ' · seit ' + Math.max(0, Math.round(S.now - lastAt(q))) + ' min'));
    }) : h('p', { class: 'muted', style: 'padding:8px 0' }, 'Noch keine Einzelfragen erfasst.')));
  }
  // Complete speakers fold into one line: the check is about who still waits.
  const fold = doneSp ? h('button', { class: 'wrow wfold', type: 'button', 'aria-expanded': String(LB.showDone), onclick: () => { LB.showDone = !LB.showDone; renderWall(); } },
    h('span', { class: 'wno' }, ico('check', 15)),
    h('span', { class: 'wname' }, h('b', null, doneSp + ' Wortmeldungen vollständig beantwortet'), h('span', null, LB.showDone ? 'Zuklappen' : 'Aufklappen zeigt jede Antwort mit Uhrzeit')),
    h('span', { class: 'wcnt' }, doneQs + '/' + doneQs),
    ico(LB.showDone ? 'chevU' : 'chevD', 16, 'wchev')) : null;
  put($('#wall-rows'), openRows, fold, LB.showDone ? doneRows : null);
  const cls = withOpen ? (worst >= 45 ? 'crit' : 'warn') : 'ok';
  const sum = $('#wall-sum'); sum.className = 'wsum ' + cls;
  put(sum, ico(withOpen ? 'alert' : 'check', 16), withOpen ? 'Abschluss-Check: ' + withOpen + ' von ' + total + ' Wortmeldungen haben offene Fragen' : 'Abschluss-Check: alle Fragen beantwortet');
}
function renderLB() { renderAlarm(); renderSum(); renderFlow(); renderDetail(); renderWall(); }
function openInSR(id) { selectSR(id); setView('schreibraum'); }

/* ---------- time lapse: one simulated minute every 2.5 seconds while the Lagebild is open */
function simTick() {
  S.now += 1;
  const movable = (st) => S.qs.filter((q) => q.st === st && !S.round.includes(q.id) && !(q.mine && q.st === 'fachbereich'));
  const move = (q, st) => { if (!q) return; q.st = st; q.hist.push({ s: st, at: S.now - R() * 0.8 }); if (st === 'vorgelesen') { q.dAt = S.now; q.dBy = q.stage; } };
  if (R() < 0.55) move(movable('legal').sort(byC)[0], 'frei');
  if (R() < 0.5) move(pick(movable('fachbereich')), 'legal');
  if (R() < 0.4) move(movable('erfasst').sort(byC)[0], 'fachbereich');
  if (R() < 0.35) move(movable('frei').filter((q) => !q.mine).sort(byC)[0], 'buehne');
  if (R() < 0.4) move(movable('buehne').sort(byC)[0], 'vorgelesen');
  if (R() < 0.45 && S.added < 24) {
    const q = addQ(S.speakers.length - 1, S.now - R() * 0.5, 'erfasst');
    setPool(q, pick(FREE_POOL)); q.stage = pick(POOL[q.p].s); q.hist = [{ s: 'erfasst', at: q.c }]; S.added++;
  }
  $('#clock').textContent = fmt(S.now);
  if (view === 'lagebild') { renderSum(); renderFlow(); renderDetail(); renderWall(); }
}
function updateSim() {
  const on = LB.live && view === 'lagebild' && !document.hidden;
  if (on && !LB.timer) LB.timer = setInterval(simTick, 2500);
  if (!on && LB.timer) { clearInterval(LB.timer); LB.timer = null; }
}
document.addEventListener('visibilitychange', updateSim);
