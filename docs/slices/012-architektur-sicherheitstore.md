# 012 — Architektur- und Sicherheitstore, Tor-Inventar ehrlich

**Status:** spec
**Risikoklasse:** mittel · 2 AStd · Kalender 29.09.2026 (W1) · Lanes: infra (+ manifests additiv; service und
core je eine eng begrenzte Stelle; docs-plan nur Abschnitt 5 des Entwicklungsplans — keine andere laufende
Scheibe hält diese Lanes)
**Rolle/Modell:** Implementierer-Backend · Sonnet 5 (auch die Konfigdateien, die der Plan dem Mechaniker gibt —
Abweichung nach oben, damit ein Bauender die Tore zusammenhängend verdrahtet); Review Opus 5.5 mit Perspektive
Security/Betrieb
**Rule ids:** AGENTS.md Regeln 2, 4, 6, 8, 11, 12; Leitplanken 1.3 (ADR 0001 operativ bindend), 6.2, 6.5
**Quellen-IDs:** Audit-Befund A2 (Produktplan 2.1); Plan 5.2 Scheibe 012; Plan 6.4 (Tore aus 012); B13a
**Depends on:** 009 (gemergt)
**Perspektive:** Security, Betrieb · **Glossar: neue Begriffe:** nein

## Ziel

Das Tor-Inventar in `docs/agentische-entwicklung-plan.md` Abschnitt 5 behauptet Tore, die nicht laufen (A2).
Diese Scheibe baut die Tore aus Plan 6.4 „(012)" und macht Abschnitt 5 ehrlich.

1. **Abhängigkeitsrichtung (dependency-cruiser).** Konfiguration `scripts/dependency-cruiser.cjs`, Aufruf als
   `pnpm arch` (Root-`package.json`). Regeln: (a) `packages/domain` importiert nichts aus `apps/*` und keine
   Node-Kernmodule für I/O (`fs`, `net`, `http`, `child_process`, …); (b) `apps/web` importiert nichts aus
   `apps/api` (heute keine Persistenz dort; die Regel deckt künftige `apps/api/src/persistence/**` mit ab);
   (b2) `apps/web/src/features/**` und `apps/web/src/i18n/**` importieren aus `@hv/domain` nur Typen (`import type`);
   Werte nur in `apps/web/src/api/**` (dort liegen `createInProcessApi`, Speicher und Seed, ADR 0002) — heute verletzt durch `etagOf`, `QUESTION_STATUSES`, `TERMINAL_STATUSES`, `TRACKS`, `STAGE_ASSIGNMENTS` in
   `apps/web/src/features/**` und `apps/web/src/i18n/labels.ts` (Befund aus dem Review von 009, ADR 0001 Grenze 1).
   Diese Regel wird mit Schwere `warn` angelegt (nicht blockierend), die Treffer werden im Bericht gelistet; die
   Bereinigung ist nicht Teil dieser Scheibe (Oberflächen-Lanes) und wird eine eigene Kleinänderung;
   (c) ein Adapter importiert keinen anderen Adapter — heute gibt es noch keine Nachbar-Adapter; lege die Regel
   für `apps/api/src/adapters/*/**` bereits an (Pfad reserviert, darf leer sein).
2. **Secrets-Scan (gitleaks).** In CI über die offizielle Action oder das Container-Image, Konfiguration
   `scripts/gitleaks.toml` (Standardregeln; nur begründete Allowlist-Einträge). Scan über den PR-Diff bzw.
   Push-Bereich; einmal über das ganze Repositorium im nightly-Lauf.
