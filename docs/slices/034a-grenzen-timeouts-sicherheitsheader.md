# Scheibe 034a — Grenzen, Timeouts, Sicherheitsheader und Aufräumen der Login-Zustände

**Status:** spec
**Risikoklasse:** hoch · 1,5 AStd · 27.10.2026 (W5) · Lanes: service, contract, persist, infra, docs-sicherheit
**Rolle:** Implementierer-Backend; unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb, zusätzlich Sicherheits-Checkliste des Reviewers (SC-05, SC-06, SC-10, SP-2, SP-3, SP-4, SP-5, SP-6) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel, keine neue Regel-ID, keine Änderung an `ROLE_PERMISSIONS` oder der Übergangstabelle; AGENTS.md R4 (Rechte), R6 (Vertrag zuerst), R7 (nur anhängen; betrifft Ereignisse, nicht Login-Zustände), R8 (Zeit aus der injizierten Uhr), R11 (keine echten Daten)
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/034a (Teil 1 der am 29.09.2026 geteilten Scheibe 034); Befund 029b major (`docs/bautage/2026-09-27-29.md`, Tabelle Nachprüfung); `docs/folgeliste.md` Abschnitt „Sicherheit und Datenschutz aus der Nachprüfung“ (021c/takt-016 `maxLength`, 027 Pool-Timeouts, 024 leerer `Idempotency-Key`); Bedrohungsmodell Abschnitt 6 Zeile 034, BF-05, BF-06; Sicherheits-Checkliste SP-2; ADR 0013 (Rate-Limit-Zähler flüchtig, nicht im Katalog), ADR 0015 (Vertragsversion); Leitplanken §4, 6.4, 6.5, 6.7
**Depends on:** 033b (gemergt); baut auf dem Integrationsstand nach 033a (`c758fc6`) auf. takt-028 (Domäne `revokeRole.reason` ≤ 500) und takt-029 (`app.ts`, Anmeldung) sind vor dem Bau zu prüfen (siehe „Vor dem Bau prüfen“).
**Perspektive:** Security/Betrieb · **Glossar: neue Begriffe:** nein

## Warum geteilt

Der Planeintrag 034 bündelte Grenzen an der Anfragegrenze, Sicherheitsheader, das Konfigurationsschema und die
CORS-Allowlist. Die Nachprüfung vom 29.09.2026 hat drei harte Vorbedingungen ergänzt: anonymes `GET /auth/login`
schreibt je Aufruf eine Zeile in `auth_login_states` ohne Obergrenze und ohne Aufräumen (029b major), `maxLength` für
Freitextfelder im Vertrag (021c/takt-016, takt-028) und Pool-Timeouts (027). Zusammen mit Migration, Vertragsstufe und
Postgres-Tests liegt das über einer Agentenschicht. Getrennt prüfbar sind zwei Flächen: **034a** schützt die
Anfragegrenze (was eine einzelne Anfrage oder eine Quelle höchstens verbrauchen darf, was jede Antwort trägt); **034b**
prüft den Prozessstart (typisiertes Schema, `.env.example`, CORS aus Konfiguration, Verzeichnisrechte). 034a arbeitet
mit festen Standardwerten, die `createApp` als Option annimmt; 034b liest dieselben Werte aus der Umgebung und ändert
keinen Standardwert. 035 hängt an 034b, 037 prüft das Schema aus 034b im Image.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch (Netzgrenze, Sitzung und Anmeldung, Produktivpersistenz und Migration,
Leitplanken §4). Ausgelöst: Vertrag und Konfiguration; Persistenz, Migration, Nebenläufigkeit; Identität (Anmeldestart);
Betrieb. Perspektive Security/Betrieb. Nachweise siehe „Tests zuerst und Abnahme“. Offene Entscheidung: keine
Registerzeile; alle Werte unten sind Standard und in 034b konfigurierbar.

## Ziel und Entscheidungen vor Bau

Offene Punkte sind auf Standard gebaut und als solche markiert; eine abweichende Entscheidung des Eigentümers ist
Konfiguration (034b) oder eine Folgescheibe, keine stille Änderung im Bau.

### Feste Zahlen (Standard)

| Größe | Wert | Konfigurierbar ab 034b |
|---|---|---|
| Body-Limit | 262 144 Byte (256 KiB) je Anfrage, alle Methoden mit Body | nein (feste Grenze, eine Erhöhung ist eine Spec-Änderung) |
| Request-Timeout (Dienst) | 10 000 ms je Anfrage | ja, 1 000–60 000 |
| Node-HTTP-Server | `headersTimeout` 10 000 ms, `requestTimeout` 30 000 ms | nein |
| Postgres `statement_timeout` | 5 000 ms | ja |
| Postgres `lock_timeout` | 3 000 ms | ja |
| Postgres `idle_in_transaction_session_timeout` | 15 000 ms | ja |
| Schreibvorgänge je Subject | 60 je Fenster | ja |
| Nicht angemeldete Anfragen je Quelle | 300 je Fenster | ja |
| `GET /auth/login` je Quelle | 60 je Fenster | ja |
| `GET /auth/login` gesamt | 600 je Fenster | ja |
| Fenster | 60 s, feste Fenster nach der injizierten Uhr (`floor(ms / 60 000)`) | nein |
| Schlüssel je Zähler und Fenster | höchstens 10 000, darüber ein gemeinsamer Überlaufschlüssel | nein |
| `Retry-After` | ganze Sekunden bis Fensterende, 1–60 | — |
| Aufräumen Login-Zustände | höchstens 500 Zeilen je Aufruf | nein |

