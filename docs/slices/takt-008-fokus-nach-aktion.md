# takt-008 — Fokus nach einer Aktion bleibt am Bedienelement

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: web-capture, web-answers, web-stage,
e2e (nur `013-tastaturpfad.spec.ts`). 010b ist gemergt (`0a5eae3`).
**Rolle:** Implementierer-Oberfläche; Review in frischem Kontext (Perspektive Barrierefreiheit)
**Rule ids:** AGENTS.md Regeln 1, 2, 10, 12; docs/design-prinzipien.md D6 (Tastatur), D8 (Barrierefreiheit)
**Quellen-IDs:** Scheibe 013, Bericht „Offen" und Test `013-bekannt` (Charakterisierung); Review 013 Runde 1, major 2

## Ziel

1. **Fokus nach Aktion:** Nach Enter oder Leertaste auf `capture-submit`, `capture-free-add`, `answer-submit-draft`,
   `answer-submit-review`, `answer-approve` und `stage-next` steht der Fokus wieder auf einem sichtbaren, sinnvollen
   Element, nie auf `BODY`.
   - Heute nimmt `disabled={busy}` (bzw. `writing`, `free.trim() === ''`) dem ausgelösten Knopf den Fokus, und nichts
     holt ihn zurück.
   - Lösung, je Stelle begründet: den Knopf während des Schreibens mit `aria-disabled` statt `disabled` sperren (er
     bleibt fokussierbar, Doppelklicks werden im Handler abgefangen), oder den Fokus nach dem Schreiben gezielt setzen,
     wenn der Knopf verschwindet (z. B. auf die nächste Frage auf der Bühne).
2. **Test umdrehen:** `013-bekannt` in `apps/web/e2e/013-tastaturpfad.spec.ts` bekommt je Aktion die richtige Erwartung:
   sichtbarer Fokus auf dem genannten Element, geprüft mit `assertFocusVisible`. Der Test heißt danach nicht mehr
   „bekannt", und die Annotation entfällt.
3. **Barrierefreiheit:** Ein `aria-disabled`-Knopf hat einen sichtbaren gesperrten Zustand über die vorhandenen Tokens,
   und axe meldet weder serious noch critical.

## Nicht-Ziele

Kein neues Token, keine Umgestaltung der Ansichten, keine Änderung an Kern, Vertrag oder Dienst.

## Files allowed

`apps/web/src/features/capture/**`, `apps/web/src/features/answers/**`, `apps/web/src/features/stage/**`,
`apps/web/src/components/Button.tsx` (nur falls `aria-disabled` dort zentral gebraucht wird),
`apps/web/e2e/013-tastaturpfad.spec.ts`, diese Datei (`docs/slices/takt-008-fokus-nach-aktion.md`, Bericht).

## Akzeptanzkriterium

1. Alle Playwright-Szenarien grün, einschließlich der umgedrehten Prüfungen je Aktion.
2. Doppelauslösung ist ausgeschlossen: Ein Test drückt Enter zweimal schnell hintereinander und prüft, dass genau ein
   Ereignis entsteht.
3. `pnpm gates` grün (Tail wörtlich, kopiert).

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-008-fokus-nach-aktion` vom Integrationsbranch. Absolute Pfade.
  Playwright mit eigenem Port, Chromium unter `/opt/pw-browsers`.
- Jeder Commit nennt „takt-008" und endet in der Betreffzeile mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Implementierer)

## Review findings

(vom Reviewer)
