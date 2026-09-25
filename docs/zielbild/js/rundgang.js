/* HV-Tool Zielbild (slice 089): guided tour through the three views (demo aid, not a product feature).
   Reference, not product code: no HvApi, no rights (_actions), no i18n dictionary, one synthetic data set.
   Take layout, wording, spacing and interaction from here; build the real thing in apps/web per its slice spec. */
/* ---------- guided tour: the story of the prototype in nine steps, with real clicks */
const TOUR = [
  { v: 'schreibraum', s: '.sr-list', pos: '', t: 'Nur die eigenen Fragen',
    d: () => { const todo = S.mine.map((id) => S.byId.get(id)).filter((q) => q.st === 'fachbereich').sort(byC); return 'Der Fachbereich Finanzen sieht nur seine ' + todo.length + ' offenen Fragen, die älteste oben' + (todo[0] ? ': ' + todo[0].id + ' wartet seit ' + Math.round(S.now - todo[0].c) + ' Minuten.' : '.'); } },
  { v: 'schreibraum', s: '#editor .num.conflict', f: '#editor', pos: 'l', t: 'Jede Zahl wird geprüft',
    d: 'Der Entwurf nennt 45 Prozent. Vorgelesen wurden an anderer Stelle 47 Prozent, und die Einladung schlägt 1,85 Euro vor. Rot markiert, bevor Recht danach suchen muss. Rechts steht die Korrektur per Klick.' },
  { v: 'schreibraum', s: '.hit', pos: 'l', t: 'Die Antwort liegt schon bereit',
    d: 'Die Erwartungskarte hat eine vor der HV freigegebene Antwort, 94 Prozent passend. Statt Zahl für Zahl zu korrigieren, wird sie übernommen.',
    act: 'Übernehmen', run: () => takeOver() },
  { v: 'schreibraum', s: '.checks', f: '#editor', pos: 'l', t: 'Alle Zahlen belegt',
    d: 'Jetzt sind alle Zahlen grün, die Belege gehen mit. Die Vorlesezeit liegt im Rahmen. Die Antwort kann ins Legal Clearing.',
    act: 'Weiterleiten', run: () => { const q = curSR(); if (q && q.st === 'fachbereich' && editor.innerText.trim()) forward(true); } },
  { v: 'lagebild', s: '.hero', pos: '', t: 'Das Lagebild hat es gemerkt',
    d: () => (S.byId.get(S.mine[0]).st !== 'fachbereich' ? 'Die älteste offene Frage ist jetzt eine andere. Diese eine Zahl zahlt direkt auf das Anfechtungsrisiko ein.' : 'Die älteste offene Frage steht groß oben. Diese eine Zahl zahlt direkt auf das Anfechtungsrisiko ein.') },
  { v: 'lagebild', s: '.flow-map', pos: '', t: 'Fluss statt Zähler',
    d: 'Jede Frage ist ein Punkt, die Farbe zeigt ihr Alter. Der Stau im Legal Clearing ist ohne Zahl zu sehen. Ein Klick auf einen Punkt zeigt den Faden der Frage.' },
  { v: 'lagebild', s: '.wall', pos: '', t: 'Abschluss-Check',
    d: 'Oben stehen nur die Wortmeldungen mit offenen Fragen. Fragt die Versammlungsleitung, ob alles beantwortet ist, liegt die Antwort hier: mit Uhrzeit und Vorstandsmitglied.' },
  { v: 'teleprompter', s: '.hold', pos: 't', t: 'Halten statt Tippen',
    d: 'Auf der Bühne geht es erst nach kurzem Halten weiter, per Finger, Maus oder Leertaste. Danach bleiben fünf Sekunden für Rückgängig. Probier es aus.' },
  { v: 'teleprompter', s: '.st-list', f: '.st-progress', pos: 'l', t: 'Die eigene Setliste',
    d: 'Jedes Vorstandsmitglied hat sein Gerät mit eigener Reihenfolge, Fortschritt und Restzeit. Ein Klick zeigt eine Antwort vorab, ohne sie als vorgelesen zu markieren.' }
];
const TR = { i: -1 };
function tourClear() { $$('.tspot').forEach((el) => el.classList.remove('tspot')); }
function tourGo(i) {
  TR.i = i;
  const st = TOUR[i];
  if (view !== st.v) setView(st.v);
  if (st.v === 'teleprompter' && !TP.list) { TP.list = true; renderTP(); }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    tourClear();
    let els = $$(st.s).filter((el) => el.getClientRects().length);
    if (!els.length && st.f) els = $$(st.f).filter((el) => el.getClientRects().length);
    els.forEach((el) => el.classList.add('tspot'));
    if (els[0]) els[0].scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    renderTour();
  }));
}
function renderTour() {
  const box = $('#tour'); box.hidden = false; document.body.classList.add('touring');
  box.className = 'tour ' + (TR.i < 0 ? 'l' : (TOUR[TR.i].pos || ''));
  if (TR.i < 0) {
    put(box,
      h('div', { class: 't-step' }, h('span', null, 'Rundgang'), h('button', { class: 'tb', type: 'button', 'aria-label': 'Schließen', onclick: tourEnd }, ico('x', 15))),
      h('h3', null, 'In zwei Minuten durch alle drei Ansichten'),
      h('p', null, 'Vom Entwurf im Fachbereich über das Lagebild bis zur Bühne. Neun Schritte, mit echten Klicks auf synthetischen Daten.'),
      h('div', { class: 't-acts' }, h('span', { class: 'grow' }), h('button', { class: 'btn sm ghost', type: 'button', onclick: tourEnd }, 'Später'),
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => tourGo(0) }, 'Rundgang starten', ico('arrow', 14))));
    return;
  }
  const st = TOUR[TR.i]; const last = TR.i === TOUR.length - 1;
  put(box,
    h('div', { class: 't-step' }, h('span', null, 'Rundgang · ' + (TR.i + 1) + ' von ' + TOUR.length), h('button', { class: 'tb', type: 'button', 'aria-label': 'Rundgang beenden', onclick: tourEnd }, ico('x', 15))),
    h('div', { class: 't-bar', 'aria-hidden': 'true' }, TOUR.map((_, k) => h('i', { class: k <= TR.i ? 'on' : '' }))),
    h('h3', null, st.t),
    h('p', null, typeof st.d === 'function' ? st.d() : st.d),
    h('div', { class: 't-acts' },
      TR.i > 0 ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => tourGo(TR.i - 1) }, 'Zurück') : null,
      h('span', { class: 'grow' }),
      st.act ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => tourGo(TR.i + 1) }, 'Überspringen') : null,
      h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (st.run) st.run(); if (last) tourEnd(); else tourGo(TR.i + 1); } },
        st.act ? st.act : last ? 'Fertig' : 'Weiter', last ? null : ico('arrow', 14))));
}
function tourEnd() { tourClear(); $('#tour').hidden = true; document.body.classList.remove('touring'); TR.i = -1; store.set('hv-proto-tour', 'seen'); }
put($('#tour-btn'), ico('play', 14), h('span', { class: 't-label' }, 'Rundgang'));
$('#tour-btn').addEventListener('click', () => tourGo(0));
if (store.get('hv-proto-tour') !== 'seen') renderTour();
