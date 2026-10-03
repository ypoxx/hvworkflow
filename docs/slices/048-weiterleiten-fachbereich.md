# Scheibe 048 — Weiterleiten an einen anderen Fachbereich (Vertrag, Kern, Dienst)

**Status:** spec (03.10.2026; gelesen auf `3556d64`: 043a, 040b, 044a, 044b und 045 gemergt, Vertrag 0.4.2; erster Teil der geteilten Planzeile 048, Zuschnitt im Abschnitt „Teilung und Zuschnitt“; zweite Scheibe der Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041, Register E57; auf Standard gebaut, E5 offen)
**Risikoklasse:** hoch · 2,75 AStd (Spanne 2,25–3,25; Plan 048: mittel · 1,5 AStd für alle drei Themen der Planzeile; Begründung in „Warum hoch“ und „Aufwand“) · Plan 048: 05.11.2026 (W6), tatsächlich direkt nach 045 · Lanes: contract (erster Commit, Architekt); core; service; web-api (nur `http.ts` und `liveStore.ts`); web-shell (nur ein Aktions- und ein Ereignisschlüssel); web-history (nur die Zusammenfassung des neuen Ereignisses); docs-legal (Kopfvermerk Rechtekonzept); docs-sicherheit; docs-datenschutz (nur Zeile V4); docs (Glossar)
**Bedrohungsmodell:** berührt T-G1-E-01 (Schreibvorgang ohne Oberfläche), T-G1-I-01 (Leserkreis wächst um die Zieleinheit), T-G1-I-09 (Strom: Frage verlässt den Lesebereich); neuer Missbrauchsfall MF-14 (Abschnitt „Missbrauchsfälle“)
**Rolle:** architect für den Vertragsschritt (erster Commit, vor jedem Code, AGENTS.md R6); danach implementierer-backend. Review in frischem Kontext mit den Perspektiven **Security** (Einheitsbindung, neues Recht, Strom, Antwort nach dem Verlassen des eigenen Bereichs), **Datenschutz** (Freitextgrund, Leserkreis, keine Person als Ziel) und **Vertrag** (neue Operation, Validator und Kern im Gleichlauf, Abdeckungstor). Lesebefund der Spec vor dem Bau (Klasse hoch); nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** neu R-TRANS-17 (Weiterleiten an einen anderen Fachbereich), R-GUARD-15 (Ziel ist ein anderer Fachbereich). Angewandt: R-GUARD-03 (nur Textpfade), R-TRANS-00, R-PERM-01, R-PERM-02, R-PERM-03 (Einheitsbindung), R-IDEM-01 (nur Abgrenzung). Dazu AGENTS.md R2, R3, R4, R5, R6, R7, R8, R10, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 048 (Zeile 685–690), Eintrag 054 (Zeile 759–765, Dialog „Weiterleiten“), §3 Zeile 198 (Bedeutung „Weiterleiten“), §11 Zeile 1303 und 1330 (Freigabe-Demo)
- Register E5 (offen; Standard: zusätzlich Weiterleiten an eine andere Einheit, Ereignis- und Operationsnamen von `submitForReview` unverändert), E21 (Feld `language` reserviert, Zielscheibe 055), E57
- `docs/feedback/2026-10-fragenpaket-woche-1.md` Frage 6; `docs/feedback/2026-09-quickview-projektleitung.md` Rückmeldung 32; `docs/feedback/2026-09-zielbild-oberflaeche.md` Z9
- `docs/anforderungen-recherche.md:81, 95, 220, 446, 449`; `docs/ist-analyse-und-schnittstellen.md:82, 148, 167`
- `docs/rollen-und-rechtekonzept.md` Zeile 11, 62, 87, 119–122; `docs/glossar.md` Zeile 23, 50
- Spec 043a („Regel 1“, Teilungstabelle Zeile 043b, „Regel-ids für Folgescheiben“, Folgelisten-Eintrag 1); Spec 044a und 044b (Muster Kern plus Dienst, Längen in Code-Punkten); Spec 040a (admin als ausdrückliche Liste); Spec 040b (Fachbereiche als Stammdaten des Jahrgangs); Spec 021b (Koordination)
- Bedrohungsmodell T-G1-E-01, T-G1-I-01, T-G1-I-09, MF-01; DSFA-Vorentwurf Zeile V4, V9

**Depends on:** 045 (gemergt `c0db7f5`), 044b (gemergt `799cca5`, Vertrag 0.4.2), 040b (Fachbereiche je Jahrgang), 021b, 021c. **Nicht** 043b: Dieser Vertragsteil ist nie geschrieben worden und steht nicht in der Kette E57; 048 bringt seine Vertragszeile selbst mit (Befund, Abschnitt „Vertragsschritt“)
**Perspektive:** Security, Datenschutz, Vertrag · **Glossar: neue Begriffe:** ja („An anderen Fachbereich weiterleiten“ mit `question.forward`, `forwardQuestion`, `QuestionForwarded`)

## Warum hoch

Der Plan führt 048 als „mittel“. Die Leitplanken (§4) nennen **jede Änderung an Rechten** als Hoch-Auslöser, und bei
unklarer Zuordnung gilt hoch. 048 löst das aus:

- **Neues Recht** `question.forward` in `ROLE_PERMISSIONS` für zwei Rollen, mit Wahrheitstabellen-Diff (unten).
- **Leserkreis wächst.** Wer weiterleitet, macht eine Frage samt Antwortentwurf für die Fachkräfte einer anderen Einheit
  lesbar (Einheitsbindung, R-PERM-03). Die Recherche nennt genau das eine Offenlegung (`docs/anforderungen-recherche.md:95`:
  „Die Weiterleitung einer Frage nebst Kontext an 150 Personen ist bereits eine Offenlegung“).
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
| **048** (diese Spec) | Weiterleiten an einen anderen Fachbereich, vollständig | Recht, Zeile R-TRANS-17, Guard R-GUARD-15, Ereignis `QuestionForwarded`, Operation `forwardQuestion` im Kern, im HTTP-Client und im Live-Puffer, Dienstroute, HTTP- und Postgres-Nachweis, Zusammenfassung in der Historie, Wahrheitstabelle, Regelregister | erster Commit: neue Operation, Recht, Ereignistyp; 0.4.3 | hoch · 2,75 | jetzt, vor 053 und 054 |
| **048b** (Skizze unten) | Auskunftsschuldner | Vertragszeile `Classification.accountableSeatId` und Antwortfeld `Question.accountableSeatId`; Projektion mit Standard = Bühnenplatz; Prüfung gegen die Bühnenplätze des Jahrgangs | eigene Patch-Stufe | mittel · 1,0–1,5 (hoch, falls eine Person statt einer Funktion gewählt wird) | nach 048; nicht in der Kette E57 nötig; frühestens nach Antwort auf Eigentümerfrage 6 |
| Inhaltssprache | Feld `language` | **nicht in 048.** Register E21 ordnet das reservierte Feld 055 zu (Antwortformat); dort hängt die Sprache an der Antwortversion, deren Text sie beschreibt | mit 055 | — | Eigentümerfrage 7 |
| Dialog | „Weiterleiten“ mit Einheit und Grund | 054 (Fokusansicht), 053 (Steuerung) | — | — | Kette E57 |

