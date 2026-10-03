# Scheibe 065a — Ereignisstrom für Nachbarn: signierte Webhooks und Partnerleitfaden (Teil 1 von 065)

**Status:** spec (03.10.2026; gelesen auf `2fc3153`, nach dem Merge von 043a und Spec 037a erneut auf `88fa9be`; überarbeitet nach dem Lesebefund zu `8b66fd5`: 0 blocker, 9 major, Minor und Nits; Teil 1 der geteilten Scheibe 065, Zuschnitt im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 4 AStd (Teil a, neu geschätzt nach dem Lesebefund; Schätzung 065b rund 1,5 AStd; Summe 5,5 statt 2 laut Plan) · Plan 065: 27.11.2026 (W9); für die Freigabe-Demo vorgezogen (Eigentümer 03.10.2026, Plan §11, Punkt 2 „Entwickler“); 043a (Vertrag 0.4.0) ist gemergt; Baustart frühestens nach dem Vertragsschritt von 064 und dem Go zu Eigentümerfrage 1 · Lanes: contract (erster Commit, Architekt); core (seriell, Wahrheitstabelle); service; web-shell (nur zwei Anzeigeschlüssel); infra (nur die drei neuen Skriptdateien); docs-integration; docs-sicherheit; docs-datenschutz (nur DSFA-Vorentwurf, Zeile Webhooks und Empfänger); docs-legal (nur ein Kopfvermerk im Rechtekonzept); docs-plan (nur eine Glossarzeile)
**Rolle:** architect für den Vertragsschritt (erster Commit, vor jedem Code; AGENTS.md R6). Danach implementierer-backend. Review in frischem Kontext mit den Perspektiven **Security** (SSRF, Signatur, Secrets, Rechtefilter), **Datenschutz** (was an Dritte geht, SG3, SG8) und **Vertrag** (Webhook-Format, Partnerkompatibilität). Lesebefund der Spec vor dem Bau in eigenem frischem Kontext (Risikoklasse hoch, Plan §11 „Schlankerer Ablauf“ gilt hier nicht). Den Schnellstart im Leitfaden befolgt ein **eigener Agent in frischem Kontext**, nicht der Implementierer (Vorbild 037a, S17). Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** neu **R-PERM-05** (Webhook-Sichtbarkeit für Systemakteure) und **R-ADM-12** (Systemrolle nur für Systemsubjekte, Menschenrolle nie für Systemsubjekte). Beide Nummern sind beim Bau gegen den dann gemergten Stand zu prüfen (nächste freie Nummer; R-ADM-01..11 sind von 040a–040d belegt oder reserviert). Angewandt: R-PERM-01, R-PERM-02, R-PERM-03, R-PERM-04, R-ADM-07. Dazu AGENTS.md R2, R3, R4, R6, R7, R8, R10, R11, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 065 (Zeile 854–859), Eintrag 042 (Zeile 637–642), §5.7 Exit-Kriterien (Zeile 829–833), §11 „Freigabe-Demo“ (Register E57) und Etappe D
- ADR 0008 (Abschnitt „Ereignisstrom für Nachbarn“, verworfene Alternative „Unsignierte Webhooks“), ADR 0010 (Sandbox = `training`), ADR 0014 mit Ergänzung 035a/035b (R-PERM-04, Verteiler), ADR 0015 (Patch-Stufe, zwei Zyklen für Partner), ADR 0003 (Dienstrolle nur INSERT/SELECT), ADR 0013 (keine Kennzahl je Person)
- Specs 035a, 035b (Sichtbarkeit, `maskEvent`, Verteiler `apps/api/src/stream/hub.ts`), 029b (Subject-Sperre), 043a (gemergt in `88fa9be`: Maskierung der Begründung, Regel 1 des Zuschnitts, Tabelle „043c Partnerschnittstellen“, deren Webhook-Teil 065a übernimmt), 044a (Maskierung von `QuestionLegalCleared.note` und `refusalJustification` in jedem Ereignis-Lesepfad), 034b (Konfigurationsschema, feste Sätze ohne Wert), 037a (lokales Betriebspaket, Spec gemergt in `938ffbe`, Bau offen), 064 (Transkript-Ingest, parallel auf `claude-spec-064`)
- `docs/datenschutz/dsfa-vorentwurf.md:161` (Nachbarsysteme, Zeile „Ereignisstrom, Webhooks“) und Zeile 186 ff. (Verarbeitungsverzeichnis, Spalte Empfänger)
- Lesebefund zu Spec 065a (03.10.2026, zu `8b66fd5`)
- Bedrohungsmodell AK4, AK6, SG3, SG7, SG8, T-G3-T-03, T-G3-R-01, T-G3-I-01, T-G3-D-02, T-G3-E-01, T-G3-E-02, MF-05, BF-19
- Standard Webhooks, Fassung 1 (öffentliche Spezifikation des Signaturformats `webhook-id`/`webhook-timestamp`/`webhook-signature`, `whsec_`-Secrets); übernommen, damit Partner vorhandene Prüfbibliotheken nutzen können

**Depends on:** 035a, 035b, 029b, 034b, 040a, 043a (alle gemergt, Stand `88fa9be`, Vertrag 0.4.0); Vertragsschritt von 064 (Reihenfolge der Patch-Stufen: 064 vor 065a, Auftrag des Orchestrators). 044a ist keine harte Voraussetzung (die betroffenen Ereignistypen sind hier ausgeschlossen, siehe Entscheidung 4), wird aber in den Lecktests mitgeprüft, wenn es gemergt ist
**Perspektive:** Security, Datenschutz, Vertrag · **Glossar: neue Begriffe:** ja, eine Zeile: „Ereignis-Abonnent (Systemakteur)“ / „Event subscriber (system actor)“ / `event_subscriber`

## Teilung und Zuschnitt

Die Planzeile 065 (2 AStd) bündelt drei Dinge: signierte Zustellung mit Rechtefilter, den Sandbox-Mandanten und den
Leitfaden. Allein die Zustellung berührt Vertrag, Kern (neue Rolle, neues Recht, Wahrheitstabelle), Dienst (ausgehende
Anfragen mit SSRF-Schutz) und ein Partner-Skript. Der Sandbox-Mandant braucht dazu `HV_MODE=training`, das laut Plan erst
042 baut, und Änderungen am lokalen Paket aus 037a. Zusammen sind das rund 5,5 AStd. Deshalb wird 065 geteilt, **ein PR je
Spec** (R12). Diese Spec beschreibt Teil a vollständig; 065b steht hier als Zuschnitt, seine Spec schreibt der Architekt
auf eigenem Zweig, sobald der Bau von 037a gemergt ist (die Spec ist es seit `938ffbe`) und der Eigentümer Frage 3
beantwortet hat.

| Teil | Inhalt | Klasse · AStd | Wann |
|---|---|---|---|
| **065a** (diese Spec) | Vertragsschritt (Rolle `event_subscriber`, Recht `webhook.receive`, Abschnitt `webhooks` mit Liefer- und Signaturformat); Systemrolle als Daten mit Guard R-ADM-12; Sichtbarkeitsregel R-PERM-05 als reine Funktion im Kern; Zustellung im Dienst (Konfiguration, Signatur, Wiederholung, Idempotenzschlüssel, SSRF-Schutz, Grenzen); Referenz-Empfänger `scripts/webhook-receiver.mjs` mit Prüffunktion; Demo-Helfer `scripts/webhook-demo.mjs` (Zuordnung und Erfassung über HTTP); Leitfaden `docs/integration/webhooks.md` mit Schnellstart gegen den Dienst im Demo-Modus; DSFA-Zeile und Kopfvermerk im Rechtekonzept | hoch · 4 | nach dem Vertragsschritt von 064 |
| **065b** | Sandbox-Mandant: `HV_MODE` im Konfigurationsschema (nur, was die Sandbox braucht; Banner, Podium-Sperre und Löschprotokoll bleiben 042), Modusmarke in der Datenbank mit Startverweigerung bei Abweichung (Datengrenze), `mode: training` in jeder Lieferung, Webhooks im Modus `training` erlaubt, lokales Paket startet in `training` mit erzeugtem Webhook-Secret, optionalem Empfänger-Container und Rollenzuordnung des Abonnenten in der Befüllung; Leitfadenabschnitt „Sandbox“ und Verweis auf der Installationsseite | hoch · rund 1,5 | nach 065a und dem Bau von 037a |

**Warum so geschnitten.** 065a ist allein vorführbar: Ein Partner startet den Dienst im Demo-Modus (synthetischer Korpus,
`pnpm --filter @hv/api dev`) und seinen Empfänger. Danach ordnet der Demo-Helfer `scripts/webhook-demo.mjs` den
Systemakteur zu und erfasst über HTTP eine Einzelfrage (mit den nötigen `If-Match`-Werten). Der Partner sieht signierte
Lieferungen, mit `from: start` zusätzlich den lieferbaren Teil des synthetischen Korpus. Die Oberfläche ist kein Weg des
Schnellstarts: Im HTTP-Modus sendet sie keinen `X-Actor`-Kopf, und gegen den Dienst im Demo-Modus gibt es keine
Anmeldung. 065b
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
- Die Subject-Sperre aus 029b prüft der Zusteller schon in 065a vor jedem Versuch, sobald ein Sitzungsspeicher
  existiert (Entscheidung 1). Im Paket (OIDC und Postgres) wird diese Prüfung damit wirksam; 065b ergänzt nur den Test
  gegen den echten Speicher.
- Der Empfänger im Paket läuft als eigener Compose-Dienst `webhook-receiver` aus dem Node-Basis-Image (Digest) mit dem
  schreibgeschützt eingehängten `scripts/webhook-receiver.mjs`; Ziel `http://webhook-receiver:9900/hooks`; Secret einmal
  erzeugt in `state.json` wie die übrigen Secrets aus 037a (Entscheidung 7 dort).
- Die Rollenzuordnung des Abonnenten schreibt `scripts/stack-seed.mjs` mit derselben Form, die R-ADM-12 verlangt
  (Subjekt `sys_partner_sandbox`, ohne `personId`, ohne `unitId`, ohne Vertretung).
- Folgen für 042: 042 übernimmt `HV_MODE` aus 065b und ergänzt Banner, Podium-Sperre, Seed-Sperre und Löschprotokoll.
  Das ist eine Planabweichung (Eigentümerfrage 3).

## Befund (Ist-Stand, gelesen auf `2fc3153`, nachgeprüft auf `88fa9be`)

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
8. **`docs/integration/`** gibt es auf `88fa9be` noch nicht; 064 legt es an (`docs/integration/transkript.md`).
9. **Schreibpfade für den Schnellstart.** Erfassen von Redebeitrag und Einzelfrage verlangt `If-Match` (Parameter
   `IfMatchRequired` seit 0.3.6, ohne Kopf 428). Die Oberfläche im HTTP-Modus sendet keinen `X-Actor`-Kopf; gegen den
   Dienst im Demo-Modus kann sie also nicht schreiben. Ein Schnellstart braucht deshalb einen Helfer, der die ETags liest.
10. **Korpusgröße (Vor-dem-Bau-Punkt 7, im Lesebefund gezählt):** `seedOnStart` erzeugt rund 1740 Ereignisse, davon rund
    1075 nach Entscheidung 4 lieferbar. Eine Warteschlange mit Grenze 1000 würde `from: start` sofort aussetzen; deshalb
    liefert 065a über einen Zeiger in das Log des Verteilers (Entscheidung 7). Der Bau zählt nach und nennt die Zahlen.
11. **Proxy aus der Umgebung.** Node kann `HTTP_PROXY`/`HTTPS_PROXY` für den globalen Agenten und `fetch` beachten
    (`NODE_USE_ENV_PROXY`, je nach Node-Version); in dieser Arbeitsumgebung ist `HTTPS_PROXY` gesetzt. Ein Proxy würde
    die Adressprüfung umgehen (die Verbindung ginge an den Proxy, die Auflösung fände dort statt).
12. **DSFA-Vorentwurf** `docs/datenschutz/dsfa-vorentwurf.md:161` beschreibt Webhooks als „fachliche Ereignisse mit
    personId … Empfänger in der Beta nur eigene Clients“. Beides stimmt nach 065a nicht mehr (kein `personId`, Empfänger
    ist ein Partner).
13. **Subject-Sperre (029b)** wirkt heute nur bei der Anmeldung und beim Sitzungsabgleich (`apps/api/src/app.ts:864, 873`,
    `isSubjectBlocked`). Ein Systemsubjekt meldet sich nie an; ohne eigene Prüfung im Zusteller wäre die Sperre für ihn
    wirkungslos.

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
- **Abschalten (Kill-Switch), drei Wege, alle ohne Codeänderung:**
  1. **Fachlich, sofort, ohne Neustart:** `revokeRole` der Zuordnung des Systemakteurs. Wirkt beim nächsten Stapel und
     **vor dem nächsten Versuch** (zweite Prüfung, Entscheidung 3); ein schon an den Transport übergebener Versuch läuft
     zu Ende (höchstens 10 s, Entscheidung 7). Test S9.
  2. **Subject-Sperre aus 029b:** Existiert ein Sitzungsspeicher (Postgres mit OIDC), prüft der Zusteller vor jedem
     Versuch `isSubjectBlocked(subjectId)`; ein gesperrtes Systemsubjekt erhält nichts, die feste Zeile lautet
     `HV-Tool API: webhook <id>: system actor blocked; nothing delivered.`. Scheitert die Prüfung selbst, wird nicht
     zugestellt (fail closed, Wiederholung nach Plan). Die Sperre gilt damit auch für Subjekte, die sich nie anmelden
     (Befund 13). Ohne Sitzungsspeicher (Demo-Modus in 065a) gibt es keine Sperrliste; dann gelten Weg 1 und 3. Test S9b
     mit eingespeistem Speicher. Gewählt ist die sicherere Variante: Prüfung schon in 065a, nicht erst in 065b.
  3. **Betrieb:** Variable `HV_WEBHOOK_SUBSCRIPTIONS` (oder den Eintrag) entfernen und den Dienst neu starten. Das
     beendet jede Zustellung dieses Abonnements unabhängig von Rechten. Der Leitfaden und die Installationsseite (065b)
     nennen diesen Weg als Notabschaltung.

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
- **Invariante gegen einen Abfluss über die Rechteverwaltung:** Die Leserechte des Systembündels sind eine Teilmenge der
  Leserechte **jedes** Bündels, das `admin.roles.manage` hält. Wer einen Systemakteur zuordnen kann, verschafft einem
  Partner also nie mehr Leserecht, als er selbst hat. Test D1b prüft das über die Daten (kein Rollenname); eine spätere
  Änderung an einem der Bündel, die das bricht, macht den Test rot und braucht eine Entscheidung.
- **R-ADM-12 (Guard in `assignRole`, 409 mit Regel-id, ohne Ereignis):**
  - Ein Systembündel geht nur an ein Subjekt mit Präfix `sys_` (Muster `^sys_[a-z0-9_]{1,60}$`), ohne `personId`, ohne
    `unitId` und ohne `deputyForSubjectId`.
  - Ein Bündel ohne Systemmerkmal geht nie an ein Subjekt mit Präfix `sys_`, und kein `deputyForSubjectId` beginnt mit
    `sys_`.
  - Prüfreihenfolge: nach der Rechteprüfung und der Formprüfung (422), vor R-ADM-07. Entscheidung über das Datenmerkmal,
    nie über den Rollennamen.
- **Demo-Kopf:** `parseActorHeader` verweigert ein Systembündel **und jede Kennung mit Präfix `sys_`** (gleich welche
  Rolle) mit 401 (fester Text wie bei unbekannter Rolle). Sonst könnte im Demo-Modus jemand unter dem Systemsubjekt mit
  einer Menschenrolle handeln und dessen Zuordnungsgeschichte vermischen. Damit
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

**Übernahme aus 043c.** Die Tabelle „Teile, Reihenfolge, Aufwand“ in 043a ordnet „Abonnements und Webhooks mit
Signaturkopf und gebundenen Nutzlastschemas, auch `AnswerDrafted` mit den Verweigerungsfeldern“ dem Teil 043c zu. 065a
übernimmt den Webhook-Teil von 043c vollständig (Signaturkopf, gebundene Nutzlastschemas je Typ, Entscheidung 5).
`AnswerDrafted` ist ausdrücklich ausgeschlossen (SG1, unten); ein gebundenes Schema dafür entfällt. 043c behält Ingest
(064), Vorschläge (066) und das Sicherheitsschema für Systemakteure.

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
| `QuestionClassified` | `track`, `agendaItemId`, `stageAssignment` (genau diese drei; `seatId` aus 040b kommt nur durch eine ausdrückliche spätere Entscheidung mit Tabellenzeile, Vertragsschritt und Test hinzu, nie dadurch, dass `Classification` wächst) | Antwortpfad, keine Inhalte |
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
- `streamId`: `str_` und 16 Zufallsbyte aus `crypto.randomBytes` als base64url (22 Zeichen), je Prozessstart und
  Abonnement. Ein neuer Wert heißt „neuer Strom, frühere Lieferungen können fehlen“.
- `previousSeq`: `seq` der vorigen Lieferung **dieses Stroms** an dieses Abonnement, `null` bei der ersten. Ein Partner
  erkennt eine Lücke, wenn `previousSeq` nicht seiner zuletzt verarbeiteten `seq` entspricht. Lücken in `seq` selbst sind
  normal (Filter, andere Jahrgänge). **Grenze, im Leitfaden benannt:** Ein Ereignis, das erst die zweite Prüfung vor dem
  Versuch ausfiltert (Entzug, Ablauf, Sperre, Leserecht), erscheint nicht als Lücke; `previousSeq` zeigt immer auf die
  letzte tatsächlich zugestellte Lieferung.
- Der Körper wird beim ersten Versuch einmal serialisiert; jede Wiederholung sendet **dieselben Bytes**. Ein Körper über
  256 KiB wird nicht gesendet; das Abonnement wird ausgesetzt (`internal`), weil ein Überspringen eine stille Lücke wäre.
- **Gebundene Nutzlast je Typ (Vertrag):** `WebhookEvent` ist ein `oneOf` mit Diskriminator `type`, ein Schema je Typ aus
  Entscheidung 4, jedes mit `additionalProperties: false` auf Umschlag und Nutzlast und genau den Schlüsseln der Tabelle.
  Damit ist die Nutzlast an Partner vertraglich festgelegt, nicht nur beschrieben.

### 6. Signatur, Idempotenzschlüssel, Secrets (Standard Webhooks, Fassung 1)

- `webhook-id`: `msg_<subscriptionId>_<event.id>`. `event.id` ist die unveränderliche Kennung des Ereignisses im Log
  (heute `crypto.randomUUID`, `packages/domain/src/api.ts:175-177`). Die ID ist gleich über alle Versuche, **und gleich
  über Neustarts und Neuaufbauten des Verteilers für dasselbe Ereignis**, aber nie gleich für zwei verschiedene
  Ereignisse. Eine Kennung aus `seq` wäre nach einem Neuaufbau mit anderem Log nicht eindeutig gewesen; ein Empfänger
  hätte neue Ereignisse als Doppel verworfen. **Das ist der Idempotenzschlüssel**; der Empfänger verwirft eine bereits
  verarbeitete ID mit 2xx.
- `webhook-timestamp`: ganze Sekunden der **injizierten Uhr** des Dienstes (R8) zum Zeitpunkt des Versuchs; neu je
  Versuch.
- `webhook-signature`: `v1,<base64(HMAC-SHA256(key, "<webhook-id>.<webhook-timestamp>.<Körper>"))>`, `key` sind die
  dekodierten Bytes des Secrets. Bei zwei konfigurierten Secrets (Wechsel) stehen zwei Einträge durch ein Leerzeichen
  getrennt; der Empfänger akzeptiert, wenn einer passt.
- **Secrets** `whsec_<base64>` mit 32 bis 64 Byte, nur aus der Umgebung (R11, SG7), höchstens zwei je Abonnement. Nie in
  Log, Fehlersatz, Zugriffslog oder Antwort. Jeder Eintrag in `HV_WEBHOOK_SECRETS` wird **am ersten `=`** in ID und
  Secret getrennt (Base64 enthält selbst `=`).
- **Toleranz beim Empfänger:** 300 s in beide Richtungen; verarbeitete IDs mindestens 24 h aufbewahren (deckt die
  Wiederholungsdauer von höchstens 1 h aus Entscheidung 7 plus Toleranz reichlich ab). Der Referenz-Empfänger hält die
  IDs nur im Speicher; nach seinem Neustart erkennt er Doppel nicht mehr. Der Leitfaden sagt das und empfiehlt einem
  echten Empfänger einen dauerhaften Speicher.
- **Testvektor** (verbindlich für `sign.ts`, Empfängertest und Leitfaden; das Secret ist offensichtlich synthetisch, 32
  Byte `0x01`):
  - Secret `whsec_AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=`
  - `webhook-id` `msg_partner-demo_6f1c2a4e-8b3d-4c5a-9e7f-0123456789ab`, `webhook-timestamp` `1795000000`
  - Körper (exakt, ohne Zeilenumbruch):
    `{"deliveryVersion":1,"mode":"demo","subscriptionId":"partner-demo","streamId":"str_test","previousSeq":null,"event":{"seq":42,"type":"MeetingStarted"}}`
  - erwartete Signatur `v1,1ZTPf76OuDh59pKlUwtVa+KcBb3i/do8zNe9Zo345ow=`
  - zweites Secret für den Wechseltest `whsec_AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=` →
    `v1,6lEIniOZ93x1UVQv9TVnu5g7shwFpImlVUhQMYCLK9E=`
  - Der Vektor-Körper ist bewusst kein vollständiges `WebhookEventDelivery`; er prüft nur die Signatur.

### 7. Zustellung: Zeiger ins Log, Reihenfolge, Wiederholung, Grenzen

- **Zeiger statt Warteschlange.** Je Abonnement hält der Zusteller einen Zeiger (`cursor`, die `seq` des zuletzt
  abgeschlossenen Ereignisses) und eine Liste von Verweisen auf die noch nicht abgeschlossenen Ereignisse aus dem
  geprüften Log des Verteilers (Verweise auf dieselben Objekte, die der Verteiler aus `register` und `onBatch` übergibt;
  keine Kopien, keine Körper). Der **Rückstand** ist `head − cursor`.
  - `onBatch` hängt nur Verweise an (synchron, ohne `await`, ohne Netz) und prüft die erste Stufe von R-PERM-05 mit der
    Projektion nach dem Stapel; abgelehnte Ereignisse werden nicht angehängt.
  - **Körper werden erst gebaut, wenn das Ereignis an der Reihe ist** (Nachlauf ohne Vorbau). Gleichzeitig existiert je
    Abonnement höchstens ein gebauter Körper.
  - `from: start` hängt beim Start die Verweise des ganzen Logs an (`HubSnapshot.log`); geprüft wird beim Einreihen und
    vor dem Versuch mit der aktuellen Projektion. Mit dem Korpus (rund 1740 Ereignisse, rund 1075 lieferbar, Befund 10)
    läuft das ohne Aussetzen durch.
- **Je Abonnement streng der Reihe nach, höchstens eine Anfrage gleichzeitig** (Reihenfolge nach `seq`; ein hängendes
  Ereignis hält die folgenden desselben Abonnements an, nie die anderer Abonnements).
- **Erfolg:** jeder Status 2xx. **Fehlschlag:** jeder andere Status, eine Weiterleitung (3xx wird nie verfolgt),
  Verbindungs- oder DNS-Fehler, Zeitüberschreitung, Zielverweigerung (Entscheidung 8), Sperre (Entscheidung 1).
- **Wiederholung:** Wartezeit vor Versuch n+1 ist `min(300 s, 2^(n-1) s)`, mal einem Zufallsfaktor in [0,8; 1,2].
  `Retry-After` (Sekunden oder HTTP-Datum) bei 429 und 503 gilt, wenn größer als die berechnete Wartezeit, gedeckelt auf
  300 s. Zeitgeber und Uhr sind injiziert (Tests ohne echte Wartezeit).
- **Kein Aufgeben eines einzelnen Ereignisses.** Ein Ereignis wird nie übersprungen. Stattdessen wird das Abonnement
  **ausgesetzt** (`suspended`), wenn:
  - das Ereignis an der Reihe seit mehr als 1 h auf Erfolg wartet (`retry_window`);
  - der Rückstand 10 000 Ereignisse übersteigt (`backlog`; Verweise sind billig, die Grenze schützt vor einem
    Empfänger, der dauerhaft nicht nachkommt);
  - der Verteiler `reset` oder `unavailable` meldet (`integrity`; Kette nicht mehr geprüft; fail closed);
  - ein Körper 256 KiB übersteigt oder ein unerwarteter Fehler im eigenen Code auftritt (`internal`). Der Zusteller fängt
    **jeden** eigenen Fehler (auch in Zeitgeber-Rückrufen und Promise-Ketten), setzt nur das betroffene Abonnement aus
    und lässt Prozess und andere Abonnements weiterlaufen.
  Ausgesetzt heißt: Verweise verworfen, keine Anfrage mehr, eine feste Zeile `HV-Tool API: webhook <id> suspended
  (<grund>).` mit Grund aus `{retry_window, backlog, integrity, internal}`. Wieder aufgenommen wird nur durch Neustart des
  Dienstes; der neue Strom hat eine neue `streamId`.
- **Beginn eines Abonnements:** Ein Abonnement beginnt erst, wenn sein Systemsubjekt **erstmals** eine aktive Zuordnung
  hat (geprüft bei jedem Stapel). Vorher bewegt sich kein Zeiger, und es wird nichts verworfen. Ab dem Beginn gilt `from`:
  `head` (Standard) liefert die Ereignisse nach diesem Zeitpunkt, `start` den Nachlauf über das ganze Log ab diesem
  Zeitpunkt. Ab dem Beginn wird jedes Ereignis, das eine der beiden Prüfungen ablehnt, endgültig übergangen; ein späterer
  Entzug mit erneuter Zuordnung holt nichts nach (sonst erhielte ein Partner Ereignisse aus einer Zeit ohne Recht).
- **Zeitgrenzen je Versuch:** DNS 3 s, Verbindung 3 s, gesamter Versuch bis zum Ende des gelesenen Antwortkörpers 10 s.
  Vom Antwortkörper werden höchstens 4 KiB gelesen und verworfen, nie geloggt.
- **Grenzen** (feste Konstanten wie in 035b; eine Anhebung ist eine Spec-Änderung): höchstens 5 Abonnements, höchstens
  20 Ereignistypen je Abonnement, URL höchstens 2048 Zeichen, Rückstand 10 000, Körper 256 KiB.
- **Kernprozess unberührt:** Kein Schreibpfad wartet je auf eine Zustellung.
- **Mehrere Instanzen:** Mit Postgres und zwei Instanzen stellt jede zu; der Empfänger dedupliziert über `webhook-id`
  (eindeutig je Ereignis, Entscheidung 6). Das lokale Paket und die Demo haben eine Instanz. Benannt im Leitfaden; eine
  Führung je Abonnement folgt mit der dauerhaften Zustellung (Folgeliste, vor jedem Pilot).
- **Nicht dauerhaft:** Zeiger und Stand liegen im Speicher. Ein Neustart beginnt mit `from` neu. Begründung:
  dauerhafter Zustellstand braucht eine eigene Tabelle (Migration, Lane persist) und wäre in der Freigabe-Demo ohne
  Mehrwert; T-G3-R-01 („Zustellprotokoll“) bleibt deshalb teilweise offen (Folgeliste).

### 8. SSRF-Schutz (T-G3-E-02)

- **Zwei Schlüssel für jedes Ziel:** Der Host der URL muss exakt (ohne Platzhalter, Kleinschreibung) in
  `HV_WEBHOOK_ALLOWED_HOSTS` stehen, **und** jede aufgelöste Adresse muss die Bereichsprüfung bestehen.
- **Bereichsprüfung, Grundsatz Allowlist für IPv6:** Jede Adresse wird zuerst normalisiert, dann geprüft.
  1. **Eingebettetes IPv4 wird als IPv4 geprüft:** IPv4-gemappt `::ffff:0:0/96`, IPv4-übersetzt `::ffff:0:0:0/96` und
     IPv4-kompatibel `::/96` (außer `::` und `::1`). Die eingebettete Adresse durchläuft die IPv4-Regel.
  2. **IPv4, Zielmodus `public`:** gesperrt sind `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`,
     `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.88.99.0/24`, `192.168.0.0/16`,
     `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4` (enthält `255.255.255.255`).
  3. **IPv6, Zielmodus `public`:** erlaubt ist **nur** `2000::/3`, und darin gesperrt `2001::/23` (Protokollzuweisungen
     der IETF, darunter Teredo `2001::/32`), `2001:db8::/32` und `3fff::/20` (Dokumentation) sowie `2002::/16` (6to4).
     Alles außerhalb von `2000::/3` ist gesperrt, also auch NAT64 `64:ff9b::/96` und `64:ff9b:1::/48`, `100::/64`,
     `fc00::/7`, `fe80::/10`, `ff00::/8`, `::/128`, `::1/128`. **Kein Entpacken von NAT64 oder 6to4:** Diese Adressen sind
     ohne Ausnahme gesperrt (sicherere Wahl; ein Partner hinter reinem NAT64 ist in dieser Fassung nicht erreichbar,
     benannt im Leitfaden).
  4. **Zielmodus `local`** erlaubt zusätzlich `http` sowie `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`,
     `192.168.0.0/16`, `::1/128` und `fc00::/7`. **Immer gesperrt bleiben** `169.254.0.0/16` und `fe80::/10`
     (Metadatendienste der Plattformen), `0.0.0.0/8`, `::/128`, Multicast, Broadcast, NAT64 und 6to4.
  - Umsetzung über `net.BlockList` und `net.isIP` aus Node, keine neue Abhängigkeit; die Normalisierung (Schritt 1) ist
    eine eigene, einzeln getestete Funktion in `target.ts`.
- **Gegen DNS-Rebinding:** Je Versuch eine Auflösung aller Adressen (`dns.lookup` mit `all: true`, Zeitgrenze 3 s). Ist
  **eine** gesperrt, wird nicht verbunden, auch wenn andere erlaubt wären. Verbunden wird mit genau der geprüften
  Adresse. Dafür bekommt die Anfrage eine eigene `lookup`-Funktion, die nur diese Adresse zurückgibt und **beide
  Aufrufformen** bedient: mit `options.all === true` ein Feld `[{ address, family }]` (so ruft Node bei
  `autoSelectFamily` auf), sonst `(err, address, family)`. Zusätzlich `autoSelectFamily: false` am Agenten. TLS prüft das
  Zertifikat gegen den Hostnamen (`servername`), wie üblich.
- **Kein Proxy aus der Umgebung (Befund 11):** Zugestellt wird über `node:http`/`node:https` mit einem **eigenen
  Agenten je Abonnement** (`new https.Agent({ … })` bzw. `http.Agent`, `keepAlive` erlaubt), nie über den globalen Agenten
  und nie über das globale `fetch`. Der Agent wird ohne Proxy-Option angelegt; `HTTP_PROXY`, `HTTPS_PROXY`,
  `NO_PROXY` und `NODE_USE_ENV_PROXY` haben keine Wirkung auf die Zustellung. Test S8b setzt diese Variablen im
  Testprozess und belegt, dass die Verbindung an die geprüfte Adresse geht und ein Lockvogel-Proxy nichts erhält.
- **Keine Weiterleitung**, keine Zugangsdaten in der URL (Konfigurationsfehler), kein Fragment.
- Eine Zielverweigerung ist ein Fehlschlag mit Wiederholung (DNS kann sich ändern) und eine feste Zeile
  `HV-Tool API: webhook <id>: target refused.` höchstens einmal je Minute, nie mit Adresse oder Host.
- **Kennzahlen:** keine neue in 065a (Befund 6). Sichtbar sind Aussetzen, Zielverweigerung, Sperre und Zuordnungsfehlen
  über die festen Zeilen; der Empfänger sieht jede Lieferung.

### 9. Nur synthetische Daten (Datengrenze in 065a)

- Webhooks starten **nur mit `HV_DEMO=1`** (065b ergänzt `HV_MODE=training`). Ohne diese Bedingung verweigert der Dienst
  den Start, sobald eine Webhook-Variable gesetzt ist (fester Satz: „webhooks require HV_DEMO=1 (synthetic data only)“).
- Begründung: Lieferungen tragen Rede- und Fragetexte von Aktionären und pseudonyme Kennungen an Dritte. Dafür braucht
  es DSFA und Auftragsverarbeitung (E14) und eine Entscheidung des Eigentümers. Das ist nicht Teil der Freigabe-Demo und
  keine Frage dieser Spec (Standard „aus“, siehe „Standards“).
- Der DSFA-Vorentwurf wird im selben PR berichtigt (Befund 12): Zeile 161 und der Eintrag in der Spalte „Empfänger“
  des Verarbeitungsverzeichnisses nennen künftig: Empfänger sind Partner-Empfänger (Nachbarsysteme), in der Beta nur mit
  synthetischen Daten (`HV_DEMO=1`, ab 065b `HV_MODE=training`); kein Klarname, kein `personId`, keine Kennung von
  Beschäftigten; eine Nutzung mit echten Daten braucht E14 und einen Vertrag zur Auftragsverarbeitung mit dem Partner.
- Damit gilt in 065a immer `mode: "demo"`. Der Zielmodus `local` ist zusätzlich nur mit `HV_DEMO=1` zulässig (doppelt
  ausgedrückt, damit 065b die Bedingungen getrennt erweitern kann).

### 10. Konfiguration (Schema 034b, `.env.example`)

| Variable | Form | Regel |
|---|---|---|
| `HV_WEBHOOK_SUBSCRIPTIONS` | JSON-Liste, je Eintrag `id` (`^[a-z0-9-]{1,32}$`, eindeutig), `subjectId` (`^sys_[a-z0-9_]{1,60}$`), `url`, `eventTypes` (nicht leer, Teilmenge von `WEBHOOK_EVENT_TYPES`, ohne Doppel), optional `meetingId`, optional `from` (`head` \| `start`) | höchstens 5 Einträge; keine weiteren Schlüssel; URL nach Entscheidung 8 |
| `HV_WEBHOOK_SECRETS` | `id=whsec_…` durch Komma getrennt, je ID ein oder zwei Einträge; jeder Eintrag wird am **ersten** `=` getrennt | jede ID aus der Liste hat ein Secret; kein Secret für eine unbekannte ID; Länge 32–64 Byte; kanonisches Base64 |
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

### 12. Demo-Helfer für den Schnellstart (`scripts/webhook-demo.mjs`)

Der Schnellstart braucht zwei Schreibvorgänge, die ein Partner sonst nur mühsam von Hand absetzt (Befund 9). Ein kleines
Skript, nur Node-Bordmittel, übernimmt sie:

- `node scripts/webhook-demo.mjs assign --subject sys_partner_demo --role event_subscriber`: liest den laufenden Jahrgang
  (`GET /v1/meeting`) und ordnet dem Systemsubjekt die Rolle über `POST /v1/meetings/{meetingId}/role-assignments` zu.
  Der Rollenname steht nur als Argument im Leitfaden; das Skript enthält keinen Rollennamen (R4, Rollen-Literal-Tor).
- `node scripts/webhook-demo.mjs capture`: wählt eine Wortmeldung aus `GET /v1/speakers`, erfasst einen Redebeitrag und
  daraus eine Einzelfrage. Die `If-Match`-Werte liest es aus den `ETag`-Köpfen der zugehörigen Leseantworten, wie
  `IfMatchRequired` es beschreibt; welche Ressource je Schreibvorgang gilt, prüft der Bau (Vor-dem-Bau-Punkt 10).
- **Akteure** über `X-Actor` aus Argumenten (`--admin u-admin:admin`, `--capture u-cap-1:capture`, so im Leitfaden
  angegeben); das Skript hat keine eingebauten Rollennamen.
- **Nur gegen den eigenen Rechner:** Ziel fest `http://127.0.0.1:<port>` (Standard 8787, nur der Port ist wählbar), nie
  `localhost` (Auflösung auf `::1` oder fremde Einträge), nie ein anderer Host. Der Dienst nimmt `X-Actor` ohnehin nur im
  Demo-Modus an.
- Ausgabe: je Schritt eine Zeile ohne Text der Frage; Fehler mit HTTP-Status und `ruleId`, Exit 1.

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

Gezählt auf `88fa9be` (043a ändert keine Rechte). Fügen 040b, 044a oder 064 vorher Spalten oder Zeilen hinzu, zählt der Bericht neu; die Aussagen
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
| Signatur | **Replay:** Ein Mitschnitt einer Lieferung wird später erneut an den Empfänger geschickt | Zeitstempel in der Signatur, Toleranz 300 s; `webhook-id` aus der Ereigniskennung als Idempotenzschlüssel, IDs 24 h aufbewahrt | Empfänger verwirft und zählt („duplicate“, „timestamp“); Tests R3, R4 (Skript), S4 (gleiche ID über Versuche), S11b (gleiche ID nach Neuaufbau, neue ID für neues Ereignis) |
| Signatur | **Veränderung unterwegs** (Körper, ID oder Zeitstempel geändert) | HMAC über `id.timestamp.body`, Vergleich in konstanter Zeit | Empfänger antwortet 401, Lieferung gilt als Fehlschlag; Tests R2, R7; Mutationsprobe M3 |
| Zeit | **Zeitversatz:** Die Uhr des Dienstes läuft weg, Empfänger lehnen alles ab; oder ein Angreifer setzt einen künftigen Zeitstempel | Zeitstempel aus der injizierten Uhr (R8), Uhrprüfung über NTP (033a, `/readyz` `clock_drift`); Toleranz in beide Richtungen | `/readyz` meldet die Drift; abgelehnte Versuche führen nach 1 h zu `suspended (retry_window)` mit fester Zeile; Test R3 (±299 s gültig, ±301 s ungültig) |
| Ziel | **SSRF:** Ziel-URL oder DNS zeigt auf interne Adressen (Metadatendienst, Datenbank, Admin-Oberflächen) | Abonnement nur aus Konfiguration; Host-Allowlist; Bereichsprüfung aller aufgelösten Adressen; Verbindung zur geprüften Adresse über einen eigenen Agenten ohne Proxy aus der Umgebung; IPv6 nur `2000::/3` ohne Sonderbereiche; eingebettetes IPv4 als IPv4 geprüft; NAT64 und 6to4 gesperrt; keine Weiterleitung; Metadatenbereiche auch in `local` gesperrt | feste Zeile „target refused“; Test S8 (Bereiche, gemischte Antworten, Rebinding, gemappt, übersetzt, kompatibel, NAT64 /96 und /48, 6to4, Teredo), S8b (Proxy-Variablen gesetzt), S6 (Weiterleitung nicht verfolgt); Mutationsproben M6, M9 |
| Wiederholung | **Wiederholungssturm:** Ein ausgefallener Empfänger kommt zurück und wird mit Anfragen überflutet, oder viele Abonnements verstärken sich | höchstens eine Anfrage je Abonnement, höchstens 5 Abonnements; exponentieller Abstand mit Zufall und Deckel 300 s; `Retry-After` beachtet und gedeckelt; Aufholen strikt nacheinander | Test S4 (Abstände nach Plan), S5 (`Retry-After`), S7 (Isolation der Abonnements) |
| Empfänger | **Langsamer Empfänger** (Slowloris, riesiger Antwortkörper, hängende Verbindung) staut Speicher oder Dienst | Zeitgrenzen 3/3/10 s; Antwortkörper höchstens 4 KiB; Zeiger ins Log statt Körper auf Vorrat (je Abonnement höchstens ein gebauter Körper), Rückstand höchstens 10 000, dann `suspended (backlog)`; Einreihen ohne Netz | Test S6, S7, S12 (Schreibpfad wartet nicht); feste Zeile |
| Secret | **Wechsel und Leck:** Ein Secret ist bekannt geworden; der Wechsel darf keine Lieferung verlieren | zwei Secrets gleichzeitig, beide signieren; Ablauf im Leitfaden (neu dazu → Partner stellt um → alt entfernen); Secrets nur aus der Umgebung, nie im Log | Partner sieht beide Signaturen; Test S2 (zwei Einträge), R5 (Empfänger mit nur neuem Secret akzeptiert); Test S1 (kein Wert in Fehlersätzen, `ServiceConfig` serialisiert keine Secrets) |
| Rechte | **Leck über Rechtegrenzen:** Abonnent erhält Entwürfe, Rechtseinschätzungen, Notizen, Personendaten, Arbeitszuordnungen, künftig `protected` | R-PERM-05 Stufen a–f; Typ- und Feld-Allowlist; `maskEvent`; kein `actor`; Prüfung vor jedem Versuch; Systemrolle nicht für Menschen (R-ADM-12) und nicht im Demo-Kopf | Tests D3–D6, S9, S10; Mutationsproben M1, M2, M4, M5 |
| Rechteverwaltung | **Abfluss durch Administration und Betrieb zusammen:** Eine Person mit `admin.roles.manage` ordnet einem Systemsubjekt die Abonnentenrolle zu, und der Betrieb trägt eine fremde Ziel-URL ein; so fließen Ereignisse an einen Empfänger, den niemand freigegeben hat (AK4, AK8) | zwei getrennte Schlüssel (Zuordnung im Log, Abonnement in der Konfiguration mit Host-Allowlist); Systembündel liest nie mehr als jeder Inhaber von `admin.roles.manage` (Invariante D1b); nur synthetische Daten (Entscheidung 9); Kill-Switch (Entscheidung 1) | **Signal:** jedes `RoleAssigned` mit einem Systembündel steht im Log und im Verlauf mit dem Abzeichen „Administration“ (040a); die Prüfung der Zuordnungen von Systemsubjekten gehört in die Admin-Anleitung (041) und das Runbook (070); Tests D1b, D2 |
| Datengrenze | **Sandbox und echte Daten mischen sich:** Webhooks liefern aus einem Bestand mit echten Personen an einen Partner, oder ein Partner hält Demo-Lieferungen für echte | Start nur mit `HV_DEMO=1` (065a), `mode` in jeder Lieferung; 065b: Modusmarke in der Datenbank, Startverweigerung bei Abweichung | Test S1 (ohne `HV_DEMO` → Start verweigert); `mode` im Vertragsschema als Pflichtfeld; 065b mit eigenem Test |

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6)

