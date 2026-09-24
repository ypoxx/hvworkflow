# takt-009 — Kontrast der Regelzeile im Toast

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: components (nur `Toast.tsx`),
e2e (eigene Datei). Läuft parallel zu 010b; berührt keine Datei von 010b.
**Rolle/Modell:** Implementierer-Oberfläche · Sonnet 5; Review Opus 5.5 (Perspektive Barrierefreiheit)
**Rule ids:** AGENTS.md Regeln 1, 2, 10, 12; docs/design-prinzipien.md D8 (Barrierefreiheit)
**Quellen-IDs:** Scheibe 010, Nachprüfung B Punkt 3 (bestätigt: `Toast.tsx:53`); vorbestehend seit Scheibe 001

## Ziel

1. **Kontrast:** Die Zeile „Regel R-…“ im Toast (`apps/web/src/components/Toast.tsx`, heute `text-ink-500` auf
   `bg-surface`, im hellen Thema #83807a auf #ffffff, rund 3,9:1) erreicht mindestens 4,5:1 in jedem Thema, das die
   Oberfläche hat (hell, dunkel, Kontrastmodus, soweit er den Toast betrifft). Vorhandenes Token, z. B. `text-ink-600`;
   kein neues Token.
2. **Nachweis mit axe:** Neue e2e-Datei `apps/web/e2e/takt-009-toast-kontrast.spec.ts`. Sie bringt einen Toast mit
   Regelzeile auf den Bildschirm und prüft ihn mit dem axe-Helfer aus 013 (`checkAxe`), ohne Ausnahme für den Toast.
   - Auslöser: eine echte, von Kern oder Dienst verweigerte Aktion in der Demo, die eine `ruleId` trägt und **nicht**
     von Leserechten abhängt (010b ersetzt den Toast bei verweigertem Lesen durch einen gestalteten Zustand). Der
     Bericht nennt den gewählten Auslöser und warum er stabil ist.
   - Kein Test-Haken im Produktionscode (kein `window.__…`, kein Export nur für Tests). Findet sich kein stabiler
     Auslöser über die Oberfläche, hört der Bauer auf und meldet das mit den geprüften Kandidaten.
3. **Roter Lauf zuerst:** Der Bericht zeigt den axe-Lauf der neuen Datei vor der Änderung an `Toast.tsx` (rot, mit
   `color-contrast` am Regeltext) und danach (grün), beide wörtlich.

## Nicht-Ziele

Keine Umgestaltung des Toasts, kein neues Token, keine Änderung am Toast-Speicher, an Kern, Vertrag oder Dienst,
keine Änderung an anderen e2e-Dateien.

## Files allowed

- `apps/web/src/components/Toast.tsx`
- `apps/web/e2e/takt-009-toast-kontrast.spec.ts`
- `docs/evidence/takt-009-toast.png` (neu)
- `docs/slices/takt-009-toast-kontrast.md`

Nachtrag Orchestrator nach Codex (P1): AGENTS.md Regel 2 verlangt für Oberflächenarbeit einen Screenshot; die erste Fassung
dieser Spec hatte ihn vergessen. Der e2e-Test legt ihn an, committet wird nur diese eine Datei unter docs/evidence.

## Akzeptanzkriterium

1. Roter und grüner axe-Lauf der neuen Datei wörtlich im Bericht; grün ohne serious oder critical.
2. Kontrastverhältnis je Thema aus den Token-Werten in `apps/web/src/styles/index.css` im Bericht, nachgerechnet.
3. Alle Playwright-Szenarien grün; `pnpm gates` grün (Tail wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-009-toast-kontrast` vom Integrationsbranch. Absolute Pfade.
- Commit-Betreff nennt „takt-009“ und endet mit `[skip netlify]`. Nicht pushen.
- Playwright mit eigenem Port (`E2E_PORT=4381`), Chromium unter `/opt/pw-browsers`; danach
  `git checkout -- docs/evidence`, nichts unter `docs/evidence` committen.

## Bericht

**Auslöser:** eine Zusammenführung einer `classified`-Einzelfrage in sich selbst. `question.merge`
(R-TRANS-12, `packages/domain/src/transitions.ts`) trägt den eigenen Wächter R-GUARD-05
(`notMergingIntoSelf`, "A question cannot be merged into itself."); der Wächter wertet allein die
*Nutzlast* aus (`intoQuestionId === q.id`), nie eine Leseberechtigung, und verweigert die Schreibung
für jede Rolle, die überhaupt zusammenführen darf, bei jedem Lauf. Die Oberfläche erreicht ihn ohne
Test-Haken: In der Beantwortung (Rolle `capture`, die zusammen mit `moderation` `question.merge`
trägt, `packages/domain/src/permissions.ts`) eine `classified`-Zeile auswählen (Status ist im
800-Fragen-Korpus immer belegt, `packages/domain/src/seed.ts`), die eigene Nummer von der Zeile
ablesen (`data-number`), den Zusammenführen-Dialog öffnen und exakt diese Nummer als Ziel eintragen.
`MergeDialog.onResolve` (`ActionDialogs.tsx`) löst die Nummer über `HvApi.listQuestions` zur eigenen
ID auf, genau wie bei einem Vertipper; `api.mergeQuestion(question.id, targetId, …)` (`Page.tsx`)
schickt damit `id === intoQuestionId`, R-GUARD-05 verweigert mit 409, und `showProblem`
(`toastStore.ts`) hebt einen Danger-Toast mit der Regelzeile.

Geprüfte und verworfene Kandidaten:
- Eine veraltete `answerVersion` bei `question.approve` (R-GUARD-04): `QuestionDetail.tsx` schickt
  immer `latest` selbst (`onAction({ kind: 'approve', version: latest })`) — die Oberfläche hat
  keinen Pfad, der eine andere Version als die gerade gelesene sendet.
- Ein veraltetes `If-Match` (412, zwei Schreiber): `AnswersPage.run()` (`Page.tsx`) behandelt 412
  eigens (`setStale(true)`) und hebt dafür ausdrücklich *keinen* Toast — "keep the toast for every
  other refusal" — und trägt auch keine `ruleId`. Nicht der Auslöser dieser Scheibe, mit Absicht.
- Ein leerer Grund bei Zurückziehen/Zurückgeben: Der Absenden-Knopf bleibt `disabled`, solange das
  Feld leer ist; die Anfrage erreicht den Dienst von der Oberfläche aus nie.

**Roter Lauf** (`E2E_PORT=4381 pnpm --filter @hv/web e2e -- takt-009`, vor der Änderung an
`Toast.tsx`; der Filter griff nicht, die volle Suite (18 Tests) lief mit — laut Anleitung in
Ordnung; nur der neue Test schlug fehl):

```
[axe] toast (Regelzeile, Selbst-Zusammenführung abgelehnt) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] toast (Regelzeile, Selbst-Zusammenführung abgelehnt) (b, color-contrast only, named exceptions excluded): 1 violation group(s), 1 serious/critical
  - color-contrast [serious] https://dequeuniversity.com/rules/axe/4.13/color-contrast?application=playwright
    targets: .mt-1\.5
  ✘  18 [chromium] › e2e/takt-009-toast-kontrast.spec.ts:55:1 › takt-009: Regelzeile im Toast bei verweigerter Selbst-Zusammenführung — Kontrast und axe (3.9s)
...

  1) [chromium] › e2e/takt-009-toast-kontrast.spec.ts:55:1 › takt-009: Regelzeile im Toast bei verweigerter Selbst-Zusammenführung — Kontrast und axe 

    Error: [
      {
        "id": "color-contrast",
        "impact": "serious",
        "tags": [
          "cat.color",
          "wcag2aa",
          "wcag143",
          "TTv5",
          "TT13.c",
          "EN-301-549",
          "EN-9.1.4.3",
          "ACT",
          "RGAAv4",
          "RGAA-3.2.1"
        ],
        "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
        "help": "Elements must meet minimum color contrast ratio thresholds",
        "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/color-contrast?application=playwright",
        "nodes": [
          {
            "any": [
              {
                "id": "color-contrast",
                "data": {
                  "fgColor": "#83807a",
                  "bgColor": "#ffffff",
                  "contrastRatio": 3.93,
                  "fontSize": "8.3pt (11px)",
                  "fontWeight": "normal",
                  "messageKey": null,
                  "expectedContrastRatio": "4.5:1"
                },
                "relatedNodes": [
                  {
                    "html": "<div role=\"status\" class=\"pointer-events-auto flex w-90 items-start gap-2.5 rounded-md border p-3 bg-surface shadow-[0_8px_24px_-8px_rgba(31,30,28,0.25)] border-tone-danger-bd\">",
                    "target": [
                      ".pointer-events-auto"
                    ]
                  }
                ],
                "impact": "serious",
                "message": "Element has insufficient color contrast of 3.93 (foreground color: #83807a, background color: #ffffff, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
              }
            ],
            "all": [],
            "none": [],
            "impact": "serious",
            "html": "<p class=\"mt-1.5 font-mono text-2xs text-ink-500\">Regel R-GUARD-05</p>",
            "target": [
              ".mt-1\\.5"
            ],
            "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.93 (foreground color: #83807a, background color: #ffffff, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ]
      }
    ]

    expect(received).toEqual(expected) // deep equality

       at support/axe.ts:153

  1 failed
    [chromium] › e2e/takt-009-toast-kontrast.spec.ts:55:1 › takt-009: Regelzeile im Toast bei verweigerter Selbst-Zusammenführung — Kontrast und axe 
  17 passed (2.3m)
```

**Kontrastrechnung** (WCAG 2, `packages/domain` unbeteiligt — reine Token-Arithmetik aus
`apps/web/src/styles/index.css`). Vorab die Themen-Frage: diese Oberfläche kennt nur *ein* Thema
(Zeile 48–53 von `index.css`: "Light theme only, on purpose … a second theme would double the
review surface for no gain"; kein `prefers-color-scheme`/`forced-colors`/`prefers-contrast` irgendwo
im Stylesheet). `.stage-contrast` (Zeile 184ff.) ist kein zweites Thema, sondern eine auf die
Bühnenansicht beschränkte Variablen-Überschreibung, per Klasse auf dem `<div>` von
`features/stage/Page.tsx:442`; der Toast-Stapel selbst hängt als Geschwister von `{children}` direkt
unter `ToastProvider` (`components/Toast.tsx:72–87`, gerendert von `app/App.tsx:67`), also nicht als
Nachfahre dieses `<div>` — die überschriebenen `--color-ink-*`-Variablen erreichen den Toast auch auf
der "Nur Bühne"-Ansicht nie (CSS-Variablen vererben sich nur an Nachfahren im DOM-Baum). Die
Kontrastprüfung betrifft damit nur das eine, helle Thema; ein "Kontrastmodus", der den Toast
beträfe, existiert nicht.

Formel: für jeden sRGB-Kanal `c` (0–255) sei `c' = c/255`; linearisiert
`c_lin = c'/12.92` falls `c' ≤ 0.03928`, sonst `c_lin = ((c'+0.055)/1.055)^2.4`. Relative Leuchtdichte
`L = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin`. Kontrastverhältnis `(L_hell+0.05)/(L_dunkel+0.05)`.

`--color-surface` (Zeile 101) ist `#ffffff` in jedem Fall, in dem der Toast erscheint (die einzige
Überschreibung, Zeile 186, liegt in `.stage-contrast` und erreicht den Toast aus dem oben genannten
Grund nicht): `R'=G'=B'=1.0` → `c_lin=((1.0+0.055)/1.055)^2.4=1.0` → `L=1.000000`.

Bisher, `--color-ink-500` (Zeile 79) `#83807a` → `R=131,G=128,B=122`:
- `R'=131/255=0.513725` → `c_lin=((0.513725+0.055)/1.055)^2.4=(0.539172)^2.4=0.226966`
- `G'=128/255=0.501961` → `c_lin=((0.501961+0.055)/1.055)^2.4=(0.528162)^2.4=0.215861`
- `B'=122/255=0.478431` → `c_lin=((0.478431+0.055)/1.055)^2.4=(0.505622)^2.4=0.194618`
- `L = 0.2126·0.226966 + 0.7152·0.215861 + 0.0722·0.194618 = 0.048253 + 0.154383 + 0.014051 = 0.216688`
- Kontrast `= (1.000000+0.05)/(0.216688+0.05) = 1.05/0.266688 = 3.9372` → **≈ 3,94:1** (axe misst
  3,93 — dieselbe Formel, minimal abweichende interne Rundung; beide liegen unter 4,5:1, das Ziel).

Neu, `--color-ink-600` (Zeile 80) `#63605b` → `R=99,G=96,B=91`:
- `R'=99/255=0.388235` → `c_lin=((0.388235+0.055)/1.055)^2.4=(0.419653)^2.4=0.124772`
- `G'=96/255=0.376471` → `c_lin=((0.376471+0.055)/1.055)^2.4=(0.408978)^2.4=0.116971`
- `B'=91/255=0.356863` → `c_lin=((0.356863+0.055)/1.055)^2.4=(0.390386)^2.4=0.104616`
- `L = 0.2126·0.124772 + 0.7152·0.116971 + 0.0722·0.104616 = 0.026526 + 0.083657 + 0.007553 = 0.117737`
- Kontrast `= (1.000000+0.05)/(0.117737+0.05) = 1.05/0.167737 = 6.2598` → **≈ 6,26:1**, über 4,5:1.

`text-ink-600` löst das Ziel mit einem vorhandenen Token, keine neue Farbe.

**Fix:** `apps/web/src/components/Toast.tsx`, die Regelzeile von `text-ink-500` auf `text-ink-600`
(ein vorhandenes Token derselben Rampe).

**Grüner Lauf** (dieselbe Kommandozeile, nach der Änderung; wieder die volle Suite, 18/18 grün):

```
[axe] toast (Regelzeile, Selbst-Zusammenführung abgelehnt) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] toast (Regelzeile, Selbst-Zusammenführung abgelehnt) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓  18 [chromium] › e2e/takt-009-toast-kontrast.spec.ts:55:1 › takt-009: Regelzeile im Toast bei verweigerter Selbst-Zusammenführung — Kontrast und axe (3.5s)
...
  18 passed (2.3m)
```

**Playwright, volle Suite:** 18/18 grün (siehe grüner Lauf oben — dieselbe Ausführung deckt alle
sieben Spezifikationsdateien ab, `apps/web/e2e/*.spec.ts`).

**`pnpm gates`** (Tail, wörtlich):

```
1..196
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6430.557513

> @hv/web@0.0.0 build /home/user/wt/takt/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-DwK4D-x4.css                        39.98 kB │ gzip:   8.67 kB
dist/assets/index-DoggZHdG.js                        529.18 kB │ gzip: 155.32 kB │ map: 2,183.66 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.15s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (signature aca4566fe73c…) at commit 28f9e9d, tree 513743e0ccf0…
```

Exit code `0`.

## Offen

Keins. `docs/evidence` wurde nach jedem Playwright-Lauf mit `git checkout -- docs/evidence`
zurückgesetzt (Schritt 6 der Arbeitsanweisung); diese Scheibe committet dort nichts.

## Review findings

(vom Reviewer)
