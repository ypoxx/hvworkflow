# takt-036 — 034a-Test: Katalogabfrage kollidiert mit parallelen Testdateien

**Status:** Bau · **Risikoklasse:** niedrig (nur Test, kein Produktivcode) · **Lanes:** service (Test)
**Regeln:** AGENTS.md R1, R2, R12
**Ausgangspunkt:** CI-Lauf 36669190170 auf PR #88: `postgres-limits034a.test.ts`, Test „migrates up, down and up again
with version 3 …“, `SELECT 1 FROM pg_catalog.pg_indexes …` scheiterte mit `could not open relation with OID 16881`
(XX000). Die Pg-Testdateien laufen parallel auf derselben Datenbank; die View `pg_indexes` ruft `pg_get_indexdef()` auch
für Zeilen fremder Schemas auf, die eine andere Testdatei (z. B. `postgres-auth-029b`) gleichzeitig löscht.

## Ziel

Die Indexprüfung fragt die Roh-Kataloge (`pg_index`, `pg_class`, `pg_namespace`, `pg_attribute`) ab, gefiltert auf das
eigene Schema und die Tabelle `auth_login_states`, und prüft die Indexspalte `expires_at` über `pg_attribute`
(einspaltiger Index). Kein `pg_get_indexdef` mehr. Übrige Katalogabfragen in `apps/api/src/__tests__` geprüft:
`pg_proc`-Abfragen nutzen Roh-Kataloge ohne `pg_get_functiondef`; `information_schema` in `migrations027.test.ts` ist auf
`current_schema()` gefiltert und unverändert.

## Nicht-Ziele

Keine Änderung an Produktivcode, Vertrag oder anderen Tests; keine abgeschwächte Zusicherung.

## Files allowed

- `docs/slices/takt-036-katalog-rennen.md`
- `apps/api/src/__tests__/postgres-limits034a.test.ts`

## Abnahme

1. Pg-Schritt-Dateiliste der CI gegen Postgres (DB `hv_t036`) fünfmal parallel grün.
2. `pnpm gates` mit Postgres-Variablen grün auf sauberem Commit; Nachweis in eigenem Doku-Commit.

## Nachweis

Gates-Commit: `7bfce09` (sauberer Baum, `pnpm gates` mit Postgres-Variablen, DB `hv_t036`, Exit 0). Pg-Dateiliste der CI
(8 Dateien) fünfmal parallel: je 8/8 Dateien, 60/60 Tests grün.

Wörtlicher Schluss von `pnpm gates`:

```
✓ built in 1.73s
mark-test-run: wrote /home/user/wt/t036/.claude/state/last-test-run (clean tree) at commit 7bfce09, tree 8f13d655b64c…
```
