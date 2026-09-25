/* HV-Tool Zielbild (slice 089): helpers, synthetic data slice, shared state, tooltip, toast.
   Reference, not product code: no HvApi, no rights (_actions), no i18n dictionary, one synthetic data set.
   Take layout, wording, spacing and interaction from here; build the real thing in apps/web per its slice spec. */
/* ---------- helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
function put(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false).map((k) => (k instanceof Node ? k : document.createTextNode(String(k)))));
}
const ICON = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  play: '<path d="M6 4v16l14-8z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  table: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/>',
  max: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  msg: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  mark: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  chevU: '<path d="m18 15-6-6-6 6"/>',
  lines: '<path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/>',
  min: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>'
};
function ico(name, size = 16, cls = '') {
  const s = document.createElement('span');
  s.className = 'ico' + (cls ? ' ' + cls : '');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>';
  return s;
}
const pad = (n, l = 2) => String(n).padStart(l, '0');
const fmt = (m) => { const t = Math.floor(m); return pad(Math.floor(t / 60)) + ':' + pad(t % 60); };
const dur = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad(s % 60); };
const byC = (a, b) => a.c - b.c;
const words = (t) => (t.trim().match(/\S+/g) || []).length;
const secsFor = (t) => words(t.replace(/\*\*/g, '')) / 130 * 60;
const ageCls = (a) => (a >= 45 ? 'crit' : a >= 15 ? 'warn' : 'fresh');
const chip = (cls, ...kids) => h('span', { class: 'chip' + (cls ? ' ' + cls : '') }, ...kids);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const R = rng(20260925);
const pick = (arr) => arr[Math.floor(R() * arr.length)];
function ageChip(age, withNum) {
  const c = ageCls(age);
  const txt = withNum ? Math.round(age) + ' min' : (c === 'crit' ? 'über 45 min' : c === 'warn' ? '15 bis 45 min' : 'unter 15 min');
  return chip(c === 'fresh' ? '' : c, ico(c === 'crit' ? 'alert' : 'clock', 13), txt);
}

