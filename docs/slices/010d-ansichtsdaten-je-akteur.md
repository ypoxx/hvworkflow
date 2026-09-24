# 010d — Ansichtsdaten gehören dem Schlüssel des Akteurs

**Status:** review bestanden (Runde 3, 24.09.)
**Risikoklasse:** niedrig · 1 AStd · Lanes: web-speakers, web-capture, web-answers, web-history, e2e (eigene Datei).
Startet nach 010c (dieselben Feature-Verzeichnisse).
**Rolle:** Implementierer-Oberfläche; Review in frischem Kontext (Perspektive Barrierefreiheit)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 10, 12; docs/design-prinzipien.md D5, D6 (Fehlerzustand gestaltet), D9 (was
nicht erlaubt ist, wird nicht angeboten)
**Quellen-IDs:** `docs/slices/010c-lesezustand-je-ladevorgang.md`, Review-Befunde Runde 1, Punkte 2, 4 (Beantwortung) und 5
**Depends on:** 010c (gemergt `24eca01`)
**Perspektive:** Barrierefreiheit · **Glossar: neue Begriffe:** nein

## Festlegung des Architekten

010c bindet Lesezustände (bereit, lädt, verweigert, Fehler) an den Schlüssel ihres Ladevorgangs. Übrig sind drei
Stellen derselben Familie: (a) die **Daten** der vorigen Rolle bleiben nach einem Rollenwechsel mit ihren `_actions`
sichtbar und bedienbar, bis die neue Rolle geantwortet hat; (b) nach einem ersten Ladefehler zeigt die Beantwortung
den leeren Zustand „Kein Treffer … Auswahl zurücksetzen“, obwohl keine Auswahl gesetzt ist; (c) der Ausgang eines
älteren Schreibvorgangs (412, Erfolg) wirkt auf die inzwischen gezeigte andere Frage. Der Server lehnt in (a) jeden
Schreibversuch ab (Regel 4 ist erfüllt); verletzt ist D9 in der Oberfläche.

## Ziel

1. Daten mit `_actions` werden nur angeboten, wenn ihr Schlüssel dem aktuellen Akteur gehört (Wortmeldungen,
   Erfassung, Beantwortung, Historie; die Bühne tut es schon). Bis zur ersten Antwort der neuen Rolle: Ladezustand
   (vorhandenes Skelett), keine Aktionsknöpfe der vorigen Rolle.
2. Beantwortung: ein Ladefehler ohne Daten zeigt einen gestalteten Fehlerzustand mit vorhandenen Komponenten und
   i18n-Schlüsseln (oder neuen Schlüsseln de/en, falls keiner passt, dann i18n in Files allowed), nie den Leertext
   „Kein Treffer“.
3. Beantwortung: Ausgang eines Schreibens (Banner „Stand veraltet“, Dialog schließen, Entwurf leeren) wirkt nur, wenn
   `taken.id === question.id` zum Zeitpunkt der Antwort.

4. Testschärfung aus 010c Runde 4: R3-1-e2e prüft zusätzlich den Toast-Text („Testfehler“); Unit-Tabelle des
   Detail-Gates um die Reihenfolge „Liste zuerst“ (404 geschluckt, 500 gezeigt, weiterer Fehler unterdrückt) ergänzt,
   byte-gleich in `answers/lib.test.ts` und `history/lib.test.ts`. Dafür zusätzlich in Files allowed:
   `apps/web/e2e/010c-lesezustand.spec.ts`.

5. Aus der Prüfung der CI-Korrekturen von 010c (beide minor, Testrobustheit): `installHarness` lädt die App-Module
   ohne `await` im Seitenkontext oder begründet im Bericht, warum der eine verbliebene `import()` in `waitForCorpus`
   sicher ist (`010c-lesezustand.spec.ts:118`); der Ablehnungszweig in `unrelatedEvent` verträgt `null`/`undefined`
   (`(error as { detail?: string } | null)?.detail ?? String(error)`, `:280`).

## Nicht-Ziele

Keine Änderung an Kern, Vertrag, Dienst, Rechten; kein neues Token; kein gemeinsamer Ordner außerhalb der Features.

## Files allowed

- `apps/web/src/features/{speakers,capture,answers,history}/**`
- `apps/web/src/i18n/{answers,speakers,capture,history}.{de,en}.ts` und `apps/web/src/i18n/parity.test.ts` (nur falls
  Ziel 2 neue Schlüssel braucht; nur die Schlüsselzahl im Paritätstest)
- `apps/web/e2e/010d-ansichtsdaten.spec.ts` (neu), `apps/web/e2e/010c-lesezustand.spec.ts` (nur Ziele 4 und 5; Nachtrag des Architekten 24.09., Ziel 5 verweist auf diese Datei)
- `docs/evidence/010d-*.png`
- `docs/slices/010d-ansichtsdaten-je-akteur.md`

## Akzeptanzkriterium

1. Je Ziel ein e2e, das vor der Änderung rot ist. Ziel 1: Rollenwechsel mit zurückgehaltenen Lesevorgängen der neuen
   Rolle → kein Aktionsknopf der vorigen Rolle sichtbar; Ziel 2: erster Abruf 500 → Fehlerzustand, kein „Kein
   Treffer“; Ziel 3: Schreiben auf A läuft, Wechsel auf B, A antwortet 412/Erfolg → B unverändert.