Additiv; kein bestehendes Anfrageschema erhält ein Feld (043a, Regel 1):

- **Version:** die nächste freie Patch-Stufe **beim Merge** dieses Schritts; die Zahl legt der Architekt erst dann fest
  (heute ist 0.4.0 gemergt; 044a und 064 nehmen voraussichtlich die Stufen davor). Ist beim Merge eine Stufe schon
  vergeben, nimmt der Schritt die nächste. `info.version`, `packages/contract/package.json`, Abschnitt `## [0.4.x]` in
  `packages/contract/CHANGELOG.md` mit `### Added`.
- **`Role`:** Wert `event_subscriber`. Beschreibung: Systemakteur; nur Subjekte `sys_…`; nie einer Person zugeordnet
  (R-ADM-12); keine Anmeldung; Bündel in `docs/rollen-und-rechtekonzept.md` folgt mit 052.
- **`Action`:** Wert `webhook.receive` mit Beschreibung („Since 0.4.x: a system actor receives signed webhooks for the
  events it may read (R-PERM-05). Never granted to a person.“).
- **`assignRole`, Antwort 409:** Beschreibung ergänzt um R-ADM-12.
- **Neuer Abschnitt `webhooks`** (OpenAPI 3.1) mit genau einem Eintrag `eventDelivered`, `post`, `operationId`
  `webhookEventDelivered`:
  - `security: []`: Die Operation hat kein Sicherheitsschema der Anmeldung; ihre Echtheit belegt die HMAC-Signatur, die
    die Beschreibung vollständig erklärt (Entscheidung 6).
  - Kopfparameter `webhook-id` (Muster `^msg_[a-z0-9-]{1,32}_[A-Za-z0-9-]{1,64}$`, Ereigniskennung nach dem zweiten
    Unterstrich), `webhook-timestamp` (`^[0-9]{1,12}$`),
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
  - `WebhookEvent`: `oneOf` über 18 Schemas `WebhookEvent<Typ>` (etwa `WebhookEventQuestionCaptured`) mit
    `discriminator: { propertyName: type, mapping: … }`. Jedes Schema: Umschlag über `allOf` aus einem gemeinsamen
    `WebhookEventEnvelope` (`required` `[seq, id, type, at, meetingId, subjectId, payload, sourceHash]`, optional
    `schemaVersion`, `occurredAt`, `recordedAt`, `occurredAtSource`), `type` als `const`, `payload` mit genau den
    Schlüsseln der Tabelle aus Entscheidung 4 als `properties` (Typen aus den bestehenden Schemas, etwa `Track`,
    `SpeakerStatus`, `TextSpan`), `required` nur für die im Ereignis immer vorhandenen Schlüssel und
    `additionalProperties: false`. Weil `allOf` und `additionalProperties: false` zusammen nicht tragen, wiederholt jedes
    Typschema die Umschlagfelder flach mit `additionalProperties: false` (der Architekt wählt die Form, die Redocly und
    openapi-typescript ohne neue Meldung annehmen; Vor-dem-Bau-Punkt 4). Typen ohne Nutzlast haben
    `payload: { type: object, additionalProperties: false, maxProperties: 0 }`.
  - `WebhookEventType`: Enum der 18 Typen aus Entscheidung 4, gleich der Menge der `const`-Werte (Test).
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
- `apps/api/src/app.ts` (nur Option `webhooks`, Start des Zustellers am Verteiler, Übergabe der Sperrprüfung
  `isSubjectBlocked` des Sitzungsspeichers, falls vorhanden, Testhaken für Zeitgeber, Zufall und `lookup`)