**Warum kein Schnitt Kern / Dienst wie bei 044.** 044 war 4,25 AStd groß; 048 ist 2,75 AStd, also innerhalb eines
Agententags. Ein Schnitt hätte einen Zwischenstand, in dem der Vertrag eine Operation verspricht, die der Dienst mit 404
beantwortet, und bräuchte einen Allowlist-Eintrag mit Ablaufdatum. 054 braucht die Route für den Lauf `e2e-http`. Die
Dienstseite ist eine Route und ihre Tests; ein eigener Review dafür kostet mehr, als er an Risiko senkt.

**Warum der Auskunftsschuldner heraus.** Das Feld hat in der Kette keinen Abnehmer, und seine Bedeutung („genau eine Person
oder Funktion“) ist offen. Nennt es eine Person, ist es ein neues personenbezogenes Feld mit Leserkreis, DSFA-Zeile und
Klasse hoch. Getrennt bleibt das Weiterleiten von dieser Entscheidung unabhängig.

## Befund (Ist-Stand, gelesen auf `3556d64`)

- **Vertrag 0.4.2**, 70 `operationId`. Keine Operation, kein Schema und kein Feld für Weiterleiten, Auskunftsschuldner oder
  Inhaltssprache. Das Enum `Action` (`openapi.yaml:2545`) kennt `question.forward` nicht, das Enum `Event.type`
  (`openapi.yaml:3675-3710`) kennt `QuestionForwarded` nicht. `allowlist.json`: zwei Einträge, beide `slice` 040.
- **043b fehlt.** Spec 043a (Teilungstabelle, Zeile 043b) sah `forward` mit `question.forward` und `QuestionForwarded`,
  `accountable` und `language` in einem eigenen Vertragsteil „vor dem Bau von 048“ vor. 043b ist nie geschrieben worden und
  steht nicht in der Kette E57. Nach 043a Regel 1 und AGENTS.md R6 schreibt deshalb der Architekt die Vertragszeile im ersten
  Commit dieser Scheibe; Route und Tests folgen im selben PR, ein Allowlist-Eintrag entfällt.
- **Regel-ids.** R-TRANS-13 ist die Rechtsfreigabe in `in_review` (`transitions.ts:725`), R-TRANS-14 die Rechtsfreigabe einer
  Podiumsfrage (`:743`), R-TRANS-15/16 die Verweigerung (`:760`, `:786`). Plan Zeile 198 und 685 sowie Register E5 nennen
  für das Weiterleiten noch R-TRANS-13; das ist veraltet (043a, Folgelisten-Eintrag 1). Nach 043a vergibt jede Folgespec die
  nächste freie Nummer: **R-TRANS-17**. Guards: R-GUARD-01 bis -09 und -11 bis -14 belegt, R-GUARD-10 für 059 reserviert;
  nächste freie Nummer **R-GUARD-15**. Der Plan nennt R-TRANS-17 noch für 069 (Zeile 867); 069 nimmt beim Schreiben ihrer
  Spec die dann nächste freie Nummer.
- **Zuweisen** (R-TRANS-02, `transitions.ts:371`): `question.assign` aus `classified` und `assigned` nach `assigned`, Guard
  R-GUARD-03 (nur Textpfade). Halter: `coordination`, `approver`, `admin` (`permissions.ts`). Ein Umhängen aus `assigned` geht
  also schon, aber ohne Grund; aus `answer_drafted` und `in_review` geht es nicht.
- **`QuestionAssigned` setzt den Status fest auf `assigned`** (`state.ts:406-412`). Für ein Weiterleiten aus
  `answer_drafted` oder `in_review` taugt das Ereignis nicht: Es würfe die Frage zurück. Ein eigenes Ereignis ist nötig.
- **Einheitsbindung.** `expert` ist ein `unitBound`-Bündel (`permissions.ts:65`). Für einen Akteur mit `assignmentScoped`
  verweigert `can()` jede Aktion auf einer Frage einer anderen Einheit mit R-PERM-03 (`api.ts:224`); `transition()` meldet
  dann 404 (`api.ts:790`). Im Demo-Rollenwechsel ist `expert` nicht gebunden und sieht alle Fragen, wie heute beim
  Antwortentwurf.
- **Antwort nach dem Schreiben.** `transition()` antwortet nach dem Anhängen mit `viewQuestion(requireQuestion(id))`
  (`api.ts:809`), ohne die Lesbarkeit erneut zu prüfen. Eine Wiederholung mit demselben `Idempotency-Key` geht über
  `authorizeReplay` (`api.ts:588-605`); dort prüft der Kern für ein gebundenes `expert` die aktuelle Lesbarkeit und meldet
  sonst 404.
- **Claim.** `claimQuestion` setzt eine weiche Sperre für zehn Minuten (`api.ts:1257-1265`); ein anderer Akteur erhält 409
  R-CLAIM-01. Die Projektion hält sie in `q.claim` (`state.ts:373`).
- **Strom.** `CHANGE`, `EVENT_SUBJECTS` und `SCOPE_EXIT_EVENTS` (`stream.ts:55, 106, 130`) sind über `EventType` typisiert
  bzw. führen `QuestionAssigned` als Ereignis, nach dem eine Frage den Lesebereich verlassen kann. `envelope.ts:5-17` führt
  die bekannten Ereignistypen (`EVENT_TYPES`); ein unbekannter Typ besteht das Laden nicht.
- **Kennzahl je Fachbereich** (`indicators.ts:81`) liest `q.unitId` aus der Projektion; sie folgt einem neuen Ereignis, das
  `unitId` setzt, ohne Codeänderung. `apps/api/src/metrics/catalog.json` nennt als Quelle von `hv_open_questions` nur
  „QuestionAssigned“ (Text, Folgeliste).
- **Oberfläche.** `ACTION_KEYS` (`apps/web/src/i18n/labels.ts:52`) ist `Record<Permission, TKey>`, die Ereignisnamen
  (`labels.ts:~121`) `Record<EventType, TKey>`; `WRITE_METHODS` in `liveStore.ts:86-96` ist `satisfies Record<WriteMethodName,
  true>`. Ein neues Recht, ein neuer Ereignistyp und eine neue Schreibmethode erzwingen also Einträge. Keine Ansicht rendert
  `_actions` generisch; ohne 053/054 erscheint keine Schaltfläche. Paritätstest: 553 Schlüssel je Sprache
  (`parity.test.ts:165`).