2. Screenshot des Fehlerzustands (Ziel 2) in `docs/evidence/`.
3. Alle Playwright-Szenarien grün, axe ohne serious/critical; `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt` nach 010c, Branch `claude/slice-010d-ansichtsdaten` vom Integrationsbranch.
- Playwright mit eigenem Port, Chromium unter `/opt/pw-browsers`; danach `git checkout -- docs/evidence` außer den
  eigenen 010d-Screenshots.
- Logdateien nur über `mktemp`. Jeder Commit nennt „Scheibe 010d“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

Commits Runde 0: `7c593f0` (Tests, rot), `74b8cab` (Änderung), `24dd4e4` (Bericht). Runde 1: `25db979` (Änderung
und e2e), `97eba3e` (Bericht). Runde 2: `5ac160f` (Änderung und e2e, **letzter Code-Commit**, Gates), dieser
Commit (Bericht).

```
Slice: 010d-ansichtsdaten-je-akteur
Done: Daten mit _actions gehören dem Schlüssel des Akteurs: Wortmeldungen, Erfassung, Beantwortung und
      Historie geben Daten nur dem Akteur ihres Ladevorgangs (keyBelongsTo, je Feature mit derselben
      Tabelle); bis zur ersten Antwort der neuen Rolle Skelett, keine Knöpfe, Dialoge der vorigen Rolle
      schließen. Beantwortung: Listenfehler ohne Zeilen → gestalteter Fehlerzustand mit "Erneut
      versuchen" (2 neue Schlüssel de/en), nie "Kein Treffer". Ausgang eines Schreibens nur, solange
      seine Frage für denselben Akteur gezeigt und noch gewählt ist; der Hinweis „Stand veraltet“
      gehört seiner Frage; das Leeren des Entwurfs hängt an der gezeigten Frage (Runde 2). Runde 1: 412 außerhalb der Ansicht und Bestätigung mit Fragennummer (i18n),
      ein Abruf je gescheitertem Ereignisstrom, Fokus nach „Erneut versuchen“ (auch ohne Zeilen,
      Runde 2), neutraler Fehlertext.
      Ziel 4/5: Testschärfung und Harness ohne await.
Evidence: pnpm gates auf 5ac160f, Exit 0 (Schluss unten, einmal, wörtlich); Playwright ganze Suite
      96/96 (2 Worker) und 96/96 (1 Worker, taskset -c 0,1); 010d-Datei --repeat-each=3 zweimal
      78/78 und 78/78; rote Läufe: Runde 2 2 rot / 24 grün auf 97eba3e (genau N1 und N2),
      Runde 1 8 rot / 16 grün auf 74b8cab, Runde 0 17 rot / 2 grün auf e303cc1; axe ohne serious/critical, auch in den
      Ladezuständen; docs/evidence/010d-beantwortung-ladefehler.png (neu aufgenommen, Text geändert).
Open: siehe "Offen" unten.
Touched: siehe "Touched" unten.
```

### Nacharbeit Runde 2 (N1, N2; Entscheidung des Architekten Runde 2)

- **N1 (Regression aus Befund 1), gespeicherter Entwurf bleibt im Editor von A:** Die Auswahlprüfung aus
  Runde 1 sperrte auch das Leeren des Entwurfs. Während B lädt, ist aber gerade der Editor von A noch
  eingehängt, mit dem gespeicherten Text; wer zu A zurückkehrt, fand ihn dort wie ungespeichert, und ein
  weiteres Enter speicherte ihn ein zweites Mal. Jetzt zwei Prüfungen in `run` (`answers/Page.tsx`):
  `onScreen()` — die Frage ist für denselben Akteur gezeigt — entscheidet über `onDone` (Entwurf leeren);
  `stillShown()` — gezeigt **und** gewählt — über Dialog schließen und „Stand veraltet“. Ist B schon
  geladen, ist der Editor von A abgebaut; der Entwurf von B wird dann nicht angefasst (Ziel 3 bleibt). e2e
  genau nach P3c (Filter „Entwurf“, damit A nach der neuen Version in der Liste bleibt): Entwurf auf A
  gehalten, `getQuestion` gehalten, Klick auf B, Entwurf gelingt, Klick auf A, Freigabe der Lesevorgänge →
  eine Version mehr, Editor leer, „Antwort entwerfen“ `aria-disabled`. Rot auf `97eba3e`.
- **N2, erneuter Versuch ohne Zeilen:** `useBacklog` zählt beantwortete Listenabfragen (`listAnswered`,
  steigt je Antwort genau einmal — bereit, verweigert oder gescheitert). `WorkList` merkt sich beim Druck auf
  „Erneut versuchen“ den Stand und erledigt den Versuch mit der ersten danach beantworteten Abfrage, was
  immer sie brachte; die Marke wird dann gelöscht (vorher nur, wenn Zeilen kamen). Liegt der Fokus dann auf
  BODY: Zeilen → Liste; keine Zeilen → der Knopf des leeren Zustands („Auswahl zurücksetzen“, bei einem
  neuen Fehler „Erneut versuchen“), ohne einen solchen Knopf das Suchfeld. Ein Zähler statt des
  Ladezustands, weil ein sofort beantworteter Versuch den Ladezustand gar nicht rendert. e2e: Suche ohne
  Treffer, nächste Listenabfrage scheitert, „Erneut versuchen“ mit Enter → „Kein Treffer“, Fokus auf
  „Auswahl zurücksetzen“, Enter dort lädt die Zeilen. Rot auf `97eba3e`. Der Fall ohne Filter (leerer
  Bestand, Fokus auf die Suche) hat keinen e2e: im Demo-Korpus liest jede Rolle mit Leserecht Zeilen.