- `apps/api/src/server.ts` (nur Weitergabe der Konfiguration)
- `apps/api/src/actor.ts` (nur die Verweigerung eines Systembündels und jeder `sys_`-Kennung in `parseActorHeader`)
- `apps/api/src/__tests__/webhooks065a.test.ts` (neu)
- `apps/api/src/__tests__/config034b.test.ts` (nur die neuen Variablen in Drift- und Bekanntheitsprüfung)

Oberfläche (nur, was die Typprüfung erzwingt):

- `apps/web/src/i18n/labels.ts` (je ein Eintrag in `ROLE_KEYS` und `ACTION_KEYS`)
- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts` (je zwei Schlüssel)
- `apps/web/src/i18n/parity.test.ts` (nur die Gesamtzahl der Schlüssel in Test (f) und ihr Kommentar)

Skripte:

- `scripts/webhook-receiver.mjs` (neu)
- `scripts/webhook-receiver.test.mjs` (neu)
- `scripts/webhook-demo.mjs` (neu, Entscheidung 12)

Dokumente:

- `docs/integration/webhooks.md` (neu, Gliederung unten verbindlich)
- `docs/integration/README.md` (nur eine Verweiszeile auf `webhooks.md`; anlegen mit genau dieser Zeile und einer
  Überschrift, falls 064 die Datei nicht angelegt hat)
- `docs/glossar.md` (nur die eine Zeile „Ereignis-Abonnent (Systemakteur)“)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile 161 „Ereignisstrom, Webhooks“ und der Empfänger-Eintrag dieser
  Verarbeitung im Verzeichnis ab Zeile 186; Inhalt nach Entscheidung 9)
- `docs/rollen-und-rechtekonzept.md` (nur ein Kopfvermerk „Scheibe 065a, Systemakteur `event_subscriber`“ im Stil der
  Vermerke zu 025, 026, 028 und 040a: Bündel, nie für Personen (R-ADM-12), Invariante D1b, Abschnitt Systemakteure folgt
  mit 052)
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

1. **Stand des Integrationszweigs.** 043a ist seit `88fa9be` gemergt (Vertrag 0.4.0). Welche 0.4.x-Stufen sind beim
   Baustart vergeben? Ist der Vertragsschritt von 064 gemergt? Fehlt 064: Orchestrator fragen, ob 065a vorzieht (dann nimmt
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
   `Record<Permission, …>`, Tabellen in Tests)? Heute bekannt: `permissions.ts`, `labels.ts`, `stream035.test.ts`,
   `parity.test.ts` (Schlüsselzahl, heute 517 in Test (f); nach 065a plus 2, gezählt beim Bau). Weitere
   Fundstellen im Bericht; liegen sie außerhalb von „Files allowed“: anhalten und melden.
7. **Korpusgröße (beantwortet).** Der Lesebefund zählte rund 1740 Ereignisse aus `seedOnStart`, davon rund 1075 nach
   Entscheidung 4 lieferbar. Deshalb liefert 065a über einen Zeiger ins Log ohne Körper auf Vorrat (Entscheidung 7), mit
   Rückstandsgrenze 10 000. Der Bau zählt nach und nennt beide Zahlen im Bericht; liegt die Gesamtzahl über 10 000:
   anhalten und melden.
8. **`MeetingCreated.meetingId`.** Trägt das Ereignis `meetingId`? Wenn nicht, ist es über Stufe (a) nie lieferbar; dann
   fällt es aus der Tabelle (Vertrag und Kern gleich), Befund im Bericht.
9. **Rollen-Literal-Tor.** Erkennt `scripts/role-literal-check.mjs` die neue Rolle aus der Union, und sind `labels.ts`
   und Tests wie bisher ausgenommen? Ein Treffer im Dienst oder in `scripts/webhook-demo.mjs` ist ein Befund, keine
   Ausnahme.
10. **Schreibpfade des Demo-Helfers.** Welche `ETag` gehört laut `IfMatchRequired` zu `POST /v1/contributions` und zu
    `POST /v1/contributions/{id}/questions`, und verlangt der Demo-Modus `X-CSRF-Token`? Der Helfer folgt dem Code;
    Abweichungen von Entscheidung 12 im Bericht.
11. **Ereigniskennungen.** Passen alle `event.id` des Korpus und neuer Ereignisse in das Muster
    `^[A-Za-z0-9-]{1,64}$` (Teil von `webhook-id`)? Wenn nicht: anhalten, der Architekt passt das Muster an.
12. **Proxy-Verhalten der Node-Version.** Welche Node-Version läuft in CI und im Image (037a)? Beachtet sie
    `NODE_USE_ENV_PROXY` für eigene Agenten? Test S8b gilt unabhängig davon; Ergebnis im Bericht.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/webhooks065a.test.ts`):

- **D1** Bündel: `ROLE_PERMISSIONS.event_subscriber` ist genau die Liste aus Entscheidung 2; `isSystemBundle` ist nur
  dort wahr; keine andere Rolle hält `webhook.receive`; admin hält es nicht.
- **D1b** Invariante (Entscheidung 2): Für jedes Bündel, das `admin.roles.manage` hält (über die Daten gefunden, kein
  Rollenname), gilt: Leserechte des Systembündels (Schnittmenge mit `READ_PERMISSION_LIST`) ⊆ Leserechte dieses
  Bündels. Mutationsprobe M10.
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
`local`; Uhr, Zeitgeber, Zufall und `lookup` injiziert):

- **S1** Konfiguration: alle vier ungesetzt → aus; nur eine gesetzt → Verweigerung; ohne `HV_DEMO=1` → Verweigerung;
  `local` ohne Demo → Verweigerung; Host nicht in der Allowlist; `http` in `public`; URL mit Zugangsdaten oder Fragment;
  mehr als 5 Einträge; doppelte ID; unbekannter Ereignistyp; unbekannter Schlüssel; fehlendes, zu kurzes, nicht
  kanonisches Secret; Secret für unbekannte ID → je Verweigerung mit festem Satz. Kein Satz enthält URL, Host, Secret oder
  ID. `JSON.stringify(config)` und `util.inspect(config)` enthalten kein Secret.