- **Begriffe.** Seit 020 heißt `question.submit_review` in der Oberfläche „Weiterleiten“ (`shell.de.ts:185`, Glossar Zeile 50).
  Das Rechtekonzept verwendet `question.forward` in §2.1 (Zeile 62) und §2.4 (Zeile 119–122) für das allgemeine Weiterleiten
  mit rechteabhängigem Zielstatus aus der Ist-Analyse (`ist-analyse-und-schnittstellen.md:82`); im Code sind das
  `question.assign`, `question.submit_review` und `question.return`. Zeile 11 nennt `question.assign` der Administration
  „Weiterleiten“. 048 gibt `question.forward` die engere Bedeutung „an einen anderen Fachbereich“.
- **Recherche.** `:220` (MUSS): „Mehrfachzuweisung mit einem federführenden Bereich, jedes Umrouten mit Historie“; `:95`
  (MUSS): Need-to-know-Routing; `:81` (SOLL) und `:449` (MUSS): Auskunftsschuldner als Funktion (Vorstand, AR-Vorsitz,
  Abschlussprüfer); `:446` (MUSS): RACI je Prozessschritt mit genau einem Accountable.
- **Seed** enthält kein Weiterleiten; er bleibt unverändert.

## Ziel und Entscheidungen vor Bau

Eine Frage in Beantwortung (`assigned`, `answer_drafted`, `in_review`) lässt sich mit Pflichtgrund an einen anderen
Fachbereich weiterleiten. Status, Antwortversionen, Rechtsfreigabe und Freigabe bleiben unberührt; nur der zuständige
Fachbereich wechselt, und das Protokoll hält fest, wer, wann, von wo, wohin und warum. Weiterleiten dürfen die Koordination
und die Fachkräfte des aktuell zuständigen Fachbereichs. **Auf Standard gebaut:** E5 ist offen (Eigentümerfrage 1).

### 1. Recht (`packages/domain/src/types.ts`, `permissions.ts`)

- `PERMISSIONS` erhält `question.forward` **unmittelbar nach `question.assign`**. Die Stelle bestimmt die Spaltenreihenfolge
  der Wahrheitstabelle.
- `ROLE_PERMISSIONS`: `coordination` und `expert` (im `unitBound`-Bündel) erhalten `question.forward`. **Keine andere
  Rolle**: nicht admin (ausdrückliche Liste seit 040a; die Administration leitet mit `question.assign` und `question.return`
  weiter, nimmt aber keinen Arbeitsschritt), nicht `approver`, nicht `legal`, nicht `moderation`, `capture`, `podium`,
  `observer` (Eigentümerfrage 3).
- „Fachkraft des aktuellen Fachbereichs“ ist **keine neue Regel**, sondern die bestehende Einheitsbindung in `can()`
  (R-PERM-03, `api.ts:224`): Ein gebundenes `expert` erreicht eine Frage einer anderen Einheit gar nicht (404). Kein
  Rollenname außerhalb von `ROLE_PERMISSIONS` (AGENTS.md R4).

### 2. Übergangszeile R-TRANS-17 (`transitions.ts`)

| Regel | Aktion | von | nach | Guards |
|---|---|---|---|---|
| **R-TRANS-17** | `question.forward` | `assigned`, `answer_drafted`, `in_review` | unverändert (`to: (q) => q.status`) | R-GUARD-03 (`isTextTrack`), R-GUARD-15 |

- `description`: „Forward to another answering unit (An anderen Fachbereich weiterleiten) with a reason. Status, answer
  versions, legal clearance and approval stay; only the unit changes.“
- `legalRef`: `source: 'Recherche'`; `citation` nennt `docs/anforderungen-recherche.md:220` („jedes Umrouten mit Historie“)
  und `docs/ist-analyse-und-schnittstellen.md:82` (Weiterleitung über einen Button). **Teilweise:** keine Mehrfachzuweisung,
  kein federführender Bereich, genau eine Einheit (`unitId`). **Ableitung (Spec 048):** Status bleibt; nicht aus
  `approved`, `staged` oder `delivered`. Abschluss: „Auf Standard gebaut (E5 offen).“ `docVersion: null`, `docHash: null`,
  `verified: false` (Ehrlichkeitsregel `rules.ts:5-16`).

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
  Zuweisung, R-TRANS-03 aus `classified`) kann an jeden Fachbereich weitergeleitet werden.
- `legalRef`: `source: 'Prozess'`; „Ableitung (Spec 048): ein Weiterleiten an denselben Fachbereich ändert nichts und schriebe
  nur einen Grund ohne Wirkung ins Protokoll. Nicht belegt.“ `verified: false`.
- Bekannte Grenze: Ein Jahrgang mit genau einem Fachbereich zeigt `question.forward` in `_actions`, jeder Versuch endet mit 409
  R-GUARD-15. Hingenommen (Standards).

### 4. Ereignis `QuestionForwarded` (`events.ts`, `envelope.ts`, `state.ts`)

- Typ: `Base<'QuestionForwarded', { unitId: string; fromUnitId?: string; reason: string }>`. `fromUnitId` fehlt, wenn die Frage
  keinen Fachbereich hatte; `reason` ist getrimmt. Neu in der Union `DomainEvent` und in `EVENT_TYPES` (`envelope.ts`).
- Aufbewahrungsklasse: Standard (`working`), wie `QuestionAssigned` und `QuestionReturned`.
- **Reduzierer:** `q.unitId = payload.unitId`; `delete q.claim`; `touch(q, e.at)`. **Nichts sonst:** Status, `answers`,
  `approval`, `legalClearance`, `legalClearerIds`, `returnReason`, `seatId`, `stagePosition` bleiben. `refreshCounts` verschiebt
  `counts.byUnit` von selbst.
- **Warum der Claim fällt:** Er gehört einer Person des alten Fachbereichs und würde die neue Einheit bis zu zehn Minuten mit
  409 R-CLAIM-01 sperren. Das Ereignis `QuestionClaimed` bleibt im Protokoll (R7).
- **Der Grund steht nur im Ereignis**, nicht in der Projektion, nicht in `returnReason`, nicht in der Suche, nicht auf der
  Bühne, nicht in Zählern. Wer ihn liest: Halter von `history.read` über `getQuestionHistory` (für ein gebundenes `expert`
  nur, solange die Frage in seiner Einheit liegt, also nach dem Weiterleiten die Zieleinheit) und Halter von `event.read`
  über `listEvents` und `/stream`. Keine Maskierung, wie beim Rückgabegrund (Eigentümerfrage 5).

### 5. Operation `forwardQuestion` (`api.ts`, `types.ts`)

- `HvApi.forwardQuestion(id: string, input: ForwardRequest, opts?: WriteOptions): Promise<Question>`; Typ
  `ForwardRequest = { unitId: string; reason: string }` in `types.ts` (Vertrag `ForwardRequest`, geschlossen).
