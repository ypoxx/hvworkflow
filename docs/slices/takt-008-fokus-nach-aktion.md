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
`apps/web/src/i18n/{answers,stage}.{de,en}.ts` (Nachtrag des Architekten 24.09., nur für Review-Befund 6: Namen der Fokusziele), dazu
`apps/web/src/i18n/parity.test.ts` (nur die Schlüsselzahl).

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

**Status:** Runde 1 nachgearbeitet (Befunde 1–6); bereit für Review Runde 2. Code-Stand `864024c`
(`33c3fa3` Scheibe, `fbdd56e` Befunde 1–4 und 6, `864024c` Schlüsselzahl im Paritätstest).

```
Slice: takt-008-fokus-nach-aktion
Done: Nach Enter/Leertaste auf capture-submit, capture-free-add, answer-submit-draft, answer-submit-review,
      answer-approve und stage-next steht der Fokus sichtbar auf einem sinnvollen Element, nie auf BODY
      (013h, umgedrehtes 013-bekannt; 013b–013e nach echtem Tab-Weg); Schreibsperren halten bis der neue
      Stand sichtbar ist, R wirkt auf den Bühnenknöpfen; 013i beweist die Sperren am Ereignislog.
Evidence: pnpm gates auf Commit 864024c, Exit 0 — slice-scope: "18 changed file(s), all within
          "docs/slices/takt-008-fokus-nach-aktion.md"'s "Files allowed" list (10 pattern(s))." (plus der
          erwartete Hinweis, dass Files allowed seit 2fad2f3 ergänzt wurde); Vitest domain 86/86,
          web 87/87, api 57/57. Tail siehe unten.
          Playwright (Port 4687, Chromium /opt/pw-browsers) auf dem Code-Stand von fbdd56e (864024c ändert nur
          den Unit-Test): ganze Suite "43 passed (4.7m)", 013-tastaturpfad.spec.ts "9 passed (2.9m)";
          axe ohne serious/critical in 013h (Beantwortung mit aria-disabled-Knopf, Bühne nach "Vorgelesen,
          weiter", Bühne leer).
          Screenshots, eingecheckt: docs/evidence/takt-008-fokus-entwurf-aria-disabled.png,
          docs/evidence/takt-008-fokus-nach-freigabe.png, docs/evidence/takt-008-fokus-nach-buehne.png
          (ef97c5e, Architekt), docs/evidence/takt-008-fokus-buehne-leer.png (fbdd56e).
Open: 1. stage-next: ein zweiter Druck NACH dem Wechsel zur nächsten Frage liest diese vor — gewollt, ein
         neues "Vorgelesen, weiter", keine Doppelauslösung. Entprellung wäre eine Produktentscheidung.
      2. Gleiche Form, nicht Teil der sechs Aktionen, unverändert: answer-stage, answer-assign/return/merge/
         withdraw und stage-return-submit (`disabled={busy}`), Dialog-Submit-Knöpfe; stage-return
         (returnAnswer) nutzt weiter das alte `busy` ohne Sperre bis zum neuen Stand.
      3. capture-submit: bei leerem Entwurf nativ disabled (Opacity), beim Schreiben aria-disabled (Farben).
      4. Befunde 7 und 8 bleiben laut Architekt wie sie sind.
Touched: apps/web/src/components/Button.tsx, apps/web/src/features/capture/ContributionPane.tsx,
         apps/web/src/features/answers/AnswerEditor.tsx, apps/web/src/features/answers/QuestionDetail.tsx,
         apps/web/src/features/answers/Page.tsx, apps/web/src/features/stage/Podium.tsx,
         apps/web/src/features/stage/Page.tsx, apps/web/src/i18n/answers.de.ts, apps/web/src/i18n/answers.en.ts,
         apps/web/src/i18n/stage.de.ts, apps/web/src/i18n/stage.en.ts, apps/web/src/i18n/parity.test.ts,
         apps/web/e2e/013-tastaturpfad.spec.ts, docs/evidence/takt-008-fokus-buehne-leer.png,
         docs/slices/takt-008-fokus-nach-aktion.md
```

`pnpm gates`, Commit `864024c`, Tail:

```
# tests 206
# suites 0
# pass 206
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9170.586939

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
dist/assets/index-tbYHRrES.js                        563.84 kB │ gzip: 165.08 kB │ map: 2,299.84 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.42s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit 864024c, tree ff508b140884…
```

**Fokus je Stelle** (Ziel 1: aria-disabled oder gezielter Fokus)

