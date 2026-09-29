# takt-024 — Postgres: Schreibsperre erst nach Routentreffer und Vertragsprüfung

**Status:** review · **Risikoklasse:** hoch (Betrieb, Verfügbarkeit) · **Lanes:** service
**Regeln:** AGENTS.md R1–R12; Bedrohungsmodell T-G1-D-01 (Verfügbarkeit); Sicherheits-Checkliste SP-2, SC-08
**Ausgangspunkt:** Nachprüfung 027 (29.09.2026), major 1. Die Middleware `app.use('/v1/*', …)` in
`apps/api/src/app.ts` öffnet bei Postgres für **jede** schreibende Methode unter `/v1` eine Transaktion, nimmt den
globalen Advisory-Lock (`pg_advisory_xact_lock(27027, 1)`) und lädt und verifiziert das ganze Log — bevor
`validateOperation`, die Routenauflösung (404) oder die Vertragsprüfung (422) greifen. Jeder angemeldete Aufrufer kann
mit POSTs auf unbekannte Pfade oder ungültige Bodies alle Schreiber serialisieren; bei 10 000 Ereignissen laut
Bericht 027 rund 2,5 s je Anfrage unter dem Lock.

## Ziel

1. Die Postgres-Grenze (Migrationsstatus, Laufzeitrechte, Transaktion, Lock, Snapshot, Commit/Rollback) läuft erst,
   **nachdem** eine Route getroffen und `validateOperation` die Anfrage angenommen hat. Unbekannte `/v1`-Pfade (404)
   und vertragswidrige Anfragen (422 aus Header-, Query- oder Body-Prüfung) nehmen weder Verbindung noch Lock noch
   Snapshot.
2. Kein `/v1`-Handler ist ohne die Grenze erreichbar, wenn Postgres konfiguriert ist (heute garantiert durch
   `app.use('/v1/*')`; nach der Änderung durch die Konstruktion, z. B. die Grenze als Teil der pro Route
   eingehängten Middleware-Kette hinter `validateOperation`, oder eine gleichwertige Lösung). Die Wahl begründet der
   Bericht in zwei Sätzen.
3. Lesende Anfragen verhalten sich wie bisher (REPEATABLE READ READ ONLY, kein Lock).
4. Rechte-403 bleibt nach dem Lock (Rollen kommen aus dem Log); das ist bekannt und wird mit Rate-Limit (034) und
   Scan-Kosten (071) behandelt, nicht hier.

## Nicht-Ziele

Keine Änderung an Vertrag, Domäne, Migrationen, Rechten oder dem In-Memory/JSONL-Pfad; keine Timeouts (Folgeliste);
keine Optimierung des Vollscans (071); kein Rate-Limit (034).

## Files allowed

- `docs/slices/takt-024-postgres-lock-nach-validierung.md`
- `apps/api/src/app.ts`
- `apps/api/src/validate.ts`
- `apps/api/src/__tests__/postgres027.test.ts` oder neu `apps/api/src/__tests__/postgres-takt024.test.ts`
- `.github/workflows/gates.yml` (nur die neue Testdatei in den Postgres-Schritt aufnehmen, falls neu)

## Tests zuerst und Abnahme

Lokal läuft Postgres 16 (Cluster des Orchestrators auf `localhost:5432`); Umgebung wie in CI:
`TEST_DATABASE_URL=postgres://hv_owner:hv_owner_test@localhost:5432/hv_t024` (eigene Datenbank dieser Scheibe; `hv_test` nutzen andere Läufe),
`TEST_RUNTIME_DATABASE_URL=postgres://hv_runtime:hv_runtime_test@localhost:5432/hv_t024` (eigene Datenbank dieser Scheibe; `hv_test` nutzen andere Läufe), `HV_DB_RUNTIME_ROLE=hv_runtime`.
Migrationen: `HV_MIGRATION_DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @hv/api db:migrate up`.

1. Rot zuerst: Während eine Verbindung den Lock hält (wie der bestehende Zwei-Instanzen-Test über
   `pg_stat_activity`), kommen (a) `POST /v1/gibt-es-nicht` → 404 und (b) ein POST auf eine echte Schreibroute mit
   vertragswidrigem Body → 422 **sofort** zurück, ohne auf den Lock zu warten; (c) eine gültige Schreibanfrage wartet
   weiterhin. Zusätzlich: kein Ereignis geschrieben.