3. **Semgrep.** Kleiner TypeScript-Regelsatz `scripts/semgrep/rules.yml` (mindestens: `eval`/`new Function`,
   `child_process` mit Stringverkettung, `dangerouslySetInnerHTML`, `Math.random` für Sicherheitszwecke als
   Hinweis, hartkodierte Tokens/Passwörter). In CI: Befund ab Schwere WARNING (= „mittel") blockiert, nur über
   die geänderten Dateien; Vollauf mit `p/typescript` und dem eigenen Satz im nightly-Workflow.
4. **pnpm audit mit Ausnahmeliste.** `scripts/audit-check.mjs` ruft `pnpm audit --json` auf und blockiert ab
   `moderate`, außer die Advisory-ID steht in `scripts/audit-exceptions.json` mit Grund, Eigentümer und
   Ablaufdatum; ein abgelaufener Eintrag blockiert selbst. Nur in CI (braucht Netz).
5. **Rollenliteral-Scan über `apps/api/src` und `packages/domain/src`.** `scripts/role-literal-check.mjs`:
   ein Rollenname aus `Role` (admin, moderation, capture, expert, legal, approver, podium, observer) als
   String-Literal in einem Rollenkontext (`role: '…'`, `role === '…'`, `.role !== '…'`, `case '…'` in einem
   `switch` über `role` …) ist ein Befund. Ausgenommen: `packages/domain/src/permissions.ts`
   (`ROLE_PERMISSIONS`), `packages/domain/src/seed.ts` (synthetische Akteure des Korpus, Daten), Testdateien.
   Achtung: `podium`, `expert`, `legal` sind auch Antwortpfad-Werte — der Scan darf nur Rollenkontext treffen.
   Der heutige Treffer `apps/api/src/app.ts:85` (`role: 'admin'`) wird Konfiguration: Seed-Akteur aus
   `options.seedActor`, sonst aus `HV_SEED_ACTOR` (Format `id:rolle`), sonst der System-Akteur, den
   `packages/domain/src/seed.ts` bereits definiert (exportieren, falls nötig). Das Web-Vokabular-Tor bleibt, wie es ist.
6. **Statischer now()-Check für domain und api.** `scripts/now-check.mjs`: `Date.now(`, `new Date()` ohne
   Argument und `performance.now(` in `packages/domain/src` und `apps/api/src` (ohne Tests) sind Befunde, außer
   die Zeile trägt `// now-ok: <Grund>`. Genau eine Ausnahme ist erlaubt: der Standardtakt in
   `createInProcessApi` (`packages/domain/src/api.ts`, heute Zeile 153) als Injektionspunkt. Der Ersatz-ID-Pfad
   `Date.now().toString(36)` in `api.ts` (heute Zeile 122) wird ohne Uhr gebaut (z. B. nur Zufallsanteil;
   `crypto.randomUUID` ist in Node 22 und allen Zielbrowsern vorhanden). `apps/api` darf die Uhr nur in
   `server.ts` beim Verdrahten erzeugen, falls nötig (mit `now-ok`).
7. **Antwort-Schema-Validierung systematisch.** Der Testhelfer `req` in `apps/api/src/__tests__/helpers.ts`
   (oder ein Wrapper darum) prüft **jede** Antwort jeder API-Testdatei gegen den Vertrag: Statuscode muss für die
   Operation dokumentiert sein, der Body muss dem Schema entsprechen (auch Problem-Details bei 4xx). Ein nicht
   dokumentierter Status oder ein abweichender Body lässt den Test scheitern. Heutige Abweichungen, die dabei
   auftauchen, werden im Bericht gelistet; Vertrag oder Dienst werden **nicht** geändert — jede Abweichung
   bekommt einen expliziten, begründeten Ausnahmeeintrag im Helfer mit Verweis auf 019 (Vertrag 0.2.0).
8. **CI-Pfadfilter für Doku-Commits.** In `.github/workflows/gates.yml` bestimmt ein früher Schritt, ob nur
   Dokumentation geändert wurde (`docs/**`, `*.md`); dann entfallen Chromium-Installation und Playwright, alle
   anderen Schritte laufen weiter und der Job meldet sich immer (kein `paths-ignore` auf Workflow-Ebene, damit
   spätere Pflicht-Statuschecks nicht fehlen).
9. **Plan-Ehrlichkeits-Tor.** `scripts/plan-honesty.mjs`: Jede Tabellenzeile in Abschnitt 5 (5.1–5.4) von
   `docs/agentische-entwicklung-plan.md` hat eine letzte Spalte **„Stand"** mit genau einer der Formen
   `läuft (CI: <Schrittname>)`, `läuft (Hook: <Hook-Ereignis>)`, `läuft (Review: Reviewer-Checkliste)` oder
   `geplant in Scheibe NNN`. Das Skript prüft: Spalte vorhanden; `CI:` nennt einen Schritt, der in
   `.github/workflows/*.yml` mit diesem `name:` existiert; `Hook:` nennt ein Ereignis, das in
   `.claude/settings.json` konfiguriert ist; `NNN` ist eine Scheibe aus `docs/produktplan-beta.md` Abschnitt 5.
   Diese Scheibe setzt die Spalte in Abschnitt 5 wahrheitsgemäß (Scheibennummern aus Produktplan 6.4). Teilweise
   laufende Tore werden in zwei Zeilen geteilt (was läuft / was geplant ist). Nur Abschnitt 5 wird geändert; die
   übrigen Abschnitte des Entwicklungsplans gleicht 018 ab.
10. **Verdrahtung.** Die schnellen, netzfreien Tore (`arch`, `role-literals`, `now-check`, `plan-honesty`) werden
    Teil von `pnpm gates` (Root-`package.json`) und laufen damit lokal und in CI. gitleaks, Semgrep und audit laufen
    als eigene, benannte Schritte in `gates.yml`. Neuer Workflow `.github/workflows/nightly.yml` (Zeitplan und
    `workflow_dispatch`): gitleaks über das ganze Repositorium, Semgrep-Vollauf, audit.

## Nicht-Ziele

- Keine Änderung am Vertrag (`packages/contract/**`), keine Rechte- oder Übergangsänderung, keine Web-Änderung.
- Kein axe (013), keine Hooks und kein Scheibenumfang-Tor (016), kein Zeitbudget (084), kein Legal-Trace (011).
- Kein Branch-Schutz (Eigentümer, Checkliste aus 016).
- Keine Umschreibung anderer Abschnitte des Entwicklungsplans (018).

## Files allowed

- `.github/workflows/gates.yml`, `.github/workflows/nightly.yml` (neu)
- `scripts/dependency-cruiser.cjs`, `scripts/gitleaks.toml`, `scripts/semgrep/rules.yml`,
  `scripts/audit-check.mjs`, `scripts/audit-exceptions.json`, `scripts/role-literal-check.mjs`,
  `scripts/now-check.mjs`, `scripts/plan-honesty.mjs` (alle neu)
- `package.json` (Root: Skripte, devDependency `dependency-cruiser`), `pnpm-lock.yaml` (nur durch `pnpm install`)
- `apps/api/src/app.ts` (nur Seed-Akteur, Punkt 5), `apps/api/src/__tests__/helpers.ts` und bei Bedarf
  `apps/api/src/contractSchema.ts` (nur Antwort-Validierung, Punkt 7), `apps/api/src/__tests__/*.test.ts` nur, soweit
  der Helfer eine Signaturänderung erzwingt
- `packages/domain/src/api.ts` (nur Punkt 6: Ersatz-ID ohne Uhr, `now-ok` am Standardtakt),
  `packages/domain/src/seed.ts` (nur Export des System-Akteurs, falls nötig)
- `docs/agentische-entwicklung-plan.md` (nur Abschnitt 5)
- diese Datei (`docs/slices/012-architektur-sicherheitstore.md`, Abschnitt „Bericht")

## Akzeptanzkriterium

1. `pnpm gates` grün und enthält `arch`, `role-literals`, `now-check`, `plan-honesty`.
2. Jedes neue Tor wird einmal lokal absichtlich rot gemacht und wieder grün (nicht committen): Domäne importiert
   `node:fs`; `role: 'admin'` in `apps/api/src`; `Date.now()` in `packages/domain/src`; Zeile in Abschnitt 5 mit
   `läuft (CI: gibt-es-nicht)`; Antwort mit falschem Body im API-Test; Semgrep-Regel auf ein Beispiel. Ausgaben
   der roten Läufe im Bericht.
3. In CI (PR gegen den Integrationsbranch) laufen alle Schritte grün, einschließlich gitleaks, Semgrep und audit.
   Einmal wird ein absichtlicher Verstoß als eigener Commit gepusht (z. B. Rollenliteral), CI wird rot, der Revert-Commit
   macht sie wieder grün; der Orchestrator legt die Links der beiden Läufe in den Bericht.
4. `grep -n "role: 'admin'" apps/api/src/app.ts` liefert nichts; der Demo-Seed des Dienstes funktioniert weiter
   (bestehender Test oder neuer Test mit `HV_SEED_ACTOR`).
5. Abschnitt 5 des Entwicklungsplans enthält keine „läuft"-Behauptung ohne existierenden CI-Schritt oder Hook.

## Nachweise

`pnpm gates`-Ende, rote Läufe je Tor, `gates.yml`-Diff, Link des roten und des grünen CI-Laufs, Diff von Abschnitt 5.

## Arbeitsweise

- Worktree `/home/user/wt/012`, Branch `claude/slice-012-tore`. Absolute Pfade.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`.
- Playwright-Läufe erzeugen die Bilder unter `docs/evidence/` neu: solche Änderungen nicht committen, außer diese Spec
  verlangt das Bild ausdrücklich (`git checkout -- docs/evidence` vor dem Commit).
- Nicht pushen; der Orchestrator pusht und verantwortet den CI-Nachweis (Kriterium 3).
- `pnpm install` für neue devDependencies ist erlaubt (Registry erreichbar); GitHub-Release-Downloads sind aus der
  Sitzung gesperrt — gitleaks läuft nur in CI; Semgrep lokal über `pip install semgrep` möglich.

## Bericht

(vom Implementierer)

### Was gebaut wurde

Sieben neue Tore verdrahtet: `pnpm arch` (dependency-cruiser, Regeln a/b/b2/c), `pnpm role-literals`,
`pnpm now-check`, `pnpm plan-honesty` laufen jetzt lokal und in CI als Teil von `pnpm gates`
(`package.json`); Semgrep, gitleaks und `pnpm audit` laufen als eigene, benannte Schritte in
`.github/workflows/gates.yml` (PR-Diff/Push-Bereich) und im neuen `.github/workflows/nightly.yml`
(Vollauf). `apps/api/src/app.ts:85`s `role: 'admin'`-Literal ist jetzt `options.seedActor` →
`HV_SEED_ACTOR` → `SYSTEM_ACTOR` (`packages/domain/src/seed.ts`, neu exportiert), mit vier neuen
Tests (`apps/api/src/__tests__/seedActor.test.ts`), die auch den Fail-closed-Fall (Akteur ohne
`demo.seed`) belegen. `apps/api/src/__tests__/helpers.ts`s `req()` validiert jetzt jede Antwort jedes
Tests in `apps/api/src/__tests__/*.test.ts` automatisch gegen den Vertrag (Statuscode dokumentiert,
Body passt zum Schema, Problem-Details bei 4xx); `apps/api/src/contractSchema.ts` bekam dafür
`matchOperationId`/`documentedStatuses`. `packages/domain/src/api.ts`: die Ersatz-ID ist jetzt ohne
Uhr gebaut (nur Zufall), der Standardtakt trägt `now-ok`. Abschnitt 5 des Entwicklungsplans hat jetzt
eine „Stand"-Spalte in allen vier Tabellen (33 Zeilen), mechanisch geprüft durch `plan-honesty.mjs`.

### `pnpm gates` — Ende des grünen Laufs (vollständig, lokal)

```
$ pnpm gates
...
> hvworkflow@0.1.0 arch /home/user/wt/012
> depcruise --config scripts/dependency-cruiser.cjs apps/web/src apps/api/src packages/domain/src

  warn web-features-i18n-domain-types-only: apps/web/src/features/stage/Page.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/speakers/Page.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/capture/QuestionCard.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/WorkList.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/useBacklog.ts → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/Page.tsx → packages/domain/src/index.ts

x 6 dependency violations (0 errors, 6 warnings). 130 modules, 477 dependencies cruised.

> hvworkflow@0.1.0 role-literals /home/user/wt/012
> node scripts/role-literal-check.mjs

Role-literal check: no role-name literal outside the policy layer (apps/api/src, packages/domain/src).

> hvworkflow@0.1.0 now-check /home/user/wt/012
> node scripts/now-check.mjs

now() check: no direct system-clock access outside the injected clock (packages/domain/src, apps/api/src).

> hvworkflow@0.1.0 plan-honesty /home/user/wt/012
> node scripts/plan-honesty.mjs

Plan-honesty check: 4 table(s), 33 row(s) in section 5, every "Stand" verified.

> @hv/web@0.0.0 build /home/user/wt/012/apps/web
> tsc -b && vite build
...
✓ 1713 modules transformed.
...
✓ built in 1.42s
```
Exit code `0`. Wall time locally: `real 0m25.954s` (well under the ~1 min budget). `pnpm --filter
@hv/api test`: 29 passed (4 files, incl. the 4 new `seedActor.test.ts` tests). `pnpm --filter
@hv/domain test`: 39 passed (4 files, unchanged). `pnpm --filter @hv/web test`: 35 passed (unchanged,
not part of allowed files, just re-verified). `git diff --exit-code -- packages/domain/policy-truth-table.md`
and `pnpm contract:types && git diff --exit-code -- packages/contract/src/types.ts`: both clean —
neither the transition/permission tables nor the contract were touched by this slice.
`node scripts/audit-check.mjs`: `pnpm audit` reports one advisory (`#1193727`, high, `js-yaml`,
transitive via `openapi-typescript > @redocly/openapi-core`), covered by the one entry in
`scripts/audit-exceptions.json` (owner `aderno@gmail.com`, expires `2026-12-31`); exit `0`.

### Rote Läufe je Tor (Abnahmekriterium 2), lokal, nicht committet

**1. `pnpm arch` — Domäne importiert `node:fs`** (temporary `import { readFileSync } from 'node:fs';`
inserted into `packages/domain/src/api.ts`, reverted immediately after):
```
error domain-no-node-io-core-modules: packages/domain/src/api.ts → fs
x 7 dependency violations (1 errors, 6 warnings). 129 modules, 475 dependencies cruised.
```

**2. `pnpm role-literals` — `role: 'admin'` in `apps/api/src`** (this is the gate's actual baseline
before the point-5 fix, captured before `app.ts` was changed):
```
Role-literal check failed (AGENTS.md rule 4): a role name is used as a literal outside the policy layer.
  apps/api/src/app.ts:85: actorStorage.run({ id: 'system', role: 'admin' }, () => {
exit=1
```

**3. `pnpm now-check` — `Date.now()` in `packages/domain/src`** (temporary
`const __gateDemo = Date.now();` inserted as line 1 of `packages/domain/src/state.ts`, reverted):
```
now() check failed (AGENTS.md rule 8): direct system-clock access outside the injected clock.
  packages/domain/src/state.ts:1: const __gateDemo = Date.now();
exit=1
```

**4. `pnpm plan-honesty` — a line in section 5 with `läuft (CI: gibt-es-nicht)`** (temporarily changed
the "ADR-Bezug" row's Stand cell, reverted):
```
Plan-honesty check failed (docs/agentische-entwicklung-plan.md, section 5):
  line 249: no CI step named "gibt-es-nicht" in .github/workflows/*.yml.
exit=1
```

**5. API test with a wrong response body** (temporarily changed the `GET /v1/meeting` handler in
`apps/api/src/app.ts` to `c.json({ ...(await domain.getMeeting()), counts: 'TEMP-BROKEN-FOR-GATE-DEMO' })`,
reverted; `pnpm --filter @hv/api test`):
```
Error: Response body for "getMeeting" (200) does not match its contract schema:
[
  {
    "instancePath": "/counts",
    ...
    "message": "must be object"
  }
]
 ❯ assertMatchesContract src/__tests__/helpers.ts:89:3
 ❯ req src/__tests__/helpers.ts:101:3
 Test Files  2 failed | 2 passed (4)
      Tests  4 failed | 25 passed (29)
```

**6. Semgrep rule on an example** (scratch files outside the repo, `pip install semgrep` locally,
`semgrep --config scripts/semgrep/rules.yml --metrics=off --disable-version-check`):
```
scripts.semgrep.no-eval                              bad.ts:4  (eval(userInput);)
scripts.semgrep.no-eval                              bad.ts:5  (new Function('return ' + userInput);)
scripts.semgrep.child-process-string-concatenation   bad.ts:6  (exec('ls ' + userInput);)
scripts.semgrep.child-process-string-concatenation   bad.ts:7  (execSync(`rm -rf ${userInput}`);)
scripts.semgrep.math-random-possible-security-use    bad.ts:11 (return Math.random().toString(36);)  — INFO, non-blocking
scripts.semgrep.hardcoded-credential-literal         bad.ts:14 (const password = "hunter2";)
scripts.semgrep.hardcoded-credential-literal         bad.ts:15 (const config = { apiKey: "sk-abcdef" };)
scripts.semgrep.dangerously-set-inner-html           bad.tsx:2 (<div dangerouslySetInnerHTML={{ __html: html }} />;)
8 findings; `good.ts` (execFile with an array, crypto.randomUUID, env-var password): 0 findings.
--error --severity WARNING --severity ERROR → exit 1 on bad.ts, exit 0 on good.ts.
```
gitleaks and `pnpm audit`'s red run were not reproduced locally: gitleaks needs the GitHub-release
binary (blocked from this sandbox, CI-only per the task); `pnpm audit`'s red/green pair **was** run
(see below, criterion 3 prep) since the registry is reachable.

**`pnpm audit:check` red/green** (temporarily emptied `scripts/audit-exceptions.json` to `[]`, then
set the one entry's `expires` to `2020-01-01`, both reverted):
```
pnpm audit: 1 blocking advisory(ies) at "moderate" or above:
  #1193727 high js-yaml (js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources) — no exception entry.
exit(no-exception)=1
...  — exception expired on 2020-01-01.
exit(expired)=1
```

### CI-Nachweis (Abnahmekriterium 3) — vom Orchestrator vorzubereiten

Dieser Worktree pusht nicht (Arbeitsweise). Der empfohlene eine-Zeile-Verstoß für den roten/grünen
CI-Lauf: einen Commit pushen, der in `apps/api/src/app.ts` `options.seedActor` durch
`{ id: 'ci-demo', role: 'admin' }` als Objektliteral im Rollenkontext ersetzt (z. B.
`actorStorage.run({ id: 'ci-demo', role: 'admin' }, ...)` statt der Variable) — das macht
`pnpm role-literals` (und damit `pnpm gates`) in CI rot; ein Revert-Commit macht ihn wieder grün.
Alternativ (deckt stattdessen den Vertragstest-Pfad ab): einen `expectValid`-Aufruf in
`apps/api/src/__tests__/contract.test.ts` auf einen falschen Status ändern. Links der beiden Läufe:
**offen — trägt der Orchestrator ein**, s. Open-Abschnitt.

### Antwort-Schema-Abweichungen (Abnahmekriterium 7)

Fünf Ausnahmen in `apps/api/src/__tests__/helpers.ts` (`UNDOCUMENTED_STATUS_EXCEPTIONS`), jede mit
Verweis auf 019 (Vertrag 0.2.0), Vertrag und Dienst unverändert:

| Operation | Status | Fundstelle im Test | Warum der Vertrag es nicht dokumentiert |
|---|---|---|---|
| jede Operation (`*`) | 401 | `negative.test.ts`: fehlender/kaputter/unbekannter `X-Actor` | `packages/contract/openapi.yaml` hat für keine Operation eine `401`-Antwort; die `demoActor`-Sicherheitsschema hat keinen zugehörigen Antwortblock. |
| `getMeeting` | 404 | neu, `seedActor.test.ts` (Fail-closed-Fall: kein Akteur mit `demo.seed`) | `GET /meeting` dokumentiert nur `200`; `packages/domain/src/api.ts` wirft aber 404, solange kein Meeting existiert. |
| `listQuestions` | 422 | `negative.test.ts`: `limit=99999`, `status=nonsense` | `GET /questions` dokumentiert nur `200`; Query-Validierungsfehler haben in dieser Vertragsversion keinen eigenen Antwortblock. |
| `returnQuestion` | 422 | `negative.test.ts`: `{ reason: 123 }` | dokumentiert nur `200/403/404/409/412`, kein `422`. |
| `withdrawQuestion` | 422 | `negative.test.ts`: `{ reason: 123 }` | dokumentiert nur `200/403/404/409/412`, kein `422`. |

Alle fünf Zeilen wurden durch den neuen automatischen Abgleich in `req()` gefunden (vorher liefen
diese Anfragen durch, ohne dass ihr Statuscode je gegen den Vertrag geprüft wurde). Vertrag und
Dienst bleiben unverändert, wie gefordert.

### Web→Domain-Importe, Regel (b2) — Fundstellen (nicht blockierend, `warn`)

`pnpm arch` listet heute sechs Verstöße, alle Werte-Importe aus `@hv/domain` in `apps/web/src/features/**`:

| Datei | Wert-Import |
|---|---|
| `apps/web/src/features/stage/Page.tsx` | `etagOf` |
| `apps/web/src/features/speakers/Page.tsx` | `etagOf` |
| `apps/web/src/features/capture/QuestionCard.tsx` | `STAGE_ASSIGNMENTS`, `TRACKS`, `etagOf` |
| `apps/web/src/features/answers/WorkList.tsx` | `QUESTION_STATUSES`, `TERMINAL_STATUSES`, `TRACKS` |
| `apps/web/src/features/answers/useBacklog.ts` | `QUESTION_STATUSES` |
| `apps/web/src/features/answers/Page.tsx` | `etagOf` |

Abweichung von der Spec-Aufzählung: `apps/web/src/i18n/labels.ts` steht in der Spec als heutiger
Treffer, ist es aber nicht mehr — die Datei importiert dort ausschließlich `import type { … } from
'@hv/domain'` (kein Wertimport mehr). Vermutlich zwischen dem Review von 009 und heute schon
bereinigt. Alle anderen genannten Symbole (`etagOf`, `QUESTION_STATUSES`, `TERMINAL_STATUSES`,
`TRACKS`, `STAGE_ASSIGNMENTS`) treffen wie in der Spec beschrieben zu. Bereinigung ist explizit nicht
Teil dieser Scheibe (Oberflächen-Lane, Nicht-Ziele).

### Diff-Zusammenfassung Abschnitt 5 (Entwicklungsplan)

`docs/agentische-entwicklung-plan.md`: 89 Zeilen geändert (+/-), nur innerhalb `## 5. Qualitätstore
je Ebene` bis vor `## 6.`. Jede der vier Tabellen (5.1–5.4) bekam eine letzte Spalte „Stand"; sechs
Zeilen wurden aufgeteilt, weil sie nur teilweise laufen (Vertrag-ist-Quelle → 3 Zeilen,
Regeltabellen-Tests → 2, Statische Sicherheitsanalyse → 3, Zweisprachigkeit → 2, Vertragsbindung → 2,
PreToolUse → 2); macht aus den ursprünglich 25 Zeilen (5.1: 5, 5.2: 8, 5.3: 7, 5.4: 5) 33. Ergebnis
(`node scripts/plan-honesty.mjs`-Auswertung): 20 Zeilen `läuft` (18× `CI: …` — davon 12 über den
gemeinsamen `pnpm gates`-Schritt, je 1 für „Contract types are up to date", „Policy truth table is
committed", „End-to-end acceptance scenario", „Semgrep", „gitleaks", „pnpm audit" —, 1× `Hook:
PreToolUse`, 1× `Review: Reviewer-Checkliste` für ADR-Bezug — reviewer.md hat keine dedizierte
ADR-Prüfpunkt-Zeile, sondern deckt das über Prüfpunkt 1 „jede Spec-Anforderung umgesetzt" ab;
Ermessensentscheidung, im Zweifel Review-Befund erwünscht), 13 Zeilen `geplant in Scheibe NNN`
(011×1, 013×1, 016×7, 017×1, 019×1, 027×1, 084×1). Der Schlusssatz nach 5.4 wurde von einer
Behauptung („Die Tore in 5.1 bis 5.3 laufen zusätzlich in CI") auf einen Verweis auf die neue
Stand-Spalte umgeschrieben. `geplant in Scheibe NNN`-Nummern kommen aus Produktplan 6.4, soweit dort
genannt (011, 013, 016, 019, 027, 084); für drei Zeilen ohne explizite 6.4-Nennung (Zweisprachigkeit
„keine Literale in Komponenten" → 017; Vertragsbindung „nur generierter Client" und „Fehlerpfad" →
016) wurde die naheliegendste Scheibe aus dem Bullet-Titel in Produktplan Abschnitt 5 gewählt (017 =
„i18n-Wörterbuch in Feature-Module teilen"; 016 = „Agentenrollen, Hooks, Scheibenumfang-Tor …" als
Sammelstelle für noch fehlende Oberflächen-Tore) — beides eine Ermessensentscheidung, kein Befund aus
6.4, im Review bitte gegenprüfen.

### `gates.yml`-Diff

```diff
diff --git a/.github/workflows/gates.yml b/.github/workflows/gates.yml
index c87a165..fa22caf 100644
--- a/.github/workflows/gates.yml
+++ b/.github/workflows/gates.yml
@@ -9,20 +9,56 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
+        with:
+          fetch-depth: 0 # full history: the path filter and Semgrep's changed-file scan diff against it
       # The pnpm version comes from `packageManager` in package.json (takt-001).
       - uses: pnpm/action-setup@v4
       - uses: actions/setup-node@v4
         with: { node-version: 22, cache: pnpm }
       - run: pnpm install --frozen-lockfile
+      # Slice 012 point 8: a doc-only commit (`docs/**`, `*.md`) skips the Chromium install and
+      # Playwright below — nothing else. No `paths-ignore` at the workflow level: the job always
+      # triggers and reports, so a later required status check never simply goes missing.
+      - name: Determine changed files
+        id: changes
+        uses: dorny/paths-filter@v3
+        with:
+          list-files: shell
+          filters: |
+            code:
+              - '!(docs/**|*.md)'
+            ts:
+              - '**/*.ts'
+              - '**/*.tsx'
       - name: Contract types are up to date
         run: pnpm contract:types && git diff --exit-code -- packages/contract/src/types.ts
-      - name: Contract lint, typecheck, lint, unit tests, vocabulary, build
+      - name: Contract lint, typecheck, lint, unit tests, vocabulary, architecture, role-literals, now-check, plan-honesty, build
         run: pnpm gates
       - name: Policy truth table is committed
         run: git diff --exit-code -- packages/domain/policy-truth-table.md
+      - name: Semgrep
+        run: |
+          if [ -z "${{ steps.changes.outputs.ts_files }}" ]; then
+            echo "Semgrep: no changed .ts/.tsx files — nothing to scan."
+            exit 0
+          fi
+          pip install --quiet semgrep
+          FILES="${{ steps.changes.outputs.ts_files }}"
+          # Hints (e.g. Math.random) are reported but never block, per the slice spec.
+          semgrep --config scripts/semgrep/rules.yml --metrics=off --disable-version-check --severity INFO --quiet -- $FILES || true
+          # WARNING and ERROR block (docs/agentische-entwicklung-plan.md 5.2 "ab Schwere WARNING").
+          semgrep --config scripts/semgrep/rules.yml --metrics=off --disable-version-check --severity WARNING --severity ERROR --error -- $FILES
+      - name: gitleaks
+        uses: gitleaks/gitleaks-action@v2
+        env:
+          GITLEAKS_CONFIG: scripts/gitleaks.toml
+      - name: pnpm audit
+        run: pnpm audit:check
       - name: Install Chromium for Playwright
+        if: steps.changes.outputs.code == 'true'
         run: pnpm --filter @hv/web exec playwright install --with-deps chromium
       - name: End-to-end acceptance scenario
+        if: steps.changes.outputs.code == 'true'
         run: pnpm --filter @hv/web e2e
       - uses: actions/upload-artifact@v4
         if: always()
```

### Nachtrag: gitleaks-Fix nach dem ersten CI-Lauf

Push-Lauf war vollständig grün (https://github.com/ypoxx/hvworkflow/actions/runs/35850239685),
inkl. Semgrep, gitleaks, audit, e2e; der `pull_request`-Lauf scheiterte am gitleaks-Schritt
(„🛑 GITHUB_TOKEN is now required to scan pull requests",
https://github.com/ypoxx/hvworkflow/actions/runs/35850259165/job/107145995174). Fix: `GITHUB_TOKEN:
${{ secrets.GITHUB_TOKEN }}` zum `env`-Block des gitleaks-Schritts in `.github/workflows/gates.yml`
und, defensiv (gitleaks-actions eigenes Nutzungsbeispiel setzt ihn für push/pull_request/schedule/
workflow_dispatch gleichermaßen), auch in `.github/workflows/nightly.yml` ergänzt. Beide YAML-Dateien
mit `python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))"` validiert; `pnpm gates` erneut
grün gelaufen.

