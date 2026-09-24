# 023 — Vertragspaket 0.3.0 Fundament (nur Vertrag)

**Status:** spec (nachgeschärft nach der Fable-Prüfung vom 23.09.2026: 2 major, 4 minor eingearbeitet; Nachprüfung:
1 major, 2 minor eingearbeitet)
**Risikoklasse:** hoch · 1,5 AStd · Kalender 13.10.2026 (W3) · Lanes: contract (seriell; startet nach dem Merge von
010, das den Vertrag auf 0.2.1 hebt), service (nur Tests unter `apps/api`)
**Rolle/Modell:** Architekt · Fable 5.1 baut; Review Opus 5.5 gegen Recherche, Rechtekonzept und ADRs 0001, 0004,
0011, 0013, 0014, 0015
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 6, 12; Leitplanken 1.3 (Grenze 1: Vertrag), 6.4, 6.5
**Quellen-IDs:** Plan 5.4 Scheibe 023; Plan 3 (Zeile „Jahrgang und Tagesordnung": `/v1/meetings/{id}/…` kanonisch,
`/v1/meeting` Alias bis 0.5); ADR 0015 (neue Pflichtfelder erst optional mit Ablauf, vorab deklarierte Operationen in
der Allowlist); Review 012 Punkt 18 (fünf Vertragslücken, gehören zu 043, hier nicht)
**Depends on:** 019 (gemergt), 015 (gemergt); praktisch 010 (Lane contract, 0.2.1)
**Perspektive:** Architektur, Security (Sitzung, Admin), Datenschutz (Umschlag: personId, retentionClass)
**Glossar: neue Begriffe:** ja, aber nicht in dieser Scheibe — der Bericht listet neue Begriffe (z. B. Jahrgang,
Bühnenplatz, Aufbewahrungsklasse) für die nächste Glossar-Kleinänderung

## Ziel

Eine serielle, rein additive Vertragsänderung auf 0.3.0. Kern, Dienst, Web und e2e folgen in 024, 025, 028, 029, 033,
035, 040. Nichts wird entfernt, nichts wird Pflicht; alle heutigen Tests bleiben unverändert grün.

1. **Version** `info.version` und `packages/contract/package.json` auf `0.3.0`; CHANGELOG-Abschnitt `[0.3.0]` mit
   Added / Changed / Deprecated, je Punkt die umsetzende Scheibe.
