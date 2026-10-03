# Scheibe 065a — Ereignisstrom für Nachbarn: signierte Webhooks und Partnerleitfaden (Teil 1 von 065)

**Status:** spec (03.10.2026; gelesen auf `2fc3153`; Teil 1 der geteilten Scheibe 065, Zuschnitt im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 3 AStd (Teil a; Schätzung 065b rund 1,5 AStd; Summe 4,5 statt 2 laut Plan) · Plan 065: 27.11.2026 (W9); für die Freigabe-Demo vorgezogen (Eigentümer 03.10.2026, Plan §11, Punkt 2 „Entwickler“); frühestens nach dem Merge von 043a (Vertrag 0.4.0) und nach dem Vertragsschritt von 064 · Lanes: contract (erster Commit, Architekt); core (seriell, Wahrheitstabelle); service; web-shell (nur zwei Anzeigeschlüssel); infra (nur die zwei neuen Skriptdateien); docs-integration; docs-sicherheit; docs-plan (nur eine Glossarzeile)
**Rolle:** architect für den Vertragsschritt (erster Commit, vor jedem Code; AGENTS.md R6). Danach implementierer-backend. Review in frischem Kontext mit den Perspektiven **Security** (SSRF, Signatur, Secrets, Rechtefilter), **Datenschutz** (was an Dritte geht, SG3, SG8) und **Vertrag** (Webhook-Format, Partnerkompatibilität). Lesebefund der Spec vor dem Bau in eigenem frischem Kontext (Risikoklasse hoch, Plan §11 „Schlankerer Ablauf“ gilt hier nicht). Den Schnellstart im Leitfaden befolgt ein **eigener Agent in frischem Kontext**, nicht der Implementierer (Vorbild 037a, S17). Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** neu **R-PERM-05** (Webhook-Sichtbarkeit für Systemakteure) und **R-ADM-12** (Systemrolle nur für Systemsubjekte, Menschenrolle nie für Systemsubjekte). Beide Nummern sind beim Bau gegen den dann gemergten Stand zu prüfen (nächste freie Nummer; R-ADM-01..11 sind von 040a–040d belegt oder reserviert). Angewandt: R-PERM-01, R-PERM-02, R-PERM-03, R-PERM-04, R-ADM-07. Dazu AGENTS.md R2, R3, R4, R6, R7, R8, R10, R11, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 065 (Zeile 854–859), Eintrag 042 (Zeile 637–642), §5.7 Exit-Kriterien (Zeile 829–833), §11 „Freigabe-Demo“ (Register E57) und Etappe D
- ADR 0008 (Abschnitt „Ereignisstrom für Nachbarn“, verworfene Alternative „Unsignierte Webhooks“), ADR 0010 (Sandbox = `training`), ADR 0014 mit Ergänzung 035a/035b (R-PERM-04, Verteiler), ADR 0015 (Patch-Stufe, zwei Zyklen für Partner), ADR 0003 (Dienstrolle nur INSERT/SELECT), ADR 0013 (keine Kennzahl je Person)
- Specs 035a, 035b (Sichtbarkeit, `maskEvent`, Verteiler `apps/api/src/stream/hub.ts`), 043a (Maskierung der Begründung, Regel 1 des Zuschnitts, Tabelle „043c Partnerschnittstellen“), 044a (Maskierung von `QuestionLegalCleared.note` und `refusalJustification` in jedem Ereignis-Lesepfad), 034b (Konfigurationsschema, feste Sätze ohne Wert), 037a (lokales Betriebspaket, PR #124), 064 (Transkript-Ingest, parallel auf `claude-spec-064`)
- Bedrohungsmodell AK6, SG3, SG7, SG8, T-G3-T-03, T-G3-R-01, T-G3-I-01, T-G3-D-02, T-G3-E-01, T-G3-E-02, MF-05, BF-19
- Standard Webhooks, Fassung 1 (öffentliche Spezifikation des Signaturformats `webhook-id`/`webhook-timestamp`/`webhook-signature`, `whsec_`-Secrets); übernommen, damit Partner vorhandene Prüfbibliotheken nutzen können

**Depends on:** 035a, 035b, 029b, 034b, 040a (alle gemergt auf `2fc3153`); 043a (Vertrag 0.4.0, PR #125, muss gemergt sein); Vertragsschritt von 064 (Reihenfolge der Patch-Stufen: 064 vor 065a, Auftrag des Orchestrators). 044a ist keine harte Voraussetzung (die betroffenen Ereignistypen sind hier ausgeschlossen, siehe Entscheidung 4), wird aber in den Lecktests mitgeprüft, wenn es gemergt ist
**Perspektive:** Security, Datenschutz, Vertrag · **Glossar: neue Begriffe:** ja, eine Zeile: „Ereignis-Abonnent (Systemakteur)“ / „Event subscriber (system actor)“ / `event_subscriber`

## Teilung und Zuschnitt

Die Planzeile 065 (2 AStd) bündelt drei Dinge: signierte Zustellung mit Rechtefilter, den Sandbox-Mandanten und den
Leitfaden. Allein die Zustellung berührt Vertrag, Kern (neue Rolle, neues Recht, Wahrheitstabelle), Dienst (ausgehende
Anfragen mit SSRF-Schutz) und ein Partner-Skript. Der Sandbox-Mandant braucht dazu `HV_MODE=training`, das laut Plan erst
042 baut, und Änderungen am lokalen Paket aus 037a. Zusammen sind das rund 4,5 AStd. Deshalb wird 065 geteilt, **ein PR je
Spec** (R12). Diese Spec beschreibt Teil a vollständig; 065b steht hier als Zuschnitt, seine Spec schreibt der Architekt
auf eigenem Zweig, sobald 037a gemergt ist und der Eigentümer Frage 3 beantwortet hat.

| Teil | Inhalt | Klasse · AStd | Wann |
|---|---|---|---|
| **065a** (diese Spec) | Vertragsschritt (Rolle `event_subscriber`, Recht `webhook.receive`, Abschnitt `webhooks` mit Liefer- und Signaturformat); Systemrolle als Daten mit Guard R-ADM-12; Sichtbarkeitsregel R-PERM-05 als reine Funktion im Kern; Zustellung im Dienst (Konfiguration, Signatur, Wiederholung, Idempotenzschlüssel, SSRF-Schutz, Grenzen); Referenz-Empfänger `scripts/webhook-receiver.mjs` mit Prüffunktion; Leitfaden `docs/integration/webhooks.md` mit Schnellstart gegen den Dienst im Demo-Modus | hoch · 3 | nach 043a und dem Vertragsschritt von 064 |
| **065b** | Sandbox-Mandant: `HV_MODE` im Konfigurationsschema (nur, was die Sandbox braucht; Banner, Podium-Sperre und Löschprotokoll bleiben 042), Modusmarke in der Datenbank mit Startverweigerung bei Abweichung (Datengrenze), `mode: training` in jeder Lieferung, Webhooks im Modus `training` erlaubt, lokales Paket startet in `training` mit erzeugtem Webhook-Secret, optionalem Empfänger-Container und Rollenzuordnung des Abonnenten in der Befüllung; Leitfadenabschnitt „Sandbox“ und Verweis auf der Installationsseite | hoch · rund 1,5 | nach 065a und 037a |

**Warum so geschnitten.** 065a ist allein vorführbar: Ein Partner startet den Dienst im Demo-Modus (synthetischer Korpus,
`pnpm --filter @hv/api dev`), seinen Empfänger und sieht nach einem Klick in der Oberfläche signierte Lieferungen. 065b
fügt nur hinzu, was den Weg über das lokale Paket (037a) und die Datengrenze der Sandbox braucht. Wird 065b nicht vor der
Freigabe-Demo fertig, bleibt der Schnellstart aus 065a die Vorführung für Punkt 2.

**Was 065b vorfindet** (Hinweise an 065b, verbindlich für dessen Spec):
- Der Wert `training` steht schon in `WebhookEventDelivery.mode` (Vertrag aus 065a). 065b braucht keinen Vertragsschritt.
- Die Startbedingung „Webhooks nur mit synthetischen Daten“ (Entscheidung 9) ist in 065a eine Funktion
  `webhooksPermitted(config)` in `apps/api/src/webhooks/config.ts`; 065b erweitert sie um `HV_MODE=training`.
- Die Datengrenze: Marke `training`/`shadow`/`live` in einer eigenen Tabelle (Migration, Dienstrolle nur INSERT/SELECT,
  ADR 0003), geschrieben nur vom Migrations-CLI bei leerem Ereignislog, geprüft beim Start des Dienstes. Ein Dienst mit
  `HV_MODE=training` verweigert eine Datenbank ohne Marke `training`; jeder andere Modus verweigert eine Datenbank mit
  Marke `training`. Test: „Dienst `training` gegen Datenbank ohne Marke → Start verweigert“ und umgekehrt.
- Der Empfänger im Paket läuft als eigener Compose-Dienst `webhook-receiver` aus dem Node-Basis-Image (Digest) mit dem
  schreibgeschützt eingehängten `scripts/webhook-receiver.mjs`; Ziel `http://webhook-receiver:9900/hooks`; Secret einmal
  erzeugt in `state.json` wie die übrigen Secrets aus 037a (Entscheidung 7 dort).
- Die Rollenzuordnung des Abonnenten schreibt `scripts/stack-seed.mjs` mit derselben Form, die R-ADM-12 verlangt
  (Subjekt `sys_partner_sandbox`, ohne `personId`, ohne `unitId`, ohne Vertretung).
- Folgen für 042: 042 übernimmt `HV_MODE` aus 065b und ergänzt Banner, Podium-Sperre, Seed-Sperre und Löschprotokoll.
  Das ist eine Planabweichung (Eigentümerfrage 3).

## Befund (Ist-Stand, gelesen auf `2fc3153`)

1. **Kein Systemakteur, keine Zustellung nach außen.** `ROLE_PERMISSIONS` (`packages/domain/src/permissions.ts:22-93`)
   kennt neun Rollen, alle für Menschen. Im Dienst gibt es keinen ausgehenden HTTP-Aufruf außer OIDC (`auth/oidc.ts`) und
   NTP (`clock/ntp.ts`).
2. **Sichtbarkeit ist schon eine reine Funktion.** `visibleMessages` (`packages/domain/src/stream.ts:348-373`) gibt
   Inhabern von `event.read` das maskierte Ereignis (`maskEvent`, Zeile 180-190), allen anderen nur ein
   Änderungssignal. `resolveReaderActors` (Zeile 220-228) bestimmt den Akteur je Jahrgang aus aktiven Zuordnungen;
   eine Zuordnung endet mit Entzug, Ablauf oder dem Schließen des Jahrgangs (`activeAssignment`, Zeile 195-198).
3. **Der Verteiler aus 035b** (`apps/api/src/stream/hub.ts`) hält Projektionen aus einem geprüften Log, ruft
   `onBatch(batch, before, after, head)` synchron für jede registrierte Verbindung auf und beendet alle Verbindungen mit
   `reset` oder `unavailable`, wenn die Kette nicht mehr stimmt. Er läuft, solange mindestens eine Verbindung registriert
   ist (`running()`, Zeile 111).
4. **Zuordnungen** prüft `assignRole` (`packages/domain/src/api.ts:778-811`): pseudonymes Subjekt ohne `@`, bekannte
   Rolle, keine Selbstzuordnung (R-ADM-07). Angemeldete Subjekte heißen `oidc_<Hash>` (`apps/api/src/auth/oidc.ts:8-11`);
   ein Subjekt mit Präfix `sys_` kann also nie aus einer Anmeldung kommen. Im Demo-Modus nimmt `parseActorHeader`
   (`apps/api/src/actor.ts:11-29`) jede bekannte Rolle an.
5. **Konfiguration** (`apps/api/src/config/schema.ts`): ein Schema, feste Sätze ohne Wert, Drift-Test gegen
   `apps/api/.env.example`, unbekannte `HV_`-Variablen werden gemeldet.
6. **Kennzahlen:** Das Allowlist-Tor (`scripts/metrics-allowlist-check.mjs`) erlaubt nur die Labels `meeting_id` und
   `unit_id`. Eine Kennzahl je Abonnement ginge nur über eine Änderung des Tors; 065a fügt deshalb keine Kennzahl hinzu
   (Entscheidung 8).
7. **Bedrohungsmodell:** T-G3-T-03, T-G3-I-01, T-G3-E-02 sind „geplant in Scheibe 065“, BF-19 ist offen.
8. **`docs/integration/`** gibt es auf `2fc3153` noch nicht; 064 legt es an (`docs/integration/transkript.md`).

## Ziel

Ein Partner kann Ereignisse abonnieren und erhält sie als signierte Webhooks, nur so weit, wie die Rechte seines
Systemakteurs reichen. Er prüft das mit einem kleinen lokalen Empfänger aus dem Repositorium in wenigen Schritten gegen den
Dienst im Demo-Modus. Der Leitfaden erklärt Format, Signatur, Wiederholung, Reihenfolge, Lückenerkennung und
Secret-Wechsel und zeigt die Signaturprüfung in wenigen Zeilen.

## Entscheidungen vor Bau

### 1. Abonnement aus der Konfiguration, Systemakteur über eine Rollenzuordnung

- **Das Abonnement** (Ziel-URL, Ereignistypen, optional ein Jahrgang, Secret) steht **nur in der Konfiguration** des
  Dienstes (ADR 0008, T-G3-E-02). Es gibt keine Operation, die ein Abonnement anlegt oder ändert. Damit kann niemand über
  die Schnittstelle eine Ziel-URL setzen (SSRF über die API ist ausgeschlossen).
- **Der Systemakteur** ist ein Subjekt `sys_<name>` mit einer Zuordnung der Rolle `event_subscriber` im Jahrgang, angelegt
  wie jede Zuordnung über `assignRole` durch eine Person mit `admin.roles.manage`. Das ergibt:
  - Rechte sind Daten (R4): Das Bündel steht in `ROLE_PERMISSIONS`, der Dienst kennt keinen Rollennamen.
  - Entzug ohne Neustart: `revokeRole` beendet die Zustellung beim nächsten Stapel und vor dem nächsten Versuch.
  - Spur im Log: `RoleAssigned`/`RoleRevoked` mit Akteur, auch Ablauf (`expiresAt`).
  - Je Jahrgang: Der Akteur gilt nur in Jahrgängen, in denen er eine aktive Zuordnung hat (`resolveReaderActors`).
- **Ohne aktive Zuordnung wird nichts zugestellt**; der Dienst schreibt dazu höchstens einmal je Minute eine feste
  Zeile (`HV-Tool API: webhook <id>: no active system actor assignment; nothing delivered.`). Die Abonnement-ID ist
  Konfiguration, kein Personenbezug.
- **Keine Anmeldung für Systemakteure in 065a.** Der Abonnent ruft den Dienst nie auf; er empfängt nur. Client-Credentials
  oder mTLS für Systemakteure sind Sache von 064 (Push-Adapter) bzw. eines späteren Teils.

### 2. Rolle `event_subscriber` und Recht `webhook.receive` (Wahrheitstabellen-Diff unten)

- `PERMISSIONS` erhält `webhook.receive`. `ROLE_PERMISSIONS.event_subscriber` ist genau:
  `['webhook.receive', 'event.read', 'question.read', 'speaker.read', 'contribution.read']`, markiert als Systembündel
  (`systemActor: true`, wie `unitBoundRead` ein Datenmerkmal am Bündel, Hilfsfunktion `isSystemBundle(role)` in
  `permissions.ts`).
  - `event.read` ist nötig, weil R-PERM-04 nur Inhabern von `event.read` das Ereignis gibt (Entscheidung 3, Stufe d).
  - `question.read`, `speaker.read`, `contribution.read` sind nötig für die Gegenstandsprüfung (Stufe f). Über sie folgt
    der Filter künftigen Leseregeln automatisch, etwa `protected` aus 047.
  - Kein Schreibrecht, kein `history.read`, kein `stage.read`, kein `question.identity.reveal`.
- **admin erhält `webhook.receive` nicht** (explizite Liste seit 040a). Keine andere Rolle erhält es.
- **R-ADM-12 (Guard in `assignRole`, 409 mit Regel-id, ohne Ereignis):**
  - Ein Systembündel geht nur an ein Subjekt mit Präfix `sys_` (Muster `^sys_[a-z0-9_]{1,60}$`), ohne `personId`, ohne
    `unitId` und ohne `deputyForSubjectId`.
  - Ein Bündel ohne Systemmerkmal geht nie an ein Subjekt mit Präfix `sys_`, und kein `deputyForSubjectId` beginnt mit
    `sys_`.
  - Prüfreihenfolge: nach der Rechteprüfung und der Formprüfung (422), vor R-ADM-07. Entscheidung über das Datenmerkmal,
    nie über den Rollennamen.
- **Demo-Kopf:** `parseActorHeader` verweigert ein Systembündel mit 401 (fester Text wie bei unbekannter Rolle). Damit
  kann im Demo-Modus niemand als Abonnent lesen, und `HV_SEED_ACTOR` mit Systemrolle wird beim Start verweigert (gleiche
  Funktion). Der Rollenwechsler der Oberfläche (`apps/web/src/api/actor.ts`) bleibt unverändert und zeigt die Rolle nicht.
- **Anzeige:** `ROLE_KEYS` und `ACTION_KEYS` in `apps/web/src/i18n/labels.ts` erzwingen je einen Eintrag (vollständige
  `Record`-Typen). DE „Ereignis-Abonnent (Systemakteur)“ / EN „Event subscriber (system actor)“; Aktion DE „Webhooks
  empfangen“ / EN „Receive webhooks“. Sichtbar erst in der Admin-Oberfläche (041).

### 3. Sichtbarkeit R-PERM-05 (reine Funktion, `packages/domain/src/webhooks.ts`)

`webhookDecision(subscription, event, states, now, can)` entscheidet für **ein** Ereignis und **ein** Abonnement. Sie wird
zweimal aufgerufen: beim Einreihen mit der Projektion **nach** dem Stapel und unmittelbar **vor jedem Zustellversuch**
mit der dann aktuellen Projektion des Verteilers. Zugestellt wird nur, wenn beide Aufrufe zustimmen. Stufen, alle über
`can()`, kein Rollenname:

- (a) Das Ereignis hat `meetingId`; trägt das Abonnement einen Jahrgang, ist es derselbe.
- (b) Der Akteur `A = resolveReaderActors(states, subjectId, now).get(meetingId)` existiert.
- (c) `can(A, 'webhook.receive')` erlaubt.
- (d) `visibleMessages(new Map([[meetingId, A]]), [event], states, states, { can })` liefert eine Nachricht der Art
  `event` (dieselbe Funktion wie SSE, keine zweite Kopie von R-PERM-04).
- (e) Der Typ steht in `WEBHOOK_EVENT_TYPES` **und** in den Ereignistypen des Abonnements.
- (f) Jeder Gegenstand aus `EVENT_SUBJECTS` des Ereignisses der Art `question`, `speaker` oder `contribution` existiert
  in `states` und ist für `A` lesbar: Frage über `can(A, 'question.read', record)` (dieselbe Prüfung wie `getQuestion`),
  Wortmeldung und Redebeitrag über die Rechte aus `READ_PERMISSIONS.getSpeaker` bzw. `getContribution`. Fehlt ein
  Gegenstand, wird nicht zugestellt.

Ergebnis ist entweder `null` oder die **Lieferansicht** `webhookView(event)`:

- Grundlage ist `maskEvent(event)` (dieselbe Maskierung wie `listEvents` und SSE, inklusive der Maskierung aus 044a, falls
  gemergt).
- Darauf eine **Allowlist** der Umschlagfelder: `seq`, `id`, `type`, `at`, `meetingId`, `subjectId`, `schemaVersion`,
  `occurredAt`, `recordedAt`, `occurredAtSource`, `sourceHash`. Es fehlen also `actor` (SG8: kein Personenbezug der
  Beschäftigten nach außen, keine Kennzahl je Person über Dritte), `idempotencyKey`, `causationId`, `retentionClass`,
  `legalHold`, `redacted`.
- Und eine **Allowlist der Nutzlastschlüssel je Typ** (`WEBHOOK_EVENT_TYPES`, Tabelle in Entscheidung 4). Ein neues
  Nutzlastfeld, das eine spätere Scheibe einführt, geht deshalb nie still nach außen (deny by default).

Regeltext für `rules.ts` und `docs/legal-trace.md` (R-PERM-05, Art „Recht“, Quelle „Prozess“, ADR 0008 und T-G3-I-01 als
Fundstellen, `verified: false`): „Ein Systemakteur erhält ein Ereignis als Webhook nur, wenn er im Jahrgang des Ereignisses
`webhook.receive` hält, R-PERM-04 ihm das Ereignis gibt, der Typ für Webhooks freigegeben und abonniert ist und er jeden
genannten Gegenstand lesen darf; geprüft beim Einreihen und vor jedem Versuch. Geliefert werden nur freigegebene Umschlag-
und Nutzlastfelder.“

### 4. Freigegebene Ereignistypen und Nutzlastschlüssel (`WEBHOOK_EVENT_TYPES`, Standard; Eigentümerfrage 2)

Deny by default: Jeder Typ, der hier fehlt, auch jeder künftige (etwa `SegmentIngested` aus 064 oder die Typen aus
043d), wird nie zugestellt. Die Tabelle ist Daten im Kern; der Vertrag nennt dieselben Typen als Enum
`WebhookEventType` (Gleichheit per Test).

| Typ | Nutzlastschlüssel (alle übrigen fallen weg) | Begründung |
|---|---|---|
| `MeetingCreated` | `title`, `legalEntity`, `date`, `lifecycleVersion`, `agendaItems`, `units` | Stammdaten der Versammlung (nur über den Nachlauf `from: start` erreichbar, weil die Zuordnung erst danach entsteht) |
| `MeetingStarted`, `DebateClosed` | keine | Verfahrensereignis im Saal |
| `AgendaItemOpened`, `VotingOpened`, `VotingClosed` | `agendaItemId`, `number` | Verfahrensereignis im Saal |
| `SpeakerRegistered` | `number`, `round`, `position` | Wortmeldeliste ohne Namen (SG3: `displayName`, `organisation`, `pii` fallen ohnehin über `maskEvent`) |
| `SpeakersReordered` | `round`, `speakerIds` | Reihenfolge der Wortmeldeliste |
| `SpeakerUpdated` | `status`, `round`, `reason` | `reason` ist seit 0.4.0 das Enum `follow_up`, kein Freitext |
| `ContributionCaptured` | `speakerId`, `text`, `source`, `lateEntry` | Redebeitrag im Saal; `lateEntryReason` (interner Pflichtgrund) fällt weg |
| `QuestionCaptured` | `number`, `contributionId`, `speakerId`, `text`, `span` | Einzelfrage aus dem Redebeitrag |
| `QuestionClassified` | die Felder von `Classification` beim Bau (heute `track`, `agendaItemId`, `stageAssignment`; dazu `seatId`, falls 040b gemergt) | Antwortpfad, keine Inhalte |
| `QuestionAssigned` | `unitId` | Fachbereich, keine Person |
| `QuestionStaged` | `stagePosition` | Bühne |
| `QuestionDelivered` | `answerVersion` | „Vorgelesen“ (der Antworttext ist nicht Teil des Ereignisses; Folgeliste) |
| `QuestionClosed` | keine | |
| `QuestionWithdrawn` | keine | `reason` ist Freitext der Bearbeitung und fällt weg |
| `QuestionMerged` | `intoQuestionId` | |

**Nie zugestellt** (Begründung im Code-Kommentar der Tabelle):
- `AnswerDrafted`, `QuestionSubmittedForReview`, `QuestionApproved`: unveröffentlichte Antworten und Freigabeschritte
  (SG1).
- `QuestionLegalCleared`, `QuestionReturned`: Rechtseinschätzung, Notiz und Rückgabegrund (SG2; „nie Notizen“).
- `ContributionClaimed`, `ContributionReleased`, `QuestionClaimed`, `QuestionReleased`: wer woran arbeitet (SG8,
  Betriebsrat, ADR 0013).
- `RoleAssigned`, `RoleRevoked`: Rechteverwaltung (SG6).
- `IdempotencyRecorded`: technisch.
- `MeetingClosed`: Mit dem Schließen endet jede Zuordnung (`activeAssignment`), Stufe (b) scheitert also immer. Statt
  einer Ausnahme in der Regel steht der Typ hier ausdrücklich (Folgeliste: Ende eines Jahrgangs für Partner).

### 5. Lieferformat (Vertrag, Abschnitt `webhooks`)

Ein Ereignis je Anfrage: `POST <url>`, `Content-Type: application/json`, `User-Agent: HV-Tool-Webhooks/1`. Körper
`WebhookEventDelivery`:

```json
{
  "deliveryVersion": 1,
  "mode": "demo",
  "subscriptionId": "partner-demo",
  "streamId": "str_6mJxJ3Vb2tQ9c0W1aZ8yPq",
  "previousSeq": 41,
  "event": { "seq": 42, "id": "…", "type": "QuestionCaptured", "at": "…", "meetingId": "…", "subjectId": "…",
             "payload": { "number": "…", "contributionId": "…", "speakerId": "…", "text": "…" }, "sourceHash": "…" }
}
```

- `mode`: `demo` (065a) oder `training` (ab 065b). Ein Partner erkennt damit jede Lieferung als synthetisch.
- `streamId`: zufällig je Prozessstart und Abonnement (22 Zeichen base64url). Ein neuer Wert heißt „neuer Strom, frühere
  Lieferungen können fehlen“.
- `previousSeq`: `seq` der vorigen Lieferung **dieses Stroms** an dieses Abonnement, `null` bei der ersten. Ein Partner
  erkennt eine Lücke, wenn `previousSeq` nicht seiner zuletzt verarbeiteten `seq` entspricht. Lücken in `seq` selbst sind
  normal (Filter, andere Jahrgänge).
- Der Körper wird beim ersten Versuch einmal serialisiert; jede Wiederholung sendet **dieselben Bytes**.

### 6. Signatur, Idempotenzschlüssel, Secrets (Standard Webhooks, Fassung 1)

- `webhook-id`: `msg_<subscriptionId>_<seq>`. Gleich über alle Versuche und, weil `seq` global ist, eindeutig je
  Abonnement. **Das ist der Idempotenzschlüssel**; der Empfänger verwirft eine bereits verarbeitete ID mit 2xx.
- `webhook-timestamp`: ganze Sekunden der **injizierten Uhr** des Dienstes (R8) zum Zeitpunkt des Versuchs; neu je
  Versuch.
- `webhook-signature`: `v1,<base64(HMAC-SHA256(key, "<webhook-id>.<webhook-timestamp>.<Körper>"))>`, `key` sind die
  dekodierten Bytes des Secrets. Bei zwei konfigurierten Secrets (Wechsel) stehen zwei Einträge durch ein Leerzeichen
  getrennt; der Empfänger akzeptiert, wenn einer passt.
- **Secrets** `whsec_<base64>` mit 32 bis 64 Byte, nur aus der Umgebung (R11, SG7), höchstens zwei je Abonnement. Nie in
  Log, Fehlersatz, Zugriffslog oder Antwort.
- **Toleranz beim Empfänger:** 300 s in beide Richtungen; verarbeitete IDs mindestens 24 h aufbewahren (deckt die
  Wiederholungsdauer von höchstens 1 h aus Entscheidung 7 plus Toleranz reichlich ab).
- **Testvektor** (verbindlich für `sign.ts`, Empfängertest und Leitfaden; das Secret ist offensichtlich synthetisch, 32
  Byte `0x01`):
  - Secret `whsec_AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=`
  - `webhook-id` `msg_partner-demo_42`, `webhook-timestamp` `1795000000`
  - Körper (exakt, ohne Zeilenumbruch):
    `{"deliveryVersion":1,"mode":"demo","subscriptionId":"partner-demo","streamId":"str_test","previousSeq":null,"event":{"seq":42,"type":"MeetingStarted"}}`
  - erwartete Signatur `v1,wy//jKu9FIPJWsQmF/+O241+EbLL4MqApNZagwqMfDc=`
  - zweites Secret für den Wechseltest `whsec_AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=` →
    `v1,CsJm/llQcVBRRfjdFa7veU4GO+Ss7mogt2NPjKW2rr0=`
  - Der Vektor-Körper ist bewusst kein vollständiges `WebhookEventDelivery`; er prüft nur die Signatur.

### 7. Zustellung: Reihenfolge, Wiederholung, Grenzen

- **Je Abonnement streng der Reihe nach, höchstens eine Anfrage gleichzeitig** (Reihenfolge nach `seq`; ein hängendes
  Ereignis hält die folgenden desselben Abonnements an, nie die anderer Abonnements).
- **Erfolg:** jeder Status 2xx. **Fehlschlag:** jeder andere Status, eine Weiterleitung (3xx wird nie verfolgt),
  Verbindungs- oder DNS-Fehler, Zeitüberschreitung, Zielverweigerung (Entscheidung 8).
- **Wiederholung:** Wartezeit vor Versuch n+1 ist `min(300 s, 2^(n-1) s)`, mal einem Zufallsfaktor in [0,8; 1,2].
  `Retry-After` (Sekunden oder HTTP-Datum) bei 429 und 503 gilt, wenn größer als die berechnete Wartezeit, gedeckelt auf
  300 s. Zeitgeber und Uhr sind injiziert (Tests ohne echte Wartezeit).
- **Kein Aufgeben eines einzelnen Ereignisses.** Ein Ereignis wird nie übersprungen. Stattdessen wird das Abonnement
  **ausgesetzt** (`suspended`), wenn:
  - das älteste wartende Ereignis seit mehr als 1 h auf Erfolg wartet;
  - die Warteschlange 1000 Ereignisse oder 4 MiB übersteigt;
  - der Verteiler `reset` oder `unavailable` meldet (Kette nicht mehr geprüft; fail closed);
  - ein unerwarteter Fehler im eigenen Code auftritt (gefangen, der Prozess läuft weiter).
  Ausgesetzt heißt: Warteschlange verworfen, keine Anfrage mehr, eine feste Zeile
  `HV-Tool API: webhook <id> suspended (<grund>).` mit Grund aus `{retry_window, backlog, integrity, internal}`. Wieder
  aufgenommen wird nur durch Neustart des Dienstes; der neue Strom hat eine neue `streamId`.
- **Start:** `from` je Abonnement, `head` (Standard: nur Ereignisse nach dem Start) oder `start` (Nachlauf über das ganze
  geprüfte Log, beide Prüfungen mit der aktuellen Projektion). Übersteigt der Nachlauf die Grenze von 1000, wird das
  Abonnement sofort ausgesetzt (`backlog`).
- **Zeitgrenzen je Versuch:** DNS 3 s, Verbindung 3 s, gesamter Versuch bis zum Ende des gelesenen Antwortkörpers 10 s.
  Vom Antwortkörper werden höchstens 4 KiB gelesen und verworfen, nie geloggt.
- **Grenzen** (feste Konstanten wie in 035b; eine Anhebung ist eine Spec-Änderung): höchstens 5 Abonnements, höchstens
  20 Ereignistypen je Abonnement, URL höchstens 2048 Zeichen.
- **Kernprozess unberührt:** `onBatch` reiht nur ein (synchron, ohne `await`, ohne Netz). Kein Schreibpfad wartet je auf
  eine Zustellung.
- **Mehrere Instanzen:** Mit Postgres und zwei Instanzen stellt jede zu; der Empfänger dedupliziert über `webhook-id`.
  Das lokale Paket und die Demo haben eine Instanz. Benannt im Leitfaden; eine Führung je Abonnement folgt mit der
  dauerhaften Zustellung (Folgeliste, vor jedem Pilot).
- **Nicht dauerhaft:** Warteschlange und Stand liegen im Speicher. Ein Neustart beginnt mit `from` neu. Begründung:
  dauerhafter Zustellstand braucht eine eigene Tabelle (Migration, Lane persist) und wäre in der Freigabe-Demo ohne
  Mehrwert; T-G3-R-01 („Zustellprotokoll“) bleibt deshalb teilweise offen (Folgeliste).

### 8. SSRF-Schutz (T-G3-E-02)

- **Zwei Schlüssel für jedes Ziel:** Der Host der URL muss exakt (ohne Platzhalter, Kleinschreibung) in
  `HV_WEBHOOK_ALLOWED_HOSTS` stehen, **und** jede aufgelöste Adresse muss die Bereichsprüfung bestehen.
- **Zielmodus `HV_WEBHOOK_TARGETS`:**
  - `public` (Standard): nur `https`. Gesperrt ist jede Adresse in: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`,
    `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`,
    `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`; `::/128`, `::1/128`, `64:ff9b::/96`, `100::/64`,
    `2001:db8::/32`, `fc00::/7`, `fe80::/10`, `ff00::/8`. IPv4-gemappte (`::ffff:0:0/96`) und NAT64-Adressen werden auf
    ihre IPv4-Adresse zurückgeführt und dann geprüft.
  - `local`: zusätzlich `http` und die Bereiche Loopback, `10/8`, `172.16/12`, `192.168/16`, `fc00::/7` erlaubt.
    **Immer gesperrt bleiben** `169.254.0.0/16` und `fe80::/10` (Metadatendienste der Plattformen), `0.0.0.0/8`,
    `::/128`, Multicast und Broadcast.
  - Umsetzung über `net.BlockList` aus Node, keine neue Abhängigkeit.
- **Gegen DNS-Rebinding:** Je Versuch eine Auflösung aller Adressen (`lookup` mit `all: true`). Ist **eine** gesperrt,
  wird nicht verbunden, auch wenn andere erlaubt wären. Verbunden wird mit genau der geprüften Adresse (eigene `lookup`-
  Funktion an der Anfrage, die nur diese Adresse zurückgibt). TLS prüft das Zertifikat gegen den Hostnamen (SNI), wie
  üblich.
- **Keine Weiterleitung, kein Proxy aus der Umgebung**, keine Zugangsdaten in der URL (Konfigurationsfehler), kein
  Fragment.
- Eine Zielverweigerung ist ein Fehlschlag mit Wiederholung (DNS kann sich ändern) und eine feste Zeile
  `HV-Tool API: webhook <id>: target refused.` höchstens einmal je Minute, nie mit Adresse oder Host.
- **Kennzahlen:** keine neue in 065a (Befund 6). Sichtbar sind Aussetzen, Zielverweigerung und Zuordnungsfehlen über die
  festen Zeilen; der Empfänger sieht jede Lieferung.

### 9. Nur synthetische Daten (Datengrenze in 065a)

- Webhooks starten **nur mit `HV_DEMO=1`** (065b ergänzt `HV_MODE=training`). Ohne diese Bedingung verweigert der Dienst
  den Start, sobald eine Webhook-Variable gesetzt ist (fester Satz: „webhooks require HV_DEMO=1 (synthetic data only)“).
- Begründung: Lieferungen tragen Rede- und Fragetexte von Aktionären und pseudonyme Kennungen an Dritte. Dafür braucht
  es DSFA und Auftragsverarbeitung (E14) und eine Entscheidung des Eigentümers. Das ist nicht Teil der Freigabe-Demo und
  keine Frage dieser Spec (Standard „aus“, siehe „Standards“).
- Damit gilt in 065a immer `mode: "demo"`. Der Zielmodus `local` ist zusätzlich nur mit `HV_DEMO=1` zulässig (doppelt
  ausgedrückt, damit 065b die Bedingungen getrennt erweitern kann).

### 10. Konfiguration (Schema 034b, `.env.example`)

| Variable | Form | Regel |
|---|---|---|
| `HV_WEBHOOK_SUBSCRIPTIONS` | JSON-Liste, je Eintrag `id` (`^[a-z0-9-]{1,32}$`, eindeutig), `subjectId` (`^sys_[a-z0-9_]{1,60}$`), `url`, `eventTypes` (nicht leer, Teilmenge von `WEBHOOK_EVENT_TYPES`, ohne Doppel), optional `meetingId`, optional `from` (`head` \| `start`) | höchstens 5 Einträge; keine weiteren Schlüssel; URL nach Entscheidung 8 |
| `HV_WEBHOOK_SECRETS` | `id=whsec_…` durch Komma getrennt, je ID ein oder zwei Einträge | jede ID aus der Liste hat ein Secret; kein Secret für eine unbekannte ID; Länge 32–64 Byte; kanonisches Base64 |
| `HV_WEBHOOK_ALLOWED_HOSTS` | bis 10 exakte Hostnamen oder IP-Literale, Komma | jeder URL-Host steht hier |
| `HV_WEBHOOK_TARGETS` | `public` \| `local` | Standard `public`; `local` nur mit `HV_DEMO=1` |

- Alle vier ungesetzt: Webhooks aus, keine Änderung am heutigen Verhalten. Eine gesetzt, eine Pflichtvariable fehlt:
  Verweigerung (Muster der OIDC-Gruppe in `schema.ts`).
- Jeder Fehlersatz ist fest und nennt höchstens die Position des Eintrags, nie einen Wert (keine URL, kein Secret, keine
  ID).
- `ServiceConfig` erhält `webhooks?: { subscriptions, targets, allowedHosts }`; die Secrets liegen als `Buffer` in einem
  nicht aufzählbaren, nicht serialisierbaren Feld (kein `JSON.stringify` des Objekts zeigt sie; Test).

### 11. Kein Gegenstück in der Demo im Browser (ADR 0002, benannt)

Webhooks sind ein Adapter des Dienstes wie die SSE-Route. `HvApi`, der In-Process-Adapter und die Netlify-Demo ändern
sich nicht. Die Demo im Browser hat keinen Server, der nach außen ruft. Das ist keine Abweichung im Kern: Die Regel
R-PERM-05 liegt im Kern und ist dort vollständig getestet.

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

Gezählt auf `2fc3153`. Fügen 040b, 044a oder 064 vorher Spalten oder Zeilen hinzu, zählt der Bericht neu; die Aussagen
über die Zeilen von `event_subscriber` bleiben gleich (überall `·` außer den unten genannten Zellen).

**Abschnitt 1, Role × Status × Action:** 22 neue Zeilen `event_subscriber` (jeder Status, Text- und Podiumsfrage). Alle
Zellen `·`, außer `q.read` = ✓ in allen 22 Zeilen (wie `moderation`: `question.read` ohne Einheitsbindung). Keine
bestehende Zelle ändert sich.

```
+ | event_subscriber | captured | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+ | event_subscriber | in_review (podium) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
```

**Role × Leserecht:** eine neue Zeile.

```
+ | event_subscriber | ✓ | ✓ | ✓ | · | · | · | ✓ |
```

**Role × Agenda**, **Role × Identität und Rollenverwaltung**, **Role × Wortmeldung, Erfassung und Demo:** je eine neue
Zeile `event_subscriber`, alle Zellen `·`.

**Neuer Abschnitt „Role × Systemakteur“**, erzeugt vom selben Test (`transitions.test.ts`) mit derselben
`can()`-Entscheidung:

| Role | webhook.receive | Systembündel |
|---|---|---|
| moderation | · | · |
| capture | · | · |
| coordination | · | · |
| expert | · | · |
| legal | · | · |
| approver | · | · |
| podium | · | · |
| admin | · | · |
| observer | · | · |
| event_subscriber | ✓ | ✓ |

Die Spalte „Systembündel“ liest das Datenmerkmal (`isSystemBundle`), nicht den Namen. Der Bericht nennt den Diff wörtlich.

## Missbrauchsfälle mit Erkennung (je Mechanismus, vor dem Bau)

| Mechanismus | Missbrauch | Abwehr | Erkennung, Nachweis |
|---|---|---|---|
| Signatur | **Replay:** Ein Mitschnitt einer Lieferung wird später erneut an den Empfänger geschickt | Zeitstempel in der Signatur, Toleranz 300 s; `webhook-id` als Idempotenzschlüssel, IDs 24 h aufbewahrt | Empfänger verwirft und zählt („duplicate“, „timestamp“); Tests R3, R4 (Skript), S4 (gleiche ID über Versuche) |
| Signatur | **Veränderung unterwegs** (Körper, ID oder Zeitstempel geändert) | HMAC über `id.timestamp.body`, Vergleich in konstanter Zeit | Empfänger antwortet 401, Lieferung gilt als Fehlschlag; Tests R2, R7; Mutationsprobe M3 |
| Zeit | **Zeitversatz:** Die Uhr des Dienstes läuft weg, Empfänger lehnen alles ab; oder ein Angreifer setzt einen künftigen Zeitstempel | Zeitstempel aus der injizierten Uhr (R8), Uhrprüfung über NTP (033a, `/readyz` `clock_drift`); Toleranz in beide Richtungen | `/readyz` meldet die Drift; abgelehnte Versuche führen nach 1 h zu `suspended (retry_window)` mit fester Zeile; Test R3 (±299 s gültig, ±301 s ungültig) |
| Ziel | **SSRF:** Ziel-URL oder DNS zeigt auf interne Adressen (Metadatendienst, Datenbank, Admin-Oberflächen) | Abonnement nur aus Konfiguration; Host-Allowlist; Bereichsprüfung aller aufgelösten Adressen; Verbindung zur geprüften Adresse; keine Weiterleitung; Metadatenbereiche auch in `local` gesperrt | feste Zeile „target refused“; Test S8 (Bereiche, gemischte Antworten, Rebinding, IPv4-gemappt), S6 (Weiterleitung nicht verfolgt) |
| Wiederholung | **Wiederholungssturm:** Ein ausgefallener Empfänger kommt zurück und wird mit Anfragen überflutet, oder viele Abonnements verstärken sich | höchstens eine Anfrage je Abonnement, höchstens 5 Abonnements; exponentieller Abstand mit Zufall und Deckel 300 s; `Retry-After` beachtet und gedeckelt; Aufholen strikt nacheinander | Test S4 (Abstände nach Plan), S5 (`Retry-After`), S7 (Isolation der Abonnements) |
| Empfänger | **Langsamer Empfänger** (Slowloris, riesiger Antwortkörper, hängende Verbindung) staut Speicher oder Dienst | Zeitgrenzen 3/3/10 s; Antwortkörper höchstens 4 KiB; Warteschlange höchstens 1000 Ereignisse oder 4 MiB, dann `suspended (backlog)`; Einreihen ohne Netz | Test S6, S7, S12 (Schreibpfad wartet nicht); feste Zeile |
| Secret | **Wechsel und Leck:** Ein Secret ist bekannt geworden; der Wechsel darf keine Lieferung verlieren | zwei Secrets gleichzeitig, beide signieren; Ablauf im Leitfaden (neu dazu → Partner stellt um → alt entfernen); Secrets nur aus der Umgebung, nie im Log | Partner sieht beide Signaturen; Test S2 (zwei Einträge), R5 (Empfänger mit nur neuem Secret akzeptiert); Test S1 (kein Wert in Fehlersätzen, `ServiceConfig` serialisiert keine Secrets) |
| Rechte | **Leck über Rechtegrenzen:** Abonnent erhält Entwürfe, Rechtseinschätzungen, Notizen, Personendaten, Arbeitszuordnungen, künftig `protected` | R-PERM-05 Stufen a–f; Typ- und Feld-Allowlist; `maskEvent`; kein `actor`; Prüfung vor jedem Versuch; Systemrolle nicht für Menschen (R-ADM-12) und nicht im Demo-Kopf | Tests D3–D6, S9, S10; Mutationsproben M1, M2, M4, M5 |
| Datengrenze | **Sandbox und echte Daten mischen sich:** Webhooks liefern aus einem Bestand mit echten Personen an einen Partner, oder ein Partner hält Demo-Lieferungen für echte | Start nur mit `HV_DEMO=1` (065a), `mode` in jeder Lieferung; 065b: Modusmarke in der Datenbank, Startverweigerung bei Abweichung | Test S1 (ohne `HV_DEMO` → Start verweigert); `mode` im Vertragsschema als Pflichtfeld; 065b mit eigenem Test |

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6)

Additiv; kein bestehendes Anfrageschema erhält ein Feld (043a, Regel 1):

- **Version:** die nächste freie Patch-Stufe nach dem Vertragsschritt von 064 beim Merge (erwartet 0.4.3, wenn 044a 0.4.1
  und 064 0.4.2 belegen). `info.version`, `packages/contract/package.json`, Abschnitt `## [0.4.x]` in
  `packages/contract/CHANGELOG.md` mit `### Added`.
- **`Role`:** Wert `event_subscriber`. Beschreibung: Systemakteur; nur Subjekte `sys_…`; nie einer Person zugeordnet
  (R-ADM-12); keine Anmeldung; Bündel in `docs/rollen-und-rechtekonzept.md` folgt mit 052.
- **`Action`:** Wert `webhook.receive` mit Beschreibung („Since 0.4.x: a system actor receives signed webhooks for the
  events it may read (R-PERM-05). Never granted to a person.“).
- **`assignRole`, Antwort 409:** Beschreibung ergänzt um R-ADM-12.
- **Neuer Abschnitt `webhooks`** (OpenAPI 3.1) mit genau einem Eintrag `eventDelivered`, `post`, `operationId`
  `webhookEventDelivered`:
  - Kopfparameter `webhook-id` (Muster `^msg_[a-z0-9-]{1,32}_[1-9][0-9]{0,15}$`), `webhook-timestamp` (`^[0-9]{1,12}$`),
    `webhook-signature` (`^v1,[A-Za-z0-9+/]{43}=( v1,[A-Za-z0-9+/]{43}=)?$`), alle Pflicht.
  - Körper `WebhookEventDelivery` (Pflicht).
  - Antworten: `2XX` (angenommen); `4XX` und `5XX` beschrieben als „Fehlschlag, der Dienst wiederholt nach Entscheidung
    7“. Ob Redocly für Webhooks weitere Antworten verlangt, prüft der Architekt beim Lint (Vor-dem-Bau-Punkt 4).
  - Beschreibung mit Entscheidungen 5–7 in Kurzform: ein Ereignis je Anfrage, Reihenfolge, mindestens einmal, Toleranz,
    Aufbewahrung der IDs, Lückenerkennung, Aussetzen, nur synthetische Daten.
- **Schemas:**
  - `WebhookEventDelivery`: `required` alle sechs Felder; `additionalProperties: false`; `deliveryVersion` `const: 1`;
    `mode` Enum `[demo, training]` mit dem Satz „`training` from slice 065b on“; `subscriptionId` Muster wie oben;
    `streamId` `^str_[A-Za-z0-9_-]{22}$`; `previousSeq` `type: [integer, 'null']`, `minimum: 1`; `event` →
    `WebhookEvent`.
  - `WebhookEvent`: `required` `[seq, id, type, at, meetingId, subjectId, payload, sourceHash]`, optional
    `schemaVersion`, `occurredAt`, `recordedAt`, `occurredAtSource`; `additionalProperties: false`; `type` →
    `WebhookEventType`; `payload` `type: object` mit `properties: { pii: false, displayName: false, organisation: false,
    personId: false, actor: false, note: false, refusalJustification: false, lateEntryReason: false }` (Schema-`false`
    wie in 043a) und dem Verweis auf die Nutzlasttabelle im Leitfaden.
  - `WebhookEventType`: Enum der 18 Typen aus Entscheidung 4.
- **`info.description`, Absatz „Compatibility“:** Das Lieferformat ist über `deliveryVersion` versioniert; Partner
  erhalten zwei Vertragszyklen Kompatibilität (ADR 0008, ADR 0015).
- **Typen:** `pnpm contract:types`; ein zweiter Lauf ergibt keinen Diff. Vertragstests ziehen nur ihre Versionszeile nach.
- **Keine Allowlist:** Es gibt keine neue Operation unter `paths`, also keinen Eintrag in `allowlist.json`.

## Nicht-Ziele

- Kein Sandbox-Mandant, kein `HV_MODE`, keine Datenbankmarke, keine Änderung am lokalen Paket (`deploy/**`,
  `scripts/stack*.mjs`, `scripts/lib/demo-*.mjs`): das ist 065b.
- Keine Operation zum Anlegen, Ändern, Anzeigen oder Testen von Abonnements; kein Zustellstatus über die API.
- Kein dauerhafter Zustellstand, keine Migration, keine Führung je Abonnement bei mehreren Instanzen (Folgeliste, vor
  jedem Pilot).
- Keine Anmeldung für Systemakteure (Client-Credentials, mTLS); kein eingehender Webhook (064).
- Keine neue Kennzahl, keine Änderung am Kennzahlen-Tor.
- Keine Zustellung mit echten Daten (Entscheidung 9); kein Deploy, kein gehosteter Testserver (R11, Plan §11
  „Hosting“).
- Kein Antworttext in `QuestionDelivered`; keine weiteren Ereignistypen.
- Keine Oberfläche außer den zwei erzwungenen Anzeigeschlüsseln; keine Änderung am Rollenwechsler.
- Keine Änderung an `HvApi`, am In-Process-Adapter, an `maskEvent`, `visibleMessages` oder dem Verteiler selbst (nur
  Registrierung einer Verbindung).
- Keine Änderung an ADR 0008 (eine Ergänzung schreibt der Architekt nach dem Lesebefund, wenn der Orchestrator sie
  verlangt).

## Files allowed

Vertrag (Architekt, erster Commit, vor jedem anderen Schritt):

- `packages/contract/openapi.yaml`
- `packages/contract/CHANGELOG.md` (nur der neue Abschnitt)
- `packages/contract/package.json` (nur `version`)
- `packages/contract/src/types.ts` (nur regeneriert mit `pnpm contract:types`)
- `apps/api/src/__tests__/contract-065a.test.ts` (neu)
- `apps/api/src/__tests__/contract.test.ts`, `apps/api/src/__tests__/contract-0*.test.ts`,
  `apps/api/src/__tests__/takt-0*-contract.test.ts` (jeweils nur die Versionszeile)

Kern (implementierer-backend):

- `packages/domain/src/webhooks.ts` (neu: `WEBHOOK_EVENT_TYPES`, `WEBHOOK_ENVELOPE_KEYS`, `webhookDecision`,
  `webhookView`)
- `packages/domain/src/types.ts` (nur `Role`, `PERMISSIONS`)
- `packages/domain/src/permissions.ts` (nur das Bündel `event_subscriber`, das Merkmal `systemActor`, `isSystemBundle`)
- `packages/domain/src/api.ts` (nur der Guard R-ADM-12 in `assignRole`)
- `packages/domain/src/rules.ts` (nur R-PERM-05 und R-ADM-12)
- `packages/domain/src/index.ts` (nur die neuen Exporte)
- `packages/domain/policy-truth-table.md` (nur erzeugt)
- `packages/domain/src/__tests__/webhooks065a.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur der neue Abschnitt „Role × Systemakteur“)
- `packages/domain/src/__tests__/stream035.test.ts` (nur die Zeile `event_subscriber` in `SPEC_TABLE`)
- `packages/domain/src/__tests__/*.test.ts` darüber hinaus nur dort, wo eine erschöpfende Aufzählung von `Role` oder
  `Permission` den neuen Wert erzwingt (Liste aus Vor-dem-Bau-Punkt 6 im Bericht)
- `docs/legal-trace.md` (nur die Zeilen R-PERM-05 und R-ADM-12)

Dienst (implementierer-backend):

- `apps/api/src/webhooks/**` (neu: `config.ts`, `dispatcher.ts`, `deliver.ts`, `target.ts`, `sign.ts`)
- `apps/api/src/config/schema.ts`, `apps/api/src/config/appOptions.ts`, `apps/api/src/config/sentences.ts` (nur die vier
  Variablen und ihre Sätze)
- `apps/api/.env.example` (nur die vier Variablen, auskommentiert, ohne Werte)
- `apps/api/src/app.ts` (nur Option `webhooks`, Start des Zustellers am Verteiler, Testhaken für Zeitgeber und `lookup`)
- `apps/api/src/server.ts` (nur Weitergabe der Konfiguration)
- `apps/api/src/actor.ts` (nur die Verweigerung eines Systembündels in `parseActorHeader`)
- `apps/api/src/__tests__/webhooks065a.test.ts` (neu)
- `apps/api/src/__tests__/config034b.test.ts` (nur die neuen Variablen in Drift- und Bekanntheitsprüfung)

Oberfläche (nur, was die Typprüfung erzwingt):

- `apps/web/src/i18n/labels.ts` (je ein Eintrag in `ROLE_KEYS` und `ACTION_KEYS`)
- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts` (je zwei Schlüssel)

Skripte:

- `scripts/webhook-receiver.mjs` (neu)
- `scripts/webhook-receiver.test.mjs` (neu)

Dokumente:

- `docs/integration/webhooks.md` (neu, Gliederung unten verbindlich)
- `docs/integration/README.md` (nur eine Verweiszeile auf `webhooks.md`; anlegen mit genau dieser Zeile und einer
  Überschrift, falls 064 die Datei nicht angelegt hat)
- `docs/glossar.md` (nur die eine Zeile „Ereignis-Abonnent (Systemakteur)“)
- `docs/sicherheit/bedrohungsmodell.md` (nur die Zeilen T-G3-T-03, T-G3-R-01, T-G3-I-01, T-G3-D-02, T-G3-E-01,
  T-G3-E-02, BF-19, die Zeile „065 Webhooks“ in Abschnitt 6 und der Nachweis von MF-05)
- `docs/evidence/065a-*.txt`
- `docs/folgeliste.md` (nur die Einträge aus „Folgelisten-Einträge“ und neue nicht blockierende Befunde)
- `docs/slices/065a-webhooks-partnerleitfaden.md` (diese Spec: Bericht, Review findings)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/domain/src/stream.ts`, `packages/domain/src/state.ts`, `packages/domain/src/transitions.ts`,
`packages/domain/src/store.ts`, `apps/api/src/stream/**`, `apps/api/src/persistence/**`, `apps/api/migrations/**`,
`apps/api/src/metrics/**`, `deploy/**`, `scripts/stack*.mjs`, `scripts/lib/**`, `scripts/gitleaks.toml`,
`apps/web/src/api/**`, `apps/web/src/features/**`, `packages/contract/allowlist.json`, `docs/adr/**`,
`docs/produktplan-beta.md`, `docs/entscheidungsregister.md`, `docs/integration/transkript.md`. Dieser Abschnitt steht
bewusst außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. **Stand des Integrationszweigs.** Ist 043a gemergt (Vertrag 0.4.0)? Welche 0.4.x-Stufen sind vergeben? Ist der
   Vertragsschritt von 064 gemergt? Fehlt 043a: anhalten. Fehlt 064: Orchestrator fragen, ob 065a vorzieht (dann nimmt
   065a die nächste freie Stufe und 064 die danach).
2. **Systemakteur aus 064.** Hat 064 schon ein Systemmerkmal, eine Systemrolle oder einen Guard für Systemsubjekte
   eingeführt? Dann nutzt 065a dieses Merkmal und denselben Guard (R-ADM-12 entfällt oder wird derselbe), statt ein
   zweites zu bauen. Im Bericht nennen.
3. **Regel-ids.** Sind R-PERM-05 und R-ADM-12 frei? Sonst die nächste freie Nummer; Spec, Vertrag und Bericht
   gleichziehen.
4. **Redocly und `webhooks`.** Läuft `pnpm contract:lint` mit dem Abschnitt `webhooks` ohne neue Meldung? Verlangt eine
   Regel eine weitere Antwort oder ein Merkmal, ergänzt der Architekt es im Vertragsschritt. Erzeugt
   `openapi-typescript` den Typ `webhooks` mit `WebhookEventDelivery`? Prüft das Abdeckungstor
   (`operation-coverage.setup.ts`) nur `paths`? Falls es `webhooks` mitzählt: melden, nicht das Tor ändern.
5. **Verteiler als Dauerverbindung.** Lässt sich eine Verbindung ohne Route registrieren (`hub.register` nach
   `ensureFresh`), und hält sie den Verteiler am Laufen (`running()`)? Mit Postgres heißt das ein Nachladen je Sekunde,
   solange Webhooks konfiguriert sind; das ist in der Demo hinnehmbar und steht im Bericht. Zählt eine solche Verbindung
   in die Prozessgrenze von 200 Strömen? Sie darf es nicht (sie ist kein Strom); sonst melden.
6. **Erschöpfende Aufzählungen.** Welche Dateien zählen `Role` oder `Permission` erschöpfend auf (`Record<Role, …>`,
   `Record<Permission, …>`, Tabellen in Tests)? Heute bekannt: `permissions.ts`, `labels.ts`, `stream035.test.ts`. Weitere
   Fundstellen im Bericht; liegen sie außerhalb von „Files allowed“: anhalten und melden.
7. **Korpusgröße.** Wie viele Ereignisse erzeugt `seedOnStart` im Demo-Modus, und wie viele davon sind nach Entscheidung
   4 lieferbar? Liegt die Zahl über 1000, reicht `from: start` für den Schnellstart nicht: melden.
8. **`MeetingCreated.meetingId`.** Trägt das Ereignis `meetingId`? Wenn nicht, ist es über Stufe (a) nie lieferbar; dann
   fällt es aus der Tabelle (Vertrag und Kern gleich), Befund im Bericht.
9. **Rollen-Literal-Tor.** Erkennt `scripts/role-literal-check.mjs` die neue Rolle aus der Union, und sind `labels.ts`
   und Tests wie bisher ausgenommen? Ein Treffer im Dienst ist ein Befund, keine Ausnahme.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/webhooks065a.test.ts`):

- **D1** Bündel: `ROLE_PERMISSIONS.event_subscriber` ist genau die Liste aus Entscheidung 2; `isSystemBundle` ist nur
  dort wahr; keine andere Rolle hält `webhook.receive`; admin hält es nicht.
- **D2** R-ADM-12 über `assignRole` als admin: Systemrolle an `oidc_x` → 409 R-ADM-12; an `sys_partner` mit `personId`,
  mit `unitId` oder mit `deputyForSubjectId` → je 409 R-ADM-12; Menschenrolle (z. B. die Rolle mit `contribution.capture`,
  aus den Daten gewählt) an `sys_partner` → 409 R-ADM-12; Menschenrolle mit `deputyForSubjectId: 'sys_partner'` → 409;
  Systemrolle an `sys_partner` → 201 und ein `RoleAssigned`. Kein Ereignis bei den Ablehnungen.
- **D3** Korpuslauf (Seed plus Arbeitsgang bis „Vorgelesen“ mit Entwurf, Rechtsfreigabe mit Notiz, Rückgabe mit Grund,
  Übernahme und Freigabe der Bearbeitung, Zuordnungen): Mit zugeordnetem Abonnenten, das alle 18 Typen abonniert, sind
  die gelieferten Typen genau die im Korpus vorkommenden Typen aus `WEBHOOK_EVENT_TYPES`; kein Ereignis der Liste „Nie
  zugestellt“ kommt durch.
- **D4** Lieferansicht: Umschlagschlüssel ⊆ `WEBHOOK_ENVELOPE_KEYS`; Nutzlastschlüssel je Typ ⊆ Tabelle; im JSON jeder
  Ansicht kommt keiner dieser Schlüssel vor: `actor`, `displayName`, `organisation`, `pii`, `personId`, `note`,
  `refusalJustification`, `lateEntryReason`, `idempotencyKey`; `reason` nur bei `SpeakerUpdated`.
- **D5** Zuordnung: ohne Zuordnung → `null`; andere Jahrgänge → `null`; nach `RoleRevoked` und nach Ablauf
  (`expiresAt`, Uhr injiziert) → `null` für folgende und für noch nicht zugestellte Ereignisse (zweiter Aufruf mit
  aktueller Projektion); Abonnement mit `meetingId` filtert.
- **D6** Rechte sind Daten (eingespeiste `can`-Funktion): ohne `webhook.receive` → `null`; ohne `event.read` → `null`
  (R-PERM-04 liefert nur `change`); `question.read` für **eine** bestimmte Frage verweigert → deren Ereignisse `null`,
  andere geliefert (Vorgriff auf `protected`, 047); `speaker.read` verweigert → `SpeakerRegistered` und
  `QuestionCaptured` `null`.
- **D7** Ereignistypen des Abonnements filtern; ein abonnierter Typ außerhalb von `WEBHOOK_EVENT_TYPES` wird nie
  geliefert (die Konfiguration verweigert ihn ohnehin, der Kern prüft trotzdem).
- **D8** Die Wahrheitstabelle enthält den neuen Abschnitt; der Diff aus dieser Spec stimmt (bestehender Snapshot-Test).

**Dienst** (`apps/api/src/__tests__/webhooks065a.test.ts`; Empfänger als lokaler HTTP-Server auf 127.0.0.1 im Zielmodus
`local`; Uhr, Zeitgeber und `lookup` injiziert):

- **S1** Konfiguration: alle vier ungesetzt → aus; nur eine gesetzt → Verweigerung; ohne `HV_DEMO=1` → Verweigerung;
  `local` ohne Demo → Verweigerung; Host nicht in der Allowlist; `http` in `public`; URL mit Zugangsdaten oder Fragment;
  mehr als 5 Einträge; doppelte ID; unbekannter Ereignistyp; unbekannter Schlüssel; fehlendes, zu kurzes, nicht
  kanonisches Secret; Secret für unbekannte ID → je Verweigerung mit festem Satz. Kein Satz enthält URL, Host, Secret oder
  ID. `JSON.stringify(config)` und `util.inspect(config)` enthalten kein Secret.
- **S2** Signatur: `sign.ts` erzeugt den Testvektor aus Entscheidung 6 exakt; zwei Secrets → zwei `v1,`-Einträge in der
  Reihenfolge der Konfiguration; `webhook-timestamp` ist die injizierte Uhr.
- **S3** Glücksfall: Erfassen einer Frage über die API → genau eine Lieferung `QuestionCaptured`; Körper gültig gegen
  `WebhookEventDelivery` aus `openapiDoc` (Ajv); Kopf `webhook-id` = `msg_<id>_<seq>`; Signatur prüft mit dem Empfänger aus
  `scripts/webhook-receiver.mjs`; zweite Lieferung trägt `previousSeq` der ersten; `mode` ist `demo`.
- **S4** Wiederholung nach 5xx: Empfänger antwortet zweimal 503, dann 204 → drei Versuche, gleiche `webhook-id`, gleiche
  Körperbytes, neue Zeitstempel und Signaturen; Abstände 1 s und 2 s (Zufallsfaktor über Testhaken fest auf 1); das
  nächste Ereignis desselben Abonnements kommt erst danach.
- **S5** `Retry-After: 7` bei 429 → Abstand 7 s; `Retry-After: 3600` → 300 s; HTTP-Datum wird gelesen.
- **S6** Zeitgrenzen und Weiterleitung: Empfänger antwortet nie → Fehlschlag nach 10 s; Antwortkörper 1 MiB → nach 4 KiB
  abgebrochen, Status zählt; 302 auf einen zweiten Server → Fehlschlag, der zweite Server erhält nichts.
- **S7** Aussetzen und Isolation: Warteschlange über 1000 → `suspended (backlog)`, feste Zeile genau einmal; ältestes
  Ereignis über 1 h → `suspended (retry_window)`; ein zweites Abonnement mit gesundem Empfänger erhält währenddessen
  alles.
- **S8** SSRF im Zielmodus `public` (eingespeistes `lookup`, kein echtes Netz): Host löst auf `127.0.0.1`, `10.1.2.3`,
  `169.254.169.254`, `::1`, `::ffff:127.0.0.1`, `64:ff9b::a9fe:a9fe`, `fc00::1` auf → je verweigert, keine Verbindung;
  gemischte Antwort (eine öffentliche, eine private Adresse) → verweigert; Rebinding: `lookup` liefert beim zweiten Aufruf
  eine andere Adresse → die Verbindung geht an die geprüfte Adresse (Haken am Verbindungsaufbau). Im Zielmodus `local`:
  `127.0.0.1` erlaubt, `169.254.169.254` und `fe80::1` verweigert.
- **S9** Rechte zum Versuchszeitpunkt: Ereignis hängt in der Wiederholung, dann `revokeRole` des Abonnenten → beim
  nächsten Versuch keine Anfrage, Ereignis verworfen, feste Zeile „no active system actor assignment“.
- **S10** Leck Ende zu Ende: derselbe Arbeitsgang wie D3 über HTTP; der Empfänger erhält keinen Typ der Liste „Nie
  zugestellt“, und kein roher Körper enthält einen der Schlüssel aus D4 oder den Text der Notiz, des Rückgabegrunds, des
  Entwurfs oder einen `displayName` aus dem Seed (Suche im rohen Körper).
- **S11** Kette: Verteiler meldet `reset` (gekürztes Log über den bestehenden Testhaken `streamLoad`) → alle Abonnements
  `suspended (integrity)`, danach keine Anfrage.
- **S12** Kein Warten im Schreibpfad: Empfänger hängt; zehn Schreibanfragen hintereinander antworten in der üblichen Zeit
  (keine Anfrage wartet auf die Zustellung).
- **S13** `from: start`: Nachlauf liefert die lieferbaren Ereignisse des Korpus in `seq`-Reihenfolge, das erste mit
  `previousSeq: null`; mit einer künstlich auf 5 gesenkten Grenze (Testhaken) → sofort `suspended (backlog)`.
- **S14** Demo-Kopf: `X-Actor: x:event_subscriber` → 401; `HV_SEED_ACTOR` mit Systemrolle → Start verweigert.

**Vertrag** (`apps/api/src/__tests__/contract-065a.test.ts`): Version; `Role` enthält `event_subscriber`; `Action`
enthält `webhook.receive`; `webhooks.eventDelivered.post.operationId` ist `webhookEventDelivered`; `WebhookEventType` ist
gleich den Schlüsseln von `WEBHOOK_EVENT_TYPES`; `WebhookEventDelivery` und `WebhookEvent` haben
`additionalProperties: false`; das Signaturmuster akzeptiert einen und zwei Einträge des Testvektors und lehnt `v2,…` ab;
ein `WebhookEvent` mit `payload.pii` oder `payload.actor` ist ungültig; kein bestehendes Anfrageschema hat ein neues Feld
(exakte Eigenschaftslisten von `RoleAssignmentCreate` gegen den Stand vor dem Schritt).

**Empfänger** (`scripts/webhook-receiver.test.mjs`, `node --test`, in `pnpm test:scripts`):

- **R1** Testvektor wird akzeptiert.
- **R2** Signatur mit falschem Secret → abgelehnt (Ergebnis `signature`).
- **R3** Zeitstempel ±299 s → akzeptiert; ±301 s → abgelehnt (`timestamp`); nicht numerisch → abgelehnt.
- **R4** Gleiche `webhook-id` zweimal → zweites Mal `duplicate`, nicht verarbeitet, Antwort 2xx.
- **R5** Kopf mit altem und neuem Eintrag, Empfänger kennt nur das neue Secret → akzeptiert.
- **R6** Fehlende Köpfe oder `v2,…` → abgelehnt.
- **R7** Ein Byte im Körper geändert → abgelehnt.

**Mutationsproben** (im Bericht mit dem Ergebnis „rot“ belegt, danach zurückgesetzt):
- **M1** Stufe (e) entfernt (jeder Typ lieferbar) → D3 und S10 rot.
- **M2** Stufe (f) entfernt → D6 rot.
- **M3** Signatur nur über den Körper (ohne ID und Zeitstempel) → S2, R1 rot.
- **M4** `actor` in `WEBHOOK_ENVELOPE_KEYS` → D4 und S10 rot.
- **M5** Prüfung vor dem Versuch entfernt (nur beim Einreihen) → D5 und S9 rot.
- **M6** Bereichsprüfung prüft nur die erste aufgelöste Adresse → S8 (gemischte Antwort) rot.
- **M7** `Retry-After` ohne Deckel → S5 rot.
- **M8** Guard R-ADM-12 entfernt → D2 rot.

## Akzeptanzkriterium

1. `pnpm contract:lint` grün ohne neue Meldung; `pnpm contract:types` reproduzierbar; `check.mjs` (a)–(d) `ok` mit
   `(c) … 0.4.y -> 0.4.x`.
2. Tests D1–D8, S1–S14, Vertragstests und R1–R7 grün; die acht Mutationsproben rot belegt.
3. Wahrheitstabellen-Diff wie oben, wörtlich im Bericht.
4. Ein eigener Agent in frischem Kontext befolgt den Schnellstart in `docs/integration/webhooks.md` auf einem frischen
   Checkout und erhält mindestens drei signierte, geprüfte Lieferungen; Ausgabe des Empfängers in
   `docs/evidence/065a-schnellstart.txt`. Höchstens sieben Schritte, kein Schritt außerhalb des Leitfadens.
5. `git diff` gegen die Merge-Basis zeigt nur Dateien aus „Files allowed“.
6. `pnpm gates` (mit Postgres-Variablen wie in CI) grün, einschließlich `slice-scope` auf `claude/slice-065a-…`; der
   Schluss der Ausgabe steht einmal im Bericht.

## Leitfaden `docs/integration/webhooks.md` (Gliederung verbindlich)

1. **Wofür, für wen:** Ereignisse für Nachbarsysteme; nur synthetische Daten (`mode`); keine Anmeldung nötig, nur ein
   Empfänger.
2. **Schnellstart (höchstens sieben Schritte, jede Zeile kopierbar):**
   1. Secret erzeugen: `node -e "console.log('whsec_'+require('node:crypto').randomBytes(32).toString('base64'))"` und als
      `WEBHOOK_SECRET` setzen.
   2. Empfänger starten: `node scripts/webhook-receiver.mjs --port 9900` (bindet nur an 127.0.0.1).
   3. Dienst im Demo-Modus mit einem Abonnement starten (`pnpm --filter @hv/api dev` mit den vier Variablen; das
      Abonnement abonniert `QuestionCaptured`, `QuestionClassified`, `QuestionStaged`, `QuestionDelivered`).
   4. Den Systemakteur zuordnen: Jahrgang mit `GET /v1/meeting` lesen, dann `POST /v1/meetings/{meetingId}/role-assignments`
      mit `{"subjectId":"sys_partner_demo","role":"event_subscriber"}` und `X-Actor: u-admin:admin`.
   5. Eine Einzelfrage erzeugen: Oberfläche im HTTP-Modus (`HV_WEB_MODE=http pnpm --filter @hv/web dev`) als Erfassung,
      oder die zwei `curl`-Zeilen für Redebeitrag und Einzelfrage.
   6. Ausgabe des Empfängers lesen: je Lieferung eine Zeile `ok seq=… type=… id=… previousSeq=…`.
   7. Wiederholung sehen: Empfänger mit `--fail-first 2` neu starten, eine weitere Frage erfassen, drei Versuche mit
      gleicher ID beobachten.
3. **Lieferformat:** Felder aus Entscheidung 5, Tabelle der Typen und Nutzlastschlüssel aus Entscheidung 4,
   Kompatibilität (`deliveryVersion`, zwei Zyklen).
4. **Signatur prüfen in wenigen Zeilen:** Node (unten) und Python (gleiche Logik mit `hmac.compare_digest`), dazu der
   Testvektor aus Entscheidung 6 zum Selbsttest. Hinweis auf Bibliotheken für Standard Webhooks.

   ```js
   import { createHmac, timingSafeEqual } from 'node:crypto';
   export function verify(secret, h, rawBody, now = Math.floor(Date.now() / 1000)) {
     const id = h['webhook-id'], ts = h['webhook-timestamp'], sigs = h['webhook-signature'] ?? '';
     if (!id || !/^\d+$/.test(ts ?? '') || Math.abs(now - Number(ts)) > 300) return false;
     const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
     const want = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest();
     return sigs.split(' ').some((s) => {
       const got = Buffer.from(s.startsWith('v1,') ? s.slice(3) : '', 'base64');
       return got.length === want.length && timingSafeEqual(got, want);
     });
   }
   ```
   Wichtig: über den **rohen** Körper prüfen, nie über neu serialisiertes JSON; danach `webhook-id` gegen die Liste
   verarbeiteter IDs prüfen.
5. **Wiederholung, Reihenfolge, Aussetzen:** Entscheidung 7 in Partnersprache; was ein Partner bei neuer `streamId`
   oder unpassendem `previousSeq` tut (Lücke melden; einen Abruf für Systemakteure gibt es in diesem Stand nicht).
6. **Secret wechseln:** drei Schritte (neues Secret zusätzlich konfigurieren und Dienst neu starten → Partner stellt um →
   altes entfernen und neu starten).
7. **Sicherheit für Betreiber:** Host-Allowlist, Zielmodus, gesperrte Bereiche, keine Weiterleitung, Secrets nur aus der
   Umgebung, eine Instanz.
8. **Grenzen dieses Stands:** nicht dauerhaft, keine API für Abonnements, nur Demo-Modus; Sandbox über das lokale Paket
   folgt mit 065b.

## Datenschutz

- An einen Empfänger gehen Rede- und Fragetexte, Kennungen von Wortmeldungen, Redebeiträgen und Fragen und Verfahrensdaten,
  nie Klarnamen (SG3) und nie Kennungen von Beschäftigten (SG8, `actor` fällt weg).
- In 065a nur mit `HV_DEMO=1`, also nur mit dem synthetischen Korpus (R11). Jede Nutzung mit echten Daten braucht DSFA
  (E14), Auftragsverarbeitung mit dem Partner und eine Entscheidung des Eigentümers; das gehört nicht zur Freigabe-Demo.
- Kein neuer Speicherort: Warteschlange nur im Speicher, nichts auf Platte, kein Zugriffslog-Eintrag für ausgehende
  Anfragen.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch (wie Plan)

Ausgelöst:
- [x] Vertrag, Ereignis, Konfiguration (Abschnitt `webhooks`, vier Variablen)
- [x] Rolle, Recht, Schutzklasse (neue Rolle, neues Recht, Wahrheitstabelle, Guard)
- [x] Fachregel (R-PERM-05)
- [ ] Persistenz
- [ ] Oberfläche (nur zwei Anzeigeschlüssel, keine Ansicht)

Perspektive(n): Security, Datenschutz, Vertrag · Nachweise: Tests, Mutationsproben, Schnellstart-Durchlauf durch einen
frischen Agenten · Offene Entscheidung: Eigentümerfragen 1–3

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. **Kein Mensch erhält `webhook.receive`, und kein Mensch wird Systemakteur.** Prüfen: Wahrheitstabelle; D2; S14.
2. **Kein Rollenname im Dienst.** `apps/api/src/webhooks/**` enthält `event_subscriber` nicht; der Dienst arbeitet mit
   `subjectId` aus der Konfiguration und `can()` (Rollen-Literal-Tor).
3. **Kein Secret außerhalb der Umgebung.** Kein Secret in Repositorium, Test-Fixture (außer dem synthetischen
   Testvektor), Log, Fehlersatz; `.env.example` ohne Werte.
4. **Keine Anfrage an ein ungeprüftes Ziel.** Host-Allowlist und Bereichsprüfung je Versuch, Verbindung an die geprüfte
   Adresse, keine Weiterleitung (S6, S8).
5. **Kein Leck über Rechte.** R-PERM-05 zweimal je Ereignis; Typ- und Feld-Allowlist; kein `actor` (D3–D6, S9, S10).
6. **Kein Einfluss auf den Kernprozess.** Einreihen synchron ohne Netz; Grenzen; Aussetzen statt Absturz (S7, S12).
7. **Nur synthetische Daten.** Start nur mit `HV_DEMO=1` (S1).

## Standards (auf Standard gebaut; Vermerk im CHANGELOG und im Bericht)

| Standard | Quelle | Was 065a daraus baut | Kosten einer späteren Änderung |
|---|---|---|---|
| Freigegebene Typen und Felder wie Entscheidung 4 | Architekt; SG1, SG2, SG3, SG8 | `WEBHOOK_EVENT_TYPES`, Vertrags-Enum | ein Typ mehr oder weniger: Tabellenzeile, Enum-Wert (additiv bzw. Streichung nach zwei Zyklen), Test; < 0,5 AStd |
| Webhooks nur mit synthetischen Daten | E14; R11 | Startbedingung `HV_DEMO=1` (065b: `training`) | Freigabe für echte Daten: Bedingung erweitern < 0,25 AStd, dazu DSFA, Auftragsverarbeitung, dauerhafte Zustellung (Folgeliste) |
| Abonnement aus der Konfiguration, Systemakteur über Zuordnung | ADR 0008; T-G3-E-02 | vier Variablen, `sys_`-Subjekt, R-ADM-12 | Abonnement-API: eigene Scheibe mit SSRF-Prüfung je Anlage, ≥ 2 AStd |
| Standard Webhooks, Fassung 1 | öffentliche Spezifikation | Kopfnamen, `whsec_`, `v1,` | anderes Schema: `sign.ts`, Empfänger, Leitfaden, Vertrag; ≈ 1 AStd plus Partnerumstellung |
| Nicht dauerhaft, eine Instanz | Freigabe-Demo, Plan §11 „Hosting“ | Warteschlange im Speicher | dauerhafter Stand mit Tabelle und Führung je Abonnement: ≈ 2 AStd (Folgeliste, vor jedem Pilot) |

## Offene Eigentümerfragen

1. **Teilung, Budget und Reihenfolge (Go nötig).** 065 wird 065a (3 AStd) und 065b (rund 1,5 AStd), zusammen 4,5 statt 2
   AStd laut Plan, beide hoch. Ohne Go baut 065a nicht; der Architekt schneidet dann neu. Mit Go ergänzt der
   Orchestrator den Teilungsvermerk im Plan-Eintrag 065.
2. **Was an Partner geht (Standard: Tabelle in Entscheidung 4).** Insbesondere: Gehen Rede- und Fragetexte
   (`ContributionCaptured.text`, `QuestionCaptured.text`) in der Freigabe-Demo an Partner? Standard ja (synthetisch,
   Kern des Partnernutzens). Alternative: nur Kennungen und Status, Texte fallen weg (eine Zeile je Typ in der Tabelle).
3. **`HV_MODE` aus 042 in 065b vorziehen (Go nötig, Planabweichung).** 065b baut `HV_MODE` im Konfigurationsschema und
   die Modusmarke in der Datenbank, weil die Sandbox laut ADR 0008 und 0010 der Modus `training` ist. 042 (nicht in der
   Freigabe-Demo) übernimmt das und ergänzt Banner, Podium-Sperre, Seed-Sperre und Löschprotokoll. Ohne Go bleibt die
   Sandbox bis 042 der Demo-Modus aus 065a, und der Weg über das lokale Paket (037a) entfällt für die Freigabe-Demo.

## Hinweise an Folgescheiben

**065b:** siehe „Was 065b vorfindet“ oben.

**064:** Führt 064 ein Systemmerkmal oder Systemsubjekte ein, gilt für beide Scheiben eine Form (Vor-dem-Bau-Punkt 2).
`SegmentIngested` ist für Webhooks nicht freigegeben (deny by default); eine Freigabe ist eine Zeile in
`WEBHOOK_EVENT_TYPES` mit Begründung. Nimmt ein späterer Push-Adapter signierte Aufrufe an, nutzt er dasselbe
Signaturformat (MF-05).

**047:** Mit `protected` folgt R-PERM-05 über Stufe (f) automatisch; Pflicht ist ein Test „`protected`-Frage → kein
Webhook“ (Planzeile 065, Nachweis „protected-Ereignis nicht zugestellt“, bis dahin über D6 vorweggenommen).

**041:** Die Rollenkarte zeigt `event_subscriber` als Systemrolle; die Zuordnung geht nur an `sys_`-Subjekte (R-ADM-12).

**052:** Rechtekonzept: Abschnitt Systemakteure mit dem Bündel aus Entscheidung 2.

**086:** Der Systemakteur `canary` nutzt dasselbe Merkmal `systemActor` und R-ADM-12.

## Folgelisten-Einträge, die 065a anlegt

1. Dauerhafter Zustellstand (Tabelle, nur INSERT/SELECT) und Führung je Abonnement bei mehreren Instanzen; Zustellprotokoll
   für T-G3-R-01. Ziel: vor jedem Pilot.
2. Ende eines Jahrgangs für Partner (`MeetingClosed` scheitert an Stufe b). Ziel: Entscheidung mit 042 oder 086.
3. Antworttext vorgelesener Fragen für Partner (heute nur `answerVersion`). Ziel: nach der Freigabe-Demo, mit einer Anmeldung
   für Systemakteure.
4. Ergänzung ADR 0008 um die Entscheidungen 1, 6 und 9. Ziel: Architekt, nach dem Lesebefund.

## Nachweise

- Ausgabe von `pnpm contract:lint` und `check.mjs` (Auszug); Typen-Diff für `Role`, `Action`, `webhooks`,
  `WebhookEventDelivery`, `WebhookEvent`, `WebhookEventType`.
- Wahrheitstabellen-Diff wörtlich.
- Ergebnis der acht Mutationsproben.
- `docs/evidence/065a-schnellstart.txt` (Durchlauf durch einen frischen Agenten, mit Commit-Hash).
- Schluss von `pnpm gates` mit Commit-Hash.
- Kein Screenshot: Keine Ansicht ändert sich.

## Bericht (nach Bau ausfüllen)

```
Slice: 065a-webhooks-partnerleitfaden
Done:
Evidence:
Open:
Touched:
```

**Vor dem Bau prüfen (Ergebnisse).**
1.
2.
3.
4.
5.
6.
7.
8.
9.

**Wahrheitstabellen-Diff (wörtlich).**

**Mutationsproben (Ergebnis).**

**Schnellstart-Durchlauf (Agent, Kontext, Ergebnis).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings
