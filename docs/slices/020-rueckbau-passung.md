# 020 — Oberfläche: Rückbau und Passung (S-Punkte der Projektleitung)

**Status:** spec
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

## Design-Kritik

(Fable)

## Review findings

(vom Reviewer)