/* ---------- a small slice of the synthetic seed (packages/domain/src/seed.ts), numbers filled in */
const STAGES = { cfo: 'Finanzvorstand', ceo: 'Vorstandsvorsitz', arv: 'Aufsichtsratsvorsitz', vm: 'Vorstandsmitglied' };
const UNITS = { fin: 'Finanzen', recht: 'Recht', pers: 'Personal', esg: 'Nachhaltigkeit', strat: 'Strategie', ops: 'Operations' };
const LABEL = { erfasst: 'Erfasst', fachbereich: 'Beim Fachbereich', legal: 'Im Legal Clearing', frei: 'Freigegeben', buehne: 'Auf der Bühne', vorgelesen: 'Vorgelesen' };
const ORDER = ['erfasst', 'fachbereich', 'legal', 'frei', 'buehne', 'vorgelesen'];
const POOL = {
  p1: { u: 'fin', s: ['cfo'], q: 'Wie hoch war die Ausschüttungsquote im Geschäftsjahr 2025, und welche Quote strebt der Vorstand mittelfristig an?', a: 'Die Ausschüttungsquote lag im Geschäftsjahr 2025 bei 47 Prozent des bereinigten Konzernergebnisses. Mittelfristig streben wir eine Quote zwischen 40 und 60 Prozent an, wie im Geschäftsbericht auf Seite 42 dargestellt.' },
  p2: { u: 'fin', s: ['cfo'], q: 'Warum wird die Dividende trotz gestiegenem Free Cashflow nur um 5 Cent angehoben?', a: 'Der Vorschlag zur Gewinnverwendung berücksichtigt neben dem Free Cashflow auch den Investitionsbedarf des laufenden Jahres von rund 1,4 Milliarden Euro. Die **Dividendenkontinuität** hat für uns Vorrang vor einer einmalig höheren Ausschüttung.' },
  p3: { u: 'fin', s: ['cfo'], q: 'Wie hoch ist die Nettoverschuldung im Verhältnis zum EBITDA, und welchen Zielkorridor verfolgt die Gesellschaft?', a: 'Die Nettoverschuldung betrug zum Bilanzstichtag das 1,6-fache des EBITDA. Unser Zielkorridor liegt zwischen dem 1,0- und dem 2,0-fachen. Die Finanzierungsstruktur ist im Konzernanhang dargestellt.' },
  p4: { u: 'fin', s: ['cfo'], q: 'Welche Ratingveränderungen gab es im Berichtsjahr, und wie bewertet der Vorstand das Risiko einer Herabstufung?', a: 'Beide Ratingagenturen haben das Rating im Berichtsjahr mit **stabilem Ausblick** bestätigt. Auf Basis der Verschuldungskennzahlen sieht der Vorstand kein erhöhtes Risiko einer Herabstufung.' },
  p5: { u: 'fin', s: ['cfo'], q: 'Wie hoch waren die Zinsaufwendungen im Geschäftsjahr 2025, und wie wirkt sich das Zinsniveau auf die Planung aus?', a: 'Die Zinsaufwendungen lagen im Geschäftsjahr 2025 bei 212 Millionen Euro. Rund 85 Prozent der Finanzverbindlichkeiten sind festverzinslich. Die Planung ist gegenüber Zinsänderungen daher weitgehend unempfindlich.' },
  p6: { u: 'fin', s: ['arv', 'cfo'], q: 'Wie hoch war das Honorar des Abschlussprüfers im Geschäftsjahr 2025, und welcher Anteil entfiel auf Nichtprüfungsleistungen?', a: 'Das Honorar des Abschlussprüfers betrug im Geschäftsjahr 2025 8,4 Millionen Euro. Der Anteil der Nichtprüfungsleistungen lag bei 12 Prozent und damit innerhalb der gesetzlichen Grenze.' },
  p7: { u: 'fin', s: ['cfo'], q: 'Wie hoch war der Free Cashflow im Geschäftsjahr 2025, und wie wurde er verwendet?', a: 'Der Free Cashflow lag im Geschäftsjahr 2025 bei 1,1 Milliarden Euro. Rund 58 Prozent flossen in die Dividende, der Rest in die Rückführung von Finanzverbindlichkeiten.' },
  p8: { u: 'fin', s: ['cfo'], q: 'Wurde geprüft, statt einer Dividendenerhöhung ein Aktienrückkaufprogramm aufzulegen?', a: 'Ein Aktienrückkauf wurde im Rahmen der Kapitalallokation geprüft. Der Vorstand hat sich für die Dividende entschieden, weil sie allen Aktionären gleichermaßen zugutekommt.' },
  p16: { u: 'fin', s: ['cfo'], q: 'Welche Fälligkeiten stehen im kommenden Geschäftsjahr an, und zu welchen Konditionen wurde zuletzt refinanziert?', a: 'Im kommenden Geschäftsjahr werden Anleihen über 750 Millionen Euro fällig. Die letzte Refinanzierung erfolgte über eine Anleihe mit einem Kupon von 3,25 Prozent und siebenjähriger Laufzeit.' },
  p17: { u: 'fin', s: ['cfo'], q: 'Welche besonders wichtigen Prüfungssachverhalte hat der Abschlussprüfer im Bestätigungsvermerk benannt?', a: 'Der Bestätigungsvermerk benennt zwei besonders wichtige Prüfungssachverhalte. Das sind die Werthaltigkeit der Geschäfts- oder Firmenwerte und die Bewertung der Rückstellungen für Rechtsstreitigkeiten.' },
  p18: { u: 'fin', s: ['cfo'], q: 'Warum wurde die Prognose im dritten Quartal gesenkt, obwohl der Vorstand kurz zuvor die Ziele bestätigt hatte?', a: 'Die Anpassung beruhte auf der kurzfristigen Nachfrageabschwächung in Nordamerika. Sie zeichnete sich erst nach der Bestätigung der Ziele ab. Der Vorstand hat den Kapitalmarkt **am Tag der Erkenntnis** informiert.' },
  p9: { u: 'strat', s: ['ceo'], q: 'Welche Auswirkungen hatten die US-Zölle auf das Ergebnis des Geschäftsjahres 2025?', a: 'Die US-Zölle belasteten das Ergebnis des Geschäftsjahres 2025 mit rund 180 Millionen Euro. Ein Teil wurde durch Preisanpassungen und lokale Fertigung kompensiert.' },
  p10: { u: 'esg', s: ['ceo', 'vm'], q: 'Bis wann will die Gesellschaft Klimaneutralität in Scope 3 erreichen, und welche Zwischenziele gelten?', a: 'Für Scope 3 gilt das Ziel der Klimaneutralität bis 2045. Bis 2030 wollen wir die Emissionen um 30 Prozent gegenüber dem Basisjahr senken.' },
  p11: { u: 'esg', s: ['vm'], q: 'Wie viele Lieferanten wurden im Berichtsjahr nach dem Lieferkettensorgfaltspflichtengesetz geprüft?', a: 'Im Berichtsjahr wurden 920 Lieferanten mit erhöhtem Risikoprofil geprüft. In 5 Fällen wurden Abhilfemaßnahmen vereinbart.' },
  p12: { u: 'pers', s: ['arv'], q: 'Wie hoch war die Zielerreichung der kurzfristigen variablen Vergütung des Vorstands?', a: 'Die Zielerreichung lag im Geschäftsjahr 2025 bei 96 Prozent. Maßgeblich waren das bereinigte EBIT, der Free Cashflow und ein Nachhaltigkeitsfaktor.' },
  p13: { u: 'recht', s: ['ceo'], q: 'Gab es im Berichtsjahr Cyberangriffe mit Auswirkungen auf den Geschäftsbetrieb?', a: 'Im Berichtsjahr wurden 4 sicherheitsrelevante Vorfälle registriert. Keiner davon hatte Auswirkungen auf den Geschäftsbetrieb.' },
  p14: { u: 'ops', s: ['vm'], q: 'Welche Fortschritte gibt es beim Bau des neuen Werks, und liegt das Projekt im Budget?', a: 'Das neue Werk liegt im Zeit- und Budgetplan. Die Inbetriebnahme ist für das dritte Quartal 2027 vorgesehen.' },
  p15: { u: 'pers', s: ['vm', 'ceo'], q: 'Welche Folgen hat der Einsatz künstlicher Intelligenz für die Beschäftigung in der Verwaltung?', a: 'Der Einsatz künstlicher Intelligenz führt nicht zu betriebsbedingten Kündigungen. Freiwerdende Kapazitäten werden über Qualifizierung gesteuert.' }
};
const FREE_POOL = ['p9', 'p10', 'p11', 'p12', 'p13', 'p14', 'p15'];

