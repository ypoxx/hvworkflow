# Scheibe 064a — Transkript-Ingest, Teil 1: Vertrag, Kern, Dienst, Partnerleitfaden

**Status:** spec (03.10.2026; gelesen auf `2fc3153`, Vertrag 0.4.0 aus 043a auf `origin/claude/slice-043a-vertrag` `d8fc188` gegengelesen; überarbeitet nach dem Lesebefund zu `bc33df2`: 1 blocker (064b), 8 major, Minor; Teil 1 der geteilten Scheibe 064, Zuschnitt im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 3,5 AStd (Teil a; Summe a+b 6 statt 2,5 laut Plan) · Plan 064: 26.11.2026 (W9); für die Freigabe-Demo (Plan §11, Eigentümer 03.10.2026, Register E57) früher, frühestens nach dem Merge von 043a; den Tag legt der Orchestrator mit `scripts/plan-graph.mjs` fest · Lanes: contract (erster Commit, Architekt); core; service; web-api (nur `HvApi` im HTTP-Client, Live-Puffer und der Demo-Export `demoTranscriptSample` mit den Demo-Grenzen in `apps/web/src/api/index.ts`); web-shell (nur ein Aktionsschlüssel); docs-integration; docs-sicherheit; docs-datenschutz; docs-legal (Kopfvermerk Rechtekonzept)
**Rolle:** architect für den Vertragsschritt (erster Commit, vor jedem Code, AGENTS.md R6) und den Nachtrag in ADR 0008; danach implementierer-backend. Review in frischem Kontext mit den Perspektiven **Security** (Partnergrenze, neues Schreibrecht, feindliche Eingaben, Idempotenzschlüssel) und **Vertrag** (6.4, Kompatibilität für Partner) sowie **Datenschutz** (Wortlaut von Aktionären aus einem Fremdsystem, DSFA V16). Lesebefund der Spec vor dem Bau; nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** neu R-ING-01 (Idempotenz je `segmentId`, Inhalt unveränderlich), R-ING-02 (Ingest nur in laufender HV), R-ING-03 (Form, Länge, Zeichen, Zeitanker und Bezüge eines Segments), R-ING-04 (Übernahme `unconfirmed → adopted`, Zeile einer neuen Segmenttabelle), R-ING-05 (Obergrenzen je HV: Zahl der Abschnitte und Bytes Wortlaut). Angewandt: R-PERM-01, R-PERM-02, R-MTG-03, R-IDEM-01. Dazu AGENTS.md R2, R4, R5, R6, R7, R8, R10, R11, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 064 (Zeile 848–853), §5.7 Exit-Kriterien (Zeile 822–823), §11 „Freigabe-Demo“ Punkt 2 (Zeile 1303), Etappe D (Zeile 1330), Register E3a, E3b (Zeile 1246–1247)
- ADR 0008 (ein kanonischer Vertrag je Nachbarsystem, Segmente unveränderlich, `ingest.write`, /v1-Kompatibilität), ADR 0002 (Kern im Browser), ADR 0011 (Umschlag v2, `occurredAt`/`occurredAtSource`), ADR 0015 (Versionierung), ADR 0001 (Grenze 3: kein Fremdformat im Kern)
- Spec 043a (Vertrag 0.4.0; Zuschnitt 043c; Regel 1 „Vertragszeile der Umsetzungsscheibe“; Versionsstufen: additive Teile heben die Patch-Stufe), Spec 028 (Idempotenz, Übernahme), Spec 025 (R-MTG-03), Spec 034a (Grenzen), Spec 080b (Korpus eine Quelle), Spec 044a (Form dieser Spec)
- `docs/entscheidungsregister.md` E3a, E3b, E14, E16
- `docs/sicherheit/bedrohungsmodell.md` T-G3-S-01, T-G3-T-01, T-G3-R-01, T-G3-D-01, T-G3-D-02, T-G3-E-01, neu T-G3-T-04 (Anzeigeverfälschung durch Bidi-Steuerzeichen) und T-G3-I-06 (Inhaltsbestätigungs-Orakel); AK6; Reviewer-Checkliste SC-09
- Lesebefund zu Spec 064a/064b (03.10.2026, zu `bc33df2`)
- `docs/datenschutz/dsfa-vorentwurf.md` Zeilen 52, 75, 115, 157, V2, V16
- `docs/glossar.md` Zeile „Redebeitrag … Verboten: Transcript (nur als Quelle)“

**Depends on:** 043a (Vertrag 0.4.0; Bau läuft auf `claude/slice-043a-vertrag`), 028 und 029b (gemergt). Seriell in der Lane core nach der Scheibe, die beim Baustart dort aktiv ist (heute 040b, dann 044a); fachlich hängt 064a an keiner von beiden
**Perspektive:** Security, Vertrag, Datenschutz · **Glossar: neue Begriffe:** ja, „Transkriptabschnitt“ (transcript segment) und „übernehmen“ (adopt); die Zeilen schreibt 064b mit dem ersten Oberflächentext

## Teilung und Zuschnitt

Die Planzeile 064 (2,5 AStd, hoch) nennt Endpunkt, unveränderliche Segmente, Übernahme in einen Redebeitrag,
Datei-Adapter, Recht, Leitfaden und die Nachweise für ADR 0008. Seit dem Plan ist Arbeit hinzugekommen:

- Die Freigabe-Demo (Plan §11, Punkt 2) verlangt ein Demoszenario: Ein Beispieltranskript wird über die Schnittstelle
  eingespielt und erscheint in der Oberfläche, auch in der Netlify-Demo, in der der Kern im Browser läuft (ADR 0002).
  Das braucht einen Beispielbestand im Seed, eine Beispieldatei für Entwickler und eine Prüfung, dass beide aus einer
  Quelle stammen (080b).
- 043a hat die Ingest-Vertragsform in den Teil 043c gelegt. Diese Spec holt sie nach 043a Regel 1 als Vertragszeile
  der Umsetzungsscheibe in den ersten Commit von 064a (Eigentümerfrage 2). 043c schrumpft auf Webhooks,
  `answer-suggestions` und das Sicherheitsschema für Systemakteure.
- Der Kern im Browser prüft nicht gegen den Vertrag (Folgeliste 034a). Jede Grenze, die der Dienst mit Ajv
  durchsetzt, muss der Kern deshalb selbst prüfen. Sonst wäre die Demo die offene Flanke.
- Die Übernahme ändert einen Status (`unconfirmed → adopted`). Nach AGENTS.md R5 gehört sie in eine Tabelle mit
  Regel-id und Test, nicht in die Oberfläche.

| Teil | Inhalt | Klasse · AStd | Abhängig |
|---|---|---|---|
| **064a** (diese Spec) | Vertragszeile 0.4.x; Recht `ingest.write`; Ereignis `SegmentIngested`; Segmenttabelle mit R-ING-04; Übernahme über `captureMeetingContribution` mit `segmentIds`; Alias ohne `segmentIds`; Strom mit Subjektart `segment`; zwei Dienstrouten; `HvApi` in beiden Adaptern; Demo-Export und Demo-Grenzen; Beispielbestand im Seed, Beispieldatei und Beispielskript; Partnerleitfaden mit geprüften Beispielen; Bedrohungsmodell, DSFA, Rechtekonzept | hoch · 3,5 | 043a |
| **064b** | Oberfläche der Erfassung: Abschnittsliste (neueste zuerst, blätterbar), Import-Dialog (Datei, Zwischenablage, Beispieldatei in der Demo), Datei-Adapter im Browser mit `Retry-After`, Übernahme-Dialog, i18n DE/EN, Glossar, Playwright in beiden Projekten (gemeinsame Datei nach 031b), Screenshots, Demoszenario | hoch · 2,5 | 064a |

Aufwand 064a: Vertrag 0,5 · Kern 1,5 (mit Strom-Subjektart, Alias, strengerer Zeichen- und Datumsprüfung,
Byte-Obergrenze, Datumsprüfung wie Ajv) · Dienst und Postgres-Test 0,5 · HTTP-Client, Live-Puffer und Demo-Export 0,35 ·
Leitfaden mit Skript, Bedrohungsmodell, DSFA 0,4 · Puffer für Review-Nacharbeit 0,25 (die Nachprüfung nannte 5,5 AStd
für beide Teile knapp). Rund 3,5 AStd; 064a bleibt ein Agententag, ein weiterer Schnitt (etwa Vertrag allein) würde
eine Vertragsform ohne Abnehmer erzeugen. Die Summe a+b liegt deutlich über der Planzahl; Zuschnitt und Budget brauchen das Go des
Eigentümers (Eigentümerfrage 2).

## Befund (Ist-Stand, gelesen auf `2fc3153`)

- **Quelle `transcript` gibt es schon, als bloße Angabe.** `Contribution.source` kennt `manual | transcript | paper`
  (`packages/domain/src/types.ts:219`), `MeetingContributionCapture.source` und `occurredAtSource` ebenso
  (`types.ts:313-320`, `openapi.yaml:2696-2715`). Heute kann jede Person mit `contribution.capture` `transcript`
  behaupten; es gibt kein Segment und keinen Nachweis. Das ist T-G3-S-01 im Bedrohungsmodell.
- **Der Seed erzeugt rund 30 % Redebeiträge mit `source: 'transcript'`** ohne Segmente (`packages/domain/src/seed.ts:524-530`).
  Sie bleiben unverändert (Fingerabdruck in `seed-fictitious-names.test.ts`).
- **Erfassung im Kern:** `captureInMeeting` (`packages/domain/src/api.ts:663-683`) prüft `contribution.capture`, den
  Sprecher, den Text, `If-Match` auf die Wortmeldung und R-MTG-03 über `resolveMeetingCapture`
  (`packages/domain/src/transitions.ts:822-836`). Nach dem Debattenschluss lässt R-MTG-03 nur `paper` oder `transcript`
  mit `occurredAtSource` gleich `source`, `occurredAt` ≤ `debateClosedAt` und Grund zu.
- **Idempotenz:** `idempotent()` (`api.ts:588-630`) ist je Akteur, `Idempotency-Key`, Operation und Ressource. Ein
  Schlüssel, den ein Fremdsystem selbst vergibt und der über Akteure hinweg gilt, existiert nicht.
- **Rechte:** Das Bündel `capture` (`packages/domain/src/permissions.ts:36-46`) hält `contribution.capture`,
  `contribution.claim`, `question.capture`, `contribution.read`. admin hält seit 040a eine ausdrückliche Liste ohne
  Inhaltsschreibrechte (`permissions.ts:69-89`). Die Wahrheitstabelle hat den Abschnitt „Role × Wortmeldung, Erfassung
  und Demo“ (`packages/domain/policy-truth-table.md:258-273`).
- **Ereignisse:** `EVENT_TYPES` in `packages/domain/src/envelope.ts:5-15` ist eine geschlossene Liste; ein unbekannter Typ
  wird beim Laden verworfen. Die Themenzuordnung des Stroms ist in beide Richtungen vollständig
  (`packages/domain/src/stream.ts:22, 52, 98`).
- **Vertrag:** Die Beschreibung von `listContributions` kündigt den Ingest an („Later, transcript segments arrive through
  the ingest interface“, `openapi.yaml:302-303`). `Event.type` kennt `SegmentIngested` nicht. Grenzen: Body 262 144 Byte
  (`apps/api/src/limits/config.ts:14`, `413`), Quoten je Subjekt (`429`). Der Validator reicht den rohen Body weiter,
  wenn die Prüfung besteht (`apps/api/src/validate.ts:47-52`).
- **Demo:** `apps/web/src/api/index.ts:130` baut den In-Process-Kern mit `seedEvents`; die Demo validiert nicht gegen den
  Vertrag (Folgeliste 034a).
- **Alias:** `captureContribution` reicht seine Eingabe unverändert an `captureInMeeting` weiter (`api.ts:956-958`). Ohne
  Gegenmaßnahme käme ein neues Feld der kanonischen Eingabe (`segmentIds`) auch über den Alias an (Entscheidung 7).
- **Strom:** `collect` (`packages/domain/src/stream.ts:305-334`) gibt für Subjekte der Art `meeting` nichts aus; ein Ereignis,
  das nur die HV nennt, erreicht Leser ohne `event.read` nicht. Der Live-Puffer lädt nur Lesemethoden neu, deren Thema in
  einem `change` steht (`apps/web/src/api/liveStore.ts:41-66, 421-423`). Ein Ereignis braucht deshalb eine eigene
  Subjektart (Entscheidung 8).
- **Architekturregel:** `web-features-i18n-domain-types-only` (`scripts/dependency-cruiser.cjs:53-63`) erlaubt Werte aus
  `@hv/domain` nur in `apps/web/src/api/**`. Die Beispieldatei für die Demo braucht deshalb einen Export der API-Schicht
  (Entscheidung 9).
- **Demo-Speicher:** Der Browser hält das ganze Protokoll in `localStorage` (`apps/web/src/api/index.ts:56-61`), also in
  wenigen MiB je Ursprung.
- **Oberfläche:** Die Erfassung schreibt über den Alias `captureContribution` (`apps/web/src/features/capture/Page.tsx:250`)
  und liest ihre Schreibrechte aus `question._actions` (`Page.tsx:184-192`). Für Segmente gibt es keine Ressource mit
  `_actions`; diese Spec liefert eine (Entscheidung 6).
- **Lokaler Dienst:** `pnpm --filter @hv/api dev` startet mit `HV_DEMO=1` auf Port 8787, legt den Seed an
  (`apps/api/src/app.ts:437-448`) und nimmt `X-Actor: <id>:<role>` an (`apps/api/src/actor.ts`). Das ist der Weg für
  das curl-Beispiel.

## Ziel und Entscheidungen vor Bau

Ein Partner (oder der Datei-Import der Erfassung) liefert Transkriptabschnitte an einen Endpunkt. Jeder Abschnitt wird
genau einmal als unveränderliches Ereignis gespeichert, steht als `unconfirmed` in einer Liste und wird erst durch eine
Person mit `contribution.capture` in einen Redebeitrag übernommen. Ab dort läuft der Erfassungsfluss unverändert
(Atomisierung, Klassifizierung). Kein Abschnitt wird je zur Einzelfrage, ohne dass ein Mensch ihn übernommen hat.

### 1. Endpunkt und Pfad

- `POST /v1/meetings/{meetingId}/speech-segments` (`ingestSpeechSegments`) nimmt einen Stapel an.
- `GET /v1/meetings/{meetingId}/speech-segments` (`listMeetingSpeechSegments`) liest die Abschnitte der HV.
- **Abweichung vom Wortlaut in E3a und ADR 0008** (`POST /v1/ingest/speech-segments`): Der Pfad folgt der
  Jahrgangsregel des Vertrags seit 0.3.0 (Sammlungen einer HV liegen unter `/meetings/{meetingId}/…`). Ein Partner
  findet die laufende HV über `GET /v1/meetings?status=running`. Felder und Semantik aus E3a bleiben gleich. Es gibt
  keinen Alias ohne Jahrgang: Die Aliase enden mit 0.5, ein neuer wäre eine tote Operation. Der Architekt trägt die
  Abweichung als Nachtrag in ADR 0008 ein; zurück auf den alten Pfad kostet eine Route und eine Vertragszeile
  (< 0,25 AStd).

### 2. Vertragsform eines Abschnitts (E3a, auf Standard gebaut)

`SpeechSegmentInput`, `additionalProperties: false`:

| Feld | Pflicht | Form | Bedeutung |
|---|---|---|---|
| `segmentId` | ja | `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$` | Kennung des Senders, eindeutig je HV; der Idempotenzschlüssel |
| `text` | ja | 1–4 000 Zeichen, gezählt in Unicode-Codepunkten wie Ajv (`[...text].length` im Kern, nicht `text.length`); verboten: C0-Steuerzeichen außer `\t`, `\n`, `\r`, DEL (U+007F), C1-Steuerzeichen (U+0080–U+009F) und die Bidi-Einbettungs-, Überschreibungs- und Isolationszeichen U+202A–U+202E, U+2066–U+2069 (Muster im Vertrag, gleiche Prüfung im Kern); nicht nur Leerraum (Kern) | Wortlaut des Abschnitts |
| `startedAt` | ja | `date-time` | Anfang laut Sender (Zeitanker) |
| `endedAt` | ja | `date-time`, ≥ `startedAt` | Ende laut Sender |
| `speakerId` | nein | ≤ 128 Zeichen; muss eine Wortmeldung dieser HV sein | Sprecherhinweis des Senders, nur als Bezug; nie ein Name |
| `source` | ja | `^[a-z0-9][a-z0-9._-]{0,63}$` | Kennung von Werkzeug oder Adapter (`datei-import`, `demo-transkript`); eine Angabe des Senders, keine Authentisierung |

- **Stapel** `SpeechSegmentBatch`: `{ segments: SpeechSegmentInput[] }`, 1 bis 100 Einträge, `additionalProperties: false`.
  Zusammen mit dem Body-Limit von 262 144 Byte (`413`) ergibt das die praktische Stapelgröße; der Leitfaden nennt sie.
- **Bidi-Zeichen abgelehnt (sicherere Wahl):** Einbettung, Überschreibung und Isolation (U+202A–U+202E,
  U+2066–U+2069) können die Anzeige eines Wortlauts umdrehen (T-G3-T-04). Gesprochene Sprache braucht sie nicht; ein
  Werkzeug, das sie einfügt, erhält 422 R-ING-03 und entfernt sie. Die Richtungsmarken U+200E/U+200F bleiben erlaubt
  (sie verschieben keinen fremden Text). Die Anzeige isoliert trotzdem je Abschnitt (064b, zweite Linie).
- **Normalisierung:** keine. Der Wortlaut wird gespeichert, wie er kommt; NFC und NFD derselben Zeichen sind für den
  Inhaltsvergleich (R-ING-01) verschiedene Inhalte. Der Leitfaden empfiehlt NFC.
- **Zeitanker:** `startedAt` und `endedAt` sind Angaben des Senders (ADR 0011). Form RFC 3339 mit Zeitzone; der Kern
  spiegelt die Prüffunktion von Ajvs Format `date-time` (ajv-formats, Modus `full`): Zeitzone Pflicht (`Z` oder
  `±hh:mm`), Monat 1–12, Tag je Monat einschließlich Schaltjahr, Stunde, Minute und Sekunde im Bereich; nicht nur einen
  regulären Ausdruck und nicht `Date.parse` (das nimmt Formen an, die der
  Vertrag ablehnt). Keiner liegt nach der Serverzeit (keine Toleranz, wie R-MTG-03; der Leitfaden verweist auf
  `X-Server-Time`). **Keine Untergrenze** (etwa „nicht vor Beginn der HV“): Entscheidung des Architekten, weil die
  Beispieldatei feste Zeitanker trägt und ein Werkzeug Abschnitte auch nach einem Neustart liefert. Ein rückdatierter
  Abschnitt bleibt `unconfirmed`; seine Übernahme nach dem Debattenschluss verlangt R-MTG-03 mit Grund und Kennzeichen
  `lateEntry` (Missbrauchstabelle, Test K23). Gespeichert wird der Zeitpunkt in UTC
  (`toISOString()`): `+01:00` und `Z` für denselben Augenblick sind derselbe Wert. Der Umschlag trägt
  `occurredAt = startedAt`, `occurredAtSource: transcript`, `recordedAt` aus der injizierten Uhr (R8).
- **Kein `speakerLabel`, kein Name.** Ein Werkzeug, das Sprecher nur als „Sprecher 2“ oder mit Namen kennt, liefert
  keinen Hinweis; die Erfassung ordnet zu. Das hält Klarnamen aus dem Ereignis (DSFA, Personentabelle aus 026). Ob das
  Werkzeug Personen erkennt, ist Teil von E3b.

### 3. Idempotenz je `segmentId` (R-ING-01)

- Der Schlüssel ist das Paar (`meetingId`, `segmentId`), **über Akteure hinweg**. Gleiche Kennung in einer anderen HV ist
  ein anderer Abschnitt.
- Gleiche Kennung, gleicher Inhalt (`text` zeichengleich, `startedAt` und `endedAt` als Zeitpunkt gleich, `speakerId`
  und `source` gleich): kein Ereignis, Ergebnis `duplicate`.
- Gleiche Kennung, anderer Inhalt: **409 R-ING-01**. Der Abschnitt ist unveränderlich (ADR 0008); eine Korrektur ist ein
  neuer Abschnitt mit neuer Kennung. `detail` nennt Index und `segmentId`, **nie den gespeicherten Inhalt**.
- **Alles oder nichts je Stapel.** Erst werden alle Abschnitte geprüft, dann alle neuen in einem einzigen `append`
  geschrieben. Ein Fehler an einer Stelle (422, 409) schreibt nichts. Eine Kennung doppelt im selben Stapel ist 422
  R-ING-03.
- **Nebenläufigkeit:** Prüfung und Schreiben laufen im selben serialisierten Befehl wie jeder Schreibvorgang (Postgres:
  Sperre nach der Validierung, takt-024). Zwei gleichzeitige gleiche Stapel ergeben genau einen Satz Ereignisse.
- **Kein `Idempotency-Key`, kein `If-Match`.** Die `segmentId` ist der Schlüssel; einen Ressourcenstand, gegen den ein
  `If-Match` laufen könnte, gibt es nicht. Ein Wiederholungsversuch nach Netzfehler, `408`, `5xx` erhält `duplicate`
  für schon gespeicherte Abschnitte. Der Vertrag nennt die Abweichung von der allgemeinen Konvention in der
  Operationsbeschreibung.
- Die Ereignis-`subjectId` vergibt der Kern (neue id; im Seed `sg-…`); die Kennung des Senders steht nur in der Nutzlast. So landet
  keine fremdbestimmte Kennung im Namensraum der Aggregate (`fr-…`, `rb-…`).
- **Projektion als `Map`, nie als Objekt:** `segments: Map<subjectId, SpeechSegmentRecord>` und ein Index
  `segmentIndex: Map<segmentId, subjectId>` je HV. Kennungen wie `constructor`, `__proto__` oder `toString` sind gültige
  Partnerkennungen (das Muster lässt sie zu) und dürfen weder auf Prototyp-Eigenschaften treffen noch sie verändern
  (Test K9).
- **Reihenfolge der Prüfungen in einem Stapel:** alle Prüfungen auf 422 (Form, Zeichen, Zeitanker, Bezüge, doppelte
  Kennung) über den ganzen Stapel zuerst, danach 409 (R-ING-01, dann R-ING-05). Ein Stapel mit beidem antwortet 422
  (Test K24).

### 4. Wann Ingest erlaubt ist (R-ING-02, R-ING-05)

- Nur in einer HV mit Status `running`, auch nach dem Debattenschluss (das Werkzeug liefert mit Verzug). In
  `preparation` und `closed`: **409 R-ING-02**, auch für reine Wiederholungen.
- Ob ein nach dem Debattenschluss gelieferter Abschnitt noch übernommen werden darf, entscheidet unverändert R-MTG-03 bei
  der Übernahme.
- **Obergrenzen je HV (R-ING-05):** höchstens 20 000 Abschnitte (`MAX_SEGMENTS_PER_MEETING`) und höchstens 8 MiB
  Wortlaut in UTF-8-Bytes (`MAX_SEGMENT_TEXT_BYTES_PER_MEETING`). **Die Byte-Grenze ist der bindende Schutz**; die
  Zahlgrenze fängt nur Fluten winziger Abschnitte ab. Ein Stapel, der eine Grenze überschreiten würde:
  **409 R-ING-05**, nichts geschrieben. Begründung der Werte: ein HV-Tag von 12 Stunden mit Abschnitten von 5 Sekunden
  ergibt rund 8 600 Abschnitte; 20 000 lassen mehr als das Doppelte Spielraum (kürzere Abschnitte, lange Debatte), weil
  die Grenze nicht anhebbar ist. 8 MiB sind ein Vielfaches eines vollständigen Tagesprotokolls (rund 100 000 Wörter je
  Tag ≈ 0,7 MiB). Das Protokoll wächst nur an; eine Flut bläht Projektion und Speicher auf (T-G3-D-02).
- Beide Werte sind Konstanten im Kern und über eine Option von `createInProcessApi` (`ingestLimits`) absenkbar, nicht
  anhebbar und nicht im Dienst konfigurierbar. **Die Demo im Browser** baut den Kern mit 500 Abschnitten und 512 KiB
  (`apps/web/src/api/index.ts`), weil sie das Protokoll in `localStorage` hält; ein Überlauf dort würde das ganze
  Demo-Protokoll gefährden.

### 5. Recht (R4)

- Neuer Bezeichner `ingest.write` in `PERMISSIONS` und im Vertrags-Enum `Action`. Vergeben **nur an `capture`** (eine
  Zeile in `ROLE_PERMISSIONS`). Nicht an admin (040a: keine Inhaltsschreibrechte), nicht an moderation.
- Lesen der Abschnitte über das bestehende `contribution.read` (moderation, capture, coordination, admin). Abschnitte sind
  der Rohstoff von Redebeiträgen und haben denselben Schutzbedarf. Kein neues Leserecht. Eintrag
  `listSpeechSegments: ['contribution.read']` in `READ_PERMISSIONS`.
- Übernehmen über das bestehende `contribution.capture` (Entscheidung 7).
- **Systemakteur für spätere Push-Adapter: vorbereitet, nicht gebaut.** Eine eigene Rolle bräuchte das `Role`-Enum im
  Vertrag, Rollenkarten, Admin-Liste, i18n und einen Anmeldeweg (Client-Credentials oder mTLS), den es noch nicht gibt.
  Ohne Anmeldeweg wäre sie tot. Vorbereitet ist:
  - das Recht ist ein Bezeichner, keine Rolle; ein späteres Bündel listet nur `ingest.write`;
  - das Ereignis trägt den angemeldeten Akteur (heute die erfassende Person, später den Systemakteur);
  - die Operation hängt an keiner Sitzungseigenschaft außer der deklarierten Sicherheit;
  - die Missbrauchsfälle für Partner-Anmeldung stehen unten, damit die Folgescheibe (Push-Adapter nach E3b, Schema aus
    043c) sie übernimmt.

### 6. Lesen und `_actions`

- `listMeetingSpeechSegments` antwortet `{ items: SpeechSegment[], total, _actions }`. Filter `status`
  (`unconfirmed | adopted`), `limit` 1–500 (Standard 100), `offset` ≥ 0. **Reihenfolge: neueste zuerst** (`startedAt`
  absteigend, bei Gleichstand `ingestedAt` absteigend, dann `segmentId` aufsteigend in Codepunkt-Reihenfolge). Ohne Verwerfen-Status (Nicht-Ziele) wächst die
  Liste über den Tag; neueste zuerst hält das Aktuelle auf der ersten Seite, ältere sind über `offset` erreichbar. Der
  Leitfaden nennt Reihenfolge und Blättern.
- `SpeechSegment`: `segmentId`, `meetingId`, `text`, `startedAt`, `endedAt`, `speakerId?`, `source`, `status`,
  `ingestedAt` (Serverzeit), `contributionId?` und `adoptedAt?` (nach Übernahme), `_actions`.
- **Listen-`_actions`** enthält `ingest.write`, wenn der Akteur es hält **und** R-ING-02 erfüllt ist (HV `running`).
  Die Oberfläche zeigt den Import-Knopf genau dann (R4; es gibt keine andere Ressource, die das Recht tragen könnte).
- **Abschnitts-`_actions`** enthält `contribution.capture`, wenn der Akteur das Recht hält, die Segmenttabelle
  `unconfirmed → adopted` zulässt **und** die HV nicht `closed` ist. Nach dem Debattenschluss bleibt die Aktion sichtbar;
  ob der Grund reicht, entscheidet R-MTG-03 beim Schreiben. Die Oberfläche zeigt „Übernehmen“ genau dann; sie liest keinen
  Status (R5). Test K22.

### 7. Übernahme in einen Redebeitrag (R-ING-04, Segmenttabelle)

- `MeetingContributionCapture` erhält das optionale Feld `segmentIds` (1–50, eindeutig, Muster wie `segmentId`).
  Additiv nach 043a Regel 1; nur der kanonische Pfad, nicht der Alias `captureContribution`.
- Neue Tabelle `SEGMENT_TRANSITIONS` in `packages/domain/src/transitions.ts` mit genau einer Zeile:
  `unconfirmed → adopted`, Aktion `contribution.capture`, Regel **R-ING-04**. Guards der Zeile:
  - jede Kennung existiert in dieser HV (sonst **422** R-ING-04);
  - jeder Abschnitt ist `unconfirmed` (sonst **409** R-ING-04);
  - `source` ist `transcript` (sonst 422 R-ING-04);
  - `occurredAt` und `occurredAtSource` fehlen im Body (sonst 422 R-ING-04): Der Kern leitet sie ab.
- Ableitung: `occurredAt` = frühester `startedAt` der übernommenen Abschnitte, `occurredAtSource: transcript`. Danach
  prüft `resolveMeetingCapture` unverändert R-MTG-03 (nach dem Debattenschluss: Grund nötig, `lateEntry: true`).
- Der `text` des Redebeitrags kommt aus dem Body, nicht aus den Abschnitten. Die Oberfläche füllt ihn mit dem
  zusammengefügten Wortlaut vor; die erfassende Person darf Hörfehler berichtigen. Der Nachweis bleibt vollständig: Die
  Abschnitte stehen unverändert im Protokoll, `ContributionCaptured` nennt `segmentIds`.
- Reihenfolge der Prüfungen in `captureInMeeting` **bleibt wie heute** bis einschließlich `If-Match`
  (`api.ts:667-674`): Recht → Wortmeldung → Text → `If-Match` → neu: Segmenttabelle (R-ING-04, auch doppelte Kennung in
  `segmentIds` → 422) → Ableitung → R-MTG-03 → ein `append` mit `ContributionCaptured` (Nutzlast um `segmentIds`
  ergänzt). Ein veralteter Stand antwortet also weiterhin 412 vor jeder Segment- oder R-MTG-03-Prüfung (Test K25). Die Projektion setzt die
  Abschnitte auf `adopted` mit `contributionId` und `adoptedAt`. Der bestehende `Idempotency-Key` der Operation gilt
  unverändert.
- `Contribution` erhält das optionale Antwortfeld `segmentIds`.
- **Alias ohne `segmentIds`:** `captureContribution` (Alias, `api.ts:956-958`) kopiert nur `speakerId`, `text` und
  `source` in eine neue Eingabe und reicht nie `segmentIds`, `occurredAt`, `occurredAtSource` oder `lateEntryReason`
  weiter, auch wenn sie im Objekt stehen (Demo ohne Validator; im Dienst lehnt der Vertrag sie nur ab, wenn das Schema
  `additionalProperties: false` trägt). Test K20, Mutationsprobe M8.

### 8. Ereignis `SegmentIngested`

- Nutzlast: `segmentId`, `text`, `startedAt`, `endedAt`, `speakerId?`, `source`. Nur benannte Felder werden kopiert,
  nie der Eingabeobjekt-Spread (Schutz vor `__proto__` und Zusatzfeldern in der Demo, die keinen Validator hat).
- Umschlag: `occurredAt = startedAt`, `occurredAtSource: transcript`, `retentionClass: record` (DSFA V16),
  `legalHold: false`, Akteur = angemeldete Person.
- `envelope.ts`: Typ in `EVENT_TYPES`.
- **Strom (`stream.ts`):** neue Subjektart `segment` in `SubjectRef` mit der Kern-id (`sg-…`, nie der Partnerkennung).
  `SegmentIngested` → Thema `contributions`, Subjekte `segment` und HV; `ContributionCaptured` nennt zusätzlich je
  übernommenem Abschnitt ein Subjekt `segment`. `collect` erhält den Fall `segment`: ausgegeben wird er, wenn das Thema
  `contributions` für den Leser lesbar ist (`contribution.read`) und der Abschnitt in der Projektion existiert;
  `lookupIn` und `snapshotBefore` kennen die neue Art. So erhalten Erfassung, Versammlungsbüro und Koordination einen
  `change`, und der Live-Puffer lädt `listSpeechSegments` neu (`READ_TOPICS`: `['contributions']`). Test K16,
  Mutationsprobe M7. `maskEvent` bleibt unverändert: `text` ist wie der Wortlaut eines Redebeitrags
  für Halter von `event.read` lesbar; es gibt kein Personenfeld in der Nutzlast.
- Text liegt nicht im `pii`-Teil, genau wie `ContributionCaptured.text` heute. Eine abweichende Behandlung wäre eine
  zweite Regel für denselben Wortlaut (Eigentümerfrage 3 betrifft die Aufbewahrung, nicht die Ablage).

### 9. Beispielbestand und Beispieldatei (eine Quelle, 080b)

- `packages/domain/src/seed.ts` erhält eine feste, synthetische Abschnittsliste ohne Zufallsgenerator:
  - **`TRANSCRIPT_SEEDED`**: 6 Abschnitte, `source: demo-transkript`, Zeitanker 2 bis 6 Minuten vor `now`. Die
    ersten drei tragen die `speakerId` der Person am Mikrofon (das Werkzeug hat sie erkannt), die letzten drei keine.
    Inhalt: Fortsetzung der Rede mit zwei erkennbaren Fragen.
  - **`TRANSCRIPT_SAMPLE`**: 5 Abschnitte, `source: beispieldatei`, Kennungen disjunkt zu den geseedeten, ohne
    `speakerId`, mit Versatz in Sekunden vor einem Bezugszeitpunkt. Inhalt: ein kurzer Redebeitrag mit drei Fragen.
  - Funktion `transcriptSampleBody(anchor: Date): SpeechSegmentBatch` baut daraus den Body.
  - Wortlaut nur erfunden, keine echten Personen oder Unternehmen (R11); deutsch wie der übrige Korpus.
- `SeedOptions.transcriptSample?: boolean` (Standard `false`). `seedEvents` erzeugt die 6 `SegmentIngested` (Akteur
  `capture1`, mit `occurredAt`/`occurredAtSource: transcript`) **nach** allen zufallsgetriebenen Ereignissen, also ohne
  den Zufallsstrom zu berühren; Kennungen bekommen sie aus demselben Zähler danach. Die bestehende Sortierung nach `at`
  am Ende von `seedEvents` ordnet sie danach zeitlich ein (stabil; ihre `at` liegen 2–6 Minuten vor `now`); der Test
  prüft, dass jeder Abschnitt nach `MeetingStarted` und vor `now` steht. Gibt es keine Person am Mikrofon
  (Rundengrößen ohne `speakingNow`), tragen alle 6 keine `speakerId`.
- **Was bytegleich bleibt und was nicht:** `seedEvents` ohne die Option (Lastkorpus, Fingerabdruck in
  `seed-fictitious-names.test.ts`) bleibt bytegleich. `HvApi.seedDemo` übergibt `true`; das Protokoll von `CORPUS_DEMO`
  wächst damit um 6 Ereignisse. Der Dienst (Autoseed, `POST /v1/demo/seed`) und die Netlify-Demo zeigen dieselben 6
  Abschnitte; Tests, die Ereignisse des Demokorpus zählen, ziehen nach (Files allowed, Vor-dem-Bau-Punkt 4).
- `docs/integration/beispiele/transkript-beispiel.json` ist `transcriptSampleBody(new Date('2026-10-01T08:30:00Z'))`,
  mit zwei Leerzeichen eingerückt. Ein Test im Kern liest die Datei und vergleicht tief. Der feste Anker liegt in der
  Vergangenheit, damit die Datei nie an „Zeitanker in der Zukunft“ scheitert.
- **Demo-Export der API-Schicht:** `apps/web/src/api/index.ts` exportiert `demoTranscriptSample(): SpeechSegmentBatch`
  (= `transcriptSampleBody(new Date())`, dort, wo der Web-Adapter heute die Uhr setzt, `index.ts:130`). Die Erfassung
  (064b) importiert ihn aus `../../api`, nicht aus `@hv/domain`; so bleibt die Regel
  `web-features-i18n-domain-types-only` unberührt. Die Zeitanker liegen damit in der Demo am selben Tag wie die HV. Jeder Versatz ist positiv und `endedAt` liegt vor dem Anker, damit kein Zeitanker in der
  Zukunft liegt.

### 10. Partnerleitfaden

`docs/integration/transkript.md` liegt als Gliederung bei (mit dieser Spec gemergt). 064a füllt jeden Abschnitt, prüft
jedes Beispiel gegen den laufenden lokalen Dienst und legt die Ausgabe in den Bericht. Pflichtinhalte: Endpunkt,
Anmeldung heute und später (ausdrücklich: im Betrieb schreibt heute nur der Datei-Import im Browser mit der Sitzung der
erfassenden Person; ein Partner testet im Demo-Modus oder später im Sandbox-Mandanten aus 065), Nutzlast mit Grenzen, Antworten mit Regel-ids, Idempotenz, Zeitanker, Kompatibilitätsregel
/v1 über zwei Vertragszyklen, Reihenfolge und Blättern der Liste, NFC-Empfehlung, Sicherheits- und
Datenschutzhinweise für Partner (verbindlich: keine echten Transkripte in irgendeiner Umgebung, bevor der DSB geantwortet
hat, E14), Schnellstart in fünf Schritten aus dem Wurzelverzeichnis des Repositoriums mit curl (`--data-binary`) und
`jq` (als Voraussetzung genannt) sowie das Beispielskript `docs/integration/beispiele/transkript-einspielen.mjs` (Node
ohne Abhängigkeiten, `fetch`, setzt die Zeitanker der Beispieldatei auf „jetzt minus Versatz“ und sendet).

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

Gezählt auf `2fc3153`. Mergen 040b oder 044a vorher und ändern Bündel, zählt der Bericht neu; die Aussagen zu den neuen
Spalten bleiben gleich.

**Abschnitt „Role × Status × Action“:** unverändert. `ingest.write` ist kein Fragenrecht und erscheint dort nicht
(`actionsFor` filtert auf `question.*` und `answer.draft`).

**Abschnitt „Role × Leserecht“:** unverändert (kein neues Leserecht).

**Abschnitt „Role × Wortmeldung, Erfassung und Demo“:** neue Spalte `ingest.write` nach `contribution.claim`, ✓ nur bei
`capture`:

```
-| Role | speaker.register | speaker.reorder | speaker.update | contribution.capture | contribution.claim | demo.seed |
-|---|---|---|---|---|---|---|
-| capture | · | · | · | ✓ | ✓ | · |
-| admin | · | · | · | · | · | ✓ |
+| Role | speaker.register | speaker.reorder | speaker.update | contribution.capture | contribution.claim | ingest.write | demo.seed |
+|---|---|---|---|---|---|---|---|
+| capture | · | · | · | ✓ | ✓ | ✓ | · |
+| admin | · | · | · | · | · | · | ✓ |
```

Alle übrigen Zeilen erhalten `·` in der neuen Spalte.

**Neuer Abschnitt „Role × Transkriptabschnitt“**, erzeugt vom selben Test über dieselbe Entscheidung wie
`SpeechSegment._actions`. Repräsentativer Abschnitt dieser HV; Spalte „übernehmen“ = `contribution.capture` über die
Zeile R-ING-04, Spalte „lesen“ = `contribution.read`.

| Role | Status | übernehmen | lesen |
|---|---|---|---|
| moderation | unconfirmed | · | ✓ |
| moderation | adopted | · | ✓ |
| capture | unconfirmed | ✓ | ✓ |
| capture | adopted | · | ✓ |
| coordination | unconfirmed | · | ✓ |
| coordination | adopted | · | ✓ |
| expert | unconfirmed | · | · |
| expert | adopted | · | · |
| legal | unconfirmed | · | · |
| legal | adopted | · | · |
| approver | unconfirmed | · | · |
| approver | adopted | · | · |
| podium | unconfirmed | · | · |
| podium | adopted | · | · |
| admin | unconfirmed | · | ✓ |
| admin | adopted | · | ✓ |
| observer | unconfirmed | · | · |
| observer | adopted | · | · |

Was der Abschnitt belegt: Übernehmen kann nur `capture` und nur aus `unconfirmed`; admin liest, schreibt aber nicht
(040a); Fachbereich, Recht, Freigabe, Podium und Beobachter sehen keine Rohabschnitte.

## Missbrauchsfälle mit Erkennung (vor dem Bau)

Lehre aus 040 und 044a: Für jeden neuen Mechanismus stehen Missbrauch, Abwehr und Erkennung hier, bevor gebaut wird.
„Erkennung“ nennt, woran Betrieb oder Review den Versuch sehen; „Test“ nennt den Nachweis dieser Scheibe.

### Idempotenzschlüssel `segmentId`

| Missbrauch | Abwehr | Erkennung | Test |
|---|---|---|---|
| Nachträgliches Umschreiben: ein bekannter Abschnitt wird mit anderem Wortlaut erneut gesendet, um den Nachweis zu ändern | R-ING-01: 409, kein Ereignis; das erste Ereignis bleibt (R7) | `409` auf `ingestSpeechSegments` im Zugriffslog (033a: Operation, Status, Subjekt-Hash); der Partner behandelt 409 laut Leitfaden als Alarm, nie als „neue Kennung probieren“ | K3, H5 |
| Besetzen: jemand liefert vorab Abschnitte unter Kennungen, die das Werkzeug später benutzen wird, mit erfundenem Text | Abschnitte sind `unconfirmed` und werden nur durch einen Menschen übernommen; das Ereignis nennt den Akteur; Leitfaden verlangt nicht vorhersagbare Kennungen (UUID oder ULID mit Präfix des Werkzeugs) | Das echte Werkzeug erhält 409 R-ING-01 für seine Kennung; der Akteur des besetzenden Ereignisses steht in der Historie (`listEvents`, admin) | K3 (409 für den zweiten Sender) |
| Inhaltsbestätigungs-Orakel (T-G3-I-06): ein Halter von `ingest.write` sendet eine vermutete Kennung **mit vermutetem Wortlaut**; `duplicate` bestätigt Kennung und Inhalt, 409 bestätigt die Kennung und widerlegt den Inhalt | Heute hält nur `capture` das Recht, und `capture` liest die Abschnitte ohnehin (`contribution.read`): kein Erkenntnisgewinn. Die Antwort gibt nie gespeicherten Inhalt preis | Häufung von 409 R-ING-01 je Subjekt im Zugriffslog; Vorgabe an die Folgescheibe im Abschnitt „Partner-Anmeldung später“ | K3 (`detail` ohne Inhalt) |
| Teilschreiben: ein Stapel mit einem Konflikt schreibt die übrigen Abschnitte doch | Alles oder nichts: erst prüfen, dann ein `append` | Ereigniszahl vor und nach dem Fehler gleich | K4, Mutationsprobe M5 |
| Doppelte Kennung im Stapel, um zwei Inhalte unter einer Kennung zu speichern | 422 R-ING-03 vor jedem Schreiben | `422` im Zugriffslog | K5 |
| Rennen: zwei Browser importieren dieselbe Datei gleichzeitig | Prüfung und Schreiben im selben serialisierten Befehl | genau ein Satz Ereignisse | H9 (Postgres) |
| Wiederholung nach Schluss der HV, um Abschnitte nachzuschieben | R-ING-02 vor der Idempotenzprüfung | `409` mit R-ING-02 | K7 |

### Recht `ingest.write` und Übernahme

| Missbrauch | Abwehr | Erkennung | Test |
|---|---|---|---|
| Rolle ohne Recht liefert Abschnitte (Beobachter, admin, moderation) | `can()` im Kern, 403 R-PERM-01 | `403` im Zugriffslog | K6, H3 (Planbeleg „observer → 403“) |
| Rolle ohne Leserecht liest Rohabschnitte (expert, legal, approver, podium, observer) | `READ_PERMISSIONS` mit `contribution.read`, 403 R-PERM-02 | `403` im Zugriffslog | K6 |
| Oberfläche blendet den Knopf aus, ein Skript ruft den Endpunkt trotzdem | Entscheidung im Dienst, nicht in der Oberfläche | — | H3 |
| Erfassende Person erfindet Abschnitte mit selbst gebautem JSON und behauptet `source: whisper` | Gleiches Vertrauen wie bei der manuellen Erfassung (sie darf ohnehin erfassen); `source` ist als Angabe gekennzeichnet; das Ereignis nennt den Akteur; Übernahme bleibt ein eigener, sichtbarer Schritt | Historie zeigt Akteur und `source`; `ContributionCaptured.segmentIds` verknüpft | K15 |
| Doppelte Übernahme desselben Abschnitts in zwei Redebeiträge | R-ING-04: 409, Abschnitt schon `adopted` | `409` mit R-ING-04 | K12, Mutationsprobe M3 |
| Übernahme rückdatiert, um R-MTG-03 nach dem Debattenschluss zu umgehen (Abschnitt mit frühem `startedAt`) | `occurredAt` leitet der Kern ab; R-MTG-03 verlangt nach dem Schluss trotzdem einen Grund und setzt `lateEntry: true` | Kennzeichen `lateEntry` am Redebeitrag; Grund im Ereignis | K13 |
| `source: manual` mit `segmentIds`, um die Herkunft zu verschleiern | 422 R-ING-04 | `422` | K12 |
| Neues Recht fällt still an admin | admin ist seit 040a eine ausdrückliche Liste | Wahrheitstabellen-Diff | K18, Mutationsprobe M2 |

### Größen und Mengen

| Missbrauch | Abwehr | Erkennung | Test |
|---|---|---|---|
| Übergroßer Body | 413 im Dienst (034a), vor dem Kern | `413` im Zugriffslog | H4 |
| Stapel mit mehr als 100 Abschnitten oder Text über 4 000 Zeichen | Vertrag (422) **und** Kern (422 R-ING-03), weil die Demo keinen Validator hat | `422` | H4, K8 |
| Flut über viele kleine Stapel | Quote je Subjekt (034a, `429`, für jede Rolle gleich); R-ING-05 bei 20 000 Abschnitten oder 8 MiB Wortlaut je HV | `429` und `409` R-ING-05 im Zugriffslog | K10 |
| Demo im Browser läuft über den `localStorage` voll | Demo-Grenzen 500 Abschnitte, 512 KiB (Entscheidung 4) | `409` R-ING-05 im Dialog | K10, 064b |
| Datei mit hunderttausenden Abschnitten im Browser | Grenzen des Datei-Adapters in 064b (Dateigröße, Stapel) | 064b | 064b |

### Fehlerhafte und feindliche Eingaben

| Missbrauch | Abwehr | Erkennung | Test |
|---|---|---|---|
| Steuerzeichen, NUL, Escape-Sequenzen im Text (Terminal- und Log-Injektion) | Muster im Vertrag und gleiche Prüfung im Kern: 422 R-ING-03 | `422` | H4, K8, Mutationsprobe M4 |
| HTML oder Skript im Text (`<img src=x onerror=…>`) | Gespeichert wie geliefert, angezeigt nur als Text (React, kein `dangerouslySetInnerHTML`); Probe in 064b | Review-Grep in 064b | 064b |
| Bidi-Einbettung, -Überschreibung, -Isolation (U+202A–U+202E, U+2066–U+2069) verdrehen die Anzeige eines Wortlauts (T-G3-T-04) | 422 R-ING-03 in Vertrag und Kern (sicherere Wahl); Anzeige zusätzlich je Abschnitt isoliert (064b) | `422` | K8, 064b P8 |
| C1-Steuerzeichen (U+0080–U+009F) und DEL | 422 R-ING-03 | `422` | K8 |
| Länge mit Ersatzpaaren (Emoji) umgeht die Grenze, weil der Kern in UTF-16-Einheiten zählt und Ajv in Codepunkten | Kern zählt Codepunkte wie Ajv | — | K8 |
| Datumsformen, die `Date.parse` annimmt und der Vertrag nicht (`2026-10-01`, `Oct 1 2026`) | RFC-3339-Ausdruck im Kern | `422` | K8 |
| Zusatzfelder oder `__proto__` im Abschnitt (Demo ohne Validator) | Vertrag `additionalProperties: false`; Kern kopiert nur benannte Felder | Nutzlast hat genau die benannten Schlüssel | K9 |
| Kennung `constructor`, `__proto__`, `toString` trifft eine Objekt-Eigenschaft der Projektion | Projektion und Index als `Map` | `duplicate`/`created` richtig, `Object.prototype` unverändert | K9 |
| `segmentIds` über den Alias `captureContribution` eingeschleust | Alias kopiert nur benannte Felder | kein `segmentIds` im Ereignis | K20, M8 |
| `endedAt` vor `startedAt`, Zeitanker in der Zukunft, kein gültiges Datum | 422 R-ING-03 | `422` | K8 |
| `speakerId` einer fremden HV oder erfunden, um Fragen einer Person unterzuschieben | 422 R-ING-03; der Hinweis ist nur Vorschlag, die Erfassung ordnet bei der Übernahme zu | `422` | K8 |
| Kennung mit `/`, `..`, Leerzeichen oder 300 Zeichen | Muster, 422 | `422` | K8, H4 |
| Formel-Injektion (`=HYPERLINK(…)`) für einen späteren Tabellenexport | Kein Export in 064a; Hinweis an 051 in der Folgeliste | — | — |
| Prompt-Injektion im Wortlaut für einen späteren KI-Port | Kein KI-Port in 064a; 066 behandelt Fragetext ohnehin als unvertraut | — | — |

### Partner-Anmeldung später (nicht gebaut; Vorgaben an die Folgescheibe)

| Missbrauch | Vorgabe | Erkennung |
|---|---|---|
| Abgeflossenes Client-Secret eines Systemakteurs | Bündel nur `ingest.write`; Sperrliste je Subjekt wie 029b; Secret nur aus der Plattform; kurzlebige Token | Zugriffslog je Subjekt-Hash; Alarm (085) bei 409-Häufung |
| Systemakteur gibt sich als anderes Werkzeug aus | `source` aus der Konfiguration des Systemakteurs gesetzt, nicht aus dem Body | Abweichung Body-`source` ↔ Konfiguration als 422 |
| Inhaltsbestätigungs-Orakel (T-G3-I-06) für einen Systemakteur ohne Leserecht (DSFA: „nur Segmente schreiben, nichts lesen“): mit vermutetem Wortlaut bestätigt `duplicate` den Inhalt eines fremden Abschnitts | **Pflicht für die Folgescheibe:** Kennungen eines Systemakteurs sind auf seinen Namensraum beschränkt (Präfix aus der Konfiguration, fremdes Präfix → 403), sodass er nur eigene Abschnitte bestätigen kann; Quote je Subjekt | Häufung von `duplicate`/409 je Subjekt; Alarm (085) |
| mTLS-Zertifikat mit zu weitem Subject | Zuordnung Zertifikat → Systemakteur als Tabelle in der Konfiguration | Startprüfung der Konfiguration |

## Datenschutz (DSFA-Vorentwurf V16, V2)

- **Felder:** Wortlaut je Abschnitt, Zeitanker, optionaler Sprecherhinweis als Wortmeldungs-id, Quelle, Akteur-id.
  Kein Klarname im Ereignis; ein im Wortlaut gesprochener Name lässt sich nicht verhindern und ist wie im
  Redebeitrag zu behandeln.
- **Betroffene:** Redende (Aktionäre, Bevollmächtigte); Versammlungsleitung und Vorstandsmitglieder, deren Worte das
  Werkzeug mitschreibt; Beschäftigte im Saal oder am Mikrofon (Moderation, Hinweise); im Wortlaut genannte Dritte. Ein
  Transkript ist kein reiner Aktionärsinhalt; deshalb gilt die Empfängerbeschränkung unten für jeden Abschnitt.
- **Empfänger:** Halter von `contribution.read` (Versammlungsbüro, Erfassung, Koordination, Administration), dieselben
  wie für Redebeiträge. Nicht Fachbereich, Recht, Freigabe, Podium, Beobachter. `event.read` (Administration) sieht
  das Ereignis wie jedes andere.
- **Aufbewahrung:** `retentionClass: record` wie in V16; `legalHold: false`. Ob nicht übernommene Abschnitte früher
  gelöscht werden dürfen, ist offen (Eigentümerfrage 3, E14, E16); eine Löschung gibt es in der Beta nicht. Die Klasse
  wird beim Schreiben gestempelt und ist Teil der Hash-Kette: Eine spätere Änderung wirkt nur für künftige Ereignisse;
  bereits geschriebene Abschnitte lassen sich nur über einen Export in eine neue Datenbank umkodieren (E16).
- **Verbindlicher Vermerk (sicherere Wahl):** Keine echten Transkripte und keine Mitschnitte echter Versammlungen in
  irgendeiner Umgebung (Demo, lokal, Staging, Übungsmandant), bevor der DSB zur DSFA geantwortet hat (E14). Der Vermerk
  steht in DSFA V16 und im Leitfaden.
- **Datensparsamkeit:** kein Namensfeld; Sprecherhinweis nur als Bezug (Entscheidung 2); Antwort auf den Ingest gibt nur
  Kennungen und Ergebnis zurück, nie den Wortlaut.
- **Synthetik:** Seed und Beispieldatei sind erfunden (R11). Der Leitfaden verbietet echte Mitschnitte in Tests und im
  Sandbox-Mandanten (065).
- **DSFA-Zeilen, die 064a ändert:** V16 „geplant“ → „gebaut in 064a: Datei-Import durch die Erfassung; Systemakteur
  geplant“, Betroffene und Empfänger wie oben, verbindlicher Vermerk zu E14, Abweichung „Systemakteure: nur schreiben, nichts lesen“ bleibt für später; Zeile 157
  (Nachbarsysteme) mit dem neuen Pfad; Zeile 115 „künftig Segmente“ → „Segmente seit 064a“.

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6, 043a Regel 1)

