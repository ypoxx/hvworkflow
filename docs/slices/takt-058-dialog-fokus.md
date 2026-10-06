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

## Bericht

```
Slice: takt-058-dialog-fokus
Done: Dialog.tsx hält onClose in einer Referenz (useLayoutEffect bei jedem Rendern); Escape ruft onCloseRef.current(),
      der Fokus-Effekt hängt nur noch an [open]. Fokusfalle, Fokus-Rückgabe und Scroll-Sperre unverändert.
      Neuer in-process-Fall e2e/058-dialog-fokus.spec.ts (F1 Sprachwechsel über den Store, F2 Wortmeldung einer
      anderen Person) zuerst rot, dann grün.
Evidence: pnpm gates auf e1d26ec (Code und Spec; dieser Bericht kam danach als reine Doku-Änderung hinzu):
      packages/domain test:       Tests  562 passed (562)
      apps/web test:       Tests  1134 passed (1134)
      apps/api test:       Tests  710 passed (710)
      slice-scope: 3 changed file(s), all within "docs/slices/takt-058-dialog-fokus.md"'s "Files allowed" list (3 pattern(s)).
      ✓ built in 2.20s
      mark-test-run: wrote /home/user/wt/takt058/.claude/state/last-test-run (clean tree) at commit e1d26ec, tree 2dd0593420e6…
      e2e rot vor dem Fix (Basis c63d981 + neuer Spec), beide Fälle an expectFocusKept, 058-dialog-fokus.spec.ts:132:
        Error: expect(locator).toBeFocused() failed
        Locator:  getByTestId('answer-refuse-kind-refusal_no_claim')
        Expected: focused
        Received: inactive
        2 failed
      e2e grün nach dem Fix (playwright test e2e/058-dialog-fokus.spec.ts e2e/045-verweigerung.spec.ts --project=in-process):
        ✓  1 … 058 Dialog behält den Fokus › F1 Sprachwechsel über den Store bei offenem Dialog (4.1s)
        ✓  3 … 058 Dialog behält den Fokus › F2 Schreibung anderswo (Wortmeldung einer anderen Person) bei offenem Dialog (3.3s)
        ✓  7 … 045 … › E7 Tastatur (D8): der Dialog ganz mit der Tastatur, Absenden fokussiert und aktiv, nicht ausgelöst (3.4s)
        8 passed (1.2m)
      Kein Screenshot: die Abnahme verlangt keinen; neu erzeugte docs/evidence/*.png wurden verworfen.
Open: Review in frischem Kontext steht aus. Escape mit aktuellem onClose decken 045 E6/E7 und F1/F2 (Escape schließt).
Touched: apps/web/src/components/Dialog.tsx, apps/web/e2e/058-dialog-fokus.spec.ts, docs/slices/takt-058-dialog-fokus.md
```