| Aktion | Lösung | Fokus danach | Warum |
|---|---|---|---|
| `capture-submit` | `aria-disabled` beim Schreiben + Ref-Sperre im Handler; gezielter Fokus | `capture-free-input` | Das Formular verschwindet; nächster Schritt ist die erste Einzelfrage, ein zweites Enter im leeren Feld schreibt nichts. Callback-Ref beim Einhängen des Feldes, nur wenn der Fokus auf BODY liegt; die Marke wird *vor* dem Schreiben gesetzt (die In-Process-API liest den Redebeitrag in derselben Promise-Kette zurück), bei Fehlschlag gelöscht. |
| `capture-free-add` | gezielter Fokus; `disabled` bei leerem Feld bleibt | `capture-free-input` | Der Fokus geht im Handler ins Feld, bevor das Leeren den Knopf sperrt; dort wird die nächste Einzelfrage getippt. |
| `answer-submit-draft` | `aria-disabled={busy \|\| empty}` | der Knopf selbst | Position bleibt, zweites Enter wirkungslos. Entwurf wird beim Rendern geleert, damit der entsperrende Render schon leer ist. Kein Fokus auf „Zur Prüfung": ein schnelles zweites Enter löste dort einen Statusschritt aus. |
| `answer-submit-review` | `aria-disabled={busy}` + gezielter Fokus | `approval-block` | Der Knopf geht mit dem Schritt; der Block zeigt das Ergebnis. |
| `answer-approve` | wie oben | `approval-block` | Zeigt die Freigabe. |
| `stage-next` | `aria-disabled` am PodiumButton + Sperre in `deliver` | der Knopf selbst; nach der letzten Frage `stage-current` | Der Knopf steht danach für die nächste Frage. |

**Gesperrter Zustand (Ziel 3):** `Button.tsx` behandelt `aria-disabled` zentral (Klick geschluckt, `preventDefault`
auch für Submit) und zeigt ihn mit `border-line`, `bg-ink-50`, `text-ink-400`, nicht mit `opacity-45`: Opacity
blendet den Fokusring mit aus (gemessen ~1,9:1 statt ~4,9:1, unter 3:1). PodiumButton gleich.

**Entscheidungen Runde 1**

1. *major, R nach „Vorgelesen, weiter":* Die Bühnenknöpfe tragen `data-podium-key`; der Tastenhandler lässt nur
   `r`/`R` aus ihnen durch (vor `isInteractiveTarget`). Leertaste nicht: der fokussierte Knopf löst beim Loslassen
   selbst aus, der Handler würde doppelt vorlesen. Tests: 013e (Leertaste, dann `r` → `stage-return-reason`
   sichtbar, Escape → Fokus zurück auf `stage-next`), 013h (dasselbe nach Mausklick).
2. *013i beweist die Sperren:* Zwei Aktivierungen im selben Durchlauf der Ereignisschleife (vor jedem Re-Render)
   für `answer-submit-draft` (mit Text im Editor), `answer-submit-review` und `answer-approve` (je auf einer weiteren
   Einzelfrage), dazu ein gesperrter Button (geleerter Editor) per Enter und per Klick: kein Ereignis. Jede Stelle
   prüft zusätzlich, dass weder Banner „Stand veraltet" noch Problem-Toast erscheint — denn ein zweiter Schreibversuch
   mit alter Version erzeugt dank ifMatch ohnehin kein zweites Ereignis, nur eine 412; erst der Hinweis macht die
   Sperre sichtbar. Der eigene Guard in `QuestionDetail`s `onSave` entfällt, Button.tsx ist die eine Stelle.
   **Gegenprobe (vorübergehend entfernt, danach wiederhergestellt, Prüfungen dafür auf `expect.soft`):**
   - ohne `writing`-Ref in `answers/Page.tsx`: Entwurfspaar → Banner „Stand veraltet" (412); Prüfungs- und
     Freigabepaar → je Problem-Toast; alle drei rot.
   - ohne Klick-Schlucken in `Button.tsx`: Enter-Enter auf dem Entwurfsknopf und der Test „gesperrter Button"
     → Problem-Toasts (422, leerer Entwurf); rot.
   - ohne Sperre in `stage/Page.tsx` `deliver`: Bühnenpaar → Problem-Toast (412); rot.
3. *Sperre bis zum neuen Stand:* Beantwortung sperrt mit `{id, version}` der Einzelfrage, gegen die geschrieben
   wurde, frei erst im Render, der eine andere Version, eine andere oder keine Einzelfrage zeigt (beim Rendern
   angepasst), sofort bei Ablehnung. `busy` ist daraus abgeleitet. Bühne ebenso mit `{id, version}` der aktuellen
   Frage; zusätzlich frei, wenn das Nachladen der Bühne fehlschlägt (sonst hinge sie). Ein Ref hält dieselbe Sperre
   für zwei Aktivierungen im selben Durchlauf.
4. *Merker:* `stepTaken` und `nextPressed` werden ausgewertet und gelöscht, wenn `busy` fällt — das ist der Render
   mit dem neuen Stand (Erfolg: Knopf weg → Fokus auf den Block; Ablehnung: Knopf da → nur löschen). `nextPressed`
   zusätzlich bei jedem Wechsel von `current?.id`; `QuestionDetail` wird je `question.id` neu eingehängt. Test in
   013h: Bühne leer vorlesen → `stage-next` weg, Fokus sichtbar auf `stage-current`, axe ok, Screenshot
   `takt-008-fokus-buehne-leer.png`.
5. *Bericht:* dieser Abschnitt; Screenshots eingecheckt (siehe Evidence).
6. *Rollen:* `approval-block` und `stage-current` (beide Varianten) haben `role="group"` und `aria-label` aus neuen
   Schlüsseln `answers.approval.group` („Stand und Freigabe" / „Status and approval") und `stage.current.group`
   („Frage auf der Bühne" / „Question on the podium"); Paritätstest 457 → 459. 013h prüft Rolle und Namen.

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