2. Grün danach; alle bestehenden Postgres-Tests (`migrations027`, `postgres027`, `postgres028`,
   `postgres-auth-029b`) weiter grün, lokal gelaufen (nicht übersprungen: die Ausgabe zeigt die Testzahl).
3. `pnpm gates` grün auf sauberem Commit (mit gesetzten Postgres-Variablen); Bericht mit wörtlichem Schluss.

## Vor dem Bau prüfen

`apps/api/src/app.ts` ganz lesen (Middleware-Reihenfolge, `requestStorage`, `domain`-Proxy, Idempotenzkarten,
`/auth/*`-Pfade, die ebenfalls Postgres nutzen), `validate.ts`, die Postgres-Tests. Weicht der Code von der Spec ab,
melde es, statt auszulegen.

## Nachweis

- Postgres-Dateien lokal gegen Postgres 16 (eigene DB), alle fünf zusammen wie in CI: vor dem Testfix 6 von 12 Läufen
  rot, danach 20 von 20 grün (je 31 Tests).
- `pnpm gates` mit gesetzten Postgres-Variablen, Exit 0 auf Commit `df70ac1` (Kopf dieses PRs). Wörtlicher Schluss:

```
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.45s
mark-test-run: wrote /home/user/wt/takt-024/.claude/state/last-test-run (clean tree) at commit df70ac1, tree 0a7b37f06ef2…
exit 0
```

- Nach Einmergen des Integrationsbranchs (takt-023 ändert ebenfalls `apps/api/src/app.ts`, konfliktfrei): Merge-Commit
  `60b69db`, Postgres-Dateien 5 / 31 Tests grün, `pnpm gates` mit Postgres-Variablen Exit 0. Wörtlicher Schluss:

```
✓ built in 2.16s
mark-test-run: wrote /home/user/wt/takt-024/.claude/state/last-test-run (clean tree) at commit 60b69db, tree a3c2b42b15de…
EXIT 0
```

## Review findings

Review in frischem Kontext (reviewer, Opus, 29.09.2026): **freigabefähig**, 0 blocker, 0 major. Alle 55 `/v1`-Routen
hängen an `guarded(...)`, auch die vier Aliasrouten; der `domain`-Proxy wirft bei Postgres ohne Request-Store;
Rollback/Commit-Semantik aus 027 unverändert; Test echt (Wartezustand über `pg_stat_activity`, 2-s-Schranke).
Postgres-Dateien lokal 5/30 grün.

1. minor → Folgeliste: zweiter Test prüft nur eine lesende Aliasroute; statischer Check „jede `/v1`-Route beginnt mit
   `guarded(`“ fehlt.
2. minor → Folgeliste: Proxy-Guard wirft einfachen `Error` (unspezifische 500, kein Betriebssignal).
3. minor (mitgenommen, Orchestrator): `postgres028.test.ts` fehlte im CI-Postgres-Schritt, jetzt aufgenommen.
4. nit → Folgeliste: `ROLLBACK` im `finally` nach `COMMIT` im Test.
5. nit: 422 aus Query-Parameter nicht eigens geprüft (gleicher Codepfad).

CI-Befund auf `43e8c9b` (nach Aufnahme von `postgres028` in den CI-Postgres-Schritt): `postgres027` „waits for the
global lock …“ erwartete 412, erhielt 201. Ursache: kein verlorenes Update, sondern die Wartezustand-Abfrage der Tests
(`pg_stat_activity`, datenbankweit) sah Wartende paralleler Testdateien. Fix in `df70ac1`: Filter auf den
`application_name` der eigenen Pools; neuer Invariantentest „gleicher `If-Match` → genau `[201, 412]`, fünf Runden mit
wechselnder Reihenfolge“. Assertion 201/412 unverändert.

Codex (ein Lauf beim Ready-Setzen, auf `df70ac1`): 1 × P1 — Gates-Commit und wörtlicher Schluss fehlten in der Spec →
Abschnitt „Nachweis“ ergänzt.