/* Prepared answers from the expectation map (Erwartungskarte), approved before the meeting. */
const EXPECT = {
  p1: { v: 'V-112', m: 94, at: '12.05.2026', from: 'Vorjahres-HV und Kapitalmarkttag' },
  p5: { v: 'V-087', m: 91, at: '12.05.2026', from: 'Analystencall Q4' },
  p7: { v: 'V-064', m: 88, at: '14.05.2026', from: 'Vorjahres-HV, Frage 12' }
};
const NEAR = { p6: { v: 'V-140', m: 41, t: 'Wechsel des Abschlussprüfers' } };
const DRAFT = { p1: 'Die Ausschüttungsquote lag im Geschäftsjahr 2025 bei 45 Prozent des bereinigten Konzernergebnisses und damit über dem Durchschnitt der Vergleichsgruppe von 41 Prozent. Vorgeschlagen ist eine Dividende von 2,10 Euro je Aktie.' };

/* ---------- state: one data model behind all three views */
const S = { now: 15 * 60 + 42, qs: [], byId: new Map(), speakers: [], mine: [], round: [], nextN: 1, added: 0, refQ: null };
const FIRST = ['Doris', 'Klaus', 'Tanja', 'Holger', 'Lena', 'Markus', 'Frauke', 'Norbert', 'Vera', 'Stefan', 'Nadine', 'Ingo', 'Hanna', 'Jörg', 'Birgit', 'Olaf', 'Renate', 'Uwe', 'Julia', 'Bernd'];
const LAST = ['Conrad', 'Thalmann', 'Ostermann', 'Dallmann', 'Hartwig', 'Ulbrich', 'Seidel', 'Grunwald', 'Lindenau', 'Pfeiffer', 'Rehberg', 'Kessler', 'Ahrens', 'Nowak', 'Bachmann', 'Zeller', 'Vogt', 'Ebert', 'Mertens', 'Quednau'];
const ORGS = ['Aktionärsverein Nordlicht', 'Fondsgesellschaft Nord', 'Schutzgemeinschaft Musterstadt', 'Pensionskasse Süd', 'Stiftung Kapital'];

