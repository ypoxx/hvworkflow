# takt-043 — Fokus nach „Weiterleiten“ im HTTP-Betrieb (054 F4)

**Status:** spec · **Risikoklasse:** mittel (Interface-Verhalten: Fokus nach einer Übergabe; keine Rechte, kein Status,
kein Vertrag, keine Persistenz, kein Betrieb; Leitplanken §4) · ca. 1 AStd · **Lanes:** web
**Rolle:** builder; ein Review in frischem Kontext (Lean-Modus, AGENTS.md R3; kein Durchlesen nötig), Modell nur in
`.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R10 (keine neuen Interface-Texte), R12; 054 D8 (Fokus nach Aktion, takt-008),
054 Abschnitt 6 „Nächste Einzelfrage und Fokus nach Aktion“; 053 Nacharbeit `af78c0c` (`mayMoveFocus`, Review 053
minor 3a/3b)
**Quellen-IDs:** CI `e2e-http`, 054 F4 rot in den Läufen 37224478746 und 37233755978 (Wiederholung jeweils grün);
Diagnose mit einem Wegwerf-jsdom-Test (nicht festgeschrieben)
**Depends on:** keine
**Perspektive:** Interface-Rennen · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `ea3eb9a`)

Symptom: In 054 F4 (`apps/web/e2e/054-fokusansicht.spec.ts`, Schritt „Weiterleiten: the question leaves the list, the
next one stands there with the focus“) steht der Fokus nach „Weiterleiten“ zeitweise auf `body` statt in
`focus-detail`. Nur im Projekt `http`; in-process grün.

Die Diagnose spielte fünf Reihenfolgen gegen `FocusPage` mit einer gesteuerten Fake-`HvApi` nach: (a) Antwort des
Schreibens, (b) Detail-Lesen der Einzelfrage X in Version v+1, (c) Listen-Lesen ohne X, (d) Detail-Lesen der nächsten
Einzelfrage Y.

| Reihenfolge | Ablauf | heute | mit Korrektur |
|---|---|---|---|
| A | (a), dann (b) vor (c), dann (d) | rot | grün |
| B | (a), (c), (b) verworfen, (d) (Kontrolle) | grün | grün |
| C | Strom vor der Antwort: (b), dann (a), dann (c), (d) | rot | grün |
| D | Strom und ganzes Nachladen (c), (b), (d) vor (a) | rot | grün |
| E | wie A, die Person arbeitet anderswo (Schutz `mayMoveFocus`) | grün | grün |

### U1: `settleFocus` hält „dieselbe Einzelfrage in neuerer Version“ zu früh für fällig (A, C)

`settleFocus` in `apps/web/src/features/focus/Page.tsx` bewegt den Fokus, sobald das Detail die übergebene Einzelfrage
in einer Version über der gemerkten zeigt und die Liste sie noch enthält. Im HTTP-Betrieb liest `useBacklog` Liste und
`getQuestion(selectedId)` getrennt. Gewinnt das Detail-Lesen, steht X kurz als v+1 (`in_review`) da, während die alte
Liste X noch hält: Die Vormerkung wird gelöscht, der Fokus geht auf die Nummer von X. Dann wirft die Liste X hinaus, die
Auswahl springt auf Y, das Detail von X wird abgebaut, der Fokus fällt auf `body`, und wenn Y erscheint, ist nichts mehr
vorgemerkt.

### U2: Die Vormerkung entsteht erst mit der Antwort des Schreibens (D)

`useWriteDoor.run` ruft `onDone` nur, wenn `onScreen()` gilt. Ist das Nachladen über den Strom fertig (Y steht da),
bevor der POST antwortet, läuft `handedOver` nie, und es gibt keine Vormerkung.

### Nebenbefund (nicht ursächlich)

`listSettled` wird in `settleFocus` über die Abhängigkeitsliste eingefangen; `handedOver` und `run` halten aber einen
Rückruf aus dem Rendern des Klicks. Der Wert kann veraltet sein.

053 (Steuerungsansicht) ist nicht betroffen: Dort bleibt die Auswahl auf der geschriebenen Einzelfrage.

## Ziel

Nach „Weiterleiten“ und nach „An anderen Fachbereich weiterleiten“ steht der Fokus in jeder der Reihenfolgen A–E dort,
wo 054 D8 es verlangt, und die Entscheidung darüber ist eine reine Funktion mit Unit-Tests.

1. **Reine Entscheidung in `focus.ts`.** Neu exportiert (Namen verbindlich, Feldtypen als `Pick<Question, 'id' | 'version'>`
   genügen):
   - `PendingFocus` (`{ id, version }`, wandert aus `Page.tsx` hierher);
   - `focusDue(pending: PendingFocus | null, shown: { question, selectedId, mine, listSettled }): 'wait' | 'clear' | 'move'`:
     - `pending === null` → `wait`;
     - `mine` leer und `listSettled` → `clear` (die letzte Einzelfrage ging weg, nichts mehr zu fokussieren);
     - kein Detail, Detail ≠ Auswahl oder Detail nicht in `mine` → `wait`;
     - Detail ist die übergebene Einzelfrage (`id` gleich): `move` nur, wenn ihre Version über der gemerkten liegt,
       `listSettled` gilt **und** die Zeile in `mine` dieselbe Einzelfrage in mindestens dieser Version hält; sonst
       `wait` (die Liste wirft sie vielleicht noch hinaus);
     - jede andere Einzelfrage, die ausgewählt, gezeigt und in `mine` ist → `move`.
   - `disarmFocus(pending: PendingFocus | null, question): PendingFocus | null` → `null`, wenn `pending` genau diese
     Einzelfrage in genau dieser Version ist, sonst `pending` unverändert (eine spätere Vormerkung bleibt stehen).
2. **`Page.tsx` nutzt sie.** `settleFocus` liest alles aus dem Ref `shownNow` (dorthin wandert `listSettled`, die
   Abhängigkeitsliste wird leer), ruft `focusDue` und behandelt nur noch das DOM: bei `clear` die Vormerkung löschen;
   bei `move` wie heute (Detail-Root vorhanden, Vormerkung löschen, `mayMoveFocus`, primäre Aktion oder Nummer).
3. **Vormerken beim Absenden** (U2). Für `question.submit_review` und `question.forward` setzt die Seite
   `pendingFocus` **vor** `run(...)`. Eine Hülle um `onProblem` ruft bei Ablehnung `disarmFocus` und gibt danach das
   Ergebnis des bisherigen Handlers zurück (beim Weiterleiten `forwardProblemHandler(...)`, beim Übergeben ohne Handler
   `false`), damit Hinweise, der Stale-Hinweis und das Schließen des Dialogs unverändert bleiben. `handedOver` beendet
   nur noch den Schreibmodus und ruft `settleFocus`. `useWriteDoor` bleibt unverändert.

Ein Korrekturvorschlag liegt beim Orchestrator (Patch aus der Diagnose); er setzt Punkt 2 und 3 ohne die Auslagerung
aus Punkt 1 um. Der Bau darf sich daran orientieren, die Entscheidung gehört aber in `focusDue`.

## Nicht-Ziele

- **Keine neue Abhängigkeit.** Das Repository hat kein jsdom und keine Testing Library, und diese Scheibe führt sie
  nicht ein. Das Seitenverhalten beweist der e2e-Test F4, die Entscheidung beweisen die Unit-Tests.
- Keine Änderung an `useWriteDoor`, an der Steuerungsansicht (053), an der Beantwortung, am Weiterleiten-Dialog, an
  `useBacklog` oder an e2e-Dateien. F4 bleibt wörtlich, wie er ist.
- Keine Änderung am Fokus nach dem Speichern oder nach dem Verlassen des Schreibmodus.
- Kein Umbau von `steering/Page.tsx` auf `focusDue`. Braucht 053 später dieselbe Regel, ist das ein Eintrag für die
  Folgeliste, kein Teil dieser Scheibe.
- Die Rennen H13 in `031-http-betriebsart.spec.ts` (Folgeliste) sind eine andere Ursache.

## Files allowed

- `apps/web/src/features/focus/Page.tsx`
- `apps/web/src/features/focus/focus.ts`
- `apps/web/src/features/focus/focus.test.ts`
- `docs/folgeliste.md` (nur, wenn etwas zurückgestellt wird)
- `docs/slices/takt-043-fokus-nach-weiterleiten.md`

## Ausdrücklich nicht erlaubt

Alles unter `apps/web/src/features/steering/`, `apps/web/src/features/answers/` (insbesondere `useWriteDoor.ts` und
`forward.ts`), `apps/web/e2e/`, `packages/`, `package.json` und `pnpm-lock.yaml`. Die unversionierte Datei
`apps/web/src/features/focus/Page.race.test.tsx` ist ein Diagnose-Werkzeug mit einem Import aus einem lokalen
Notizverzeichnis: nicht festschreiben, nicht anpassen.

## Tests zuerst

Neuer Block `describe('Test 10: focusDue and disarmFocus (takt-043)', …)` in `focus.test.ts`. Jede Reihenfolge ist eine
Folge gezeigter Zustände (`{ question, selectedId, mine, listSettled }`), die ein kleiner Helfer im Test der Reihe nach
durch `focusDue` schickt; er löscht die Vormerkung bei `clear` und `move` wie die Seite und gibt die Liste der
Entscheidungen zurück. Fixtures: X (`answer_drafted`, v3) und Y in `mine`, Vormerkung `{ X, 3 }`.

| Fall | Folge der gezeigten Zustände | erwartet |
|---|---|---|
| A | X v3 / [X v3, Y] → X v4 / [X v3, Y] (Detail vor Liste) → Y-Auswahl ohne Detail / [Y] → Y / [Y] | `wait`, `wait`, `wait`, `move` |
| B | X v3 / [X v3, Y] → Y-Auswahl ohne Detail / [Y] → Y / [Y] | `wait`, `wait`, `move` |
| C | wie A, die Antwort des Schreibens wiederholt den Zustand X v4 / [X v3, Y] noch einmal (Aufruf aus `handedOver`) | kein `move` vor Y, dann `move` |
| D | ganze Folge B vor der Antwort, danach noch einmal Y / [Y] (Aufruf aus `handedOver`) | genau ein `move`, beim ersten Y; der zweite Aufruf `wait` (nichts mehr vorgemerkt) |
| E | wie A | `move` beim ersten Y; dass der Fokus nicht wandert, wenn die Person anderswo arbeitet, entscheidet danach `mayMoveFocus` (in `steering.test.ts` getestet) |
| leer | X v3 / [X v3] → X v4 / [X v3] → nichts / [] mit `listSettled` | `wait`, `wait`, `clear` |
| leer, nicht fertig | nichts / [] ohne `listSettled` | `wait` |
| bleibt | X v4 / [X v4, Y] mit `listSettled` (X bleibt in „Meine Fragen“) | `move` |
| nicht fertig | X v4 / [X v4, Y] ohne `listSettled` | `wait` |
| Akteurwechsel | Vormerkung `null` (die Seite löscht sie beim Wechsel), dann Y / [Y] | `wait` |
| Ablehnung | `disarmFocus({ X, 3 }, X v3)` → `null`; `disarmFocus({ X, 3 }, X v2)` und `disarmFocus({ Y, 1 }, X v3)` → unverändert | wie angegeben |

**Rot vorher:** Der Bau lagert `focusDue` zuerst verhaltensgleich aus (die heutige Bedingung aus `settleFocus`, inklusive
des Falls „Detail nicht in `mine`“) und lässt die neuen Fälle laufen. Mindestens A und C müssen dann rot sein, ebenso
„nicht fertig“ (die heutige Regel sieht `listSettled` für diesen Zweig nicht). Die Ausgabe gehört in den Bericht. D ist
in dieser Form auch vorher grün: Seine Ursache U2 liegt im Zeitpunkt des Vormerkens in `Page.tsx`, nicht in `focusDue`.
Dafür ist F4 im CI-Job `e2e-http` der Beweis.

## Akzeptanzkriterium

1. Alle Fälle aus „Tests zuerst“ grün; die bisherigen Tests in `focus.test.ts` und die übrigen Tests von `@hv/web`
   unverändert grün.
2. `Page.tsx` enthält keine eigene Fokusbedingung mehr außer dem DOM-Teil (`detailRef`, `mayMoveFocus`, Ziel finden);
   die Entscheidung kommt aus `focusDue`. `settleFocus` hat eine leere Abhängigkeitsliste und liest `listSettled` aus
   `shownNow`.
3. Vormerken vor `run(...)` für beide Übergaben; bei Ablehnung löscht die Hülle die Vormerkung über `disarmFocus` und
   gibt das Ergebnis des bisherigen Handlers zurück. Für das Weiterleiten bleibt das Verhalten von
   `forwardProblemHandler` (Dialog schließen, Hinweis „gone“, Bericht im Dialog) unverändert.
4. `pnpm --filter @hv/web e2e` (in-process) grün, einschließlich 054 F1–F8.
5. CI-Job `e2e-http` auf dem PR grün mit 054 F4. **Dieser Job ist der Beweis für die HTTP-Reihenfolgen**; lokal ist F4
   über `pnpm e2e:http` (`E2E_HTTP_IDP=none`) nur informativ. Wird F4 dort rot, ist die Scheibe nicht fertig.
6. `pnpm gates` grün auf sauberem Commit, einschließlich slice-scope.

## Evidenz

- Ausgabe „rot vorher“ der neuen Unit-Fälle (gegen die verhaltensgleiche Auslagerung).
- Schluss von `pnpm gates` mit Commit-sha.
- CI `e2e-http`: Lauf-ID, in der 054 F4 grün ist (Name des Laufs und Commit). Kein Screenshot: Die Scheibe ändert keine
  Darstellung, der Fokus wird im e2e geprüft.

## Wirkung und Risiko (Leitplanken §4, mittel)

- **Wirkung:** Fokus nach Übergaben in der Fokusansicht. Keine neuen Texte, keine neuen Aktionen, keine Rechte.
- **Risiko:** Vormerken beim Absenden könnte nach einer Ablehnung eine verwaiste Vormerkung zurücklassen, die beim
  nächsten Wechsel der Auswahl den Fokus zieht. **Gegenmittel:** `disarmFocus` in der `onProblem`-Hülle, Testfall
  „Ablehnung“, `mayMoveFocus` als Schutz bleibt.
- **Risiko:** Die strengere Regel für die eigene Einzelfrage wartet ewig, wenn die Liste nie fertig wird. Das ist
  gewollt: Ohne fertige Liste gibt es kein sicheres Ziel, die Vormerkung verfällt beim Akteurwechsel oder bei der
  nächsten Übergabe.

## Aufwand

Etwa 1 AStd: Auslagerung und Tests etwa 0,5 AStd, Seite etwa 0,25 AStd, Gates, e2e und Bericht etwa 0,25 AStd
(CI-Laufzeit nicht eingerechnet).

## Bericht

```
Slice: takt-043-fokus-nach-weiterleiten
Done: focusDue/disarmFocus/PendingFocus in focus.ts; the handed-over question counts only once the settled list keeps
      it (U1). Page.tsx arms the focus before run() for both hand-overs and disarms on a refusal through a wrapper
      around onProblem (U2); settleFocus has empty deps and reads listSettled from shownNow. Test 10 (12 cases).