- **N3:** nicht geändert, Folgeliste (Entscheidung des Architekten).

### Nacharbeit Runde 1 (Befunde 1–4 und 6; Entscheidung des Architekten)

- **Befund 1 (major), „Stand veraltet“ von A über B:** zwei Stellen, beide geändert. (a) Der Hinweis ist
  kein Schalter der Seite mehr, sondern trägt seine Frage (`staleFor`), das Banner steht nur bei
  `staleFor === question.id`. (b) Der Ausgang eines Schreibens verlangt zusätzlich, dass seine Frage noch
  die **gewählte** ist (`shown.selectedId`): Während B lädt, zeigt die Detailansicht noch A, die Person ist
  aber schon bei B — der 412 von A geht dann als Toast. Ohne (b) stünde das Banner kurz über A und
  verschwände mit B, ungelesen.
  Nachgeprüft für dasselbe Fenster: **Dialog schließen** — während A schreibt, ist A gesperrt, ein Dialog
  auf B kann erst nach dem Laden von B aufgehen; mit (b) schließt der Erfolg von A ohnehin keinen Dialog,
  solange B gewählt ist. **Entwurf leeren** — mit (b) wird der Entwurf von A nicht mehr geleert, wenn B
  schon gewählt ist; die Detailansicht von A (mit dem gespeicherten Text) wird mit dem Laden von B
  abgebaut, der Text kommt nirgends wieder. Kehrt die Person zu A zurück, bevor A antwortet, wirkt der
  Ausgang wieder auf A. e2e „Runde 1 (Befund 1)“ mit gehaltenem `getQuestion`, rot auf `74b8cab`.
- **Befund 2, 412-Toast:** ein 412 für eine nicht mehr gezeigte Frage zeigt `answers.toast.stale.title`
  („Nicht übernommen“) und `answers.toast.stale.body` („„{action}“ für Einzelfrage {number} wurde nicht
  übernommen: Die Frage wurde inzwischen geändert.“), die Bestätigung `answers.toast.step` („Einzelfrage
  {number}: {action}“); je de/en, Paritätstest 461 → 464. Kein vorhandener Schlüssel passte
  (`answers.stale.banner` sagt „Ansicht neu geladen“, das stimmt für eine andere Frage nicht). Die e2e
  benutzen einen **echten** 412: „Freigeben“ auf A wird gehalten, bevor es die API erreicht; jemand anderes
  gibt A zurück und legt es wieder zur Prüfung vor — derselbe Stand, dieselbe Antwortversion, ein neuerer
  Datensatz —, so passiert das gehaltene Schreiben jede Übergangsprüfung und scheitert nur an seinem
  `ifMatch` („Precondition failed“ vom Kern; ein neuer Entwurf hätte einen 409 ergeben, weil der Kern den
  Übergang vor `ifMatch` prüft). Der Toast darf „Precondition“ nicht enthalten.
- **Befund 3, Ereignisstrom:** Ursache war die Abhängigkeit `streamOwned` (und schon vorher `streamLastSeq`):
  ein gescheitertes Ende setzte den eigenen Stand, das startete den Effekt ein zweites Mal. Jetzt liest der
  Effekt `lastSeq` und Besitzer über `streamRef` (per `useLayoutEffect` nach jedem Commit gesetzt) und hängt
  nur an `version` und Reiter. Nebenwirkung: nach einem erfolgreichen Fensterabruf entfällt der bisherige
  überflüssige zweite Endabruf. e2e: Ende immer 500 → genau ein Abruf, ein Toast, beim ersten Öffnen und
  nach observer → admin.
- **Befund 4, Fokus nach „Erneut versuchen“:** `listFailed` hängt nicht mehr am laufenden Ladevorgang,
  sondern heißt „die letzte beantwortete Listenabfrage dieses Akteurs ist gescheitert, und er hat keine
  Zeilen“ — der Fehlerzustand und damit der fokussierte Knopf bleiben während des erneuten Lesens stehen
  (wie in der Wortmeldeliste). Scheitert es wieder, bleibt der Fokus auf dem Knopf. Kommen Zeilen, geht der
  Fokus auf die Liste (`role="listbox"`, Name „Liste der Einzelfragen“), wo die Pfeiltasten wirken — nur,
  wenn er auf BODY gefallen ist. Zwei e2e mit Tastatur (Enter): Erfolg → Liste fokussiert, Pfeil nach unten
  öffnet die erste Frage; Misserfolg (300 ms verzögert, damit der Ladezustand dazwischen gerendert wird) →
  Knopf fokussiert.
- **Befund 6:** „Der Bestand konnte gerade nicht gelesen werden.“ / „The corpus could not be read just
  now.“; der Screenshot ist neu aufgenommen, weil sich sein Text geändert hat.
- **Befund 5:** angenommen, unverändert.

### Invarianten je Ansicht

Vor dem Code festgelegt, dann je Invariante unter den Reihenfolgen geprüft, die sie brechen (späte Antwort
der vorigen Rolle, langsame Liste, zwei Fehler in beiden Reihenfolgen, Auswahlwechsel mitten im Schreiben).