function addQ(sp, c, st) {
  const n = S.nextN++;
  const q = { id: 'F-' + pad(n, 4), n, sp, c, st, p: null, unit: null, stage: null, hist: [], mine: false, dAt: null, dBy: null, returned: null };
  S.qs.push(q); S.byId.set(q.id, q); S.speakers[sp].qs.push(q.id);
  return q;
}
function setPool(q, p) { q.p = p; q.unit = POOL[p].u; }
function genHist(q) {
  const si = ORDER.indexOf(q.st);
  const t0 = q.c + 0.6;
  q.hist = [{ s: 'erfasst', at: t0 }];
  if (si === 0) return;
  let end;
  if (q.st === 'vorgelesen') {
    if (q.dAt === null) { q.dAt = Math.min(S.now - 3, q.c + 20 + R() * 30); q.dBy = q.stage; }
    end = q.dAt;
  } else end = t0 + (S.now - t0) * (0.5 + 0.45 * R());
  const w = Array.from({ length: si }, () => 0.5 + R());
  const sum = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let k = 1; k <= si; k++) { acc += w[k - 1] / sum; q.hist.push({ s: ORDER[k], at: k === si ? end : t0 + (end - t0) * acc }); }
}
function generate() {
  for (let k = 0; k < 21; k++) {
    const at = k < 14 ? 675 + Math.round(k * 15) : k < 20 ? 885 + (k - 14) * 9 : 940;
    S.speakers.push({ k, no: k + 1, name: FIRST[(k + Math.floor(k / 20) * 3) % 20] + ' ' + LAST[(k * 7) % 20], org: k % 3 === 1 ? ORGS[k % ORGS.length] : null, at, qs: [] });
  }
  const raw = [];
  for (const sp of S.speakers) {
    if (sp.k === 20) continue; // the current speaker, questions arrive live
    const n = sp.k < 14 ? 6 + Math.floor(R() * 5) : 8 + Math.floor(R() * 3);
    for (let j = 0; j < n; j++) raw.push({ sp: sp.k, c: sp.at + 2 + j * 0.9 });
  }
  raw.sort((a, b) => a.c - b.c).forEach((r) => addQ(r.sp, r.c, 'vorgelesen'));
  // youngest questions are furthest behind in the process
  const young = [...S.qs].sort((a, b) => b.c - a.c);
  const bands = [['erfasst', 5], ['fachbereich', 11], ['legal', 14], ['frei', 8], ['buehne', 9]];
  let i = 0;
  for (const [st, cnt] of bands) for (let j = 0; j < cnt; j++) young[i++].st = st;
  for (let j = 0; j < i - 1; j++) if (R() < 0.18) { const a = young[j], b = young[j + 1]; const t = a.st; a.st = b.st; b.st = t; }
  // the oldest open question is stuck at the Finance desk: that is the story of the prototype
  const hero = S.qs.filter((q) => q.st !== 'vorgelesen').sort(byC)[0];
  hero.st = 'fachbereich';
  const fb = S.qs.filter((q) => q.st === 'fachbereich' && q !== hero).sort(byC);
  const lg = S.qs.filter((q) => q.st === 'legal').sort(byC);
  [[hero, 'p1'], [fb[0], 'p5'], [fb[1], 'p7'], [fb[2], 'p6'], [lg[1], 'p8']].forEach(([q, p]) => { setPool(q, p); q.mine = true; q.stage = 'cfo'; S.mine.push(q.id); });
  // the Finance board member's answer round: two read already, four waiting on stage
  const bu = S.qs.filter((q) => q.st === 'buehne').sort(byC).slice(0, 4);
  const vg = S.qs.filter((q) => q.st === 'vorgelesen').sort((a, b) => b.c - a.c).slice(0, 2).reverse();
  vg.forEach((q, j) => { setPool(q, ['p3', 'p4'][j]); q.stage = 'cfo'; q.dAt = 936 + j * 3; q.dBy = 'cfo'; });
  bu.forEach((q, j) => { setPool(q, ['p2', 'p16', 'p17', 'p18'][j]); q.stage = 'cfo'; });
  S.round = [...vg, ...bu].map((q) => q.id);
  // an answer read earlier, which the draft on the Finance desk contradicts
  S.refQ = S.qs.find((q) => q.st === 'vorgelesen' && q.c > 780 && q.c < 840 && !q.p);
  setPool(S.refQ, 'p1'); S.refQ.stage = 'cfo';
  for (const sp of S.speakers) {
    const used = new Set(sp.qs.map((id) => S.byId.get(id).p).filter(Boolean));
    for (const id of sp.qs) {
      const q = S.byId.get(id); if (q.p) continue;
      const left = FREE_POOL.filter((p) => !used.has(p));
      const p = pick(left.length ? left : FREE_POOL); used.add(p); setPool(q, p);
    }
  }
  for (const q of S.qs) if (!q.stage) q.stage = pick(POOL[q.p].s);
  for (const q of S.qs) genHist(q);
}
generate();

