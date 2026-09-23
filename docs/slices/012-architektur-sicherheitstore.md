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

## Review findings

(vom Reviewer)