- **S2** Signatur: `sign.ts` erzeugt den Testvektor aus Entscheidung 6 exakt; zwei Secrets → zwei `v1,`-Einträge in der
  Reihenfolge der Konfiguration; `webhook-timestamp` ist die injizierte Uhr.
- **S3** Glücksfall: Erfassen einer Frage über die API → genau eine Lieferung `QuestionCaptured`; Körper gültig gegen
  `WebhookEventDelivery` aus `openapiDoc` (Ajv); Kopf `webhook-id` = `msg_<subscriptionId>_<event.id>`; Signatur prüft
  mit dem Empfänger aus `scripts/webhook-receiver.mjs`; zweite Lieferung trägt `previousSeq` der ersten; `mode` ist `demo`.
- **S4** Wiederholung nach 5xx: Empfänger antwortet zweimal 503, dann 204 → drei Versuche, gleiche `webhook-id`, gleiche
  Körperbytes, neue Zeitstempel und Signaturen; Abstände 1 s und 2 s (Zufallsfaktor über Testhaken fest auf 1); das
  nächste Ereignis desselben Abonnements kommt erst danach.
- **S5** `Retry-After: 7` bei 429 → Abstand 7 s; `Retry-After: 3600` → 300 s; HTTP-Datum wird gelesen.
- **S6** Zeitgrenzen und Weiterleitung: Empfänger antwortet nie → Fehlschlag nach 10 s; Antwortkörper 1 MiB → nach 4 KiB
  abgebrochen, Status zählt; 302 auf einen zweiten Server → Fehlschlag, der zweite Server erhält nichts.