- **Version:** die nächste freie Patch-Stufe nach 0.4.0 beim Merge (heute erwartet 0.4.1 oder höher, je nachdem, ob
  040b oder 044a vorher mergen). 043a legt fest: Nur 0.4.0 hebt die Minor-Stufe, additive Teile heben die Patch-Stufe.
  Der Auftrag nannte „Minor“; diese Spec folgt 043a, damit 0.5 für die angekündigte Streichung der Aliase frei bleibt.
  `info.version`, `packages/contract/package.json`, Abschnitt `## [0.4.x]` in `packages/contract/CHANGELOG.md` mit
  `### Added` und dem Vermerk „auf Standard gebaut (E3a) am <Merge-Datum> in 064a“.
- **Neu:** Tag `ingest`; Pfad `/meetings/{meetingId}/speech-segments` mit `ingestSpeechSegments` (POST) und
  `listMeetingSpeechSegments` (GET); Schemas `SpeechSegmentInput`, `SpeechSegmentBatch`, `SpeechSegmentIngestResult`
  (`created`, `duplicates`, `results[]` mit `segmentId` und `outcome: created | duplicate` in Reihenfolge der Anfrage),
  die Zeichen- und Längenregeln aus Entscheidung 2 als Muster in `SpeechSegmentInput.text`, die Reihenfolge „neueste
  zuerst“ in der Beschreibung von `listMeetingSpeechSegments`,
  `SpeechSegment`, `SpeechSegmentStatus` (`unconfirmed | adopted`), `SpeechSegmentList` (`items`, `total`, `_actions`).
