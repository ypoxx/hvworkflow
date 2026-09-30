# takt-031 — 034a-Test liest das ETag außerhalb des 200-ms-Budgets

**Status:** Bau · **Risikoklasse:** niedrig (nur Test, kein Produktivcode) · **Lanes:** service (Test)
**Regeln:** AGENTS.md R1, R2, R12
**Ausgangspunkt:** CI-Lauf 36657127196 auf PR #80: `postgres-limits034a.test.ts`, Test „408 in the Postgres path …“,
lieferte 408 statt 200 bei der vorbereitenden Lesung. Die App war mit `requestTimeoutMs: 200` gebaut; auf einem
langsamen Runner überschritten kalte Pool-Verbindung und Laden des Snapshots das Budget.

## Ziel

Das ETag wird über eine zweite App mit Standardgrenzen auf demselben Pool gelesen (`speakerTag(build(pool).app)`),
sodass nur der POST unter dem 200-ms-Budget läuft. Gleiches Muster im Test „a COMMIT that is already on its way wins
over the timer“ (Lesung über `register` unter 200 ms) wird ebenso behoben. Der Test mit `requestTimeoutMs: 1` hat keine
vorbereitende Lesung und bleibt unverändert.

## Nicht-Ziele

Keine Änderung an Produktivcode, Vertrag oder anderen Tests; keine abgeschwächte Zusicherung.

## Files allowed

- `docs/slices/takt-031-etag-ausserhalb-budget.md`
- `apps/api/src/__tests__/postgres-limits034a.test.ts`

## Abnahme

1. `postgres-limits034a.test.ts` gegen Postgres (DB `hv_t031`) fünfmal grün.
2. `pnpm gates` mit Postgres-Variablen grün auf sauberem Commit; Nachweis in eigenem Doku-Commit.

## Nachweis

Gates-Commit: `3ba3b35` (sauberer Baum, `pnpm gates` mit Postgres-Variablen, DB `hv_t031`, Exit 0). `postgres-limits034a.test.ts` fünfmal einzeln: je 21/21 grün.

Wörtlicher Schluss von `pnpm gates`:

```
✓ built in 1.67s
mark-test-run: wrote /home/user/wt/t031/.claude/state/last-test-run (clean tree) at commit 3ba3b35, tree fedb7841b6b2…
```

Nachlauf nach dem Einmergen der Basis mit 031a (Codex P1 auf #81): `pnpm gates` mit Postgres-Variablen, DB `hv_t031`,
auf dem integrierten Commit `6d792b8` (sauberer Baum), Exit 0. Wörtlicher Schluss:

```
✓ built in 2.52s
mark-test-run: wrote /home/user/wt/t031/.claude/state/last-test-run (clean tree) at commit 6d792b8, tree df796ab85b4b…
```
