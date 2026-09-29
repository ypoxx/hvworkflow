# takt-023 — Rollenverlust in laufender Sitzung: Web zeigt ihn, Abmelden bleibt möglich

**Status:** review · **Risikoklasse:** hoch (Anmeldung, Sitzung) · **Lanes:** web-api, web-shell, service (nur Auth-Middleware)
**Regeln:** AGENTS.md R1–R12; Sicherheits-Checkliste SP-3, SP-6, SP-7, SC-01, SC-06
**Ausgangspunkt:** Nachprüfung der Codex-Scheiben vom 29.09.2026 (`docs/bautage/2026-09-27-29.md`).
- **030, major 1:** `/auth/me` antwortet laut Vertrag 0.3.7 mit **403**, wenn eine gültige Sitzung keine aktive
  Rolle mehr hat (entzogen, abgelaufen, Jahrgang geschlossen). `apps/web/src/api/auth.ts` (`refresh`) behandelt nur
  401. Beim Start wird aus 403 der Zustand `error` („Sitzung konnte nicht geprüft werden“) mit Anmeldeknopf, nach der
  IdP-Runde wieder dasselbe (Schleife). Beim Refresh in laufender Sitzung bleibt `signedIn` samt CSRF-Token und alter
  Rolle stehen; jede Fachanfrage endet in 403. Die Grenze aus 030 („gesperrter Zugang führt bei der nächsten Anfrage
  auf die Anmeldeseite“) ist für den Rollenverlust nicht erfüllt.
- **029b, minor 2:** `POST /auth/logout` läuft in `apps/api/src/app.ts` durch die globale Middleware und damit durch
  `sessionActorFromEvents`; eine Sitzung ohne aktive Rolle bekommt 403 und kann sich nicht abmelden.
- **030, major 2:** Die Spec 030 nennt als Risikoklasse hoch keine Bedrohungs-IDs und keinen Missbrauchsfall (SP-6).

## Ziel

0. **Vertrag 0.3.8 (additiv, Entscheidung des Orchestrators nach Rückfrage des Implementierers, 29.09.).** Beim
   Start kennt das Web noch keinen CSRF-Token; ohne ihn ist Abmelden unmöglich (Logout verlangt CSRF, 422/403 bleiben).
   Deshalb bekommt die **403-Antwort von `GET /auth/me`** eine eigene Antwortdefinition: `application/problem+json`
   wie `Forbidden`, plus Pflichtfeld `csrfToken` (gleiches Muster wie `Session.csrfToken`) und `Cache-Control: no-store`
   und `X-Server-Time`. Nur für den Fall „gültige Sitzung, keine aktive Rolle“; 401 bleibt unverändert. Der Token ist
   an die Sitzung gebunden und nur für `POST /auth/logout` brauchbar, weil jede `/v1`-Mutation weiter an der
   Rollenauflösung scheitert. Keine anderen Operationen ändern sich. `info.version` und
   `packages/contract/package.json` 0.3.8, `types.ts` regeneriert (`pnpm contract:types`), CHANGELOG `[0.3.8]`,
   exakte Versions-Assertions in `contract.test.ts` und `takt-019-contract.test.ts` nachziehen.
   Der Dienst liefert diese Antwort, indem die globale Middleware für genau `/auth/me` und `/auth/logout` die
   Rollenauflösung nicht vorab ausführt (Sitzung und, bei Logout, CSRF werden geprüft); `/auth/me` löst die Rolle
   selbst auf und antwortet bei fehlender Rolle mit dem neuen 403.
1. **Web, neuer Zustand `noRole`.** `AuthState` erhält `{ kind: 'noRole' }`. `refresh()` bildet `ApiProblem` 403 von
   `/auth/me` darauf ab: CSRF-Token bleibt nur so lange, wie Abmelden ihn braucht, der Actor wird verworfen
   (`onActorChange(undefined)`), laufende Fachanfragen und der 30-s-Impuls enden wie bei `signedOut`. Gilt beim Start
   und beim Refresh (Timer, Sichtbarwerden).
2. **Web, Anzeige.** Für `noRole` eine eigene Seite mit DE/EN-Text („Für Ihr Konto ist derzeit keine Rolle aktiv.
   Wenden Sie sich an die Administration.“ sinngemäß, Hausvokabular) und dem Knopf **Abmelden**, **kein**
   Anmeldeknopf (keine Schleife). Abmelden geht über `logout()`; danach `signedOut` mit normaler Anmeldeseite.
3. **Dienst, Abmelden ohne Rolle.** `/auth/logout` prüft nur Sitzung und CSRF, nicht die Rollen: die globale
   Middleware ruft für genau diesen Pfad nicht die Rollenauflösung (`authenticate` bzw. `sessionActorFromEvents`) auf,
   sondern nur Sitzungs-Cookie, CSRF und `readSession`. Keine anderen Pfade werden ausgenommen.
4. **Spec 030 nachziehen.** Abschnitt „Bedrohungen und Grenzen“ von `docs/slices/030-http-web-anmeldung.md` nennt die
   einschlägigen Bedrohungs-IDs aus `docs/sicherheit/bedrohungsmodell.md` (am Modell prüfen; Kandidaten laut Review:
   T-G1-S-01, T-G1-S-02, T-G1-T-05, T-G3-S-02) und einen Missbrauchsfall, je mit dem Test, der ihn belegt; dazu diese
   Scheibe als Nachtrag.