- **Prüfreihenfolge** (Vorbild `assignQuestion` `api.ts:1366` und `returnQuestion`):
  1. 422 aus dem Kern, ohne Ereignis und ohne Wiederholung der Eingabe in der Meldung: `unitId` keine Zeichenkette, leer oder
     länger als 128 Code-Punkte; `reason` keine Zeichenkette, nur Leerraum oder länger als 500 Code-Punkte. Längen mit
     `codePointLength` (044b), damit Validator und Kern gleich zählen.
  2. 422, wenn `unitId` kein Fachbereich des Jahrgangs ist (Stammdaten, für jeden Angemeldeten lesbar; die Meldung nennt die
     id wie bei `assignQuestion`).
  3. `transition(id, 'question.forward', opts, { unitId }, build)`: zuerst Wiederholung mit gleichem Schlüssel, dann 404 bzw.
     403 R-PERM-01, dann 404 für ein gebundenes `expert` einer anderen Einheit, dann `If-Match` (428, 422, 412), zuletzt 409
     aus Tabelle und Guards (R-TRANS-00, R-GUARD-03, R-GUARD-15).
- `build` schreibt genau ein `QuestionForwarded` mit `unitId`, `fromUnitId` (nur, wenn `q.unitId` gesetzt ist) und dem
  getrimmten `reason`. Den Zielstatus liest der Reduzierer nicht aus dem Ereignis: Er bleibt, die Tabelle sagt es (R5).
- **Antwort nach dem Weiterleiten aus dem eigenen Bereich** (gebundenes `expert`): 200 mit der Ansicht der Frage, wie jede
  Schreibantwort; `_actions` ist leer, weil `can()` nun R-PERM-03 meldet. Neue Inhalte erfährt der Akteur nicht: Er hat die
  Frage einen Augenblick vorher gelesen, neu ist nur der von ihm selbst gewählte Fachbereich. Ein folgendes `getQuestion` ist
  404, die Liste enthält die Frage nicht mehr. **Eine Wiederholung mit demselben `Idempotency-Key` ist 404** (`authorizeReplay`
  prüft die aktuelle Lesbarkeit); das Ereignis entsteht kein zweites Mal. Das ist gewollt und belegt (Test 9); 054 behandelt
  404 nach einem Netzfehler beim Weiterleiten als „weitergeleitet oder nicht mehr sichtbar“.
- `operationPermission` und `legacyEventType` in `api.ts` bleiben unverändert: Neue Ereignisse tragen `commandId`, die
  Wiederholung findet sie über `commandOperation`.

### 6. Strom (`stream.ts`)

- `CHANGE.QuestionForwarded = ['meeting', 'questions', 'stage']` (wie `QuestionAssigned`; `counts.byUnit` ändert sich).
- `EVENT_SUBJECTS.QuestionForwarded = questionStatus`.
- `SCOPE_EXIT_EVENTS` erhält `QuestionForwarded`: Nach dem Weiterleiten verlässt die Frage den Lesebereich der alten Einheit;
  ein Nachholen setzt für deren Leser zurück (M3 aus 035a). Ohne diesen Eintrag sähe ein gebundenes `expert` der alten Einheit
  im Puffer einen veralteten Stand (Test 13).

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
  another unit“. Bewusst nicht „Weiterleiten“ allein: Das bleibt nach E5 der nächste Schritt (`question.submit_review`, Z9).
- Ereignisname `event.QuestionForwarded`: DE „An anderen Fachbereich weitergeleitet“, EN „Forwarded to another unit“.
- `eventSummary.ts`, Fall `QuestionForwarded`: mit `fromUnitId` der neue Schlüssel `history.payload.unitChange` (DE
  „Fachbereich: {from} → {to}“, EN „Answering unit: {from} → {to}“), ohne `fromUnitId` der bestehende
  `history.payload.unit`; dazu der Grund über den bestehenden `history.payload.reason`. Namen der Fachbereiche über die
  vorhandene Auflösung `unit()`.
- `http.ts`: `forwardQuestion` → `write('post', '/questions/{questionId}/forwards', { params, body: input, write })`.
  `liveStore.ts`: `forwardQuestion: true` in `WRITE_METHODS`.
- Paritätstest 553 → **556** (drei Schlüssel je Sprache). Keine Schaltfläche, kein Dialog, keine neue Ansicht (053, 054).

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

**Regelregister** (`docs/legal-trace.md`): zwei neue Zeilen R-GUARD-15 und R-TRANS-17, sonst unverändert.

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6, 043a Regel 1)

Additiv, **eine neue Operation**; kein bestehendes Anfrageschema wird erweitert oder verengt, kein Feld wird Pflicht.

- **Version:** nächste freie Patch-Stufe beim Merge (heute 0.4.3; 043a: ein additiver Teil des 0.4-Zyklus hebt die
  Patch-Stufe). `info.version`, `packages/contract/package.json`, Abschnitt `## [0.4.3]` in `CHANGELOG.md` mit `### Added`
  und dem Vermerk „auf Standard gebaut (E5 offen)“.
- **Pfad** `POST /questions/{questionId}/forwards`, `operationId: forwardQuestion`, `tags: [questions]`, `summary`: „Forward a
  question to another answering unit (An anderen Fachbereich weiterleiten)“. Parameter wie `assignQuestion`:
  `IdempotencyKey`, `CsrfToken`, `IfMatchRequired`. Antworten wie `assignQuestion` (200 `QuestionUpdated`, 401, 403, 404, 408,
  409, 412, 413, 422, 428, 429, 500, 503).
- **Schema `ForwardRequest`:** `type: object`, `additionalProperties: false`, `required: [unitId, reason]`, `unitId: { type:
  string, minLength: 1, maxLength: 128 }`, `reason: { type: string, minLength: 1, maxLength: 500 }`.
- **Beschreibung der Operation:** Status, Antwortversionen, Rechtsfreigabe und Freigabe bleiben; nur der Fachbereich wechselt;
  ein Claim entfällt. 409: R-TRANS-00 (nur aus `assigned`, `answer_drafted`, `in_review`), R-GUARD-03 (nur Textpfade),
  R-GUARD-15 (Ziel ist der aktuelle Fachbereich). 422: Form und Länge (Validator und Kern in Code-Punkten), Grund nur aus
  Leerraum (Kern), unbekannter Fachbereich (Kern). 404 auch für eine Fachkraft, deren Fachbereich die Frage nicht hält.
  Nach einem Weiterleiten aus dem eigenen Fachbereich ist eine Wiederholung mit demselben `Idempotency-Key` 404.
- **`Action`-Enum:** `question.forward` unmittelbar nach `question.assign`.
- **`Event.type`-Enum:** `QuestionForwarded` nach `QuestionAssigned`; Beschreibung der Nutzlast `{ unitId, fromUnitId?,
  reason }`, `reason` ungemaskt in `EventRead` (wie der Rückgabegrund), nie in `Question`.
- **Typen:** `pnpm contract:types` regeneriert `packages/contract/src/types.ts`; ein zweiter Lauf ergibt keinen Diff.
- **Tore:** `pnpm contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`, (c) mit `0.4.2 -> 0.4.3`. Die Versionszeilen in
  `contract.test.ts:90` und `takt-019-contract.test.ts:8` ziehen nach.
