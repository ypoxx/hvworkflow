# IST-Analyse, Systemlandschaft und Schnittstellenarchitektur

**Quellen:** Prozessschaubild „Q&A-Prozess" (16:9-Präsentationsansicht), Sprachtranskript der Projektleitung
zum bestehenden HV-Tool, mündliche Rahmenangaben. Ergänzt das Rechercheergebnis in
[`anforderungen-recherche.md`](anforderungen-recherche.md).

**Zweck:** festhalten, was heute läuft, und daraus ableiten, was das neue Tool zusätzlich können muss.
Nicht als Kritik am bestehenden Prozess — der ist geübt und funktioniert —, sondern als Delta-Liste
für die Spezifikation.

---

## 1. Gesetzte Rahmenbedingungen

| Punkt | Stand | Konsequenz |
|---|---|---|
| Aktiengattung | **Namensaktien** | Legitimation über Aktienregister-Eintragung und Umschreibungsstopp, **nicht** über Nachweisstichtag und Depotnachweis. Löschfristen für registerabgeleitete Daten separat führen. |
| Vorabfragen | **Ja**, Aktionärsvereinigungen reichen vorab ein; zuletzt ca. **200 Fragenblätter**, mehrere Fragen je Blatt | Vorab-Strecke ist real und braucht eigene Fristen-, Freigabe- und ggf. Publikationslogik. Offen: formales Regime oder faktischer Eingang (siehe Abschnitt 8). |
| Plattform | **Webbasiert** | Browser-Anwendung, keine Fat-Client-Komponenten. |
| Q&A-Katalog | ca. **1.500 Fragen** in einer Themen-Ordnerstruktur | Migrationsgegenstand; zugleich Korpus für das KI-Tool. |
| Nachbarsysteme | Transkriptions-Tool und KI-Wissensbasis-Tool, beide **inhouse**, bleiben bestehen | Das neue HV-Tool ist Integrationsknoten, nicht Alleinsystem. |
| Aktienregister | **eigene Instanz**, sensibelster Teil | Bleibt getrennt. Zugriff nur lesend, Just-in-time, nie repliziert. |
| Kernschwäche heute | Das HV-Tool **bietet keine Schnittstellen an** | Schnittstellenfähigkeit ist ein Primärziel, kein Nachrüstthema. |

---

## 2. IST-Prozess

Fünf Phasen, Schritte 0 bis 10, drei Antwortpfade.

**P1 Erfassung**
`0` Redebeitrag anmelden (Wortmeldung im Tool erfassen) → `1` Redebeitrag halten → `2` Fragenaufnahme
(Transkription und Erfassung im Q&A-Tool).

**P2 Eingangskoordination** — verantwortlich: zwei Mitarbeitende
`3` Entscheidung **„Frage vorbereitet?"**
- **Ja** → `8A` Projektleitung („Superbeantworter") → direkt abgeschlossen
- **Nein** → `4` KI-Antwortvorschlag als Grundlage für die Zuordnung

**P3 Klassifizierung und Aufteilung** — verantwortlich: ein Mitarbeitender, Leitung Kommunikation, Leitung Investor Relations
`5` Frage klassifizieren → Zuordnung zu Pfad A, B oder C.
Sonderfall **„kein Antwortbedarf"** (keine Relevanz oder bereits Teil der Tagesordnung) → Direktabschluss.

**P4 Antwortpfade**

| Pfad | Inhalt | Verantwortlich | Rechtsprüfung vor der Bühne |
|---|---|---|---|
| **A** No-Brainer | `6` „freie" Beantwortung ohne weitere Recherche | Vorstand | keine |
| **B** Fast Track | `6` Antwort über vorhandene Publikation (Verweis) | Fast-Track-Team aus Kommunikation und Legal | im Team enthalten |
| **C** Expert Track | `6` fachliche Beantwortung → `7` Legal Clearing | Segment-Expert*innen, dann Legal | ja, eigener Schritt |

**P5 Finalisierung und Ausgabe**
`8B` Finaler Check, sortieren und aufbereiten (Kommunikationsmanagement, Redenschreiber CEO)
→ `9` Antwortfassung und Dokumentation im Q&A-Tool (Kommunikation)
→ **Bühne: Frage wird verlesen**
→ `10` Antwortprüfung (Legal · FOO/GC)
→ Entscheidung **„Antwort ausreichend?"** — Ja: Frage beantwortet · Nein: **Qualitätsschleife zurück zu Schritt `5`**

---

## 3. IST-Tool — fünf Module

**1 · Wortmeldungen.** Wortmeldeliste; die Identitätsprüfung der Redner passiert **außerhalb** des Tools.
Pool aller Wortmeldungen links, rechts die Runden; Zuordnung per Drag-and-drop. Runden wechseln sich ab:
eine Runde Fragesteller, eine Runde Beantwortung. Redner aktivierbar („Start") mit laufender Redezeitmessung.
Vorab angekündigte Themen als Notiz am Redner.

**2 · Wissensdatenbank / Q&A-Katalog.** Große Themen-Ordnerstruktur, ca. 1.500 Frage-Antwort-Paare,
durchsuchbar; aus der Beantwortung heraus Sprung auf den passenden Katalogeintrag.
Ursprünglich Vorbereitungsinstrument, inzwischen auch Grundlage der KI.

**3 · Chat.** Einzel- und Gruppenchats über alle im System hinterlegten Personen, nach Bereichen aussteuerbar.
Optional, wird aber regelmäßig genutzt.

**4 · HV-Workflow — das Herzstück.** Statusmaschine; je Status sind Personen und Rechte hinterlegt,
Filterung nach Status. Erfassungsmaske mit Formatierung (Word-ähnlich). In der Bearbeitung: Frage oben,
Antwortfeld unten. Felder und Funktionen: laufende Nummer, Absender, Beantworter, Rednerzuteilung,
**Bühnenzuordnung** (Aufsichtsrat / Vorstand / CFO), **Klassifizierung** (Expert Track, Fast Track,
No-Brainer, vorbereitete Frage), Zeitstempel Erstellung und Bearbeitung, Drucken, **Verlauf** der
durchlaufenen Status, **Anmerkungen**. Weiterleitung über einen Button mit rechteabhängiger Auswahl des
Zielstatus — Admin überall hin, Expert Track nur ins juristische Clearing.
*Wunsch:* KI-Verknüpfung, die beim Statuswechsel automatisch einen Antwortvorschlag aus dem Katalog
zusammenbaut, plus die Möglichkeit, zur Frage mit der KI zu chatten.

**5 · Bühnenansicht.** Für den Vorstand. Sortierung nach Fragesteller und vor allem nach Bühnenzuordnung.
Zähler je Person: gesamt / in Bearbeitung / bereit zum Vorlesen / abgeschlossen. In der Frage: Fragesteller,
Klassifizierung, Frage, Antwort. Zwei Aktionen: **„vorgelesen, weiter"** → Status abgeschlossen, oder
**„Antwort zurückgeben"** → zurück ins Backoffice.
Ausdrückliche Anforderung der Projektleitung: **möglichst wenige Buttons**, eine Ansicht, aus der man
praktisch nicht herauskommt; es laufen nur die zugeordneten und freigegebenen Fragen ein.

---

## 4. Systemlandschaft

Vier Systeme, drei davon bleiben bestehen.

| System | Rolle | Beziehung zum HV-Tool |
|---|---|---|
| **HV-Tool** (neu zu bauen) | Fragen- und Antwort-Workflow, Wortmeldungen, Katalog, Bühnenansicht | Integrationsknoten und System of Record für den Q&A-Vorgang |
| **Transkriptions-Tool** (inhouse, bleibt) | Redebeiträge live transkribieren, protokollieren, Fragen extrahieren bzw. markieren | liefert Segmente und Fragekandidaten **in** das HV-Tool |
| **KI-Wissensbasis-Tool** (inhouse, bleibt) | Antwortvorschläge aus der Wissensbasis | wird **vom** HV-Tool aufgerufen, liefert Vorschlag mit Belegen zurück |
| **Aktienregister** (eigene Instanz) | Aktionärsdaten, Legitimation | nur lesender Just-in-time-Abruf, **kein Replikat** im HV-Tool |

---

## 5. Delta — was das neue Tool zusätzlich leisten muss

Priorisiert nach Risiko. Vollständige Begründungen im Rechercheergebnis.

### Hoch — rechtlich tragend, heute nicht abgebildet

1. **Verweigerungspfad.** Heute existiert als Nicht-Antwort nur der Sonderfall „kein Antwortbedarf →
   Direktabschluss". Nötig sind zwei getrennte, dokumentierte Pfade: (A) kein Auskunftsanspruch
   (nicht erforderlich, kein TOP-Bezug, keine Legitimation, verspätet) und (B) Auskunftsverweigerung trotz
   Anspruchs mit erzwungener Zuordnung zum gesetzlichen Grundkatalog, ausformulierter Begründung,
   Rechtsfreigabe und Notarübergabe. Ein undifferenzierter Direktabschluss ist genau die Lücke, auf die
   eine Auskunftsrüge zielt.
2. **TOP-Bezug.** Im heutigen Feldmodell nicht vorhanden. Ohne Zuordnung zum Tagesordnungspunkt ist weder
   die Erforderlichkeit prüfbar noch bestimmbar, welcher Beschluss von einem Informationsmangel betroffen
   wäre — und das Beschluss-Dossier für die Nachbereitung nicht erzeugbar.
3. **Atomisierung.** 200 Fragenblätter mit mehreren Fragen je Blatt und Redebeiträge mit 10 bis 40 Fragen
   verlangen ein Container-Modell: Blatt bzw. Redebeitrag als Container, Einzelfragen als Arbeits- und
   Nachweiseinheit, mit Restabdeckungsanzeige („welche Textpassagen sind noch keiner Frage zugeordnet").
4. **Bündelung mit Abdeckungsnachweis.** Sammelantworten müssen n:m auf Einzelfragen abbilden; der
   Clusterabschluss bleibt gesperrt, solange eine Teilfrage ohne Abdeckungsnachweis ist.
5. **Nachfragen, Widerspruch, Protokollierungsverlangen, Notarschnittstelle.** Im heutigen Prozessbild
   nicht enthalten. Nachfragen brauchen die harte Verknüpfung zur Ursprungsantwort; Widerspruch und
   Protokollierungsverlangen brauchen eigene, alarmierte Kanäle, die nie im Fragenstrom laufen.
6. **Ist-Antwort erfassen.** Rechtlich maßgeblich ist das gesprochene Wort. „Vorgelesen, weiter" setzt
   heute den Status, hält aber nicht fest, **was** gesagt wurde. Nötig: Übernahme der tatsächlich
   gegebenen Antwort aus dem Transkript und Diff gegen den freigegebenen Text.
7. **Insider-/Ad-hoc-Gate vor der Bühne.** Pfad A („freie Beantwortung durch den Vorstand") hat heute vor
   dem Verlesen keine Rechtsprüfung. Mindestens ein schnelles, protokolliertes Gate ist nötig, das eine
   kursrelevante Antwort vor dem Podium anhalten kann.
8. **Korrekturschleife mit harter Frist.** Die Qualitätsschleife „Nein → zurück zu Schritt 5" braucht eine
   Zeitgrenze: der Abstimmungsbeginn zum betroffenen TOP, nicht das Ende der Versammlung.

### Mittel — Wirksamkeit und Nachweis

9. **Append-only Vorgangshistorie** statt reiner Statusanzeige; Freigabe an die Textversion gebunden,
   nicht an das Objekt.
10. **Zwei Datenbereiche trennen:** nachweisrelevante Fakten (Fragewortlaut, erteilte Antwort, Freigaben,
    Zeitstempel) und interne Arbeitsstände (Entwürfe, Anmerkungen, Bewertungen) — mit unterschiedlicher
    Aufbewahrung und getrennten Exportpfaden. Das heutige Feld „Anmerkungen" ist beweisrechtlich heikel.
11. **Auskunftsschuldner und Sprecher trennen.** „Bühnenzuordnung" vermischt beides: auskunftspflichtig ist
    der Vorstand, vorgetragen wird ggf. durch eine andere Person.
12. **Kanalbindung.** Der Chat bleibt sinnvoll — aber alles, was eine konkrete Frage betrifft, gehört an
    den Vorgang, nicht in einen Chatverlauf. Sonst zerfällt die Nachweiskette dort, wo sie gebraucht wird.
13. **Vorab-Strecke als eigener Prozesszweig** mit eigener Fristenuhr, eigener Freigabe und
    Publikationssteuerung — heute läuft „vorbereitete Frage" nur als Klassifizierung mit.
14. **Katalog von Ordnerstruktur auf zwei Achsen umstellen:** gesetzliche TOP-Struktur (jahrgangsfest) und
    frei pflegbare Themen-Taxonomie, dazu Volltext- und Semantiksuche mit deutscher Kompositazerlegung.
    Eine Ordnerhierarchie über 1.500 Einträge ist unter Zeitdruck nicht navigierbar.

### Beibehalten — funktioniert und ist zu erhalten

- Rundenmodell der Wortmeldeliste (Fragesteller-Runde / Beantwortungs-Runde im Wechsel) mit Drag-and-drop,
  Redezeitmessung und Vorab-Themennotiz.
- Rechteabhängige Zielstatus-Auswahl beim Weiterleiten.
- Die drei Antwortpfade als risikoadaptive Freigabetiefe — genau das, was die Recherche empfiehlt.
- Die Bühnenansicht als reduzierte, kioskartige Ansicht mit sehr wenigen Aktionen.
- Verlauf, Nummerierung, Zeitstempel, Druckfunktion.

---

## 6. Schnittstellenarchitektur

Leitprinzip: **ein Kanonikalmodell im Kern, jedes Fremdsystem über einen eigenen Adapter.**
Kein Fremdformat erreicht die Domäne. Der Kern kennt weder das Transkriptionsformat noch das
Antwortformat der KI noch das Schema des Aktienregisters.

### 6.1 Grundzusagen

- **OpenAPI 3.1 als Single Source of Truth** für alle synchronen Schnittstellen; Clients und Doku werden
  generiert, nicht handgepflegt.
- **Ereignisstrom als Rückgrat:** `GET /v1/events?after=<sequence>` liefert alle fachlichen Ereignisse mit
  lückenloser Sequenznummer. Ein Konsument erkennt einen Ausfall selbst und lädt nach. Das ist der
  eigentliche Unterschied zu „ein paar REST-Endpunkte anbieten".
- **Webhooks** ergänzend, HMAC-signiert, mit Zeitstempel gegen Replay, at-least-once — Empfänger sind
  idempotent.
- **Idempotenz-Schlüssel** auf allen schreibenden Endpunkten; clientseitig erzeugte IDs.
- **Optimistisches Sperren** über ETag / If-Match.
- **Fehler** einheitlich als Problem Details (RFC 9457).
- **Authentifizierung:** OIDC gegen den Konzern-IdP für Menschen, Client Credentials plus mTLS für Systeme.
- **Versionierung:** `/v1` mit Rückwärtskompatibilität über mindestens zwei HV-Zyklen, Deprecation-Header,
  keine Breaking Changes zwischen Januar und Juli.
- **Sandbox-Mandant** mit synthetischen Daten, damit die Nachbarsysteme ganzjährig gegen das HV-Tool
  testen können.

### 6.2 Transkriptions-Tool → HV-Tool (eingehend)

Das Transkriptionstool ist Produzent, das HV-Tool Konsument.

- **Segment-Ingest:** `POST /v1/ingest/speech-segments`
  Nutzlast je Segment: `speech_id`, `speaker_ref`, `t_start` / `t_end` als Stream-Timecode **und** UTC,
  `text`, `confidence`, optional `question_candidates[]` mit `offset_start`, `offset_end`, `text`,
  `confidence`.
- **Segmente sind unveränderlich.** Korrekturen kommen als neue Version mit Bezug auf die Vorversion;
  beide bleiben erhalten.
- **Fragekandidaten landen im Zustand `unconfirmed`** und werden erst durch menschliche Bestätigung zu
  Fragen. Damit ist die Extraktion Arbeitsmittel, nicht Rechtsquelle.
- **Timecode-Anker** an jeder Frage — die einzige belastbare Brücke zwischen Aufzeichnung und erfasster
  Frage, wenn später über den Wortlaut gestritten wird.
- **Rückkanal:** `POST /v1/callbacks/segment-confirmed`, damit das Transkriptionstool weiß, welche
  Kandidaten übernommen wurden, und daraus lernen kann.
- Alternativ zum Polling ein SSE-Abonnement für den Live-Betrieb.

### 6.3 HV-Tool → KI-Wissensbasis (ausgehend, bidirektional)

Zwei Interaktionen, wie von der Projektleitung gewünscht.

- **Vorschlag beim Statuswechsel:** `POST /v1/answer-suggestions` mit `question_id`, Fragewortlaut,
  TOP, Klassifizierung, Pfad, Kontext. Antwort synchron mit hartem Zeitbudget und Circuit Breaker, sonst
  asynchron über `POST /v1/callbacks/answer-suggestion`.
- **Pflichtfelder in der Antwort:** `sources[]` mit Fundstelle, `model`, `model_version`,
  `prompt_template_version`, `confidence`. **Ein Vorschlag ohne Belege wird verworfen, nicht angezeigt.**
- **Dialog zur Frage:** eine an die `question_id` gebundene Session; jeder Turn wird am Vorgang
  protokolliert, damit später rekonstruierbar bleibt, woher eine Formulierung stammt.
- **Statusfortschreibung durch die KI ist technisch ausgeschlossen.** Der Vorschlag ist gekennzeichneter
  Entwurf, nie ein Freigabeschritt.
- **Korpus-Grenze:** die KI indexiert nur freigegebene und veröffentlichte Quellen. Insiderrelevante
  Bestände liegen in einem getrennten Index ohne Modellzugriff.

### 6.4 Aktienregister → HV-Tool (eingehend, nur lesend)

- **Just-in-time-Abruf:** `GET /v1/shareholders/{reference}` — Legitimationsstatus, Vollmachtsumfang,
  vertretene Stimmen. **Kein Replikat, kein nächtlicher Abzug.**
- Im HV-Tool wird nur ein **Pseudonym** geführt; der Klarname wird nur für berechtigte Rollen aufgelöst,
  und jeder Lookup wird protokolliert.
- Namensaktien: der Legitimationsdatensatz referenziert Aktienregisterstand und Umschreibungsstopp.
- Fällt das Register aus, wird **nie zurückgewiesen** — die Frage geht in eine Klärungs-Queue.

### 6.5 Weitere Ausgänge

Publikation auf die IR-Website, Export ins DMS/Archiv, Notarpaket, Abstimmungs- und Präsenzsystem
(lesend). Für den Austausch mit Anmeldestelle und Intermediären die europäisch standardisierten
Nachrichtenformate nutzen statt proprietärer Dateiformate — das ist die wirksamste Lock-in-Bremse an
der teuersten Schnittstelle.

---

## 7. Dokumentations- und Codekonzept

Ziel der Projektleitung: eine Plattform, die agentisch weiterentwickelt werden kann, ohne dass
Nachvollziehbarkeit verloren geht. Das verlangt Dokumentation, die **beide** Leserkreise bedient.

### Für die Maschine

- **`AGENTS.md` im Repository-Wurzelverzeichnis** als verbindlicher Vertrag: Architekturinvarianten,
  der nicht-konfigurierbare Kern, Namenskonventionen, Build- und Testkommandos, und ausdrücklich:
  was ohne Rechtsfreigabe **nicht** geändert werden darf (Audit-Trail, Freigabezwang, Unlöschbarkeit
  von Fragen, Aufbewahrungssperren).
- **Rechtsregeln als getestete Regeltabellen**, nicht als verstreute Bedingungen im Code: Fristen,
  Verweigerungsgründe, Statusübergänge, Rechte je Status. Jede Regel trägt eine **Regel-ID** und einen
  **Legal Trace** — die Fundstelle, aus der sie folgt. Damit ist die Frage „warum verhält sich das
  System so?" maschinell beantwortbar und die Prüfung durch Recht wird zur Durchsicht einer Tabelle
  statt einer Codelesung.
- **OpenAPI-Spezifikation** als generierte, versionierte Artefakte; Vertragstests gegen die Nachbarsysteme.

### Für den Menschen

- **Architecture Decision Records** (`docs/adr/`) für jede tragende Entscheidung: Kontext, Entscheidung,
  Konsequenz — und, wo vorhanden, der rechtliche Grund. Eine Entscheidung ohne festgehaltenen Grund wird
  im Folgejahr rückgängig gemacht, weil niemand mehr weiß, warum sie so getroffen wurde.
- **Domänenglossar Deutsch ↔ Englisch** als Pflichtartefakt. Die Domäne ist deutsch-juristisch, der Code
  ist englisch; ohne festgelegte Übersetzung driftet die Benennung binnen Wochen und der Code wird für
  die Rechtsabteilung unlesbar. Beispiele: Wortmeldung → `requestToSpeak`, Auskunftsverweigerung →
  `refusalToAnswer`, Bühnenzuordnung → `stageAssignment`, Vorabfrage → `advanceQuestion`,
  Nachfrage → `followUpQuestion`, Protokollierungsverlangen → `minutesRecordingRequest`.
- **Englische Kommentare am Codeabschnitt**, mit einer Regel: Kommentare erklären **warum**, nicht was.
  Bei rechtlich motiviertem Code wird die Regel-ID referenziert, sodass Code und Rechtsgrund verbunden
  bleiben.
- **Runbook** für den HV-Tag: Degradationsstufen, Break-Glass, Papierpfad, Eskalationskette.

---

## 8. Offene Fragen

1. **Vorabfragen — formales Regime oder faktischer Eingang?** Ist die Vorabeinreichung in der Einberufung
   vorgegeben (mit der Folge, dass Fragen und Antworten vor der Versammlung allen Aktionären zugänglich zu
   machen sind), oder schicken die Vereinigungen ihre Kataloge lediglich aus Praxisgründen vorab? Die
   Antwort ändert Fristen, Veröffentlichungspflichten und die Nutzbarkeit des Website-Verweigerungsgrundes
   grundlegend.
2. **Schritt 10 — prüft Legal die *tatsächlich gegebene* Antwort nach dem Verlesen?** So liest sich das
   Schaubild. Falls ja: existiert vor der Bühne ein Gate, das eine kursrelevante Antwort auf Pfad A
   anhalten kann?
3. **TOP-Bezug** — wird der heute irgendwo geführt, und sei es außerhalb des Tools?
4. **Verweigerung** — gibt es heute einen Fall „Frage wird bewusst nicht beantwortet", und wer entscheidet
   ihn? Oder deckt „kein Antwortbedarf" beides ab?
5. **Nachbarsysteme** — was bieten Transkriptions-Tool und KI-Tool technisch heute an (REST, Datenbank,
   Dateiaustausch, gar nichts), wer betreibt sie, und wie ist deren Release-Zyklus?
6. **Aktienregister** — gibt es eine abrufbare Schnittstelle, oder ist der Abgleich heute manuell?
7. **Volumen** — Fragenblätter zu Einzelfragen, Live-Fragen, Zahl der Redner, Dauer der Generaldebatte,
   Nachfragequote. Auch grobe Werte helfen für die Kapazitätsauslegung.
8. **Notar und Widerspruch** — wie läuft die Übergabe an den Notar heute, und wo werden Widersprüche
   erfasst?
9. **Rollenkürzel** — wofür steht „FOO" in der Antwortprüfung (Schritt 10)?