Reihenfolge der Zeitgrenzen, als Test festgehalten: `lock_timeout` (3 s) < `statement_timeout` (5 s) < Request-Timeout
(10 s) < `idle_in_transaction_session_timeout` (15 s). `/readyz` bleibt mit 3 × 2 000 ms (`safeCheck`) unter dem
Request-Timeout. Die Schwelle 300 je Quelle ist bewusst hoch: im Betrieb kommen alle Arbeitsplätze wahrscheinlich über
eine Firmen-NAT-Adresse; angemeldete Anfragen zählen nie gegen die Quelle (Punkt 3).

### Entscheidungen

1. **Middleware-Reihenfolge** in `app.ts` (nach 033a; `app.use` in dieser Reihenfolge):
   (1) Zugriffslog/Korrelation/`X-Server-Time` (033a, unverändert äußerste) → (2) Sicherheitsheader → (3) Request-Timeout
   → (4) Body-Limit → (5) Grenze für nicht angemeldete Anfragen und Anmeldestart → (6) CORS (heute nur Demo; 034b) →
   (7) Akteur und Fehler (bestehend) → (8) Schreibgrenze je Subject → Routen mit `guarded(operationId)` (takt-024,
   unverändert). Damit kostet eine abgewiesene Anfrage weder Sitzungslesung noch Datenbankverbindung noch die globale
   Schreibsperre (`pg_advisory_xact_lock`). Neuer Code liegt in `apps/api/src/limits/` (reine Zähler mit injizierter
   Uhr, Middleware-Fabriken); `app.ts` verdrahtet nur.
2. **Schreibgrenze je Subject (429).** Gilt für `POST`, `PUT`, `PATCH`, `DELETE` unter `/v1/` mit ermitteltem Akteur,
   auch im Demo-Modus und für künftige Systemakteure (T-G3-D-02); `/auth/logout` ist ausgenommen (Abmelden muss immer
   gehen). Schlüssel ist der `subjectHash` aus 033a (HMAC der Actor-ID), nie die Actor-ID selbst. Lesen wird je Subject
   nicht begrenzt (Standard; Planziel nennt nur Schreibvorgänge; Restrisiko unten). Eine Wiederholung mit gleichem
   `Idempotency-Key` zählt wie jeder Schreibvorgang. Die Prüfung liegt vor `guarded`, also vor Vertragsprüfung und
   Postgres-Grenze: ein 429 schreibt kein Ereignis und hinterlässt keinen Idempotenz-Eintrag.
3. **Grenze für nicht angemeldete Anfragen je Quelle (429).** *Quelle* ist die Gegenstelle der TCP-Verbindung
   (`getConnInfo` aus `@hono/node-server/conninfo`, Option `sourceOf` in `CreateAppOptions` für Tests; ohne
   ermittelbare Adresse der Schlüssel „unbekannt“). IPv4-gemappte IPv6-Adressen zählen als IPv4, IPv6 wird auf das
   /64-Präfix gekürzt. Hinter einem Proxy liefert 034b die Auswertung von `X-Forwarded-For`; bis dahin gilt die
   Verbindungsadresse. *Nicht angemeldet* heißt: die Anfrage trägt kein Anmeldematerial (kein syntaktisch gültiges
   `hv_session`-Cookie laut `sessionTokenFromCookie`, im Demo-Modus kein `X-Actor`) — solche Anfragen werden **vor** der
   Auth-Stufe gezählt und bei erschöpftem Kontingent mit 429 abgewiesen. Anfragen **mit** Anmeldematerial laufen immer in
   die Auth-Stufe (Arbeitsplätze hinter derselben NAT-Adresse bleiben arbeitsfähig); steht danach kein Akteur fest
   (`subjectHash` null, z. B. 401), zählt die Anfrage nachträglich gegen die Quelle. Öffentliche Routen (`/healthz`,
   `/readyz`, `/auth/*` ohne Sitzung, `/metrics` aus 033b) zählen ebenso. **Datenschutz:** Die Zählerschlüssel sind
   HMAC-SHA-256 der Quelle mit einem je Prozess zufälligen Schlüssel; die Quelle steht nie im Zugriffslog, im Fehlerlog,
   auf stderr, in `/metrics` oder auf der Platte (ADR 0013: Zähler flüchtig, nicht im Auswertungskatalog).
4. **Anmeldestart `GET /auth/login` (429, Befund 029b).** Zusätzlich zu Punkt 3 zwei eigene Zähler: je Quelle und
   gesamt. Ist einer erschöpft, antwortet der Dienst 429, bevor `authorizationUrl` oder `createLoginState` laufen
   (kein Datenbankzugriff, keine IdP-Anfrage). Damit ist die Tabelle `auth_login_states` im Dauerzustand begrenzt auf
   etwa 600 je Minute × 5 Minuten Lebensdauer = 3 000 offene Zeilen zuzüglich höchstens eines Aufräumrückstands.
