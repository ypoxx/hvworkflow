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
`docs/evidence/takt-008-*.png` (Nachtrag des Architekten 24.09.: Beweis-Screenshots nach Regel 2, in der Spec vergessen).
`apps/web/src/i18n/{answers,stage}.{de,en}.ts` (Nachtrag des Architekten 24.09., nur für Review-Befund 6: Namen der Fokusziele).

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

```
Slice: takt-008-fokus-nach-aktion
Done: Nach Enter/Leertaste auf capture-submit, capture-free-add, answer-submit-draft, answer-submit-review,
      answer-approve und stage-next steht der Fokus sichtbar auf einem sinnvollen Element, nie auf BODY;
      013-bekannt ist umgedreht (013h) und 013b–013e prüfen dasselbe nach echtem Tab-Weg; 013i prüft
      Doppelauslösung am Ereignislog (genau ein Ereignis je Aktion).
Evidence: pnpm gates auf Commit 33c3fa3 (Exit 0; slice-scope: "9 changed file(s), all within … Files allowed"):
```

```
# tests 206
# suites 0
# pass 206
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8774.714494

> @hv/web@0.0.0 build /home/user/wt/takt/apps/web
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
dist/assets/index-D-8rkdaW.js                        563.01 kB │ gzip: 164.88 kB │ map: 2,294.73 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.38s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit 33c3fa3, tree ff2cdc5db47c…
```

```
          Playwright (eigener Port 4687, Chromium /opt/pw-browsers): ganze Suite "43 passed (3.7m)",
          013-tastaturpfad.spec.ts "9 passed (2.1m)"; axe in 013h (answers mit aria-disabled-Knopf,
          stage nach "Vorgelesen, weiter") ohne serious/critical.
          Screenshots (von 013h erzeugt, NICHT committet, siehe Open):
          docs/evidence/takt-008-fokus-entwurf-aria-disabled.png, docs/evidence/takt-008-fokus-nach-freigabe.png,
          docs/evidence/takt-008-fokus-nach-buehne.png
Open: 1. Screenshots nicht committet: docs/evidence/** steht nicht in "Files allowed" dieser Spec, und
         slice-scope schlägt mit ihnen fehl (Probelauf: "1 file(s) outside … docs/evidence/takt-008-fokus-nach-buehne.png",
         exit 1). Sie liegen untracked im Worktree; 013h schreibt sie bei jedem Lauf neu. Entscheidung beim
         Orchestrator (Allowlist um docs/evidence/takt-008-*.png erweitern oder die screenshot()-Aufrufe streichen).
      2. stage-next: zweimal Enter/Leertaste NACH Abschluss des ersten Schreibens liest die nächste Frage vor —
         das ist ein zweites "Vorgelesen, weiter", keine Doppelauslösung (vor takt-008 genauso, über die
         Leertaste auf BODY). Gesperrt ist die Überlappung: 013i löst zweimal im selben Durchlauf der Ereignisschleife aus → genau ein
         QuestionDelivered. Eine Entprellung für die Bühne wäre eine Produktentscheidung, nicht Teil dieser Spec.
      3. answer-submit-review/approve: zwischen "busy aus" und dem Nachladen der Frage liegt ein Render-Fenster,
         in dem der Knopf noch steht; eine zweite Auslösung dort trifft ifMatch mit alter Version → 412 und
         Stale-Hinweis, kein zweites Ereignis. Im In-Process-Demo nicht per Tastatur erreichbar; mit HTTP-Dienst
         evtl. sichtbar. Nicht behoben, weil es den Ladepfad von useBacklog berührt.
      4. Gleiche Form, nicht Teil der sechs Aktionen, unverändert: answer-stage, answer-assign/return/merge/
         withdraw (disabled={busy}), stage-return-submit, Dialog-Submit-Knöpfe.
      5. capture-submit bleibt bei leerem Entwurf nativ disabled (Opacity-Look), beim Schreiben aria-disabled
         (Farb-Look) — zwei gesperrte Looks am selben Knopf, nur für die Dauer des Schreibens sichtbar.
Touched: apps/web/src/components/Button.tsx, apps/web/src/features/capture/ContributionPane.tsx,
         apps/web/src/features/answers/AnswerEditor.tsx, apps/web/src/features/answers/QuestionDetail.tsx,
         apps/web/src/features/answers/Page.tsx, apps/web/src/features/stage/Podium.tsx,
         apps/web/src/features/stage/Page.tsx, apps/web/e2e/013-tastaturpfad.spec.ts,
         docs/slices/takt-008-fokus-nach-aktion.md
```

**Begründung je Stelle** (Ziel 1: aria-disabled oder gezielter Fokus)

| Aktion | Lösung | Fokus danach | Warum |
|---|---|---|---|
| `capture-submit` | `aria-disabled` während des Schreibens + Ref-Sperre im Handler; gezielter Fokus | `capture-free-input` | Das Formular verschwindet mit dem Schreiben, der Knopf kann den Fokus nicht behalten. Nächster Schritt am Pult ist die erste Einzelfrage; ein zweites Enter im leeren Feld schreibt nichts. Fokus wird per Callback-Ref beim Einhängen des Feldes gesetzt, nur wenn er auf BODY gefallen ist. Die Marke wird *vor* dem Schreiben gesetzt, weil die In-Process-API den neuen Redebeitrag schon innerhalb derselben Promise-Kette zurückliest und das Feld einhängt (erster Versuch danach: Fokus blieb auf BODY). Bei Fehlschlag bleibt der Knopf (aria-disabled hielt den Fokus). |
| `capture-free-add` | gezielter Fokus, `disabled` bei leerem Feld bleibt | `capture-free-input` | Das Leeren des Feldes sperrt den Knopf; der Fokus wird im selben Handler vorher ins Feld gesetzt, wo die nächste Einzelfrage getippt wird — deckungsgleich mit Enter im Feld. |
| `answer-submit-draft` | `aria-disabled={busy \|\| empty}` statt `disabled` | der Knopf selbst | Der Knopf bleibt stehen; die Position im Formular ändert sich nicht, ein zweites Enter ist wirkungslos. Der Entwurf wird jetzt beim Rendern (nicht im Effekt) geleert, damit der Render, der `busy` aufhebt, schon den leeren Entwurf trägt — sonst gäbe es einen Frame mit altem Text und freiem Knopf. Kein Fokus auf „Zur Prüfung", weil ein schnelles zweites Enter dort einen Statusschritt auslösen würde. |
| `answer-submit-review` | `aria-disabled={busy}` + gezielter Fokus | `approval-block` (`tabIndex=-1`) | Der Knopf verschwindet mit dem Schritt (`_actions`). Der Block zeigt das Ergebnis („Legal Clearing"); Screenreader lesen es beim Fokus, ein zweites Enter ändert nichts. Kein Tab-Stopp eigener Art. |
| `answer-approve` | wie oben | `approval-block` | Zeigt die Freigabe mit Version, Person, Zeit. |
| `stage-next` | `aria-disabled={busy}` am PodiumButton + Handler-Guard + Ref-Sperre in `deliver` | der Knopf selbst | Der Knopf bleibt stehen und steht danach für die nächste Frage. War es die letzte Frage (Knopf verschwindet), geht der Fokus auf `stage-current` (`tabIndex=-1`, zeigt den Leerzustand). |

**Gesperrter Zustand (Ziel 3):** `aria-disabled` wird zentral in `Button.tsx` behandelt (Klick wird geschluckt,
`preventDefault` auch für Submit) und über vorhandene Tokens gezeigt: `border-line`, `bg-ink-50`, `text-ink-400`,
`pointer-events-none`. Nicht über `opacity-45` wie `disabled`: Opacity blendet den Fokusring mit aus — gemessen
~1,9:1 statt 4,9:1 (accent-500 auf sunken), unter den 3:1 eines Fokusindikators. 013h prüft Hintergrund = ink-50 und
Opacity = 1; axe ohne serious/critical. PodiumButton gleich (Kontrastmodus: ink-50/ink-400/line sind dort umdefiniert).

**Doppelauslösung (Akzeptanz 2):** 013i zählt Ereignisse im persistierten Log (`hv-demo-events-v1`, entprellt 150 ms,
daher zwei übereinstimmende Lesungen im Abstand 500 ms): Enter-Enter auf capture-submit, capture-free-add,
answer-submit-draft, answer-submit-review, answer-approve → je genau +1; zwei Auslösungen im selben Durchlauf der Ereignisschleife auf
capture-submit und stage-next (vor jedem Re-Render) → je genau +1. Neu: `data-testid="capture-contribution-new"`
am Knopf „Neuer Redebeitrag" (nur für 013i).

## Review findings

Runde 1 (Opus 5.5, frischer Kontext, Perspektive Barrierefreiheit; Basis `0a5eae3`, HEAD `ef97c5e`). Gates exit 0,
Playwright 43/43, axe ohne serious/critical. Urteil: nicht mergebereit wegen Befund 1.

1. **major** — Taste R (Zurückgeben) wirkt nach „Vorgelesen, weiter“ nicht mehr: `stage-next` behält den Fokus, der
   Tastenhandler der Bühne ignoriert Ziele vom Typ BUTTON (`stage/Page.tsx:388`, `Podium.tsx:59`). Sonde: Enter auf
   `stage-next`, dann `r` → kein Dialog (normal und „Nur Bühne“); auch nach Mausklick. Erwartet: R/r für die eigenen
   Bühnenknöpfe durchlassen (nicht die Leertaste), Testschritt in 013e oder 013h.
2. **minor** — 013i beweist die neuen Sperren nur für `capture-submit`; die anderen Paare wären auch vor der Änderung
   grün. Erwartet: synchrones Doppelpaar für `answer-submit-draft` (mit Text), `answer-submit-review`,
   `answer-approve`, dazu eine Prüfung, dass die Aktivierung eines gesperrten Button nichts schreibt.
3. **minor** — Nach jedem Schreiben ein Fenster, in dem ein zweiter Druck den Hinweis „Stand veraltet“ (Bühne: Fehler-
   Toast) zeigt (`answers/Page.tsx:80-83`, `QuestionDetail.tsx:362/375`, `stage/Page.tsx:349-351`). Heute nicht
   erreichbar (kein HTTP-Adapter). Erwartet: Sperre bis `question.version` bzw. `stage.current.id` gewechselt hat.
4. **minor** — Pfad „letzte Frage auf der Bühne“ (Fokus auf `stage-current`) ohne Test; `nextPressed` und
   `stepTaken` können veralten. Erwartet: Test in 013h, beide Merker beim Abschluss des Schreibens bzw. beim Wechsel
   von `current?.id`/`question.id` zurücksetzen.
5. **minor** — Bericht veraltet (Screenshots sind mit `ef97c5e` eingecheckt; Status; Gates-Ausgabe nicht von HEAD).
   Der Nachtrag in Files allowed ist vom Architekten (`ef97c5e`, Orchestrator-Commit), freigegeben.
6. **nit** — `approval-block` und `stage-current` sind `div` mit `tabIndex=-1` ohne Rolle und Namen; `role="group"`
   mit `aria-label` aus dem Wörterbuch erwägen.
7. **nit** — Gesperrter Bühnenknopf im Kontrastmodus kaum sichtbar (vorhandene Tokens, nur Millisekunden). Bleibt.
8. **nit** — Leerer Entwurfsknopf ist Tab-Halt und wird als nicht verfügbar angesagt; zulässiges Muster. Bleibt.

Entscheidung des Architekten: 1–6 in dieser Scheibe beheben; 7 und 8 bleiben wie sie sind.