/* Figures the number check knows, as found in the (fictional) annual report. */
const FACTS = {
  '47 Prozent': { st: 'ok', src: 'Geschäftsbericht 2025, S. 42' },
  '40 Prozent': { st: 'ok', src: 'Dividendenpolitik, Kapitalmarkttag März 2026' },
  '60 Prozent': { st: 'ok', src: 'Dividendenpolitik, Kapitalmarkttag März 2026' },
  '45 Prozent': { st: 'conflict', fix: '47 Prozent', src: 'Geschäftsbericht 2025, S. 42 und ' + S.refQ.id + ' (vorgelesen ' + fmt(S.refQ.dAt) + ') nennen 47 Prozent.' },
  '2,10 Euro': { st: 'conflict', fix: '1,85 Euro', src: 'Die Einladung zur Hauptversammlung (TOP 2) schlägt 1,85 Euro vor.' },
  '1,85 Euro': { st: 'ok', src: 'Einladung zur Hauptversammlung, TOP 2' },
  '212 Millionen Euro': { st: 'ok', src: 'Konzernanhang, Nr. 11' },
  '85 Prozent': { st: 'ok', src: 'Konzernanhang, Nr. 27' },
  '1,1 Milliarden Euro': { st: 'ok', src: 'Kapitalflussrechnung, Geschäftsbericht S. 118' },
  '58 Prozent': { st: 'ok', src: 'Kapitalflussrechnung, Geschäftsbericht S. 118' },
  '8,4 Millionen Euro': { st: 'ok', src: 'Konzernanhang, Nr. 38' },
  '12 Prozent': { st: 'ok', src: 'Konzernanhang, Nr. 38' }
};
const factFor = (key) => FACTS[key] || { st: 'none', src: 'Keine Quelle gefunden. Beleg ergänzen oder Zahl prüfen.' };
const FACT_LABEL = { ok: 'belegt', none: 'ohne Beleg', conflict: 'Widerspruch' };

/* ---------- shared UI: tooltip, toast, notes, views */
const tip = $('#tip');
function showTip(e, title, body) {
  put(tip, h('b', null, title), body ? h('span', null, body) : null);
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14, y = e.clientY + 16;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 10;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 12;
  tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
}
const hideTip = () => { tip.hidden = true; };

let toastTimer = null, toastUndo = null;
function toast(msg, opt = {}) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  const ms = opt.ms || 4000;
  toastUndo = opt.undo || null;
  const bar = h('span', { class: 'tbar' });
  put(el, h('span', null, msg),
    toastUndo ? h('button', { type: 'button', onclick: runUndo }, ico('undo', 14), 'Rückgängig', view === 'teleprompter' ? h('span', { class: 'kbd' }, '⌫') : null) : null,
    bar);
  el.hidden = false;
  bar.style.transform = 'scaleX(1)';
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = 'transform ' + ms + 'ms linear'; bar.style.transform = 'scaleX(0)'; }));
  toastTimer = setTimeout(hideToast, ms);
}
function hideToast() { $('#toast').hidden = true; toastUndo = null; }
function runUndo() { const u = toastUndo; hideToast(); if (u) { u(); toast('Rückgängig gemacht', { ms: 1800 }); } }
const vhead = (title, sub) => h('header', { class: 'vhead' }, h('h2', null, title), h('p', null, sub));
let view = 'schreibraum';