- **Gemeinsam (Muster):** `keyBelongsTo(key, actorId)` — Daten, die unter `key` gelesen wurden, werden nur
  dessen Akteur angeboten, bei jeder `version` (derselbe Akteur behält seine Daten beim Nachladen, Prinzip 8).
  Der Akteur wird aus dem ganzen JSON-Schlüssel gelesen (kein Präfixvergleich). Neuer Block direkt nach dem
  010c-Block in `speakers/useSpeakers.ts`, `capture/useCapture.ts`, `answers/lib.ts`, `history/lib.ts`,
  byte-gleich (md5 `70cd0bc11de0`), mit derselben Tabelle von fünf Fällen in den vier `*.test.ts` (md5
  `9da48a348c90`). Die Bühne braucht ihn nicht (sie setzt beim Akteurwechsel im Render zurück, Minor B von
  010b). Die 010c-Blöcke sind unverändert und in allen fünf Kopien weiter byte-gleich (md5 `dfdb1d7aeb68`).
  Ein Lesefehler des neuen Akteurs ersetzt Daten eines anderen Akteurs durch leere eigene (sonst stünde
  „lädt“ bis zum nächsten Ereignis); derselbe Akteur behält seine.
- **Wortmeldungen:** Zeilen, „Jetzt spricht“, Zeilenknöpfe, Ziehgriffe, „Wortmeldung aufnehmen“ und der
  Lesehinweis kommen nur aus einer Liste des aktuellen Akteurs; sonst Skelett (oder die stehende
  Verweigerung aus 010c). „Aufnehmen“ bei leerer Liste nur, wenn diese leere Liste die Antwort dieses Akteurs
  ist (`status` „ready“), nicht während des Ladens. Die Reihenfolge-Vorschau (`override`) gehört zur Liste,
  auf der sie gemacht wurde, und fällt im selben Render (vorher Effekt, ein Frame alte Zeilen). Aufnahme- und
  Verschiebedialog schließen beim Akteurwechsel im selben Render (Vergleich über die `id`).
- **Erfassung:** `useAsync` hält `dataKey` (wer gelesen hat) getrennt von `key` (was gerade lädt) und gibt
  Daten nur dem eigenen Akteur, sonst den Fallback mit Status „loading“; damit kommen die Pultrechte
  (`deskActions`: erfassen, einordnen, Vorschläge, freie Einzelfrage, neuer Redebeitrag, Alt+Q) nie aus
  `_actions` der vorigen Rolle. Der Vorschlagsdialog schließt beim Akteurwechsel; der Einordnungsdialog
  schließt mit seiner Frage.
- **Beantwortung:** Zeilen, Zähler, Einzelfrage mit `_actions` und ihr Verlauf nur aus Ladevorgängen des
  aktuellen Akteurs; sonst Listenskelett und „Einzelfrage wird geladen …“. Aktionsdialoge und „Stand
  veraltet“ gehen beim Akteurwechsel. Die letzte beantwortete Listenabfrage dieses Akteurs ist gescheitert
  und er hat keine Zeilen → Fehlerzustand `answers-list-error` (EmptyState, TriangleAlert, „Erneut
  versuchen“); er bleibt stehen, solange derselbe Akteur neu liest (Runde 1, Befund 4), und die rechte Seite
  schweigt dann wie bei der Verweigerung statt „Wählen Sie links …“. Ein Fehler derselben Rolle bei
  vorhandenen Zeilen lässt die Zeilen stehen (Toast wie bisher).
  **Ausgang eines Schreibens:** Dialog schließen und „Stand veraltet“ wirken nur, wenn im Moment der
  Antwort seine Frage für denselben Akteur gezeigt wird **und** noch die gewählte ist (`shown` mit
  `selectedId`, nach jedem Commit per `useLayoutEffect` gesetzt); das Leeren des Entwurfs (`onDone`) nur,
  wenn seine Frage für denselben Akteur gezeigt wird — ihr Editor ist dann eingehängt (Runde 2, N1). Der Hinweis
  selbst trägt seine Frage (`staleFor`) und steht nur über ihr. Sonst meldet ein Toast die Ablehnung — ein
  412 im Hauswortlaut mit Fragennummer, jede andere Ablehnung wie bisher —, eine Ablehnung bleibt nie
  unbemerkt; die Erfolgsmeldung nennt Schritt und Fragennummer und steht immer. Den Akteur zusätzlich zur
  `id` zu vergleichen geht über den Wortlaut von Ziel 3 hinaus: es folgt aus Ziel 1 (der Ausgang gehört
  dem, der geschrieben hat) und hat einen eigenen e2e.
- **Historie:** Trefferzeilen, Korpus (und damit die gewählte Frage), Vorgangshistorie, Ereignisstrom und
  Rednernamen nur aus Ladevorgängen des aktuellen Akteurs; sonst Skelett links und rechts (statt „Keine
  Einzelfrage gewählt“ oder „Noch keine Ereignisse“). Die Vorgangshistorie gehört außerdem zu ihrer Frage
  (vorher standen beim Auswahlwechsel kurz die Ereignisse der vorigen Frage unter dem neuen Titel). Der
  Strom überspringt ein unverändertes Ende nur, wenn dieser Akteur das Fenster gelesen hat (R10 bleibt für
  gewöhnliche Ereignisse; nach einem Wechsel wird einmal gelesen — im Demo hält nur admin `event.read`, und
  eine Verweigerung setzte `lastSeq` schon bisher auf 0). Der Effekt des Stroms hängt nur an `version` und
  Reiter und liest seinen eigenen Stand über eine Ref (Runde 1, Befund 3): keine Antwort startet ihn neu.