- **S7** Aussetzen und Isolation: Rückstand über der (per Testhaken auf 5 gesenkten) Grenze → `suspended (backlog)`, feste
  Zeile genau einmal; Ereignis an der Reihe über 1 h → `suspended (retry_window)`; Körper über 256 KiB →
  `suspended (internal)`; ein im Zusteller geworfener Fehler (Testhaken) → nur dieses Abonnement `suspended (internal)`,
  kein unbehandelter Fehler im Prozess; ein zweites Abonnement mit gesundem Empfänger erhält währenddessen alles. Während
  eines Rückstands von 1000 Ereignissen existiert je Abonnement höchstens ein gebauter Körper (Zähler über Testhaken).
- **S8** SSRF im Zielmodus `public` (eingespeistes `lookup`, kein echtes Netz): Host löst auf eine dieser Adressen auf →
  je verweigert, keine Verbindung: `127.0.0.1`, `10.1.2.3`, `169.254.169.254`, `192.88.99.1`, `100.64.0.1`, `::1`, `::`,
  `::ffff:127.0.0.1` (gemappt), `::ffff:0:7f00:1` (übersetzt), `::7f00:1` (kompatibel), `64:ff9b::a9fe:a9fe` (NAT64 /96),
  `64:ff9b:1::a9fe:a9fe` (NAT64 /48), `2002:7f00:1::1` (6to4), `2001:0:4136:e378::1` (Teredo), `2001:db8::1`,
  `fc00::1`, `fe80::1`, `ff02::1`. Erlaubt: eine globale IPv4-Adresse aus einem Testbereich, der nicht gesperrt ist,
  und eine Adresse in `2000::/3` außerhalb der Sonderbereiche (beide nur gegen den Haken am Verbindungsaufbau, kein
  echtes Netz). Gemischte Antwort (eine öffentliche, eine private Adresse) → verweigert. Rebinding: `lookup` liefert beim
  zweiten Aufruf eine andere Adresse → die Verbindung geht an die geprüfte Adresse. Die eigene `lookup`-Funktion liefert
  bei `{ all: true }` ein Feld und sonst die Einzelform (beide Formen direkt getestet). Im Zielmodus `local`:
  `127.0.0.1` und `::1` erlaubt; `169.254.169.254`, `fe80::1`, `64:ff9b::7f00:1` und `2002:7f00:1::1` verweigert.
