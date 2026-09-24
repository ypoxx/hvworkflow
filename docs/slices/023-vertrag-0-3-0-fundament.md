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

(vom Architekten, Fable 5.1, 24.09.2026; Branch `claude/slice-023-vertrag`, nicht gepusht)

```
Slice: 023-vertrag-0-3-0-fundament
Done: Vertrag 0.3.0 rein additiv (29 → 65 Operationen, 26 → 49 Schemata, 25 → 33 Rechtebezeichner, 18 → 28
      Ereignistypen; kein Feld entfernt, keines Pflicht, alle 29 Bestandsrouten unverändert und — nach der
      Nacharbeit, Korrektur der ersten Fassung — auch ihre Anfrageschemata unverändert; alle Bestandstests
      unverändert grün): Jahrgang (/meetings, kanonische Sammlungspfade, Alias veraltet), Umschlag v2 flach auf
      Event, Meeting.format, counts.byUnit/bySeat, Contribution.version, StageSeat/seatId, Claim/Release,
      Tagesordnungsereignisse, Rollenzuordnung, Konfigurationsfreeze, /v1/stream, /healthz, /readyz, /metrics,
      /auth/* mit Schema session, Transparenzhinweis, X-Server-Time an jeder Antwort, x-legal-notice berichtigt.
      Tor „jede operationId ausgeübt oder deklariert" gebaut (Vitest-globalSetup + Trefferdateien); Allowlist mit
      36 Einträgen, expires 2026-11-25; CHANGELOG 0.3.0 mit Festlegungen (a)–(e).
Evidence: pnpm gates exit 0 (Ende unten, Commit a35291c); contract:lint 0 Fehler, 6 benannte Warnungen; Vertragstor
      (a)–(d) grün, auch mit CONTRACT_GATE_STRICT=1; Tor aus Ziel 5: drei rote Läufe und der grüne Lauf unten;
      pnpm contract:types zweimal mit gleicher SHA-256 (b6be193c…); slice-scope: 10 Dateien, alle erlaubt.
      Kein Screenshot (reine Vertragsscheibe), docs/evidence/ unverändert.
Open: siehe „Offen" unten — vor allem drei kleine Vertragsfelder, die 025 für seinen HTTP-Nachweis „paper mit
      früherem occurredAt und Grund → 201 mit lateEntry" braucht und die bewusst nicht in 023 sind.
Touched: packages/contract/openapi.yaml, packages/contract/src/types.ts (generiert), packages/contract/allowlist.json,
      packages/contract/CHANGELOG.md, packages/contract/package.json, apps/api/src/__tests__/helpers.ts,
      apps/api/src/__tests__/contract.test.ts, apps/api/src/__tests__/operation-coverage.setup.ts (neu),
      apps/api/vitest.config.ts, docs/slices/023-vertrag-0-3-0-fundament.md. apps/api/package.json unberührt
      (das test-Skript bleibt `vitest run`, weil das Tor im globalSetup läuft).
```

### Festlegungen des Architekten (Ziel 6)

