# takt-026 — AES-GCM der Anmeldewerte mit fester Tag-Länge

**Status:** review · **Risikoklasse:** mittel (Sicherheit, eng) · **Lane:** service (nur `apps/api/src/auth/sessions.ts`)
**Regeln:** AGENTS.md R1, R2, R12; Sicherheits-Checkliste SP-3, SC-10
**Ausgangspunkt:** Der erste Nightly-Lauf nach takt-021 (gitleaks grün, Lauf 7 per `workflow_dispatch`, 29.09.2026)
erreicht erstmals Semgrep `p/typescript` und meldet einen blockierenden Fund aus 029b:
`javascript.node-crypto.security.gcm-no-tag-length` in `apps/api/src/auth/sessions.ts:24` — `createDecipheriv` mit
AES-256-GCM ohne `authTagLength`. Praktisch schneidet `reveal` den Tag heute schon auf genau 16 Byte zu
(`subarray(12, 28)` nach Längenprüfung), ausnutzbar ist der Fund also nicht; die feste Länge macht die Zusage aber
explizit und hält den Nightly grün.

## Ziel

`protect` und `reveal` setzen `authTagLength: 16` über eine benannte Konstante; Längenprüfung und Offsets leiten sich
davon ab. Verhalten und Format der gespeicherten Werte bleiben gleich (bestehende Sitzungen bleiben lesbar).

## Nicht-Ziele

Keine Schlüsselrotation, kein Formatwechsel, keine anderen Kryptostellen (es gibt keine weiteren
`createCipheriv`/`createDecipheriv` in `apps/` oder `packages/`).

## Files allowed

- `docs/slices/takt-026-gcm-taglaenge.md`
- `apps/api/src/auth/sessions.ts`
- `apps/api/src/__tests__/sessions-takt026.test.ts`

## Abnahme

1. Charakterisierungstest (neu, vor der Änderung grün, danach grün): Rundreise; gekürzter Tag → fester Fehler;
   ein verändertes Byte in IV, Tag oder Chiffrat sowie fremder Schlüssel → fester Fehler.
2. `auth-029b.test.ts` unverändert grün.
3. `pnpm gates` grün; nach dem Merge Nightly per `workflow_dispatch` grün (Semgrep `p/typescript` ist aus der
   Sandbox nicht erreichbar, der Nachweis läuft in CI).

## Review findings

Review in frischem Kontext (reviewer, Opus, 29.09.2026): **freigabefähig**, 0 blocker, 0 major. Tag-Länge auf beiden
Seiten, Offsets 12 + 16 = 28 wie vorher, Format IV | Tag | Chiffrat unverändert (Werte aus 029b lesbar); keine weiteren
GCM-Stellen in `apps/` oder `packages/`.

1. minor → Folgeliste: der Test „gekürzter Tag“ prüft nur die Längenprüfung; die feste Tag-Länge ist durch den festen
   Ausschnitt nicht separat testbar, Nachweis bleibt Semgrep im Nightly.
2. minor → Folgeliste: IV-Länge 12 als nackte Zahl, Konstante `GCM_IV_BYTES`.