- **Antworten** wie seit 0.4.0 üblich, je mit Verweis auf die vorhandenen `components/responses`:
  - POST: `200`, `401`, `403`, `404`, `408`, `409` (R-ING-01, R-ING-02, R-ING-05), `413`, `422` (Schema, R-ING-03),
    `429`, `500`, `503`;
  - GET: `200`, `401`, `403`, `404`, `408`, `422`, `429`, `500`, `503`.
- **Parameter:** POST mit `MeetingId` und `CsrfToken`, **ohne** `IdempotencyKey` und `IfMatchRequired` (Begründung in
  der Beschreibung, Entscheidung 3); GET mit `MeetingId`, `status`, `limit`, `offset`.
- **Additiv an bestehenden Schemas:** `Action` + `ingest.write` (mit Absatz in der Beschreibung);
  `Event.type` + `SegmentIngested` (Nutzlast in der `Event`-Beschreibung); `MeetingContributionCapture.segmentIds`
  (optional, `uniqueItems`, Guard R-ING-04 in der Beschreibung von `captureMeetingContribution`); `ContributionCapture`
  (Alias) bleibt ohne `segmentIds`, die Beschreibung von `captureContribution` sagt, dass es dort nicht wirkt; `Contribution.segmentIds` (optional,
  Antwortfeld); Nutzlast `ContributionCaptured` + `segmentIds` in der `Event`-Beschreibung; Beschreibung von
  `StreamTopic.contributions` nennt Abschnitte; Satz in `listContributions` (`openapi.yaml:302-303`) wird Gegenwart.