5. **Aufräumen der Login-Zustände (Befund 029b).** Die Laufzeitrolle bekommt **kein** DELETE-Recht auf
   `auth_login_states` (bleibt wie in `grantRuntimeAccess` und `assertRuntimePrivileges` geprüft). Stattdessen legt eine
   neue Migration `0003_auth_login_purge` unter der Migrations-/Owner-Rolle eine Funktion
   `auth_purge_login_states(p_now timestamptz) RETURNS integer` an: `LANGUAGE sql SECURITY DEFINER`,
   `SET search_path = pg_catalog, pg_temp`, Tabelle schema-qualifiziert, löscht nur Zeilen mit
   `consumed_at IS NOT NULL OR expires_at <= p_now`, höchstens 500 je Aufruf (älteste `expires_at` zuerst), gibt die
   Anzahl zurück; `REVOKE ALL ON FUNCTION … FROM PUBLIC`, `GRANT EXECUTE` nur an die Laufzeitrolle in
   `grantRuntimeAccess`; dazu ein Index auf `expires_at`. `assertRuntimePrivileges` prüft zusätzlich: EXECUTE auf genau
   dieser Funktion vorhanden, weiterhin kein DELETE auf irgendeiner Tabelle. `AuthStore.createLoginState` ruft die
   Funktion mit dem `now` der injizierten Uhr **vor** dem INSERT auf (R8; kein Zeitgeber, kein Hintergrundjob). Ein
   Fehler beim Aufräumen blockiert die Anmeldung nicht (Standard „best effort“): INSERT läuft weiter, stderr erhält je
   Minute höchstens die feste Zeile `HV-Tool API: login state purge failed.` **Begründung des Wegs:** R7 gilt dem
   Ereignislog; Login-Zustände sind kurzlebige technische Einmalwerte (5 Minuten, verschlüsselt), deren Löschen keinen
   Nachweis umschreibt. Eine SECURITY-DEFINER-Funktion mit fester Bedingung ist enger als ein Tabellenrecht: selbst
   eine kompromittierte Laufzeitrolle kann nur verbrauchte oder nach ihrem `p_now` abgelaufene Zustände entfernen
   (Restrisiko: ein vorgestelltes `p_now` entfernt laufende Anmeldungen, Folge: erneutes Anmelden; geringer als das,
   was die Rolle mit INSERT auf `auth_sessions` ohnehin kann). Down-Migration entfernt Funktion und Index und ist ohne
   Datenprüfung erlaubt (keine Tabelle); `migrations.ts` behandelt Version 3 in `up`, `down` und
   `assertSchemaConsistent` (Funktion vorhanden genau dann, wenn Version 3 angewandt).
6. **Body-Limit 256 KiB (413).** Hono `bodyLimit` (`hono/body-limit`, keine neue Abhängigkeit) mit `maxSize: 262144`
   und eigener Fehlerantwort (Problem 413). Mit `Content-Length` > Grenze sofort 413, ohne den Body zu lesen; ohne
   `Content-Length` (chunked) bricht das Lesen beim ersten Byte über der Grenze ab. Genau 262 144 Byte werden
   angenommen (danach entscheidet Vertragsprüfung bzw. Domäne). Ein 413 erreicht weder Auth noch Domäne noch Datenbank.
7. **Request-Timeout (408) ohne Festschreiben.** Eigene Middleware (nicht `hono/timeout`, weil diese den Handler nur
   überholt): ein Zeitgeber je Anfrage; läuft er ab, setzt die Middleware im Anfragekontext (033a,
   `observability/context.ts`) die Phase `timedOut` und antwortet mit Problem 408, **außer** die Postgres-Grenze hat die
   Phase `committing` gesetzt — dann wartet sie auf das Ende des COMMIT (durch `statement_timeout` begrenzt) und gibt
   dessen Ergebnis zurück. `postgresBoundary` prüft vor `COMMIT` die Phase: bei `timedOut` → `ROLLBACK`, kein
   `noteSeq`. Zusage: **ein 408 bedeutet „nichts festgeschrieben“** im Postgres-Pfad; ein erneuter Versuch mit
   demselben `Idempotency-Key` führt genau einmal aus. Im JSONL-Entwicklungsadapter und im In-Memory-Pfad wird diese
   Zusage nicht gegeben (der Bericht nennt es). Das Zugriffslog schreibt genau eine Zeile mit Status 408; ein später
   fertig werdender Handler ändert weder Antwort noch Log-Zeile. Eine Ausnahmeliste für Pfade ohne Timeout ist
   vorbereitet und leer (035 trägt `/v1/stream` ein). Der Node-Server erhält in `server.ts` `headersTimeout` und
   `requestTimeout` (Tabelle) gegen langsam tröpfelnde Header und Bodies.
8. **Postgres-Pool-Timeouts.** Die Pool-Optionen entstehen in einer testbaren Funktion unter `apps/api/src/limits/`
   (Werte aus der Tabelle, `connectionTimeoutMillis` 2 000 und TLS wie heute); `server.ts` nutzt sie. Die Werte werden
   als Verbindungsparameter gesetzt (`statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` der
   `pg`-Client-Konfiguration). Der Pool der Migrations-CLI bleibt unverändert (DDL darf länger laufen). Ein Abbruch
   durch `statement_timeout` oder `lock_timeout` endet wie heute als 500 mit festem Text „Persistence is
   unavailable.“ ohne Treiberdetails (T-G2-I-02).