- Ist beim Baustart schon eine andere 0.4.x-Stufe gemergt, nimmt dieser Schritt die nächste.

## Nicht-Ziele

- Kein Dialog, keine Schaltfläche, keine Ansicht (054 Fokusansicht, 053 Steuerung). Kein Screenshot.
- Kein Auskunftsschuldner (048b), keine Inhaltssprache (055, E21).
- Keine Umbenennung von `submitForReview`, `QuestionSubmittedForReview` oder `question.submit_review` (E5, Standard).
- Kein Weiterleiten an eine Person oder Kollegin (E5 fragt danach; Zuweisung an Personen ist Recherche `:221`, nicht Teil
  dieser Scheibe); keine Mehrfachzuweisung, kein federführender Bereich.
- Keine Begrenzung der Weiterleitungen je Frage (Folgeliste), keine Benachrichtigung der Zieleinheit (085).
- Keine Änderung an R-TRANS-02, an anderen Zeilen oder Guards, an Maskierung, Zugriffslog, Kennzahlenkatalog, Seed,
  Persistenzschicht oder Migrationen.
- Keine Attributregel für Vertraulichkeit (047).

## Files allowed

Vertrag (erster Commit, Architekt):

- `packages/contract/openapi.yaml` (nur Pfad forwards, Schema ForwardRequest, Action-Eintrag, Event.type-Eintrag, info.version)
- `packages/contract/src/types.ts` (nur regeneriert)
- `packages/contract/CHANGELOG.md` (nur Abschnitt 0.4.3)
- `packages/contract/package.json` (nur Version)

Kern:

- `packages/domain/src/types.ts` (nur PERMISSIONS und Typ ForwardRequest)
- `packages/domain/src/permissions.ts` (nur coordination und expert)
- `packages/domain/src/transitions.ts` (nur R-TRANS-17 und R-GUARD-15)
- `packages/domain/src/events.ts` (nur QuestionForwarded)
- `packages/domain/src/envelope.ts` (nur EVENT_TYPES)
- `packages/domain/src/state.ts` (nur der Fall QuestionForwarded)
- `packages/domain/src/stream.ts` (nur CHANGE, EVENT_SUBJECTS, SCOPE_EXIT_EVENTS)
- `packages/domain/src/api.ts` (nur HvApi.forwardQuestion und ihre Umsetzung)
- `packages/domain/policy-truth-table.md` (generiert)
- `docs/legal-trace.md` (generiert)
- `packages/domain/src/__tests__/forward048.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur Eintrag R-GUARD-15 in GUARD_SCENARIOS)
- `packages/domain/src/__tests__/stream035.test.ts` (nur, falls er Ereignistypen vollständig aufzählt)

Dienst:

- `apps/api/src/app.ts` (nur eine Route und der Typimport ForwardRequest)
- `apps/api/src/__tests__/forward048.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/postgres-forward048.test.ts` (neu, mit Postgres)
- `apps/api/src/__tests__/contract.test.ts` (nur Versionszeile)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur Versionszeile)

Oberfläche (nur Typzwang und Historie):

- `apps/web/src/api/http.ts`
- `apps/web/src/api/http.test.ts`
- `apps/web/src/api/liveStore.ts` (nur WRITE_METHODS)
- `apps/web/src/i18n/labels.ts` (nur ACTION_KEYS und Ereignisname)
- `apps/web/src/i18n/shell.de.ts`
- `apps/web/src/i18n/shell.en.ts`
- `apps/web/src/i18n/history.de.ts`
- `apps/web/src/i18n/history.en.ts`
- `apps/web/src/i18n/parity.test.ts` (nur 553 → 556)
- `apps/web/src/features/history/eventSummary.ts`
- `apps/web/src/features/history/eventSummary.test.ts`

Dokumente:

- `docs/rollen-und-rechtekonzept.md` (nur ein Kopfvermerk „Scheibe 048“ nach dem Vermerk zu 044a)
- `docs/glossar.md` (nur Zeile „Weiterleiten“ und eine neue Zeile „An anderen Fachbereich weiterleiten“)
- `docs/sicherheit/bedrohungsmodell.md` (nur Zeile 048 in „Weitere Scheiben mit Sicherheitsbezug“ und neuer Missbrauchsfall MF-14)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V4: Weiterleiten mit Freitextgrund)
- `docs/folgeliste.md` (nur die Einträge aus „Hinweise an den Orchestrator“ und nicht blockierende Befunde des Baus)
- `docs/slices/048-weiterleiten-fachbereich.md` (diese Spec: Bericht, Review findings)
- `docs/produktplan-beta.md` (nur durch den Orchestrator mit dem Merge: Stand-Zeile)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/contract/allowlist.json`, `packages/contract/scripts/**`, `packages/domain/src/seed.ts`,
`packages/domain/src/indicators.ts`, `packages/domain/src/refusalGrounds.ts`, `packages/domain/src/rules.ts`,
`apps/api/src/metrics/**`, `apps/api/src/observability/**`, `apps/api/src/persistence/**`, `apps/api/migrations/**`,
`apps/api/src/validate.ts`, `apps/web/src/features/**` außer der History-Zusammenfassung, `apps/web/e2e/**`,
`.github/workflows/**`, `scripts/**`, `docs/adr/**`. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“.

## Vor dem Bau prüfen

1. 045 gemergt (`c0db7f5`) und Vertrag 0.4.2; `PERMISSIONS` enthält `question.forward` nicht; R-TRANS-17 und R-GUARD-15 sind
   frei. Sonst: anhalten, nächste freie Nummer nehmen und melden.
2. Eigentümerfrage 1 (E5): Lautet die Antwort „nur zum nächsten Schritt“, entfällt diese Scheibe; der Architekt legt das im
   Register ab. Ohne Antwort gilt der Standard.
3. Gebundene Fachkraft im Test (Muster 044b, Vor-dem-Bau-Punkt 3): Im Kern genügt ein Akteur `{ id, role: 'expert', unitId,
   assignmentScoped: true }`. Über HTTP entsteht er durch eine Rollenzuordnung mit `unitId` (admin, `assignRole`) und eine
   Subject-id, die im Seed nicht vorkommt. Fehlt der Weg: Befund, der Fall bleibt im Kern belegt.
4. `eventSummary.ts` hat einen `default`-Zweig? Dann erzwingt die Typprüfung den Fall nicht; Test W1 belegt ihn trotzdem.
5. Weichen Zeilenangaben ab: melden, nicht raten.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/forward048.test.ts`; Seed mit injizierter Uhr; Koordination `coo48`, Fachkräfte
gebunden an `unit-fin`, `unit-hr`, `unit-esg`; Grundtext mit Marke `GRUND48X`):

1. **Rechte als Daten.** `question.forward` steht direkt nach `question.assign`; die Halter, aus `ROLE_PERMISSIONS`
   berechnet, sind genau `coordination` und `expert`; die Liste von admin ist unverändert.
2. **R-TRANS-17 je Ausgangsstatus.** Aus `assigned`, `answer_drafted` und `in_review` (dort mit Rechtsfreigabe der letzten
   Version): Status gleich, `unitId` neu, `answers`, `approval`, `legalClearance`, `returnReason` und `seatId` unverändert; genau
   ein Ereignis `QuestionForwarded` mit `fromUnitId`, `unitId` und getrimmtem `reason`. Ohne vorherigen Fachbereich fehlt
   `fromUnitId`.
3. **R-TRANS-00.** Aus `captured`, `classified`, `approved`, `staged`, `delivered`, `closed`, `withdrawn`, `merged`: 409
   R-TRANS-00, kein Ereignis.
4. **R-GUARD-15.** Ziel = aktueller Fachbereich: 409 R-GUARD-15, kein Ereignis. `_actions` enthält `question.forward` trotzdem
   (ohne Nutzlast erfüllbar).
5. **R-GUARD-03.** Eine Podiumsfrage in `assigned` (über ein direkt angehängtes Ereignis konstruiert): 409 R-GUARD-03.
6. **422 ohne Ereignis.** Unbekannter Fachbereich; `reason` leer, `"   "`, 501 Code-Punkte; `unitId` leer oder 129 Code-Punkte;
   `reason` aus 500 Vier-Byte-Zeichen gelingt. Keine Meldung enthält `GRUND48X`.
7. **Rechte.** `moderation`, `capture`, `legal`, `approver`, admin: 403 R-PERM-01; `podium`, `observer`: 404. Kein Ereignis.
8. **Einheitsbindung.** Gebundene Fachkraft `unit-fin` leitet eine `unit-fin`-Frage an `unit-hr`: 200, `_actions` leer; danach
   `getQuestion` 404 und `listQuestions` ohne die Frage; die Fachkraft `unit-hr` sieht sie mit `question.forward` in
   `_actions`. Die Fachkraft `unit-esg` auf derselben Frage: 404, kein Ereignis.
9. **Idempotenz.** Koordination wiederholt mit gleichem Schlüssel: gleiche Antwort, ein Ereignis. Die gebundene Fachkraft aus
   Test 8 wiederholt nach dem Weiterleiten: 404, weiterhin genau ein Ereignis.
10. **If-Match.** Ohne: 428; veraltet: 412; kein Ereignis.
11. **Claim.** Fachkraft A (`unit-fin`) hält einen Claim; die Koordination leitet weiter: `claim` fehlt in der Projektion; die
    Fachkraft `unit-hr` kann sofort beanspruchen.
12. **Zähler.** `counts.byUnit` verschiebt sich um eins; `computeIndicators(...).openQuestionsByUnit` folgt; eine Frage in `in_review` zählt weiter in der Rechtsprüfungskennzahl.
13. **Strom.** `SCOPE_EXIT_EVENTS` enthält `QuestionForwarded`; ein Abonnent als gebundene Fachkraft `unit-fin` erhält ein
    Änderungssignal ohne Inhalt; ein Abonnent mit `event.read` erhält das Ereignis mit Grund; `EVENT_SUBJECTS` nennt Frage und
    Jahrgang.
14. **Lesepfade des Grunds.** `getQuestionHistory` als Koordination enthält `QuestionForwarded` mit Grund; `listQuestions` mit
    `q=GRUND48X` liefert 0; `getStage` und die Ansicht der Frage enthalten `GRUND48X` nirgends.
15. **Umschlag.** Ein Log mit `QuestionForwarded` besteht Stempeln und Laden mit Kettenprüfung; ein Typ mit Tippfehler nicht.
16. **Tabelle.** `transitions.test.ts` belegt R-TRANS-17 (Zeilentest) und R-GUARD-15 (Szenario erfüllt/verletzt); Snapshot der
    Wahrheitstabelle und des Regelregisters nach dem Diff oben.

**Dienst ohne Postgres** (`apps/api/src/__tests__/forward048.test.ts`; `createApp({ demoEnabled: true, clock, accessLog })`,
Seed über `POST /v1/demo/seed`, alle Aufrufe über `req()` mit Antwortprüfung gegen den Vertrag):

- **H1** 200 als Koordination; neue `ETag`; `/v1/events` als admin zeigt `QuestionForwarded` mit Grund.
- **H2** 401 ohne Akteur.
- **H3** 403 R-PERM-01 als `approver`, `legal`, admin; 404 als `podium` und für eine unbekannte id.
- **H4** 422 des Validators: `reason` fehlt, `""`, 501 Zeichen; `unitId` fehlt; zusätzliches Feld. 422 des Kerns: `"   "`,
  unbekannter Fachbereich. Reihenfolge wie 044b §2: Validator vor Recht.
- **H5** 409 R-TRANS-00 aus `approved`; 409 R-GUARD-15.
- **H6** 428 ohne `If-Match`, 412 veraltet.
- **H7** Wiederholung mit gleichem Schlüssel: gleiche Antwort, ein Ereignis.
- **H8** Gebundene Fachkraft über Rollenzuordnung (Vor-dem-Bau-Punkt 3): Weiterleiten aus dem eigenen Bereich 200 mit leeren
  `_actions`, danach `GET` 404; Fachkraft einer dritten Einheit 404.
- **H9** Zugriffslog eines abgewiesenen Weiterleitens: acht Schlüssel, `operationId` `forwardQuestion`, `status` 409, `seq`
  `null`; der Grund steht in keiner Logzeile.

**Dienst mit Postgres** (`apps/api/src/__tests__/postgres-forward048.test.ts`; ohne `TEST_DATABASE_URL` übersprungen, in CI
ausgeführt):

- **P1** Weiterleiten übersteht Neustart mit Kettenprüfung; nach dem Laden stimmen `unitId` und Status.
- **P2** Ein abgewiesenes Weiterleiten schreibt keine Zeile und genau eine Zugriffslogzeile mit `seq` `null`.

**Oberfläche:**

- **W1** `eventSummary.test.ts`: `QuestionForwarded` mit `fromUnitId` zeigt beide Fachbereichsnamen und den Grund, ohne
  `fromUnitId` nur das Ziel; DE und EN.
- **W2** `http.test.ts`: `forwardQuestion` sendet `POST /questions/{id}/forwards` mit Body, `If-Match` und `Idempotency-Key`.

**Mutationsproben** (je einmal lokal rot belegen, dann zurücknehmen): R-GUARD-15 aus der Zeile entfernen (Test 4 rot);
`to: 'assigned'` statt `q.status` (Test 2 rot); `QuestionForwarded` aus `SCOPE_EXIT_EVENTS` entfernen (Test 13 rot);
`question.forward` an admin (Test 1 rot).

## Akzeptanzkriterium

1. Tests 1–16, H1–H9, P1–P2, W1–W2 vor der Änderung rot (Ausgabe im Bericht), danach grün; die vier Mutationsproben rot belegt.
2. `policy-truth-table.md` weicht vom Ist genau um den Diff oben ab (neue Spalte, sechs ✓); `legal-trace.md` um zwei Zeilen.
3. Vertrag 0.4.3: `contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`; das Abdeckungstor meldet `forwardQuestion` als
   ausgeübt; `allowlist.json` unverändert.
4. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (`pnpm role-literals`); keine Statuslogik außerhalb der Tabelle; kein
   Literal in Komponenten (`pnpm i18n-literals`); Paritätstest 556; `pnpm vocabulary` grün.
5. `pnpm slice-scope` grün auf `claude/slice-048-…`.
6. `pnpm gates` mit Postgres-Variablen wie in CI grün auf einem sauberen Baucommit; Schluss einmal wörtlich im Bericht. Die
   Jobs `gates` und `e2e-http` der PR-CI grün auf dem letzten Commit.

## Nachweise

- Rote Testausgabe vor der Änderung, Schluss von `pnpm gates` mit Commit-Hash, Ergebnis der Mutationsproben.
- Diff von `packages/domain/policy-truth-table.md` und `docs/legal-trace.md` im PR.
- Auszug: eine `QuestionForwarded`-Zeile aus `/v1/events` (synthetischer Grund), eine Zugriffslogzeile aus H9.
- Grüne PR-CI (Lauf-ID) für P1–P2.
- **Kein Screenshot:** Keine Ansicht kann vor 054 weiterleiten; die einzige sichtbare Änderung (Zeile in der Historie) belegt
  W1 in beiden Sprachen. 054 zeigt sie auf seinen Screenshots.

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: hoch
Ausgelöst: [x] Fachregel, Status [x] Vertrag, Ereignis, Konfiguration [ ] Persistenz, Migration, Nebenläufigkeit (nur neuer
Ereignistyp, keine Migration) [x] Rolle, Recht, Identität, Schutzklasse [x] personenbezogene oder vertrauliche Daten
(Freitextgrund; Leserkreis wächst um die Zieleinheit) [ ] Betrieb, Wiederherstellung [ ] Administration [ ] Oberfläche,
Barrierefreiheit (nur Texte der Historie) [ ] Nachbarsystem [ ] KI, Agenten [x] Dokumentation, Schulung (Glossar,
Rechtekonzept)
Perspektive(n): Security, Datenschutz, Vertrag · Nachweise: oben · Offene Entscheidung: E5 (Standard: gebaut), E21 (Sprache in
055)

## Missbrauchsfälle (MF-14, neu im Bedrohungsmodell)

**MF-14 Weiterleiten als Umweg, Abschieben oder Offenlegung** (048; verwandt T-G1-I-01, MF-01)

| Fall | Abwehr | Erkennung | Nachweis |
|---|---|---|---|
| Fachkraft leitet eine Frage eines fremden Fachbereichs weiter | Einheitsbindung in `can()`, 404 | Zugriffslog: `forwardQuestion`, 404 | Test 8, H8 |
| Weiterleiten, um die Rechtsprüfung zu umgehen oder eine Freigabe aufzuheben | Status bleibt; nicht aus `approved`/`staged`/`delivered`; Rechtsfreigabe und Freigabe unberührt | — | Test 2, 3 |
| Hin und Her zwischen Fachbereichen, um eine Antwort zu verzögern | keine technische Grenze (Standard) | Historie zeigt jede Weiterleitung mit Grund; Leitstand (061): Alter der ältesten offenen Frage | Folgeliste: Zähler je Frage, nie je Person |
| Weiterleiten, um mehr Personen lesen zu lassen (Need-to-know, Recherche `:95`) | nur Koordination und die zuständige Fachkraft; Ziel ist ein Fachbereich des Jahrgangs | Historie | Restrisiko bis 047 (Vertraulichkeit) |
| Weiterleiten, um den Claim einer Kollegin zu brechen | gewollt: der Claim gehört dem alten Fachbereich | `QuestionClaimed` und `QuestionForwarded` im Protokoll | Test 11 |
| Personendaten im Freitextgrund | nicht in Projektion, Suche, Bühne, Zählern, Export; Hinweis im Dialog (054) | — | Test 14; DSFA V4 |

## Sicherheits-Checkliste (Antworten für den Reviewer)

- **Rechte als Daten?** Ja: ein Eintrag in `PERMISSIONS`, zwei in `ROLE_PERMISSIONS`; die Fachkraft-Bedingung ist die
  bestehende Einheitsbindung.
- **Übergang nur in der Tabelle?** Ja: R-TRANS-17 mit zwei Guards; der Reduzierer setzt keinen Status.
- **Ereignisse nur anhängend?** Ja: ein neues Ereignis; der Claim fällt nur in der Projektion.
- **Neuer Lesepfad?** Nein. Der Grund erreicht nur, wer heute den Rückgabegrund liest.
- **Antwort an einen Akteur, der die Frage danach nicht mehr lesen darf?** Ja, einmal, mit leeren `_actions` und nur dem
  Stand, den er selbst erzeugt hat (Entscheidung 5); Wiederholung 404.
- **Client-Angaben?** Nur `unitId` und `reason`; der Fachbereich wird gegen die Stammdaten geprüft, die Bindung der Fachkraft
  kommt aus der Rollenzuordnung, nie aus dem Client.
- **Zugriffslog?** Unverändert, acht Schlüssel.

## Aufwand

Geschätzt **2,75 AStd** (Spanne 2,25–3,25) statt 1,5 laut Plan für alle drei Themen:

| Teil | AStd |
|---|---|
| Vertragsschritt: Operation, Schema, `Action`, `Event.type`, Beschreibungen, CHANGELOG, Typen, Versionszeilen | 0,4 |
| Kern: Recht, Zeile, Guard, Ereignis, Umschlag, Reduzierer, Strom, Operation | 0,6 |
| Kerntests 1–16, Wahrheitstabelle, Regelregister, Mutationsproben | 0,6 |
| Dienst: Route, H1–H9, P1–P2 | 0,5 |
| Oberfläche: `http.ts`, `liveStore.ts`, sechs i18n-Schlüssel, `eventSummary` mit W1, W2 | 0,25 |
| Doku: Rechtekonzept, Glossar, Bedrohungsmodell (Zeile 048, MF-14), DSFA V4, Folgeliste | 0,2 |
| `pnpm gates`, Bericht | 0,2 |

Untere Grenze, wenn H8 über den Rollenweg ohne Hilfsarbeit läuft; obere Grenze, wenn der Strom-Test 13 einen eigenen
Aufbau braucht.

## Standards (auf Standard gebaut)

| Standard | Was 048 baut | Kosten einer späteren Änderung |
|---|---|---|
| E5: zusätzlich Weiterleiten an einen anderen Fachbereich; `submitForReview` behält Namen und Anzeige „Weiterleiten“ | diese Scheibe | Zeile entfernen: 0,5 AStd plus Wahrheitstabellen-Diff |
| Status bleibt beim Weiterleiten | `to: (q) => q.status` | `in_review → answer_drafted`: rund 0,25 AStd |
| Halter: Koordination und gebundene Fachkraft | zwei Einträge | weitere Rolle (z. B. `legal`): < 0,1 AStd plus Diff |
| Grund Pflicht, Freitext, höchstens 500 Zeichen, ungemaskt im Ereignis wie der Rückgabegrund | Schema und Kern | Grund im `pii`-Teil mit Leserkreis: rund 0,5 AStd |
| Grund nicht in der Projektion | nur Historie | Feld `forwardReason` an `Question`: Vertrag und Kern, rund 0,3 AStd |
| Claim entfällt beim Weiterleiten | Reduzierer | < 0,1 AStd |
| Keine Grenze der Weiterleitungen je Frage | — | Guard mit Zähler: rund 0,3 AStd |
| `question.forward` statt eines neuen Namens trotz anderer Bedeutung im Rechtekonzept §2.4 | Kopfvermerk; 052 bereinigt | Umbenennen vor dem Merge: < 0,1 AStd, danach Vertrag 0.5 |
| Bezeichnung „An anderen Fachbereich weiterleiten“ | i18n | Textänderung |

## Offene Eigentümerfragen

Keine blockiert den Bau; alle mit Standard.

1. **E5, Bedeutung „Weiterleiten“** (offen seit Frage 6, Antwort bis 09.10.2026). Standard: beides — „Weiterleiten“ bleibt
   der nächste Schritt (020), dazu diese Scheibe für die Übergabe an einen anderen Fachbereich; Ereignis- und Operationsnamen
   von `submitForReview` bleiben. Lautet die Antwort „nur nächster Schritt“, entfällt 048 (Vor-dem-Bau-Punkt 2); lautet sie
   „auch an eine Kollegin“, ist das eine Personenzuweisung (Recherche `:221`) und eine eigene Scheibe.
2. **Status nach dem Weiterleiten.** Standard: unverändert, auch aus `in_review`. Alternative: aus `in_review` nach
   `answer_drafted`, damit die neue Einheit nacharbeitet (rund 0,25 AStd, gleiche Wahrheitstabelle).
3. **Wer weiterleitet.** Standard: Koordination und die Fachkraft des zuständigen Fachbereichs (Plan). Nicht: Administration
   (040a), Freigabe, Recht. Soll Recht aus `in_review` weiterleiten können, < 0,1 AStd plus Diff.
4. **Risikoklasse.** Standard: hoch (neues Recht, Leitplanken §4). Herabstufen auf mittel (Plan) nur durch den Eigentümer mit
   der Zeile „Herabstufung freigegeben von … am …“ im Kopf.
5. **Grund.** Standard: Pflicht, Freitext, ungemaskt im Ereignis wie der Rückgabegrund, nicht in der Projektion. Alternative:
   Grund im `pii`-Teil (ADR 0009) mit Leserkreis wie die Begründung einer Verweigerung, rund 0,5 AStd.
6. **Auskunftsschuldner (048b).** Standard: eine **Funktion**, kein Mensch: `accountableSeatId` verweist auf einen Bühnenplatz
   des Jahrgangs (Vorstandsvorsitz, Finanzvorstand, AR-Vorsitz …); Standard = Bühnenplatz der Frage. Die Zuordnung Platz →
   Person bleibt hinter `admin.seats.manage` (040b). Alternative „Person“: neues personenbezogenes Feld mit Leserkreis,
   DSFA-Zeile, Klasse hoch, rund +1 AStd. Offen auch: Abschlussprüfer als Gast hat keinen Bühnenplatz (Recherche `:81`).
7. **Inhaltssprache.** Standard: nicht in 048; das reservierte Feld kommt mit 055 an der Antwortversion (Register E21). Ein
   Feld `language` an `Question` ohne Abnehmer wäre ein totes Feld.
8. **Zuschnitt.** Standard: 048 (diese Spec, Weiterleiten vollständig), 048b (Auskunftsschuldner, nach 048, nicht in der Kette
   E57), Sprache mit 055.

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

- Plan-Eintrag 048 (§5, Zeile 685–690): Klasse mittel → hoch, Aufwand 1,5 → 2,75 AStd für 048 plus 1,0–1,5 für 048b; Lanes
  core → contract, core, service, web-api, web-shell, web-history, docs; R-TRANS-13 → R-TRANS-17 und R-GUARD-15; Abhängigkeit
  043 → 044b (Vertrag 0.4.2) und 040b; „Feld language“ streichen (E21: 055); „accountable … genau eine Person oder Funktion,
  RACI-Accountable“ ersetzen durch „Funktion (Bühnenplatz)“, mit Verweis auf Eigentümerfrage 6. Nicht Teil dieser Spec.
- Register E5: R-TRANS-13 → R-TRANS-17; Plan §3 Zeile 198 ebenso (043a, Folgelisten-Eintrag 1, zum Teil erledigt).
- Folgeliste (Einträge legt der Bau an): Quelle von `hv_open_questions` im Kennzahlenkatalog um `QuestionForwarded` ergänzen
  (Text); Zähler „Weiterleitungen je Frage“ für den Leitstand (aggregiert, nie je Person); Rechtekonzept §2.1/§2.4 auf die
  Bedeutung von `question.forward` bereinigen (052).

## Hinweise an Folgescheiben

- **054 (Fokusansicht):** primäre Aktion bleibt „Weiterleiten“ zum nächsten Schritt (`question.submit_review`, Z9); „An
  anderen Fachbereich weiterleiten“ ist die zweite Aktion im Dialog, nur wenn `_actions` `question.forward` enthält. Auswahl
  aus `listUnits` ohne den aktuellen Fachbereich; Grund Pflicht (500 Zeichen) mit Hinweis „keine Namen von Personen“. Nach
  Erfolg verschwindet die Frage aus „Meine Fragen“, ohne neu zu laden; 404 nach einem Netzfehler beim Weiterleiten heißt
  „weitergeleitet oder nicht mehr sichtbar“. Den letzten Weiterleitungsgrund liest die Ansicht aus der Historie.
- **053 (Steuerung):** Koordination erhält Zuweisen und Weiterleiten; die Matrix aus `counts.byUnit` folgt ohne eigenen Code.
- **047 (Vertraulichkeit):** Weiterleiten einer `protected`-Frage erweitert den Leserkreis; Attributregel oder Guard dort,
  nicht hier.
- **061 (Leitstand):** „Rückstand je Fachbereich“ folgt der Projektion.
- **052 (Rechtekonzept umbasieren):** `question.forward` = an einen anderen Fachbereich; §2.4 auf `question.assign`,
  `question.submit_review`, `question.return` umschreiben.
- **055:** reserviertes Feld `language` an der Antwortversion (E21).
- **069 und alle weiteren:** Regel-ids nach der nächsten freien Nummer zum Zeitpunkt der Spec (R-TRANS-17 ist ab 048 belegt).

## Bericht (nach Bau ausfüllen)

## Review findings