- **`info.description`:** Absatz „Transcript ingest (since 0.4.x, slice 064a)“: Zweck, unveränderliche Abschnitte,
  Idempotenz je `segmentId` über Akteure, Übernahme durch einen Menschen, Verweis auf `docs/integration/transkript.md`,
  **Kompatibilitätszusage für Partner:** Jede nicht additive Änderung an `ingestSpeechSegments`,
  `listMeetingSpeechSegments` und ihren Schemas wird mindestens einen Zyklus vorher als veraltet markiert und
  frühestens zwei Vertragszyklen (Minor-Stufen) nach der Ankündigung wirksam; brechende Änderungen nur mit ADR-Verweis
  (ADR 0008, ADR 0015).
- **Keine Allowlist-Einträge:** Beide Operationen werden in 064a gebaut und vom Abdeckungstor ausgeübt.
- **Nachtrag ADR 0008** (nur Architekt): Pfad nach Entscheidung 1, „auf Standard gebaut (E3a)“, Verweis auf 064a.
  Kein Statuswechsel des ADR.
- **Typen:** `pnpm contract:types`; ein zweiter Lauf ergibt keinen Diff.
- **Tore:** `pnpm contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`, (c) mit `0.4.y -> 0.4.x`. Die
  Versionszeilen der Vertragstests ziehen nach.
