# takt-024 — Postgres: Schreibsperre erst nach Routentreffer und Vertragsprüfung

**Status:** Bau · **Risikoklasse:** hoch (Betrieb, Verfügbarkeit) · **Lanes:** service
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

## Review findings

folgt