9. **Sicherheitsheader auf jeder Antwort.** Eine Middleware setzt nach `await next()` auf **jede** Antwort (2xx, 3xx,
   4xx, 5xx, `notFound`, `onError`, 408, 413, 429, die von der Postgres-Grenze ersetzte Antwort) genau diese Werte,
   sofern der Header noch fehlt:
   - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: no-referrer`
   - `Cross-Origin-Resource-Policy: same-origin`
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Strict-Transport-Security: max-age=31536000` (ohne `includeSubDomains` und `preload`: der Dienst kennt die
     Nachbardomänen des Eigentümers nicht; Browser werten den Header nur über HTTPS aus)
   - `Cache-Control: no-store` (Entwürfe und Rechtstexte dürfen in keinem Cache liegen; die bestehenden `no-store`
     der Anmeldepfade bleiben unverändert, kein doppelter Header)

   Die CSP gilt den Antworten des Dienstes (JSON, Problem-Details, Weiterleitungen); der Dienst liefert kein HTML. Die
   CSP für das Dokument der Weboberfläche und der CSP-Report im e2e-Lauf gehören zu 037 (`netlify.toml` bzw. Container,
   Produktions-Build; der Vite-Entwicklungsserver der e2e-Suite braucht Inline-Skripte). Keine neue Abhängigkeit;
   `hono/secure-headers` nur mit ausdrücklich gesetzten Werten, sonst eigene Middleware.
10. **Antworten 429, 408, 413.** Problem-Details (RFC 9457) mit `status` 429/408/413, festem `title`/`detail` ohne
    Wert der Grenze oder der Quelle, `instance` wie in 033a, **ohne** `ruleId` (keine fachliche Regel). 429 trägt
    `Retry-After` (ganze Sekunden bis Fensterende, 1–60). CORS im Demo-Modus nimmt `Retry-After` in `exposeHeaders` auf.
11. **Zugriffslog bei Flutung.** Jede Anfrage erzeugt weiter genau eine Zeile (033a), mit einer Ausnahme: nach der
    **ersten** 429-Abweisung einer nicht angemeldeten Quelle in einem Fenster werden weitere Abweisungen **derselben**
    Quelle (bzw. des Überlaufschlüssels) im selben Fenster nicht einzeln protokolliert. Stattdessen schreibt der Dienst
    je Minute höchstens eine feste stderr-Zeile `HV-Tool API: anonymous rate limit reached; repeated rejections are not
    logged individually.` Begründung: ohne diese Ausnahme schützt die Grenze die Datenbank, nicht aber den
    Log-Datenträger (033a Nicht-Ziel, T-G2-D-04). Relevante Zeilen gehen nicht verloren: angemeldete Anfragen, jede
    erste Abweisung je Quelle und Fenster und alle Schreibabweisungen je Subject werden protokolliert. Die Schlüsselmenge
    der Log-Zeile bleibt exakt die aus 033a (`v` bleibt 1). Weitere feste stderr-Zeilen, je höchstens eine je Minute,
    ohne Quelle, Subject oder Zahl: `HV-Tool API: write rate limit reached.`, `HV-Tool API: sign-in start limit
    reached.`, `HV-Tool API: rate limit key table full.`
12. **Speichergrenze der Zähler.** Zähler liegen im Prozessspeicher, werden beim Fensterwechsel verworfen und halten je
    Zähler höchstens 10 000 Schlüssel; jeder weitere neue Schlüssel im selben Fenster zählt auf einen gemeinsamen
    Überlaufschlüssel mit derselben Grenze (unter einer Flut aus rotierenden Adressen werden neue Quellen gemeinsam
    gebremst, bekannte behalten ihren Zähler). Kein persistenter Zähler, keine Kennzahl, kein Eintrag im
    Auswertungskatalog (ADR 0013). Mehrere Prozesse vervielfachen die Grenze (Beta: ein Prozess, 037); im Bericht nennen.
13. **Vertrag (Patch-Stufe, aktueller Stand + 1 zum Bauzeitpunkt).** Heute 0.3.8; plant 033b eine Ausnahmeänderung
    (0.3.9), wird 034a entsprechend 0.3.10. Inhalt:
    - neue gemeinsame Antworten `TooManyRequests` (429, Header `Retry-After` Pflicht, Muster `^[1-9][0-9]?$`, Werte
      1–60), `RequestTimeout` (408) und `PayloadTooLarge` (413), je mit `X-Server-Time` und Problem-Schema mit
      `status`-`const`; 408 und 429 an **jeder** Operation, 413 an jeder Operation mit `requestBody`;
    - `info.description`: Absatz „Limits (since <Version>, slice 034a)“ mit Body-Limit, Timeout, den drei
      Kontingentarten ohne feste Zahl („configurable, defaults in the service“), Sicherheitsheadern und der
      **Doppelklickschutz-Konvention**: ein Client erzeugt je Nutzerabsicht (Tastendruck) genau einen
      `Idempotency-Key`, verwendet ihn bei Wiederholung nach 408, 429, 5xx oder Netzfehler erneut und nie für eine
      zweite Absicht; 408 und 429 verbrauchen keinen Schlüssel;
    - `IdempotencyKey`-Parameter `minLength: 1` (Folgeliste 024; die Domäne lehnt `""` seit 028 mit 422 ab, am Draht
      ändert sich nichts);
    - Längen- und Listengrenzen in Anfrageschemas (Tabelle unten). Die Domäne prüft davon heute nur
      `revokeRole.reason` ≤ 500 (takt-028) und Kennungen ≤ 128; der Demo-Pfad im Browser validiert nicht gegen den
      Vertrag und nimmt längere Texte weiter an (Abweichung benannt, Folgeliste: Kernprüfung derselben Grenzen mit 043);
    - `pnpm contract:types`, CHANGELOG-Abschnitt mit „Added“ (Antworten, Konvention) und „Changed“ (engere
      Anfrageschemas ausdrücklich benannt), `package.json`-Version, die festen Versionsaussagen in `contract.test.ts` und
      `takt-019-contract.test.ts`.

    Ob eine Einschränkung von Anfrageschemas nach ADR 0015 eine Patch-Stufe ist, ist dieselbe offene
    Eigentümerfrage wie bei 0.3.4/0.3.6 (Bautag 27.–29.09.); Standard hier: Patch, weil jede Grenze weit über
    realen Eingaben liegt und der Dienst bisher unbegrenzt annahm (Sicherheitskorrektur, SP-2).

| Feld (Anfrageschema) | Grenze |
|---|---|
| `LegalClearanceRequest.note`, `MeetingContributionCapture.lateEntryReason`, `reason` in `revokeRole`, `returnQuestion`, `withdrawQuestion` | `maxLength: 500` |
| `ContributionCapture.text`, `MeetingContributionCapture.text` | `maxLength: 60000` |
| `QuestionCapture.text` | `maxLength: 4000`; Liste `questions` in `captureQuestions` `maxItems: 200` |
| `AnswerDraft.text` | `maxLength: 20000`; `AnswerDraft.sources` `maxItems: 50`, je Eintrag `maxLength: 2000` |
| `SpeakerRegistration.displayName`, `SpeakerRegistration.organisation`, `MeetingCreate.title`, `MeetingCreate.legalEntity`, `UnitInput.name` | `maxLength: 200` |
| `AgendaItemInput.title` | `maxLength: 500` |
| `StageSeatInput.label` | `maxLength: 100`; `UnitInput.shortName` `maxLength: 32` |
| Kennungen: `ContributionCapture.speakerId`, `MeetingContributionCapture.speakerId`, `Classification.agendaItemId`, `unitId` in `assignQuestion`, `intoQuestionId` in `mergeQuestion`, `MeetingCreate.cloneFromMeetingId`, `AgendaItemInput.id`, `UnitInput.id`, `StageSeatInput.id`, `StageSeatInput.personId`, `StageSeatInput.deviceId`, `RoleAssignmentCreate.personId`, `RoleAssignmentCreate.unitId`, Einträge von `SpeakerOrder.speakerIds` | `maxLength: 128` |
| `SpeakerOrder.speakerIds` | `maxItems: 2000` |
| Listen in `replaceMeetingAgendaItems`, `replaceMeetingUnits`, `replaceMeetingStageSeats` | `maxItems: 200` (Sitze: `maxItems: 50`) |
| Abfrageparameter `FullTextFilter` (`q`) | `maxLength: 200` |

Worst Case: 60 000 Zeichen zu je 4 Byte UTF-8 = 240 000 Byte < 262 144; bei pathologischer JSON-Maskierung greift
das Body-Limit zuerst (413 statt 422, beides ohne Wirkung).

## Nicht-Ziele

Kein Konfigurationsschema, keine `.env.example`, keine Auswertung von `X-Forwarded-For`, keine CORS-Allowlist aus
Konfiguration, keine Prüfung der Verzeichnisrechte (alles 034b). Keine CSP für das Web-Dokument, kein
`netlify.toml`, kein CSP-Report in e2e, keine Grenze an einem vorgeschalteten Proxy, kein Alarm auf die festen
stderr-Zeilen (037). Kein SSE und keine Grenze offener Ströme je Subject (035). Keine Lesegrenze je Subject. Keine
Kennzahl und kein Katalogeintrag für Rate-Limit-Zähler (ADR 0013). Keine neue Regel-ID, keine Rechteänderung, keine
Änderung an Ereignissen oder Übergängen. Keine Längenprüfung im Kern über takt-028 hinaus. Keine neue Abhängigkeit.
Keine Oberflächenänderung (die Weboberfläche zeigt 408/413/429 über die bestehende Fehleranzeige; eigene Texte sind
eine Folgescheibe der Lane web-api).

## Bedrohungen, Missbrauchsfall und Test je ID