- **Barrierefreiheit:** Die Skelette der Beantwortung und der Historie trugen `aria-label` auf einem `div`
  ohne Rolle; axe meldet das als `aria-prohibited-attr` (serious), sichtbar erst jetzt, weil 010d sie nach
  jedem Rollenwechsel zeigt und die e2e axe im Ladezustand prüfen. Jetzt `role="status"` mit `aria-busy`.

### Je Ziel

1. Ziel 1: siehe Invarianten. e2e (je rot vor der Änderung): Wortmeldeliste moderation → capture mit
   zurückgehaltener Liste; dieselbe mit erstem 500 (Fehlerzustand statt Zeilen der vorigen Rolle);
   Aufnahmedialog schließt; Erfassung capture → moderation mit drei zurückgehaltenen Lesevorgängen;
   Beantwortung legal → expert (Liste, Einzelfrage, Verlauf zurückgehalten); langsame Liste (die Einzelfrage
   der neuen Rolle erscheint mit deren Schritten, keine Zeile der vorigen); Rückgabedialog schließt;
   Historie admin → observer (Hauptabfrage und Verlauf zurückgehalten); Ereignisstrom admin → observer.
2. Ziel 2: e2e erster Abruf 500 (Fehlerzustand, Toast, kein „Kein Treffer“, kein „Keine Einzelfrage
   gewählt“, Screenshot, axe; „Erneut versuchen“ lädt die Zeilen); Rollenwechsel mit erstem 500; zwei Fehler
   (Liste und Einzelfrage) in beiden Reihenfolgen → Fehlerzustand, zwei Toasts, nichts der vorigen Rolle;
   Gegenprobe derselben Rolle (Zeilen bleiben). Neue Schlüssel `answers.list.error.title`/`.body`,
   Paritätstest 459 → 461.
3. Ziel 3: e2e echter 412 auf A nach Wechsel zu B (kein Banner über B, ein Toast „Nicht übernommen“ mit der
   Nummer von A; Runde 1); dasselbe, während B noch lädt (Runde 1, Befund 1); Erfolg auf A nach
   Wechsel zu B (Rückgabedialog auf B bleibt offen, Text bleibt); Entwurf auf A gespeichert, Wechsel zu B,
   A gelingt (Entwurf auf B bleibt); 412 auf A nach Rollenwechsel bei weiter gezeigtem A (kein Banner);
   Gegenprobe 412 auf der gezeigten Frage (Banner, kein Toast).
4. Ziel 4: R3-1-e2e prüft zusätzlich `toContainText('Testfehler')` (der Toast ist der 500, nicht der
   maskierte 404). Unit-Zeile „Liste zuerst“ (404 geschluckt, 500 gezeigt, weiterer Fehler unterdrückt) in
   `answers/lib.test.ts` und `history/lib.test.ts`, Gate-Testblöcke byte-gleich (md5 `b93f2411b1b0`). Beides
   ist Testschärfung ohne Verhaltensänderung und war auf dem alten Code schon grün — rot vorher geht hier
   nicht.
5. Ziel 5: gewählt ist die erste Variante, keine Begründung: `installHarness` (in beiden Dateien) startet
   die zwei `import()` in einem synchronen `evaluate` und kehrt sofort zurück; die Importe melden in
   `__harness` (`loading`/`ready`/`failed: …`), der Test fragt es mit `expect.poll` ab. Kein `evaluate` der
   beiden Dateien wartet damit mehr auf einen offenen Promise in der Seite; ein gescheiterter Import zeigt
   sich als eigene Meldung. `unrelatedEvent` verträgt `null`/`undefined`:
   `(error as { detail?: string } | null)?.detail ?? String(error)`. Hinweis zu Files allowed: die Zeile
   nennt `010c-lesezustand.spec.ts` „(nur Ziel 4)“, Ziel 5 verweist aber auf `:118` und `:280` derselben
   Datei; beide Änderungen stehen dort, sonst nichts.

### Evidence

**`pnpm gates` auf `5ac160f` (letzter Code-Commit), Exit 0.** Tests: domain 86, web 181, api 57, scripts
206/206. `slice-scope: 21 changed file(s), all within "docs/slices/010d-ansichtsdaten-je-akteur.md"'s "Files
allowed" list (7 pattern(s)).` (dazu die bekannte Warnung zu „Files allowed“, `4fdf98f`). oxlint 23 Warnungen
(vor der Scheibe 24). Gates auf `74b8cab` (Runde 0) und `25db979` (Runde 1) ebenfalls Exit 0. Schluss wörtlich (nur
ANSI-Farbcodes entfernt):

```
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1715 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-BHYxwywz.css                        40.30 kB │ gzip:   8.71 kB
dist/assets/index-CCBBrcpO.js                        572.60 kB │ gzip: 167.42 kB │ map: 2,372.91 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.68s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit 5ac160f, tree 0590db9b36b2…
```

**Playwright Runde 2** (eigener Port 6211, Chromium unter `/opt/pw-browsers`), Code von `5ac160f`:
- ganze Suite: `96 passed (6.2m)` (2 Worker) und `96 passed (11.2m)` (1 Worker, `taskset -c 0,1`, wie der CI-Läufer mit 2
  CPUs); axe in allen Szenarien ohne serious/critical.
- `e2e/010d-ansichtsdaten.spec.ts` (26 Tests) mit `--repeat-each=3`, zwei Läufe: `78 passed (3.8m)` und
  `78 passed (3.3m)`.
- Der 010d-Screenshot ist unverändert (seine Ansicht hat sich in Runde 2 nicht geändert).

