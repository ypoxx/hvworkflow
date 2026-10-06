# takt-058 — Dialog behält den Fokus, wenn die Seite darunter neu rendert

**Status:** gebaut · **Risikoklasse:** niedrig (Bedienbarkeit, Tastatur D8; nur eine Oberflächenkomponente, kein Vertrag, kein
Dienst) · ca. 0,5 AStd · **Lanes:** web
**Rolle:** Implementierer Oberfläche baut; Review in frischem Kontext
**Regeln:** AGENTS.md R1, R2, R3, R12; Gestaltungsprinzip D8 (Tastatur)
**Depends on:** – · **Glossar: neue Begriffe:** nein

## Anlass

CI `e2e-http` auf #179 (takt-057, a4e8c97): `e2e/045-verweigerung.spec.ts:525` „E7 Tastatur (D8)“ scheiterte, weil nach
Leertaste auf „ohne Anspruch“ die Pfeiltaste nicht mehr im Dialog wirkte. Ursache (auf dem Basis-Branch ebenso, deterministisch
nachgestellt): `apps/web/src/components/Dialog.tsx` hängt seinen Fokus-Effekt an `[open, onClose]`; Aufrufer wie
`features/answers/Page.tsx` übergeben `onClose` inline, also bei jedem Rendern neu. Jedes Neurendern der Seite bei offenem
Dialog (z. B. ein Strom-Ereignis im HTTP-Modus, ein Sprachwechsel, eine Schreibung anderswo) lässt den Effekt neu laufen: die
Aufräumfunktion setzt den Fokus auf das Element vor dem Dialog, der neue Lauf auf das erste fokussierbare Element (Schließen).
Die Tastaturbedienung verliert mitten im Dialog ihren Platz.

## Ziel

Der Fokus-Effekt von `Dialog` läuft nur beim Öffnen und Schließen (`open`), nicht bei jedem neuen `onClose`. Escape ruft
weiterhin das jeweils aktuelle `onClose` (über eine Referenz). Fokusfalle, Rückgabe des Fokus beim Schließen und Sperre des
Seitenscrollens bleiben unverändert.

## Nicht-Ziele

- Keine Änderung an Aufrufern, an Texten oder am Aussehen; keine Änderung an e2e-Prüfungen bestehender Specs.

## Abnahme

- Ein neuer e2e-Fall (in-process), zuerst rot, dann grün: Verweigerungsdialog offen, Fokus auf einer Auswahl, die Seite darunter
  rendert neu (z. B. eine Schreibung anderswo wie die Helfer in `e2e/010c-lesezustand.spec.ts`, oder ein Sprachwechsel über den
  Store); danach liegt der Fokus noch auf derselben Auswahl, und die Pfeiltaste wählt die nächste.
- Escape schließt den Dialog weiterhin mit dem aktuellen `onClose` (bestehende e2e decken das; sonst ein Fall dazu).
- `pnpm gates` grün, dazu die in-process-e2e-Specs 045 und der neue Fall.

## Files allowed

- `apps/web/src/components/Dialog.tsx`
- `apps/web/e2e/058-dialog-fokus.spec.ts`
- `docs/slices/takt-058-dialog-fokus.md`
- `docs/evidence/058-dialog-fokus.png`

## Bericht

```
Slice: takt-058-dialog-fokus
Done: Dialog.tsx hält onClose in einer Referenz (useLayoutEffect bei jedem Rendern); Escape ruft onCloseRef.current(),
      der Fokus-Effekt hängt nur noch an [open]. Fokusfalle, Fokus-Rückgabe und Scroll-Sperre unverändert.
      Neuer in-process-Fall e2e/058-dialog-fokus.spec.ts (F1 Sprachwechsel über den Store, F2 Wortmeldung einer
      anderen Person) zuerst rot, dann grün; F1 schreibt den Beleg docs/evidence/058-dialog-fokus.png.
Evidence: pnpm gates auf ad96e88 (Code, Spec, Screenshot; dieser Bericht kam danach als reine Doku-Änderung hinzu):
      packages/domain test:       Tests  562 passed (562)
      apps/web test:       Tests  1134 passed (1134)
      apps/api test:       Tests  710 passed (710)
      slice-scope: warning — "docs/slices/takt-058-dialog-fokus.md"'s "Files allowed" section differs from its version at the commit that introduced it (803b0e3).
      slice-scope: 4 changed file(s), all within "docs/slices/takt-058-dialog-fokus.md"'s "Files allowed" list (4 pattern(s)).
      # pass 359
      # fail 0
      ✓ built in 2.17s
      mark-test-run: wrote /home/user/wt/takt058/.claude/state/last-test-run (clean tree) at commit ad96e88, tree 70a783a6ed24…
      (Die Warnung ist die gewollte Ergänzung des Screenshots in Files allowed nach Codex-P1 auf #180.)
      e2e rot vor dem Fix (Basis c63d981 + neuer Spec), beide Fälle an expectFocusKept (toBeFocused):
        Error: expect(locator).toBeFocused() failed
        Locator:  getByTestId('answer-refuse-kind-refusal_no_claim')
        Expected: focused
        Received: inactive
        2 failed
      e2e grün auf dem Stand von ad96e88 (playwright test e2e/058-dialog-fokus.spec.ts e2e/045-verweigerung.spec.ts
      --project=in-process):
        ✓  1 … 058 Dialog behält den Fokus › F1 Sprachwechsel über den Store bei offenem Dialog @screenshot (5.5s)
        ✓  3 … 058 Dialog behält den Fokus › F2 Schreibung anderswo (Wortmeldung einer anderen Person) bei offenem Dialog (3.2s)
        ✓  7 … 045 … › E7 Tastatur (D8): der Dialog ganz mit der Tastatur, Absenden fokussiert und aktiv, nicht ausgelöst (3.2s)
        8 passed (1.3m)
      docs/evidence/058-dialog-fokus.png: Dialog nach dem Wechsel auf Englisch, Fokusring weiter auf „no right to information“.
Open: Review in frischem Kontext steht aus. Escape mit aktuellem onClose decken 045 E6/E7 und F1/F2 (Escape schließt).
Touched: apps/web/src/components/Dialog.tsx, apps/web/e2e/058-dialog-fokus.spec.ts, docs/evidence/058-dialog-fokus.png,
      docs/slices/takt-058-dialog-fokus.md
```