- **S8b** Proxy aus der Umgebung: Im Testprozess sind `HTTP_PROXY`, `HTTPS_PROXY` und `NODE_USE_ENV_PROXY=1` gesetzt
  und zeigen auf einen Lockvogel-Proxy auf 127.0.0.1; `NO_PROXY` ist leer. Eine Zustellung an den Empfänger kommt dort an,
  und der Lockvogel-Proxy erhält keine Verbindung. Dazu ein statischer Test: `apps/api/src/webhooks/**` enthält kein
  `fetch(` und keinen Verweis auf `globalAgent`.
- **S9** Rechte zum Versuchszeitpunkt (Kill-Switch Weg 1): Ereignis hängt in der Wiederholung, dann `revokeRole` des
  Abonnenten → beim nächsten Versuch keine Anfrage, Ereignis verworfen, feste Zeile „no active system actor assignment“.
- **S9b** Subject-Sperre (Kill-Switch Weg 2): mit eingespeistem Sitzungsspeicher, dessen `isSubjectBlocked` für das
  Systemsubjekt `true` liefert → keine Anfrage, feste Zeile „system actor blocked“; wirft `isSubjectBlocked` → keine
  Anfrage, Wiederholung nach Plan (fail closed); ohne Sitzungsspeicher wird die Prüfung übersprungen.
- **S10** Leck Ende zu Ende: derselbe Arbeitsgang wie D3 über HTTP; der Empfänger erhält keinen Typ der Liste „Nie
  zugestellt“, und kein roher Körper enthält einen der Schlüssel aus D4 oder den Text der Notiz, des Rückgabegrunds, des
  Entwurfs oder einen `displayName` aus dem Seed (Suche im rohen Körper).
- **S11** Kette: Verteiler meldet `reset` (gekürztes Log über den bestehenden Testhaken `streamLoad`) → alle Abonnements
  `suspended (integrity)`, danach keine Anfrage.
- **S11b** Idempotenzschlüssel über Neuaufbau: Dienst A stellt Ereignis E zu; ein zweiter Dienst über demselben Log
  (Neustart) stellt mit `from: start` dasselbe E mit **derselben** `webhook-id` zu; ein danach neu geschriebenes Ereignis
  mit derselben `seq` in einem anderen Log (Testlog nach `reset`) erhält eine **andere** `webhook-id`. Mutationsprobe M11.
- **S12** Kein Warten im Schreibpfad: Empfänger hängt; zehn Schreibanfragen hintereinander antworten in der üblichen Zeit
  (keine Anfrage wartet auf die Zustellung).
- **S13** `from: start` mit dem vollen Korpus aus `seedOnStart` (Grenzen unverändert): Der Empfänger erhält alle nach
  Entscheidung 4 lieferbaren Ereignisse (Zahl wie in Vor-dem-Bau-Punkt 7) in `seq`-Reihenfolge, das erste mit
  `previousSeq: null`, ohne Aussetzen. Der Dienst startet ohne Zuordnung; die Lieferung beginnt erst mit `assignRole`
  (Beginn nach Entscheidung 7), vorher erhält der Empfänger nichts.
- **S14** Demo-Kopf: `X-Actor: x:event_subscriber` → 401; `X-Actor: sys_partner:capture` (Systemkennung mit
  Menschenrolle) → 401; `HV_SEED_ACTOR` mit Systemrolle oder `sys_`-Kennung → Start verweigert.
- **S15** Demo-Helfer: `scripts/webhook-demo.mjs assign` und `capture` gegen einen Dienst im Demo-Modus auf 127.0.0.1
  ergeben eine Zuordnung und eine Lieferung `QuestionCaptured` beim Empfänger; ein Ziel außer 127.0.0.1 ist nicht
  wählbar (Argument wird verweigert).

**Vertrag** (`apps/api/src/__tests__/contract-065a.test.ts`): Version; `Role` enthält `event_subscriber`; `Action`
enthält `webhook.receive`; `webhooks.eventDelivered.post.operationId` ist `webhookEventDelivered`; `WebhookEventType` ist
gleich den Schlüsseln von `WEBHOOK_EVENT_TYPES`; die `const`-Werte von `type` in den 18 Zweigen von `WebhookEvent` sind
gleich derselben Menge, und je Typ sind die `payload.properties` genau die Schlüssel aus `WEBHOOK_EVENT_TYPES` (Vertrag
und Kern stimmen überein); jeder Zweig hat `additionalProperties: false` auf Umschlag und Nutzlast;
`WebhookEventDelivery` hat `additionalProperties: false`; `webhookEventDelivered` hat `security: []`; ein mit Ajv
geprüftes `QuestionCaptured` mit zusätzlichem Nutzlastschlüssel ist ungültig, eines aus D3 ist gültig; das Signaturmuster akzeptiert einen und zwei Einträge des Testvektors und lehnt `v2,…` ab;
ein `WebhookEvent` mit `payload.pii`, `actor` oder `QuestionWithdrawn.payload.reason` ist ungültig; die
Muster von `webhook-id` akzeptieren den Testvektor; kein bestehendes Anfrageschema hat ein neues Feld
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
- **M9** Normalisierung entpackt nur `::ffff:`-gemappte Adressen (nicht übersetzt, nicht kompatibel) → S8 rot
  (`::ffff:0:7f00:1`, `::7f00:1`).
- **M10** `event.read` aus dem Bündel von admin entfernt (nur im Test) → D1b rot.
- **M11** `webhook-id` aus `seq` statt aus `event.id` → S11b rot.
- **M12** Zustellung über das globale `fetch` statt über den eigenen Agenten → S8b rot.

## Akzeptanzkriterium

1. `pnpm contract:lint` grün ohne neue Meldung; `pnpm contract:types` reproduzierbar; `check.mjs` (a)–(d) `ok` mit
   `(c) … 0.4.y -> 0.4.x`.
2. Tests D1–D8 (mit D1b), S1–S15 (mit S8b, S9b, S11b), Vertragstests und R1–R7 grün; die zwölf Mutationsproben rot
   belegt.
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
2. **Schnellstart (höchstens sieben Schritte, jede Zeile kopierbar, überall `127.0.0.1`, nie `localhost`):**
   1. Secret erzeugen: `node -e "console.log('whsec_'+require('node:crypto').randomBytes(32).toString('base64'))"` und als
      `WEBHOOK_SECRET` setzen.
   2. Empfänger starten: `node scripts/webhook-receiver.mjs --port 9900` (bindet nur an 127.0.0.1).
   3. Dienst im Demo-Modus mit einem Abonnement starten: `pnpm --filter @hv/api dev` mit `HV_WEBHOOK_TARGETS=local`,
      `HV_WEBHOOK_ALLOWED_HOSTS=127.0.0.1`, `HV_WEBHOOK_SECRETS=partner-demo=$WEBHOOK_SECRET` und
      `HV_WEBHOOK_SUBSCRIPTIONS` mit Ziel `http://127.0.0.1:9900/hooks`, Subjekt `sys_partner_demo`, `from: start` und
      den Typen `QuestionCaptured`, `QuestionClassified`, `QuestionStaged`, `QuestionDelivered` (vollständige Zeile im
      Leitfaden). Der Dienst hört auf `127.0.0.1:8787`.
   4. Den Systemakteur zuordnen:
      `node scripts/webhook-demo.mjs assign --subject sys_partner_demo --role event_subscriber --admin u-admin:admin`.
      Ab jetzt läuft der Nachlauf über den synthetischen Korpus an.
   5. Eine neue Einzelfrage erzeugen: `node scripts/webhook-demo.mjs capture --capture u-cap-1:capture`.
   6. Ausgabe des Empfängers lesen: je Lieferung eine Zeile `ok seq=… type=… id=… previousSeq=…`; die letzte ist die
      neue `QuestionCaptured`.
   7. Wiederholung sehen: Empfänger mit `--fail-first 2` neu starten, Schritt 5 wiederholen, drei Versuche mit gleicher
      ID beobachten.

   Die Oberfläche ist kein Weg dieses Schnellstarts (Befund 9).
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
   oder unpassendem `previousSeq` tut (Lücke melden; einen Abruf für Systemakteure gibt es in diesem Stand nicht). Ein
   Ereignis, das erst die zweite Prüfung vor dem Versuch ausfiltert (Entzug, Ablauf, Sperre, Leserecht), erscheint
   **nicht** als Lücke. Der Referenz-Empfänger hält verarbeitete IDs nur im Speicher; nach seinem Neustart erkennt er
   Doppel nicht mehr, ein echter Empfänger speichert sie dauerhaft (mindestens 24 h).