2. **Umfang = Plan 5.4, Zeile 023, vollständig:** `meetingId` auf Speaker, Contribution, Question und Ereignissen;
   `GET`/`POST /v1/meetings`, kanonische Pfade `/v1/meetings/{meetingId}/…`, `/v1/meeting` als Alias; Umschlagfelder
   (schemaVersion, idempotencyKey, causationId, prevHash, hash, recordedAt, occurredAt mit occurredAtSource
   `server | device | paper | transcript`, retentionClass, legalHold, personId); `Contribution.version`; `Meeting.format`
   (`presence | hybrid | virtual`, Standard `presence`, E20 „auf Standard gebaut"); Ereignistypen AgendaItemOpened,
   VotingOpened, VotingClosed; `POST` claim/release auf Redebeitrag und Einzelfrage; `/healthz`, `/readyz`,
   `/metrics`; `GET /v1/stream`; Sicherheitsschema `session` (Cookie) und `/auth/login`, `/auth/callback`,
   `/auth/logout`, `/auth/me`; Admin-Operationen (Jahrgang anlegen/klonen, Fachbereiche, TOPs, Bühnenplatzliste je
   Jahrgang mit Person und Gerät je Platz, Rollenzuordnung mit optionaler `unitId` als RoleAssigned/RoleRevoked,
   Konfigurationsfreeze); Transparenzhinweis-Feld für die Anmeldeseite; Header `X-Server-Time`; `counts.byUnit` und
   `counts.bySeat` auf Meeting.
3. **Additiv nach ADR 0015:** jedes neue Feld auf einem bestehenden Schema ist optional; `If-Match` bleibt, wie es
   ist (028 macht es in 0.3.1 zur Pflicht). Was ersetzt wird (z. B. ein heutiges Enum der Bühnenplätze durch die
   Platzliste), wird `deprecated: true` mit „veraltet seit 0.3.0, entfällt in <Scheibe>", nicht entfernt.
4. **Allowlist:** jede neue Operation steht in `packages/contract/allowlist.json` als `{operationId, reason, slice,
   expires}`; `slice` ist die umsetzende Scheibe aus Plan 5. `expires` ist das Ende des Meilensteins der umsetzenden
   Scheibe laut Plan 5 plus 14 Tage (M2 endet am 11.11.2026 → `2026-11-25`), nicht das Einzeldatum der Scheibe, weil
   sich Scheiben innerhalb eines Meilensteins verschieben und ein abgelaufener Eintrag den Integrationsbranch für alle
   rot macht (`check.mjs`). Verlängern geht nur über eine Kleinänderung (takt) mit Grund. Das Vertragstor bleibt grün.
5. **Das Tor „jede `operationId` ist ausgeübt oder deklariert" wird gebaut**, weil es heute nicht existiert:
   `contract.test.ts` prüft nur `allOperationIds.length >= 29`, und `check.mjs` prüft an der Allowlist nur Form,
   Existenz und Ablauf.
   - Neu zeichnet `apps/api/src/__tests__/helpers.ts` jede Operation auf, die ein Test über `matchOperationId` trifft.
   - Weil Vitest jede Testdatei isoliert, sieht ein Modulzustand in `helpers.ts` nur die Treffer der eigenen Datei.
     Der Mechanismus muss die Treffer **aller** Testdateien unter `apps/api` sehen. Beispiele: `helpers.ts` schreibt
     jeden Treffer in eine Protokolldatei des Laufs, und eine Abschlussprüfung in einem Vitest-`globalSetup`
     (Teardown) wertet sie aus; oder eine Prüfung läuft im `test`-Skript von `apps/api` nach Vitest. Welcher Weg,
     steht im Bericht.
   - Geprüft wird: jede `operationId` des Vertrags ist ausgeübt oder steht in der Allowlist. Kein Allowlist-Eintrag
     ist zugleich ausgeübt; sonst ist er überfällig und muss raus.
   - Trifft heute eine der 29 bestehenden Operationen keinen `req()`-Aufruf, ergänzt 023 den fehlenden Aufruf in
     `contract.test.ts`. Das gehört zu diesem Ziel.
   - Rote Läufe lokal: eine neue Operation ohne Allowlist-Eintrag; ein Eintrag, der zugleich ausgeübt ist.
6. **Festlegungen des Architekten** (du baust in der Architektenrolle): wo der Plan die Form offenlässt, entscheidest
   du und schreibst jede Entscheidung mit Begründung in den Bericht und kurz in den CHANGELOG. Mindestens:
   (a) wie die kanonischen `/v1/meetings/{meetingId}/…`-Pfade und die heutigen Pfade ohne Präfix zusammenleben. Fest
   steht aus Plan 3: kanonisch `/v1/meetings/{id}/…`, `/v1/meeting` Alias für die „aktuelle HV" bis Vertrag 0.5.
   Offen ist die Form. Kriterien: möglichst wenig Doppelung; das Tor aus Ziel 5 bleibt aussagekräftig; 025 kann ohne
   weiteren Vertragszyklus umsetzen; der generierte Client aus 030 braucht eine eindeutige Basis-URL. Eine Basis mit
   Server-Variable kollidiert mit der Sammlung `GET /v1/meetings`. `/healthz`, `/readyz`, `/metrics` und `/auth/*`
   liegen außerhalb von `servers: /v1` und brauchen Überschreibungen je Pfad. Die Entscheidung steht im Bericht,
   bevor die Specs von 024, 025 und 030 geschrieben werden;
   (b) ob die Umschlagfelder auf `Event` direkt oder in einem Unterobjekt liegen (ADR 0011);
   (c) wo der Transparenzhinweis liegt (ohne Anmeldung lesbar, weil er vor der Anmeldung angezeigt wird);
   (d) welche neuen Rechte (`Action`-Enum) die Admin- und Claim-Operationen brauchen. Fest aus dem Plan:
   `agenda.manage` (025) und `admin.roles.manage` (026). Offen sind nur die Namen für Claim und die übrigen
   Admin-Operationen. Es sind nur Bezeichner; die Vergabe geschieht in den umsetzenden Scheiben in
   `ROLE_PERMISSIONS`;
   (e) welche Operationen ohne Anmeldung erreichbar sind (`/healthz`, `/readyz`, `/auth/login`, `/auth/callback`,
   Transparenzhinweis) und wie `/metrics` geschützt ist. Das bestehende Schema `oidc` (Token im Browser) widerspricht
   ADR 0004 (der Browser hält kein Token) und wird in 0.3.0 als veraltet markiert: mit `x-deprecated: true` und einem
   Satz in `description`, weil ein Security-Scheme kein Feld `deprecated` kennt und `contract:lint` sonst einen
   Fehler meldet. Das globale `security` wird eine Oder-Liste aus `demoActor` und `session`.
7. **Form der Zusätze** (aus der Prüfung, damit alles additiv bleibt):
   - `StageAssignment` bleibt als veraltetes Enum; neu kommen das optionale `seatId` und das Schema `StageSeat`.
   - `X-Server-Time` ist ein Eintrag unter `components/headers`, auf den jede Antwort verweist (OpenAPI kennt keinen
     globalen Antwort-Header).
   - `Event.payload.pii` mit `keyId` wird deklariert (024 braucht es vor 043, ADR 0011).
   - Das Ablaufdatum jedes zunächst optionalen Pflichtfelds steht in dessen `description` („Pflicht ab 0.3.1, Scheibe
     028") und als Zeile im CHANGELOG.
8. **`x-legal-notice` berichtigen** (aus 011 hierher gezogen, damit jede Änderung an `openapi.yaml` in der seriellen
   Lane contract bleibt; Audit A3): Der Text behauptet heute Normverweise in den Regeltabellen, die es nicht gibt. Neu
   sagt er, dass die Regeln der Domäne `legalRef`-Einträge tragen (Register `docs/legal-trace.md`, generiert ab 011),
   dass keiner durch Recht geprüft ist (`verified: false`, E15) und dass der Vertrag keine Norm zitiert. Läuft 011
   vorher, übernimm dessen vorgeschlagenen Wortlaut aus dessen Bericht.
9. **Typen** mit `pnpm contract:types` regenerieren; `pnpm contract:lint` ohne neue Fehler (Warnungen zählen und
   nennen).

## Nicht-Ziele

- Keine Änderung an `packages/domain`, `apps/api` (außer den zwei Testdateien für Ziel 5), `apps/web`, e2e, Seed.
- Nichts entfernen, nichts Pflicht machen, kein If-Match-Pflichtwechsel (028), keine fünf Lücken aus Review 012
  Punkt 18 (043), kein Inhalt aus `docs/legal-trace.md` im Vertrag (nur der Verweis).
- Keine Glossar-, Rechtekonzept- oder DSFA-Änderung (Nachführung durch den Orchestrator).

## Files allowed

- `packages/contract/openapi.yaml`, `packages/contract/src/types.ts` (nur generiert)
- `packages/contract/CHANGELOG.md`, `packages/contract/allowlist.json`, `packages/contract/package.json` (Version)
- `apps/api/src/__tests__/helpers.ts`, `apps/api/src/__tests__/contract.test.ts`, `apps/api/vitest.config.ts`,
  `apps/api/src/__tests__/operation-coverage.setup.ts` (neu), `apps/api/package.json` (nur das `test`-Skript; alles
  nur für das Tor aus Ziel 5)
- diese Datei (`docs/slices/023-vertrag-0-3-0-fundament.md`, Bericht)

## Akzeptanzkriterium

1. `pnpm contract:types` erzeugt keinen weiteren Diff; `pnpm contract:lint` ohne Fehler.
2. `pnpm gates` grün (inkl. Vertragstor, auch mit `CONTRACT_GATE_STRICT=1`); alle API-, Kern- und Web-Tests
   unverändert grün; CI grün einschließlich e2e.
3. Abdeckungstabelle im Bericht: jeder Punkt aus Plan 5.4 Zeile 023 → Stelle im Vertrag (Pfad/Schema) → umsetzende
   Scheibe → Allowlist-Eintrag (falls Operation). Kein Punkt fehlt.
4. Rote Läufe (lokal, nicht committet): ein Allowlist-Eintrag mit abgelaufenem Datum; eine neue Operation ohne
   Allowlist-Eintrag (Tor aus Ziel 5). Ausgaben im Bericht.
5. Typen-Diff im Bericht zusammengefasst; Liste der neuen `operationId`s mit Scheibe und Ablaufdatum.

## Nachweise

`pnpm contract:types`-Diff, `contract:lint`, CHANGELOG 0.3.0, Allowlist, Abdeckungstabelle, Festlegungen, roter und
grüner Lauf des Tors, `pnpm gates`-Ende.

## Arbeitsweise

- Worktree `/home/user/wt/023`, Branch `claude/slice-023-vertrag`. Absolute Pfade.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Architekten)

## Review findings

(vom Reviewer)
