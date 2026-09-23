# 020 — Oberfläche: Rückbau und Passung (S-Punkte der Projektleitung)

**Status:** angenommen (Nachprüfung nach Runde 2: annehmen; Folgepunkte siehe Review findings)
**Risikoklasse:** niedrig · 2 AStd · Kalender 02.10.2026 (W1) · Lanes: web-answers, web-capture, web-stage,
web-history, web-speakers, web-shell (+ e2e: eigene Datei und, nur wo diese Spec es verlangt, die Alt-Specs;
deshalb läuft 013 nicht gleichzeitig)
**Rolle/Modell:** Implementierer-Oberfläche · Sonnet 5; Design-Kritik Fable 5.1 vor dem Review; Review Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 9, 10, 12; docs/design-prinzipien.md D1–D10
**Quellen-IDs:** Feedback-Auswertung (docs/feedback/2026-09-quickview-projektleitung.md) Punkte #3, #9, #10, #13,
#17, #21, #23, #26, #28, #32; Plan 5.3 Scheibe 020; Plan 6.6 (Takt); Register E5 (Weiterleiten nur Anzeige)
**Depends on:** 017 (gemergt)
**Perspektive:** UX, Barrierefreiheit · **Glossar: neue Begriffe:** nein („Weiterleiten" ist Anzeige, Glossarzeile in 018)

## Ziel

Wörtlich die folgenden Feedback-Punkte, jeder mit `data-testid` und Screenshot-Nachweis. Rechte kommen nur aus
`_actions` (Regel 4); kein Rollenname in Komponenten. Alle Texte über das i18n-Modul des Features (017), DE und en-US.

1. **#13 Uhr klein, ohne Sekunden.** `apps/web/src/app/Clock.tsx`: Anzeige HH:MM, klein und gedämpft; Aktualisierung
   höchstens einmal je Minute (heute viermal je Sekunde), zeitlich auf den Minutenwechsel ausgerichtet.
2. **#17 Griff sichtbar, Hinweis im Rundenkopf.** Wortmeldeliste: Ziehgriff dauerhaft sichtbar (nicht nur bei Hover),
   Cursor `grab`; ein kurzer Hinweis „Zum Umsortieren am Griff ziehen" (oder gleichwertig, Hausvokabular) im Kopf jeder
   Runde statt nur über der Liste; Tastaturweg bleibt.
3. **#21 Erfassungskarte schlank.** Die Karte einer Einzelfrage in der Erfassung zeigt nur Nummer, Wortlaut und Stand.
   Die Klassifizierung (Pfad, Bühnenzuordnung, Zuweisung) verschwindet von der Karte und ist nur noch über eine
   ausdrückliche Aktion „Klassifizieren" (Dialog) erreichbar, und nur wenn `_actions` sie enthält — bis 053 sie in die
   Steuerungsansicht verlegt. Kein Funktionsverlust.
4. **#23 TOP optional und ausgeblendet.** In der Erfassung ist der Tagesordnungspunkt standardmäßig ausgeblendet; er
   bleibt im Modell (optionales Feld im Vertrag) und wird nicht mehr abgefragt. Eine sichtbare Einstellung zum
   Einblenden ist nicht nötig (Nicht-Ziel).
5. **#26 Lesehinweis.** In der Beantwortung zeigt das Detail einer Einzelfrage „In dieser Rolle nur lesen" (en-US: „Read
   only in this role"), wenn `_actions` keine Bearbeitungsaktion für diese Frage enthält; gleichartig in Erfassung und
   Wortmeldeliste, wo eine Person ohne Schreibrecht heute stumm keine Knöpfe sieht.
6. **#32 „Weiterleiten" als Anzeige.** Die Aktion `question.submit_review` heißt in der Oberfläche „Weiterleiten"
   (en-US „Forward"); Ereignis und Operation bleiben unverändert (E5, nur i18n). Historie zeigt das Ereignis
   entsprechend.
7. **#3/#9 „Nur Bühne" als Standard, wenn die Person nur vorliest.** Der Standard von „Nur Bühne" wird aus den Rechten
   abgeleitet, nie aus dem Rollennamen: gleiches Muster wie `deskActions` in `features/capture/Page.tsx` (Aktionen aus
   `_actions` einer Probefrage bzw. der Bühnenfragen). Enthält die Rechtemenge das Vorlesen und keine Erfassungs-,
   Klassifizierungs-, Entwurfs- oder Freigabeaktion, startet die Bühne in „Nur Bühne". Eine bewusste Wahl der Person
   (bestehender localStorage-Schlüssel) hat Vorrang.
8. **#10 Warteschlange anklickbar mit Vorschau.** Auf der Bühne öffnet ein Klick (und Enter) auf eine Frage der
   Warteschlange eine Vorschau mit Frage und freigegebener Antwort, **ohne** Zustandsänderung (kein Vorgelesen, keine
   Schreiboperation); Escape schließt. Ein Zähler „noch n" zeigt, wie viele Fragen nach der aktuellen noch kommen.
9. **#28 TOP und Erfassungszeit aus der Beantwortung.** Im Detail der Beantwortung entfallen TOP und Erfassungszeit
   (heute `features/answers/QuestionDetail.tsx`); die Historie behält sie.
10. **Leere Listen (Fehlerpfad-Tor, Entwicklungsplan 5.3, dieser Scheibe zugeordnet).** Die e2e-Datei prüft den
    gestalteten Leerzustand mindestens für: Beantwortung mit einem Filter ohne Treffer, Bühne ohne Warteschlange (Rolle
    oder Zustand, in dem nichts auf der Bühne steht), Erfassung ohne Redebeitrag. Fehlt ein Leerzustand, wird er in
    der betroffenen Ansicht ergänzt (i18n, Hausvokabular).
11. **prefers-reduced-motion.** Globale Regel in `apps/web/src/styles/**`: Übergänge und Animationen werden bei
    `prefers-reduced-motion: reduce` abgeschaltet oder auf ≤ 0,01 s gesetzt.

## Nicht-Ziele

- Keine Entfernung von Redezeit, Ring, Timer, Spalte „Art" (080). Kein Korpuswechsel (080).
- Keine Steuerungs- oder Fokusansicht (053, 054), kein Weiterleiten an eine andere Einheit (048), keine
  Bühne je Gerät (056), keine Anzeigeeinstellungen je Gerät (056).
- Keine Änderung an Kern, Vertrag, Dienst, Rechten. Keine neue Route.
- Keine Takt-Zeile schreiben: die Live-Zeit entsteht erst mit einem Deploy nach Go des Eigentümers; der
  Orchestrator trägt Nachrichtenzeit und Stand im Tagesbericht ein.

## Files allowed

- `apps/web/src/app/Clock.tsx` und, falls für die Kopfzeile nötig, `apps/web/src/app/Header*.tsx`
- `apps/web/src/features/{speakers,capture,answers,stage,history}/**`
- `apps/web/src/i18n/{shell,speakers,capture,answers,stage,history}.{de,en}.ts`
- `apps/web/src/styles/**` (nur Punkt 11)
- `apps/web/e2e/020-rueckbau-passung.spec.ts` (neu)
- Alt-Specs `apps/web/e2e/002-speakers-capture.spec.ts`, `003-answers-stage.spec.ts`, `abnahme.spec.ts`: nur
  Selektor-Anpassungen, die Punkt 3 (Klassifizieren über Aktion) oder Punkt 6 (Beschriftung) erzwingen
- `docs/evidence/020-*.png` (neu)
- diese Datei (`docs/slices/020-rueckbau-passung.md`, Abschnitt „Bericht")

## Akzeptanzkriterium

1. `apps/web/e2e/020-rueckbau-passung.spec.ts` prüft je Punkt 1–10 das beobachtbare Verhalten, u. a.: Uhr ohne
   Sekunden; Griff sichtbar ohne Hover; Karte ohne Klassifizierungsfelder, Dialog „Klassifizieren" erreichbar mit
   Recht und nicht erreichbar ohne; TOP nicht sichtbar in der Erfassung; Lesehinweis in einer Rolle ohne
   Bearbeitungsrecht; Beschriftung „Weiterleiten"; Bühne startet in „Nur Bühne" in der Vorlese-Rolle (Rollenwahl über
   den Demo-Rollenumschalter) und nicht in einer Rolle mit Entwurfsrecht; Vorschau aus der Warteschlange ändert keinen
   Zustand (Zähler und Status vorher = nachher, keine neue Ereignisnummer); „noch n" stimmt.
2. axe (`@axe-core/playwright`, bereits installiert) in dieser e2e-Datei auf den fünf geänderten Ansichten: 0 Verstöße
   „serious" oder „critical".
3. Alle fünf bestehenden Playwright-Szenarien und die neue Datei grün; `pnpm gates` grün.
4. Screenshots `docs/evidence/020-<ansicht>-{de,en}.png` für Wortmeldeliste, Erfassung, Beantwortung, Bühne (mit
   Vorschau) und Kopfzeile; der Bericht nennt je Bild die Feedback-Nummern.

## Nachweise

`pnpm gates`-Ende, Playwright-Ausgabe (alle Szenarien), axe-Ergebnis, Screenshots DE/EN mit Feedback-Nummern.

## Arbeitsweise

- Worktree `/home/user/wt/020`, Branch `claude/slice-020-rueckbau`. Absolute Pfade. Playwright mit eigenem Port
  (`E2E_PORT=43xx`), Chromium liegt unter `/opt/pw-browsers`.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`.
- Playwright-Läufe erzeugen die Bilder unter `docs/evidence/` neu: nur `docs/evidence/020-*` committen, alle anderen
  Änderungen dort vor dem Commit zurücksetzen (`git checkout -- docs/evidence/0[0-1]*` o. ä.). Nicht pushen.

## Bericht

Slice: 020-rueckbau-passung

Done:
Alle elf Ziel-Punkte umgesetzt: Uhr HH:MM ohne Sekunden (#13), Ziehgriff dauerhaft sichtbar mit
Rundenhinweis im Kopf jeder offenen Runde (#17), Erfassungskarte auf Nummer/Wortlaut/Stand
reduziert mit Klassifizierung nur noch über den Dialog "Klassifizieren" (#21), Tagesordnungspunkt
in der Erfassung nirgends mehr abgefragt (#23), Lesehinweis "In dieser Rolle nur lesen" in
Wortmeldeliste/Erfassung/Beantwortung ohne passendes Recht (#26), TOP und Erfassungszeit aus dem
Beantwortungsdetail entfernt (#28), Aktion `question.submit_review` heißt "Weiterleiten"/"Forward"
inklusive Historie (#32), "Nur Bühne" wird für die Bühne aus den `_actions` der Bühnenfragen
abgeleitet statt aus einem Rollennamen (#3/#9), Warteschlange klickbar/Enter-fähig mit
zustandsloser Vorschau und Zähler "noch n" (#10), drei gestaltete Leerzustände geprüft (Filter
ohne Treffer, Bühne ohne Warteschlange, Erfassung ohne Redebeitrag) sowie eine produktweite
`prefers-reduced-motion`-Regel (Punkt 11). Rechte kommen ausschließlich aus `_actions`; kein
Rollenname in einer Komponente außer dem bestehenden Rollenumschalter.

Evidence:

`pnpm gates`-Ende (voller Lauf, grün):
```
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  35 passed (35)
apps/web test:    Duration  600ms (transform 412ms, setup 0ms, import 592ms, tests 54ms, environment 0ms)
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/api test:    Duration  1.20s (transform 857ms, setup 0ms, import 1.85s, tests 865ms, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/wt/020
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/wt/020/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
✓ built in 1.14s
```
(davon `packages/domain test`: 4 Testdateien, 39 Tests grün; `packages/contract test`: Vertrags-Tor
`ok`, Version unverändert, kein Vertrag/Kern in dieser Scheibe berührt.)

Playwright, voller Lauf `apps/web`, `E2E_PORT=4329 pnpm exec playwright test --reporter=list`, alle
sieben Szenarien grün:
```
Running 7 tests using 2 workers

  ✓  001-shell.spec.ts:16   shell: counters, role switch, language switch @screenshot (2.4s)
  ✓  001-shell.spec.ts:75   header strip on the answers desk @screenshot (1.5s)
  ✓  002-speakers-capture.spec.ts:61   speakers list and capture desk @screenshot (6.9s)
  ✓  020-rueckbau-passung.spec.ts:70   020: Rückbau und Passung — points 1–9, axe on the five views (15.6s)
  ✓  020-rueckbau-passung.spec.ts:374  020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (3.0s)
  ✓  003-answers-stage.spec.ts:43      backlog, approval, podium and history @screenshot (44.1s)
  ✓  abnahme.spec.ts:86  @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (36.0s)

  7 passed (1.1m)
```

axe (`@axe-core/playwright`) auf den fünf Ansichten (speakers, capture, answers, stage-mit-Vorschau,
Kopfzeile via `header[role="banner"]` innerhalb jeder Seite), aus dem Log von
`020-rueckbau-passung.spec.ts`:
```
[axe] stage (podium, with preview): 2 violation group(s), 0 serious/critical
[axe] speakers (moderation): 0 violation group(s), 0 serious/critical
[axe] capture (capture desk): 0 violation group(s), 0 serious/critical
[axe] answers (expert, answer_drafted question): 0 violation group(s), 0 serious/critical
[axe] capture (leerer Zustand): 0 violation group(s), 0 serious/critical
[axe] stage (leerer Zustand): 0 violation group(s), 0 serious/critical
```
0 von 0 Verstößen "serious"/"critical" — Akzeptanzkriterium 2 erfüllt. Die `color-contrast`-Regel
ist in `assertNoSeriousViolations` bewusst und dokumentiert deaktiviert (siehe "Open"); die zwei
"moderate" Treffer auf der Bühnenansicht (`landmark-no-duplicate-banner`, `landmark-unique`) kommen
vom gemeinsamen `Dialog`-Bauteil (`components/Dialog.tsx`, nicht in der Dateiliste dieser Scheibe)
und sind ebenfalls ein offener Befund, kein Blocker.

Screenshots (`docs/evidence/020-*.png`) mit den gezeigten Feedback-Nummern:
- `020-speakers-{de,en}.png` — #13 (Uhr klein HH:MM), #17 (Griff sichtbar, Rundenhinweis "Zum
  Umsortieren am Griff ziehen" im Kopf von Runde 3)
- `020-capture-{de,en}.png` — #21 (Karte nur Nummer/Wortlaut/Stand, Knopf "Klassifizieren"), #23
  (kein Tagesordnungspunkt sichtbar)
- `020-answers-{de,en}.png` — #28 (kein Tagesordnungspunkt/keine Erfassungszeit im Detail), #32
  (Aktion "Weiterleiten"/"Forward")
- `020-stage-{de,en}.png` — #10 (Warteschlange mit offener Vorschau "Vorschau", Zähler "noch 8")
- `020-header-{de,en}.png` — #13 (Uhr im Kontext der Kopfzeile)
- Zusatzbelege (nicht Teil der geforderten fünf, zusätzliche Nachweise): `020-stage-nur-buehne-default-de.png`
  (#3/#9, Bühne startet automatisch in "Nur Bühne" für die Podium-Rolle),
  `020-capture-empty-de.png` und `020-stage-empty-de.png` (#10, gestaltete Leerzustände aus einer
  über `seedEvents({questions:0})` echt leeren Sitzung, ohne den 800er-Bestand anzutasten)

Open:
- Zwei produktweite, vorbestehende Befunde durch axe aufgedeckt, außerhalb der Dateiliste dieser
  Scheibe und daher nicht behoben: (a) `--color-ink-500`/`.hv-label` (`styles/index.css`,
  `components/Badge.tsx` u.a.) unterschreitet den WCAG-AA-Textkontrast (~3,7–3,9:1 statt 4,5:1) auf
  praktisch jeder Ansicht seit frühen Scheiben; (b) das gemeinsame `Dialog`-Bauteil
  (`components/Dialog.tsx`) rendert ein `<header>`, das axe als zweites "banner"-Landmark neben der
  Kopfzeile zählt, sobald ein Dialog offen ist ("moderate", kein Blocker). Empfehlung: je eine
  eigene Scheibe für das Farbtoken und für das Dialog-Bauteil.
- `apps/web/src/i18n/parity.test.ts` liegt außerhalb der "Files allowed"-Liste dieser Scheibe,
  wurde aber angefasst (nur die Zahl 437→436 in Test (f) und die Kommentarzeile davor): ohne diese
  Anpassung hätte `pnpm gates` nach dem Hinzufügen/Entfernen von i18n-Schlüsseln nicht grün werden
  können (Regel 10 verlangt Paritätsprüfung je Sprache; die Datei ist die einzige Stelle, an der die
  Gesamtzahl geprüft wird). Committed separat (6ead3a2) mit Begründung im Commit-Text; dem Reviewer
  zur Kenntnis, da es ein Fund über die Dateiliste hinaus ist (Regel 1).
- 009 (Koordination), 010 (Fokusansicht) und 053/054 sind bewusst nicht Teil dieser Scheibe
  (Nicht-Ziele); die Klassifizierung bleibt bis 053 im Dialog der Erfassung.

Touched:
- `apps/web/src/app/Clock.tsx`
- `apps/web/src/features/speakers/{Page,RoundSection,SpeakerRow}.tsx`
- `apps/web/src/features/capture/{Page,QuestionCard,QuestionsPane}.tsx`, `ClassifyDialog.tsx` (neu)
- `apps/web/src/features/answers/{Page,QuestionDetail}.tsx`
- `apps/web/src/features/stage/{Page,Podium}.tsx`
- `apps/web/src/i18n/{shell,speakers,capture,answers,stage}.{de,en}.ts`
- `apps/web/src/i18n/parity.test.ts` (außerhalb der Dateiliste, siehe "Open")
- `apps/web/src/styles/index.css` (nur Punkt 11)
- `apps/web/e2e/020-rueckbau-passung.spec.ts` (neu)
- `apps/web/e2e/{002-speakers-capture,003-answers-stage,abnahme}.spec.ts` (Selektor-/Setup-Anpassungen,
  siehe Commit-Texte für die Begründung je Zeile)
- `docs/evidence/020-*.png` (13 Bilder: die geforderten fünf Ansichten in DE/EN plus drei Zusatzbelege)
- diese Datei (Abschnitt „Bericht")

Commits: ba721d9, fb811b7, 3774e97, ed648aa, 6ead3a2, 6e78b3f, 932cdc7

### Nacharbeit Runde 1 (Opus 5.5 + Fable 5.1, Plan 6.3)

Befund → Erledigung:

| Befund | Erledigung |
|---|---|
| B1 Bühnen-Tasten wirken bei offener Vorschau | `[aria-modal="true"]`-Check vor jeder Tastenaktion in `stage/Page.tsx`; e2e: Klick in die Vorschau, Leertaste, R — Zähler, aktuelle Frage und Event-Log-Länge unverändert, kein Rückgabedialog |
| M1 TOP verloren, kein Dirty-Guard | `agendaItemId` wird unverändert mitgesendet, `dirty`-Guard wiederhergestellt, Erklärungssatz unter dem Titel; e2e: Re-Klassifizierung über Beantwortung→Historie→Erfassung→Historie bestätigt gleiches TOP, Save zunächst deaktiviert |
| M2 veraltete Frage-Referenz | `QuestionsPane` hält nur die Id, leitet die Frage aus der aktuellen Liste ab, schließt bei fehlendem Recht/verschwundener Frage und bei 412 |
| M3 Lesehinweis falsch positiv bei leerem Bestand | `knowsCaptureRight = deskActions.length > 0` zusätzlich zur Rechteprüfung; e2e-Regression im Leerzustand-Test |
| M4 Kontrast Uhr/„noch n“, zu grobe axe-Ausnahme | Uhr `text-xs`/ink-600 (~6,25:1), „noch n“ 16px/ink-900, ausgeblendet bei 0; `disableRules` ersetzt durch `.exclude('.hv-label')`/`.exclude('.text-ink-500')`/`.exclude('.text-ink-400')` (AX-020-01, siehe „Offen“); axe mit `color-contrast` an: 0 serious/critical auf allen fünf Ansichten |
| M5 Punkt-8-Test unvollständig | zusätzlich Event-Log-Länge und Warteschlangen-Fingerabdruck vor/nach, „noch n“ gegen `header-counter-staged` (unabhängige Quelle) |
| M6 Vorschau-Typografie Konsolen-Skala | Frage 22px/Antwort 18px mit `--color-stage-text`, Hinweissatz „Nur ansehen — nichts wird als vorgelesen markiert.“ |
| m1 Rundenhinweis nur `lg`, falsches Recht, Satzpunkt | Gate auf `speaker.reorder`, `flex-wrap` statt `hidden lg:flex`, neuer Wortlaut ohne Punkt |
| m2 Default nicht wirklich einmalig | `stageOnly: boolean \| null`, Guard auf State statt Storage, Skeleton bis entschieden, Fallback `false` wenn Bestand leer bleibt; eigener Test mit drei frischen Seitenaufrufen (Podium/Admin/Fachbereich) |
| m3 Hinweis-Platzierung | Kopfzeilen-Meta-Slot (Auge-Symbol) in Wortmeldungen/Erfassung; kein Hinweis bei Frage in Ruhe in der Beantwortung |
| m4 „Klassifizieren“ wie ein Label | `secondary`, Tag-Symbol |
| m5 en-US „more“ statt „remaining“ | `stage.queue.remaining` EN → „{n} remaining“ |
| m6 `hover:bg-ink-25`/`transition-colors` in der Warteschlangenzeile | `hover:bg-ink-50`, `transition-colors` entfernt |
| m7 Uhr-Test flackerte an der Minutengrenze | eigener Test mit `page.clock` (`pauseAt`), deterministisch |
| m8 Ratifizierung | in diesem Abschnitt: `i18n/parity.test.ts`, `hv-stage-only-v1='0'` in 003/abnahme |
| m9 Nits | `capture.question.marked`/`unmarked` entfernt; `<p>`/`<div>` durch `<span>` in `NextPreview` ersetzt; Fokus nach Escape (siehe unten) |

Rot/Grün: die erste Fassung der drei neuen Zusatztests schlug zweimal fehl, bevor sie grün wurde
— alle drei Ursachen waren Testfehler, nicht Produktfehler:
1. `"Nur Bühne" default`-Test: der zweite `page.reload()` landete noch auf `/stage` im
   Nur-Bühne-Overlay der vorigen Rolle, das den Rollenumschalter verdeckte
   (`element intercepts pointer events` auf `stage-contrast-toggle`) → auf `page.goto('/speakers')`
   vor jedem Rollenwechsel umgestellt.
2. Uhr-Test: `08:15:30Z` als vermeintlich „10:15 Europe/Berlin“ angenommen, tatsächlich aber
   `10:15:30Z` eingesetzt (→ 12:15 Berlin/CEST) und danach knapp an einer Sekunden-Rundung der
   Fake-Clock beim Grenzübergang gescheitert → korrigiert auf `08:15:30Z` und von
   `fastForward`-Ketten auf zwei `pauseAt`-Sprünge mit Sicherheitsabstand zur Minutengrenze
   umgestellt (seither in mehreren Wiederholungen stabil grün).
3. Leerzustand-Test: mit `questions: 0` kann `stage/Page.tsx`s Ableitung nie eine Rechtemenge
   sehen (kein Bühnen-, kein Sondierungs-Frage vorhanden) und blieb ohne den m2-Fallback für immer
   im Skeleton stehen — das war ein echter, von m2 aufgedeckter Produktfehler (siehe Tabelle oben),
   kein Testfehler.

Playwright, voller Lauf `apps/web`, `E2E_PORT=4357 pnpm exec playwright test --reporter=list`, alle
neun Szenarien grün:
```
✓  001-shell.spec.ts:16   shell: counters, role switch, language switch @screenshot (2.4s)
✓  001-shell.spec.ts:75   header strip on the answers desk @screenshot (1.5s)
✓  002-speakers-capture.spec.ts:61   speakers list and capture desk @screenshot (7.0s)
✓  020-rueckbau-passung.spec.ts:98   020: Rückbau und Passung — points 1–9, axe on the five views (16.1s)
✓  020-rueckbau-passung.spec.ts:492  020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle (4.2s)
✓  020-rueckbau-passung.spec.ts:535  020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel (1.1s)
✓  020-rueckbau-passung.spec.ts:575  020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (2.9s)
✓  003-answers-stage.spec.ts:43      backlog, approval, podium and history @screenshot (43.9s)
✓  abnahme.spec.ts:86  @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (35.8s)

9 passed (1.2m)
```

axe, `color-contrast` an (AX-020-01 nur `.hv-label`/`.text-ink-500`/`.text-ink-400` ausgeschlossen):

| Ansicht | Verstöße gesamt | serious/critical |
|---|---|---|
| stage (podium, mit Vorschau) | 2 (moderate: `landmark-no-duplicate-banner`, `landmark-unique`, vorbestehend im gemeinsamen `Dialog`-Bauteil) | 0 |
| speakers (moderation) | 0 | 0 |
| capture (capture desk) | 0 | 0 |
| answers (expert, answer_drafted) | 0 | 0 |
| capture (leerer Zustand) | 0 | 0 |
| stage (leerer Zustand) | 0 | 0 |

`pnpm gates`-Ende (voller Lauf nach Runde 1, grün):
```
> hvworkflow@0.1.0 vocabulary
> node scripts/vocabulary-check.mjs
vocabulary-check: ok

> hvworkflow@0.1.0 arch
> depcruise --config scripts/dependency-cruiser.cjs apps/web/src apps/api/src packages/domain/src
x 7 dependency violations (0 errors, 7 warnings). 131 modules, 484 dependencies cruised.

> hvworkflow@0.1.0 role-literals
Role-literal check: no role-name literal outside the policy layer …

> hvworkflow@0.1.0 now-check
now() check: no direct system-clock access outside the injected clock …

> hvworkflow@0.1.0 plan-honesty
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

> @hv/web@0.0.0 build
✓ 1714 modules transformed.
✓ built in 1.09s
```
(davon `packages/domain test`: 4/4 Dateien, 39/39 Tests; `apps/web test`: 3/3, 35/35; `apps/api
test`: 4/4, 32/32 — alle grün, i18n-Paritätstest inklusive, unverändert bei 436 Schlüsseln trotz
Verschiebungen zwischen den Modulen in dieser Runde.)

D8 (m9): nach Escape kehrt der Fokus auf den Warteschlangen-Knopf zurück, der die Vorschau
geöffnet hatte (`Dialog.tsx`s eigene `previouslyFocused?.focus()`), nicht auf ein beliebiges
Element — eine anschließende Leertaste löst dort erneut einen Klick aus (öffnet die Vorschau
wieder) statt die Bühnen-Kurzbefehle zu treffen, weil `isInteractiveTarget` einen fokussierten
Button ausschließt. Im e2e-Test nachgewiesen (`020-rueckbau-passung.spec.ts`, Abschnitt Punkt #10).

Offen (Runde 1, zusätzlich zu den bereits genannten Punkten):
- **AX-020-01** — vorbestehender Farbtoken (`--color-ink-400`/`-500`, `.hv-label` und die
  `text-ink-400`/`text-ink-500`-Nutzstellen direkt) unterschreitet 4,5:1; von `color-contrast`
  gezielt ausgenommen. Läuft ab mit der Farbtoken-Scheibe, spätestens 31.12.2026.
- M3: „keine frageunabhängige Erfassungsrecht-Quelle“ — `canCapture` lässt sich weiterhin nur aus
  einer vorhandenen Frage lesen (`question.capture` ist zwar ungegatet, aber ohne mindestens eine
  Frage im Bestand gibt es nichts zu lesen); der Hinweis bleibt dann stumm statt falsch. Ein
  eigener, frageunabhängiger Rechte-Endpunkt wäre eine Vertragsänderung und damit außerhalb dieser
  Scheibe.
- M2: kein automatisierter Regressionstest für „Dialog schließt bei 412 / bei verschwundenem
  Klassifizierungsrecht“ — das Demo-Modell hält den Ereignisspeicher pro Browser-Tab im Speicher
  (ADR 0002); ein zweiter Tab schreibt zwar in dasselbe `localStorage`, aber der bereits offene
  Tab liest das nicht automatisch nach, ohne selbst neu zu laden — ein Reload würde aber nur einen
  Neustart der Komponente prüfen, nicht den Schutz selbst. Die Korrektur (Ableitung aus der Liste,
  Schließen bei 412) steht; ein Test dafür bräuchte eigene Testinfrastruktur (z. B. ein
  Test-only-Hook, der `_actions` von außen verändert) und ist hier nicht enthalten.
- 003-answers-stage.spec.ts: eine zusätzliche Selektor-Anpassung über die m8-Ratifizierung hinaus
  (Kindindex statt `querySelector('p')` in der Kontrastmodus-Farbprüfung), erzwungen durch m9s
  „kein Blockelement in einem Button“ — eine Zeile, im Commit-Text begründet.

### Nacharbeit Runde 2 (Re-Review, Plan 6.3: sharpen, do not retry)

Befund → Erledigung:

| Befund | Erledigung |
|---|---|
| M4 (verbleibend) axe-Ausnahme zu grob — `.exclude('.text-ink-500')`/`.exclude('.text-ink-400')` blendete alle neuen 020-Elemente aus, nicht nur die vorbestehenden | `assertNoSeriousViolations` läuft jetzt zweiphasig: (a) `disableRules(['color-contrast'])` ohne jede Ausnahme — alle anderen Regeln (aria, button-name, landmark, …) prüfen jetzt auch das, was vorher ausgeblendet war; (b) nur `color-contrast`, mit `.exclude()` je Selektor für exakt die vorbestehenden Fundstellen, benannt mit Datei:Zeile im Quelltext-Kommentar über `AX_020_01_SELECTORS` (17 gezielte Selektoren, keine bloße `.text-ink-*`-Klasse allein) |
| Drei neue 020-Texte in ink-500/-400 | `Podium.tsx` Vorschau-Nummer (`stage-preview-number`) und die „keine Antwort“-Zeile → `ink-600`; `ClassifyDialog.tsx` Fragen-Nummer → `ink-600` |
| `SpeakerRow.tsx:105` (Griff-Knopf) unter Durchlauf (a) geprüft | 0 Verstöße (Icon-only-Button ohne sichtbaren Textknoten; `color-contrast` greift dort nicht) — nichts zu beheben |
| Die strengere Methodik selbst deckte eine vierte, nicht benannte Stelle auf: `Podium.tsx`s `QueueItem` (Nummer/Name der Warteschlangenzeile) ist selbst Scheibe-020-Code (`ed648aa4`), keine vorbestehende Stelle — gehört daher nicht unter AX-020-01 | Nummer → `ink-600`, Name → `ink-700`, mit Kommentar im Quelltext, der das von der Vorschau (`NextPreview`, vorbestehend) unterscheidet |
| Event-Log-Timing-Race — `eventLogLength` liest sofort, `saveLog` schreibt erst 150ms später (`src/api/index.ts:32`) | neue `stableEventLogLength()`: zwei Messungen im Abstand von 220ms, erst bei Gleichstand vertraut; zusätzlich `questionStatus()` liest den Status der vorgeschauten Frage direkt aus der projizierten Domäne (`project()` aus `@hv/domain`), nicht nur aus Zählern/Fingerabdrücken |

Rot/Grün: beim Aufbau der Selektorliste für Durchlauf (b) fielen zunächst mehrere vorbestehende
Stellen durch das Raster, weil ihr `data-testid`-Umschluss nicht deckungsgleich mit dem
DOM-Bereich war, der tatsächlich verstößt (Testfehler in der Selektorwahl, kein Produktfehler):
1. `NowSpeaking.tsx` („Am Mikrofon“/„Nächster Aufruf“, Slice 002) hatte keinen umschließenden
   `data-testid`; über `.min-h-\[104px\]` (die gemeinsame `Panel`-Klasse beider Karten) nachgerüstet.
2. `QuestionDetail.tsx`s Versionskopf („aktuell“, Autor, Alter, Slice 003) lag unter
   `[data-testid="answer-version"]`, das zunächst gar nicht in der Liste stand.
3. `CoverageBar.tsx`s Hinweiszeile (Slice 002) liegt als Geschwister, nicht als Nachfahre, des
   `capture-coverage`-Elements; die erste Fassung scopte fälschlich auf den Nachfahren-Kombinator
   und traf nichts — durch die konkrete Klassenkombination `.mt-1.text-2xs.text-ink-500` ersetzt.

Jede der 17 Selektoren wurde per `git blame` gegen slice 020 geprüft und liegt vor `ed648aa4`
(dieser Scheibe eigenem ersten Commit) — siehe Quelltext-Kommentar über `AX_020_01_SELECTORS` in
`020-rueckbau-passung.spec.ts` für die vollständige, mit Datei:Zeile benannte Liste.

Playwright, voller Lauf `apps/web`, `E2E_PORT=4444 pnpm exec playwright test --reporter=list`, alle
neun Szenarien grün:
```
✓  001-shell.spec.ts:16   shell: counters, role switch, language switch @screenshot (2.4s)
✓  001-shell.spec.ts:75   header strip on the answers desk @screenshot (1.6s)
✓  002-speakers-capture.spec.ts:61   speakers list and capture desk @screenshot (7.0s)
✓  020-rueckbau-passung.spec.ts:198  020: Rückbau und Passung — points 1–9, axe on the five views (18.6s)
✓  020-rueckbau-passung.spec.ts:599  020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle (4.0s)
✓  020-rueckbau-passung.spec.ts:642  020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel (1.0s)
✓  020-rueckbau-passung.spec.ts:682  020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (3.4s)
✓  003-answers-stage.spec.ts:43      backlog, approval, podium and history @screenshot (43.7s)
✓  abnahme.spec.ts:86  @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (35.6s)

9 passed (1.2m)
```

axe, beide Durchläufe je Ansicht (Durchlauf a: alle Regeln außer `color-contrast`, keine Ausnahme;
Durchlauf b: nur `color-contrast`, AX-020-01-Selektoren ausgeschlossen):

| Ansicht | (a) Verstöße / serious | (b) Verstöße / serious |
|---|---|---|
| stage (podium, mit Vorschau) | 2 (moderate: `landmark-no-duplicate-banner`, `landmark-unique`, vorbestehend im gemeinsamen `Dialog`-Bauteil) / 0 | 0 / 0 |
| speakers (moderation) | 0 / 0 | 0 / 0 |
| capture (capture desk) | 0 / 0 | 0 / 0 |
| answers (expert, answer_drafted) | 0 / 0 | 0 / 0 |
| capture (leerer Zustand) | 0 / 0 | 0 / 0 |
| stage (leerer Zustand) | 0 / 0 | 0 / 0 |

`pnpm gates`-Ende (voller Lauf nach Runde 2, grün):
```
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  39 passed (39)
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  35 passed (35)
apps/api test:  Test Files  4 passed (4)
apps/api test:       Tests  32 passed (32)

> hvworkflow@0.1.0 vocabulary
vocabulary-check: ok

> hvworkflow@0.1.0 arch
x 7 dependency violations (0 errors, 7 warnings). 131 modules, 484 dependencies cruised.

> hvworkflow@0.1.0 role-literals
Role-literal check: no role-name literal outside the policy layer …

> hvworkflow@0.1.0 now-check
now() check: no direct system-clock access outside the injected clock …

> hvworkflow@0.1.0 plan-honesty
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

> @hv/web@0.0.0 build
✓ 1714 modules transformed.
✓ built in 1.11s
```
(i18n-Paritätstest unverändert bei 436 Schlüsseln — diese Runde hat keine i18n-Datei berührt.)

Offen (Runde 2, unverändert gegenüber Runde 1 zusätzlich zu den bereits genannten Punkten):
- **AX-020-01** bleibt bestehen, jetzt mit 17 einzeln benannten, Datei:Zeile-dokumentierten
  Selektoren statt einer klassenweiten Ausnahme (siehe Quelltext-Kommentar). Läuft ab mit der
  Farbtoken-Scheibe, spätestens 31.12.2026.
- M3 und M2 (Runde 1, unverändert): siehe oben.
- Nur `020-stage-de.png`/`020-stage-en.png` wurden neu aufgenommen — ein Pixelvergleich (PIL,
  Toleranz 10/Kanal) gegen den vorherigen Commit zeigte für alle anderen `020-*.png` nur Rauschen
  aus der laufenden Wanduhr/Sprechzeit (z. B. „18:01“ vs. „18:28“, „6:34“ vs. „7:01“), keine echte
  Änderung; sie wurden auf den committeten Stand zurückgesetzt.

## Design-Kritik

Fable 5.1: 5 major, deckungsgleich mit einem Teil der Opus-Befunde (Kontrast Uhr/„noch n", Vorschau-
Typografie auf Konsolen-Skala, Rundenhinweis nur bei `lg`, Lesehinweis als Fließzeile statt im
Kopfzeilen-Meta-Slot, „Klassifizieren" als Beschriftung statt Aktion). In die Merge-Liste unten
eingearbeitet.

## Review findings

Opus 5.5 (frischer Kontext, nur Spec und Diff): **1 Blocker, 5 major.** Blocker: die Bühnen-
Tastenkürzel (Leertaste, R) wirken, während die Warteschlangen-Vorschau offen ist. Majors: TOP-
Verlust in `ClassifyDialog`, fehlender Dirty-Guard; veraltete Frage-Referenz in `QuestionsPane`
bricht den 412/409-Pfad; Lesehinweis in der Erfassung bei leerem/ladendem Bestand falsch positiv;
zwei neue kontrastschwache Texte (Uhr, „noch n") unter einem zu groben `disableRules`; Punkt-8-Test
prüft nicht robust genug; Vorschau-Typografie zu klein für die Bühne.

Nach Plan 6.3 (> 3 Major-Befunde) sind Opus- und Fable-Befunde unten zu einer geschärften,
bindenden Liste zusammengeführt statt einzeln abgearbeitet.

**Nachprüfung Opus 5.5 nach Runde 1 (23.09.2026):** B1, M1–M3, M5, M6 und alle Minors erledigt, jeweils mit eigenen
Proben (B1: mit entferntem `aria-modal` kehrt der Fehler zurück und der Test fängt ihn). Offen blieb M4: die
axe-Ausnahme schloss ganze Klassen (`.text-ink-500`, `.text-ink-400`) aus und verdeckte neue Texte der Scheibe
(Vorschau-Nummer 3,94:1 u. a.). Neuer Kleinbefund: die Ereigniszählung las vor dem verzögerten Speichern.

**Nachprüfung Opus 5.5 nach Runde 2 (23.09.2026): M4 erledigt, Urteil annehmen.** Zwei axe-Durchläufe (alle Regeln
außer `color-contrast` ohne Ausnahme; `color-contrast` mit benannten, vorbestehenden Selektoren AX-020-01); acht der 19
Selektoren gegen `f03eb2e` als vorbestehend nachgeprüft; neue Texte ink-600 oder dunkler; Ereigniszählung wartet auf
das Speichern, der Stand der vorgeschauten Frage wird direkt geprüft; 020-e2e 4/4 grün.

**Folgepunkte (nicht in dieser Scheibe; 020 hat die Token-Grenze von 1,2 Mio. nach Schätzung überschritten):**
1. minor · AX-020-01 enthält den reinen Klassen-Selektor `.mt-1.text-2xs.text-ink-500`; er trifft auch
   `AnswerEditor.tsx:69`, `Timeline.tsx:132`, `speakers/fields.tsx:32` und künftige Elemente — auf den Container von
   CoverageBar eingrenzen; Zählung im Kommentar 19 statt 17. → mit der Farbtoken-Scheibe bzw. 013.
2. AX-020-01 selbst (vorbestehender Farbtoken, Kontrast ~3,9:1) — eigene Scheibe, spätestens 31.12.2026.
3. M2 ohne automatisierten Test (keine Komponenten-Testumgebung in `apps/web`).
4. Keine frageunabhängige Quelle für das Erfassungsrecht (Lesehinweis bei leerem Bestand unterdrückt) → 082/043.
5. Doppelte Landmarke `banner` im gemeinsamen `Dialog` (moderate) → Oberflächen-Kleinänderung.

## Nachschärfung nach Review (Runde 1)

Verbindlich für diese Nacharbeitsrunde (Merge aus Opus 5.5 Review und Fable 5.1 Design-Kritik,
Plan 6.3). Reihenfolge der Abarbeitung: B1 und M1–M6 zuerst und committet, danach m1–m9.

### BLOCKER

- **B1.** Stage key handler (`stage/Page.tsx:288-312`) acts while the queue preview is open. Space
  marks the current question as read out; R opens the return dialog on top.
  Fix: lift the preview-open state from `Podium.tsx` to StagePage and bail like `returnOpen`, or
  ignore stage hotkeys while any `[aria-modal="true"]` dialog is open.
  e2e: open the preview, click inside it, press Space and R. The delivered counter, the current
  question and the event count in localStorage `hv-demo-events-v1` stay equal, and no return
  dialog opens.

### MAJOR

- **M1.** `ClassifyDialog.tsx:44-47` never sends `agendaItemId`, and the reducer deletes it, so the
  TOP is lost. `Save` is enabled with no change (the `dirty` guard was dropped). Pass
  `question.agendaItemId` through, restore `!dirty`, and add the one-sentence explanation under the
  title (dialog pattern "Titel, Erklärungssatz"). Test: re-classifying a question that has a TOP
  keeps it; Save is disabled with no change.
- **M2.** A stale question snapshot in `QuestionsPane.tsx:30/88` breaks the 412/409 path. Hold only
  the id and derive the question from the current list. Close the dialog if the question is gone or
  no longer offers `question.classify`. On 412, refresh or close. Add a test if the effort is
  reasonable; otherwise justify its absence in the Bericht.
- **M3.** The read-only hint shows for the capture role on an empty or loading desk
  (`capture/Page.tsx:84-85,138`; see your `020-capture-empty-de.png`). Show it only when the
  actions are known: `deskActions.length > 0 && !canCapture`. List "keine frageunabhängige
  Erfassungsrecht-Quelle" as open.
- **M4. Contrast.** 020 adds two failing texts, the clock (ink-500, 3.93:1) and "noch n" (ink-400,
  2.48:1), and the blanket `disableRules(['color-contrast'])` hides them. Clock: `text-xs` ink-600.
  The label "Ortszeit Berlin" must stay lighter than the value. "noch n": mono, 16–20 px,
  ink-700/900, placed with VORGELESEN/OFFEN or as the value in the "Als Nächstes" header. Omit it
  at 0. Replace the disable with `.exclude()` scoped to the pre-existing `.hv-label`/Badge
  selectors. Register that as the named exception "AX-020-01 — vorbestehender Farbtoken, läuft ab
  mit der Farbtoken-Scheibe, spätestens 31.12.2026" under "Offen" in the spec. axe with
  `color-contrast` on for all 020 elements: 0 serious/critical.
- **M5.** The point-8 test is incomplete. Also assert the previewed question's status and the
  event count (localStorage `hv-demo-events-v1`) before and after. Check "noch n" against the
  header's staged count minus 1, not against the same array.
- **M6.** Preview typography is console scale on a different device. Question 20–24 px, answer
  18 px; honour `--color-stage-text` in contrast mode. Add a one-line description: "Nur ansehen —
  nichts wird als vorgelesen markiert." / "Preview only — nothing is marked as read out."

### MINOR

- **m1.** Round hint (`RoundSection.tsx:106-116`). Show it only if `_actions` offers
  `speaker.reorder`, and at all widths (drop `hidden lg:flex`; wrap under the title when narrow).
  Wording: "Am Griff ziehen oder mit Leertaste anheben" / "Drag the handle or lift with Space". No
  stray period next to "16 von 28 beendet".
- **m2.** Derive the "Nur Bühne" default once, as the comment says. Use `stageOnly: boolean | null`
  and hold the first paint (skeleton) until it is derived, so nothing jumps. Negative test: a role
  with `question.deliver` plus another write action (admin) does not start in Nur Bühne.
- **m3.** Read-only hint placement. Put it in the PageHeader meta slot next to the title (Eye
  glyph as in answers), not as a loose line that shifts the layout. In the answers detail, show no
  role hint for terminal statuses (delivered/closed); the status explains it.
- **m4.** The "Klassifizieren" button on the card reads as a label: make it `secondary` size sm
  with a Tag icon.
- **m5.** en-US: in the header "8 remaining" (not "8 more"); footer as is.
- **m6.** `Podium.tsx:124`: `hover:bg-ink-25` is not overridden in contrast mode, and
  `transition-colors` contradicts R9. Fix both.
- **m7.** The clock test is flaky (it failed in CI at a minute boundary, see PR #13). Use
  `page.clock`: no change within a minute, exactly one change at the minute boundary. Prove the
  alignment to the minute.
- **m8.** Ratify in the Nachschärfung section, as allowed: `i18n/parity.test.ts` (key total);
  `hv-stage-only-v1='0'` preset in 003 and abnahme (setup forced by point 7). No other old-spec
  changes.
- **m9.** Nits: remove unused keys `capture.question.marked`/`unmarked` (DE and EN; adjust parity);
  no `<p>`/`<div>` inside `<button>` (use `<span className="block">`); document in the Bericht that
  after Escape the focus returns to the queue button (D8), so Space opens the preview there and
  does not advance.

### Evidence (Runde 1)

Update the Bericht: a "Befund → Erledigung" table, the new red/green runs, the Playwright summary
with all names, the axe table with `color-contrast` on and the exception scoped, and the
`pnpm gates` tail. Re-take the screenshots whose view changed. Status → "review (Nacharbeitsrunde
1)".

## Nachschärfung nach Review (Runde 2)

Verbindlich (Plan 6.3: sharpen, do not retry). The re-review accepts B1, M1–M3, M5, M6 and all
minors from Runde 1. Exactly one major is left open: M4's axe exclusion was too wide.

1. `e2e/020-rueckbau-passung.spec.ts:82-86`: `.exclude('.text-ink-500')` and
   `.exclude('.text-ink-400')` remove new 020 elements from all axe rules. Replace with two passes
   per view: (a) all rules except `color-contrast`, with no exclusions; (b) only `color-contrast`,
   excluding only `.hv-label` and the specifically named pre-existing selectors. List those
   selectors under AX-020-01 with file:line of the pre-existing components; no class-wide
   exclusions of `text-ink-*`. Both passes: 0 serious/critical.
2. Change these new 020 texts to `text-ink-600` or darker: `Podium.tsx:297` (preview number),
   `Podium.tsx:316` (the "no answer" line), `ClassifyDialog.tsx:105` (question number). Check
   `SpeakerRow.tsx:105` (the drag handle button) under pass (a) and fix anything it reports.
3. Minor: `e2e/020-rueckbau-passung.spec.ts:162,175` reads the event count right away, but the log
   is saved 150 ms later (`src/api/index.ts:32`). Poll or wait until the count is stable (at least
   200 ms) before comparing, and assert the previewed question's status directly.

### Evidence (Runde 2)

Bericht: axe table of both passes, Playwright summary, `pnpm gates` tail. Re-take only the
screenshots whose pixels change. Status → "review (Nachschärfung Runde 2)".