- Ist 043a beim Baustart nicht gemergt: anhalten (Vor-dem-Bau-Punkt 1).

## Nicht-Ziele

- Keine Oberfläche außer dem einen Aktionsschlüssel, den die Typprüfung für `ingest.write` erzwingt (064b baut Liste,
  Dialoge, Adapter, Texte).
- Kein Push-Adapter, kein Systemakteur, keine Rolle, kein Sicherheitsschema für Client-Credentials oder mTLS (043c und
  eine Folgescheibe nach E3b).
- Keine Webhooks, kein Sandbox-Mandant (065).
- Kein Verwerfen oder Ausblenden einzelner Abschnitte (etwa Beifall oder Moderation) als Ereignis. Nicht übernommene
  Abschnitte bleiben `unconfirmed`; ein Status `discarded` wäre eine zweite Tabellenzeile mit eigener Regel und kommt,
  wenn Feedback ihn verlangt (Folgeliste).
- Keine Zerlegung fremder Formate (WebVTT, SRT, Werkzeugexport) im Kern (ADR 0001 Grenze 3). Der Datei-Adapter in 064b
  nimmt in dieser Fassung nur das kanonische JSON; ein Formatadapter folgt, wenn E3b das Werkzeug benennt.
- Keine Änderung an `captureContribution` (Alias), `captureQuestions`, an der Atomisierung, an `actionsFor` für Fragen.
- Keine Löschung, kein `pii`-Codec, keine neue Kennzahl (Metrik-Allowlist bleibt unberührt).
- Kein Netlify-Build: Deploy nur nach ausdrücklichem Go des Eigentümers (R11).