**(a) Kanonische Pfade und Alias — Form: Geltungsbereich an der Sammlung, Kennung am Element.** Kanonisch
`/v1/meetings/{meetingId}/…` gibt es genau für das, was eine *Sammlung eines Jahrgangs* ist: `GET /meetings/{id}`
(`getMeetingById`), `agenda-items`, `units`, `speakers` (GET, POST), `speakers/order`, `contributions` (GET, POST),
`questions`, `stage` — zehn Operationen. Alles, was eine *global eindeutige eigene Kennung* hat
(`/speakers/{speakerId}`, `/contributions/{contributionId}`, `/contributions/{id}/questions`,
`/questions/{questionId}/…`), bleibt ohne Präfix und ist damit bereits kanonisch: die Kennung trägt den Jahrgang
(`meetingId` in der Ressource), ein Präfix wäre Redundanz. Die unpräfixierten Sammlungspfade aus 0.1/0.2 (`/meeting`,
`/agenda-items`, `/units`, `/speakers`, `/speakers/order`, `/contributions`, `/questions`, `/stage`) bleiben als
Alias der aktuellen HV bis Vertrag 0.5 (Plan 3) und sind ab 0.3.0 `deprecated: true` mit Hinweis auf die kanonische
Form. `/events` und der neue `/stream` sind **keine** Aliasse und werden nicht dupliziert: `seq` ist global lückenlos
(ADR 0011), also sind sie globale Ströme mit optionalem `meetingId`-Filter (ADR 0014 „Jahrgangsfilter").
Nacharbeit: `/stream` trägt den Filter, `/events` bekommt ihn mit 0.4.0 (043), weil der unveränderte Dienst ihn
heute annähme und still ignorierte (Punkt 1 der Nacharbeit).
Neue Ressourcen (Bühnenplätze, Rollenzuordnungen, Freeze, Tagesordnungsfortschritt) gibt es nur kanonisch.
*Gegen die Kriterien:* Doppelung 10 statt 29 Operationen, jede mit `$ref` auf gemeinsame Parameter, Bodies und
Antworten (`components/parameters`, `SpeakerOrder`, `QuestionList`), also ohne Schema-Doppelung; das Tor aus Ziel 5
bleibt aussagekräftig, weil jede kanonische Operation eine eigene, echte `operationId` mit Ablauf in der Allowlist ist
(025 löscht die zehn Einträge, wenn `contract.test.ts` sie trifft); 025 kann ohne Vertragszyklus bauen (dieselben
Handler zweimal montieren, Alias = laufender Jahrgang; `matchOperationId` in `apps/api/src/contractSchema.ts` trennt
Alias und kanonische Form über die Segmentzahl); 030 hat eine eindeutige Basis `/v1` für alle Fachoperationen — nur
`/healthz`, `/readyz`, `/metrics`, `/auth/*` liegen per `servers`-Überschreibung je Pfad auf `/`, wie die Spec vorgibt.
*Verworfen:* Server-Variable `/v1/meetings/{meetingId}` als Basis (kollidiert mit `GET /v1/meetings` und `/v1/meeting`,
braucht drei Basen im Client, und das Tor sähe die kanonische Form gar nicht); 29 Duplikate (Allowlist würde zur
Regel statt zur Ausnahme, nach 0.5 blieben 29 künstliche Namen); Path-Item-`$ref` (doppelte `operationId`s sind
ungültig, und `contractSchema.ts` würde die Duplikate weder sehen noch treffen).

**(b) Umschlagfelder flach auf `Event`, kein Unterobjekt.** Gründe: die Persistenzform aus Plan 3 ist eine flache
Tabelle (`seq, id, meeting_id, type, occurred_at, occurred_at_source, recorded_at, actor, subject_id, payload,
prev_hash, hash, schema_version, retention_class, legal_hold`) — Vertrag und Spalten sind 1:1; das kanonische JSON
für die Hash-Kette (024) bleibt einstufig und die Regel „Hash über den Umschlag ohne `hash`" ist ohne Verschachtelungs-
konvention formulierbar; das heutige Ereignis ist schon flach (`seq, id, type, at, actor, subjectId, payload`), ein
Unterobjekt hätte zwei Stilebenen erzeugt. `at` bleibt Pflicht und ist ab 0.3.0 derselbe Zeitpunkt wie `recordedAt`
(ADR-0011-Name); ein Veralten von `at` ist eine 0.5-Frage, weil kein Plan-5-Eintrag den Rückbau benennt. Der einzige
Unterteil ist `payload.pii` (`PiiEnvelope`, `keyId` Pflicht innerhalb), weil ADR 0009/0011 genau diesen markierten
Payload-Teil verlangen. Bindungen je Ereignistyp (QuestionLegalCleared, drei Tagesordnungsereignisse, RoleAssigned/
RoleRevoked) liegen als verschachteltes `if`/`then`/`else`, nicht als `allOf`, weil openapi-typescript `allOf` mit
`if` als `& (unknown & unknown)` rendert; verschachtelt bleibt der generierte `Event`-Typ sauber (Probe im Bericht-Lauf).

**(c) Transparenzhinweis: `GET /auth/transparency-notice`, `security: []`, Schema `TransparencyNotice`
(`version`, `text.de`, `text.en`, `updatedAt?`, `dataProtectionSummaryUrl?`).** Eigener Lesepfad ohne Anmeldung, weil
die Anmeldeseite (030) ihn vor der Anmeldung zeigt; unter `/auth`, weil er zum Anmeldeweg gehört (029 liefert den
Text als Konfiguration); zwei Sprachen im Objekt statt `Accept-Language`, weil Regel 10 beide Sprachen ohnehin
verlangt und der Client sie gleichzeitig braucht (Umschalter). Der Text selbst steht nicht im Vertrag (Konfiguration,
Rechtsprüfung E15 offen; die Oberfläche zeigt ihn als ungeprüft).

**(d) Neue Rechtebezeichner (nur Bezeichner; Vergabe in `ROLE_PERMISSIONS` durch die umsetzende Scheibe, bis dahin
deny by default):** `contribution.claim`, `question.claim` (Übernahme *und* Rückgabe unter einem Recht; wer zurückgeben
darf — nur der Halter — ist ein Guard in der Domäne, kein zweites Recht; 028), `agenda.manage` (fest, 025),
`admin.roles.manage` (fest, 026), `admin.meetings.manage` (Jahrgang anlegen/klonen, 040), `admin.units.manage`
(Fachbereiche, 040), `admin.seats.manage` (Bühnenplätze, 040), `admin.config.freeze` (040). Namensschema wie im
Bestand (`<nomen>.<verb>`), Admin-Rechte unter `admin.*`, weil 088 die TOTP-Pflicht an „`admin.*`" knüpft. Kein
Recht für `/v1/stream` (ADR 0014: Prüfung je Ereignis mit `event.read` wie `listEvents`), keines für
`listMeetings`/`listMeetingStageSeats` (Stammdaten, Festlegung 1 aus 010: jede angemeldete Rolle liest sie), keines
für `/metrics` (kein Akteur, siehe e). `admin.override` (040) ist absichtlich nicht deklariert: in 0.3.0 gibt es keine
Operation, die es braucht; 043 (23.10.) liegt vor 040 (03.11.).

**(e) Ohne Anmeldung (`security: []`): `getHealth` (/healthz), `getReadiness` (/readyz), `login`, `completeLogin`,
`getTransparencyNotice`.** `/metrics` ist durch ein eigenes Schema `metricsBearer` (`http`/`bearer`, statisches Token
aus der Dienstkonfiguration 034) geschützt: der Konsument ist der Scraper, kein Akteur — keine `can()`-Entscheidung,
keine `_actions`, und der Endpunkt gibt nur die fünf fachlichen Kennzahlen aus ADR 0013 aus, nie etwas je Person.
`logout` verlangt `session`; `getSession` (/auth/me) erbt die globale Oder-Liste und liefert in der Demo die
`X-Actor`-Identität. Globales `security` ist `[ {demoActor}, {session} ]`; `session` ist `apiKey`/`cookie`
`hv_session`; `oidc` trägt `x-deprecated: true` plus Satz in der `description` (kein `deprecated`-Feld an
Security-Schemes, `contract:lint` sonst rot). Neue Antwort `Unauthorized` (401) nur an `logout`, `getSession`,
`getMetrics` — die 401-Lücke der Bestandsoperationen ist eine der fünf Lücken aus Review 012 Punkt 18 und bleibt bei 043.

### Abdeckungstabelle (Akzeptanzkriterium 3): Plan 5.4 Zeile 023 → Vertrag → Scheibe → Allowlist

| Punkt der Planzeile | Stelle im Vertrag | Umsetzende Scheibe | Allowlist-Eintrag |
|---|---|---|---|
| `meetingId` auf Speaker, Contribution, Question, Ereignissen | `Speaker.meetingId`, `Contribution.meetingId`, `Question.meetingId`, `Event.meetingId` (optional, „Pflicht ab 0.3.1, Scheibe 028") | 025 (Kern), 028 (Pflicht) | — (Felder) |
| `GET`/`POST /v1/meetings` | `/meetings` → `listMeetings`, `createMeeting`; Schemata `Meeting` (+`format`, `version`, `clonedFromMeetingId`), `MeetingCreate`, `MeetingStatus` | 025 (list), 040 (create/klonen) | listMeetings (025), createMeeting (040) |
| `/v1/meetings/{id}/…` kanonisch, `/v1/meeting` Alias | `/meetings/{meetingId}` + 9 Sammlungspfade; 10 Alias-Operationen `deprecated: true` (Festlegung a) | 025 | getMeetingById, listMeetingAgendaItems, listMeetingUnits, listMeetingSpeakers, registerMeetingSpeaker, reorderMeetingSpeakers, listMeetingContributions, captureMeetingContribution, listMeetingQuestions, getMeetingStage (alle 025) |
| Umschlagfelder schemaVersion, idempotencyKey, causationId, prevHash, hash, recordedAt, occurredAt/occurredAtSource, retentionClass, legalHold, personId | `Event.*` flach (Festlegung b); `OccurredAtSource` (`server \| device \| paper \| transcript`), `RetentionClass`; Eingang der Absenderangabe nur über `MeetingContributionCapture.occurredAt`/`occurredAtSource` (`device \| paper \| transcript`, beide oder keines: `dependentRequired`) an `captureMeetingContribution`; `Contribution.occurredAt`/`occurredAtSource` (Antwort); `source` + `paper` auf `Contribution` (Antwort) und `MeetingContributionCapture`; `ContributionCapture` (Alias) unverändert (Nacharbeit, Punkt 1) | 024 (Kern), 028 (Pflicht) | — (Felder) |
| `Contribution.version` | `Contribution.version` (optional, „Pflicht ab 0.3.1, Scheibe 028"); Antwort `ContributionUpdated` mit ETag | 028 | — |
| If-Match und neue Pflichtfelder zunächst optional mit Ablauf | `IfMatch` unverändert optional, Beschreibung nennt 0.3.1/028 und die `deliverQuestion`-Ausnahme; jedes künftige Pflichtfeld trägt „Pflicht ab 0.3.1, Scheibe 028" (Liste im CHANGELOG) | 028 | — |
| `Meeting.format` presence/hybrid/virtual | `MeetingFormat` (Standard `presence`, „auf Standard gebaut", E20), `Meeting.format`, `MeetingCreate.format` | 023 (Feld), 068 (Auswertung) | — |
| Tagesordnungsereignisse AgendaItemOpened, VotingOpened, VotingClosed | `Event.type` + 3; `AgendaItemEventPayload` gebunden; Operationen `…/agenda-items/{agendaItemId}/opening`, `…/voting/opening`, `…/voting/closure`; `AgendaItem.openedAt/votingOpenedAt/votingClosedAt`; Recht `agenda.manage` | 025 | openAgendaItem, openVoting, closeVoting (025) |
| `POST` claim/release auf Redebeitrag und Einzelfrage | `/contributions/{id}/claim`, `…/release`, `/questions/{id}/claim`, `…/release`; `Claim` auf beiden; Ereignistypen ContributionClaimed/Released, QuestionClaimed/Released; Rechte `contribution.claim`, `question.claim`; `Contribution._actions` | 028 | claimContribution, releaseContribution, claimQuestion, releaseQuestion (028) |
| `/healthz`, `/readyz`, `/metrics` | Pfade mit `servers: /`; `Health`, `Readiness` (200/503, `ReadinessCheckCode` statt Freitext — Nacharbeit, Punkt 7); `/metrics` text/plain hinter `metricsBearer` | 033 (readyz-DB-Teil 027) | getHealth, getReadiness, getMetrics (033) |
| `GET /v1/stream` | `/stream` text/event-stream, `after`, `meetingId`, Header `Last-Event-ID` | 035 | streamEvents (035) |
| Sicherheitsschema `session` (Cookie), `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me` | `securitySchemes.session`; `/auth/login` (302/503), `/auth/callback` (302/400/403/503), `/auth/logout` (204/401), `/auth/me` (`Session`, 200/401); Header-Parameter `CsrfToken` (`X-CSRF-Token`) an allen 34 schreibenden Operationen (Nacharbeit, Punkt 9b); globales `security` Oder-Liste; `oidc` x-deprecated | 029 | login, completeLogin, logout, getSession (029) |
| Admin: Jahrgang anlegen/klonen | `createMeeting` mit `cloneFromMeetingId`; Recht `admin.meetings.manage` | 040 | createMeeting (040) |
| Admin: Fachbereiche | `PUT /meetings/{id}/units` (`UnitInput`), `GET` kanonisch; Recht `admin.units.manage` | 040 | replaceMeetingUnits (040), listMeetingUnits (025) |
| Admin: TOPs | `PUT /meetings/{id}/agenda-items` (`AgendaItemInput`); Recht `agenda.manage` | 040 | replaceMeetingAgendaItems (040) |
| Admin: Bühnenplatzliste je Jahrgang statt Enum, Person und Gerät je Platz | `StageSeat {id, label, personId?, deviceId?, position?}`, `StageSeatInput`; `GET`/`PUT /meetings/{id}/stage-seats`; `Question.seatId` (Antwort; `Classification.seatId` erst mit 0.4.0/043, weil der unveränderte Dienst es heute still verwürfe — Nacharbeit, Punkt 1); `StageAssignment` und beide `stageAssignment`-Felder `deprecated` („veraltet seit 0.3.0, entfällt mit 0.5"); Recht `admin.seats.manage` | 040 (Kern), 056 (Oberfläche) | listMeetingStageSeats, replaceMeetingStageSeats (040) |
| Admin: Rollenzuordnung mit optionaler `unitId` als RoleAssigned/RoleRevoked | `/meetings/{id}/role-assignments` (GET, POST), `…/{assignmentId}/revocation`; `RoleAssignment`, `RoleAssignmentCreate` (`unitId?`, `expiresAt?`, `deputyForSubjectId?`); Ereignistypen + `RoleAssignmentEventPayload` gebunden; `Actor.personId`; Recht `admin.roles.manage` | 026 | listRoleAssignments, assignRole, revokeRole (026) |
| Admin: Konfigurationsfreeze | `POST /meetings/{id}/config-freeze` → `ConfigFreeze`; `Meeting.configFrozenAt/configHash`; Ereignistyp `ConfigFrozen`; R-ADM-01..04 in `Problem.ruleId`; Recht `admin.config.freeze` | 040 | freezeMeetingConfig (040) |
| Transparenzhinweis-Feld für die Anmeldeseite | `GET /auth/transparency-notice` → `TransparencyNotice` (Festlegung c) | 029 (Text), 030 (Anzeige) | getTransparencyNotice (029) |
| Header `X-Server-Time` | `components/headers/X-Server-Time`, an jeder der 65 Operationen auf jeder Antwort referenziert (auch 204/302/4xx/5xx über die geteilten `components/responses`) | 033 (senden), 032 (lesen) | — |
| `counts.byUnit`, `counts.bySeat` auf Meeting | `Meeting.counts.byUnit`, `Meeting.counts.bySeat` (additionalProperties integer) | 040 | — |
| CHANGELOG 0.3.0 | `packages/contract/CHANGELOG.md` `## [0.3.0] - 2026-09-24` mit Added/Changed/Deprecated je Punkt mit Scheibe | 023 | — |
| Allowlist mit Ablauf | `allowlist.json`: 36 Einträge, `expires` 2026-11-25 (M2-Ende 11.11. + 14 Tage), `slice` ∈ {025, 026, 028, 029, 033, 035, 040} | 023 | s. o. |
| Spec Ziel 8: `x-legal-notice` | `info.x-legal-notice` neu: kein Normzitat im Vertrag; `legalRef` an jeder Regel ab 011, Register `docs/legal-trace.md`, alles `verified: false` (E15). 011 lief nicht vorher (kein `docs/legal-trace.md`, keine 011-Spec im Worktree), daher eigener Wortlaut | 023 | — |
| Spec Ziel 7: `Event.payload.pii` mit `keyId` | `PiiEnvelope` (`keyId` Pflicht, additionalProperties), `Event.payload.properties.pii` | 024 | — |

### Neue `operationId`s (Akzeptanzkriterium 5) — alle `expires` 2026-11-25

025: listMeetings, getMeetingById, listMeetingAgendaItems, listMeetingUnits, listMeetingSpeakers, registerMeetingSpeaker,
reorderMeetingSpeakers, listMeetingContributions, captureMeetingContribution, listMeetingQuestions, getMeetingStage,
openAgendaItem, openVoting, closeVoting (14) · 026: listRoleAssignments, assignRole, revokeRole (3) · 028:
claimContribution, releaseContribution, claimQuestion, releaseQuestion (4) · 029: login, completeLogin, logout,
getSession, getTransparencyNotice (5) · 033: getHealth, getReadiness, getMetrics (3) · 035: streamEvents (1) · 040:
createMeeting, replaceMeetingAgendaItems, replaceMeetingUnits, listMeetingStageSeats, replaceMeetingStageSeats,
freezeMeetingConfig (6). Summe 36; 29 + 36 = 65 = Zahl im Vertragstor.

### Typen-Diff (Akzeptanzkriterium 5), `pnpm contract:types`

`packages/contract/src/types.ts`: 2 682 Einfügungen, 546 Löschungen (1 592 → 3 728 Zeilen); zweiter Lauf ohne Diff
(SHA-256 `b6be193cd0ef…` vor und nach dem Lauf). Inhalt: `paths` 29 → 65 Einträge (26 neue Pfade), `operations`
29 → 65; `components.schemas` 26 → 47 (neu: MeetingStatus, MeetingFormat, MeetingCreate, AgendaItemInput, UnitInput,
StageSeat, StageSeatInput, RoleAssignment, RoleAssignmentCreate, ConfigFreeze, Session, TransparencyNotice, Health,
Readiness, SpeakerOrder, OccurredAtSource, RetentionClass, Claim, AgendaItemEventPayload, RoleAssignmentEventPayload,
PiiEnvelope; Nacharbeit: MeetingContributionCapture, ReadinessCheckCode → 49); `components.parameters` 5 → 22
(Nacharbeit: CsrfToken), `headers` 1 → 2, `responses` 6 → 11. `Event` erhält 12 optionale
Umschlagfelder und `payload.pii?`, der Typ bleibt eine flache Struktur ohne `& unknown`; `Meeting` erhält
`format?`, `version?`, `clonedFromMeetingId?`, `configFrozenAt?`, `configHash?`, `counts.byUnit?`, `counts.bySeat?`,
`status` verweist auf `MeetingStatus` (gleiche Werte); `Question`: `stageAssignment?` mit `@deprecated`, neu
`seatId?`, `claim?`, `meetingId?`; `Classification`: `stageAssignment?` mit `@deprecated`, kein `seatId` in 0.3.0
(Nacharbeit, Punkt 1); `Contribution`: `meetingId?`, `version?`, `occurredAt?`, `occurredAtSource?`, `claim?`,
`_actions?`, `source` + `"paper"` (Antwort); `ContributionCapture` unverändert, neu `MeetingContributionCapture`;
`Speaker`: `meetingId?`, `personId?`; `Actor.personId?`;
`Action` 25 → 33 Werte; `Event.type` 18 → 28 Werte. Die zehn Alias-Operationen tragen `@deprecated`. Kein Feld wurde
Pflicht, nichts entfernt; `pnpm -r typecheck` (contract, domain, api, web) grün ohne Änderung an einer anderen Datei.

### `contract:lint` (Ziel 9): 0 Fehler, 6 Warnungen (alle strukturell, akzeptiert)

```
[1] openapi.yaml:1020 #/paths/~1auth~1login/get/responses      Operation must have at least one `2XX` response.
[2] openapi.yaml:1020 #/paths/~1auth~1login/get/responses      Operation must have at least one `4XX` response.
[3] openapi.yaml:1039 #/paths/~1auth~1callback/get/responses   Operation must have at least one `2XX` response.
[4] openapi.yaml:1093 #/paths/~1healthz/get/responses          Operation must have at least one `4XX` response.
[5] openapi.yaml:1106 #/paths/~1readyz/get/responses           Operation must have at least one `4XX` response.
[6] openapi.yaml:1168 #/components/securitySchemes/oidc        Security scheme: "oidc" is never used.
packages/contract/openapi.yaml: validated in 161ms
Woohoo! Your API description is valid. 🎉
You have 6 warnings.
```

Vorher (0.2.1): 1 Warnung (oidc). Neu sind 1–5: `login`/`completeLogin` antworten nur mit 302 (BFF-Weiterleitung,
ADR 0004), Sonden und Weiterleitung haben keinen 4xx-Fall; ein erfundener 2xx/4xx wäre eine falsche Zusage.

### Tor aus Ziel 5: Bauweise und Läufe

Bauweise: `helpers.ts` hängt jede `operationId`, die `matchOperationId` in `req()` trifft und die mit einem
dokumentierten 2xx/3xx unter ihrer deklarierten Basis-URL antwortet (Nacharbeit, Punkte 2 und 6), an eine Trefferdatei je
Prozess in einem Verzeichnis, das `operation-coverage.setup.ts` (Vitest `globalSetup`, `apps/api/vitest.config.ts`)
in `setup()` anlegt und per `project.provide()`/`inject()` an die isolierten Worker gibt. `teardown()` faltet die
Dateien aller Testdateien, liest `allowlist.json` neben `@hv/contract/openapi.yaml` und prüft: jede `operationId` des
Vertrags ausgeübt oder deklariert; kein deklarierter Eintrag ausgeübt. Vitest protokolliert einen Teardown-Fehler nur
(„error during close", Exit 0), deshalb setzt das Tor selbst `process.exitCode = 1`. Gefilterte Läufe (`vitest run
negative`) und Läufe mit Testfehlern überspringen mit Hinweis statt still. Das `test`-Skript bleibt `vitest run`.
Bestand: alle 29 Operationen von 0.2.1 werden schon von `req()` getroffen (erster Lauf des Tors vor der
Vertragsänderung: „29 operations in the contract, 29 exercised by tests, 0 pre-declared … ok"); kein Aufruf war zu
ergänzen. Der Kommentar des `>= 29`-Sanity-Tests in `contract.test.ts` verweist jetzt auf das Tor statt selbst
Abdeckung zu behaupten.

**Roter Lauf 1 — neue Operationen ohne Allowlist-Eintrag** (Vertrag 0.3.0, `allowlist.json` noch `[]`; wörtlich,
Stacktrace-Zeilen entfernt):

```
 Test Files  5 passed (5)
      Tests  49 passed (49)
operation-coverage: 65 operations in the contract, 29 exercised by tests, 0 pre-declared in allowlist.json
  FAIL  "claimContribution" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "releaseContribution" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "claimQuestion" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "releaseQuestion" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "streamEvents" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "listMeetings" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "createMeeting" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "getMeetingById" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "listMeetingAgendaItems" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "replaceMeetingAgendaItems" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "openAgendaItem" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "openVoting" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "closeVoting" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "listMeetingUnits" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "replaceMeetingUnits" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "listMeetingStageSeats" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "replaceMeetingStageSeats" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "listRoleAssignments" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "assignRole" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "revokeRole" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "freezeMeetingConfig" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "listMeetingSpeakers" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "registerMeetingSpeaker" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "reorderMeetingSpeakers" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "listMeetingContributions" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "captureMeetingContribution" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "listMeetingQuestions" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "getMeetingStage" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "login" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "completeLogin" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "logout" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "getSession" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "getTransparencyNotice" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "getHealth" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "getReadiness" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
  FAIL  "getMetrics" is neither exercised by a test (no req() call reaches it) nor pre-declared in packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).
operation-coverage: 36 failure(s)
error during close Error: operation-coverage gate: 36 failure(s) (see above)
exit=1
```

**Roter Lauf 2 — Allowlist-Eintrag, der zugleich ausgeübt ist** (`getMeeting` lokal an die fertige Allowlist
angehängt, danach zurückgesetzt, `cmp` gegen die gute Kopie identisch):

```
operation-coverage: 65 operations in the contract, 29 exercised by tests, 37 pre-declared in allowlist.json
  FAIL  "getMeeting" is pre-declared in allowlist.json (slice 023, expires 2026-11-25) but a test exercises it — the entry is overdue, remove it.
operation-coverage: 1 failure(s)
error during close Error: operation-coverage gate: 1 failure(s) (see above)
exit=1
```

**Roter Lauf 3 — abgelaufener Allowlist-Eintrag** (Akzeptanzkriterium 4; `streamEvents` lokal auf `expires`
2026-09-01 gesetzt, `pnpm --filter @hv/contract test`, danach zurückgesetzt):

```
  ok    (b) CHANGELOG.md has a section for 0.3.0
  ok    (c) openapi.yaml changed against merge base d4c7393; version 0.2.1 -> 0.3.0
  FAIL  (d) allowlist[29] operationId "streamEvents" expired on 2026-09-01 (today 2026-09-24, slice 035) — implement it or remove it from the contract
contract gate: 1 failure(s)
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @hv/contract@0.3.0 test: `node scripts/check.mjs`
Exit status 1
exit=1
```

Nebenbefund aus dem Tor-Bau, lokal geprüft: gefilterter Lauf `vitest run negative` → „operation-coverage: skipped —
filtered run (1 of 5 test files); only a full run proves coverage.", Exit 0.

**Grüner Lauf** (`pnpm exec vitest run` in `apps/api`, Allowlist mit 36 Einträgen):

```
 Test Files  5 passed (5)
      Tests  49 passed (49)
operation-coverage: 65 operations in the contract, 29 exercised by tests, 36 pre-declared in allowlist.json
operation-coverage: ok — every operationId is exercised by a test or pre-declared in the allowlist.
exit=0
```

**Vertragstor grün** (`pnpm --filter @hv/contract test`; mit `CONTRACT_GATE_STRICT=1` identisch):

```
contract gate: packages/contract/openapi.yaml (info.version 0.3.0, 65 operations)
  ok    (a) info.version 0.3.0 = package.json version
  ok    (b) CHANGELOG.md has a section for 0.3.0
  ok    (c) openapi.yaml changed against merge base d4c7393; version 0.2.1 -> 0.3.0
  ok    (d) allowlist.json well-formed, 36 pre-declared operation(s), none expired (today 2026-09-24)
contract gate: ok
```

### `pnpm gates` (Exit 0, Commit a35291c; Zeilen desselben Laufs, dann das Ende wörtlich)

```
packages/contract test: contract gate: packages/contract/openapi.yaml (info.version 0.3.0, 65 operations)
packages/contract test: contract gate: ok
packages/domain test:  Test Files  5 passed (5)
packages/domain test:       Tests  72 passed (72)
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  48 passed (48)
apps/api test:  Test Files  5 passed (5)
apps/api test:       Tests  49 passed (49)
apps/api test: operation-coverage: 65 operations in the contract, 29 exercised by tests, 36 pre-declared in allowlist.json
apps/api test: operation-coverage: ok — every operationId is exercised by a test or pre-declared in the allowlist.
vocabulary-check: ok
x 7 dependency violations (0 errors, 7 warnings). 137 modules, 504 dependencies cruised.   <- Bestand (apps/web features)
i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.
slice-scope: 10 changed file(s), all within "docs/slices/023-vertrag-0-3-0-fundament.md"'s "Files allowed" list (12 pattern(s)).
plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
plan-graph: ok.
1..196
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11849.98315

> @hv/web@0.0.0 build /home/user/wt/023/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-D5Ngkhre.css                        39.95 kB │ gzip:   8.66 kB
dist/assets/index-BoqUekbh.js                        532.22 kB │ gzip: 156.05 kB │ map: 2,200.90 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.62s
mark-test-run: wrote /home/user/wt/023/.claude/state/last-test-run (clean tree) at commit a35291c, tree d28de2d2ca05…
gates exit=0
```

`node scripts/slice-scope.mjs` (einzeln): `slice-scope: 10 changed file(s), all within
"docs/slices/023-vertrag-0-3-0-fundament.md"'s "Files allowed" list (12 pattern(s)).` Exit 0. Das Ende von
`pnpm gates` stammt vom Stand vor dem Bericht-Commit; der Bericht ändert nur diese Datei, die schnellen
Dokumententore (slice-scope, downgrade-check, plan-honesty, vocabulary) liefen danach noch einmal grün.

### Neue Begriffe für die nächste Glossar-Kleinänderung (nicht in dieser Scheibe)

Jahrgang (meeting, `meetingId`; Alias „aktuelle HV" = `/v1/meeting`) · Bühnenplatz (podium seat, `StageSeat`,
`seatId`; Glossarzeile existiert ohne Code-Spalte, jetzt „ab 0.3.0 im Vertrag, Kern 040") · Aufbewahrungsklasse
(retention class, `RetentionClass`) · Übernahme (claim, `Claim`, `contribution.claim`, `question.claim`) ·
Rollenzuordnung (role assignment, `RoleAssignment`) · Konfigurationsfreeze (configuration freeze, `ConfigFreeze`,
`ConfigFrozen`) · Transparenzhinweis (transparency notice, `TransparencyNotice`) · Umschlag (event envelope,
`Event.*`, `PiiEnvelope`) · Absenderangabe der Zeit (`occurredAt`/`occurredAtSource`) gegenüber maßgeblicher Zeit
(`recordedAt`) · Sitzung (session, `session`-Cookie, `Session`).

### Offen (mit Grund)

- **025 braucht für seinen HTTP-Nachweis „paper mit früherem occurredAt und Grund → 201 mit lateEntry" drei kleine
  Vertragsfelder, die 023 bewusst nicht enthält:** `ContributionCapture.lateEntryReason` (Pflichtgrund),
  `Contribution.lateEntry` (Kennzeichen) und ein Schluss-der-Debatte-Zeitpunkt (`Meeting.debateClosedAt` samt
  Ereignistyp; die Aktion `debate.close` liegt laut Plan in 0.4.0/043). Grund für das Weglassen: nicht in Plan-Zeile
  023, und 043 (23.10.) liegt nach 025 (15.10.), 025 hat aber keine Vertragslane. Vorschlag an den Orchestrator:
  Kleinänderung (takt) vor 025 mit genau diesen drei optionalen Feldern plus Ereignistyp `DebateClosed` — oder 025
  weist R-MTG-03 auf Domänenebene nach und die Felder kommen mit 043. Eingang der Absenderzeit (`occurredAt`,
  `occurredAtSource`, `source: paper`) ist in 0.3.0 bereits vorhanden.
- **Ereignistypen, die 040 für Stammdatenänderungen emittieren wird** (Fachbereiche, TOPs, Bühnenplätze,
  Jahrgangs-Lebenszyklus preparation→running→closed) sind nicht deklariert, weil Plan-Zeile 023 nur die drei
  Tagesordnungsereignisse nennt und 040 ihre Form festlegt; `Event.type` ist ein geschlossenes Enum, die Typen müssen
  daher mit 043 (vor 040) in den Vertrag. Gleiches gilt für Lebenszyklus-Operationen (040 „Meeting-Lebenszyklus-
  Aktionen") und `admin.override`.
- **Meeting-Konfigurationsfelder** `podiumVisibility` (ADR 0006, 047), `pseudonymiseForUnits` (026), `notes` (046)
  fehlen absichtlich: nicht in Zeile 023; 043 ist der Ort.
- **Deklariert, aber nicht gebunden:** die Payloads von ContributionClaimed/Released, QuestionClaimed/Released und
  ConfigFrozen bleiben offene Objekte (028/040 legen die Form fest); gebunden sind nur QuestionLegalCleared (0.2.0),
  die drei Tagesordnungsereignisse und RoleAssigned/RoleRevoked, deren Form Spec bzw. ADR vorgeben.
- **Alias-Deprecation und 030:** weil die zehn Alias-Operationen `deprecated` sind, muss der generierte Client (030)
  die kanonischen Operationen benutzen und die aktuelle HV über `listMeetings?status=running` (oder bis 0.5 über den
  Alias `getMeeting`) auflösen. Die Oberfläche der Demo spricht `HvApi` in-process und ist nicht betroffen.
- **`matchOperationId` (`apps/api/src/contractSchema.ts`) schneidet nur `/v1` ab.** Für `/healthz`, `/readyz`,
  `/metrics`, `/auth/*` passt das (Pfadschlüssel ohne Präfix, Tests rufen sie direkt auf); 025 montiert die
  kanonischen Routen zusätzlich, ohne dass sich hier etwas ändern muss. Nicht Teil dieser Scheibe.
- **Vitest-Verhalten als Randnotiz für Reviewer:** ein Fehler im `globalSetup`-Teardown setzt den Exit-Code nicht
  (nur „error during close"); das Tor setzt deshalb `process.exitCode = 1` selbst und wirft zusätzlich, damit die
  Meldung in der Vitest-Ausgabe erscheint. Belegt durch die roten Läufe oben (`exit=1`).
- **Service-Lane-Lücke (Nacharbeit, Punkt 3):** 27 der 36 Allowlist-Einträge (025: 14, 026: 3, 028: 4, 040: 6) nennen
  Scheiben, die laut Plan 5.1 keine Lane `service` halten und deshalb keine Route in `apps/api/src` montieren
  können — sie könnten ihre Einträge nie zurückziehen, und am 2026-11-25 würde `check.mjs` den Integrationsbranch
  rot machen. Das `reason`-Feld benennt das jetzt; die Planänderung (Lane service für 025/026/028/040) ist Sache
  des Orchestrators (takt-011), `docs/produktplan-beta.md` liegt außerhalb der erlaubten Dateien.
- **Nach 0.4.0 (043) verschoben, weil der unveränderte Dienst sie sonst heute schon wirksam hätte (Nacharbeit,
  Punkt 1):** `Classification.seatId` (vor 040) und der `meetingId`-Filter an `listEvents` (vor 035). Der Papierpfad
  und die Absenderzeit sind nur über `captureMeetingContribution` (`MeetingContributionCapture`) erreichbar; der
  Alias `captureContribution` bleibt bei `manual | transcript`.
- **Für die Spec von 024 (Letzte Kleinrunde, Punkt c):** `Event.schemaVersion` hat ab jetzt `minimum: 2`, und
  `schemaVersion` verlangt sieben Felder (`prevHash`, `hash`, `recordedAt`, `occurredAt`, `occurredAtSource`,
  `retentionClass`, `legalHold`). Der Upcaster von 024 muss für alte v1-Ereignisse aus JSONL-Entwicklungsdaten also
  **alle sieben** synthetisieren — einschließlich `hash` und `prevHash` (Kette beim Laden neu berechnen) — und
  `actor.displayName` entfernen, sonst ist kein hochgestuftes Ereignis über HTTP vertragsgültig.
- `oidc` bleibt als unbenutztes, `x-deprecated` Schema (1 Lint-Warnung, Bestand seit 0.1.0) bis 0.5.
- Glossar, Rechtekonzept, DSFA: Nachführung durch den Orchestrator (Nicht-Ziel); Begriffsliste oben.

### Nacharbeit nach Review und Codex (24.09.2026; Opus: 3 major, 6 minor, 1 nit; Codex: 2 P1 an PR #25)

Version bleibt 0.3.0; alles additiv; Dateien innerhalb „Files allowed"; kein Dienst-Code geändert.

**Änderungen je Punkt**

1. *Live-Erweiterung bestehender Operationen (major).* Der Dienst validiert jede Anfrage gegen den Vertrag
   (`apps/api/src/validate.ts`), also war die erste Fassung an drei Stellen sofort wirksam. Behoben: `source: paper`,
   `occurredAt`, `occurredAtSource` liegen nur noch auf dem neuen Schema `MeetingContributionCapture` (Body von
   `captureMeetingContribution`); `ContributionCapture` (Alias) ist wieder exakt 0.2.1 (`manual | transcript`).
   `Classification.seatId` und der `meetingId`-Filter an `listEvents` sind entfernt und nach 0.4.0 (043, vor 040
   bzw. 035) verschoben; `Question.seatId` (Antwort) und der Filter an `streamEvents` (neue Operation) bleiben.
   Codex P1 (`occurredAt` ohne `occurredAtSource`): `dependentRequired` in beide Richtungen auf
   `MeetingContributionCapture`; Ajv 2020 (der Validator des Dienstes) setzt es durch, redocly akzeptiert es,
   openapi-typescript rendert beide Felder als optional (ein Typ kann die Abhängigkeit nicht ausdrücken; ein
   `if/then` könnte es genauso wenig). Verbleibende sichtbare Erweiterungen stehen im CHANGELOG unter „Changed →
   Compatibility": Antwort-Enums (`Action` +8, `Event.type` +10, `Contribution.source` +`paper`), optionale
   Antwortfelder, der optionale Header `X-CSRF-Token` an 16 Bestandsoperationen (reiner String, heute ignoriert),
   dokumentierte, noch nicht erzeugte Status (404 an den Aliassen, 409 an `registerSpeaker`/`captureContribution`,
   Header `X-Server-Time`). Die Behauptung „alle 29 Bestandsrouten unverändert" oben ist korrigiert.
2. *Tor zählt Phantomtreffer (major).* `helpers.ts` zeichnet erst nach der Statusprüfung auf und nur für einen
   dokumentierten 2xx/3xx; ein ausgenommenes 401 und jede 4xx/5xx — also auch die 404 des Not-found-Fallbacks —
   zählen nie. Antworten ohne `content` (204/302) verlangen einen leeren Body. Rot/grün unten.
3. *Allowlist ohne Service-Lane (major).* Die 27 Einträge von 025/026/028/040 tragen im `reason` den Hinweis auf
   die fehlende Lane und die Planänderung takt-011; `slice` bleibt der fachliche Eigentümer. Lücke unter „Offen".
4. *Enum-Erweiterungen als Risiko benannt (minor).* Regel „unbekannte Enum-Werte und unbekannte optionale Felder
   ignorieren" plus die Liste der Erweiterungen in `info.description` („Compatibility") und im CHANGELOG.
5. *`-t`-Filter (minor).* `operation-coverage.setup.ts` überspringt, wenn `globalConfig.testNamePattern` gesetzt ist
   (Lauf unten: `-t 401` → „skipped — test-name filter").
6. *Basis-URL (minor).* `helpers.ts` prüft den Präfix gegen die `servers`-Angabe der Operation (`/` für
   `/healthz`, `/readyz`, `/metrics`, `/auth/*`, sonst `/v1`); ein Aufruf unter der falschen Basis ist ein Testfehler,
   kein Treffer.
7. *`/readyz`-Freitext (minor).* `Readiness.checks.*.detail` ersetzt durch `code` (`ReadinessCheckCode`:
   `not_configured | unreachable | timeout | migrations_pending | clock_unsynced | clock_drift`); kein Freitext auf
   einem Endpunkt ohne Anmeldung.
8. *409 am Alias (minor).* `registerSpeaker` und `captureContribution` dokumentieren 409 wie ihre kanonischen
   Gegenstücke (gemeinsamer Handler, R-MTG in 025 ohne weiteren Vertragszyklus).
9. *Zwei Definitionslücken (minor).* (a) „Aktuelle HV" hinter `/meeting`: die laufende HV mit dem spätesten `date`
   (mehrere laufend: spätestes `date`, Gleichstand: spätestes `MeetingCreated`); läuft keine, die HV mit dem spätesten
   `date` unabhängig vom Status; existiert keine, 404 — jetzt an allen zehn Alias-Operationen dokumentiert
   (`getMeeting` liefert es heute schon vor dem ersten Seed; die Ausnahme in `helpers.ts` entfällt). (b) Codex P1
   CSRF: `components/parameters/CsrfToken`, Header `X-CSRF-Token`, optional, referenziert von allen 34 schreibenden
   Operationen einschließlich `logout` (nicht `seedDemo`, demo-only). Name: Double-Submit-Konvention der gängigen
   Frameworks und des OWASP-Cheat-Sheets, damit kein Client-Bibliothek konfiguriert werden muss; ein Custom-Header
   kann von einem fremden Formular nicht gesetzt werden und erzwingt bei Skripten einen CORS-Preflight. Unter
   `session` ab 029 Pflicht (403, Regel-ID dort), unter `demoActor` ignoriert. Schema `{ type: string }` ohne
   `maxLength`, damit keine heutige Anfrage neu scheitern kann.
10. *Unauthorized-Wortlaut (nit).* Nennt jetzt genau `logout`, `getSession`, `getMetrics`.

`contract:lint`: unverändert 0 Fehler, dieselben 6 Warnungen (login 2xx/4xx, callback 2xx, healthz 4xx, readyz 4xx,
oidc unused). `pnpm contract:types`: +112/−20 gegenüber a35291c (34× `X-CSRF-Token?`, 10× `404`, 2× `409`,
`MeetingContributionCapture`, `ReadinessCheckCode`, `Classification.seatId` und `Readiness…detail` entfallen),
zweiter Lauf ohne Diff (SHA-256 `a1a99d69bd36…`). Vertragstor (a)–(d) grün, auch mit `CONTRACT_GATE_STRICT=1`.

**Punkt 2 — rot, dann grün** (Scratch-Test `zz-scratch-review-023.test.ts`: `GET /v1/meetings/x/speakers` als admin,
Route nicht montiert, Not-found-Fallback antwortet 404; danach gelöscht, nicht committet)

Rot (alte `helpers.ts`, Scratch-Test vorhanden):

```
 Test Files  6 passed (6)
      Tests  50 passed (50)
operation-coverage: 65 operations in the contract, 30 exercised by tests, 36 pre-declared in allowlist.json
  FAIL  "listMeetingSpeakers" is pre-declared in allowlist.json (slice 025, expires 2026-11-25) but a test exercises it — the entry is overdue, remove it.
operation-coverage: 1 failure(s)
error during close Error: operation-coverage gate: 1 failure(s) (see above)
exit=1
```

Grün (neue `helpers.ts`, derselbe Scratch-Test noch vorhanden — der Phantomtreffer zählt nicht mehr):

```
 Test Files  6 passed (6)
      Tests  50 passed (50)
operation-coverage: 65 operations in the contract, 29 exercised by tests, 36 pre-declared in allowlist.json
operation-coverage: ok — every operationId is exercised by a test or pre-declared in the allowlist.
exit=0
```

Punkt 5, `vitest run -t 401`: `Tests  3 passed | 46 skipped (49)` — `operation-coverage: skipped — test-name filter
(-t /401/) set; only a full run proves coverage.`, exit 0. Voller Lauf ohne Scratch: 5 Dateien, 49 Tests, 29/36, ok.

**Punkt 1 — Live-Probe gegen den unveränderten Dienst** (`createApp({ demoEnabled: true })` per tsx, Seed 20 Fragen,
`X-Actor: admin:admin`; Ausgabe wörtlich, `speakerId` gekürzt):

```
POST /v1/contributions {"speakerId":"…","text":"Papierblatt","source":"paper","occurredAt":"2099-01-01T00:00:00Z"} -> 422 {"type":"urn:hv:problem:422","title":"Unprocessable","status":422,"detail":"Request body: /source must be equal to one of the allowed values"}
POST /v1/contributions {"speakerId":"…","text":"Papierblatt","source":"paper"} -> 422 {"type":"urn:hv:problem:422","title":"Unprocessable","status":422,"detail":"Request body: /source must be equal to one of the allowed values"}
POST /v1/contributions {"speakerId":"…","text":"Papierblatt","source":"paper","occurredAt":"2026-09-24T09:00:00Z","occurredAtSource":"paper"} -> 422 {"type":"urn:hv:problem:422","title":"Unprocessable","status":422,"detail":"Request body: /source must be equal to one of the allowed values"}
POST /v1/contributions {"speakerId":"…","text":"Manuell erfasst","source":"manual"} -> 201 {"id":"d82c369b-0cf6-4060-80b7-01b20f23f757","speakerId":"sp-00002","text":"Manuell erfasst","capturedAt":"2026-09-24T01:29:53.687Z","source":"manual","questionIds":[],"coverage":{"coveredRatio":0,"uncovered":[{"start":0
POST /v1/meetings/x/contributions (not mounted) -> 404 {"type":"urn:hv:problem:404","title":"Not found","status":404,"detail":"No such route."}
GET /v1/events?meetingId=no-such-meeting&limit=2 -> 200 (items: 2; the filter is not declared in 0.3.0 any more, the service ignores unknown query parameters)
```

`dependentRequired` durch den Validator des Dienstes (`requestBodyValidator` aus `apps/api/src/contractSchema.ts`,
derselbe Pfad wie `validate.ts`; die kanonische Route montiert erst 025):

```
captureMeetingContribution {"speakerId":"s","text":"t"} -> valid
captureMeetingContribution {"speakerId":"s","text":"t","source":"paper"} -> valid
captureMeetingContribution {"speakerId":"s","text":"t","occurredAt":"2026-09-24T09:00:00Z"} -> ["(root) must have property occurredAtSource when property occurredAt is present"]
captureMeetingContribution {"speakerId":"s","text":"t","occurredAtSource":"paper"} -> ["(root) must have property occurredAt when property occurredAtSource is present"]
captureMeetingContribution {"speakerId":"s","text":"t","occurredAt":"2026-09-24T09:00:00Z","occurredAtSource":"server"} -> ["/occurredAtSource must be equal to one of the allowed values"]
captureMeetingContribution {"speakerId":"s","text":"t","source":"paper","occurredAt":"2026-09-24T09:00:00Z","occurredAtSource":"paper"} -> valid
captureContribution (alias) {"speakerId":"s","text":"t","source":"paper"} -> ["/source must be equal to one of the allowed values"]
```

**`pnpm gates` nach der Nacharbeit** (Exit 0; gelaufen auf dem fertigen Arbeitsbaum vor den drei Nacharbeits-Commits,
deshalb „at commit ecc728f" mit Signatur des geänderten Baums; danach änderte sich nur diese Datei. Zeilen desselben
Laufs, dann das Ende wörtlich):

```
packages/contract test: contract gate: packages/contract/openapi.yaml (info.version 0.3.0, 65 operations)
packages/contract test: contract gate: ok
packages/domain test:  Test Files  5 passed (5)
packages/domain test:       Tests  72 passed (72)
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  48 passed (48)
apps/api test:  Test Files  5 passed (5)
apps/api test:       Tests  49 passed (49)
apps/api test: operation-coverage: 65 operations in the contract, 29 exercised by tests, 36 pre-declared in allowlist.json
apps/api test: operation-coverage: ok — every operationId is exercised by a test or pre-declared in the allowlist.
vocabulary-check: ok
x 7 dependency violations (0 errors, 7 warnings). 137 modules, 504 dependencies cruised.   <- Bestand (apps/web features)
i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.
slice-scope: 10 changed file(s), all within "docs/slices/023-vertrag-0-3-0-fundament.md"'s "Files allowed" list (12 pattern(s)).
plan-graph: ok.
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7174.130631

> @hv/web@0.0.0 build /home/user/wt/023/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-D5Ngkhre.css                        39.95 kB │ gzip:   8.66 kB
dist/assets/index-BoqUekbh.js                        532.22 kB │ gzip: 156.05 kB │ map: 2,200.90 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.16s
mark-test-run: wrote /home/user/wt/023/.claude/state/last-test-run (signature 368621ecbb82…) at commit ecc728f, tree ff311a1a1abc…
gates exit=0
```

`node scripts/slice-scope.mjs` (einzeln, nach der Nacharbeit): `slice-scope: 10 changed file(s), all within
"docs/slices/023-vertrag-0-3-0-fundament.md"'s "Files allowed" list (12 pattern(s)).` Exit 0.

### Commits auf `claude/slice-023-vertrag` (nicht gepusht)

1. `9638430 test(api): Tor „jede operationId ausgeübt oder deklariert" als Vitest-globalSetup (Scheibe 023) [skip netlify]`
2. `a35291c feat(contract): Vertragspaket 0.3.0 Fundament, rein additiv, 36 Operationen vorab deklariert (Scheibe 023) [skip netlify]`
3. `ecc728f docs: Bericht Scheibe 023 mit Festlegungen, Abdeckungstabelle, roten und grünen Läufen (Scheibe 023) [skip netlify]`
4. `71cb6df test(api): Tor zählt nur dokumentierte 2xx/3xx unter der deklarierten Basis-URL, -t-Filter überspringt (Scheibe 023, Nacharbeit) [skip netlify]`
5. `beae5bb fix(contract): 0.3.0 ohne Live-Erweiterung bestehender Anfragen — MeetingContributionCapture, X-CSRF-Token, ReadinessCheckCode, 404/409 am Alias (Scheibe 023, Nacharbeit) [skip netlify]`
6. Bericht (diese Datei): `docs: Bericht Scheibe 023 — Nacharbeit nach Review und Codex (Scheibe 023) [skip netlify]`

### Invarianten-Durchgang nach Codex (Runde 5)

(Opus 5.5, 24.09.2026, Übernahme eines abgebrochenen Laufs: der vorige Bauer hinterließ uncommittete Änderungen an
`openapi.yaml`, `CHANGELOG.md`, `types.ts`; geprüft, übernommen, an drei Stellen korrigiert — siehe „Korrekturen am
übernommenen Stand".) Version bleibt 0.3.0; keine Anfrage einer bestehenden Operation geändert; Antworten bestehender
Operationen nur dort enger, wo der heutige Dienst schon passt (Live-Probe und die ganze API-Suite unten). Dateien:
nur `openapi.yaml`, `types.ts` (generiert), `CHANGELOG.md`, diese Datei.

**Die vier P1 aus Runde 5**

1. *Klarname im Ereignisakteur.* Probe des heutigen Dienstes (`createApp({ demoEnabled: true })`, Seed 20 Fragen):
   `293 events, 293 with actor.displayName, 0 with schemaVersion` — jedes Ereignis trägt ihn (die Demo-Akteure aus
   `seed.ts`). Ein Verbot jetzt bräche `listEvents`/`getQuestionHistory`. Deshalb: neues Schema `EventActor` für
   `Event.actor` (`Actor` bleibt für Projektionen), `displayName` `deprecated: true`, „entfällt mit Scheibe 024". Das ist
   durchgesetzt, nicht nur angekündigt: `Event.dependentSchemas.schemaVersion` verbietet `actor.displayName`
   (`properties: { displayName: false }`) auf jedem Umschlag-v2-Ereignis — also verschwindet er mit 024 vom Draht,
   aus dem Schema mit 0.5 (ADR 0015). CHANGELOG: Added und Deprecated.
2. *Sitzung ohne Token.* `Session` = `oneOf` `DemoSession` | `SignedInSession`, `discriminator` auf `scheme`
   (`demoActor` | `session`, je `const` und Pflicht, damit genau ein Zweig passt). `SignedInSession` verlangt
   `subjectId`, `roles` (≥ 1), `expiresAt`, `csrfToken` (`minLength: 1`). `DemoSession` verbietet `csrfToken` und
   `expiresAt` (`false`), `roles` genau ein Eintrag. `getSession` ist nicht montiert (029), keine heutige Antwort
   betroffen. Nicht Schema: dass die Variante zum tatsächlich benutzten Sicherheitsschema passt (Grund unten).
3. *`/readyz` ohne Pflichtprüfungen.* Planreihenfolge geprüft: 027 (19.10., „/readyz prüft ab hier DB und
   Migrationsstand") vor 033 (26.10.). `Readiness.checks` hat jetzt `properties` `clock`, `db`, `migrations`, alle
   `required`, `additionalProperties: false` (ersetzt `propertyNames`, gleiche Wirkung, und der Typ wird
   `{ clock; db; migrations }` statt Index-Signatur). `ReadinessCheck`: `ok` ohne `code`, `fail` mit `code`. Die 200
   bindet jede Prüfung an `ok`, die 503 mindestens eine an `fail`. Für den JSONL-Entwicklungsadapter, den 027 behält,
   steht in `Readiness.description`, was `db`/`migrations` melden (sonst wäre jeder Dev-Dienst dauerhaft 503).
4. *Zeitpaar am Umschlag.* `Event.dependentRequired`: `occurredAt` ↔ `occurredAtSource`, dazu `hash` ↔ `prevHash`
   (das erste Ereignis trägt `prevHash: ""`, laut Beschreibung — die Paarung hält also auch für `seq` 1) und
   `schemaVersion` → `prevHash`, `hash`, `recordedAt`, `occurredAt`, `occurredAtSource`, `retentionClass`, `legalHold`.

**Korrekturen am übernommenen Stand**

- `schemaVersion` → `meetingId` gestrichen: 024 schreibt den v2-Umschlag, `meetingId` kommt erst mit 025 in den Kern
  (Plan 5.4: „meetingId überall im Kern" steht bei 025). Die Abhängigkeit hätte 024 gezwungen, gegen den Vertrag zu
  verstoßen. `meetingId` wird mit 0.3.1 (028) ohnehin Pflicht.
- `EventActor.displayName` war nur als „ab 024 nicht mehr gesendet" beschrieben → jetzt per `dependentSchemas`
  erzwungen (siehe 1).
- `not: { required: [x] }` (13 neue Lint-Warnungen `no-required-schema-properties-undefined`) → `x: false`: gleiche
  Wirkung in Ajv, 0 neue Warnungen, und openapi-typescript erzeugt `x?: never`.
- `DemoSession` hätte `subjectId` verbieten sollen — verworfen, denn `RoleAssignment.subjectId` ist ausdrücklich auch
  „the demo actor id".
- Veralteter Verweis `Session.csrfToken` in `CsrfToken` → `SignedInSession.csrfToken`.

**Durchgang über jedes in 0.3.0 neue oder geänderte Schema und jede Operation** — Klassen: (a) Paarfelder,
(b) Pflicht je Modus/Variante, (c) Wert muss zu HTTP-Status oder anderem Feld passen, (d) Personendaten gegen ADR
0009/0011, (e) in Prosa versprochene Abdeckung.

| Stelle | Klasse | Ergebnis |
|---|---|---|
| `Event` Umschlag | a, b | P1 4 oben; `meetingId` bewusst nicht an `schemaVersion` |
| `Event.actor` / `EventActor` | d | P1 1 oben |
| `Event.payload` außerhalb `pii` | d | Prosa: `SpeakerRegistered.displayName` (Pseudonym) ist 0.2-Nutzlast, ein Verbot bräche heutige Antworten; 026 hat den Test „kein displayName in Ereignis-Payloads" |
| `Event.personId`, `Actor.personId`, `Speaker.personId`, `Claim.personId`, `StageSeat.personId` | d | Schlüssel, kein Name — unverändert |
| `AgendaItemEventPayload` | e | `number` Pflicht (`minimum: 1`): das Feld existiert für Leser ohne Stammdaten, optional hilft es genau denen nicht |
| `RoleAssignmentEventPayload` | b, e | geteilt in `RoleAssignedPayload` und `RoleRevokedPayload`, je mit `false` für die Felder des anderen Typs; `deputyForSubjectId` ergänzt, weil `RoleAssignment` es aus dem Ereignis projiziert, das Ereignis es aber nicht trug |
| `RoleRevokedPayload.reason`, `revokeRole`-Body `reason` | d | Prosa: Freitext kann nicht auf Personendaten geprüft werden; Beschreibung verlangt es |
| `Contribution` | a | `occurredAt` ↔ `occurredAtSource` (wie `MeetingContributionCapture`) |
| `MeetingContributionCapture` | a, b | Paar bestand schon; `source: paper` verlangt *nicht* `occurredAt` (Pflicht nur für die Nacherfassung nach Schluss, zustandsabhängig, R-MTG-03 in 025) |
| `Meeting` | a | `configFrozenAt` ↔ `configHash` |
| `AgendaItem` | a | `votingOpenedAt` → `openedAt` (so sagt es `openVoting`: „409 when the item is not open"), `votingClosedAt` → `votingOpenedAt`; die Reihenfolge der Zeitpunkte bleibt Prosa |
| `RoleAssignment` | a | `revokedAt` ↔ `revokedBy` |
| `Question.stageAssignment` / `seatId` | c | `if` beide vorhanden `then` gleicher Wert (vier `const`-Paare); ein anderer Platz trägt nur `seatId`; heute setzt der Dienst `seatId` nie |
| `Claim` | c | Prosa: `expiresAt` nach `claimedAt` |
| `Session` / `DemoSession` / `SignedInSession` | b, c | P1 2 oben; `DemoSession.roles` = `[actor.role]` bleibt Prosa |
| `Readiness` / `ReadinessCheck` / `/readyz` 200, 503 | b, c, d, e | P1 3 oben; Codes statt Freitext bestanden schon |
| `Problem` in allen geteilten Fehlerantworten (401, 403, 404, 409, 412, 422, 503) und `completeLogin` 400 | c | `status` per `const` an den HTTP-Status gebunden. Der Dienst baut den HTTP-Status aus `problem.status` (`apps/api/src/problem.ts`), also passt jede heutige Antwort; Live-Probe 403/404/409/422 unten |
| `ServiceUnavailable`, `completeLogin` 400/403, `getTransparencyNotice` 404 (ohne Anmeldung) | d | Prosa: `detail` ein fester Satz, nie Host, Treiber- oder IdP-Fehlertext, nie Subjekt oder E-Mail; ein Schema kann Freitext nicht prüfen |
| `TransparencyNotice` | e | `version`, `text.de`, `text.en` `minLength: 1` (Regel 10: zwei Sprachen, nie leer) |
| `login`, `completeLogin` 302 | e | `Location` `required: true` |
| `ETag` an `createMeeting`, `getMeetingById`, `replaceMeetingAgendaItems`/`Units`/`StageSeats`, `freezeMeetingConfig`, `AgendaItemUpdated`, `ContributionUpdated` | e | neuer Header `ETagRequired` (`required: true`), weil die Beschreibungen ein ETag versprechen und der nächste Schreibaufruf es als `If-Match` braucht; die 0.2-Antworten behalten das optionale `ETag` |
| `X-Server-Time` | e | bleibt optional: heute nicht gesendet, an bestehenden Antworten wäre Pflicht eine Verengung, die der Dienst nicht erfüllt (033) |
| `X-CSRF-Token` | b | bleibt optional: OpenAPI kann einen Header nicht für ein einziges Sicherheitsschema zur Pflicht machen; `CsrfToken.description` sagt es |
| `MeetingCreate`, `AgendaItemInput`, `UnitInput`, `StageSeatInput`, `RoleAssignmentCreate` | a–e | nichts zu binden; Eindeutigkeit von `number`/`id` in einer Liste ist mit `uniqueItems` nicht nach Schlüssel ausdrückbar → Prosa, 422 in 040 |
| `StageSeat`, `ConfigFreeze`, `PiiEnvelope`, `Health`, `MeetingFormat`, `OccurredAtSource`, `RetentionClass`, `ReadinessCheckCode` | a–e | geprüft, nichts offen (`ConfigFreeze` verlangt beide Freeze-Felder schon) |
| `ConfigFrozen`-, Claim-, Release-Nutzlasten | e | bewusst offen (028/040 legen die Form fest, „Offen" oben); Folge: `Meeting.configHash` hat noch kein gebundenes Quellfeld im Ereignis |
| `streamEvents`, `getMetrics`, `logout`, `listMeetings`, Tagesordnungs-Operationen, Alias- und kanonische Pfade | c, e | Status und Medientypen bereits in Runde 3/4 gebunden; nichts Neues |

**Bewusst Prosa, mit Grund:** JSON Schema vergleicht keine zwei Werte (`at` = `recordedAt`; `occurredAt` = `recordedAt`
bei Quelle `server`; `Claim.expiresAt` > `claimedAt`; Reihenfolge der Tagesordnungszeitpunkte; `DemoSession.roles` =
`[actor.role]`; `RoleAssignment.meetingId` = Pfad-`meetingId`), prüft keinen Freitext (`reason`, `detail`) und bindet
keinen Header an ein einzelnes Sicherheitsschema (`X-CSRF-Token`). `legalHold` = `false` in der Beta ist ein
Beta-Zustand, kein Invariant (ein späteres Ereignis setzt den Hold) — ein `const: false` müsste später zurückgenommen
werden.

**Nachweis mit den Validatoren des Dienstes** (Wegwerf-Test `apps/api/src/__tests__/zz-invariants-023.test.ts` mit
`expectValid` aus `apps/api/src/contractSchema.ts`, 46 Fälle („accepts" oder „rejects") plus zwei Dokumentprüfungen für
`Location`/`ETag`; ein „rejects" zählt nur bei „does not match its contract schema", nicht bei einem
Auflösungsfehler; danach gelöscht, nicht committet. Keine Anfrageschemata geändert, daher kein `requestBodyValidator`-Fall.)

Rot — derselbe Test gegen `openapi.yaml` von HEAD 0634a99:

```
     × rejects: event v2 with actor.displayName
     × rejects: event occurredAt without occurredAtSource
     × rejects: event occurredAtSource without occurredAt
     × rejects: event hash without prevHash
     × rejects: event schemaVersion without hash
     × rejects: event schemaVersion without legalHold
     × rejects: AgendaItemOpened without number
     × rejects: RoleAssigned with reason
     × rejects: RoleRevoked with unitId
     × rejects: session variant without csrfToken
     × rejects: session variant without expiresAt
     × rejects: session variant with empty roles
     × rejects: bare {actor} (0.3.0 before round 5)
     × rejects: demo variant with csrfToken
     × rejects: demo variant with expiresAt
     × rejects: 200 with only clock
     × rejects: 200 with empty checks
     × rejects: 200 ready but a check fails
     × rejects: 503 not_ready but every check ok
     × rejects: fail without code
     × rejects: ok with code
     × rejects: contribution occurredAt without source
     × rejects: meeting configHash without configFrozenAt
     × rejects: agenda item votingClosedAt without votingOpenedAt
     × rejects: agenda item votingOpenedAt without openedAt
     × rejects: role assignment revokedAt without revokedBy
     × rejects: question stageAssignment ceo, seatId cfo
     × rejects: transparency notice with empty German text
     × rejects: 403 body with status 404
     × rejects: 503 body with status 500
     × rejects: 400 body with status 422
     × Location is required on both 302
     × ETag is required on the new writes that promise it
      Tests  33 failed | 15 passed (48)
```

(„unknown check name" war schon an HEAD rot, durch `propertyNames` aus Runde 2.) Grün gegen den neuen Vertrag:
`Tests  48 passed (48)` — darunter die Gegenproben „event 0.2 shape with actor.displayName (today)", „event v2 without
meetingId (024 before 025)", „RoleRevoked with reason", „demo variant", „question custom seat only", „503 with db
unreachable", „403 body with status 403".

Live-Probe des unveränderten Dienstes gegen den neuen Vertrag (`createApp({ demoEnabled: true })` per tsx,
`expectValid` je Antwort; wörtlich):

```
POST /v1/demo/seed -> 200 application/json: valid against 0.3.0 (round 5)
GET /v1/events?limit=5000 -> 200 application/json: valid against 0.3.0 (round 5)
  293 events, 293 with actor.displayName, 0 with schemaVersion
GET /v1/questions?limit=2000 -> 200 application/json: valid against 0.3.0 (round 5)
GET /v1/questions/fr-0006q/history -> 200 application/json: valid against 0.3.0 (round 5)
GET /v1/meeting -> 200 application/json: valid against 0.3.0 (round 5)
POST /v1/speakers -> 403 application/problem+json: valid against 0.3.0 (round 5)
POST /v1/contributions -> 404 application/problem+json: valid against 0.3.0 (round 5)
POST /v1/questions/fr-0006q/delivery -> 409 application/problem+json: valid against 0.3.0 (round 5)
PATCH /v1/speakers/sp-00004 -> 422 application/problem+json: valid against 0.3.0 (round 5)
```

`contract:lint`: 0 Fehler, dieselben 6 Warnungen wie vorher. `pnpm contract:types` zweimal: SHA-256 `844b82c77560…`
beide Male (Zwischenstand nach Commit 1: `b8c56cd7eac5…`, ebenfalls stabil). Typen-Diff: `EventActor`;
`Session` = `DemoSession | SignedInSession` (`csrfToken?: never` / `csrfToken: string`); `Readiness.checks` =
`{ clock; db; migrations }` aus `ReadinessCheck` (`{ status: "ok"; code?: never } | { status: "fail"; code }`);
`RoleAssignedPayload`/`RoleRevokedPayload` statt `RoleAssignmentEventPayload`; `AgendaItemEventPayload.number`
Pflicht; Problemantworten `Problem & { status?: 4xx }`; `Location` und `ETagRequired` ohne `?`. Typecheck aller
Pakete grün, API-Suite 49/49, Tor 29 ausgeübt / 36 deklariert.

**Offen (mit Grund)**

- *Folge für 024 (an den Orchestrator):* sobald der Kern v2 schreibt, fehlt `actor.displayName`. Heute lesen ihn
  `apps/web/src/features/history/Timeline.tsx` (Rückfall auf `actor.id`) und die Projektion `approvedBy: e.actor`
  (`packages/domain/src/state.ts`). 024 (Lanes core, web-api) muss Namen beim Lesen auflösen, z. B. aus dem
  Akteursverzeichnis des Seeds, bis 026 die Personentabelle bringt. Gehört in die Spec von 024.
- *Pflicht-Antwortheader werden nicht geprüft:* `helpers.ts` validiert Körper, keine Header; `ETagRequired` und
  `Location` sind bis dahin Dokument. Eine Header-Prüfung gehört nicht zum Tor aus Ziel 5 und wäre eine eigene
  Kleinänderung (oder Teil von 025/029/040).
- `Meeting.configHash` hat erst mit der Nutzlast von `ConfigFrozen` (040) eine gebundene Quelle.

**Commits** (nicht gepusht)

7. `67a0003 fix(contract): Ereignisakteur ohne Klarnamen ab Umschlag v2, Umschlagpaare, Sitzungsvarianten, drei Pflichtprüfungen an /readyz (Scheibe 023) [skip netlify]`
8. `a53a2fd fix(contract): Invarianten-Durchgang über alle neuen Schemata — Rollenereignisse je Typ, Problem-Status an HTTP-Status, ETag und Location Pflicht (Scheibe 023) [skip netlify]`
9. Bericht (diese Datei): `docs: Bericht Scheibe 023 — Invarianten-Durchgang nach Codex Runde 5 (Scheibe 023) [skip netlify]`

### Letzte Kleinrunde (Opus-Nachprüfung und Codex auf 8ef3ad2)

Commit `f5a02e5` (Vertrag, Typen, CHANGELOG, Allowlist, Testhelfer); dieser Bericht im Folgecommit. Kein Feld
entfernt, nichts an einer Anfrage einer Bestandsoperation verengt.

| Punkt | Stelle im Vertrag / Code | Erledigung |
|---|---|---|
| Opus a | `Readiness.checks.{clock,db,migrations}` | je Prüfung `allOf` aus `ReadinessCheck` und eigenem `code`-Enum: clock `clock_unsynced\|clock_drift\|timeout`; db `not_configured\|unreachable\|timeout`; migrations `migrations_pending\|not_configured\|unreachable\|timeout` |
| Opus b | `Event.dependentRequired` | `hash: [prevHash, schemaVersion]`, `prevHash: [hash, schemaVersion]`, `recordedAt`, `retentionClass`, `legalHold` → `[schemaVersion]`; zusätzlich `occurredAt`/`occurredAtSource` → `+ schemaVersion` (gleiche Lücke, der Dienst sendet keines der Felder) |
| Opus c | `Event.schemaVersion` | `minimum: 2`; Upcaster-Hinweis für 024 unter „Offen" |
| Opus d | `Event` `if`/`then` | `required: [subjectId]` (mit `properties.subjectId`, sonst Lint-Warnung `no-required-schema-properties-undefined`) für AgendaItemOpened, VotingOpened, VotingClosed, RoleAssigned, RoleRevoked |
| Opus e | `Contribution.occurredAtSource` | `enum: [device, paper, transcript]` wie `MeetingContributionCapture` |
| Opus f | `getContribution` 200, `captureMeetingContribution` 201 | optionales `ETag` (= `Contribution.version`, das `If-Match` von claim/release) |
| Opus g | `ETagRequired.description` | begründet, warum `claimQuestion`/`releaseQuestion` `QuestionUpdated` mit optionalem `ETag` nutzen (geteilte Antwort von elf 0.2-Operationen) |
| Opus h | `DemoSession` | `subjectId` (= `actor.id`) deklariert; `idpGroups: false`, `personId: false` |
| Opus i | `allowlist.json` | 27 `reason`-Texte (025: 14, 026: 3, 028: 4, 040: 6): „Lane service seit takt-011; wird mit Scheibe NNN ausgeübt und entfernt"; 36 Einträge, `operationId`/`slice`/`expires` und Feldsatz unverändert (Skriptvergleich: `36 36 true`) |
| Codex 1 (P1) | `completeLogin` 302 | `Set-Cookie` `required: true`, `pattern: '^hv_session='`, mit Beschreibung |
| Codex 2 (P2) | `logout` | neuer Parameter `CsrfTokenRequired` (`X-CSRF-Token`, `required: true`, `minLength: 1`); generiert: `"X-CSRF-Token": components["parameters"]["CsrfTokenRequired"]` (nicht optional) |
| Codex 3 (P2) | `ReadinessCheck` | beide `oneOf`-Zweige `additionalProperties: false` |
| Codex 4 (P2) | `apps/api/src/__tests__/helpers.ts` | `assertRequiredHeaders()` vor `recordOperationHit`: fehlt ein Header mit `required: true` für den Status, scheitert der Test und es gibt keinen Treffer |

**Test zuerst** (Wegwerf-Test `apps/api/src/__tests__/zz-letzte-kleinrunde.test.ts` mit `expectValid`/`resolvePointer`/
`paramsFor` aus `apps/api/src/contractSchema.ts` und für Codex 4 `req()` gegen eine Wegwerf-App ohne Header; je ein
Ablehnungsfall für a–e und h, dazu f, Codex 1–4; danach gelöscht). Rot gegen 8ef3ad2 (nur der Test hinzugefügt):

```
     × a: codes per readiness check
     × Codex 3: readiness check variants are closed
     × b: envelope fields depend on schemaVersion
     × c: schemaVersion 1 is never on the wire
     × d: subjectId on agenda and role events
     × e: Contribution.occurredAtSource has no server
     × h: DemoSession subjectId declared, no idpGroups/personId
     × f: optional ETag on getContribution 200 and captureMeetingContribution 201
     × Codex 1: completeLogin 302 requires Set-Cookie
     × Codex 2: logout requires X-CSRF-Token
     × Codex 4: helper rejects a missing required response header
AssertionError: promise resolved "Response { status: 302, … headers: Headers {} … }" instead of rejecting
      Tests  11 failed (11)
```

Grün nach der Änderung:

```
 ✓ … > a: codes per readiness check 15ms
 ✓ … > Codex 3: readiness check variants are closed 2ms
 ✓ … > b: envelope fields depend on schemaVersion 36ms
 ✓ … > c: schemaVersion 1 is never on the wire 0ms
 ✓ … > d: subjectId on agenda and role events 2ms
 ✓ … > e: Contribution.occurredAtSource has no server 11ms
 ✓ … > h: DemoSession subjectId declared, no idpGroups/personId 16ms
 ✓ … > f: optional ETag on getContribution 200 and captureMeetingContribution 201 1ms
 ✓ … > Codex 1: completeLogin 302 requires Set-Cookie 1ms
 ✓ … > Codex 2: logout requires X-CSRF-Token 1ms
 ✓ … > Codex 4: helper rejects a missing required response header 63ms
      Tests  11 passed (11)
```

Codex 4 gegen die bestehende Suite: `apps/api` 49/49 grün mit der neuen Kopfzeilenprüfung, auch mit
`CONTRACT_GATE_STRICT=1`; keine heute ausgeübte Operation hat einen Pflicht-Header (`ETagRequired`, `Location`,
`Set-Cookie` hängen nur an allowlisteten Operationen), also musste nichts am Vertrag gelockert werden.

**Live-Probe** (Wegwerf-Test, danach gelöscht): `createApp({ demoEnabled: true })`, `POST /v1/demo/seed`
(300 Fragen, Seed 11), dann über `req()` (Status, Körper, Pflicht-Header) und zusätzlich `expectValid`:

```
PROBE seed=200 events=2329 (types: AnswerDrafted,ContributionCaptured,MeetingCreated,QuestionApproved,QuestionAssigned,QuestionCaptured,QuestionClassified,QuestionClosed,QuestionDelivered,QuestionReturned,QuestionStaged,QuestionSubmittedForReview,SpeakerRegistered,SpeakerUpdated) withSchemaVersion=0 questions=300 histories=300 meeting=200 problems=404,401,403
 ✓ src/__tests__/zz-live-probe.test.ts > live probe on the seeded service 550ms
      Tests  1 passed (1)
```

`listEvents` (2329 Ereignisse, keines mit `schemaVersion`), `listQuestions` (300), `getQuestionHistory` (alle 300),
`getMeeting` und die Problemantworten 404/401/403 bleiben gültig.

**`contract:lint`:** `You have 6 warnings.` (dieselben sechs wie vorher; die drei zwischenzeitlichen
`no-required-schema-properties-undefined` aus Punkt d sind durch `properties.subjectId` im `then` behoben).
**`pnpm contract:types`:** zweimal gleiche SHA-256 (`70c91ee0…`), kein weiterer Diff. **Typen-Diff:** `Readiness.checks.*`
als `ReadinessCheck & { code?: … }` je Prüfung; `DemoSession.subjectId?: string`, `idpGroups?: never`,
`personId?: never`; `Contribution.occurredAtSource?: "device" | "paper" | "transcript"`; neuer Parameter
`CsrfTokenRequired: string`, an `logout` als Pflicht-Header; `"Set-Cookie": string` an `completeLogin` 302; `ETag`
an `getContribution` 200 und `captureMeetingContribution` 201; sonst Beschreibungen. **CHANGELOG 0.3.0:** Eintrag
„Last small round" unter Added.

**`pnpm gates`** (Commit `f5a02e5`, eigenes Log via `mktemp`, Exit 0). Zeilen desselben Laufs: `You have 6 warnings.`;
`packages/domain Tests 72 passed (72)`; `apps/web Tests 48 passed (48)`; `apps/api Tests 49 passed (49)`;
`operation-coverage: 65 operations in the contract, 29 exercised by tests, 36 pre-declared in allowlist.json` /
`ok`; `vocabulary-check: ok`; `slice-scope: 10 changed file(s), all within … "Files allowed" list (12 pattern(s)).`;
`plan-graph: ok.`; Ende wörtlich:

```
1..196
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7160.732187

> @hv/web@0.0.0 build /home/user/wt/023/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
…
dist/assets/index-BoqUekbh.js                        532.22 kB │ gzip: 156.05 kB │ map: 2,200.90 kB
…
✓ built in 1.26s
mark-test-run: wrote /home/user/wt/023/.claude/state/last-test-run (clean tree) at commit f5a02e5, tree 199b66283adf…
```

Hinweis zu „Offen/Service-Lane-Lücke" oben: der Text beschreibt den Stand vor takt-011; die Allowlist-Texte sind
jetzt auf den Stand nach dem Merge von takt-011 (PR #29) formuliert.

### Sicherheits-Durchgang nach Codex auf 50cc738

Commit `2d2b553` (Vertrag, Typen, CHANGELOG, Testhelfer); dieser Bericht im Folgecommit. **Ursache:** dreimal in
Folge fand Codex im Anmelde- und Sicherheitsbereich eine weitere Invariante, weil bisher Einzelfunde nachgezogen
wurden. Dieser Durchgang geht deshalb jede Stelle durch, an der eine Beschreibung ein Sicherheitsversprechen gibt (i),
das `Action`-Enum gegen jedes im Plan genannte Recht (ii) und jedes Zeichenkettenfeld, das einen Hash, ein Token, eine
Kennung oder eine Zeit trägt (iii).

**(i) Sicherheitsversprechen → Schema-Bindung oder Prosa mit Grund**

| Versprechen (Stelle) | Bindung im Schema | Prosa, weil … |
|---|---|---|
| Sitzungscookie HttpOnly, Secure, SameSite (`completeLogin` 302, Schema `session`) | `Set-Cookie` Pflicht, Muster: Wert ≥ 32 Cookie-Oktette, Lookaheads für `HttpOnly`, `Secure`, `SameSite=Lax\|Strict`, kein `Max-Age=0`/negativ (**Codex 1**) | `Expires` in der Vergangenheit: JSON Schema vergleicht keine Daten; Groß-/Kleinschreibung der Attribute: kanonisch, wie der Dienst schreibt |
| Abmelden löscht das Cookie (`logout` 204) | `Set-Cookie` Pflicht, `^hv_session=` leer mit `Max-Age=0` (**neu**) | Sperrliste der Sitzungskennung ist serverseitig, in der Antwort nicht sichtbar |
| Kein offener Redirect (`login.returnTo`, `completeLogin` 302 `Location`) | neues Schema `SameOriginPath` (`^/`, nicht `//` oder `/\`, kein Backslash, kein Leer- oder Steuerzeichen, ≤ 512) als `Location` (**Codex 2**) | `returnTo` selbst bleibt ohne Muster: ein fremder Wert wird ignoriert (Umleitung nach `/`), nicht abgelehnt — die Beschreibung nennt dieselbe Regel |
| Weiterleitung zum IdP (`login` 302 `Location`) | `format: uri`, Pflicht | nicht auf `https:` gebunden: der lokale und e2e-Keycloak (031) läuft auf http://localhost |
| Nichts auf dem Anmeldeweg wird zwischengespeichert (Sitzung, CSRF-Token, `state`) | neuer Header `CacheControlNoStore` (Pflicht, `no-store` als Direktive) an `login` 302, `completeLogin` 302, `logout` 204, `getSession` 200 (**neu**) | Problemantworten (400/401/403/503) tragen kein Geheimnis und bleiben geteilt |
| CSRF-Token Pflicht unter `session` | `CsrfTokenRequired` an `logout` (Pflicht, `minLength: 1`); `SignedInSession.csrfToken` Pflicht, `^[A-Za-z0-9_-]{32,}$`; `DemoSession.csrfToken: false` | `CsrfToken` an den übrigen Operationen optional: OpenAPI kann einen Header nicht an ein Sicherheitsschema binden; kein Formatmuster auf der Anfrage (ein 422 mit Format verriete dem Fälscher, was zu senden ist; falsches Token ist 403 aus 029) |
| Sitzungsablauf 14 h mit stiller Verlängerung | `SignedInSession.expiresAt` Pflicht, `date-time`; `DemoSession.expiresAt: false` | Dauer relativ zu „jetzt": kein Wertevergleich in JSON Schema |
| Maskierung / keine Klarnamen in Ereignissen | v2-Ereignis ohne `actor.displayName` (`dependentSchemas`); `SubjectId` ohne `@` und Leerzeichen an allen Subjektkennungen (**neu**) | `personId`-Maskierung im Standardlesepfad hängt vom Recht des Aufrufers ab (Antwortschema kennt ihn nicht); „kein Name" in einer Kennung ist nicht von einer opaken Kennung unterscheidbar; `RoleRevokedPayload.reason` ist Freitext |
| Keine internen Angaben ohne Anmeldung (`/readyz`, 503, `completeLogin`-Fehler) | `/readyz`: Prüfnamen geschlossen, Varianten geschlossen, Codes je Prüfung (Runde 4); `Problem.status` je Antwort `const` | `detail` ist Freitext (feste Sätze je Ursache, Prosa an `ServiceUnavailable` und `completeLogin`) |
| `/metrics` nur für den Abfrager, keine Kennzahl je Person | `security: [metricsBearer]`, 401 dokumentiert | Prometheus-Text ist kein JSON; die Kennzahlen-Allowlist prüft 033 |
| CORS | — | kein Versprechen im Vertrag (Vertrag ist same-origin, `servers: /v1`); der Dienst erlaubt CORS nur im Demo-Modus für den Vite-Dev-Server (`apps/api/src/app.ts`) |
| Ratenbegrenzung | — | kein Versprechen im Vertrag; siehe Offen (034 „Limits" braucht 413/429 im Vertrag) |
| ETag als Versionsmarke für `If-Match` | `ETag`/`ETagRequired` auf Entity-Tag-Syntax `^(?:W/)?"[!#-~]*"$` (**neu**; heute `"v<n>"`, von der ganzen API-Suite geprüft) | — |

**(ii) `Action` gegen jedes im Plan genannte Recht** (`grep` über `docs/produktplan-beta.md` nach `question.`, `admin.`,
`meeting.`, `speaker.`, `contribution.`, `stage.`, `event.`, `agenda.`, `answer.`, `debate.`, `export.`, `ingest.`,
`history.`, `record.` u. a.; `record.html`/`record.json`/`config.ts` sind Dateinamen):

| Recht | braucht (Scheibe, Datum) | Vertragslane der Scheibe | bis heute im Vertrag | Entscheidung |
|---|---|---|---|---|
| `question.identity.reveal` | 026 (16.10.) vergibt und prüft; 067 | nein (core) | nein | **jetzt** (**Codex 3**) — 043 listet es, liegt aber nach 026 (23.10.) |
| `admin.override` | 040 (03.11.) Änderung nach Freeze mit Grund | nein (core) | nein | **jetzt** — 043 listet es nicht |
| `question.read.protected` | 047 (10.11.) | nein (core) | nein | **jetzt** — 043 listet es nicht |
| `event.read.personal` | 047 (10.11.), ADR 0009/0013 | nein (core) | nein | **jetzt** — 043 listet es nicht |
| `question.refuse.propose`, `question.refuse.approve` | 044 (06.11.) | nein | nein | 043 (23.10., Vertragslane, in seiner Zielliste) |
| `question.forward` | 048 (05.11.) | nein | nein | 043 (Zielliste) |
| `export.dossier` | 051 (11.11.) | nein | nein | 043 (Zielliste) |
| `ingest.write` | 064 (26.11.) | nein | nein | 043 (Zielliste) |
| `debate.close` | 087 (17.11.) | nein | nein | 043 (Zielliste) |
| `round.assemble`, `procedure.record`, `cockpit.read` | 053/050/061 | nein | nein | 043 (Zielliste) |
| `agenda.manage`, `admin.roles.manage`, `question.legal.clear`, `question.read`, `event.read`, `stage.read`, `speaker.read`, `contribution.read`, `history.read`, `question.classify`, `question.assign`, `question.approve`, `answer.draft` | — | — | ja | — |

Rechtekonzept (`docs/rollen-und-rechtekonzept.md`) nennt dazu Altbezeichner (`question.answer.draft`,
`question.answer.approve.*`, `speech.round.reorder`, `stage.mark.delivered`, `user.role` …); der Plan ersetzt sie
(Zeile 70: „verschiedene Vokabulare"), 052 baut das Rechtekonzept um — kein Vertragsbezeichner.

**(iii) Hash-, Token-, Kennungs- und Zeitfelder**

| Klasse | Felder | Einschränkung | heute sicher? |
|---|---|---|---|
| Zeit | alle `*At`, `at`, `serverTime`, `X-Server-Time` | `format: date-time` (alle schon vorher) | ja (Probe) |
| Hash | `Event.hash`, `Meeting.configHash`, `ConfigFreeze.configHash` | neues Schema `Sha256Hex` `^[0-9a-f]{64}$` (**Codex 5**) | ja: kein heutiges Ereignis trägt `hash` (Probe: 0 von 2329) |
| Hash-Vorgänger | `Event.prevHash` | `^(?:[0-9a-f]{64})?$` (leer = Genesis) (**Codex 5**) | ja (nicht gesendet) |
| Token | `SignedInSession.csrfToken` | `^[A-Za-z0-9_-]{32,}$` (**neu**) | ja (029, nicht gebaut) |
| Token | `hv_session`-Wert | ≥ 32 Cookie-Oktette (im `Set-Cookie`-Muster) | ja (029) |
| Token | `X-CSRF-Token` (Anfrage) | nur `minLength: 1` an `logout` | bewusst kein Muster (siehe i) |
| Subjekt | `RoleAssignment.subjectId`/`deputyForSubjectId`, `RoleAssignmentCreate.*`, `RoleAssignedPayload.*`, `RoleRevokedPayload.subjectId`, `DemoSession.subjectId`, `SignedInSession.subjectId` | neues Schema `SubjectId` (1–255, kein `@`, kein Leerraum) (**neu**) | ja (neue Schemata; Demo-Akteur-Kennungen wie `admin` passen) |
| Schlüssel | `Event.idempotencyKey` | 1–128 wie der Header `Idempotency-Key` (**neu**) | ja (nicht gesendet) |
| Versionsmarke | `ETag`, `ETagRequired` | Entity-Tag-Syntax (**neu**) | ja: `"v9"` u. a., 11 verschiedene Werte in der Probe, ganze API-Suite grün |
| Kennungen | `id`, `meetingId`, `speakerId`, `questionId`, `personId`, `keyId`, `causationId`, `assignmentId`, `deviceId`, Pfadparameter | keine (opak) | Absicht: Kennungen erzeugt der Kern, ihr Format ist nicht Vertragsinhalt; ein Muster auf Pfadparametern bestehender Operationen würde Anfragen verengen (siehe „Compatibility") |
| Regelkennung | `Problem.ruleId` | keine | Regelregister (011) prüft das Format; kein Sicherheitsfeld |
| `Last-Event-ID` | Header | `^[0-9]+$` (schon vorher) | ja |

**Test zuerst** (Wegwerf-Test `apps/api/src/__tests__/zz-sicherheit.test.ts`, danach gelöscht; Header über `req()`
gegen eine Wegwerf-App, Körper über `expectValid`; je ein Ablehnungsfall pro Codex-Punkt und pro Treffer). Rot gegen
50cc738 (nur der Test hinzugefügt):

```
 × Codex 1: Set-Cookie on completeLogin needs value, HttpOnly, Secure, SameSite Lax|Strict
 × Codex 2: completeLogin Location is a same-origin path
 × Codex 3 + sweep ii: Action has the identifiers later slices need
 × Codex 4: helper validates required header values
 × Codex 5: hash and prevHash are SHA-256 hex, prevHash may be empty
 × sweep i: logout clears the cookie
 × sweep i: no-store on auth responses
 × sweep iii: csrfToken and session cookie value are long enough
 × sweep iii: subject ids are never e-mail addresses
 × sweep iii: configHash is SHA-256 hex
 × sweep iii: event idempotencyKey bounded like the header
 × sweep iii: ETag is an entity-tag
      Tests  12 failed (12)
```

Grün nach der Änderung:

```
 ✓ Codex 1: Set-Cookie on completeLogin needs value, HttpOnly, Secure, SameSite Lax|Strict 60ms
 ✓ Codex 2: completeLogin Location is a same-origin path 3ms
 ✓ Codex 3 + sweep ii: Action has the identifiers later slices need 1ms
 ✓ Codex 4: helper validates required header values 1ms
 ✓ Codex 5: hash and prevHash are SHA-256 hex, prevHash may be empty 20ms
 ✓ sweep i: logout clears the cookie 2ms
 ✓ sweep i: no-store on auth responses 15ms
 ✓ sweep iii: csrfToken and session cookie value are long enough 1ms
 ✓ sweep iii: subject ids are never e-mail addresses 8ms
 ✓ sweep iii: configHash is SHA-256 hex 6ms
 ✓ sweep iii: event idempotencyKey bounded like the header 0ms
 ✓ sweep iii: ETag is an entity-tag 3ms
      Tests  12 passed (12)
```

**Live-Probe** (Wegwerf-Test, danach gelöscht; jede Antwort über `req()`, also mit Status, Körper und jetzt auch den
Werten aller deklarierten Header, dazu `expectValid`):

```
PROBE seed=200 events=2329 withSchemaVersionOrHash=0 questions=300 histories=300 getQuestion-ETags=11 (e.g. "v9") meeting=200 problems=404,401,403
 ✓ src/__tests__/zz-live-probe.test.ts > live probe on the seeded service 697ms
      Tests  1 passed (1)
```

Die bestehende API-Suite bleibt 49/49 grün, auch mit `CONTRACT_GATE_STRICT=1`; keine Bestandsoperation verletzt einen
Header-Wert. **`contract:lint`:** `You have 6 warnings.` **`pnpm contract:types`:** zweimal gleiche SHA-256
(`a9f11255…`). **Typen-Diff:** neue Schemata `SameOriginPath`, `Sha256Hex`, `SubjectId`, Header
`CacheControlNoStore`; `Action` +4; Subjekt- und Hashfelder referenzieren die neuen Schemata; `Location` von
`completeLogin` ist `SameOriginPath`; `Set-Cookie` an `logout`, `Cache-Control` an vier Antworten.

**`pnpm gates`** (Commit `2d2b553`, eigenes Log via `mktemp`, Exit 0). Zeilen desselben Laufs: `You have 6 warnings.`;
`packages/domain Tests 72 passed (72)`; `apps/web Tests 48 passed (48)`; `apps/api Tests 49 passed (49)`;
`operation-coverage: 65 operations …, 29 exercised by tests, 36 pre-declared` / `ok`; `vocabulary-check: ok`;
`slice-scope: 10 changed file(s), all within … "Files allowed" list`; `plan-graph: ok.`; `# tests 196`, `# pass 196`,
`# fail 0`; Ende wörtlich:

```
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
…
dist/assets/index-BoqUekbh.js                        532.22 kB │ gzip: 156.05 kB │ map: 2,200.90 kB
…
✓ built in 2.13s
mark-test-run: wrote /home/user/wt/023/.claude/state/last-test-run (clean tree) at commit 2d2b553, tree f976ef578e55…
```

**Offen aus dem Durchgang:** (1) 034 („Limits, Sicherheitsheader") hat keine Vertragslane; gibt der Dienst dort 413
oder 429 zurück, ist das ein undokumentierter Status und der Testhelfer schlägt an — der Vertrag muss 413/429 vorher
bekommen (043 oder Kleinänderung vor 034; Entscheidung des Orchestrators). (2) Allgemeine Sicherheitsheader (CSP,
HSTS, `X-Content-Type-Options`) aus 034 sind Plattformheader, keine Vertragsheader; nicht deklariert. (3) `401` von
`getMetrics` ohne `WWW-Authenticate: Bearer` (RFC 6750) — kein Versprechen im Vertrag, Kandidat für 033/043.

## Review findings

**Spec-Prüfung · Fable 5.1 · 23.09.2026 · zweimal** (2 major, 4 minor; Nachprüfung 1 major, 2 minor) → vor dem Bau
eingearbeitet.

**Runde 1 · Opus 5.5 · 24.09.2026 · Urteil: nacharbeiten** (0/3/6 + 1 nit), dazu Codex auf PR #25 (2 × P1):

1. major · neue Anfragefelder an Bestandsoperationen wirkten sofort (der Dienst validiert gegen den Vertrag):
   `source: paper` landete im nur anhängenden Protokoll, `occurredAt` und `seatId` wurden still verworfen, der Filter
   `meetingId` an `/events` tat nichts → Felder nur an der neuen Operation, `seatId` und der Filter nach 0.4.0 (043).
2. major · das Tor zählte Aufrufe nicht vorhandener Routen (401, 404-Rückfall) als ausgeübt → nur dokumentierte
   2xx/3xx unter der deklarierten Basis-URL zählen; rot/grün im Bericht.
3. major · 27 Allowlist-Einträge gehören Scheiben ohne Service-Lane → im Feld `reason` benannt, Planänderung takt-011
   durch den Orchestrator.
4.–9. minor · Aufzählungen erweitert (Kompatibilitätsregel), `-t`-Filter, Basis-URL, `/readyz` ohne Freitext, 409 an
   den Alias-Pfaden, „aktuelle Versammlung“ und CSRF-Header → behoben.
10. nit · `Unauthorized` nennt die drei Operationen → behoben.
- Codex P1 · CSRF-Header nicht deklariert → `X-CSRF-Token` an allen schreibenden Operationen.
- Codex P1 · `occurredAt` ohne `occurredAtSource` erlaubt → `dependentRequired` in beide Richtungen.

**Runde 2 · Nachprüfung Opus 5.5 · Urteil: annehmen** (4 nits; Dienst selbst geprobt: `paper` → 422, keine
Bestandsanfrage scheitert neu, Tor zählt keine Scheinaufrufe). Nits vom Orchestrator: Zählung „21“ → 16 (nachgerechnet:
16 Bestands- und 18 neue Operationen tragen den Header); 404 ohne Versammlung gilt ab 025; Namen der Prüfungen an
`/readyz` als geschlossene Liste (`propertyNames`). Offen, weitergetragen: der Gleichstand „latest `MeetingCreated`“
ist für Clients nicht nachvollziehbar (`Meeting` trägt keine Anlagezeit, `listMeetings` sortiert nur nach `date`) →
030 nutzt `getMeeting` bis 0.5, Klärung in 043. Unbekannte Felder im Anfragekörper werden weiter still ignoriert (kein
`additionalProperties: false`, Stand 0.2.1) → 043.

**Codex auf PR #25, dritter Lauf (2 × P1, 1 × P2), vom Orchestrator behoben** (die Nacharbeitsrunde des Bauers war
verbraucht):

- P1 · `req()` hätte einen endlosen SSE-Strom (`streamEvents`, 035) mit `res.text()` gepuffert und nie zurückgegeben
  → der Helfer liest einen Körper nach Medientyp: `text/event-stream` gar nicht (geprüft wird der deklarierte
  Medientyp), JSON wird geparst, alles andere als Text validiert.
- P1 · `getMetrics` (`text/plain`, 033) wäre an `JSON.parse` gescheitert → siehe oben.
- P2 · Vorrang zwischen `after` und `Last-Event-ID` war offen → `Last-Event-ID` gewinnt, `after` gilt nur für die
  erste Verbindung.

Probe mit einer Wegwerf-App, die wie die künftigen Handler antwortet (Wegwerf-Test danach gelöscht). Vorher:
`× SSE is not buffered 5007ms` (Zeitüberschreitung) und `× metrics text/plain is not JSON-parsed` mit
`SyntaxError: Unexpected token 'h', "hv_events_total 1`. Nachher: `Tests 51 passed (51)`, und das Tor meldet
`getMetrics` und `streamEvents` als ausgeübt („overdue“) — sie zählen also, sobald 033 und 035 sie bauen.

**Runde 3 · Nachprüfung Opus 5.5 der Orchestrator-Behebungen · Urteil: annehmen** (2 nits): kein JSON entgeht der
Prüfung (fehlender Medientyp, Zeichensatz, `problem+json`, falscher Medientyp je geprobt), bestehende Tests
unverändert (29 ausgeübt), Zählung 16 bestätigt, `propertyNames` von Ajv durchgesetzt. Nits vom Orchestrator
behoben: `Last-Event-ID` nur als Ziffernfolge, ein falscher Wert ist 422; Medientyp im Testhelfer ohne
Groß-/Kleinschreibung.

**Codex auf PR #25, vierter Lauf (2 × P1), vom Orchestrator behoben:** `logout` trägt den CSRF-Header, dokumentierte aber
kein 403 → `Forbidden` ergänzt; eine Skriptprüfung über alle 34 Operationen mit CSRF-Header findet keine weitere ohne
403. `/readyz` erlaubte 200 mit `not_ready` und 503 mit `ready` → die Schemata sind an den HTTP-Status gebunden
(`allOf` mit `const`). Probe mit dem Vertragsvalidator des Dienstes (Wegwerf-Test, danach gelöscht): vorher
„1 failed“, nachher „1 passed“.

**Codex auf PR #25, fünfter Lauf (4 × P1), vom Bauer (Opus 5.5) behoben:** `Event.actor` erlaubte einen Klarnamen,
`/auth/me` war ohne `csrfToken` gültig, `/readyz` verlangte keine Prüfung, `Event.occurredAt` ohne
`occurredAtSource` war gültig → Invarianten-Durchgang über jedes neue Schema, Bericht unter „Invarianten-Durchgang nach
Codex (Runde 5)" (rot 33 / grün 48 mit den Validatoren des Dienstes).

**Runde 4 — Nachprüfung Opus 5.5 auf 8ef3ad2: annehmen** (0 blocker, 0 major, 8 minor/nit + 1 Allowlist-Punkt), alle
in `f5a02e5` behoben, Nachweise unter „Letzte Kleinrunde":

- a. minor · `Readiness.checks` nahm `db = {fail, clock_drift}` an → Codes je Prüfung (`allOf` + `enum`). **behoben**
- b. minor · v2-Felder ohne `schemaVersion` gültig → `dependentRequired` auf `schemaVersion` (auch `occurredAt`/
  `occurredAtSource`). **behoben**
- c. minor · `schemaVersion` `minimum: 1` → `2`; Upcaster-Pflicht (alle sieben Felder inkl. `hash`/`prevHash`) unter
  „Offen" für 024. **behoben**
- d. minor · Tagesordnungs- und Rollenereignisse ohne `subjectId` gültig → `required: [subjectId]` im `then`. **behoben**
- e. minor · `Contribution.occurredAtSource` erlaubte `server` → `[device, paper, transcript]`. **behoben**
- f. minor · kein `ETag` an `getContribution` 200 / `captureMeetingContribution` 201 → optionales `ETag`. **behoben**
- g. nit · `ETagRequired.description` begründet jetzt `claimQuestion`/`releaseQuestion` mit optionalem `ETag`. **behoben**
- h. nit · `DemoSession.subjectId` deklariert, `idpGroups: false`, `personId: false`. **behoben**
- i. `allowlist.json`: 27 `reason`-Texte auf den Stand nach takt-011 umformuliert; Ablaufdatum und Feldsatz
  unverändert. **behoben**

**Codex auf 8ef3ad2** (1 × P1, 3 × P2), alle in `f5a02e5` behoben:

- P1 · `completeLogin` 302 ohne `Set-Cookie` gültig → `Set-Cookie` Pflicht (`^hv_session=`). **behoben**
- P2 · `logout` typisierte `X-CSRF-Token` optional → Parameter `CsrfTokenRequired` (Pflicht). **behoben**
- P2 · SECURITY · `ReadinessCheck` offen für `detail` → beide Varianten `additionalProperties: false`. **behoben**
- P2 · `helpers.ts` zählte Antworten ohne Pflicht-Header als ausgeübt → `assertRequiredHeaders()` vor dem Treffer;
  rot/grün mit Wegwerf-App; bestehende Suite 49/49 grün, keine Bestandsoperation betroffen. **behoben**

**Codex auf 50cc738** (3 × P1, 2 × P2; zwei davon SECURITY und merge-blockierend), alle in `2d2b553` behoben, dazu der
systematische Durchgang (Bericht „Sicherheits-Durchgang nach Codex auf 50cc738"):

- P1 SECURITY · `completeLogin` `Set-Cookie` nahm `hv_session=wert` ohne Attribute und leere/löschende Cookies an →
  Wert ≥ 32 Oktette, `HttpOnly`, `Secure`, `SameSite=Lax|Strict` per Lookahead, kein `Max-Age=0`. **behoben in 2d2b553**
- P1 SECURITY · `completeLogin` `Location` unbeschränkt → `SameOriginPath` (dieselbe Regel wie `returnTo`).
  **behoben in 2d2b553**
- P1 · `question.identity.reveal` fehlte für 026 → im `Action`-Enum, dazu aus dem Durchgang `admin.override`,
  `question.read.protected`, `event.read.personal`. **behoben in 2d2b553**
- P2 · `assertRequiredHeaders` prüfte nur Anwesenheit → `assertResponseHeaders` validiert jeden deklarierten, gesendeten
  Header mit Ajv vor dem Treffer. **behoben in 2d2b553**
- P2 · `hash`/`prevHash` ohne Format → `Sha256Hex`, `prevHash` gleich oder leer. **behoben in 2d2b553**
- Durchgang, zusätzlich: `logout` löscht das Cookie (Pflicht-`Set-Cookie`), `no-store` auf dem Anmeldeweg,
  `csrfToken`-Format, `SubjectId`, `configHash`, `Event.idempotencyKey`, ETag-Syntax. **behoben in 2d2b553**
