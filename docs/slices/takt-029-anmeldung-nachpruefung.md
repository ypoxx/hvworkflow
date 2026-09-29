# takt-029 — Anmeldung: Negativtests, 503 statt 500, kein Leerlauf-Verlängern ohne Rolle

**Status:** Bau · **Risikoklasse:** hoch (Identität, Sitzung, Leitplanken §4) · **Lanes:** service (Auth) · **Perspektive:** Security
**Regeln:** AGENTS.md R1–R3, R6, R8, R12; ADR 0004; Sicherheits-Checkliste SP-3, SP-7, SC-01
**Ausgangspunkt:** Nachprüfung 029b und Review takt-023 (29.09.2026); Sicherheitsbefunde gehören nicht auf die Folgeliste
(AGENTS.md R3, Codex P1 auf #66). Liste am Ende von `docs/folgeliste.md`. Stand nach 033a (`c758fc6`): `/auth/me` und
`/auth/logout` lesen die Sitzung vor der CSRF-Prüfung ohne Verlängerung (`readSession(…, false)`), um den
`subjectHash` zu setzen.

## Ziel

1. **Fehlende Negativtests der Anmeldung (029b).** In `apps/api/src/__tests__/auth-029b.test.ts` (bzw. dem
   Keycloak-freien Test mit lokalem OIDC-Anbieter, den 029b nutzt):
   (a) ID-Token mit `alg: none` und mit HS256 (Schlüssel = Client-Secret) → Anmeldung abgelehnt, keine Sitzung;
   (b) HTTP-Callback eines **gesperrten** Subjects → 403, keine Sitzung, kein Cookie;
   (c) HTTP-Callback eines Subjects **ohne aktive Zuordnung** → 403, keine Sitzung;
   (d) gleiches `sub` unter zwei Issuern → verschiedene `actorId`, keine übertragene Rolle (HTTP-Ebene, nicht nur Hash).
   Sind (a)–(d) mit dem heutigen Code grün, ist das der Nachweis; ist einer rot, ist das ein Befund und wird hier behoben.
2. **Callback: Persistenzfehler → 503 (029b minor 6).** Scheitert im Callback das Laden der Auth-Ereignisse oder das
   Schreiben der Sitzung an der Datenbank, antwortet der Dienst heute 500; der Vertrag (`completeLogin`) kennt nur
   400/403/503. Neu: 503 mit festem Text, keine Sitzung, Korrelations-Cookie gelöscht; Test mit einem Store, der wirft.
3. **Kein Verlängern des Leerlaufs ohne Rolle (takt-023 R1 minor 4).** `GET /auth/me` einer Sitzung ohne aktive Rolle
   (Antwort 403 `NoActiveRole`) verlängert das Leerlauffenster nicht mehr; eine solche Sitzung läuft nach 30 min ohne
   Rolle ab, auch wenn das Web weiter abfragt. `/auth/logout` bleibt unverändert. Test mit injizierter Uhr: rollenlose
   Sitzung, `/auth/me` bei t+20 min und t+35 min → bei t+35 min 401.

## Nicht-Ziele

Keine Vertragsänderung, keine Rate-Limits und kein Aufräumen der Login-Zustände (034), keine Änderung am Web, keine
Änderung an Zugriffslog/NTP (033a).

## Files allowed

- `docs/slices/takt-029-anmeldung-nachpruefung.md`
- `apps/api/src/app.ts` (nur `/auth/callback`-Fehlerpfad und `/auth/me`-Verlängerung)
- `apps/api/src/auth/store.ts`, `apps/api/src/auth/oidc.ts` (nur falls ein Negativtest einen echten Fehler aufdeckt)
- `apps/api/src/__tests__/auth-029b.test.ts`, `apps/api/src/__tests__/postgres-auth-029b.test.ts`, neue Testdatei
  `apps/api/src/__tests__/auth-takt029.test.ts`

## Abnahme

1. Tests zuerst; für Ziel 2 und 3 rot vor der Änderung, grün danach; für Ziel 1 Ergebnis je Fall berichten.
2. Postgres-Auth-Tests lokal grün (DB `hv_t029`), `pnpm gates` mit Postgres-Variablen grün auf sauberem Commit;
   Abschnitt „Nachweis“ mit Gates-Commit und wörtlichem Schluss (eigener Doku-Commit, gezielt stagen, kein Amend).

## Vor dem Bau prüfen

`apps/api/src/app.ts` (Middleware, `/auth/callback`, `/auth/me`, `/auth/logout` nach 033a), `auth/store.ts`
(`readSession`, Verlängerung), `auth/oidc.ts` (Algorithmus-Pin), `auth-029b.test.ts` (lokaler OIDC-Anbieter, Fixtures).
Weicht der Code ab oder fehlt eine Datei: melden und anhalten.

## Nachweis

Gates-Commit: `da209f1` (sauberer Baum, `pnpm gates` mit Postgres-Variablen, DB `hv_t029`, Exit 0). Postgres-Auth-Tests liefen mit.

Wörtlicher Schluss von `pnpm gates`:

```
apps/api test:  Test Files  28 passed (28)
apps/api test:       Tests  263 passed (263)
...
✓ built in 2.30s
mark-test-run: wrote /home/user/wt/takt-029/.claude/state/last-test-run (clean tree) at commit da209f1, tree 51fa936a85d4…
```

Ziel 1, Ergebnis je Fall mit dem unveränderten Code: alle grün, kein Befund.
- (a) `alg: none` und HS256 (Schlüssel = Client-Secret): lokaler Anbieter in `auth-029b.test.ts` um zwei Fehlerarten erweitert; `complete()` lehnt beide ab (grün; Prüfung auf Ebene des OIDC-Ablaufs, dort entsteht keine Sitzung).
- (b) gesperrtes Subject, HTTP-Callback: 403, kein Cookie, keine Sitzung (grün).
- (c) Subject ohne aktive Zuordnung: 403, keine Sitzung (grün).
- (d) gleiches `sub` unter zwei Issuern: verschiedene `actorId` in `/auth/me`; die Rolle des ersten Issuers gibt dem zweiten keinen Zugang (Callback 403) (grün).

Ziel 2 und 3: Tests vor der Änderung rot (500 bzw. 403 statt 503 bei beiden Fehlern; `/auth/me` bei t+35 min noch 403 statt 401), danach grün.

## Review findings

Review (Opus, frischer Kontext, nur Spec und Diff): freigabefähig, kein blocker, kein major. Einzeltests vom
Reviewer ausgeführt: `auth-029b` und `auth-takt029` 36/36, `postgres-auth-029b` gegen `hv_t029` 7/7.

1. minor, `apps/api/src/app.ts` (Callback, `consumeLoginState` und erste `isSubjectBlocked`-Prüfung): die
   503-Umwandlung war ungetestet. **In der Scheibe behoben** (sicherheitsnaher Fehlerpfad, daher nicht Folgeliste):
   die Tabelle in `auth-takt029.test.ts` prüft beide Fehlerarten auf 503, kein Cookie, keine Sitzung.
2. minor, `apps/api/src/app.ts` (Callback, Sperre zwischen Prüfung und Einfügen): 403 statt 503 war ungetestet.
   **In der Scheibe behoben**: eigener Test, die Sperre greift erst bei der zweiten Prüfung → 403, keine Sitzung.
3. nit, Ziel 3 nur gegen den Test-Store belegt: **schon abgedeckt**. `postgres-auth-029b.test.ts` prüft in
   „enforces 30-minute idle …“, dass `readSession(…, false)` `idle_expires_at` unverändert lässt.
4. nit, `apps/api/src/app.ts` (`/auth/me`): ein DB-Fehler beim Laden der Rollen liefert weiter 500. Das liegt
   außerhalb der Scheibe und betrifft die Verfügbarkeit, nicht Sicherheit, Recht oder Datenschutz. Es geht auf
   `docs/folgeliste.md`.