6. **Secret wechseln:** drei Schritte (neues Secret zusätzlich konfigurieren und Dienst neu starten → Partner stellt um →
   altes entfernen und neu starten).
7. **Sicherheit für Betreiber:** Host-Allowlist, Zielmodus, gesperrte Bereiche (NAT64 und 6to4 sind gesperrt, ein
   Partner nur hinter NAT64 ist nicht erreichbar), keine Weiterleitung, kein Proxy aus der Umgebung, Secrets nur aus der
   Umgebung, eine Instanz; Notabschaltung (Zuordnung entziehen, Subject sperren, Variable entfernen und neu starten).
   **Datenschutz:** Im Echtbetrieb wären Rede- und Fragetexte personenbezogene Daten von Aktionären; eine Zustellung mit
   echten Daten braucht DSFA (E14) und einen Vertrag zur Auftragsverarbeitung mit dem Partner. In diesem Stand ist sie
   technisch ausgeschlossen (nur Demo-Modus).
8. **Grenzen dieses Stands:** nicht dauerhaft, keine API für Abonnements, nur Demo-Modus; Sandbox über das lokale Paket
   folgt mit 065b.

## Datenschutz

- An einen Empfänger gehen Rede- und Fragetexte, Kennungen von Wortmeldungen, Redebeiträgen und Fragen und Verfahrensdaten,
  nie Klarnamen (SG3) und nie Kennungen von Beschäftigten (SG8, `actor` fällt weg).
- In 065a nur mit `HV_DEMO=1`, also nur mit dem synthetischen Korpus (R11). Jede Nutzung mit echten Daten braucht DSFA
  (E14), Auftragsverarbeitung mit dem Partner und eine Entscheidung des Eigentümers; das gehört nicht zur Freigabe-Demo.
- Kein neuer Speicherort: Zeiger und Verweise nur im Speicher, nichts auf Platte, kein Zugriffslog-Eintrag für
  ausgehende Anfragen.
- Der DSFA-Vorentwurf wird im selben PR berichtigt (Entscheidung 9, Zeile 161 und Empfänger-Eintrag); der Kopfvermerk im
  Rechtekonzept nennt das Systembündel.

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

1. **Kein Mensch erhält `webhook.receive`, und kein Mensch wird Systemakteur.** Prüfen: Wahrheitstabelle; D2; S14
   (auch `sys_`-Kennung mit Menschenrolle). Das Systembündel liest nie mehr als ein Inhaber von `admin.roles.manage`
   (D1b).
2. **Kein Rollenname im Dienst.** `apps/api/src/webhooks/**` enthält `event_subscriber` nicht; der Dienst arbeitet mit
   `subjectId` aus der Konfiguration und `can()` (Rollen-Literal-Tor).
3. **Kein Secret außerhalb der Umgebung.** Kein Secret in Repositorium, Test-Fixture (außer dem synthetischen
   Testvektor), Log, Fehlersatz; `.env.example` ohne Werte.
4. **Keine Anfrage an ein ungeprüftes Ziel.** Host-Allowlist und Bereichsprüfung je Versuch (IPv6 nur `2000::/3` ohne
   Sonderbereiche, eingebettetes IPv4 als IPv4, NAT64 und 6to4 gesperrt), Verbindung an die geprüfte Adresse über einen
   eigenen Agenten ohne Proxy aus der Umgebung, keine Weiterleitung (S6, S8, S8b).
4b. **Abschaltbar ohne Code:** Entzug (S9), Subject-Sperre (S9b), Variable entfernen und neu starten.
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
| Nicht dauerhaft, eine Instanz | Freigabe-Demo, Plan §11 „Hosting“ | Zeiger ins Log im Speicher | dauerhafter Stand mit Tabelle und Führung je Abonnement: ≈ 2 AStd (Folgeliste, vor jedem Pilot) |

## Offene Eigentümerfragen

1. **Teilung, Budget und Reihenfolge (Go nötig).** 065 wird 065a (4 AStd, nach dem Lesebefund neu geschätzt) und 065b (rund
   1,5 AStd), zusammen 5,5 statt 2 AStd laut Plan, beide hoch. Ohne Go baut 065a nicht; der Architekt schneidet dann neu. Mit Go ergänzt der
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

**040c:** Die Erstellerzuordnung beim Anlegen eines Jahrgangs und jeder Klon von Zuordnungen laufen durch dieselbe
Prüfung wie `assignRole`; R-ADM-12 gilt dort genauso (kein Systembündel an eine Person, keine Menschenrolle an ein
`sys_`-Subjekt). Ein Klon übernimmt Zuordnungen von Systemsubjekten nicht stillschweigend, sondern nur, wenn 040c das
ausdrücklich entscheidet (Standard: nicht übernehmen; Partner werden je Jahrgang neu zugeordnet).

**041, 070:** Admin-Anleitung und Runbook nennen die Prüfung der Zuordnungen von Systemsubjekten (Signal aus dem
Missbrauchsfall „Rechteverwaltung“) und die drei Wege der Notabschaltung.

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
- Ergebnis der zwölf Mutationsproben.
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

**Lesebefund der Spec (03.10.2026, zu `8b66fd5`, frischer Kontext):** 0 blocker, 9 major, Minor (Security, Datenschutz)
und Nits. Alle in dieser Fassung eingearbeitet, nichts vertagt:
- M1 Schnellstart nicht ausführbar (Oberfläche ohne `X-Actor`, `If-Match` 428): Oberflächenweg gestrichen, Demo-Helfer
  `scripts/webhook-demo.mjs` (Entscheidung 12, S15, Files allowed), überall `127.0.0.1`, „Warum so geschnitten“ berichtigt.
- M2 `webhook-id` aus `seq` nach Neustart oder Neuaufbau nicht eindeutig: jetzt `msg_<subscriptionId>_<event.id>`,
  Vertragsmuster und Testvektor neu, S11b, M11.
- M3 Korpus 1740/1075 sprengt die Grenze 1000: Zeiger ins Log, Körper erst bei Bedarf, Rückstandsgrenze 10 000, Beginn
  mit der ersten Zuordnung (Entscheidung 7); Vor-dem-Bau-Punkt 7 beantwortet; S13 mit vollem Korpus.
- M4 DSFA-Zeile 161 falsch: Berichtigung im selben PR (Entscheidung 9, Files allowed).
- M5 Lücken in der Bereichsprüfung: IPv6 nur `2000::/3` ohne Sonderbereiche, eingebettetes IPv4 als IPv4, NAT64 und
  6to4 ohne Ausnahme gesperrt (sicherere Wahl, Widerspruch aufgelöst); S8 erweitert, M9.
- M6 Nutzlast ohne gebundenes Schema: `oneOf` mit Diskriminator, je Typ `additionalProperties: false`, Gleichheitstest
  Vertrag gegen Kern; Übernahme des Webhook-Teils von 043c (ohne `AnswerDrafted`).
- M7 Proxy aus der Umgebung: eigener Agent, nie globales `fetch`, `lookup` für beide Aufrufformen, S8b, M12.
- M8 `parity.test.ts` in Files allowed (nur Zahl und Kommentar).
- M9 Kill-Switch: drei Wege (Entzug vor dem nächsten Versuch, Subject-Sperre schon in 065a geprüft, Variable entfernen
  und neu starten); S9, S9b.
- Minor: Missbrauchsfall „Rechteverwaltung“ mit Signal und Invariante D1b; `sys_`-Kennungen im Demo-Kopf verweigert;
  `security: []`; `QuestionClassified` wörtlich; Kopfvermerk im Rechtekonzept; Datenschutzsatz und Lückengrenze im
  Leitfaden; Aufwand neu 4 AStd. Nits: Fehler im Zusteller → `internal`; `streamId` aus `crypto.randomBytes`; Secrets am
  ersten `=`; Speicher-Grenze des Referenz-Empfängers im Leitfaden; Kopfzeilen aufgefrischt; Version beim Merge;
  Hinweis an 040c.