### Offen

- **CI-Rot/Grün-Nachweis (Kriterium 3):** nicht durch mich ausführbar (kein Push aus diesem
  Worktree). Vorschlag für den absichtlichen Verstoß oben; der Orchestrator trägt die zwei Lauf-Links
  nach.
- **gitleaks lokal ungetestet:** GitHub-Release-Downloads sind aus der Sitzung gesperrt (Aufgabenstellung);
  `scripts/gitleaks.toml` ist nach gitleaks' eigenem TOML-Schema geschrieben (`[extend] useDefault =
  true`, ein `[allowlist]` mit zwei begründeten Einträgen), aber nie gegen das echte Binary gelaufen —
  der erste echte Lauf ist der CI-Job selbst.
- **AGENTS.md** beschreibt `pnpm gates` noch als „contract lint + typecheck + lint + tests +
  vocabulary check + web build" (Zeile 31) — ohne die vier neuen Schritte. `AGENTS.md` steht nicht in
  „Files allowed" dieser Scheibe; nicht angefasst.
- **Drei `geplant in Scheibe NNN`-Zahlen sind Ermessen, keine 6.4-Fundstelle** (017 und zweimal 016,
  s. Diff-Zusammenfassung oben) — im Review bitte gegenprüfen, ob eine andere Scheibe treffender wäre;
  die Zahlen sind syntaktisch gültig (`plan-honesty.mjs` prüft nur „existiert als Scheibe in
  Produktplan Abschnitt 5", nicht die inhaltliche Zuordnung).
- **`apps/api/src/__tests__/seedActor.test.ts` ist eine neue Testdatei**, nicht nur eine durch die
  Helfer-Signatur erzwungene Änderung an einer bestehenden. Abnahmekriterium 4 nennt „bestehender Test
  oder neuer Test mit `HV_SEED_ACTOR`" ausdrücklich als Alternative; ich lese das als Deckung durch die
  Spec selbst, auch wenn der Satz zu „Files allowed" enger klingt. Bitte im Review bestätigen oder als
  Befund vermerken.
- **b2-Bereinigung** (sechs Wert-Importe aus `@hv/domain` in `apps/web/src/features/**`) ist laut
  Nicht-Ziele nicht Teil dieser Scheibe; nur gelistet, nicht angefasst.
- **Web-e2e** (`pnpm --filter @hv/web e2e`) wurde in dieser Sitzung nicht erneut ausgeführt (keine
  Web-Änderung, Nicht-Ziel); die Chromium/Playwright-Bedingung in `gates.yml` (`if:
  steps.changes.outputs.code == 'true'`) ist nur durch einen echten CI-Lauf zu verifizieren.

## Touched

`.github/workflows/gates.yml`, `.github/workflows/nightly.yml` (neu), `scripts/dependency-cruiser.cjs`
(neu), `scripts/gitleaks.toml` (neu), `scripts/semgrep/rules.yml` (neu), `scripts/audit-check.mjs`
(neu), `scripts/audit-exceptions.json` (neu), `scripts/role-literal-check.mjs` (neu),
`scripts/now-check.mjs` (neu), `scripts/plan-honesty.mjs` (neu), `package.json`, `pnpm-lock.yaml`,
`apps/api/src/app.ts`, `apps/api/src/__tests__/helpers.ts`, `apps/api/src/contractSchema.ts`,
`apps/api/src/__tests__/seedActor.test.ts` (neu), `packages/domain/src/api.ts`,
`packages/domain/src/seed.ts`, `docs/agentische-entwicklung-plan.md` (nur Abschnitt 5),
`docs/slices/012-architektur-sicherheitstore.md` (dieser Bericht).


## Review findings

(vom Reviewer)