| ID | Rolle in 034a | Test (Datei) |
|---|---|---|
| T-G1-D-01 | schließen (Rest: Lesen je Subject, gefälschte Cookies, mehrere Prozesse; Proxy-Grenze 037) | 61. Schreibvorgang desselben Subjects im Fenster → 429 mit `Retry-After` = Rest bis Fensterende (injizierte Uhr, z. B. 15 s im Fenster → 45), kein neues Ereignis, kein Idempotenz-Eintrag, nächstes Fenster wieder 201; anderes Subject unberührt; `/auth/logout` und Lesen nie 429; 262 145 Byte → 413 mit und ohne `Content-Length`, 262 144 Byte → kein 413; Text mit 60 001 Zeichen → 422; langsamer Handler → 408 (`limits034a.test.ts`); 408 im Postgres-Pfad ohne festgeschriebenes Ereignis, verzögertes COMMIT → 201 statt 408 (`postgres-limits034a.test.ts`) |
| T-G1-I-06 | schließen (Anteil Dienst; Web-Dokument 037) | Header-Probe: alle acht Header mit exakten Werten auf 200, 201, 302 (`/auth/login` mit Test-IdP), 401, 404 (`notFound`), 408, 413, 422, 429, 500 (`onError`), `/healthz`, `/readyz`; `Cache-Control` der Anmeldepfade genau einmal `no-store` (`contract.test.ts`, Block „034a security headers“) |
| **T-G1-D-05 (neu)** | schließen | 61. `/auth/login` derselben Quelle → 429, `createLoginState` nicht aufgerufen (Test-Store zählt); 601. gesamt über viele Quellen → 429 (`limits034a.test.ts`); verbrauchte und abgelaufene Zeilen werden beim nächsten Anmeldestart entfernt, gültige bleiben, höchstens 500 je Aufruf; Laufzeitrolle: `DELETE FROM auth_login_states` → Rechtefehler, `EXECUTE` der Funktion erlaubt, andere Rolle ohne EXECUTE; Aufräumfehler blockiert die Anmeldung nicht (`postgres-limits034a.test.ts`); neue Zeile im Bedrohungsmodell |
| T-G2-D-04 | berührt (Anteil 034a: Grenze je Quelle, Protokollausnahme Punkt 11) | 301. nicht angemeldete Anfrage derselben Quelle → 429; 302.–400. erzeugen **keine** weitere Log-Zeile, genau eine feste stderr-Zeile je Minute; Anfrage mit gültiger Sitzung aus derselben Quelle → 200 mit Log-Zeile; andere Quelle unberührt; keine Log- oder stderr-Zeile enthält die Quelladresse (Marker-Adresse über `sourceOf`) (`limits034a.test.ts`) |
| T-G3-D-02 | berührt | Schreibgrenze greift für jeden Akteur unabhängig von der Rolle (zwei Akteure mit verschiedenen Rollen, je eigener Zähler; kein Rollenname im Code, R4) (`limits034a.test.ts`) |
| T-G3-D-01 | berührt | hängende Prüfung (`readiness`-Injektion mit 200 ms, Timeout-Option 50 ms) → 408 statt Warten (`limits034a.test.ts`) |
| T-G1-T-06 | berührt (CSP am Dienst; Web 037) | CSP-Wert in der Header-Probe (`contract.test.ts`); Zeile im Bedrohungsmodell nennt 037 für den e2e-Report |
| T-G2-I-02 | berührt | Abbruch durch `statement_timeout` (`pg_sleep` über injizierten Testweg) → 500 mit festem Text, kein Treibertext in Antwort und Log (`postgres-limits034a.test.ts`) |
| T-G1-D-03 | berührt (Anteil Rate-Limit; Ströme 035) | durch die Tests zu T-G1-D-01 abgedeckt |

Zähler und Speicher: 10 000 verschiedene Quellen in einem Fenster, die 10 001. teilt den Überlaufschlüssel, feste
stderr-Zeile „key table full“ einmal; nach Fensterwechsel ist die Tabelle leer (`limits034a.test.ts`, reine Funktion
mit injizierter Uhr). Zeitgrenzen-Reihenfolge und Pool-Parameter: `SHOW statement_timeout` = `5s`, `SHOW lock_timeout`
= `3s`, `SHOW idle_in_transaction_session_timeout` = `15s` über den Pool aus der Fabrik (`postgres-limits034a.test.ts`).

**Missbrauchsfall (SC-06), neu MF-10 „Flutung ohne Anmeldung“** (Zeile im Bedrohungsmodell Abschnitt 7 legt diese
Scheibe an; verwandt MF-09): Eine Person im internen Netz oder mit Zugang zur Staging-Adresse ruft `GET /auth/login`
und beliebige Pfade in einer Schleife auf. Ohne 034a entsteht je Anmeldestart eine Datenbankzeile und eine
IdP-Weiterleitung, je Anfrage eine Zugriffslog-Zeile; Tabelle und Log-Datenträger laufen voll, die Anmeldung der
Arbeitsplätze am HV-Tag wird langsam. *Verhindert durch:* T-G1-D-05 (Grenzen je Quelle und gesamt, Aufräumen), die
Grenze für nicht angemeldete Anfragen je Quelle vor Auth und Datenbank, die Protokollausnahme (Punkt 11), 413 und 408.
*Erkennung:* feste stderr-Zeilen „anonymous rate limit reached …“ und „sign-in start limit reached.“ (je Minute
höchstens eine, ohne Quelle und ohne Person) und die erste 429-Zeile je Quelle und Fenster im Zugriffslog
(`operationId`, `status` 429, `subjectHash` null) — Erkennung ohne Kennzahl je Person (ADR 0013). *Signal und
Empfänger:* bis 037 liest der technische Betrieb stderr beim Tagesstart und im HV-Fenster; mit 037 alarmiert die
Betriebsauswertung die benannte Beobachterin auf diese Zeilen. *Ausnahme mit Eigentümer und Ablauf:* die fehlende
Alarmierung ist eine befristete Ausnahme, Eigentümer technischer Betrieb, Ablauf mit Merge von 037, spätestens
30.10.2026. *Nachweis:* Tests zu T-G1-D-05 und T-G2-D-04.

Verwandter Fall ohne neue ID: eine gestohlene Sitzung setzt skriptgesteuert Schreibvorgänge ab (MF-02-Nähe). Die
Schreibgrenze bremst auf 60 je Minute; Erkennung über die feste stderr-Zeile „write rate limit reached.“ ohne Subject;
eine Zuordnung zur Person nur über das Verfahren „Auswertung nur zu zweit“ (ADR 0013), nie automatisch.

