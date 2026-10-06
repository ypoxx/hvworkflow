# takt-051 — Audit-Ausnahme für source-map-js (GHSA-68fv-2mgg-jv7q), Anhebung nach Ablauf des Mindestalters

**Status:** spec · **Risikoklasse:** mittel (berührt das Sicherheitstor `audit:check`; kein Produktivcode, kein Vertrag, keine persistierten Daten, keine Rechte, kein Personenbezug, kein Deployment; `pnpm-lock.yaml` und `package.json` bleiben unverändert. Leitplanken §4) · ca. 0,5 AStd · **Lanes:** infra (Audit-Konfiguration), docs-plan
**Rolle:** Mechaniker (builder); Review in frischem Kontext, Perspektive Security/Lieferkette (Modell nur in `.claude/agents/`, takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R11, R12; Plan 5.2 (Statische Sicherheitsanalyse); Bedrohungsmodell T-Q-T-01; Reviewer-Checkliste SC-10; Verfahren `docs/sicherheit/lieferkette-mindestalter.md` Schritt 2 (nicht erreichbar, Ausnahmeeintrag in `scripts/audit-exceptions.json` ist der kleinere Eingriff, dann warten). Keine Rule ids aus `transitions.ts`.
**Depends on:** takt-047 (Mindestalter)
**Perspektive:** Security/Lieferkette · **Glossar: neue Begriffe:** nein

## Anlass

`pnpm audit:check` scheitert seit dem 06.10.2026 auf allen PRs: Advisory 1241209 / GHSA-68fv-2mgg-jv7q, `source-map-js`
`>=1.0.0 <1.2.2`, Schweregrad high (Event-Loop-DoS über Offsets indizierter Source-Map-Abschnitte). Gesperrt ist `1.2.1`.
Die behobene Version `1.2.2` wurde am 2026-09-30T14:08Z veröffentlicht und ist damit bis 2026-10-07T14:08Z jünger als das
Mindestalter von 7 Tagen (`minimumReleaseAge: 10080`, takt-047).

## Ziel

1. Ein begründeter Eintrag für 1241209 in `scripts/audit-exceptions.json` (Ablauf 2026-10-14), damit `audit:check` grün wird.
2. Eine Zeile in `docs/folgeliste.md` für die Folge-Scheibe: `source-map-js` auf 1.2.2 anheben, Ausnahme entfernen.

## Nicht-Ziele

- Keine Abhängigkeit anheben, kein Eintrag in `minimumReleaseAgeExclude` (das Mindestalter bleibt unangetastet).
- `pnpm-lock.yaml` und `package.json` bleiben byte-gleich. Kein Anwendungscode, kein Vertrag, keine Workflows.
- Keine Änderung am Audit-Skript und keine Absenkung der Schwelle `moderate`.

## Erreichbarkeit (gelesen und ausprobiert auf `924266a`)

- `pnpm why source-map-js -r`: genau eine Version `1.2.1`, ausschließlich über `postcss@8.5.26` (`vite@8.2.2`,
  `@vitejs/plugin-react`, `@vitest/mocker`/`vitest`) und `@tailwindcss/node` (`@tailwindcss/vite`). Alle Wurzeln sind
  `devDependencies` von `@hv/web`, `@hv/api`, `@hv/domain` und dem Workspace-Wurzelpaket.
- `pnpm why source-map-js -r --prod`: leer (Exit 0, keine Ausgabe). Das Paket gehört zu keiner Produktionsabhängigkeit,
  auch nicht in `apps/api` (dessen `start` ist `tsx src/server.ts`; `apps/api/package.json` nennt es nicht).
- `pnpm --filter @hv/web build` und `grep -rl "source-map-js\|SourceMapConsumer\|SourceMapGenerator" apps/web/dist`:
  keine Treffer, der ausgelieferte Bundle enthält keinen Code des Pakets.
- Angriffsweg: das Paket parst Source Maps, die der eigene Build (vite/postcss/tailwind) erzeugt. Eine böswillige
  indizierte Source Map mit manipulierten Abschnitts-Offsets müsste in den Build-Eingang gelangen; das wäre bereits
  ein Angriff auf Quellcode oder Abhängigkeiten, nicht auf die Laufzeit. Es gibt keine Laufzeitverarbeitung fremder
  Source Maps. Folge im schlimmsten Fall: ein hängender Build oder Testlauf, kein Datenabfluss, keine Wirkung auf die
  Laufzeit oder auf Personen.

## Die Ausnahme

`scripts/audit-exceptions.json`: id `1241209`, githubAdvisoryId `GHSA-68fv-2mgg-jv7q`, module `source-map-js`, owner
`Umsetzer`, expires `2026-10-14` (eine Woche, die Anhebung ist ab 2026-10-07T14:08Z ohne Ausnahme möglich; der Ablauf
erzwingt den Rückbau, sonst scheitert `audit:check` wieder).

## Rückbau

Eine Folge-Scheibe hebt nach 2026-10-07T14:08Z `source-map-js` auf 1.2.2 an, ohne `minimumReleaseAgeExclude`-Eintrag
(die Version ist dann älter als 7 Tage), prüft mit `pnpm install --frozen-lockfile` und `pnpm audit:check` und entfernt
den Eintrag 1241209 aus `scripts/audit-exceptions.json`. Zeile in `docs/folgeliste.md`.

## Files allowed

- `docs/slices/takt-051-source-map-js-ausnahme.md` (diese Spec)
- `scripts/audit-exceptions.json`
- `docs/folgeliste.md`
- `docs/sicherheit/lieferkette-mindestalter.md` (nur ein Satz als Beispielverweis, falls nötig)

## Akzeptanzkriterium

1. `pnpm audit:check` ist vor der Änderung rot (Eintrag 1241209 fehlt) und danach grün; beide Ausgaben stehen im Bericht.
2. `git diff --stat 924266a -- pnpm-lock.yaml package.json` ist leer.
3. Erreichbarkeitsbelege oben (`pnpm why ... --prod` leer, `dist` ohne Treffer) stehen im Bericht.
4. `pnpm gates` ist grün, einschließlich `slice-scope`; der Schluss steht unter „Bericht“. Keine Oberfläche, kein Screenshot.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: mittel
Ausgelöst: [x] Sicherheitstor-Konfiguration (Ausnahme, befristet) [x] Dokumentation · sonst nichts
Perspektive und Rolle: Security/Lieferkette, Reviewer in frischem Kontext. Nachweise: Kriterien 1–4.

## Bericht

```
Slice: takt-051-source-map-js-ausnahme
Done: Befristete Audit-Ausnahme 1241209 (GHSA-68fv-2mgg-jv7q, source-map-js < 1.2.2) bis 2026-10-14 in
      scripts/audit-exceptions.json; Folgezeile für das Anheben auf 1.2.2 nach 2026-10-07T14:08Z ohne Mindestalter-Ausnahme.
Evidence: audit:check vor der Änderung (924266a) rot:
        pnpm audit: 1 blocking advisory(ies) at "moderate" or above:
          #1241209 high source-map-js (...) — no exception entry. (...)
         ELIFECYCLE  Command failed with exit code 1.
      audit:check nach der Änderung grün:
        pnpm audit: 2 advisory(ies) found, all at "moderate"+ covered by an unexpired exception.
      Erreichbarkeit: pnpm why source-map-js -r nur über postcss/@tailwindcss (devDependencies); --prod leer;
        apps/web/dist ohne Treffer; api.Dockerfile installiert --prod.
      pnpm gates auf 0e550f8: im Bau-Lauf unter Maschinenlast (Last ~27 auf 4 Kernen) dreimal rot nur in zeitkritischen
        Postgres-Tests von apps/api (keine Codeänderung in dieser Scheibe); im Lauf des Sicherheitsreviews vollständig grün,
        mark-test-run: wrote .claude/state/last-test-run (clean tree) at commit 0e550f8, tree 857baa00c0c4…
Open: Anheben auf 1.2.2 (Folgeliste), spätestens bis zum Ablauf der Ausnahme am 2026-10-14.
Touched: docs/slices/takt-051-source-map-js-ausnahme.md, scripts/audit-exceptions.json, docs/folgeliste.md
Review (Sonnet, Sicherheit, frischer Kontext): kein Blocker, kein Major, kein Minor; Nit = dieser Bericht.
```

## Review findings
