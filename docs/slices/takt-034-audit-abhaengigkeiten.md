# takt-034 — Audit-Advisories: fast-uri und brace-expansion auf gepatchte Versionen

**Status:** Bau · **Risikoklasse:** mittel (Abhängigkeitsänderung, Lockfile-only; fast-uri liegt im Laufzeitpfad von apps/api) · **Lanes:** service, Lieferkette
**Regeln:** AGENTS.md R1, R2, R12; Leitplanken Lieferkette/Abhängigkeiten
**Ausgangspunkt:** `pnpm audit:check` blockiert PR #84 (30.09.2026) wegen #1240091 (fast-uri, moderate), #1240101 (brace-expansion, moderate), #1240105 und #1240109 (brace-expansion, high).

## Ziel

Die Abhängigkeiten werden auf gepatchte Versionen gehoben, keine neuen Ausnahmen:

| Advisory | Paket | Pfad | Laufzeit/Build | Vorher → Nachher |
|---|---|---|---|---|
| #1240091 | fast-uri | apps/api > ajv > fast-uri | Laufzeit (apps/api) | 3.1.7 → 3.1.8 (patched >=3.1.8) |
| #1240101/05/09 | brace-expansion | openapi-typescript > @redocly/openapi-core > minimatch > brace-expansion | nur Build (Vertrag-Lint/Typen) | 2.1.4 → 2.1.7 (patched >=2.1.7) |

Umsetzung: `pnpm update -r --depth 99 fast-uri brace-expansion`, innerhalb der bestehenden Semver-Bereiche der Eltern; nur `pnpm-lock.yaml` ändert sich. Keine Overrides.

## Nicht-Ziele

Keine neue Ausnahme, keine Änderung an `scripts/audit-exceptions.json` (der bestehende js-yaml-Eintrag bleibt), keine Major-Sprünge, kein Produktivcode.

## Files allowed

- `docs/slices/takt-034-audit-abhaengigkeiten.md`
- `pnpm-lock.yaml`
- `package.json`-Dateien, `pnpm-workspace.yaml` (nicht benötigt)

## Abnahme

1. `pnpm audit:check` grün (nur der bestehende js-yaml-Eintrag ausgenommen).
2. `pnpm install --frozen-lockfile` funktioniert.
3. `pnpm gates` grün auf sauberem Commit; Nachweis in eigenem Doku-Commit.

## Nachweis

Gates-Commit: `8412dd1` (sauberer Baum, `pnpm gates` ohne Postgres-Variablen, Exit 0; `pnpm install --frozen-lockfile` ok). fast-uri liegt nur in apps/api (ajv), nicht im Web-Bundle; daher kein Web-e2e.

Wörtlicher Schluss von `pnpm gates`:

```
✓ built in 1.71s
mark-test-run: wrote /home/user/wt/t034/.claude/state/last-test-run (clean tree) at commit 8412dd1, tree df796ab85b4b…
```

Schluss von `pnpm audit:check`:

```
pnpm audit: 1 advisory(ies) found, all at "moderate"+ covered by an unexpired exception.
```

(Die eine Ausnahme ist der bestehende js-yaml-Eintrag #1193727, unverändert.)