## Nicht-Ziele

Keine Vertragsänderung außer Ziel 0, keine Mehrrollenwahl, kein Rate-Limit (034), keine
Änderung an `ROLE_PERMISSIONS`, keine Oberflächenänderung außerhalb der Anmelde-/Rollenverlust-Seite.

## Files allowed

- `docs/slices/takt-023-rollenverlust-sitzung.md`
- `docs/slices/030-http-web-anmeldung.md` (nur Abschnitt „Bedrohungen und Grenzen“ und ein Nachtrag)
- `apps/web/src/api/auth.ts`, `apps/web/src/api/auth.test.ts`
- `apps/web/src/api/http.ts`, `apps/web/src/api/http.test.ts` (nur falls der Impuls/Actor-Abbau es verlangt)
- `apps/web/src/app/App.tsx` (+ eine neue Komponentendatei unter `apps/web/src/app/` falls sauberer)
- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts`, `apps/web/src/i18n/parity.test.ts` (Schlüsselzahl)
- `apps/web/e2e/030-anmeldung.spec.ts`
- `apps/api/src/app.ts` (nur Auth-Middleware und die Handler `/auth/me`, `/auth/logout`)
- `packages/contract/openapi.yaml`, `packages/contract/src/types.ts`, `packages/contract/package.json`,
  `packages/contract/CHANGELOG.md`
- `apps/api/src/__tests__/contract.test.ts`, `apps/api/src/__tests__/takt-019-contract.test.ts` (nur Versions-Assertion
  bzw. Schema-Prüfung der neuen 403-Antwort)
- `apps/api/src/__tests__/auth-029b.test.ts`
- `docs/evidence/takt-023-*.png`

## Tests zuerst und Abnahme

1. Rot zuerst, dann grün (`auth.test.ts`): (a) Start mit 403 (Problem mit `csrfToken`) → `noRole`, kein Actor, Token nur für `logout()` genutzt; 403 ohne gültigen
   Token → `error` wie bisher;
   (b) Refresh aus `signedIn` mit 403 → `noRole`, `onActorChange(undefined)` aufgerufen; (c) `logout()` aus `noRole`
   → `signedOut`; (d) 403 aus einem **Fach**aufruf ändert den Auth-Zustand weiterhin nicht (Grenze aus 030).
2. Dienst (`auth-029b.test.ts`, bestehende Fixtures): Sitzung, deren einzige Rolle entzogen wurde → `GET /auth/me` 403
   mit `csrfToken` (gegen das neue Schema validiert, `Cache-Control: no-store`), mit genau diesem Token
   `POST /auth/logout` mit gültigem CSRF **204** und Sitzung danach 401; ohne CSRF weiter 422, falscher CSRF weiter 403;
   ein Fachaufruf `/v1/…` derselben Sitzung weiter 403.
3. i18n: neue Schlüssel in DE und EN, Paritätszahl im Test angepasst, kein Literal (Tor `i18n-literals`).
4. e2e (nur wo die bestehende 030-Datei gemockte Antworten nutzt): Rollenverlust-Seite ohne Anmeldeknopf, Abmelden
   führt zur Anmeldeseite; Screenshot `docs/evidence/takt-023-rollenverlust.png`.
5. `pnpm gates` grün auf sauberem Commit; Bericht mit wörtlichem Schluss.

## Vor dem Bau prüfen

Code und Tests lesen, bevor du änderst: `apps/web/src/api/auth.ts`, `App.tsx` (`HttpBoot`, `HttpLogin`),
`apps/api/src/app.ts` (Middleware ab `app.use('*'`, `/auth/me`, `/auth/logout`), `apps/api/src/actor.ts`
(`sessionActorFromEvents`), die festen Zahlen in `apps/web/src/i18n/parity.test.ts`. Weicht der Code von dieser Spec
ab, melde es, statt die Spec auszulegen.

## Review findings

Rückfrage des Implementierers vor dem Bau (berechtigt): beim Start-403 kennt das Web keinen CSRF-Token, Abmelden wäre
unmöglich → Ziel 0 (Vertrag 0.3.8, `csrfToken` im 403 von `/auth/me`) vom Orchestrator ergänzt.

Review in frischem Kontext (reviewer, Opus, 29.09.2026): **freigabefähig**, 0 blocker, 0 major. Ausnahme greift nur
bei Sitzungsbetrieb und genau `/auth/me`/`/auth/logout`; Token nur nach gültigem `readSession`, `no-store`; kein
CORS im Sitzungsbetrieb; `types.ts` reproduzierbar; Einzeltests api 40/40, web 61/61.

1. minor → Folgeliste: 403-Body nicht gegen `NoActiveRole` validiert, `X-Server-Time` nicht geprüft.
2. minor → Folgeliste: Test 1(d) (403 aus Fachaufruf ändert Zustand nicht) prüft faktisch nichts.
3. minor → Folgeliste: Missbrauchsfall in Spec 030 ohne Erkennung/Signal/Empfänger bzw. MF-Bezug (SC-06).
4. minor → Folgeliste: `GET /auth/me` einer Sitzung ohne Rolle schiebt das Leerlauffenster (`slideIdle`) weiter.
5. nit: `logout`-Beschreibung im Vertrag nennt „keine Rolle nötig“ nicht.
6. nit: `noRole` fragt die Sitzung nicht neu ab; neue Rolle erst nach Ab- und Anmelden (bewusste Grenze).
