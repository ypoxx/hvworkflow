# Scheibe 048 — Weiterleiten an einen anderen Fachbereich (Vertrag, Kern, Dienst)

**Status:** angenommen (04.10.2026, gemergt als 7405efb, PR #142) · gebaut (04.10.2026, Bau `85bbd75` auf Vertrag `fb5cbde`; Review ohne blocker/major, Befunde in `789c745`, `pnpm gates` grün auf `789c745`) · Spec: spec (03.10.2026; gelesen auf `3556d64`: 043a, 040b, 044a, 044b und 045 gemergt, Vertrag 0.4.2; Lesebefund zu `888d629` eingearbeitet: 0 blocker, 3 major, 11 minor, 6 nit, Abschnitt „Review findings“; erster Teil der geteilten Planzeile 048, Zuschnitt im Abschnitt „Teilung und Zuschnitt“; zweite Scheibe der Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041, Register E57; auf Standard gebaut, E5 offen). **Go des Eigentümers zum Bau am 04.10.2026 erteilt** (Bau auf den Standards dieser Spec; E5 bleibt im Register offen, Standard „beides bauen“). Ursprünglich: Bau erst nach Antwort auf E5 oder ausdrücklichem Go.
**Risikoklasse:** hoch · 3,0 AStd (Spanne 2,5–3,75; Plan 048: mittel · 1,5 AStd für alle drei Themen der Planzeile; Begründung in „Warum hoch“ und „Aufwand“) · Plan 048: 05.11.2026 (W6), tatsächlich direkt nach 045 und nach der Antwort auf E5 · Lanes: contract (erster Commit, Architekt); core; service; web-api (nur `http.ts` und `liveStore.ts`); web-shell (nur Aktions- und Ereignisschlüssel); web-history (nur die Zusammenfassung des neuen Ereignisses und die Bezeichnungen der Gründe); docs-legal (Kopfvermerk Rechtekonzept); docs-sicherheit; docs-datenschutz (nur Zeile V4); docs (Glossar)
**Bedrohungsmodell:** berührt T-G1-E-01 (Schreibvorgang ohne Oberfläche), T-G1-I-01 (Leserkreis wächst um die Zieleinheit, Umfang in „Warum hoch“), T-G1-I-09 (Strom: Frage verlässt den Lesebereich); neuer Missbrauchsfall MF-14 (Abschnitt „Missbrauchsfälle“)
**Rolle:** architect für den Vertragsschritt (erster Commit, vor jedem Code, AGENTS.md R6); danach implementierer-backend. Review in frischem Kontext mit den Perspektiven **Security** (Einheitsbindung, neues Recht, Strom, Antwort nach dem Verlassen des eigenen Bereichs), **Datenschutz** (geschlossener Grundcode, erweiterter Leserkreis, keine Person als Ziel) und **Vertrag** (neue Operation, Validator und Kern im Gleichlauf, Abdeckungstor). Lesebefund der Spec vor dem Bau erledigt (Klasse hoch); nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** neu R-TRANS-17 (Weiterleiten an einen anderen Fachbereich), R-GUARD-15 (Ziel ist ein anderer Fachbereich). Angewandt: R-GUARD-03 (nur Textpfade), R-TRANS-00, R-PERM-01, R-PERM-02, R-PERM-03 (Einheitsbindung), R-CLAIM-01 (nur Abgrenzung: Claim bleibt), R-IDEM-01 (nur Abgrenzung). Dazu AGENTS.md R2, R3, R4, R5, R6, R7, R8, R10, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 048 (Zeile 685–690), Eintrag 054 (Zeile 759–765, Dialog „Weiterleiten“), Eintrag 069 (Zeile 868), §3 Zeile 198 (Bedeutung „Weiterleiten“), §11 Zeile 1303 und 1330 (Freigabe-Demo)
- Register E4 (kein personenbezogener Freitext ohne Schalter), E5 (offen; Standard: zusätzlich Weiterleiten an eine andere Einheit, Ereignis- und Operationsnamen von `submitForReview` unverändert), E21 (Feld `language` reserviert, Zielscheibe 055), E57
- ADR 0009 (`pii`-Umschlag, Crypto-Shredding), ADR 0015 (Vertragsversionierung); Vertrag `openapi.yaml:3667-3668` („New payload fields outside `pii` are free of personal data from slice 026“)
- `docs/feedback/2026-10-fragenpaket-woche-1.md` Frage 6; `docs/feedback/2026-09-quickview-projektleitung.md` Rückmeldung 32; `docs/feedback/2026-09-zielbild-oberflaeche.md` Z9
- `docs/anforderungen-recherche.md:81, 95, 220, 221, 446, 449`; `docs/ist-analyse-und-schnittstellen.md:82, 148, 167`
- `docs/rollen-und-rechtekonzept.md` Zeile 11, 62, 87, 119–122; `docs/glossar.md` Zeile 23, 50
- Spec 043a (Teilungstabelle Zeile 043b, „Regel-ids für Folgescheiben“, Folgelisten-Eintrag 1); Spec 044a und 044b (Muster Kern plus Dienst, Längen in Code-Punkten); Spec 040a (admin als ausdrückliche Liste); Spec 040b (Fachbereiche als Stammdaten des Jahrgangs); Spec 021b (Koordination); Spec 026 (Rollenzuordnung mit Einheit)
- Bedrohungsmodell T-G1-E-01, T-G1-I-01, T-G1-I-09, MF-01; DSFA-Vorentwurf Zeile V4, V9

**Depends on:** 045 (gemergt `c0db7f5`), 044b (gemergt `799cca5`, Vertrag 0.4.2), 040b (Fachbereiche je Jahrgang), 026 (Rollenzuordnung mit `unitId`), 021b, 021c. **Nicht** 043b: Dieser Vertragsteil ist nie geschrieben worden und steht nicht in der Kette E57; 048 bringt seine Vertragsänderung selbst mit (Planabweichung vom Zuschnitt aus 043a, Befund)
**Perspektive:** Security, Datenschutz, Vertrag · **Glossar: neue Begriffe:** ja („An anderen Fachbereich weiterleiten“ mit `question.forward`, `forwardQuestion`, `QuestionForwarded`; Grund der Weiterleitung mit vier Codes)

## Warum hoch

Der Plan führt 048 als „mittel“. Die Leitplanken (§4) nennen **jede Änderung an Rechten** und an **personenbezogenen
Daten** als Hoch-Auslöser, und bei unklarer Zuordnung gilt hoch. 048 löst das aus:

- **Neues Recht** `question.forward` in `ROLE_PERMISSIONS` für zwei Rollen, mit Wahrheitstabellen-Diff (unten).
- **Leserkreis wächst.** Wer weiterleitet, macht die Frage für die Fachkräfte der Zieleinheit lesbar (Einheitsbindung,
  R-PERM-03). Die Recherche nennt genau das eine Offenlegung (`docs/anforderungen-recherche.md:95`). **Was die Fachkräfte der
  Zieleinheit neu lesen** (Halter von `question.read` und `history.read` im gebundenen Bündel `expert`):
  - den Rückgabegrund `returnReason` der Frage, falls einer steht (Freitext aus R-TRANS-06);
  - die vollständige Historie der Frage (`getQuestionHistory`): die Gründe aller `QuestionReturned`, die Codes früherer
    `QuestionForwarded`, die `QuestionClaimed`-Ereignisse der alten Einheit (Akteur-id; `personId` maskiert) und alle übrigen
    Ereignisse der Frage;
  - alle Antwortversionen mit `createdBy` (Akteur-id und Rolle);
  - einen laufenden Claim der alten Einheit (`claim.actorId`, Entscheidung 4: der Claim bleibt);
  - einen offenen Verweigerungsvorschlag: Art (`answerKind`), Grund (`refusalGroundId`, im Ereignis der Schnappschuss mit Titel
    und Formulierungsbaustein) und Wortlaut für die Bühne (`text`), **nicht** die Begründung (`refusalJustification`: nur für
    Halter von `question.refuse.*`, in jedem Ereignis-Lesepfad entfernt, 044a §6; Test 8b).
- **Neue Zeile, neues Ereignis, neue Operation**: Fachregel, Ereignis und Vertrag ändern sich zugleich.

Eine Hochstufung ist kein Herabstufungsfall; das Tor `downgrade-check` ist nicht berührt. Herabstufen auf mittel darf nur
der Eigentümer (Eigentümerfrage 4).

## Teilung und Zuschnitt

Die Planzeile 048 (mittel, 1,5 AStd) bündelt drei Themen ohne fachlichen Zusammenhang: Weiterleiten, Auskunftsschuldner
und Inhaltssprache. Für die Freigabe-Demo zählt nur das Weiterleiten: 054 baut darauf den Dialog „Weiterleiten“ (Einheit und
Grund), 053 bietet es der Koordination an. Auskunftsschuldner und Sprache braucht keine Scheibe der Kette E57, und für beide
stehen Eigentümerfragen offen, deren Antwort den Datenschutz berührt. Deshalb:

| Teil | Thema | Inhalt | Vertrag | Klasse · AStd | Wann |
|---|---|---|---|---|---|
| **048** (diese Spec) | Weiterleiten an einen anderen Fachbereich, vollständig | Recht, Zeile R-TRANS-17, Guard R-GUARD-15, Ereignis `QuestionForwarded` mit geschlossenem Grundcode, Operation `forwardQuestion` im Kern, im HTTP-Client und im Live-Puffer, Dienstroute, HTTP- und Postgres-Nachweis, Zusammenfassung in der Historie, Wahrheitstabelle, Regelregister | erster Commit: neue Operation, Recht, Ereignistyp, Enum des Grunds; 0.4.3 | hoch · 3,0 | nach E5 oder Go, vor 053 und 054 |
| **048b** (Skizze unten) | Auskunftsschuldner | Vertragszeile `Classification.accountableSeatId` und Antwortfeld `Question.accountableSeatId`; Projektion mit Standard = Bühnenplatz; Prüfung gegen die Bühnenplätze des Jahrgangs | eigene Patch-Stufe | mittel · 1,0–1,5 (hoch, falls eine Person statt einer Funktion gewählt wird) | nach 048; nicht in der Kette E57 nötig; frühestens nach Antwort auf Eigentümerfrage 6 |
| Inhaltssprache | Feld `language` | **nicht in 048.** Register E21 ordnet das reservierte Feld 055 zu (Antwortformat); dort hängt die Sprache an der Antwortversion, deren Text sie beschreibt | mit 055 | — | Eigentümerfrage 7 |
| Dialog | „Weiterleiten“ mit Einheit und Grund | 054 (Fokusansicht), 053 (Steuerung) | — | — | Kette E57 |

**Warum kein Schnitt Kern / Dienst wie bei 044.** 044 war 4,25 AStd groß; 048 ist 3,0 AStd, also innerhalb eines
Agententags. Ein Schnitt hätte einen Zwischenstand, in dem der Vertrag eine Operation verspricht, die der Dienst mit 404
beantwortet, und bräuchte einen Allowlist-Eintrag mit Ablaufdatum. 054 braucht die Route für den Lauf `e2e-http`. Die
Dienstseite ist eine Route und ihre Tests; ein eigener Review dafür kostet mehr, als er an Risiko senkt.

**Warum der Auskunftsschuldner heraus.** Das Feld hat in der Kette keinen Abnehmer, und seine Bedeutung („genau eine Person
oder Funktion“) ist offen. Nennt es eine Person, ist es ein neues personenbezogenes Feld mit Leserkreis, DSFA-Zeile und
Klasse hoch. Getrennt bleibt das Weiterleiten von dieser Entscheidung unabhängig.

## Befund (Ist-Stand, gelesen auf `3556d64`)

- **Vertrag 0.4.2**, 69 Operationen (`operationId`). Keine Operation, kein Schema und kein Feld für Weiterleiten,
  Auskunftsschuldner oder Inhaltssprache. Das Enum `Action` (`openapi.yaml:2545`) kennt `question.forward` nicht, das Enum
  `Event.type` (`openapi.yaml:3675-3710`) kennt `QuestionForwarded` nicht. `allowlist.json`: zwei Einträge, beide `slice` 040.
- **Invariante des Umschlags** (`openapi.yaml:3667-3668`): Neue Nutzlastfelder außerhalb von `pii` sind seit 026 frei von
  Personendaten. Ein Freitextgrund außerhalb von `pii` bräche sie; im Log ließe er sich wegen Hash-Kette und R7 nie mehr löschen,
  auch nicht durch Crypto-Shredding (ADR 0009). Daraus folgt Entscheidung 4: ein geschlossener Code, kein Freitext.
- **043b fehlt.** Spec 043a (Teilungstabelle, Zeile 043b) sah `forward` mit `question.forward` und `QuestionForwarded`,
  `accountable` und `language` in einem eigenen Vertragsteil „vor dem Bau von 048“ vor. 043b ist nie geschrieben worden und
  steht nicht in der Kette E57. Dass 048 die Operation selbst in den Vertrag schreibt, ist eine **Planabweichung vom Zuschnitt
  aus 043a** (043b trägt `forward` nicht mehr); sie gehört dem Orchestrator (Hinweise an den Orchestrator), nicht 043a Regel 1,
  die nur Erweiterungen bestehender Anfrageschemas regelt. AGENTS.md R6 gilt unverändert: Vertrag im ersten Commit, Route und
  Tests im selben PR, kein Allowlist-Eintrag.
- **Regel-ids.** R-TRANS-13 ist die Rechtsfreigabe in `in_review` (`transitions.ts:725`), R-TRANS-14 die Rechtsfreigabe einer
  Podiumsfrage (`:743`), R-TRANS-15/16 die Verweigerung (`:760`, `:786`). Plan Zeile 198 und 685 sowie Register E5 nennen
  für das Weiterleiten noch R-TRANS-13; das ist veraltet (043a, Folgelisten-Eintrag 1). Nach 043a vergibt jede Folgespec die
  nächste freie Nummer: **R-TRANS-17**. Guards: R-GUARD-01 bis -09 und -11 bis -14 belegt, R-GUARD-10 für 059 reserviert;
  nächste freie Nummer **R-GUARD-15**. Der Plan nennt R-TRANS-17 noch für 069 (Zeile 868); 069 nimmt beim Schreiben ihrer
  Spec die dann nächste freie Nummer.
- **Zuweisen** (R-TRANS-02, `transitions.ts:371`): `question.assign` aus `classified` und `assigned` nach `assigned`, Guard
  R-GUARD-03 (nur Textpfade). Halter: `coordination`, `approver`, `admin` (`permissions.ts`). Ein Umhängen aus `assigned` geht
  also schon, aber ohne Grund; aus `answer_drafted` und `in_review` geht es nicht.
- **`QuestionAssigned` setzt den Status fest auf `assigned`** (`state.ts:406-412`). Für ein Weiterleiten aus
  `answer_drafted` oder `in_review` taugt das Ereignis nicht: Es würfe die Frage zurück. Ein eigenes Ereignis ist nötig.
- **Einheitsbindung.** `expert` ist ein `unitBound`-Bündel (`permissions.ts:65`). Für einen Akteur mit `assignmentScoped`
  verweigert `can()` jede Aktion auf einer Frage einer anderen Einheit mit R-PERM-03 (`api.ts:224`); `transition()` meldet
  dann 404 (`api.ts:790`). Eine gebundene Fachkraft **ohne** Einheit (eine Zuordnung `expert` ohne `unitId` nimmt
  `assignRole` an, `unitId` ist optional) liest gar nichts: `hasPermission` verweigert ihr `question.read` mit R-PERM-03
  (`permissions.ts:160`), also endet jede Aktion in `transition()` mit 404, auch auf einer Frage ohne Fachbereich (Test 8c).
  Im Demo-Rollenwechsel ist `expert` nicht gebunden und sieht alle Fragen, wie heute beim Antwortentwurf.
  *Orchestrator-Vermerk 04.10.2026 (nach Scheibe 054, #149 `cc97005`):* Der Satz „`expert` ist im Demo-Rollenwechsel nicht
  gebunden“ gilt seit 054 nicht mehr; die Demo-Fachkraft ist dort an Finanzen gebunden (Entscheidung 2a der Spec 054) und
  sieht nur Fragen ihres Fachbereichs. Der Spec-Text oben bleibt als Stand des Baus von 048 stehen.
- **Prüfreihenfolge in `transition()`** (`api.ts:787-799`): `requireQuestionFor` (404 für unbekannte id bzw. ohne Lese- und
  Operationsrecht) → 404 für eine gebundene Fachkraft, die die Frage nicht lesen darf → 403 aus `can()` ohne Frage → `If-Match`
  → 409 aus Tabelle und Guards.
- **Antwort nach dem Schreiben.** `transition()` antwortet nach dem Anhängen mit `viewQuestion(requireQuestion(id))`
  (`api.ts:809`), ohne die Lesbarkeit erneut zu prüfen. Eine Wiederholung mit demselben `Idempotency-Key` geht über
  `authorizeReplay` (`api.ts:588-605`); dort prüft der Kern für ein gebundenes `expert` die aktuelle Lesbarkeit und meldet
  sonst 404.
- **Claim.** `claimQuestion` setzt eine weiche Sperre für zehn Minuten (`api.ts:1257-1265`); sie sperrt nur einen weiteren
  Claim (409 R-CLAIM-01), keinen erlaubten Schreibvorgang. Die Projektion hält sie in `q.claim` (`state.ts:373`), die Ansicht
  zeigt einen laufenden Claim mit `actorId` (`api.ts:461-464`).
- **Strom.** `EVENT_TOPICS`, `EVENT_SUBJECTS` (`stream.ts:39, 89`) sind über `EventType` typisiert; `SCOPE_EXIT_EVENTS`
  (`stream.ts:129`) führt `QuestionAssigned` als Ereignis, nach dem eine Frage den Lesebereich verlassen kann.
  `envelope.ts:5-17` führt die bekannten Ereignistypen (`EVENT_TYPES`); ein unbekannter Typ besteht das Laden nicht.
- **Kennzahl je Fachbereich** (`indicators.ts:81`, Feld `openQuestionsByUnit`) liest `q.unitId` aus der Projektion; sie folgt
  einem neuen Ereignis, das `unitId` setzt, ohne Codeänderung. `apps/api/src/metrics/catalog.json` nennt als Quelle von
  `hv_open_questions` nur „QuestionAssigned“ (Text, Folgeliste).
- **Oberfläche.** `ACTION_KEYS` (`apps/web/src/i18n/labels.ts:52`) ist `Record<Permission, TKey>`, die Ereignisnamen
  (`labels.ts:~121`) `Record<EventType, TKey>`; `WRITE_METHODS` in `liveStore.ts:86-96` ist `satisfies Record<WriteMethodName,
  true>`. Ein neues Recht, ein neuer Ereignistyp und eine neue Schreibmethode erzwingen also Einträge. Keine Ansicht rendert
  `_actions` generisch; ohne 053/054 erscheint keine Schaltfläche. Paritätstest: 553 Schlüssel je Sprache
  (`parity.test.ts:165`).
- **Vertragstests.** `contract.test.ts:100-116` zählt die Operationen mit Pflicht-`If-Match` und 428 auf;
  `contract-043a.test.ts:241-243` prüft die Kopfparameter je Operation.
- **Begriffe.** Seit 020 heißt `question.submit_review` in der Oberfläche „Weiterleiten“ (`shell.de.ts:185`, Glossar Zeile 50).
  Das Rechtekonzept verwendet `question.forward` in §2.1 (Zeile 62) und §2.4 (Zeile 119–122) für das allgemeine Weiterleiten
  mit rechteabhängigem Zielstatus aus der Ist-Analyse (`ist-analyse-und-schnittstellen.md:82`); im Code sind das
  `question.assign`, `question.submit_review` und `question.return`. Zeile 11 nennt `question.assign` der Administration
  „Weiterleiten“. 048 gibt `question.forward` die engere Bedeutung „an einen anderen Fachbereich“.
- **Aufbewahrung.** Im Code tragen `QuestionAssigned` und `QuestionReturned` die Standardklasse `working`; die DSFA-Zeile V4
  („Klassifizieren und zuweisen“) nennt `record`. Der Widerspruch besteht schon heute; er ist eine Frage an den DSB
  (Eigentümerfrage 9), keine Entscheidung dieser Scheibe.
- **Recherche.** `:220` (MUSS): „Mehrfachzuweisung mit einem federführenden Bereich, jedes Umrouten mit Historie“; `:95`
  (MUSS): Need-to-know-Routing; `:81` (SOLL) und `:449` (MUSS): Auskunftsschuldner als Funktion (Vorstand, AR-Vorsitz,
  Abschlussprüfer); `:446` (MUSS): RACI je Prozessschritt mit genau einem Accountable.
- **Seed** enthält kein Weiterleiten; er bleibt unverändert.

## Ziel und Entscheidungen vor Bau

Eine Frage in Beantwortung (`assigned`, `answer_drafted`, `in_review`) lässt sich mit einem Pflichtgrund aus einer festen
Liste an einen anderen Fachbereich weiterleiten. Status, Antwortversionen, Rechtsfreigabe, Freigabe und ein laufender Claim
bleiben unberührt; nur der zuständige Fachbereich wechselt, und das Protokoll hält fest, wer, wann, von wo, wohin und aus
welchem Grund (Code). Weiterleiten dürfen die Koordination und die Fachkräfte des aktuell zuständigen Fachbereichs. **Auf
Standard gebaut:** E5 ist offen (Eigentümerfrage 1); der Bau beginnt erst nach der Antwort oder einem ausdrücklichen Go.

### 1. Recht (`packages/domain/src/types.ts`, `permissions.ts`)

- `PERMISSIONS` erhält `question.forward` **unmittelbar nach `question.assign`**. Die Stelle bestimmt die Spaltenreihenfolge
  der Wahrheitstabelle.
- `ROLE_PERMISSIONS`: `coordination` und `expert` (im `unitBound`-Bündel) erhalten `question.forward`. **Keine andere
  Rolle**: nicht admin (ausdrückliche Liste seit 040a; die Administration leitet mit `question.assign` und `question.return`
  weiter, nimmt aber keinen Arbeitsschritt), nicht `approver`, nicht `legal`, nicht `moderation`, `capture`, `podium`,
  `observer` (Eigentümerfrage 3).
- „Fachkraft des aktuellen Fachbereichs“ ist **keine neue Regel**, sondern die bestehende Einheitsbindung in `can()`
  (R-PERM-03, `api.ts:224`): Eine gebundene Fachkraft erreicht eine Frage einer anderen Einheit gar nicht (404). Kein
  Rollenname außerhalb von `ROLE_PERMISSIONS` (AGENTS.md R4).
- `rules.ts`: nur der Beschreibungstext von R-PERM-01, falls er die Schreibrechte aufzählt; R-CLAIM-01 bleibt unverändert
  (der Claim bleibt, Entscheidung 4).

### 2. Übergangszeile R-TRANS-17 (`transitions.ts`)

| Regel | Aktion | von | nach | Guards |
|---|---|---|---|---|
| **R-TRANS-17** | `question.forward` | `assigned`, `answer_drafted`, `in_review` | unverändert (`to: (q) => q.status`) | R-GUARD-03 (`isTextTrack`), R-GUARD-15 |

- `description`: „Forward to another answering unit (An anderen Fachbereich weiterleiten) with a reason code. Status, answer
  versions, legal clearance, approval and claim stay; only the unit changes.“
- `legalRef`: `source: 'Recherche'`; `citation` nennt `docs/anforderungen-recherche.md:220` („jedes Umrouten mit Historie“)
  und `docs/ist-analyse-und-schnittstellen.md:82` (Weiterleitung über einen Button). **Teilweise:** keine Mehrfachzuweisung,
  kein federführender Bereich, genau eine Einheit (`unitId`). **Ableitung (Spec 048):** Status bleibt; nicht aus
  `approved`, `staged` oder `delivered`; Grund als geschlossener Code. Abschluss: „Auf Standard gebaut (E5 offen).“
  `docVersion: null`, `docHash: null`, `verified: false` (Ehrlichkeitsregel `rules.ts:5-16`).

**Entscheidung „Status bleibt“ (auf Standard gebaut, Eigentümerfrage 2).** Begründung:
- Weiterleiten ändert die Zuständigkeit, nicht den Arbeitsstand. Für Nacharbeit gibt es die Rückgabe (R-TRANS-06).
- Ein Weiterleiten kann eine Frage nie aus der Rechtsprüfung holen und nie eine Rechtsfreigabe oder Freigabe aufheben. Damit
  entsteht kein neuer Weg um das Rechtstor (R-GUARD-07, R-GUARD-08) und keine neue Wechselwirkung mit Vier-Augen.
- Die Kennzahl „Fragen in Rechtsprüfung > 10 min“ läuft unverändert weiter (`inReviewSince` bleibt).
- Die andere Möglichkeit (`in_review → answer_drafted`, die neue Einheit arbeitet nach) kostet rund 0,25 AStd und ändert die
  Wahrheitstabelle nicht (Eigentümerfrage 2).

**Nicht aus `approved`, `staged`, `delivered`** (Plan): Eine freigegebene Antwort gehört keinem Fachbereich mehr; wer sie
ändern will, gibt sie zurück. Nicht aus `captured` oder `classified`: Dort ist `question.assign` der Weg (R-TRANS-02).

**Überschneidung mit R-TRANS-02 aus `assigned`.** Die Koordination kann aus `assigned` zuweisen (ohne Grund) oder weiterleiten
(mit Grund). Beides bleibt; der Unterschied steht im Protokoll. 053 entscheidet, welche Aktion die Steuerung anbietet.

### 3. Guard R-GUARD-15 `forwardTargetIsOtherUnit`

- Ohne Nutzlast (`_actions`, Wahrheitstabelle) wahr: Der Guard ist erfüllbar, sobald der Jahrgang einen zweiten Fachbereich
  hat (Seed: neun).
- Mit Nutzlast: `typeof payload.unitId === 'string' && payload.unitId !== q.unitId`. Eine Frage ohne `unitId` (Fast Track ohne
  Zuweisung, R-TRANS-03 aus `classified`) kann an jeden Fachbereich weitergeleitet werden, aber nur von der Koordination: eine
  gebundene Fachkraft erreicht sie nicht (Befund, Test 8c).
- `legalRef`: `source: 'Prozess'`; „Ableitung (Spec 048): ein Weiterleiten an denselben Fachbereich ändert nichts und schriebe
  nur einen Grund ohne Wirkung ins Protokoll. Nicht belegt.“ `verified: false`.
- Bekannte Grenze: Ein Jahrgang mit genau einem Fachbereich zeigt `question.forward` in `_actions`, jeder Versuch endet mit 409
  R-GUARD-15. Hingenommen (Standards).

### 4. Ereignis `QuestionForwarded` und Grundcode (`events.ts`, `types.ts`, `envelope.ts`, `state.ts`)

- **Grund als geschlossener Code** (Lesebefund M1, Entscheidung des Orchestrators: der engste Standard). `FORWARD_REASON_CODES =
  ['wrong_unit', 'expertise_elsewhere', 'capacity', 'other'] as const` in `types.ts`, Typ `ForwardReasonCode`. Bezeichnungen
  (i18n, Abschnitt 8):

  | Code | Deutsch | Englisch |
  |---|---|---|
  | `wrong_unit` | Falscher Fachbereich | Wrong answering unit |
  | `expertise_elsewhere` | Fachwissen liegt in einem anderen Fachbereich | Expertise lies with another answering unit |
  | `capacity` | Auslastung | Workload |
  | `other` | Sonstiges | Other |

  **Kein Freitext in 048**, auch nicht bei `other`. Damit bleibt die Invariante `openapi.yaml:3667-3668` erhalten, E4 und
  ADR 0009 sind nicht berührt, und es entsteht kein neuer personenbezogener Inhalt im Log. Freitext zusätzlich ist
  Eigentümerfrage 5.
- Typ: `Base<'QuestionForwarded', { unitId: string; fromUnitId?: string; reasonCode: ForwardReasonCode }>`. `fromUnitId` fehlt,
  wenn die Frage keinen Fachbereich hatte. Neu in der Union `DomainEvent` und in `EVENT_TYPES` (`envelope.ts`).
- Aufbewahrungsklasse: Standard `working`, wie `QuestionAssigned` und `QuestionReturned` im Code. Die DSFA nennt für V4
  `record`; das klärt der DSB (Eigentümerfrage 9), nicht diese Scheibe.
- **Reduzierer:** `q.unitId = payload.unitId`; `touch(q, e.at)`. **Nichts sonst:** Status, `answers`, `approval`,
  `legalClearance`, `legalClearerIds`, `returnReason`, `seatId`, `stagePosition` **und `claim`** bleiben. `refreshCounts`
  verschiebt `counts.byUnit` von selbst.
- **Warum der Claim bleibt** (Lesebefund M2): Er ist eine weiche Sperre, sperrt keinen erlaubten Schreibvorgang (nur einen
  weiteren Claim, R-CLAIM-01) und läuft nach zehn Minuten ab. Ihn beim Weiterleiten zu löschen, hieße eine Wirkung über eine
  fremde Handlung zu erzeugen, etwa auf den Claim einer Juristin in `in_review`. Die Zieleinheit kann sofort entwerfen; sie
  kann erst nach Ablauf selbst beanspruchen (Test 11).
- **Der Code steht nur im Ereignis**, nicht in der Projektion, nicht in `returnReason`, nicht in der Suche, nicht auf der
  Bühne, nicht in Zählern. Wer ihn liest: Halter von `history.read` über `getQuestionHistory` (für eine gebundene Fachkraft
  nur, solange die Frage in ihrer Einheit liegt) und Halter von `event.read` über `listEvents` und `/stream`. Keine Maskierung
  nötig: kein Personenbezug.

### 5. Operation `forwardQuestion` (`api.ts`, `types.ts`)

- `HvApi.forwardQuestion(id: string, input: ForwardRequest, opts?: WriteOptions): Promise<Question>`; Typ
  `ForwardRequest = { unitId: string; reasonCode: ForwardReasonCode }` in `types.ts` (Vertrag `ForwardRequest`, geschlossen).
- **Prüfreihenfolge** (Vorbild `assignQuestion` `api.ts:1366`):
  1. 422 aus dem Kern, ohne Ereignis: `unitId` keine Zeichenkette, leer oder länger als 128 Code-Punkte (`codePointLength`,
     044b); `reasonCode` nicht in `FORWARD_REASON_CODES`.
  2. 422, wenn `unitId` kein Fachbereich des Jahrgangs ist (Stammdaten, für jeden Angemeldeten lesbar; die Meldung nennt die
     id wie bei `assignQuestion`).
  3. `transition(id, 'question.forward', opts, { unitId }, build)`, Reihenfolge wie im Befund: Wiederholung mit gleichem
     Schlüssel → `requireQuestionFor` (404) → 404 für eine gebundene Fachkraft, die die Frage nicht lesen darf → 403
     R-PERM-01 → `If-Match` (428, 422, 412) → 409 aus Tabelle und Guards (R-TRANS-00, R-GUARD-03, R-GUARD-15).
- `build` schreibt genau ein `QuestionForwarded` mit `unitId`, `fromUnitId` (nur, wenn `q.unitId` gesetzt ist) und
  `reasonCode`. Den Zielstatus liest der Reduzierer nicht aus dem Ereignis: Er bleibt, die Tabelle sagt es (R5).
- **Antwort nach dem Weiterleiten aus dem eigenen Bereich** (gebundene Fachkraft): 200 mit der Ansicht der Frage, wie jede
  Schreibantwort; `_actions` ist leer, weil `can()` nun R-PERM-03 meldet. Neue Inhalte erfährt der Akteur nicht: Er hat die
  Frage einen Augenblick vorher gelesen, neu ist nur der von ihm selbst gewählte Fachbereich. Ein folgendes `getQuestion` ist
  404, die Liste enthält die Frage nicht mehr. **Eine Wiederholung mit demselben `Idempotency-Key` ist 404** (`authorizeReplay`
  prüft die aktuelle Lesbarkeit); das Ereignis entsteht kein zweites Mal (Test 9). 054 behandelt 404 nach einem Netzfehler
  beim Weiterleiten als „weitergeleitet oder nicht mehr sichtbar“.
- **Entfernen des Zielfachbereichs und Wiederholung mit 422 (Codex P2 auf #141; berichtigt nach dem Review, Entscheidung des
  Orchestrators 04.10.2026):** Solange eine Frage auf den Zielfachbereich zeigt, lässt er sich nicht aus den Stammdaten entfernen:
  `replaceMeetingUnits` antwortet 409 R-ADM-02 (`api.ts` ~888, Test 9b, erster Fall). Die Wiederholung mit 422 ist trotzdem
  herstellbar, über ein erneutes Weiterleiten und danach das Entfernen: (1) Koordination leitet fin → ar mit Schlüssel K1 weiter,
  (2) ar → hr mit K2, (3) die Administration entfernt `unit-ar` (nichts zeigt mehr darauf, erfolgreich), (4) die Wiederholung von
  K1 antwortet 422 „Unit unit-ar does not exist.“, ohne Ereignis. **Angenommen und benannt:** Die Prüfung des Fachbereichs
  (Schritt 2) steht vor der Wiederholungsprüfung, gleich wie bei `assignQuestion`, und der Vertragstext beschreibt den Fall
  schon. Test 9b, zweiter Fall, hält dieses Verhalten fest. Die Reihenfolge Wiederholung vor Fachbereichsprüfung (für
  Weiterleiten und Zuweisen zusammen) steht auf der Folgeliste.
- `operationPermission` und `legacyEventType` in `api.ts` bleiben unverändert: Neue Ereignisse tragen `commandId`, die
  Wiederholung findet sie über `commandOperation`.

### 6. Strom (`stream.ts`)

- `EVENT_TOPICS.QuestionForwarded = ['meeting', 'questions', 'stage']` (wie `QuestionAssigned`; `counts.byUnit` ändert sich).
- `EVENT_SUBJECTS.QuestionForwarded = questionStatus`.
- `SCOPE_EXIT_EVENTS` erhält `QuestionForwarded`: Nach dem Weiterleiten verlässt die Frage den Lesebereich der alten Einheit.
  Ein Nachholen nach Wiederverbindung (Catch-up, M3 aus 035a), das ein solches Ereignis überspannt, liefert dem Leser keine
  Einzelereignisse nach, sondern setzt zurück (`reset`), damit der Client neu lädt. Ohne den Eintrag hielte eine gebundene
  Fachkraft der alten Einheit im Puffer einen veralteten Stand der Frage (Test 13).

### 7. Dienst (`apps/api/src/app.ts`)

- `app.post('/v1/questions/:questionId/forwards', guarded('forwardQuestion'), …)` → `domain.forwardQuestion(id,
  getValidatedBody<ForwardRequest>(c), writeOptions(c))` → `questionResult`. Platz: nach der Route `assignQuestion`. Kein
  Rollenname, keine Statuslogik in der Route.
- Kein Allowlist-Eintrag: Route und Routentest kommen im selben PR; das Abdeckungstor verlangt die Ausübung von
  `forwardQuestion` ab dem Commit der Route.
- Zugriffslog unverändert (acht Schlüssel, 033a): Ein abgewiesenes Weiterleiten erscheint als Zeile mit `operationId`
  `forwardQuestion`, `status` 409/403/404/422 und `seq` `null`; die Regel-id steht nur im Problem-Body (Standard aus 044b).

### 8. Oberfläche (nur, was die Typprüfung erzwingt, und die Historie)

- `ACTION_KEYS['question.forward'] = 'action.question.forward'`: DE „An anderen Fachbereich weiterleiten“, EN „Forward to
  another answering unit“. Bewusst nicht „Weiterleiten“ allein: Das bleibt nach E5 der nächste Schritt
  (`question.submit_review`, Z9).
- Ereignisname `event.QuestionForwarded`: DE „An anderen Fachbereich weitergeleitet“, EN „Forwarded to another answering unit“.
- Bezeichnungen der Codes: `forward.reason.wrong_unit`, `forward.reason.expertise_elsewhere`, `forward.reason.capacity`,
  `forward.reason.other` (Texte in der Tabelle oben) in `history.de.ts`/`history.en.ts`, Zuordnung als
  `Record<ForwardReasonCode, TKey>` in `labels.ts` (054 nutzt dieselbe Zuordnung im Dialog).
- `eventSummary.ts`, Fall `QuestionForwarded`: mit `fromUnitId` der neue Schlüssel `history.payload.unitChange` (DE
  „Fachbereich: {from} → {to}“, EN „Answering unit: {from} → {to}“), ohne `fromUnitId` der bestehende
  `history.payload.unit`; dazu die übersetzte Bezeichnung des Codes über den neuen Schlüssel `history.payload.forwardReason`
  (DE „Grund: {reason}“, EN „Reason: {reason}“; nicht `history.payload.reason`, das „Begründung“ sagt, Hauswort der
  Verweigerung; Nachprüfung Minor 2). Ein
  unbekannter Code (künftige Vertragsstufe) erscheint unverändert als Code, nie als Absturz.
- `http.ts`: `forwardQuestion` → `write('post', '/questions/{questionId}/forwards', { params, body: input, write })`.
  `liveStore.ts`: `forwardQuestion: true` in `WRITE_METHODS`.
- Paritätstest 553 → **561** (acht Schlüssel je Sprache: Aktion, Ereignis, `unitChange`, `forwardReason`, vier Codes). Keine Schaltfläche,
  kein Dialog, keine neue Ansicht (053, 054).

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

**Abschnitt „Role × Status × Action“** (`packages/domain/policy-truth-table.md`): neue Spalte `q.forward` zwischen
`q.assign` und `answer.draft`. Neue Kopfzeile:

```
| Role | Status | q.capture | q.claim | q.classify | q.assign | q.forward | answer.draft | q.submit_review | q.approve | q.legal.clear | q.refuse.propose | q.refuse.approve | q.return | q.stage | q.deliver | q.close | q.withdraw | q.merge | q.read | q.read.delivered |
```

Genau sechs der 198 Zeilen erhalten in der neuen Spalte ein ✓; alle anderen 192 Zeilen ein `·`. **Keine bestehende Zelle
ändert sich.**

```
| coordination | assigned | · | · | · | ✓ | ✓ | · | · | · | · | ✓ | · | · | · | · | · | · | · | ✓ | · |
| coordination | answer_drafted | · | · | · | · | ✓ | · | · | · | · | ✓ | · | · | · | · | · | · | · | ✓ | · |
| coordination | in_review | · | · | · | · | ✓ | · | · | · | · | ✓ | · | · | · | · | · | · | · | ✓ | · |
| expert | assigned | · | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
| expert | answer_drafted | · | ✓ | · | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | ✓ | · |
| expert | in_review | · | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
```

- Die Zeilen „(podium)“ derselben Status bleiben `·` (R-GUARD-03).
- `admin`, `approver`, `legal`, `moderation`, `capture`, `podium`, `observer`: `·` in jeder Zeile.
- `coordination` und `expert` in `captured`, `classified`, `approved`, `staged`, `delivered` und den terminalen Status: `·`.
- Die Tabelle nimmt einen ungebundenen Akteur (`{ id: 'x', role }`). Die Einheitsbindung zeigt sie nicht; sie steht in Test 8.

**Unverändert:** „Role × Leserecht“, „Role × Agenda“, „Role × Identität und Rollenverwaltung“, „Role × Wortmeldung, Erfassung
und Demo“, „Role × Administration“, „Role × Verweigerung“ (feste Spaltenlisten).

**Regelregister** (`docs/legal-trace.md`): zwei neue Zeilen R-GUARD-15 und R-TRANS-17; die Zeile R-PERM-01 nur, falls ihr
Text angepasst wird (Entscheidung 1).

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6)

Additiv, **eine neue Operation**; kein bestehendes Anfrageschema wird erweitert oder verengt, kein Feld wird Pflicht.
Planabweichung vom Zuschnitt aus 043a (Befund), nicht 043a Regel 1.

- **Version:** nächste freie Patch-Stufe beim Merge (heute 0.4.3; ein additiver Teil des 0.4-Zyklus hebt die Patch-Stufe).
  `info.version`, `packages/contract/package.json`, Abschnitt `## [0.4.3]` in `CHANGELOG.md` mit `### Added` und dem Vermerk
  „auf Standard gebaut (E5 offen)“.
- **Pfad** `POST /questions/{questionId}/forwards`, `operationId: forwardQuestion`, `tags: [questions]`, `summary`: „Forward a
  question to another answering unit (An anderen Fachbereich weiterleiten)“. Parameter wie `assignQuestion`:
  `IdempotencyKey`, `CsrfToken`, `IfMatchRequired`. Antworten wie `assignQuestion` (200 `QuestionUpdated`, 401, 403, 404, 408,
  409, 412, 413, 422, 428, 429, 500, 503).
- **Schema `ForwardReasonCode`:** `type: string`, `enum: [wrong_unit, expertise_elsewhere, capacity, other]`, Beschreibung je
  Wert; ausdrücklich: kein Freitext, keine Personendaten.
- **Schema `ForwardRequest`:** `type: object`, `additionalProperties: false`, `required: [unitId, reasonCode]`, `unitId: { type:
  string, minLength: 1, maxLength: 128 }`, `reasonCode: { $ref: ForwardReasonCode }`.
- **Beschreibung der Operation:** Status, Antwortversionen, Rechtsfreigabe, Freigabe und Claim bleiben; nur der Fachbereich
  wechselt. 409: R-TRANS-00 (nur aus `assigned`, `answer_drafted`, `in_review`), R-GUARD-03 (nur Textpfade), R-GUARD-15
  (Ziel ist der aktuelle Fachbereich). 422: Form, Länge und unbekannter Code (Validator und Kern), unbekannter Fachbereich
  (Kern, auch bei einer Wiederholung nach Entfernen des Fachbereichs). 404 auch für eine Fachkraft, deren Fachbereich die Frage
  nicht hält; nach einem Weiterleiten aus dem eigenen Fachbereich ist eine Wiederholung mit demselben `Idempotency-Key` 404.
- **`Action`-Enum:** `question.forward` unmittelbar nach `question.assign`.
- **`Event.type`-Enum:** `QuestionForwarded` nach `QuestionAssigned`. Die Nutzlast `{ unitId, fromUnitId?, reasonCode }` ist
  ohne Personendaten, ungemaskt in `EventRead`, nie in `Question`.
- **Gebundenes Nutzlast-Schema (Nachprüfung Minor 1, Datenschutz; nie Folgeliste):** neues Schema
  `QuestionForwardedPayload` mit `additionalProperties: false`, `required: [unitId, reasonCode]`, `fromUnitId` optional,
  `reasonCode` → `ForwardReasonCode`; in `EventRead` per `if/then` an `type: QuestionForwarded` gebunden, nach dem Muster der
  bestehenden Bindungen je Ereignisart (openapi.yaml ~3588-3615). So ist „kein Freitext“ auch auf dem Lesepfad Vertrag,
  nicht nur Prosa. H1 prüft ein gelesenes `QuestionForwarded` gegen den Vertrag; Test 2 prüft, dass die Nutzlast genau die
  Schlüssel `unitId`, `fromUnitId`, `reasonCode` trägt.
- **Typen:** `pnpm contract:types` regeneriert `packages/contract/src/types.ts`; ein zweiter Lauf ergibt keinen Diff.
- **Tore:** `pnpm contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`, (c) mit `0.4.2 -> 0.4.3`. Die Versionszeilen in
  `contract.test.ts:90` und `takt-019-contract.test.ts:8` ziehen nach; `forwardQuestion` kommt in die `If-Match`-Liste
  (`contract.test.ts:100-106`), dazu eine Kopfprüfung `['Idempotency-Key', 'If-Match', 'X-CSRF-Token']` wie
  `contract-043a.test.ts:241-243`.
- **Rücknahme nach dem Merge** ist teuer: Eine Operation oder einen Enum-Wert zu streichen, ist eine brechende
  Vertragsänderung (0.5.0, ADR 0015, rund +0,5 AStd), und `QuestionForwarded` bleibt für immer in `EVENT_TYPES`, weil
  gespeicherte Ereignisse laden müssen (R7). Deshalb beginnt der Bau erst nach E5 oder ausdrücklichem Go.
- Ist beim Baustart schon eine andere 0.4.x-Stufe gemergt, nimmt dieser Schritt die nächste.

## Nicht-Ziele

- Kein Dialog, keine Schaltfläche, keine Ansicht (054 Fokusansicht, 053 Steuerung). Kein Screenshot.
- Kein Freitext zum Grund (Eigentümerfrage 5); kein `pii`-Teil im neuen Ereignis.
- Kein Auskunftsschuldner (048b), keine Inhaltssprache (055, E21).
- Keine Umbenennung von `submitForReview`, `QuestionSubmittedForReview` oder `question.submit_review` (E5, Standard).
- Kein Weiterleiten an eine Person oder Kollegin (E5 fragt danach; Zuweisung an Personen ist Recherche `:221`, nicht Teil
  dieser Scheibe); keine Mehrfachzuweisung, kein federführender Bereich.
- Keine Änderung am Claim, keine Begrenzung der Weiterleitungen je Frage (Folgeliste), keine Benachrichtigung der Zieleinheit
  (085).
- Keine Änderung an R-TRANS-02, an anderen Zeilen oder Guards, an Maskierung, Zugriffslog, Kennzahlenkatalog, Seed,
  `assignRole`, Persistenzschicht oder Migrationen.
- Keine Attributregel für Vertraulichkeit (047).

## Files allowed

Vertrag (erster Commit, Architekt):

- `packages/contract/openapi.yaml` (nur Pfad forwards, Schemas ForwardRequest, ForwardReasonCode und QuestionForwardedPayload, deren `if/then`-Bindung in `EventRead`, Action-Eintrag, Event.type-Eintrag, info.version)
- `packages/contract/src/types.ts` (nur regeneriert)
- `packages/contract/CHANGELOG.md` (nur Abschnitt 0.4.3)
- `packages/contract/package.json` (nur Version)

Kern:

- `packages/domain/src/types.ts` (nur PERMISSIONS, FORWARD_REASON_CODES, ForwardReasonCode und ForwardRequest)
- `packages/domain/src/permissions.ts` (nur coordination und expert)
- `packages/domain/src/transitions.ts` (nur R-TRANS-17 und R-GUARD-15)
- `packages/domain/src/rules.ts` (nur der Beschreibungstext von R-PERM-01)
- `packages/domain/src/events.ts` (nur QuestionForwarded)
- `packages/domain/src/envelope.ts` (nur EVENT_TYPES)
- `packages/domain/src/state.ts` (nur der Fall QuestionForwarded)
- `packages/domain/src/stream.ts` (nur EVENT_TOPICS, EVENT_SUBJECTS, SCOPE_EXIT_EVENTS)
- `packages/domain/src/api.ts` (nur HvApi.forwardQuestion und ihre Umsetzung)
- `packages/domain/policy-truth-table.md` (generiert)
- `docs/legal-trace.md` (generiert)
- `packages/domain/src/__tests__/forward048.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur Eintrag R-GUARD-15 in GUARD_SCENARIOS)
- `packages/domain/src/__tests__/stream035.test.ts` (nur QuestionForwarded in den Erwartungen zu EVENT_TOPICS, EVENT_SUBJECTS und SCOPE_EXIT_EVENTS)
- `packages/domain/src/__tests__/api.test.ts` (**Scope-Befund des Baus, 04.10.2026, vom Orchestrator freigegeben (Nachtrag):** nur die Erwartung „coordination holds exactly …“ um `question.forward` ergänzt; die Spec nannte die Datei nicht, obwohl Entscheidung 1 diese Erwartung zwingend ändert; 044a hatte sie für dieselbe Erwartung genannt)

Dienst:

- `apps/api/src/app.ts` (nur eine Route und der Typimport ForwardRequest)
- `apps/api/src/__tests__/forward048.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/postgres-forward048.test.ts` (neu, mit Postgres)
- `apps/api/src/__tests__/contract.test.ts` (nur Versionszeile, forwardQuestion in der If-Match-Liste und eine Kopfprüfung)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (Versionszeile und, Nachtrag des Orchestrators 04.10.2026, die Zahl der Operationen 69 → 70 samt Kommentar; der Vertragsschritt erzwingt sie)

Oberfläche (nur Typzwang und Historie):

- `apps/web/src/api/http.ts`
- `apps/web/src/api/http.test.ts`
- `apps/web/src/api/liveStore.ts` (nur WRITE_METHODS)
- `apps/web/src/i18n/labels.ts` (nur ACTION_KEYS, Ereignisname und Zuordnung der Grundcodes)
- `apps/web/src/i18n/shell.de.ts`
- `apps/web/src/i18n/shell.en.ts`
- `apps/web/src/i18n/history.de.ts`
- `apps/web/src/i18n/history.en.ts`
- `apps/web/src/i18n/parity.test.ts` (nur 553 → 561)
- `apps/web/src/features/history/eventSummary.ts`
- `apps/web/src/features/history/eventSummary.test.ts`

Dokumente:

- `docs/rollen-und-rechtekonzept.md` (nur ein Kopfvermerk „Scheibe 048“ nach dem Vermerk zu 044a)
- `docs/glossar.md` (nur Zeile „Weiterleiten“, eine neue Zeile „An anderen Fachbereich weiterleiten“ und eine Zeile „Grund der Weiterleitung“)
- `docs/sicherheit/bedrohungsmodell.md` (nur Zeile 048 in „Weitere Scheiben mit Sicherheitsbezug“ und neuer Missbrauchsfall MF-14)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V4: Weiterleiten mit Grundcode und erweitertem Leserkreis, Hinweis auf die offene Aufbewahrungsklasse)
- `docs/folgeliste.md` (nur die Einträge aus „Hinweise an den Orchestrator“ und nicht blockierende Befunde des Baus)
- `docs/slices/048-weiterleiten-fachbereich.md` (diese Spec: Bericht, Review findings)
- `docs/produktplan-beta.md` (nur durch den Orchestrator mit dem Merge: Stand-Zeile)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/contract/allowlist.json`, `packages/contract/scripts/**`, `packages/domain/src/seed.ts`,
`packages/domain/src/indicators.ts`, `packages/domain/src/refusalGrounds.ts`, `apps/api/src/metrics/**`,
`apps/api/src/observability/**`, `apps/api/src/persistence/**`, `apps/api/migrations/**`, `apps/api/src/validate.ts`,
`apps/web/src/features/**` außer der History-Zusammenfassung, `apps/web/e2e/**`, `.github/workflows/**`, `scripts/**`,
`docs/adr/**`. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“.

## Vor dem Bau prüfen

1. **E5 beantwortet oder ausdrückliches Go des Eigentümers** (erfüllt: Go am 04.10.2026). Ohne beides: nicht beginnen (Rücknahme nach dem Merge ist
   brechend, Vertragsschritt). Lautet die Antwort „nur zum nächsten Schritt“, entfällt diese Scheibe; der Architekt legt das
   im Register ab.
2. 045 gemergt (`c0db7f5`) und Vertrag 0.4.2; `PERMISSIONS` enthält `question.forward` nicht; R-TRANS-17 und R-GUARD-15 sind
   frei. Sonst: anhalten, nächste freie Nummer nehmen und melden.
3. **Gebundene Fachkraft im Test.** Im Kern wie `person-roles026.test.ts:166`: admin ruft `assignRole({ subjectId, role:
   'expert', unitId })`, danach handelt der Test als `{ id: subjectId, role: 'expert' }`; der Kern löst die Zuordnung auf
   (`assignmentScoped`, Einheit). Für die Fachkraft ohne Einheit dasselbe ohne `unitId` (Test 8c; `assignRole` nimmt das schon
   heute an, keine Änderung nötig). Über HTTP dieselbe Zuordnung über die Route der Rollenzuordnung und eine Subject-id, die im
   Seed nicht vorkommt. Fehlt der Weg: Befund, der Fall bleibt im Kern belegt.
4. `eventSummary.ts` hat einen `default`-Zweig? Dann erzwingt die Typprüfung den Fall nicht; Test W1 belegt ihn trotzdem.
5. Weichen Zeilenangaben ab: melden, nicht raten.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/forward048.test.ts`; Seed mit injizierter Uhr; Koordination `coo48`; Fachkräfte über
`assignRole` gebunden an `unit-fin`, `unit-hr`, `unit-esg` und eine ohne Einheit; Marke `RUECKGABE48X` im Rückgabegrund,
`BEGRUENDUNG48X` in der Begründung einer Verweigerung):

1. **Rechte als Daten.** `question.forward` steht direkt nach `question.assign`; die Halter, aus `ROLE_PERMISSIONS`
   berechnet, sind genau `coordination` und `expert`; die Liste von admin ist unverändert.
2. **R-TRANS-17 je Ausgangsstatus.** Aus `assigned`, `answer_drafted` und `in_review` (dort mit Rechtsfreigabe der letzten
   Version): Status gleich, `unitId` neu, `answers`, `approval`, `legalClearance`, `returnReason`, `seatId` und `claim`
   unverändert; genau ein Ereignis `QuestionForwarded` mit `fromUnitId`, `unitId` und `reasonCode`, ohne `pii`. Ohne
   vorherigen Fachbereich fehlt `fromUnitId`.
3. **R-TRANS-00.** Aus `captured`, `classified`, `approved`, `staged`, `delivered`, `closed`, `withdrawn`, `merged`: 409
   R-TRANS-00, kein Ereignis.
4. **R-GUARD-15.** Ziel = aktueller Fachbereich: 409 R-GUARD-15, kein Ereignis. `_actions` enthält `question.forward` trotzdem
   (ohne Nutzlast erfüllbar).
5. **R-GUARD-03.** Eine Podiumsfrage in `assigned` (über ein direkt angehängtes Ereignis konstruiert): 409 R-GUARD-03.
6. **422 ohne Ereignis.** Unbekannter Fachbereich; `reasonCode` fehlt, unbekannt (`'misc'`), kein String; `unitId` leer oder 129
   Code-Punkte; jedes der vier Codes gelingt.
7. **Rechte.** `moderation`, `capture`, `legal`, `approver`, admin: 403 R-PERM-01; `podium`, `observer`: 404. Kein Ereignis.
8. **Einheitsbindung und neuer Leserkreis.**
   - (a) Gebundene Fachkraft `unit-fin` leitet eine `unit-fin`-Frage an `unit-hr`: 200, `_actions` leer; danach
     `getQuestion` 404 und `listQuestions` ohne die Frage; die Fachkraft `unit-hr` sieht sie mit `question.forward` in
     `_actions`. Die Fachkraft `unit-esg` auf derselben Frage: 404, kein Ereignis. Eine zuvor nach `answer_drafted`
     zurückgegebene Frage: die Fachkraft `unit-hr` liest nach dem Weiterleiten `returnReason` mit `RUECKGABE48X` und in der
     Historie das `QuestionReturned` mit diesem Grund (benannter erweiterter Leserkreis).
   - (b) Recht schlägt auf einer `unit-fin`-Frage eine Verweigerung mit Begründung `BEGRUENDUNG48X` vor (`in_review`); die
     Koordination leitet an `unit-hr` weiter. Die Fachkraft `unit-hr` sieht `answerKind`, `refusalGroundId` und `text` der
     Version, aber `refusalJustification` fehlt in `answers`, und `BEGRUENDUNG48X` steht nirgends in Ansicht, Liste oder
     `getQuestionHistory` (auch kein `pii`).
   - (c) Gebundene Fachkraft **ohne** Einheit auf einer Frage ohne Fachbereich (Fast Track, Entwurf aus `classified`, ohne
     Zuweisung): Weiterleiten 404, kein Ereignis. Keine Änderung an `assignRole` nötig.
9. **Idempotenz.** Koordination wiederholt mit gleichem Schlüssel: gleiche Antwort, ein Ereignis. Die gebundene Fachkraft aus
   Test 8a wiederholt nach dem Weiterleiten: 404, weiterhin genau ein Ereignis. **9b:** Die Administration versucht, den
   Zielfachbereich nach dem Weiterleiten aus den Stammdaten zu entfernen: 409 R-ADM-02, kein Ereignis; die Wiederholung der
   Koordination liefert danach das gespeicherte Ergebnis (Codex P2 auf #141).
10. **If-Match.** Ohne: 428; veraltet: 412; kein Ereignis.
11. **Claim bleibt.** Fachkraft A (`unit-fin`) hält einen Claim; die Koordination leitet in `assigned` weiter: `claim` steht
    unverändert in Projektion und Ansicht; die Fachkraft `unit-hr` kann sofort entwerfen (kein Schreibvorgang gesperrt), ihr
    eigener Claim ist bis zum Ablauf 409 R-CLAIM-01 und danach erfolgreich (Uhr vorgestellt). Dasselbe für einen Claim von
    `legal` in `in_review`: er übersteht das Weiterleiten.
12. **Zähler.** `counts.byUnit` verschiebt sich um eins; `computeIndicators(...).openQuestionsByUnit` folgt; eine Frage in
    `in_review` zählt weiter in der Rechtsprüfungskennzahl.
13. **Strom.** `SCOPE_EXIT_EVENTS` enthält `QuestionForwarded`; ein Abonnent als gebundene Fachkraft `unit-fin` erhält ein
    Änderungssignal ohne Inhalt; ein Nachholen über das Weiterleiten hinweg setzt für ihn zurück; ein Abonnent mit `event.read`
    erhält das Ereignis mit `reasonCode`; `EVENT_SUBJECTS` nennt Frage und Jahrgang.
14. **Lesepfade des Codes.** `getQuestionHistory` als Koordination enthält `QuestionForwarded` mit `reasonCode`; die Ansicht der
    Frage und `getStage` enthalten keinen `reasonCode`.
15. **Umschlag.** Ein Log mit `QuestionForwarded` besteht Stempeln und Laden mit Kettenprüfung; ein Typ mit Tippfehler nicht.
16. **Tabelle.** `transitions.test.ts` belegt R-TRANS-17 (Zeilentest) und R-GUARD-15 (Szenario erfüllt/verletzt); Snapshot der
    Wahrheitstabelle und des Regelregisters nach dem Diff oben; `stream035.test.ts` mit `QuestionForwarded` in den drei Maps.

**Dienst ohne Postgres** (`apps/api/src/__tests__/forward048.test.ts`; `createApp({ demoEnabled: true, clock, accessLog })`,
Seed über `POST /v1/demo/seed`, alle Aufrufe über `req()` mit Antwortprüfung gegen den Vertrag):

- **H1** 200 als Koordination; neue `ETag`; `/v1/events` als admin zeigt `QuestionForwarded` mit `reasonCode`.
- **H2** 401 ohne Akteur.
- **H3** 403 R-PERM-01 als `approver`, `legal`, admin; 404 als `podium` und für eine unbekannte id.
- **H4** 422 des Validators: `reasonCode` fehlt, unbekannt, Freitext statt Code; `unitId` fehlt; zusätzliches Feld (etwa
  `reason`). 422 des Kerns: unbekannter Fachbereich. Reihenfolge wie 044b §2: Validator vor Recht.
- **H5** 409 R-TRANS-00 aus `approved`; 409 R-GUARD-15.
- **H6** 428 ohne `If-Match`, 412 veraltet.
- **H7** Wiederholung mit gleichem Schlüssel: gleiche Antwort, ein Ereignis.
- **H8** Gebundene Fachkraft über Rollenzuordnung (Vor-dem-Bau-Punkt 3): Weiterleiten aus dem eigenen Bereich 200 mit leeren
  `_actions`, danach `GET` 404; Fachkraft einer dritten Einheit 404.
- **H9** Zugriffslog eines abgewiesenen Weiterleitens: acht Schlüssel, `operationId` `forwardQuestion`, `status` 409, `seq`
  `null`.

**Dienst mit Postgres** (`apps/api/src/__tests__/postgres-forward048.test.ts`; ohne `TEST_DATABASE_URL` übersprungen, in CI
ausgeführt):

- **P1** Weiterleiten übersteht Neustart mit Kettenprüfung; nach dem Laden stimmen `unitId`, Status und `claim`.
- **P2** Ein abgewiesenes Weiterleiten schreibt keine Zeile und genau eine Zugriffslogzeile mit `seq` `null`.

**Vertrag:** `contract.test.ts` mit `forwardQuestion` in der `If-Match`-Liste und der Kopfprüfung (Vertragsschritt).

**Oberfläche:**

- **W1** `eventSummary.test.ts`: `QuestionForwarded` mit `fromUnitId` zeigt beide Fachbereichsnamen und die Bezeichnung des
  Codes, ohne `fromUnitId` nur das Ziel; ein unbekannter Code erscheint als Code; DE und EN.
- **W2** `http.test.ts`: `forwardQuestion` sendet `POST /questions/{id}/forwards` mit Body, `If-Match` und `Idempotency-Key`.

**Mutationsproben** (je einmal lokal rot belegen, dann zurücknehmen): R-GUARD-15 aus der Zeile entfernen (Test 4 rot);
`to: 'assigned'` statt `q.status` (Test 2 rot); `delete q.claim` im Reduzierer (Test 11 rot); `QuestionForwarded` aus
`SCOPE_EXIT_EVENTS` entfernen (Test 13 rot); `question.forward` an admin (Test 1 rot).

## Akzeptanzkriterium

1. Tests 1–16, H1–H9, P1–P2, W1–W2 und die Vertragsprüfung vor der Änderung rot (Ausgabe im Bericht), danach grün; die fünf
   Mutationsproben rot belegt.
2. `policy-truth-table.md` weicht vom Ist genau um den Diff oben ab (neue Spalte, sechs ✓); `legal-trace.md` um zwei neue
   Zeilen (und höchstens den Text von R-PERM-01).
3. Vertrag 0.4.3: `contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`; das Abdeckungstor meldet `forwardQuestion` als
   ausgeübt; `allowlist.json` unverändert; kein Feld mit freiem Text im neuen Schema.
4. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (`pnpm role-literals`); keine Statuslogik außerhalb der Tabelle; kein
   Literal in Komponenten (`pnpm i18n-literals`); Paritätstest 561; `pnpm vocabulary` grün.
5. `pnpm slice-scope` grün auf `claude/slice-048-…`.
6. `pnpm gates` mit Postgres-Variablen wie in CI grün auf einem sauberen Baucommit; Schluss einmal wörtlich im Bericht. Die
   Jobs `gates` und `e2e-http` der PR-CI grün auf dem letzten Commit.

## Nachweise

- Rote Testausgabe vor der Änderung, Schluss von `pnpm gates` mit Commit-Hash, Ergebnis der Mutationsproben.
- Diff von `packages/domain/policy-truth-table.md` und `docs/legal-trace.md` im PR.
- Auszug: eine `QuestionForwarded`-Zeile aus `/v1/events`, eine Zugriffslogzeile aus H9.
- Grüne PR-CI (Lauf-ID) für P1–P2.
- **Kein Screenshot:** Keine Ansicht kann vor 054 weiterleiten; die einzige sichtbare Änderung (Zeile in der Historie) belegt
  W1 in beiden Sprachen. 054 zeigt sie auf seinen Screenshots.

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: hoch
Ausgelöst: [x] Fachregel, Status [x] Vertrag, Ereignis, Konfiguration [ ] Persistenz, Migration, Nebenläufigkeit (nur neuer
Ereignistyp, keine Migration) [x] Rolle, Recht, Identität, Schutzklasse [x] personenbezogene oder vertrauliche Daten
(Leserkreis wächst um die Zieleinheit, Umfang in „Warum hoch“; der Grund selbst ist ein Code ohne Personenbezug)
[ ] Betrieb, Wiederherstellung [ ] Administration [ ] Oberfläche, Barrierefreiheit (nur Texte der Historie) [ ] Nachbarsystem
[ ] KI, Agenten [x] Dokumentation, Schulung (Glossar, Rechtekonzept)
Perspektive(n): Security, Datenschutz, Vertrag · Nachweise: oben · Offene Entscheidung: E5 (Standard: gebaut, Bau erst nach
Antwort oder Go), E21 (Sprache in 055), Aufbewahrungsklasse V4 (DSB)

## Missbrauchsfälle (MF-14, neu im Bedrohungsmodell)

**MF-14 Weiterleiten als Umweg, Abschieben oder Offenlegung** (048; verwandt T-G1-I-01, MF-01)

| Fall | Abwehr | Erkennung | Nachweis |
|---|---|---|---|
| Fachkraft leitet eine Frage eines fremden Fachbereichs weiter | Einheitsbindung in `can()`, 404 | Zugriffslog: `forwardQuestion`, 404 | Test 8a, H8 |
| Gebundene Fachkraft **ohne** Einheit (Zuordnung `expert` ohne `unitId`) leitet eine Frage ohne Fachbereich weiter | `hasPermission` verweigert ihr `question.read` (R-PERM-03), `transition()` meldet 404 | Zugriffslog: 404 | Test 8c |
| Weiterleiten, um die Rechtsprüfung zu umgehen oder eine Freigabe aufzuheben | Status bleibt; nicht aus `approved`/`staged`/`delivered`; Rechtsfreigabe und Freigabe unberührt | — | Test 2, 3 |
| Hin und Her zwischen Fachbereichen, um eine Antwort zu verzögern | keine technische Grenze (Standard) | Historie zeigt jede Weiterleitung mit Code; Leitstand (061): Alter der ältesten offenen Frage | Folgeliste: Zähler je Frage, nie je Person |
| Weiterleiten, um mehr Personen lesen zu lassen (Need-to-know, Recherche `:95`): die Zieleinheit liest Rückgabegrund, ganze Historie, alle Versionen mit Ersteller, einen laufenden Claim und einen offenen Verweigerungsvorschlag ohne Begründung | nur Koordination und die zuständige Fachkraft; Ziel ist ein Fachbereich des Jahrgangs; Begründung einer Verweigerung bleibt maskiert | Historie | Test 8a, 8b; Restrisiko bis 047 (Vertraulichkeit) |
| Weiterleiten trotz laufendem Claim | keine Wirkung auf den Claim: er sperrt keinen erlaubten Schreibvorgang und läuft nach zehn Minuten ab | `QuestionClaimed` und `QuestionForwarded` im Protokoll | Test 11 |
| Personendaten im Grund | kein Freitext: geschlossener Code, vom Validator und vom Kern geprüft | — | Test 6, H4 |

## Sicherheits-Checkliste (Antworten für den Reviewer)

- **Rechte als Daten?** Ja: ein Eintrag in `PERMISSIONS`, zwei in `ROLE_PERMISSIONS`; die Fachkraft-Bedingung ist die
  bestehende Einheitsbindung.
- **Übergang nur in der Tabelle?** Ja: R-TRANS-17 mit zwei Guards; der Reduzierer setzt keinen Status.
- **Ereignisse nur anhängend?** Ja: ein neues Ereignis; keine Projektion entfernt etwas (der Claim bleibt).
- **Neuer Lesepfad?** Keine neue Lesemethode, aber **ein neuer Leserkreis**: Nach dem Weiterleiten lesen die Fachkräfte der
  Zieleinheit über die bestehenden Methoden `returnReason`, die ganze Historie (Rückgabegründe, frühere Codes,
  `QuestionClaimed` der alten Einheit), alle Antwortversionen mit `createdBy`, einen laufenden Claim und einen offenen
  Verweigerungsvorschlag (Art, Grund, Wortlaut), nicht dessen Begründung (Test 8a, 8b).
- **Neuer personenbezogener Inhalt?** Nein: der Grund ist ein Code; Invariante `openapi.yaml:3667-3668` bleibt erfüllt.
- **Antwort an einen Akteur, der die Frage danach nicht mehr lesen darf?** Ja, einmal, mit leeren `_actions` und nur dem
  Stand, den er selbst erzeugt hat (Entscheidung 5); Wiederholung 404.
- **Client-Angaben?** Nur `unitId` und `reasonCode`; der Fachbereich wird gegen die Stammdaten geprüft, der Code gegen die
  Liste, die Bindung der Fachkraft kommt aus der Rollenzuordnung, nie aus dem Client.
- **Zugriffslog?** Unverändert, acht Schlüssel.

## Aufwand

Geschätzt **3,0 AStd** (Spanne 2,5–3,75) statt 1,5 laut Plan für alle drei Themen:

| Teil | AStd |
|---|---|
| Vertragsschritt: Operation, zwei Schemas, `Action`, `Event.type`, Beschreibungen, CHANGELOG, Typen, Versions- und Kopfprüfungen | 0,45 |
| Kern: Recht, Zeile, Guard, Codeliste, Ereignis, Umschlag, Reduzierer, Strom, Operation | 0,6 |
| Kerntests 1–16 (mit 8a–8c, 9b, Claim-Fällen), Wahrheitstabelle, Regelregister, Mutationsproben | 0,8 |
| Dienst: Route, H1–H9, P1–P2 | 0,5 |
| Oberfläche: `http.ts`, `liveStore.ts`, sieben i18n-Schlüssel je Sprache, `eventSummary` mit W1, W2 | 0,25 |
| Doku: Rechtekonzept, Glossar, Bedrohungsmodell (Zeile 048, MF-14), DSFA V4, Folgeliste | 0,2 |
| `pnpm gates`, Bericht | 0,2 |

Untere Grenze, wenn die gebundenen Fachkräfte über `assignRole` ohne Hilfsarbeit entstehen; obere Grenze, wenn der
Strom-Test 13 (Nachholen mit Rücksetzen) einen eigenen Aufbau braucht.

## Standards (auf Standard gebaut)

| Standard | Was 048 baut | Kosten einer späteren Änderung |
|---|---|---|
| E5: zusätzlich Weiterleiten an einen anderen Fachbereich; `submitForReview` behält Namen und Anzeige „Weiterleiten“ | diese Scheibe, Bau erst nach Antwort oder Go | vor dem Merge: nichts bauen; danach Zeile entfernen 0,5 AStd plus Wahrheitstabellen-Diff **plus** brechende Vertragsänderung (0.5.0, rund +0,5 AStd); `QuestionForwarded` bleibt für immer in `EVENT_TYPES` (R7) |
| Status bleibt beim Weiterleiten | `to: (q) => q.status` | `in_review → answer_drafted`: rund 0,25 AStd |
| Halter: Koordination und gebundene Fachkraft | zwei Einträge | weitere Rolle (z. B. `legal`): < 0,1 AStd plus Diff |
| Grund Pflicht als geschlossener Code mit vier Werten, kein Freitext | Schema, Kern, i18n | weiterer Code: additiv, < 0,1 AStd; Freitext zusätzlich in `payload.pii`: rund 0,8 AStd (Eigentümerfrage 5) |
| Grund nicht in der Projektion | nur Historie | Feld `forwardReasonCode` an `Question`: Vertrag und Kern, rund 0,3 AStd |
| Claim bleibt beim Weiterleiten | Reduzierer unverändert | Claim löschen: < 0,1 AStd |
| Keine Grenze der Weiterleitungen je Frage | — | Guard mit Zähler: rund 0,3 AStd |
| Aufbewahrungsklasse `working` wie `QuestionAssigned` | Standard des Umschlags | `record`: eine Zeile, < 0,1 AStd (nach Antwort des DSB, Eigentümerfrage 9) |
| `question.forward` statt eines neuen Namens trotz anderer Bedeutung im Rechtekonzept §2.4 | Kopfvermerk; 052 bereinigt | Umbenennen vor dem Merge: < 0,1 AStd, danach Vertrag 0.5 |
| Bezeichnung „An anderen Fachbereich weiterleiten“ | i18n | Textänderung |

## Offene Eigentümerfragen

Keine blockiert die Spec; Frage 1 blockiert den **Baubeginn** (Antwort oder ausdrückliches Go). Alle übrigen mit Standard.

1. **E5, Bedeutung „Weiterleiten“** (offen seit Frage 6, Antwort fällig 09.10.2026). Standard: beides — „Weiterleiten“ bleibt
   der nächste Schritt (020), dazu diese Scheibe für die Übergabe an einen anderen Fachbereich; Ereignis- und Operationsnamen
   von `submitForReview` bleiben. **Bau beginnt erst nach der Antwort oder einem ausdrücklichen Go des Eigentümers**, weil
   eine Rücknahme nach dem Merge den Vertrag bricht und das Ereignis im Log bleibt. Lautet die Antwort „nur nächster
   Schritt“, entfällt 048; lautet sie „auch an eine Kollegin“, ist das eine Personenzuweisung (Recherche `:221`) und eine
   eigene Scheibe.
2. **Status nach dem Weiterleiten.** Standard: unverändert, auch aus `in_review`. Alternative: aus `in_review` nach
   `answer_drafted`, damit die neue Einheit nacharbeitet (rund 0,25 AStd, gleiche Wahrheitstabelle).
3. **Wer weiterleitet.** Standard: Koordination und die Fachkraft des zuständigen Fachbereichs (Plan). Nicht: Administration
   (040a), Freigabe, Recht. Soll Recht aus `in_review` weiterleiten können, < 0,1 AStd plus Diff.
4. **Risikoklasse.** Standard: hoch (neues Recht, erweiterter Leserkreis, Leitplanken §4). Herabstufen auf mittel (Plan) nur
   durch den Eigentümer mit der Zeile „Herabstufung freigegeben von … am …“ im Kopf.
5. **Freitext zusätzlich zum Code?** Standard: nein; Pflicht ist ein Code aus `wrong_unit`, `expertise_elsewhere`, `capacity`,
   `other`. Alternative: optionaler Freitext in `payload.pii` (ADR 0009) mit einem eigenen Leserkreis (etwa Halter von
   `question.forward` und die Fachkräfte der Zieleinheit), maskiert in jedem Ereignis-Lesepfad für alle anderen, rund
   0,8 AStd mit Vertragszeile, Maskierungstests und DSFA. **Folge für die Löschung:** Im `pii`-Teil ließe sich der Text je
   Jahrgang durch Crypto-Shredding unlesbar machen, sobald der echte Codec (073) steht; bis dahin bleibt er im Klartext im Log.
   Außerhalb von `pii` wäre er nie löschbar (Hash-Kette, R7) und bräche die Invariante des Umschlags; diese Variante steht
   nicht zur Wahl.
6. **Auskunftsschuldner (048b).** Standard: eine **Funktion**, kein Mensch: `accountableSeatId` verweist auf einen Bühnenplatz
   des Jahrgangs (Vorstandsvorsitz, Finanzvorstand, AR-Vorsitz …); Standard = Bühnenplatz der Frage. Die Zuordnung Platz →
   Person bleibt hinter `admin.seats.manage` (040b). Alternative „Person“: neues personenbezogenes Feld mit Leserkreis,
   DSFA-Zeile, Klasse hoch, rund +1 AStd. Offen auch: Abschlussprüfer als Gast hat keinen Bühnenplatz (Recherche `:81`).
7. **Inhaltssprache.** Standard: nicht in 048; das reservierte Feld kommt mit 055 an der Antwortversion (Register E21). Ein
   Feld `language` an `Question` ohne Abnehmer wäre ein totes Feld.
8. **Zuschnitt.** Standard: 048 (diese Spec, Weiterleiten vollständig), 048b (Auskunftsschuldner, nach 048, nicht in der Kette
   E57), Sprache mit 055.
9. **Aufbewahrungsklasse (Frage an den DSB).** Standard: `working` wie `QuestionAssigned` im Code. Die DSFA-Zeile V4 nennt für
   Klassifizieren und Zuweisen `record`; der Widerspruch besteht schon für `QuestionAssigned`. Der DSB entscheidet für beide
   Ereignisse zusammen; die Änderung ist je Ereignis eine Zeile.

- Entschieden 05.10.2026: Frage 1 (E5): Bedeutung bleibt wie gebaut; E5 geschlossen.
- Entschieden 05.10.2026: Frage 6 (048b): Auskunftsschuldner ist eine Funktion (Bühnenplatz), keine Person.
- 05.10.2026 zu Frage 9: Der Eigentümer trägt den Standard `working` mit; die Entscheidung bleibt beim DSB (für `QuestionForwarded` und `QuestionAssigned` zusammen). Bis zur Antwort des DSB bleibt der Widerspruch zur DSFA-Zeile V4 offen; der Code bleibt `working` (auf Standard gebaut).
- Entschieden 05.10.2026: Fragen 2 bis 5, 7, 8: Standard wie gebaut angenommen.

## Skizze 048b — Auskunftsschuldner (nicht ausgearbeitet)

- **Ziel:** Auskunftsschuldner und Sprecher getrennt führen (Ist-Analyse `:148`, Recherche `:449`), ohne neues
  Personendatum.
- **Vertrag** (Vertragszeile nach 043a Regel 1, eigene Patch-Stufe): optional `Classification.accountableSeatId` (string,
  `maxLength` 128); Antwortfeld `Question.accountableSeatId`.
- **Kern:** `classifyQuestion` prüft den Wert gegen `state.stageSeats` (422 wie `seatId`); `QuestionClassified` trägt ihn; die
  Projektion setzt `accountableSeatId = payload.accountableSeatId ?? seatId`. Keine neue Zeile, kein neues Recht (Klassifizieren
  bleibt `question.classify`), keine Wahrheitstabellen-Änderung.
- **Leserkreis:** wie die Frage; ein Bühnenplatz ist eine Funktion. Kein Zugriffslog-Feld.
- **Oberfläche:** Anzeige und Auswahl in der Steuerung (053) oder im Beantwortungsdetail, nach 048b.
- **Klasse:** mittel (Vertrag, Fachregel, persistierte Daten), 1,0–1,5 AStd; hoch, falls Eigentümerfrage 6 „Person“ wählt.

## Hinweise an den Orchestrator

- **Planabweichung (gehört dem Orchestrator):** 043b trägt `forward` nicht mehr; 048 schreibt die Operation selbst in den
  Vertrag. Plan-Eintrag 043 bzw. die Teilungstabelle aus 043a entsprechend vermerken.
- Plan-Eintrag 048 (§5, Zeile 685–690): Klasse mittel → hoch, Aufwand 1,5 → 3,0 AStd für 048 plus 1,0–1,5 für 048b; Lanes
  core → contract, core, service, web-api, web-shell, web-history, docs; R-TRANS-13 → R-TRANS-17 und R-GUARD-15;
  **Abhängigkeiten „021c, 043, 040“ → „044, 040“**; „Feld language“ streichen (E21: 055); „accountable … genau eine Person
  oder Funktion, RACI-Accountable“ ersetzen durch „Funktion (Bühnenplatz)“, mit Verweis auf Eigentümerfrage 6; „Grund“ als
  geschlossener Code. **Kalender:** 048 steht auf 05.11.2026, 044 auf 06.11.2026; mit der Abhängigkeit 044 muss 048 hinter 044
  rücken, etwa auf 09.11.2026 (W7), vor 053 (13.11.2026) und 054 (16.11.2026); danach `node scripts/plan-graph.mjs` grün
  belegen. Nicht Teil dieser Spec.
- Register E5: R-TRANS-13 → R-TRANS-17; Plan §3 Zeile 198 ebenso (043a, Folgelisten-Eintrag 1, zum Teil erledigt).
- Folgeliste (Einträge legt der Bau an): Quelle von `hv_open_questions` im Kennzahlenkatalog um `QuestionForwarded` ergänzen
  (Text); Zähler „Weiterleitungen je Frage“ für den Leitstand (aggregiert, nie je Person); Rechtekonzept §2.1/§2.4 auf die
  Bedeutung von `question.forward` bereinigen (052); `_actions` einer gebundenen Fachkraft ohne Einheit enthält auf einer
  Frage ohne Fachbereich theoretisch `question.forward`, obwohl sie die Frage nie lesen kann (ohne Wirkung, Test 8c).

## Hinweise an Folgescheiben

- **054 (Fokusansicht):** primäre Aktion bleibt „Weiterleiten“ zum nächsten Schritt (`question.submit_review`, Z9); „An
  anderen Fachbereich weiterleiten“ ist die zweite Aktion im Dialog, nur wenn `_actions` `question.forward` enthält. Auswahl
  aus `listUnits` ohne den aktuellen Fachbereich; Grund als Pflichtauswahl aus den vier Codes (Bezeichnungen aus
  `labels.ts`), kein Freitextfeld. Nach Erfolg verschwindet die Frage aus „Meine Fragen“, ohne neu zu laden; 404 nach einem
  Netzfehler beim Weiterleiten heißt „weitergeleitet oder nicht mehr sichtbar“. Ein angezeigter Claim kann von der alten
  Einheit stammen. Den letzten Weiterleitungsgrund liest die Ansicht aus der Historie.
- **053 (Steuerung):** Koordination erhält Zuweisen und Weiterleiten; die Matrix aus `counts.byUnit` folgt ohne eigenen Code.
- **047 (Vertraulichkeit):** Weiterleiten einer `protected`-Frage erweitert den Leserkreis; Attributregel oder Guard dort,
  nicht hier.
- **061 (Leitstand):** „Rückstand je Fachbereich“ folgt der Projektion.
- **052 (Rechtekonzept umbasieren):** `question.forward` = an einen anderen Fachbereich; §2.4 auf `question.assign`,
  `question.submit_review`, `question.return` umschreiben.
- **055:** reserviertes Feld `language` an der Antwortversion (E21).
- **069 und alle weiteren:** Regel-ids nach der nächsten freien Nummer zum Zeitpunkt der Spec (R-TRANS-17 ist ab 048 belegt).

## Bericht (nach Bau ausfüllen)

**Gebaut am 04.10.2026** auf `claude/slice-048-weiterleiten` (implementierer-backend, Opus), Vertragsschritt `fb5cbde`, Bau
`85bbd75`. Risikoklasse hoch, auf Standard gebaut (E5 offen; Go des Eigentümers 04.10.2026).

**Vor dem Bau geprüft.** (1) Go des Eigentümers 04.10.2026 erteilt. (2) 045 gemergt (`c0db7f5`), Vertrag vor `fb5cbde` 0.4.2;
`PERMISSIONS` ohne `question.forward`; R-TRANS-17 und R-GUARD-15 frei (belegt bis R-TRANS-16 bzw. R-GUARD-14, R-GUARD-10
reserviert). (3) Gebundene Fachkräfte im Kern über `assignRole` ohne Hilfsarbeit (auch ohne `unitId`), über HTTP über
`POST /v1/meetings/{meetingId}/role-assignments` mit Subject-ids, die im Seed nicht vorkommen (H8). (4) `eventSummary.ts` hat keinen
`default`-Zweig, aber auch keine `never`-Prüfung: die Typprüfung erzwingt den neuen Fall nicht; W1 belegt ihn (Folgeliste). (5) Die
Zeilenangaben der Spec stimmten an den geprüften Stellen (`api.ts` `transition()`, `assignQuestion`, `authorizeReplay`,
`state.ts` `QuestionAssigned`, `stream.ts`-Tabellen, `labels.ts`, `liveStore.ts` `WRITE_METHODS`, `parity.test.ts:165`).

**Rot vor der Änderung.** Kern `forward048.test.ts`: `Tests  25 failed (25)` (`api.forwardQuestion is not a function`). Dienst
`forward048.test.ts` ohne Route: `Tests  8 failed | 1 passed (9)` (H2 grün: 401 entsteht vor dem Routing). Postgres ohne Route:
`Tests  2 failed (2)`. W1 gegen das alte `eventSummary.ts`: `Tests  3 failed | 10 passed (13)`. W2 vor `http.ts`:
`Tests  2 failed | 131 passed (133)`.

**Mutationsproben** (je einzeln angewendet, Test gelaufen, zurückgenommen):

| Probe | Ergebnis |
|---|---|
| R-GUARD-15 aus R-TRANS-17 entfernt | Test 4 rot (`1 failed`) |
| `to: 'assigned'` statt `(q) => q.status` | Test 2 rot (`2 failed`: `answer_drafted`, `in_review`); erst nach einer Ergänzung, siehe Abweichung 2 |
| `delete q.claim` im Reduzierer | Test 11 rot (`2 failed`) |
| `QuestionForwarded` aus `SCOPE_EXIT_EVENTS` | Test 13 rot (`1 failed`) |
| `question.forward` an admin | Test 1 rot (`1 failed`) |

**Wahrheitstabelle.** Kopfzeile und die sechs Zeilen sind wörtlich die des Diffs oben; maschinell geprüft: 198 Zeilen ändern sich
nur um die neue Spalte `q.forward` (zwischen `q.assign` und `answer.draft`), sechs ✓, **0 andere Zellen**. `legal-trace.md`: zwei neue
Zeilen R-GUARD-15 und R-TRANS-17, dazu der Text von R-PERM-01 (`forwardQuestion` in der Aufzählung der Schreibvorgänge mit
Eingabeprüfung vor `can()`).

**Postgres.** P1–P2 laufen in `pnpm gates` mit `TEST_DATABASE_URL`/`TEST_RUNTIME_DATABASE_URL` auf `hv_t048` (Summe `apps/api`
`674 passed (674)`, kein `skipped`); einzeln: `✓ P1 the forward survives a restart …`, `✓ P2 a rejected forward writes no row …`.

**Auszug** (`/v1/events` als admin; Zugriffslogzeile eines abgewiesenen Weiterleitens wie H9, `latencyMs` kommt von der
vorgestellten Testuhr):

```
{"id":"e6f97e85-83d5-4f0e-9095-30c1113e9969","type":"QuestionForwarded","at":"2027-04-20T12:01:00.000Z","subjectId":"0002be84-a86c-4897-ae63-3d62a8f9583d","seq":307,"actor":{"id":"coo48","role":"coordination"},"payload":{"unitId":"unit-hr","fromUnitId":"unit-fin","reasonCode":"expertise_elsewhere"},"schemaVersion":2,"meetingId":"hv-2027","recordedAt":"2027-04-20T12:01:00.000Z","occurredAt":"2027-04-20T12:01:00.000Z","occurredAtSource":"server","retentionClass":"working","legalHold":false,"redacted":true,"sourceHash":"65648e354217a9c8fb437999b8dd7366bc2f051a84d972c0191d7a457456e642"}
{"v":1,"ts":"2027-04-20T12:01:09.000Z","requestId":"248186c8-1187-45f7-8f3a-7956d55ad4a5","subjectHash":"YVGiOjD8Hnb7sigzuTKTw_v5_NFQoDrOqssw8QHHh0I","operationId":"forwardQuestion","status":409,"latencyMs":6000,"seq":null}
```

**`pnpm gates`** grün auf `85bbd75` (sauberer Baum, Postgres-Variablen gesetzt); Schluss wörtlich:

```
vite v8.2.2 building client environment for production...
transforming...
✓ 1735 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-JmpNnxN2.css                        42.52 kB │ gzip:   9.13 kB
dist/assets/index-Bkvmlj0W.js                        694.96 kB │ gzip: 203.19 kB │ map: 2,898.26 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.93s
mark-test-run: wrote /home/user/wt/s048/.claude/state/last-test-run (clean tree) at commit 85bbd75, tree 33eb3ea4bada…
```

Davor in derselben Ausgabe: `packages/domain` `Tests  420 passed (420)`, `apps/web` `Tests  561 passed (561)`, `apps/api`
`Tests  674 passed (674)`, `operation-coverage: 70 operations in the contract, 68 exercised by tests, 2 pre-declared in
allowlist.json … ok`, `vocabulary-check: ok`, `i18n-literal check: 0 literals`, `slice-scope: 41 changed file(s), all within …`
(mit der Warnung, dass „Files allowed“ von der Merge-Basis abweicht: Abweichung 1), `plan-graph: ok`, Skripttests `# pass 275`,
`# fail 0`. `contract:lint`: die 12 bestehenden Warnungen, keine neue.

**Nach dem Review (04.10.2026, Befunde 1–3, Commit `789c745`).** Test 13 um den Leser der Zieleinheit (`STREAM_HR`) ergänzt: live
ein `change` mit der Frage-id, Nachholen über das Weiterleiten ein `reset`. **Mutationsprobe:** `lookupIn([before, after])` in
`visibleMessages` auf `[before]` verkürzt → Test 13 rot (`1 failed`, die Zusicherung der Frage-id für `unit-hr`), zurückgenommen.
Test 9b um den Fall „erneut weiterleiten, alten Zielfachbereich entfernen, K1 wiederholen“ ergänzt: 422 „Unit unit-ar does not
exist.“, kein Ereignis (Abschnitt 5 berichtigt). Sieben Review-Punkte auf der Folgeliste.

**`pnpm gates`** grün auf `789c745` (sauberer Baum, Postgres-Variablen auf `hv_t048`; domain `Tests  421 passed (421)`, web
`561 passed (561)`, api `674 passed (674)` ohne `skipped`, `operation-coverage … ok`, `slice-scope: 41 changed file(s), all within …`,
Skripttests `# pass 275`, `# fail 0`); Schluss wörtlich:

```
vite v8.2.2 building client environment for production...
transforming...
✓ 1735 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-JmpNnxN2.css                        42.52 kB │ gzip:   9.13 kB
dist/assets/index-Bkvmlj0W.js                        694.96 kB │ gzip: 203.19 kB │ map: 2,898.26 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.50s
mark-test-run: wrote /home/user/wt/s048/.claude/state/last-test-run (clean tree) at commit 789c745, tree 5a87db061d30…
```

**Abweichungen von der Spec.**
1. **Scope-Befund `packages/domain/src/__tests__/api.test.ts`.** Die Erwartung „coordination holds exactly …“ (`api.test.ts:671`)
   listet das Bündel der Koordination genau; Entscheidung 1 ändert es zwingend. Die Spec nannte die Datei nicht (044a hatte sie für
   dieselbe Erwartung genannt). Eine Zeile ergänzt, die Datei unter „Files allowed“ als Scope-Befund mit offener Freigabe des
   Orchestrators eingetragen, damit `slice-scope` die Abweichung sichtbar meldet statt zu scheitern.
2. **Test 2 prüft zusätzlich die Tabelle.** Die Probe `to: 'assigned'` blieb zunächst grün: Der Reduzierer liest, wie die Spec
   verlangt, keinen Zielstatus aus dem Ereignis, also war das `to` der Zeile unbeobachtbar. Test 2 sichert nun zusätzlich, dass
   `resolveTransition` für R-TRANS-17 den aktuellen Status liefert (R5: die Tabelle sagt „Status bleibt“).
3. **Schlüssel der Grundcodes heißen `history.forward.reason.*`** statt `forward.reason.*`: Der Paritätstest (d) verlangt im Modul
   `history` das Präfix `history`, und `parity.test.ts` war nur für die Zahl freigegeben. Zahl und Texte wie in der Spec (561).
4. `forwardReasonLabel` liegt in `labels.ts`, wird aber nicht über `i18n/index.ts` exportiert (nicht in „Files allowed“);
   `eventSummary.ts` importiert direkt aus `i18n/labels` (Folgeliste, mit 054).
5. Test 6 prüft zusätzlich eine Zahl als `unitId` und Freitext als `reasonCode`; H4 prüft jede Validator-Abweisung auch als
   `approver` (422 vor 403).

**Offen.** Kein Screenshot (Spec: keine Ansicht vor 054). PR-CI (`gates`, `e2e-http`) läuft erst mit dem PR; Lauf-ID für P1–P2 trägt
der Orchestrator nach. Aufbewahrungsklasse V4 (DSB, Eigentümerfrage 9), E5 offen.

**Aufwand.** Rund 0,4 AStd Agentenzeit für Kern, Dienst, Oberfläche, Doku und Gates (13:41–14:05 UTC) gegen geschätzte 3,0 AStd
(Spanne 2,5–3,75; ohne den bereits erledigten Vertragsschritt 0,45 AStd: 2,55).

## Review findings

### Lesebefund der Spec (frischer Kontext, 03.10.2026, zu `888d629`)

0 blocker, 3 major, 11 minor, 6 nit. Alle Punkte nach den Entscheidungen des Orchestrators eingearbeitet.

| Nr. | Klasse | Befund | Eingearbeitet |
|---|---|---|---|
| M1 | major (Datenschutz, Recht) | Freitextgrund außerhalb von `pii` bricht die Invariante `openapi.yaml:3667-3668`, E4 und ADR 0009; im Log nicht löschbar | Grund als Pflichtcode `reasonCode` (vier Werte), kein Freitext; Nutzlast `unitId`, `fromUnitId`, `reasonCode`; Historie zeigt die Bezeichnung; Eigentümerfrage 5 neu („Freitext zusätzlich?“, `pii`, 0,8 AStd, Löschfolge); Vertragsform angepasst |
| M2 | major | Löschen des Claims wirkt über eine fremde Handlung | Claim bleibt, Reduzierer ohne Änderung daran; Test 11 mit Claim von `expert` und von `legal` in `in_review`; Begründung in Entscheidung 4; Zeile in MF-14 umformuliert |
| M3 | major | Erweiterter Leserkreis nicht benannt | Umfang benannt in „Warum hoch“, Sicherheits-Checkliste, MF-14 und DSFA V4 (Files allowed); Test 8a/8b; Checkliste „Neuer Lesepfad?“ berichtigt |
| m1 | minor | Gebundene Fachkraft im Kern über `assignRole` | Vor-dem-Bau-Punkt 3 nach `person-roles026.test.ts:166` |
| m2 | minor | Fachkraft ohne Einheit nicht benannt | MF-14-Zeile, Test 8c; keine Änderung an `assignRole` nötig, Folgeliste nur zu `_actions` |
| m3 | minor | `rules.ts` für Beschreibungstexte | erlaubt, nur R-PERM-01; R-CLAIM-01 unverändert |
| m4 | minor | `CHANGE` heißt `EVENT_TOPICS` | an allen drei Stellen berichtigt |
| m5 | minor | `stream035.test.ts` bedingt erlaubt | unbedingt, mit Umfang |
| m6 | minor | Orchestrator-Hinweis zu Abhängigkeiten und Kalender | „Abhängigkeiten 044, 040“, Kalender hinter 044 |
| m7 | minor | Vertragsweg falsch begründet | Planabweichung vom Zuschnitt aus 043a, gehört dem Orchestrator |
| m8 | minor | Aufbewahrung | `working` wie im Code; Widerspruch zu V4 als Frage an den DSB (Eigentümerfrage 9) |
| m9 | minor | Rücknahmekosten zu niedrig | brechende Vertragsänderung (+0,5) und Ereignistyp bleibt (R7); Baubeginn erst nach E5 oder Go |
| m10 | minor | Aufwand | 3,0 AStd (2,5–3,75) |
| m11 | minor | Vertragstests | `forwardQuestion` in der `If-Match`-Liste von `contract.test.ts`, Kopfprüfung wie `contract-043a.test.ts:241-243` |
| n1 | nit | 69 statt 70 Operationen | berichtigt |
| n2 | nit | Planzeile 069 ist 868 | berichtigt |
| n3 | nit | Prüfreihenfolge | `requireQuestionFor` → 404 gebunden → 403 → `If-Match` → 409 |
| n4 | nit | EN-Bezeichnung | „Forward to another answering unit“ (Glossar: answering unit) |
| n5 | nit | Rücksetzen im Nachholen unbenannt | Abschnitt 6 benennt den Catch-up-Reset |
| n6 | nit | Wiederholung nach Entfernen des Fachbereichs | Schutz R-ADM-02 (Test 9b); nach dem Review berichtigt: über erneutes Weiterleiten und Entfernen herstellbar, 422 angenommen wie bei `assignQuestion` (Test 9b, zweiter Fall) |

### Nachprüfung (frischer Kontext, 03.10.2026, Kopf `5efa153`)

M1, M2 und M3 gelöst; keine neuen blocker oder major. Eingearbeitet vom Orchestrator: Minor 1 (Datenschutz: gebundenes
Nutzlast-Schema `QuestionForwardedPayload`, Test 2 mit genauen Schlüsseln), Minor 2 (eigener Schlüssel
`history.payload.forwardReason`, Parität 561), Nit 3 (Files allowed nennt das Schema und seine Bindung). Nits 4, 5, 7 und 8
gehen auf `docs/folgeliste.md` (Regel 3).