**Roter Lauf Runde 2:** die e2e-Datei aus `5ac160f` gegen den Code von `97eba3e` (`git stash` nur
`apps/web/src`): `2 failed, 24 passed (1.9m)`; rot sind genau die zwei neuen Tests:

```
  ✘  25 Runde 2 (N1): … Entwurf auf A gelingt, während B lädt; zurück zu A   answer-editor  Expected: ""  Received: "Entwurf zu A."
  ✘  26 Runde 2 (N2): … "Erneut versuchen" liefert keine Zeile               button "Auswahl zurücksetzen"  Expected: focused  Received: inactive
  2 failed
  24 passed (1.9m)
```

**Playwright Runde 1** (eigener Port 5593, Chromium unter `/opt/pw-browsers`), Code von `25db979`:
- ganze Suite: `94 passed (6.1m)` (2 Worker) und `94 passed (11.2m)` (1 Worker, `taskset -c 0,1`, wie der CI-Läufer mit 2
  CPUs); axe in allen Szenarien ohne serious/critical.
- `e2e/010d-ansichtsdaten.spec.ts` (24 Tests) mit `--repeat-each=3`, zwei Läufe: `72 passed (2.9m)` und
  `72 passed (2.9m)`.

**Roter Lauf Runde 1:** die e2e-Datei aus `25db979` gegen den Code von `74b8cab` (`git stash` nur
`apps/web/src`): `8 failed, 16 passed (2.1m)`; rot sind genau die neuen bzw. für Runde 1 geänderten Tests:

```
  ✘  10 Ziel 2: … erster Abruf mit 500 …                      answers-list-error  Expected substring: "Der Bestand konnte gerade nicht gelesen werden."
  ✘  15 Ziel 3: … echter 412 auf A nach dem Wechsel zu B …     Toasts  Expected substring: "Nicht übernommen"  Received: "Precondition failedResourc…"
  ✘  16 Runde 1 (Befund 1): … echter 412 auf A, während B noch lädt   stale-banner  Expected: 0  Received: 1
  ✘  17 Ziel 3: … Erfolg auf A nach dem Wechsel zu B …          Toasts  Expected substring: "Einzelfrage F-0076"  Received: "ÜbernommenFreigeben"
  ✘  21 Runde 1 (Befund 4): … scheitert wieder: Fokus bleibt   Erneut versuchen  Expected: focused  Received: inactive
  ✘  22 Runde 1 (Befund 4): … gelingt: Fokus auf die Liste     listbox "Liste der Einzelfragen"  Expected: focused  Received: inactive
  ✘  23 Runde 1 (Befund 3): Ereignisstrom — Ende immer 500      Toasts  Expected: 1  Received: 2
  ✘  24 Runde 1 (Befund 3): Ereignisstrom — observer → admin    Toasts  Expected: 1  Received: 2
  8 failed
  16 passed (2.1m)
```

(Vor dem endgültigen Stand lief die Datei einmal mit einem Entwurf statt Rückgabe/Vorlage als „anderer
Stelle“ — das ergab einen 409, keinen 412 — und mit sofortigem Scheitern des erneuten Versuchs, bei dem der
Ladezustand nie gerendert wird und Test 21 schon auf `74b8cab` grün war; beides ist oben behoben.)

**Playwright Runde 0**, Code von `74b8cab`:
- ganze Suite: `89 passed (6.2m)` (2 Worker, auf dem Baum, der als `74b8cab` eingecheckt wurde) und
  `89 passed (11.1m)` (1 Worker, `taskset -c 0,1`, wie der CI-Läufer mit 2 CPUs, nach dem Commit); axe in
  allen Szenarien ohne serious/critical.
- `e2e/010d-ansichtsdaten.spec.ts` mit `--repeat-each=3`, zwei Läufe: `57 passed (2.4m)` und `57 passed (2.4m)`.
- Die von den Läufen überschriebenen PNGs anderer Scheiben sind mit `git checkout -- docs/evidence`
  zurückgesetzt; eingecheckt ist nur `docs/evidence/010d-beantwortung-ladefehler.png`.

**Roter Lauf Runde 0** der damaligen e2e-Datei gegen den Code von `e303cc1` (`git stash` nur `apps/web/src`, die
Unit-Tests aus `7c593f0` blieben): `17 failed, 2 passed (2.6m)`; grün sind genau die zwei Gegenproben.
Ergebniszeilen, rechts die Assertion aus demselben Lauf:

```
  ✘   1 Ziel 1: Wortmeldeliste — moderation → capture, Liste zurückgehalten …        speaker-register  Expected: 0  Received: 1
  ✘   2 Ziel 1: Wortmeldeliste — moderation → capture, erster Abruf mit 500 …        "Die Wortmeldeliste konnte nicht geladen werden"  Expected: visible
  ✘   3 Ziel 1: Wortmeldeliste — ein Dialog der vorigen Rolle schließt …            speaker-register-name  Expected: 0  Received: 1
  ✘   4 Ziel 1: Erfassung — capture → moderation, Lesevorgänge zurückgehalten …     capture-contribution-new  Expected: 0  Received: 1
  ✘   5 Ziel 1: Beantwortung — legal → expert, Liste und Einzelfrage zurückgehalten  answer-return  Expected: 0  Received: 1
  ✘   6 Ziel 1: Beantwortung — langsame Liste …                                     answers-row  Expected: 0  Received: 18
  ✘   7 Ziel 1: Beantwortung — ein Dialog der vorigen Rolle schließt …              answer-return-reason  Expected: 0  Received: 1
  ✘   8 Ziel 1: Historie — admin → observer, Hauptabfrage und Verlauf zurückgehalten history-result  Expected: 0  Received: 200
  ✘   9 Ziel 1: Historie, Ereignisstrom — admin → observer …                        history-stream  Expected: 0  Received: 1
  ✘  10 Ziel 2: Beantwortung — erster Abruf mit 500 …                               answers-list-error  Expected: visible
  ✘  11 Ziel 2: Beantwortung — Rollenwechsel, erster Abruf der neuen Rolle mit 500   answers-list-error  Expected: visible
  ✘  12 Ziel 2: Beantwortung — … listQuestions scheitert vor getQuestion …           answers-list-error  Expected: visible
  ✘  13 Ziel 2: Beantwortung — … getQuestion scheitert vor listQuestions …           answers-list-error  Expected: visible
  ✓  14 Ziel 2 (Gegenprobe): … dieselbe Rolle, die Zeilen bleiben                    (soll grün bleiben)
  ✘  15 Ziel 3: Beantwortung — 412 auf A nach dem Wechsel zu B …                    stale-banner  Expected: 0  Received: 1  (in Runde 1 auf echten 412 umgestellt)
  ✘  16 Ziel 3: Beantwortung — Erfolg auf A nach dem Wechsel zu B: Dialog …         answer-return-reason  Expected: visible
  ✘  17 Ziel 3: Beantwortung — Erfolg eines Entwurfs auf A …                        answer-editor  Expected: "Entwurf zu B, noch nicht gespeichert."  Received: ""
  ✘  18 Ziel 3: Beantwortung — 412 auf A nach einem Rollenwechsel …                 stale-banner  Expected: 0  Received: 1
  ✓  19 Ziel 3 (Gegenprobe): … 412 auf der gezeigten Frage: Banner, kein Toast       (soll grün bleiben)
  17 failed
  2 passed (2.6m)
```

(Testtitel gekürzt, Präfix „010d“ weggelassen.) Der erste rote Lauf auf `7c593f0` (vor drei Nachträgen an
der Testdatei: `failAlways` für den ersten Abruf, axe im Ladezustand, der Wortmeldeliste-500-Test) war
`16 failed, 2 passed (2.5m)`.

### Offen

- **Bühne, Skelett `stage-deciding`:** dasselbe `aria-label` auf einem `div` ohne Rolle
  (`stage/Page.tsx:515`), axe `aria-prohibited-attr` (serious), sobald axe im Ladezustand prüft. Außerhalb
  von Files allowed, nicht geändert.
- **Historie, Ziel 2 dort nicht verlangt:** ein gescheiterter erster Abruf zeigt links „Kein Treffer“ und im
  Strom „Noch keine Ereignisse“ (vorher genauso beim ersten Abruf; nach einem Rollenwechsel standen dort
  vorher die Daten der vorigen Rolle). Ein Fehlerzustand bräuchte neue `history.*`-Schlüssel.
- **Historie, beide Hauptabfragen scheitern:** zwei Toasts (aus 010c, unverändert).
- **N3 (Runde 2):** kein Beschäftigt-Signal während des erneuten Versuchs, Zähler „0 von 0“ im Fehlerzustand —
  Folgeliste, zusammen mit dem gestalteten Ladefehler der Historie.
- **Ladezustände werden nicht angesagt** (Befund 5, angenommen); eigene `history.*`-Schlüssel folgen mit dem
  gestalteten Ladefehler der Historie (Folgepunkt des Architekten).
- **Andere Ablehnungen außerhalb der Ansicht** (403, 409, 5xx einer nicht mehr gezeigten Frage) zeigen wie
  bisher den Toast des Servers; nur der 412 hat einen eigenen Wortlaut mit Nummer (Befund 2 nennt nur ihn).
- **Eingetippter Text** (Entwurf der Beantwortung, Redebeitrag im Erfassungsformular) ist kein Datum des
  Servers und hängt nicht am Akteur; der Beantwortungsentwurf geht beim Rollenwechsel mit der Einzelfrage
  (die Detailansicht wird neu aufgebaut), das Erfassungsformular behält seinen Text.

### Touched

- `apps/web/e2e/010d-ansichtsdaten.spec.ts` (neu)
- `apps/web/e2e/010c-lesezustand.spec.ts` (Ziel 4 und 5: R3-1-Toast-Text, `installHarness`, `unrelatedEvent`)
- `apps/web/src/features/answers/Page.tsx`, `WorkList.tsx`, `lib.ts`, `lib.test.ts`, `useBacklog.ts`
- `apps/web/src/features/capture/Page.tsx`, `useCapture.ts`, `useCapture.test.ts`
- `apps/web/src/features/history/Page.tsx`, `lib.ts`, `lib.test.ts`
- `apps/web/src/features/speakers/Page.tsx`, `useSpeakers.ts`, `useSpeakers.test.ts`
- `apps/web/src/i18n/answers.de.ts`, `answers.en.ts`, `parity.test.ts` (nur die Schlüsselzahl)
- `docs/evidence/010d-beantwortung-ladefehler.png` (neu)
- `docs/slices/010d-ansichtsdaten-je-akteur.md` (Status und Bericht)

## Review findings

