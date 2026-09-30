# takt-037 — Vorschlagsdialog: Die Auswahl der Person geht nicht mehr verloren

**Status:** spec · **Risikoklasse:** mittel (Datenkorrektheit im Web, kein Hoch-Auslöser; Leitplanken §4) · **Lanes:** web, e2e · **Perspektive:** Qualität, Korrektheit
**Rolle:** web-implementer; Review in frischem Kontext, Modell nur in `.claude/agents/`
**Regeln:** AGENTS.md R2, R4, R10 (keine neuen Texte), R12
**Quellen-IDs:** PR #83, CI-Lauf 36687578361, Test `abnahme` im Projekt `http`

## Befund (Ist-Stand, gelesen auf dem Integrationszweig, `apps/web/src/features/capture/SuggestDialog.tsx`)

1. `const [checked, setChecked] = useState([])` wird erst in einem `useEffect` nach dem ersten Render gefüllt. Ein Klick
   in diesem Fenster läuft mit `state.map(...)` über ein leeres Array und bewirkt nichts (Fehler „Clicking the checkbox
   did not change its state“).
2. Derselbe Effekt setzt die Auswahl auf „alle angehakt“ zurück, sobald sich `candidates` ändert. `candidates` ist ein
   `useMemo` über `contribution.text` und `contribution.coverage.uncovered`; `uncovered` ist nach jedem Auffrischen ein
   Array mit neuer Identität (HTTP-Takt, eigener Schreibvorgang über die Hörer aus takt-030, jedes Ereignis im
   Demo-Modus). Ein abgewählter Vorschlag wird dadurch stillschweigend wieder angehakt, und „Übernehmen“ legt Fragen an,
   die die Person nicht gewählt hat. Das ist ein Datenkorrektheitsfehler.

## Ziel

- Die Auswahl stimmt ab dem ersten Render.
- Sie bleibt über Auffrischungen erhalten, solange die Texte der Kandidaten unverändert sind.
- Ändern sich die Kandidaten inhaltlich, behalten unveränderte Kandidaten ihren Zustand, neue starten angehakt
  (bisheriger Standard).
- Öffnet man den Dialog erneut, beginnt er frisch (alle angehakt).

## Nicht-Ziele

Keine Änderung an `suggestQuestions`, am Vertrag oder an der Domäne, keine neuen oder geänderten Texte. `busy` und
`locked` verhalten sich unverändert.

## Files allowed

- `apps/web/src/features/capture/SuggestDialog.tsx`
- `apps/web/src/features/capture/SuggestDialog.test.tsx` (neu)
- `docs/slices/takt-037-vorschlagsauswahl.md`
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde)
- `apps/web/e2e/takt-037-vorschlagsauswahl.spec.ts` (neu)
- `docs/evidence/takt-037-vorschlagsauswahl.png` (neu)

Die beiden letzten Pfade sind nachträglich ergänzt: Das Codex-P1 auf #95 verlangte Screenshot-Nachweis.

## Akzeptanzkriterium

1. Unit-Tests zuerst geschrieben und auf dem alten Code rot: (a) der erste Klick unmittelbar nach dem Öffnen schaltet um
   (erster Render zeigt alle angehakt, Umschalten wirkt ohne vorherigen Effekt); (b) ein erneutes Rendern mit gleichen
   Kandidatentexten, aber neuen Array-Identitäten, lässt einen abgewählten Eintrag abgewählt; (c) eine inhaltliche
   Änderung behält den Zustand unveränderter Kandidaten, neue Kandidaten sind angehakt; (d) erneutes Öffnen setzt auf
   „alle angehakt“ zurück.
2. `pnpm gates` grün.
3. e2e im Prozess `002-speakers-capture.spec.ts` und `abnahme.spec.ts` grün.
4. Der HTTP-Nachweis ist die PR-CI von #83 nach diesem Merge.

## Wirkung und Risiko (Leitplanken §4, mittel)

Die Person bekommt nur noch die Fragen angelegt, die sie angehakt hat; das Risiko liegt in einer falsch gebildeten
Schlüsselung der Kandidaten, die die Tests (b) und (c) abdecken.

## Nachweis

Gates-Commit `faca4ff`, sauberer Baum, `pnpm gates` Exit 0 (mit Postgres, Datenbank `hv_t030`). Wörtlicher Schluss:

```
✓ built in 1.92s
mark-test-run: wrote /home/user/wt/t037/.claude/state/last-test-run (clean tree) at commit faca4ff, tree 8c64ca66ba39…
```

Unit-Tests `SuggestDialog.test.tsx` zuerst rot (5 von 5, die Modellfunktionen fehlten im alten Code), dann grün (5 von 5).
e2e Projekt `in-process`: `002-speakers-capture.spec.ts` und `abnahme.spec.ts`, 2 passed. Nachtrag (Codex P1 auf #95): Das Verhalten ist sichtbar, der Screenshot
folgt im Abschnitt „Nachweis Screenshot“.