## Files allowed

- `docs/slices/034a-grenzen-timeouts-sicherheitsheader.md`
- `apps/api/src/app.ts` (Middleware-Reihenfolge, Optionen für Grenzen, Timeout, Quelle; Phasenprüfung vor COMMIT in der Postgres-Grenze; Anmeldestart-Grenze; Retry-After in den CORS-exposeHeaders der Demo)
- `apps/api/src/server.ts` (Pool aus der Fabrik, headersTimeout und requestTimeout des Node-Servers, sonst unverändert)
- `apps/api/src/limits/**` (neu: Zähler, Quelle, Middleware für Schreibgrenze, Quellgrenze, Body-Limit, Timeout, Sicherheitsheader, Pool-Optionen)
- `apps/api/src/observability/context.ts` (nur Phase der Anfrage und Kennzeichen für die Protokollausnahme)
- `apps/api/src/observability/requestLog.ts` (nur die Protokollausnahme aus Punkt 11)
- `apps/api/src/problem.ts` (nur zusätzliche Antwortheader wie Retry-After)
- `apps/api/src/auth/store.ts` (nur Aufruf der Aufräumfunktion in createLoginState mit stderr-Zeile)
- `apps/api/migrations/0003_auth_login_purge.up.sql`, `apps/api/migrations/0003_auth_login_purge.down.sql` (neu)
- `apps/api/src/persistence/migrations.ts` (Migrationsliste, Down-Zweig und Konsistenzprüfung für Version 3, GRANT EXECUTE in grantRuntimeAccess)
- `apps/api/src/persistence/postgres.ts` (nur die EXECUTE-Prüfung in assertRuntimePrivileges)
- `packages/contract/openapi.yaml`, `packages/contract/CHANGELOG.md`, `packages/contract/package.json`, `packages/contract/src/types.ts` (generiert)
- `apps/api/src/__tests__/contract.test.ts` (Versionsaussage, generierte Status um 408/413/429 erweitert, Header-Probe)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur die feste Versionsaussage)
- `apps/api/src/__tests__/limits034a.test.ts`, `apps/api/src/__tests__/postgres-limits034a.test.ts` (neu)
- `apps/api/src/__tests__/helpers.ts` (nur falls die Antwortprüfung den Pflichtheader Retry-After nicht bereits über den Vertrag prüft)
- `apps/api/src/__tests__/migrations027.test.ts` (nur falls der Auf-/Ab-/Auf-Test mit Version 3 eine feste Annahme ändert; keine Abschwächung)
- `apps/api/src/__tests__/*.test.ts` (nur eine ausdrückliche Grenzen-Option im createApp-Aufruf eines bestehenden Tests, der mehr als 60 Schreibvorgänge je Akteur in einem Fenster der injizierten Uhr ausführt; jede solche Datei mit Grund im Bericht)
- `.github/workflows/gates.yml` (nur `postgres-limits034a.test.ts` in den Postgres-Schritt aufnehmen)
- `docs/sicherheit/bedrohungsmodell.md` (nur Status und Nachweise der oben genannten IDs, neue Zeile T-G1-D-05, neuer Missbrauchsfall MF-10, BF-05 und BF-06 (Anteil Dienst), Abschnitt-6-Zeile 034 auf 034a/034b, T-G1-T-06 „e2e-Report 037“)
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde dieser Scheibe und der Punkt „Kernprüfung der Vertragsgrenzen“)

Weitere Dateien sind Scope-Befunde: erst Spec klären, nicht still ausweichen.

## Vor dem Bau prüfen

1. `git log --oneline origin/claude/dax-shareholder-meeting-workflow-0s934z`: Sind 033b, takt-028 und takt-029
   gemergt? Auf den dann aktuellen Kopf aufsetzen. takt-029 ändert `app.ts` (Auth-Middleware für `/auth/me`,
   503 im Callback); die neue Middleware-Reihenfolge baut auf diesem Stand auf. Ist takt-028 nicht gemergt, prüft die
   Domäne `revokeRole.reason` noch nicht; die Vertragsgrenze gilt am Dienst trotzdem.
2. Vertragsversion: `grep -n "^  version:" packages/contract/openapi.yaml` (heute 0.3.8). Neue Version = aktueller
   Stand + 1 Patch; `packages/contract/scripts/check.mjs` (Version, CHANGELOG) grün.
3. `grep -rn "readiness:\|clockHealth\|requestTimeout" apps/api/src/__tests__`: bestehende Injektionen bleiben gültig.
4. Grenzen gegen die bestehende Suite: `pnpm --filter @hv/api test` einmal mit den Standardgrenzen laufen lassen.
   Fällt ein Test wegen mehr als 60 Schreibvorgängen je Akteur im Fenster der festen Testuhr, erhält nur dieser
   `createApp`-Aufruf eine ausdrückliche höhere Grenze mit Kommentar (Files allowed); keine globale Abschaltung und
   kein Standard „aus“ in `createApp` (der Standard ist „an“, wie der Prozessstart).