Evidence: rot vorher (unten), pnpm gates auf ad6c94c (unten), in-process 054 --repeat-each=3: 24 passed (1.4m);
      CI e2e-http: offen (PR noch nicht da)
Open: CI e2e-http-Lauf mit 054 F4 grün (Akzeptanzkriterium 5) steht aus; erst danach fertig.
Touched: apps/web/src/features/focus/Page.tsx, apps/web/src/features/focus/focus.ts,
      apps/web/src/features/focus/focus.test.ts, docs/slices/takt-043-fokus-nach-weiterleiten.md
```

Rot vorher (Test 10 gegen die verhaltensgleiche Auslagerung der alten Bedingung in `focusDue`):

```
     × A: the detail of X v4 before the list: wait until Y stands there 9ms
     × A with a settled but older list: X v4 over the row X v3 still waits 2ms
     × C: the stream ahead; the write answers on X v4 (call from handedOver): no move before Y 1ms
     × E: as A, the move is due at the first Y (whether it happens is mayMoveFocus, steering.test.ts) 2ms
     × empty: the last question left: clear once the list is settled 1ms
     × not settled: X v4 in the list while it still loads: wait 1ms
AssertionError: expected [ 'wait', 'move', 'wait', 'wait' ] to deeply equal [ 'wait', 'wait', 'wait', 'move' ]
      Tests  6 failed | 27 passed (33)
```

Nach der Korrektur: `Tests  33 passed (33)`. D und „Ablehnung“ waren vorher schon grün (wie die Spec erwartet).

`pnpm gates` auf ad6c94c (exit 0), Schluss:

```
apps/web test:  Test Files  40 passed (40)
apps/web test:       Tests  695 passed (695)
slice-scope: 4 changed file(s), all within "docs/slices/takt-043-fokus-nach-weiterleiten.md"'s "Files allowed" list (5 pattern(s)).
✓ built in 1.51s
mark-test-run: wrote /home/user/wt/takt043/.claude/state/last-test-run (clean tree) at commit ad6c94c, tree 5b6466db2186…
```

## Review findings