Runde 1 (Opus 5.5, frischer Kontext, Perspektive Barrierefreiheit und D9/Regel 4; HEAD `4fdf98f`, Code `74b8cab`):
Gates exit 0, Playwright 89/89, 010d-Datei 57/57 mit `--repeat-each=3`, axe ohne serious/critical auch in
Ladezuständen; `keyBelongsTo`-Block und Tabelle in vier Features byte-gleich, 010c-Blöcke unverändert. Ziel 1 per Sonde
bestätigt (keine Knöpfe der vorigen Rolle, kein Hängen im Skelett). Urteil: nicht mergebereit wegen Befund 1.

1. **major** — Ziel 3: „Stand veraltet“ von A landet über B. Während B lädt, ist `backlog.selected` noch A, also
   `stillShown()` wahr; der 412 von A setzt `stale`, das Banner erscheint über B (`answers/Page.tsx:94-96, 110-112,
   129-132, 150`). Sonde: Freigeben auf A gehalten, `getQuestion` gehalten, Klick auf B, 412 → Banner über B.
2. **minor** — Toast für einen 412 außerhalb der Ansicht ist roher Servertext auf Englisch ohne Fragennummer
   (`answers/Page.tsx:150-151`); Erfolgstoast nennt die Frage ebenfalls nicht.
3. **minor, Regression** — Ereignisstrom: ein gescheitertes Lesen des Endes gibt zwei Toasts und zwei Abrufe
   (`history/Page.tsx:458-463`, Abhängigkeit `streamOwned` `:469`).
4. **minor (Barrierefreiheit)** — Fokus nach „Erneut versuchen“ fällt auf BODY; nichts wird angesagt
   (`answers/WorkList.tsx:494-523`).
5. **nit** — Skelette mit `role="status"` gültig, aber stumm; Historie nutzt `answers.list.loading`.
6. **nit** — Fehlertext sagt immer „nicht erreichbar“ (`i18n/answers.de.ts:10`, `answers.en.ts:12`).

Entscheidung des Architekten: 1–4 und 6 in dieser Scheibe beheben. 1: Hinweis an seine Frage binden
(`staleFor === question.id`), e2e für das Fenster „B lädt noch“ (rot auf `74b8cab`). 2: 412 außerhalb der Ansicht mit
i18n-Text und Fragennummer; Erfolgstoast nennt die Nummer (neue Schlüssel de/en erlaubt). 3: Ereignisstrom ohne
zweiten Abruf, e2e „Ende immer 500 → genau ein Toast“. 4: Fehlerzustand bleibt während des erneuten Ladens stehen
oder Fokus geht nach dem Laden auf die Liste; e2e prüft Fokus. 6: neutraler Text. 5 angenommen (Ladezustand wird nicht
angesagt); eigene `history.*`-Schlüssel folgen mit dem gestalteten Ladefehler der Historie (Folgepunkt).

Runde 2 (Nachprüfung, Opus 5.5, frischer Kontext, HEAD `97eba3e`): Gates exit 0, Playwright 94/94, 010d-Datei 72/72 mit
`--repeat-each=3`, axe ohne serious/critical. Befunde 1–4 und 6 behoben, je mit Sonde (P1–P10); Ziel 1 hält. Urteil:
mergebereit, N1 vor dem Merge empfohlen.

- **N1 minor (Regression aus Befund 1)** — `stillShown()` verlangt jetzt auch `selectedId === taken.id` und sperrt damit
  auch `onDone` (Entwurf leeren): Entwurf auf A gehalten, Klick auf B (B lädt), Entwurf gelingt, zurück zu A → Version 2,
  der Editor enthält noch den Text, ein weiteres Enter speichert ihn erneut (`answers/Page.tsx:146-150, 160-163`).
- **N2 nit** — „Erneut versuchen“ liefert null Zeilen → „Kein Treffer“, Fokus auf BODY, `retried` bleibt gesetzt
  (`answers/WorkList.tsx:333-343`).
- **N3 nit** — kein Beschäftigt-Signal während des erneuten Versuchs; Zähler „0 von 0“ im Fehlerzustand (vorher schon so).

Entscheidung des Architekten (Runde 2): N1 und N2 in dieser Scheibe (Entwurf leeren bindet an die Frage, nicht an die
Auswahl; Banner und Dialog behalten die Auswahlprüfung; je ein e2e, N1 rot auf `97eba3e`). N3 geht mit dem gestalteten
Ladefehler der Historie in die Folgeliste.

Runde 3 (enge Nachprüfung N1/N2, Opus 5.5, frischer Kontext, HEAD `d2c7796`): Gates exit 0, 010d-Datei 78/78 mit
`--repeat-each=3`, 010c-Datei 27/27. N1 und N2 behoben, je per Sonde (Text auf B bleibt; Text einer anderen Rolle bleibt;
Fokus nur von BODY, kein doppelter Sprung). Urteil: mergebereit.

- **minor, nicht neu** — `onScreen()` prüft Frage und Akteur, nicht die Editor-Instanz: verlässt man A während einer
  langsamen Speicherantwort und kehrt zurück, leert der späte Erfolg den neu getippten Text (`answers/Page.tsx:150-153,
  166`; Sonden P3b, P4, P5). Schon in Runde 1 so.
- **nit** — Wiederholungsmarke `retriedAt` überlebt einen Rollenwechsel (`answers/WorkList.tsx:339-353`).

Entscheidung des Architekten (Runde 3, Stoppregel): beide in die Folgeliste (Entwurf nur leeren, wenn der Editor noch den
gespeicherten Text enthält; Marke an den Akteur binden), zusammen mit N3 und dem gestalteten Ladefehler der Historie.