5. Tests mit festen Headern oder Zahlen: `auth-029b.test.ts:233` (`Cache-Control` genau `no-store`),
   `platform033a.test.ts:106-108` (`exposeHeaders` mit `toContain`), `access-log033a.test.ts` (exakte Schlüsselmenge,
   „genau eine Zeile je Anfrage“ — die Ausnahme aus Punkt 11 betrifft nur erschöpfte Quellen und darf diese Tests
   nicht berühren), `read-rights.test.ts:246-249` (Problem-Bodies ohne `ruleId`-Änderung), `migrations027.test.ts`
   (Auf/Ab/Auf), `postgres-auth-029b.test.ts` (Rechte der Laufzeitrolle), `contract.test.ts:339-359` (generierte
   Status). Jede nötige Änderung außerhalb der Files allowed ist ein Scope-Befund.
6. `@hono/node-server/conninfo` liefert unter `app.request()` keine Adresse: Tests setzen `sourceOf`; der Standard
   „unbekannt“ darf keinen Test verfälschen, der viele Anfragen ohne Anmeldung sendet (höchstens 300 je Fenster).
7. `pnpm now-check`: Zähler und Timeout rechnen mit der injizierten Uhr; ein Zeitgeber (`setTimeout`) ist erlaubt,
   eine Wanduhr in `apps/api/src/limits/` nicht.
8. Migrationsrolle in CI: ist die Owner-Rolle ein Superuser, läuft die SECURITY-DEFINER-Funktion mit diesen Rechten;
   die feste Bedingung und der gesetzte `search_path` begrenzen das. Im Bericht nennen; die Trennung der Owner-Rolle
   vom Superuser ist 037/038.
9. `node scripts/slice-scope.mjs` auf dem Baubranch `claude/slice-034a-…` grün.

## Tests zuerst und Abnahme

1. Vor der Implementierung rot: `limits034a.test.ts` (Schreibgrenze, Quellgrenze mit und ohne Anmeldematerial,
   Anmeldestart je Quelle und gesamt, Protokollausnahme, keine Quelle in Log und stderr, Überlaufschlüssel,
   413 mit und ohne `Content-Length`, 422 für jede Grenze der Tabelle an mindestens einem Feld je Zeile, 408, feste
   stderr-Zeilen höchstens einmal je Minute), Header-Probe in `contract.test.ts`, erweiterte generierte Status (408/429
   an jeder Operation, 413 an jeder mit `requestBody`).
2. Postgres in CI: `postgres-limits034a.test.ts` belegt Pool-Parameter, 408 ohne COMMIT, verzögertes COMMIT → 201,
   `statement_timeout`-Abbruch ohne Treibertext, `lock_timeout` an einer künstlich gehaltenen Schreibsperre → 500 nach
   ≤ 3 s + Toleranz, Migration 0003 auf/ab/auf, Funktion löscht nur verbrauchte und abgelaufene Zeilen (höchstens 500),
   Laufzeitrolle ohne DELETE, mit EXECUTE, PUBLIC ohne EXECUTE, `assertRuntimePrivileges` schlägt fehl, wenn EXECUTE
   fehlt oder DELETE vorhanden ist. Keycloak-Lauf in CI bleibt grün.
3. Operation-Coverage und Vertrags-Tor grün; `pnpm gates` auf sauberem Baucommit grün, wörtlicher Schluss im Bericht;
   vollständige E2E-Suite, soweit ein Browser verfügbar ist (keine Oberflächenänderung, kein Screenshot nötig).
   Manuelle Probe gegen `pnpm --filter @hv/api dev`: `curl -si /healthz` (alle acht Header), 301 × `curl /healthz`
   aus einer Quelle → 429 mit `Retry-After`, `curl -s -X POST --data-binary @<262145 Byte> /v1/contributions` → 413;
   Ausgaben gekürzt im Bericht.
4. Unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb; Blocker/Major sowie jede Sicherheits-,
   Datenschutz- oder Rechtsfrage vor Merge, übrige Befunde in `docs/folgeliste.md`. PR-CI auf dem letzten Commit grün.
   Jeder Commit nennt „Scheibe 034a“ und endet `[skip netlify]`. Kein Deploy.

## Nachweise

`pnpm gates`-Schluss, Testnamen je Bedrohungs-ID, `curl`-Ausgaben (Header, 429, 413), Postgres-CI-Schritt mit
`postgres-limits034a.test.ts`, Keycloak-CI-Schritt grün, CHANGELOG-Abschnitt der neuen Vertragsversion.

## Nachweis

(nach dem Bau: **Gates-Commit** `<sha>` auf sauberem Baum, Umgebung (Postgres-Variablen), Anzahl Testdateien/Tests,
`slice-scope`-Ergebnis, und der wörtliche Schluss der Ausgabe von `pnpm gates` in einem Codeblock; eigener
Doku-Commit, kein Amend danach)

## Bericht (nach Bau ausfüllen)

```
Slice: 034a-grenzen-timeouts-sicherheitsheader
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; Postgres- und Keycloak-CI-Lauf; curl-Proben
Bedrohungs-ID → Test: <je Zeile der Tabelle oben>
Open: Lesen je Subject unbegrenzt; Flut mit gefälschten Sitzungscookies kostet je Anfrage eine Sitzungslesung (Proxy-Grenze 037); mehrere Prozesse vervielfachen die Grenzen; 408-Zusage nur im Postgres-Pfad; Alarm auf die festen stderr-Zeilen 037 (Ausnahme bis 30.10.2026); CSP des Web-Dokuments und e2e-Report 037; Kernprüfung der Vertragsgrenzen (Folgeliste); Patch-Stufe für engere Anfrageschemas (Eigentümerfrage ADR 0015)
Touched: <Dateiliste>
```

## Review findings

folgt