## Files allowed

Vertrag (Architekt, erster Commit):

- `packages/contract/openapi.yaml`
- `packages/contract/CHANGELOG.md` (nur der neue Abschnitt)
- `packages/contract/package.json` (nur `version`)
- `packages/contract/src/types.ts` (nur regeneriert mit `pnpm contract:types`)
- `docs/adr/0008-integrationen.md` (nur der Nachtrag aus dem Vertragsschritt)

Kern:

- `packages/domain/src/types.ts` (nur: `ingest.write` in `PERMISSIONS`, `listSpeechSegments` in `READ_PERMISSIONS`, die Segmenttypen, `segmentIds` an `MeetingContributionCapture` und `Contribution`)
- `packages/domain/src/permissions.ts` (nur das Bündel `capture`)
- `packages/domain/src/transitions.ts` (nur `SEGMENT_TRANSITIONS` mit R-ING-04, `resolveSegmentIngest` für R-ING-02/03/05, die Ableitung für die Übernahme)
- `packages/domain/src/rules.ts` (nur die Einträge R-ING-01..05 und die Aufnahme der Segmenttabelle in das Register)
- `packages/domain/src/events.ts` (nur `SegmentIngested` und `segmentIds` in `ContributionCaptured`)
- `packages/domain/src/state.ts` (nur die Abschnitte in der Projektion als `Map` mit Index und der Fall `ContributionCaptured` für `segmentIds`)
- `packages/domain/src/envelope.ts` (nur `SegmentIngested` in `EVENT_TYPES`)
- `packages/domain/src/stream.ts` (nur: `SegmentIngested` in beiden Zuordnungen, Subjektart `segment` in `SubjectRef`, `collect`, `lookupIn`, `snapshotBefore`, die Segment-Subjekte an `ContributionCaptured`)
- `packages/domain/src/api.ts` (nur: `HvApi` um `ingestSpeechSegments` und `listSpeechSegments`, ihre Umsetzung, `segmentIds` in `captureInMeeting`, der Alias `captureContribution` mit benannten Feldern, die Option `ingestLimits`, `seedDemo` mit `transcriptSample`)
- `packages/domain/src/seed.ts` (nur `TRANSCRIPT_SEEDED`, `TRANSCRIPT_SAMPLE`, `transcriptSampleBody`, `SeedOptions.transcriptSample` und das Anhängen am Ende von `seedEvents`)
- `packages/domain/src/index.ts` (nur Exporte)
- `packages/domain/policy-truth-table.md` (nur regeneriert)
- `docs/legal-trace.md` (nur regeneriert)

Tests im Kern:

- `packages/domain/src/__tests__/ingest064a.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur die neue Spalte und der neue Abschnitt der Wahrheitstabelle, Regeltest für R-ING-04)
- `packages/domain/src/__tests__/seed.test.ts` (nur neue Fälle für den Beispielbestand)
- `packages/domain/src/__tests__/stream035.test.ts` (nur Fälle für `SegmentIngested` und die Subjektart `segment`)
- `packages/domain/src/__tests__/*.test.ts` (nur Erwartungen an Rechtelisten, Regel- und Ereigniszahlen, die sich durch diese Spec ändern, auch die sechs zusätzlichen Ereignisse des Demokorpus; jede andere Änderung ist ein Befund)

Dienst:

- `apps/api/src/app.ts` (nur die zwei Routen)
- `apps/api/src/__tests__/ingest064a.test.ts` (neu)
- `apps/api/src/__tests__/postgres-ingest064a.test.ts` (neu)
- `apps/api/src/__tests__/*.test.ts` (nur Versionszeilen der Vertragstests und Zahlen, die sich durch diese Spec ändern)

HTTP-Client, Live-Puffer, Aktionsschlüssel (nur Typprüfung):

- `apps/web/src/api/http.ts` (nur die zwei Methoden)
- `apps/web/src/api/http.test.ts` (nur Tests der zwei Methoden: Methode, Pfad, Body, CSRF-Kopf)
- `apps/web/src/api/liveStore.ts` (nur die Einträge der zwei Methoden in `WRITE_METHODS` und `READ_TOPICS`; `ITEM_READS` nur, falls die Typprüfung die neue Subjektart verlangt)
- `apps/web/src/api/index.ts` (nur der Export `demoTranscriptSample` und `ingestLimits` für den In-Process-Kern der Demo)
- `apps/web/src/api/liveStore.test.ts` (nur, falls eine Vollständigkeitsprüfung eine Liste führt)
- `apps/web/src/i18n/labels.ts` (nur ein Eintrag in `ACTION_KEYS`, falls die Typprüfung ihn verlangt)
- `apps/web/src/i18n/shell.de.ts` und `apps/web/src/i18n/shell.en.ts` (nur der Aktionsschlüssel `ingest.write`)
- `apps/web/src/i18n/parity.test.ts` (nur Zahl und Kommentar)
- `apps/web/src/**/*.test.{ts,tsx}` (nur, wo eine typisierte Attrappe von `HvApi` die zwei Methoden braucht)

Dokumente:

- `docs/integration/transkript.md` (füllen; Gliederung mit dieser Spec gemergt)
- `docs/integration/beispiele/transkript-beispiel.json` (neu, aus `transcriptSampleBody`)
- `docs/integration/beispiele/transkript-einspielen.mjs` (neu, Beispielskript des Leitfadens)
- `docs/sicherheit/bedrohungsmodell.md` (nur: T-G3-S-01, T-G3-T-01, T-G3-R-01, T-G3-D-01, T-G3-D-02, T-G3-E-01 mit Stand und Nachweis; neue Zeilen T-G3-T-04 und T-G3-I-06; Zeile 064 in „Weitere Scheiben mit Sicherheitsbezug“)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur die Zeilen 115, 157 und V16, Abschnitt „Datenschutz“ oben)
- `docs/rollen-und-rechtekonzept.md` (nur ein Kopfvermerk „Scheibe 064a“: `ingest.write` an Erfassung, Lesen über `contribution.read`, Übernahme über `contribution.capture`, Systemakteur geplant)
- `docs/folgeliste.md` (nur neue nicht blockierende Befunde; mindestens die Einträge aus „Folgelisten-Einträge“ unten)
- `docs/slices/064a-transkript-ingest-vertrag-kern.md` (diese Spec: Bericht, Review findings)
- `docs/entscheidungsregister.md` (nur durch den Orchestrator mit dem Merge: E3a „auf Standard gebaut am <Datum> in 064a“, Pfadvermerk; „Betroffene Scheibe(n)“ von E3a, E3b um „064a“)
- `docs/produktplan-beta.md` (nur durch den Orchestrator und nur nach dem Go zu Eigentümerfrage 2: Teilungsvermerk im Eintrag 064, Zuschnitt 043c, Lanes, Kalender)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`apps/web/src/features/**`, `apps/web/e2e/**`, `apps/web/playwright.config.ts`, `docs/glossar.md` (kommt mit 064b),
`packages/contract/allowlist.json`, `packages/contract/scripts/**`, `apps/api/src/persistence/**`,
`apps/api/src/config/**`, `apps/api/src/limits/**`, `apps/api/src/metrics/**`, `packages/domain/src/piiCodec.ts`,
`packages/domain/src/store.ts`, `docs/adr/**` außer dem Nachtrag in 0008. Dieser Abschnitt steht bewusst außerhalb von
„Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. **043a gemergt?** Vertrag 0.4.0 auf dem Integrationszweig; sonst anhalten. Welche 0.4.x-Stufen sind schon vergeben
   (040b, 044a)? Die nächste freie nehmen und im Bericht nennen.
2. **Regel-ids:** Ist die Familie R-ING noch frei (`grep -rn "R-ING" packages docs`)? Sonst die nächste freie Familie
   und im Bericht nennen.
3. **Bündel:** Hat eine inzwischen gemergte Scheibe `capture` oder admin geändert? Wahrheitstabellen-Diff neu zählen;
   die Aussagen zu `ingest.write` und zum neuen Abschnitt müssen gleich bleiben, sonst anhalten.
4. **Fingerabdruck und Zählungen:** Läuft `seed-fictitious-names.test.ts` nach dem Anhängen unverändert grün? Wenn
   nicht: anhalten, der Beispielbestand darf den Zufallsstrom nicht berühren. Welche Tests zählen Ereignisse des
   Demokorpus (`seed.test.ts`, `acceptance.test.ts`, e2e)? Liste im Bericht; nur deren Zahlen ziehen nach.
5. **Alias im Dienst:** Trägt `ContributionCapture` im Vertrag `additionalProperties: false`? Ergebnis im Bericht; die
   Kopie benannter Felder im Kern gilt in jedem Fall.
6. **Serialisierung:** Läuft die Idempotenzprüfung im Postgres-Pfad innerhalb der Sperre nach der Validierung
   (takt-024)? Zeile im Bericht nennen.
7. **Aktionsschlüssel:** Erzwingt die Typprüfung einen Eintrag für jedes Element von `PERMISSIONS`? Wenn nein, entfallen
   `labels.ts` und `shell.*.ts`.
8. **Zugriffslog:** Schreibt 033a für die neue Operation `operationId` und Status ohne Body? Zeile im Bericht.
9. Weichen Zeilenangaben dieser Spec ab: melden; bei inhaltlichem Widerspruch anhalten.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/ingest064a.test.ts`, In-Process-Kern mit fester Uhr):

- K1. Drei Abschnitte als `capture`: drei `SegmentIngested`, Ergebnis `created` dreimal, Liste zeigt sie `unconfirmed`
  in der Reihenfolge `startedAt`.
- K2. Derselbe Stapel noch einmal: kein neues Ereignis, Ergebnis `duplicate` dreimal (Planbeleg „gleiches Segment
  zweimal → ein Ereignis“). Derselbe Zeitpunkt in anderer Schreibweise (`+00:00` statt `Z`): `duplicate`.
- K3. Gleiche Kennung mit je einem geänderten Feld — `text`, `startedAt`, `endedAt`, `speakerId` (gesetzt, entfernt,
  anderer Wert), `source` — jeweils 409 R-ING-01, kein Ereignis; `detail` enthält Index und Kennung, nicht den
  gespeicherten Text. Dasselbe für einen zweiten Akteur mit `ingest.write`. Gleiche Kennung in einer anderen HV → `created`.
- K4. Stapel aus einem neuen und einem widersprechenden Abschnitt: 409, null Ereignisse.
- K5. Doppelte Kennung im Stapel: 422 R-ING-03, null Ereignisse.
- K6. Rechte: Ingest als observer, admin, moderation, expert → 403 R-PERM-01; Liste als observer, expert, legal,
  approver, podium → 403 R-PERM-02; als moderation, coordination, admin → 200.
- K7. HV in `preparation` und nach `MeetingClosed` → 409 R-ING-02 (auch für eine reine Wiederholung); nach
  `DebateClosed` in `running` → 200.
- K8. Prüfungen im Kern (die Demo hat keinen Validator), jede → 422 R-ING-03 und null Ereignisse: leerer Text, nur
  Leerraum, 4 001 Codepunkte, `\u0000`, `\u001B`, `\u007F`, `\u0085`, `\u009F`, U+202A, U+202E, U+2066, U+2069;
  `endedAt` vor `startedAt`; `startedAt` eine Sekunde nach der Uhr; `2026-10-01` und `Oct 1 2026` als Zeitanker (gültig
  für `Date.parse`, ungültig nach RFC 3339), `2026-02-30T10:00:00Z`, `2026-10-01T10:00:00` ohne Zeitzone,
  `2026-10-01T24:00:00Z`; unbekannte `speakerId`; `speakerId` einer Wortmeldung einer anderen HV;
  Kennung mit `/`, mit Leerzeichen, mit 129 Zeichen; `source` `Whisper!`; 101 Abschnitte. → 200: Tab, Zeilenumbruch,
  U+200E im Text; 4 000 Emoji (8 000 UTF-16-Einheiten, 4 000 Codepunkte).
- K9. Abschnitt mit Zusatzfeld `evil` und eigenem `__proto__`-Schlüssel (über `JSON.parse`): die Nutzlast hat genau
  die benannten Schlüssel; `Object.prototype` ist unverändert. Kennungen `constructor`, `__proto__`, `toString`: erst
  `created`, dann `duplicate`; die Liste zeigt drei Abschnitte.
- K10. Mit `ingestLimits: { segments: 5 }`: fünf Abschnitte ok; ein Stapel mit einem sechsten → 409 R-ING-05, null
  Ereignisse; reine Wiederholungen der fünf → 200 `duplicate`. Mit `ingestLimits: { textBytes: 100 }`: ein Stapel, der
  100 Byte UTF-8 überschreiten würde (Umlaute zählen zwei Byte) → 409 R-ING-05. Ohne Option gelten 20 000 und 8 MiB.
- K11. Übernahme: `captureMeetingContribution` mit `segmentIds` zweier Abschnitte mit verschiedenen Zeitankern, der
  spätere zuerst genannt, `source: transcript` → Redebeitrag mit
  `source: transcript`, `segmentIds`, `occurredAt` = frühester (nicht erster genannter) `startedAt`, `occurredAtSource: transcript`; die
  Abschnitte sind `adopted` mit `contributionId` und `adoptedAt`; ihre `_actions` sind leer; Listen-`_actions` von
  `capture` enthält `ingest.write`, von moderation nicht.
- K12. Übernahme eines schon übernommenen Abschnitts → 409 R-ING-04; unbekannte Kennung → 422 R-ING-04;
  `source: manual` mit `segmentIds` → 422 R-ING-04; `occurredAt` im Body mit `segmentIds` → 422 R-ING-04; dieselbe Kennung
  zweimal in `segmentIds` → 422 R-ING-04; Kennung eines Abschnitts einer anderen HV → 422 R-ING-04; als moderation → 403
  R-PERM-01. Jeweils kein Ereignis.
- K13. Nach `DebateClosed`: Übernahme mit Grund und frühestem `startedAt` ≤ `debateClosedAt` → `lateEntry: true`; ohne
  Grund → 409 R-MTG-03.
- K14. Atomisierung des übernommenen Redebeitrags mit `captureQuestions` → Einzelfragen wie bisher (Fluss unverändert).
- K15. Umschlag: `SegmentIngested` trägt `occurredAt = startedAt`, `occurredAtSource: transcript`, `recordedAt` aus der
  Uhr, `retentionClass: record`, den Akteur; die Hash-Kette prüft.
- K16. Strom: Erfassung, Versammlungsbüro und Koordination (`contribution.read` ohne `event.read`) erhalten nach einem
  Ingest einen `change` mit Thema `contributions` und den Kern-ids (`sg-…`) als Subjekte, nie die Kennung des Senders;
  nach einer Übernahme einen `change` mit Redebeitrag und Abschnitts-ids; observer und expert erhalten nichts; admin
  erhält das maskierte Ereignis. Der Live-Puffer verwirft danach den Eintrag von `listSpeechSegments`.
- K17. Seed: `seedDemo` (Korpus Demo) enthält die 6 geseedeten Abschnitte, alle `unconfirmed`, drei mit der `speakerId`
  der Person am Mikrofon, jeder zeitlich nach `MeetingStarted` und vor `now`; mit Rundengrößen ohne Person am Mikrofon
  trägt keiner eine `speakerId`; `seedEvents` ohne Option erzeugt keinen; `transcriptSampleBody(new Date('2026-10-01T08:30:00Z'))`
  ist tief gleich `docs/integration/beispiele/transkript-beispiel.json`; der Import der Beispieldatei in die geseedete
  HV ergibt fünfmal `created`, beim zweiten Mal fünfmal `duplicate`.
- K18. Wahrheitstabelle: regeneriert und gleich dem Diff dieser Spec (neue Spalte, neuer Abschnitt).
- K19. Regelregister: R-ING-01..05 vorhanden, jede mit `legalRef` (`verified: false`), R-ING-04 als `Übergang` aus der
  Segmenttabelle.
- K20. Alias: `captureContribution` mit `segmentIds`, `occurredAt` und `occurredAtSource` im Objekt → Redebeitrag ohne
  `segmentIds`, ohne `occurredAt`; die Abschnitte bleiben `unconfirmed`.
- K21. Liste: 7 Abschnitte mit verschiedenen Zeitankern → neueste zuerst; `limit: 3, offset: 3` liefert die Plätze 4–6;
  `total` 7; `limit: 501` → 422.
- K22. `_actions`: in `preparation` und `closed` fehlt `ingest.write` in den Listen-`_actions` auch für `capture`; nach
  `MeetingClosed` fehlt `contribution.capture` an jedem Abschnitt; nach `DebateClosed` (HV `running`) sind beide da.
- K23. Rückdatierter Abschnitt (`startedAt` vor `MeetingStarted`) → 200 (Entscheidung „keine Untergrenze“); nach
  `DebateClosed` verlangt seine Übernahme einen Grund und setzt `lateEntry: true`.
- K24. Stapel mit einem 422-Fehler (Steuerzeichen) und einem 409-Fehler (geänderter Wortlaut) → 422, null Ereignisse.
- K25. Übernahme mit veraltetem `If-Match` und zugleich schon übernommenem Abschnitt → 412 (nicht 409): Reihenfolge wie
  heute.

**Dienst** (`apps/api/src/__tests__/ingest064a.test.ts`, über `req()`; Postgres-Datei getrennt):

- H1. POST als `capture` (`X-Actor`) → 200 mit `created`; GET zeigt die Abschnitte; Antworten bestehen die
  Schemaprüfung.
- H2. Wiederholung → `duplicate`; Ereigniszahl über `listEvents` (admin) unverändert.
- H3. observer und admin → 403; ohne Anmeldung → 401. Die Oberfläche ist nicht beteiligt: der Aufruf geht direkt.
- H4. Body über 262 144 Byte → 413 ohne Ereignis; 101 Abschnitte, Zusatzfeld, Steuerzeichen, ungültiges `date-time`,
  Kennung mit `/` → 422 vom Validator.
- H5. Widerspruch → 409 `application/problem+json` mit `ruleId` R-ING-01 und ohne gespeicherten Text.
- H6. Unbekannte HV → 404.
- H7. Übernahme über `POST /meetings/{id}/contributions` mit `segmentIds` → 201 mit `segmentIds`; dieselbe Übernahme
  erneut (neuer Schlüssel) → 409 R-ING-04.
- H8. Abdeckungstor: beide neuen Operationen ausgeübt, keine im Allowlist.
- H9. Postgres (`postgres-ingest064a.test.ts`): zwei gleichzeitige gleiche Stapel → ein Satz Ereignisse, beide 200; ein
  gleichzeitiger widersprechender Stapel → einer 200, einer 409; nach Neuaufbau der Projektion aus der Datenbank sind
  Abschnitte und Übernahmestatus gleich.
- H10. Zugriffslog: ein Eintrag mit `operationId` `ingestSpeechSegments` und Status, ohne Wortlaut.

**Web-API** (`http.test.ts`): beide Methoden mit Methode, Pfad über die laufende HV, Body, CSRF-Kopf; kein
`Idempotency-Key`, kein `If-Match`. `liveStore`: `listSpeechSegments` steht unter Thema `contributions`.
`demoTranscriptSample()` liefert 5 Abschnitte mit Zeitankern vor der aktuellen Zeit.

**Mutationsproben** (im Bericht mit dem Ergebnis „rot“ belegt, danach zurückgesetzt):

- M1. Inhaltsvergleich entfernt (jede bekannte Kennung gilt als `duplicate`) → K3 rot.
- M2. `ingest.write` an observer → K6 und K18 rot.
- M3. Guard „schon übernommen“ entfernt → K12 rot.
- M4. Steuerzeichenprüfung im Kern entfernt → K8 rot.
- M5. Schreiben je Abschnitt vor der Prüfung der übrigen → K4 rot.
- M6. `occurredAtSource` bei der Übernahme als `server` abgeleitet → K11 rot.
- M7. Fall `segment` in `collect` entfernt → K16 rot.
- M8. Alias reicht die Eingabe wieder unverändert weiter → K20 rot.
- M9. Kern zählt `text.length` statt Codepunkten → K8 (Emoji-Fall) rot.

## Akzeptanzkriterium

1. `pnpm contract:lint` grün ohne neue Meldung; `pnpm contract:types` ergibt den eingecheckten Stand; `check.mjs`
   (a)–(d) `ok`.
2. K1–K25, H1–H10 und die Web-API-Tests grün; M1–M9 rot belegt.
3. Die regenerierte Wahrheitstabelle entspricht dem Diff dieser Spec; `docs/legal-trace.md` enthält R-ING-01..05.
4. Jedes Beispiel in `docs/integration/transkript.md` ist gegen `pnpm --filter @hv/api dev` gelaufen; die Ausgabe steht
   im Bericht.
5. `git diff` gegen die Merge-Basis zeigt nur Dateien aus „Files allowed“.
6. `pnpm gates` (mit Postgres-Variablen wie in CI) grün, einschließlich `slice-scope` auf `claude/slice-064a-…`. Der
   Schluss der Ausgabe steht einmal im Bericht.

## Nachweise

- Ausgabe von `contract:lint` und `check.mjs` (Auszug); Typen-Diff (`git diff --stat`, Hunks der neuen Schemas).
- Wahrheitstabellen-Diff wörtlich.
- Ergebnis der Mutationsproben.
- curl-Ausgaben aus dem Leitfaden gegen den lokalen Dienst (gekürzt, ohne Zugangsdaten; es gibt keine, `X-Actor`).
- Schluss von `pnpm gates` mit Commit-Hash.
- Kein Screenshot: 064a ändert keine Oberfläche sichtbar (Screenshots in 064b).

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Fachregel, Status (Segmenttabelle, R-ING-01..05)
- [x] Vertrag, Ereignis (neue Operationen, `SegmentIngested`, additive Felder)
- [x] Persistenz, Nebenläufigkeit (neuer Ereignistyp, Idempotenz über Akteure, Rennen)
- [x] Rolle, Recht (`ingest.write`)
- [x] personenbezogene Daten (Wortlaut von Redenden)
- [x] Nachbarsystem (Partnergrenze, Leitfaden)
- [ ] Oberfläche (064b)
- [x] Dokumentation (Leitfaden)

Perspektiven: Security, Vertrag, Datenschutz · Nachweise: K1–K25, H1–H10, Mutationsproben, Leitfaden-Läufe ·
Offene Entscheidungen: E3a, E3b (Standard), E14, E16

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Warum hoch:** neues Schreibrecht, neuer Schreibendpunkt an einer Partnergrenze, Wortlaut von Redenden aus einem
  Fremdsystem, ein Idempotenzschlüssel, den ein Fremder vergibt.
- **Rechte-Diff:** eine Zelle (`capture` × `ingest.write`), ein neuer Abschnitt; keine bestehende Zelle ändert sich.
- **Bedrohungen** (Stand nach 064a im Bedrohungsmodell):
  - **T-G3-S-01** (gefälschter Ingest): teilweise; Recht nur für die angemeldete Erfassung, Akteur im Ereignis,
    Übernahme durch einen Menschen; Systemakteur offen.
  - **T-G3-T-01** (manipulierte Fremddaten): geschlossen für den Datei-Import; Vertrag und Kern prüfen gleich.
  - **T-G3-R-01** (Lieferung bestritten): teilweise; `SegmentIngested` mit Akteur und Hash-Kette; Systemakteur offen.
  - **T-G3-D-01** (Nachbar fällt aus): unverändert gedeckt; Import aus Datei, manuelle Erfassung bleibt.
  - **T-G3-D-02** (Flut): teilweise; Quote je Subjekt, R-ING-05, Idempotenz.
  - **T-G3-E-01** (Systemakteur mit zu viel Recht): Vorgabe für die Folgescheibe (Bündel nur `ingest.write`).
  - **T-G3-T-04** (neu, Anzeigeverfälschung durch Bidi-Steuerzeichen): geschlossen; 422 in Vertrag und Kern, Anzeige
    isoliert (064b).
  - **T-G3-I-06** (neu, Inhaltsbestätigungs-Orakel): heute ohne Erkenntnisgewinn (Schreiber liest ohnehin); offen für
    Systemakteure, Vorgabe Namensraum je Systemakteur.
- **Kompatibilität:** additiv. Wer `Event.type` als geschlossene Liste liest, muss den neuen Wert überspringen (Regel
  im Vertrag seit 0.3.0). Ein Rückbau von 064a nach dem ersten `SegmentIngested` macht das Protokoll für den alten Stand
  unlesbar (`EVENT_TYPES` verwirft unbekannte Typen); Rückweg: Vorwärtskorrektur, kein Zurückrollen der Version. Das
  gilt für jeden neuen Ereignistyp und steht im Bericht.
- **Invarianten:** kein Abschnitt wird geändert (R7); keine Einzelfrage ohne menschliche Übernahme; dieselbe Kennung
  ergibt höchstens ein Ereignis je HV; kein Abschnitt mit Namen im Hinweisfeld.
- **Fehlerfälle:** 409/422 schreiben nichts; `500` „Persistence outcome is unknown“: der Client wiederholt denselben
  Stapel, die Idempotenz macht das sicher (Leitfaden).
- **Betrieb:** keine neue Konfiguration, keine Migration. Signale: Zugriffslog je Operation und Status; Häufung von 409
  R-ING-01 ist ein Sicherheitssignal (Runbook 070 nimmt es auf, Folgeliste).

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. `ingest.write` nur bei `capture`: `git diff -- packages/domain/src/permissions.ts` zeigt eine Zeile.
2. Jede Grenze des Vertrags prüft auch der Kern (K8 im In-Process-Kern ohne Ajv).
3. Antworten des Ingest enthalten nie gespeicherten Wortlaut (K3, H5).
4. Der Kern kopiert nur benannte Felder (K9).
5. Kein `Idempotency-Key`-Pfad wird umgangen: `captureMeetingContribution` behält ihn unverändert; der Ingest
   deklariert ihn nicht.
6. Strom und Zugriffslog tragen keine Kennung des Senders und keinen Wortlaut (K16, H10).
7. Keine Rolle, kein Sicherheitsschema, keine Konfiguration für Systemakteure.
8. **SC-09 (Nachbarsysteme: eigener Systemakteur mit kleinstem Recht, authentifizierte Aufrufe): nein, geplant** (043c
   für das Schema, Push-Adapter nach E3b für Bündel und Anmeldung). Begründung: Eine Maschinenanmeldung gibt es heute
   nicht; `X-Actor` gilt nur mit `HV_DEMO=1`, Sitzungen brauchen OIDC und eine Person. Im Betrieb schreibt heute nur der
   Datei-Import im Browser mit der Sitzung der erfassenden Person; ein Partner testet im Demo-Modus oder später im
   Sandbox-Mandanten (065). Der Leitfaden sagt das ausdrücklich. Die Vorgaben stehen in „Partner-Anmeldung später“.
9. Projektion und Index der Abschnitte sind `Map`s (K9); kein Objekt wird mit einer Partnerkennung indiziert.

## Standards (auf Standard gebaut)

| Standard | Quelle | Was 064a daraus baut | Kosten einer späteren Änderung |
|---|---|---|---|
| Vertragsform der Abschnitte (`segmentId`, `text`, `startedAt`, `endedAt`, `speakerId` optional, `source`) | E3a (Ansprechperson Tool-Team bis 16.10.2026), ADR 0008 | Schemas, Prüfungen, Leitfaden | Formänderung: ein Vertragszyklus, 1 AStd plus Kompatibilität über zwei Zyklen (E3a) |
| Erster Adapter ist der Datei-/Zwischenablage-Import mit der Sitzung der erfassenden Person | E3b, ADR 0008 | `ingest.write` an `capture`; Adapter in 064b | Push-Adapter 1,5–3 AStd plus Leitfaden (E3b) |
| Aufbewahrung `record`, keine Löschung in der Beta | DSFA V16, E16 | `retentionClass: record` | Klasse `working` für **künftige** Abschnitte: eine Zeile im Kern plus DSFA (< 0,25 AStd). Für bereits geschriebene Abschnitte ist die Klasse in der Hash-Kette gestempelt; ändern lässt sie sich nur über einen Export in eine neue Datenbank (E16), Aufwand offen. Deshalb vor echten Daten entscheiden (verbindlicher Vermerk zu E14) |

## Offene Eigentümerfragen

Keine blockiert die Spec. Fragen 1 und 2 brauchen vor dem Bau ein ausdrückliches Go.

1. **Bau auf Standard vor der Antwort zu E3a (Go nötig).** Standard: 064a baut auf der Form aus E3a und ADR 0008, ohne
   die Ansprechperson des Tool-Teams (16.10.2026) abzuwarten, damit die Freigabe-Demo den Partnerweg zeigt. Dazu gehört
   die Pfadabweichung aus Entscheidung 1. Eine abweichende Antwort kostet die Beträge aus „Standards“. Ohne Go baut
   064a frühestens nach dem 16.10.
2. **Zuschnitt und Budget (Go nötig, Planabweichung).** 064 wird 064a (3,5 AStd) und 064b (2,5 AStd), zusammen 6
   statt 2,5 AStd, beide hoch. Die Ingest-Form wandert aus 043c in den ersten Commit von 064a; 043c behält Webhooks,
   `answer-suggestions` und das Schema für Systemakteure. Mit Go ändert der Orchestrator die Plan-Einträge 064 und 043
   (Teilungsvermerk, Lanes `contract`, `web-api`) und den Kalender.
3. **Aufbewahrung nicht übernommener Abschnitte (an DSB über E14/E16).** Standard: `record` wie übernommene, keine
   Löschung in der Beta. Alternative: `working`, damit sie später mit dem Übungsbestand fallen dürfen. Die Klasse wird beim Schreiben
   gestempelt; eine spätere Änderung erfasst bereits geschriebene Abschnitte nur über einen Export (E16). Die Frage geht
   mit der DSFA an den DSB; sie hält den Bau nicht auf, weil vor der Antwort keine echten Transkripte verarbeitet werden
   dürfen (verbindlicher Vermerk).

## Hinweise an Folgescheiben

**064b:**
- Import-Knopf nur bei `ingest.write` in den Listen-`_actions`; „Übernehmen“ nur bei `contribution.capture` in den
  Abschnitts-`_actions`.
- Die Übernahme ruft `captureMeetingContribution` (kanonisch) mit `segmentIds` und `source: transcript`, ohne
  `occurredAt`; die Erfassung schreibt sonst weiter über den Alias.
- „Beispieldatei verwenden“ nutzt `demoTranscriptSample()` aus `apps/web/src/api` (eine Quelle, 080b; keine Werte aus
  `@hv/domain` in `features/**`), nur in der Demo-Betriebsart.
- Die Liste ist neueste zuerst und blätterbar; der Dialog zeigt 409 R-ING-05 verständlich (Demo-Grenzen).

**043c:** Die Ingest-Form ist mit 064a im Vertrag; 043c ergänzt das Sicherheitsschema für Systemakteure
(Client-Credentials oder mTLS) und ändert die Operation nur additiv (`security` um das neue Schema).

**Push-Adapter (nach E3b):** übernimmt die Tabelle „Partner-Anmeldung später“; eigenes Bündel nur `ingest.write`;
`source` aus der Konfiguration; Kennungs-Namensraum je Systemakteur gegen das Inhaltsbestätigungs-Orakel (T-G3-I-06);
Wahrheitstabellen-Diff; Antwort auf SC-09.

**065:** `SegmentIngested` ist für Abonnenten nur mit Leserecht `contribution.read` zuzustellen; der Sandbox-Mandant
nutzt `TRANSCRIPT_SAMPLE`.

**070:** Häufung von 409 R-ING-01 als Sicherheitssignal im Runbook.

**051:** Wortlaut aus Abschnitten kann mit `=`, `+`, `-`, `@` beginnen; ein Tabellenexport muss das entschärfen.

## Folgelisten-Einträge, die 064a anlegt

1. Status `discarded` für nicht übernommene Abschnitte (Beifall, Moderation), wenn Feedback ihn verlangt; eigene Zeile
   in der Segmenttabelle.
2. Formatadapter für WebVTT oder den Export des Werkzeugs, sobald E3b das Werkzeug benennt (rund 0,5 AStd, 064b-Lane).
3. 051: Formel-Injektion im Tabellenexport.
4. 070: Signal „409 R-ING-01 gehäuft“.

## Bericht (nach Bau ausfüllen)

```
Slice: 064a-transkript-ingest-vertrag-kern
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

**Vertragsstufe und Typen-Diff (Auszug).**

**Wahrheitstabellen-Diff (wörtlich).**

**Mutationsproben (Ergebnis).**

**Leitfaden-Läufe (curl gegen den lokalen Dienst, gekürzt).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings
