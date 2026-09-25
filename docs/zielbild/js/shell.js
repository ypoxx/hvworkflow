/* HV-Tool Zielbild (slice 089): notes panel, view switching, keyboard, start-up.
   Reference, not product code: no HvApi, no rights (_actions), no i18n dictionary, one synthetic data set.
   Take layout, wording, spacing and interaction from here; build the real thing in apps/web per its slice spec. */
/* ---------- what is new, per view */
const NOTES = {
  schreibraum: [
    { t: 'Nur meine Fragen', d: 'Der Fachbereich sieht seine eigenen Zuweisungen, die älteste oben, mit lesbarem Fragetext. Keine 800 Zeilen, keine Filter der Administration (Rückmeldungen 24 und 28).', s: '.sr-list' },
    { t: 'Treffer aus der Erwartungskarte', d: 'Für viele Fragen liegt schon vor der HV eine freigegebene Antwort bereit. Übernehmen, anpassen, weiterleiten.', s: '.hit' },
    { t: 'Jede Zahl ist geprüft', d: 'Durchgezogen unterstrichen heißt belegt, gepunktet heißt ohne Beleg, rot hinterlegt heißt Widerspruch zu einer schon vorgelesenen Antwort. Mit der Maus über eine Zahl fahren.', s: '#editor .num, .checks' },
    { t: 'Korrektur per Klick', d: 'Für bekannte Werte schlägt die Prüfung den belegten Wert vor. Ein Klick setzt ihn ein, mit Rückgängig.', s: '.fix' },
    { t: 'Vorlesezeit', d: 'Aus der Wortzahl bei ruhigem Vortrag. Ziel sind rund zwei Minuten je Antwort.', s: '.readtime' },
    { t: 'Schreiben wie auf der Bühne', d: 'Fett, kursiv, Hervorhebung, Aufzählung, sonst nichts. Schrift und Größe kommen von der Ansicht, die Bühne zeigt denselben Text (Rückmeldungen 27, 30, 31).', s: '.toolbar' },
    { t: 'Pseudonymisiert', d: 'Der Fachbereich sieht die Nummer der Wortmeldung, keinen Namen.', s: '.q-meta' },
    { t: 'Vollbild', d: 'Blendet Liste und Prüfung aus, nur Frage und Antwort bleiben (Rückmeldung 29).', s: '[data-act="focus"]' },
    { t: 'Zum Ausprobieren', d: 'Vorbereitete Antwort übernehmen und weiterleiten. Im Lagebild sinkt danach die Zahl der ältesten offenen Frage.', s: '.forward' }
  ],
  lagebild: [
    { t: 'Eine große Zahl', d: 'Die älteste unbeantwortete Frage ist die Kennzahl, die direkt auf das Anfechtungsrisiko einzahlt.', s: '.hero' },
    { t: 'Fluss statt Zähler', d: 'Jede Frage ist ein Punkt. Wo sich Punkte stauen, liegt der Engpass. Farbe und Form zeigen das Alter, jeder Spaltenkopf das Tempo der letzten 15 Minuten. Ein Klick zeigt den Faden der Frage.', s: '.flow-map' },
    { t: 'Prognose aus dem Tempo', d: 'Wann der Stau im Legal Clearing abgebaut ist und wann die nächste Antwortrunde voll ist, gerechnet aus dem aktuellen Tempo.', s: '.tile-legal, .tile-round' },
    { t: 'Rednerwand', d: 'Je Wortmeldung ein Punkt pro Frage. Ein Klick zeigt, wann und von wem geantwortet wurde. Für den Moment, in dem die Versammlungsleitung fragt, ob alle Fragen beantwortet sind.', s: '.wall' },
    { t: 'Eigener Kanal für Widersprüche', d: 'Widerspruch und Protokollierungsverlangen laufen nie im Fragenstrom, sondern mit Übergabe an den Notar per Klick.', s: '.alarm' },
    { t: 'Zeitraffer', d: 'Die Ansicht läuft live, eine Minute je 2,5 Sekunden. Anhalten mit dem Knopf „Live“.', s: '[data-act="live"]' }
  ],
  teleprompter: [
    { t: 'Meine Setliste', d: 'Jedes Podiumsmitglied hat ein eigenes Gerät mit eigener Reihenfolge, Fortschritt und Restzeit (Rückmeldungen 7 und 10).', s: '.st-list, .st-progress' },
    { t: 'Halten statt Tippen', d: 'Weiter geht es erst nach kurzem Halten, per Maus, Finger oder Leertaste. Danach bleiben fünf Sekunden für „Rückgängig“. Ein Presenter-Klicker (Bild ab) schaltet sofort, ebenfalls mit Rückgängig.', s: '.hold' },
    { t: 'Umbruch an Satzgrenzen', d: 'Jeder Satz beginnt in einer neuen Zeile, damit beim Vorlesen nichts mitten im Satz umbricht.', s: '.st-answer' },
    { t: 'Anzeige je Gerät', d: 'Schriftgröße, Zeilenabstand und Saallicht stellt jede Person selbst ein, das Gerät merkt es sich (Rückmeldung 6).', s: '.st-tools' },
    { t: 'Ruhige Zeile aus dem Versammlungsbüro', d: 'Nachrichten erscheinen über dem Text und verdecken ihn nie.', s: '#st-msg' },
    { t: 'Vorschau ohne Folgen', d: 'Ein Klick in der Setliste zeigt eine Antwort vorab, ohne sie als vorgelesen zu markieren.', s: '.st-list' },
    { t: 'Zurückgeben ist leise', d: 'Die seltene Korrektur ist ein kleiner Textknopf, nicht der größte auf der Seite.', s: '.st-return' },
    { t: 'Nur Bühne', d: 'Blendet Navigation und Hinweise aus, so wie das Gerät auf der Bühne aussieht. Esc kehrt zurück.', s: '.tbtn[data-key="only"]' }
  ]
};
function spot(sel, on) { $$(sel).forEach((el) => el.classList.toggle('spot', on)); }
function renderNotes() {
  $$('.spot').forEach((el) => el.classList.remove('spot'));
  put($('#notes'), 
    h('div', { class: 'n-head' }, h('h2', null, 'Was hier neu ist'), h('button', { class: 'tb', type: 'button', 'aria-label': 'Hinweise schließen', onclick: () => setNotes(false, true) }, ico('x', 16))),
    h('p', { class: 'n-sub' }, 'Mit der Maus über einen Punkt fahren, dann ist die Stelle markiert.'),
    h('ul', { class: 'n-list' }, NOTES[view].map((n) => h('li', { class: 'note', tabindex: '0',
      onmouseenter: () => spot(n.s, true), onmouseleave: () => spot(n.s, false), onfocus: () => spot(n.s, true), onblur: () => spot(n.s, false) },
      h('b', null, n.t), h('p', null, n.d)))),
    h('p', { class: 'n-foot' }, 'Prototyp auf synthetischen Daten, nicht mit dem HV-Tool verbunden. Gespeichert werden nur Anzeigeeinstellungen des Teleprompters in diesem Browser.'));
}
function setNotes(open, persist) {
  $('#app').dataset.notes = open ? 'open' : 'closed';
  const b = $('#notes-btn');
  b.setAttribute('aria-expanded', String(open));
  put(b, ico('bulb', 15), h('span', { class: 'notes-label' }, 'Was ist neu'));
  if (persist) store.set('hv-proto-notes', open ? 'open' : 'closed');
}

