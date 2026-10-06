# takt-054 — Erfassung: kein leeres Eingabeformular, solange der Redebeitrag noch lädt

**Status:** gebaut (Review offen) · **Risikoklasse:** niedrig bis mittel (Oberfläche der Erfassung; kein Vertrag, kein Dienst, keine Rechte, kein Personenbezug. Leitplanken §4) · ca. 1 AStd · **Lanes:** web
**Rolle:** implementierer-oberflaeche; Review in frischem Kontext
**Regeln:** AGENTS.md R1, R2, R3, R10, R12. Keine Rule ids aus `transitions.ts`.
**Depends on:** 046 (gemergt) · **Glossar: neue Begriffe:** nein

## Anlass

CI `e2e-http`, Lauf 37471605355 (PR #171): `046-nachfragen.spec.ts:148` E1 scheiterte. Ein Fehler der Oberfläche, kein
Testproblem (Befund der Ursachenanalyse vom 06.10.2026):

1. `apps/web/src/features/capture/Page.tsx` speichert beim ersten Render, solange `speakerId` noch `null` ist, über
   `landPair` ein leeres Paar `{ questions: [], contributions: [] }`, so dass `landed` nicht mehr `null` ist.
2. Antwortet danach `listContributions({ speakerId })` mit einem Redebeitrag `c1`, ändert sich der Schlüssel der Fragen,
   `landPair` hält bis zur Antwort von `listQuestions({ contributionId: c1 })` das alte leere Paar.
3. In diesem Fenster ist `contribution` `undefined` und `loading` (`contributions.status === 'loading' || landed === null`)
   `false`; `ContributionPane` zeigt deshalb das leere Eingabeformular (`capture-text`, `capture-submit`) statt des
   vorhandenen Redebeitrags, eine HTTP-Runde lang (in der Demo nur Mikrotasks).
4. Wer in diesem Fenster tippt (der Test tat es), schreibt in den falschen Zustand; sobald die Fragen landen, verschwindet
   das Formular samt Eingabe. Der Kommentar an `loading` will genau das verhindern.

## Ziel

1. Solange der frischeste gelesene Redebeitrag (`latestContribution`) bekannt ist, das gezeigte Paar ihn aber noch nicht
   enthält (`contribution === undefined`), gilt die Erfassung als ladend (Gerüst statt Formular).
2. Die Entscheidung steckt in einer reinen Funktion (z. B. `deskLoading` in `useCapture.ts`) mit Tabellentest.
3. Ein deterministischer e2e-Fall im Projekt `http` (und, soweit möglich, `in-process`) verzögert die Fragen eines
   Redebeitrags (`page.route` auf `**/v1/questions?*contributionId=*`, z. B. 1,5 s) und prüft: `capture-text` erscheint in
   diesem Fenster nicht, `capture-contribution-new` wird sichtbar.

## Nicht-Ziele

- Keine Änderung an `landPair`, `useAsync`, Live-Store oder Dienst. Kein neuer Text (das Gerüst gibt es schon).
- Ein Sprecher ohne Redebeitrag sieht weiter sofort das Formular.

## Abnahme

- Tabellentest zuerst rot (Zeile „landed = leeres Paar, freshest = c1, shown = undefined“ → ladend), dann grün.
- e2e-Fall wie in Ziel 3, im Projekt `http` grün im CI-Lauf `e2e-http` des PR (Lauf-ID im Bericht).
- `pnpm gates` grün; 046 und 002 in-process mit `--repeat-each=3` grün.

## Files allowed

- `apps/web/src/features/capture/Page.tsx` (nur die `loading`-Eigenschaft und der Aufruf der Hilfsfunktion)
- `apps/web/src/features/capture/useCapture.ts` (nur die neue reine Funktion)
- `apps/web/src/features/capture/useCapture.test.ts` oder eine neue Testdatei `apps/web/src/features/capture/deskLoading.test.ts`
- `apps/web/e2e/046-nachfragen.spec.ts` (nur ein zusätzlicher Fall bzw. ein robuster Wartepunkt an den Verzweigungen
  `fresh`/`another`)
- `docs/slices/takt-054-erfassung-ladezustand.md`
- `docs/folgeliste.md`
- `docs/evidence/takt-054-*.png` (Nachtrag, Codex P1 auf #174: AGENTS.md R2 verlangt für Oberflächenarbeit ein
  Bildschirmfoto; der e2e-Fall legt es in-process in DE und EN ab)

## Bericht

```
Slice: takt-054-erfassung-ladezustand
Done: Reine Funktion deskLoading (useCapture.ts) mit Tabellentest deskLoading.test.ts; Page.tsx setzt loading nur noch
      über sie. Ladend, solange latestContribution bekannt, das gezeigte Paar ihn aber nicht enthält (Ziel 1), und
      zusätzlich solange contributions.settled falsch ist (statt status === 'loading', siehe Abweichung). Neuer e2e-Fall
      „takt-054 …“ in 046 (http: page.route verzögert GET /v1/questions mit contributionId um 1,5 s; beide Projekte:
      MutationObserver ab Seitenstart meldet jedes noch so kurze Auftauchen von capture-text).
Evidence: Ursachenanalyse am Code bestätigt (landPair hält das leere Paar, contribution undefined, loading false).
      Tabellentest zuerst rot, mit der alten Logik in deskLoading (nicht nur „Funktion fehlt“):
        × landed = empty pair, freshest = c1, shown = undefined
        AssertionError: expected false to be true // Object.is equality
        Tests  1 failed | 5 passed (6)
      danach grün (capture: Tests 106 passed (106)).
      e2e-Fall in-process ohne Fix rot (Page.tsx aus HEAD~1, --repeat-each=3): 3 failed, "Received: true" an der
        Observer-Prüfung; nur mit der latestContribution-Klausel, aber status === 'loading': ebenfalls 3 failed; nur mit
        settled, ohne latestContribution-Klausel: 3 failed. Mit beiden: 3 passed.
      pnpm gates grün auf Commit efb2643 (sauberer Baum, DB hv_test_t054). Ende:
        dist/assets/index-mASKBvQC.js                        839.73 kB │ gzip: 243.90 kB │ map: 3,422.03 kB
        ✓ built in 3.09s
        mark-test-run: wrote /home/user/wt/takt054/.claude/state/last-test-run (clean tree) at commit efb2643, tree 63d33b8c0aa2…
      Darin: domain 555, web 990, api 710 Tests grün; slice-scope: 5 changed file(s), all within … "Files allowed";
        Skripttests # pass 358, # fail 0.
      046 und 002 in-process --repeat-each=3 auf efb2643: 12 passed (1.4m); docs/evidence danach per git checkout
        zurückgesetzt (die Scheibe verlangt keine Bildschirmfotos, kein neuer Text, das Gerüst gibt es schon).
      http: lokal nicht lauffähig (kein Docker-Daemon, also kein Keycloak; 046 läuft in http nur mit IdP). Lauf-ID des
        CI-Jobs e2e-http folgt mit dem PR.
Abweichung: Die Analyse nannte nur die latestContribution-Klausel. Der neue Observer zeigte in-process einen zweiten,
      kürzeren Blitz: im Render, in dem die Wortmeldung aufgelöst wird, hat sich der Schlüssel von listContributions eben
      geändert, status meldet aber bis zum Effekt noch das „ready“ des leeren Vorschlüssels, und das bereits gelandete
      leere Paar macht loading falsch – das Formular steht einen Commit lang da. deskLoading nimmt deshalb
      contributionsSettled (AsyncState.settled, vorhanden; useAsync unverändert). Beides liegt in der loading-Eigenschaft.
      In-process: Fall läuft mit (kein Netz zum Verzögern, das Fenster sind Mikrotasks; der Observer fängt es trotzdem,
      siehe Rot-Lauf). Die Wartepunkte fresh.or(another) in E1/E3 blieben unverändert: mit dem Fix erscheint bei einer
      Wortmeldung mit Redebeitrag das Formular gar nicht mehr, die erste Sichtbarkeit ist also schon die stabile.
Review (frischer Kontext): kein Blocker, kein Major. Nachgearbeitet auf 4be6dfc (nach Einmischen der Basis f686390):
      minor 3 begrenztes Warten (expect.poll auf die verzögerte Anfrage, 15 s, Meldung nennt die fehlende Vorbedingung
      Redebeitrag), nit 4 page.unrouteAll am Ende, minor 2 Observer prüft zusätzlich records[].addedNodes (Knoten selbst
      oder Nachfahre). Erneut geprüft: in-process ohne Fix (Page.tsx aus aff43d2) weiterhin rot, 3 failed,
      "Received: true" an der Observer-Prüfung; der Fall ist dort also mehr als eine Rauchprobe. minor 1 und nit 5 in
      docs/folgeliste.md.
      pnpm gates grün auf Commit 4be6dfc (sauberer Baum, DB hv_test_t054). Ende:
        dist/assets/index-hX7BzNq-.js                        887.37 kB │ gzip: 256.15 kB │ map: 3,518.93 kB
        ✓ built in 2.04s
        mark-test-run: wrote /home/user/wt/takt054/.claude/state/last-test-run (clean tree) at commit 4be6dfc, tree 7843d824b09c…
      Darin: domain 555, web 1052, api 710 Tests grün; slice-scope: 6 changed file(s) innerhalb "Files allowed";
        Skripttests # pass 358, # fail 0.
      046 in-process --repeat-each=3 auf 4be6dfc: 9 passed (34.2s); docs/evidence danach zurückgesetzt.
Nachweisbild (Codex P1 auf #174; Files allowed per Nachtrag b0d7a6c um docs/evidence/takt-054-*.png ergänzt):
      docs/evidence/takt-054-erfassung-geruest-de.png, docs/evidence/takt-054-erfassung-stabil-de.png,
      docs/evidence/takt-054-erfassung-stabil-en.png (Commit 43837cc). In-process dauert das Gerüst von sich aus nur
      Mikrotasks; für das Gerüstbild hält der Fall deshalb die Fragen eines Redebeitrags über das vom Test gepatchte
      api.listQuestions (Muster 010b/028 mit loadAppModules, kein Produkt-Hook) und gibt sie danach frei; die Bilder
      „stabil“ zeigen den korrigierten Endzustand (Redebeitrag, „Weiterer Redebeitrag“, kein leeres Formular). Das
      Fenster mit echter Netzlatenz belegt der http-Fall. Mit dem Halten ist der Fall in-process ohne Fix (Page.tsx aus
      aff43d2) rot schon an der Gerüstprüfung: "expect(locator).toHaveCount(expected) failed" (Zeile 326).
      pnpm gates grün auf Commit 43837cc (sauberer Baum, DB hv_test_t054). Ende:
        dist/assets/index-hX7BzNq-.js                        887.37 kB │ gzip: 256.15 kB │ map: 3,518.93 kB
        ✓ built in 1.86s
        mark-test-run: wrote /home/user/wt/takt054/.claude/state/last-test-run (clean tree) at commit 43837cc, tree f0ea039bfa8a…
      Darin: domain 555, web 1052, api 710 Tests grün; slice-scope: 9 changed file(s) innerhalb "Files allowed"
        (11 Muster; Warnung, dass Files allowed vom Stand aff43d2 abweicht, wegen des Nachtrags erwartet);
        Skripttests # pass 358, # fail 0.
      046 in-process --repeat-each=3 auf 43837cc: 9 passed (40.2s); überschriebene Bilder per git checkout zurückgesetzt.
Open: CI-Lauf e2e-http des PR (Lauf-ID) steht aus; Folgelistenpunkte (Gerüst bei Versionssprung ohne Redebeitrag;
      Review minor 1 und nit 5).
Touched: apps/web/src/features/capture/Page.tsx, apps/web/src/features/capture/useCapture.ts,
      apps/web/src/features/capture/deskLoading.test.ts, apps/web/e2e/046-nachfragen.spec.ts,
      docs/slices/takt-054-erfassung-ladezustand.md, docs/folgeliste.md, docs/evidence/takt-054-erfassung-*.png (3)
```