/* ---------- views and keys */
const VIEWS = ['schreibraum', 'lagebild', 'teleprompter'];
function setView(v, replace) {
  if (!VIEWS.includes(v)) v = 'schreibraum';
  view = v;
  for (const x of VIEWS) {
    $('#v-' + x).hidden = x !== v;
    const t = $('#tab-' + x); t.setAttribute('aria-selected', String(x === v)); t.tabIndex = x === v ? 0 : -1;
  }
  document.body.classList.toggle('tp', v === 'teleprompter');
  document.body.classList.toggle('stage-only', v === 'teleprompter' && TP.only);
  if (replace !== false) { try { history.replaceState(null, '', '#' + v); } catch (e) { /* ignore */ } }
  hideTip(); holdCancel(); renderNotes();
  if (v === 'schreibraum') renderSR(false);
  if (v === 'lagebild') renderLB();
  if (v === 'teleprompter') { renderTP(); scheduleMsg(); }
  updateSim();
}
document.addEventListener('keydown', (e) => {
  const t = e.target;
  const typing = t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
  if (e.key === 'Escape' && view === 'teleprompter' && (TP.preview || TP.ret)) { TP.preview = null; TP.ret = false; renderTP(); return; }
  if (e.key === 'Escape' && view === 'teleprompter' && TP.only) { setOnly(false); return; }
  if (view === 'schreibraum' && e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    const list = S.mine.map((id) => S.byId.get(id)).sort(byC); const i = list.findIndex((q) => q.id === SR.cur);
    const n = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
    if (n) { e.preventDefault(); selectSR(n.id); }
    return;
  }
  if (view !== 'teleprompter' || typing) return;
  if (e.code === 'Space') {
    if (t !== holdBtn && t.closest && t.closest('button')) return;
    e.preventDefault(); if (!e.repeat) holdBegin(); return;
  }
  if (e.key === 'PageDown' || e.key === 'ArrowRight') { e.preventDefault(); deliver(); return; }
  if (e.key === 'Backspace' && toastUndo) { e.preventDefault(); runUndo(); }
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space' && view === 'teleprompter') holdCancel(); });
$$('.tab').forEach((tab, i, all) => {
  tab.addEventListener('click', () => setView(tab.dataset.view));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
    n.focus(); setView(n.dataset.view);
  });
});
$('#notes-btn').addEventListener('click', () => setNotes($('#app').dataset.notes !== 'open', true));
window.addEventListener('hashchange', () => setView(location.hash.slice(1), false));

/* ---------- start */
buildSR(); buildLB(); buildTP();
if (innerWidth < 900) TP.list = false;
const savedNotes = store.get('hv-proto-notes');
setNotes(savedNotes === 'open', false);
renderSR(true);
$('#clock').textContent = fmt(S.now);
setView(location.hash.slice(1) || 'schreibraum', false);
