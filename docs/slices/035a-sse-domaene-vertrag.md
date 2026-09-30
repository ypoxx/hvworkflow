# Scheibe 035a — SSE-Strom, Teil 1: Vertrag und Sichtbarkeit in der Domäne (R-PERM-04)

**Status:** spec (überarbeitet nach dem Lesebefund vom 30.09.2026 zu `9f2560c`; Teil 1 der geteilten Scheibe 035)
**Risikoklasse:** hoch · 1,25 AStd · 28.10.2026 (W5) · Lanes: domain; contract nur Architekt
**Rolle:** domain-implementer; Architekt für den Vertrag (vor dem Bau); Review in frischem Kontext mit Perspektive Security, Lesebefund der Spec vor dem Bau, nie gebündelt; Sicherheits-Checkliste des Reviewers (Abschnitt unten) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** neu **R-PERM-04** (Stromsichtbarkeit: je Ereignis, je Leser, mit den Rechten zum Zustellzeitpunkt); angewandt R-PERM-01, R-PERM-02, R-PERM-03 (über `can()`); AGENTS.md R4, R5, R6, R7, R12
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/035 (am 30.09.2026 vom Orchestrator in 035a/035b geteilt); ADR 0014, ADR 0011, ADR 0002, ADR 0015; Scheibe 010 (Festlegungen 1 und 5); Lesebefund zu Spec 035/036 (Opus, 30.09.2026: B1, M1–M9, m1–m12); Bedrohungsmodell T-G1-I-09, T-G3-I-01, SG1, SG2
**Depends on:** 023, 010, 024 (im Code auf `59ef4fd`)
**Perspektive:** Security (Leserechte) · **Glossar: neue Begriffe:** nein (Arbeitsbegriffe „Änderungssignal“, „Thema“ nur in Spec und Code)

## Teilung und Zuschnitt

Scheibe 035 aus dem Plan ist geteilt:

- **035a (diese Spec):** Vertrag, reine Domänenfunktionen für die Sichtbarkeit, erweitertes `HvApi.subscribe`. Kein
  Dienstcode.
- **035b** (`docs/slices/035b-sse-dienst.md`): Verteiler, Route, Grenzen, Sitzungs- und Akteurprüfung, Postgres-Tests,
  Allowlist-Eintrag entfernen.

Die Planzeile bleibt unverändert; nach dem Merge folgt nur die Stand-Zeile.

## Warum hoch

- Eine neue Leseregel (R-PERM-04) gibt Rollen ohne `event.read` ein Änderungssignal. Das ist eine Rechteänderung im
  Sinne von Leitplanken §4 („Rollen, Rechte“), auch wenn `ROLE_PERMISSIONS` unverändert bleibt.
- Ein Fehler in der Sichtbarkeitsfunktion ist ein Leck von SG1/SG2 (Entwürfe, Rechtseinschätzungen) an Leser ohne
  Leserecht (T-G1-I-09 a, T-G3-I-01).

Die Plan-Klasse „mittel“ wird damit hochgestuft, nicht herabgestuft. Die Sichtbarkeitstabelle steht vor dem Bau in
dieser Spec (Leitplanken §4: Rechte-Diff vor dem Bau). Ihre Freigabe ist Eigentümerfrage 1.

## Befund (Ist-Stand, gelesen auf `59ef4fd`)

- **Vertrag:** `GET /stream` (`streamEvents`) ist vorab erklärt (`packages/contract/openapi.yaml:837-866`, Allowlist bis
  25.11.2026): `after` über `#/components/parameters/After` (dort `default: 0`), `meetingId`, `Last-Event-ID` (Muster
  `^[0-9]+$`, ohne Längengrenze). Nicht modelliert sind Nachrichtenarten außer `EventRead`, Obergrenzen, Stromende und
  404.
- **Rechte:** Nur `admin` hält `event.read` (`packages/domain/src/permissions.ts:22-77`). `listEvents` prüft nur
  `event.read` und maskiert mit der Closure `maskEvent` (`packages/domain/src/api.ts:343-360, 1207-1210`). Wörtlich
  genommen („wie die Leserechte aus 010“) könnte nur `admin` den Strom lesen. ADR 0014 und 036 brauchen ihn für alle
  Rollen.
- **Abonnement im Prozess:** `subscribe` (`api.ts:1227-1245`) gibt Lesern ohne `event.read` `[]` und prüft bei jeder
  Zustellung gegen den aktuellen Akteur. `actor()` (`api.ts:320-331`) wirft 403 R-PERM-01 ohne aktive Zuordnung; im
  Hörer von `store.subscribe` würde dieser Fehler die Benachrichtigung abbrechen.
- **Akteur:** Die Closure `actor()` löst je Projektion auf. `sessionActorFromEvents` (`apps/api/src/actor.ts:86-118`)
  bildet dieselben Zustände je Jahrgang.
- **Bühne:** `getStage` wählt die Fragen der Bühne über ein Status-Literal in `api.ts` (Filter auf `staged`).
  `StageView` trägt `openCount` und `deliveredCount` aus `meeting.counts`.
- **Nebenwirkungen der Reduktion:** `QuestionCaptured` erhöht die Version des Redebeitrags (`state.ts:285-288`) und
  berührt Wortmeldung und `speakerListVersion`. `QuestionMerged` berührt auch die Zielfrage `intoQuestionId`.

## Ziel und Entscheidungen vor Bau

Die Domäne entscheidet als reine Funktion, was ein Leser aus einem Stapel von Ereignissen erfährt: vollständiges
Ereignis, Änderungssignal oder nichts. Dienst (035b) und Demo nutzen dieselbe Funktion. Der Vertrag beschreibt die
Nachrichten.

1. **Vertrag 0.3.11 (Architekt, vor jedem Code).**
   - Nachrichten: je ein SSE-Block mit `event:`, bei `event`, `change` und `cursor` auch `id:`, und genau einer
     `data:`-Zeile JSON.
     - `event`: `EventRead` wie `listEvents`, `id` = `seq`.
     - `change`: `StreamChange {seq, topics: StreamTopic[], subjects?: string[] (maxItems 100), meetingId?: string,
       replay?: true}`, `id` = `seq` des letzten abgedeckten Ereignisses.
     - `cursor`: `StreamCursor {seq}`, `id` = Kopf. **Wann (Codex P2):** (a) sofort nach dem Aufbau jedes Stroms als
       erste Nachricht nach `retry:`, wenn ohne Cursor geöffnet wird; (b) sofort nach einem abgeschlossenen Nachlauf
       (auch wenn dessen letzte Nachricht schon `id` = Kopf trug); (c) mit dem Heartbeat, wenn der Kopf nur durch
       unsichtbare Ereignisse vorgerückt ist. So hat jede Verbindung nach dem Aufbau eine gültige `id`.
     - `reset`: `StreamReset {lastSeq}`, **ohne `id`** (m1). Der Client darf seinen Cursor daraus nicht ableiten. Danach
       schließt der Dienst. **Ablauf nach `reset`:** Der Client verwirft seinen Stand und verbindet **ohne** Cursor neu
       (weder `after` noch `Last-Event-ID`). Er erhält sofort `cursor` mit dem Kopf (a). Die Beschreibung im Vertrag sagt
       ausdrücklich: Ein Client auf Basis von `EventSource` muss nach `reset` eine neue Instanz ohne `Last-Event-ID`
       anlegen. Die eingebaute Wiederverbindung würde die alte `id` senden und erneut `reset` erhalten.
     - `end`: `StreamEnd {reason}` mit `reason ∈ session | forbidden | roles_changed | rotate | unavailable`, ohne `id`.
     - Heartbeat: Kommentarzeile. Erste Zeile `retry: 3000`.
   - `StreamTopic` = `meeting | speakers | contributions | questions | stage | roles`.
   - **Parameter** (m2): Eigener Parameter `after` für `/stream`, `minimum: 0`, `maximum: 9007199254740991`, **ohne
     `default`**. Ohne Cursor beginnt der Strom am Kopf; `#/components/parameters/After` bleibt für `/events`.
     `Last-Event-ID` mit Muster `^[0-9]{1,16}$` und ausdrücklich höchstens `9007199254740991` in der Beschreibung (Wert
     darüber → 422).
   - **Antworten** (m2): `200 text/event-stream`, `401`, `403`, `404` (unbekanntes `meetingId`), `408`, `422`, `429`
     (Obergrenze je Sitzung oder Subject, `Retry-After` Pflicht), **eine** `503`-Antwort `StreamUnavailable` mit
     `Retry-After` Pflicht für beide Fälle, globale Stromgrenze und überlastete bzw. nicht bereite Persistenz.
   - **Beschreibung:** Rechte je Nachricht nach R-PERM-04 (Entscheidung 2). `event` global für jeden Leser, der
     `event.read` in irgendeinem aktiven Jahrgang hält (wie `listEvents`), lückenlos. `Last-Event-ID` gewinnt vor `after`.
     Nachlauf höchstens 1000, sonst `reset`. Cursor vor dem Kopf → `reset`. Stromende mit Gründen.
   - **CHANGELOG** (m3): Abschnitt 0.3.11 mit dem Hinweis, dass sich die Semantik der vorab erklärten, nie ausgelieferten
     Operation ändert: kein `default` für `after`, neue Nachrichtenarten, `reset`/`end` ohne `id`, 404 und 503
     `StreamUnavailable`. Der Allowlist-Eintrag bleibt bis 035b; 035a übt die Operation nicht aus.
   - `pnpm contract:types` regeneriert `packages/contract/src/types.ts`.
2. **Sichtbarkeit (R-PERM-04) in `packages/domain/src/stream.ts`.** Jede Entscheidung läuft über `can()`, nie über einen
   Rollennamen und nie über eine Erkennung der Art des Leseumfangs (M3).
   - **Datentabellen:**
     - `EVENT_TOPICS: Record<EventType, readonly StreamTopic[]>`: vollständig durch den Typ, konservative Obermenge.
     - `EVENT_SUBJECTS: Record<EventType, (e) => readonly SubjectRef[]>` (M2): `SubjectRef = {kind: 'question' |
       'speaker' | 'contribution' | 'roleAssignment' | 'meeting', id}`. Enthält **alle** berührten Gegenstände, auch die
       Nebenwirkungen: `QuestionCaptured` → Frage, Redebeitrag, Wortmeldung und Jahrgang (`speakerListVersion`);
       `QuestionMerged` → Frage und `intoQuestionId`; `ContributionCaptured` → Redebeitrag, Wortmeldung, Jahrgang; jede
       Statusänderung einer Frage → Frage und Jahrgang (Zähler).
     - `SCOPE_EXIT_EVENTS: ReadonlySet<EventType>` (M3) = `QuestionAssigned`, `QuestionDelivered`, `QuestionReturned`,
       `QuestionWithdrawn`, `QuestionMerged`, `QuestionClosed`: Ereignisse, nach denen eine Frage den Umfang eines
       Lesers verlassen kann.
   - **Geteiltes Bühnenprädikat** (m10): `isOnStage(q)` in der Domäne. `getStage` und `stream.ts` nutzen es. Es gibt
     kein zweites Status-Literal.
   - **Live-Stapel** `visibleMessages(readerActors, batch, before, after)`:
     - **`event`** für jedes Ereignis des Stapels, wenn der Leser `event.read` in **irgendeinem** aktiven Jahrgang hält
       (M5 (a), global wie `listEvents`). Dieselbe Maskierung wie `listEvents`: `maskEvent` wird aus der Closure in eine
       exportierte Funktion ausgelagert, keine zweite Kopie.
     - **`change`** für alle übrigen Leser: je Ereignis `e` mit `meetingId` und dem aufgelösten Akteur `a` des Lesers in
       diesem Jahrgang.
       - Themen `t ∈ EVENT_TOPICS[e.type]` nur, wenn `a` ein Leserecht für `t` hält (`READ_PERMISSIONS` der
         Lesemethoden von `t`, über `can()`). `meeting` gilt für jeden Leser mit aktiver Zuordnung (Festlegung 1 aus 010).
       - Für jeden Gegenstand aus `EVENT_SUBJECTS[e.type](e)`:
         - Frage: `can(a, 'question.read', q)` **vorher oder nachher** → `questions` plus Kennung.
         - Bühne: `can(a, 'stage.read')` und `isOnStage(q)` **vorher oder nachher** → `stage` plus Kennung. Das gilt für
           jede Rolle gleich (M9).
         - Wortmeldung und Redebeitrag über `speaker.read` bzw. `contribution.read`.
         - Zuordnung nur mit `admin.roles.manage` oder für den Leser selbst (`roles`).
       - **Zähler:** `meeting` ohne Kennung, wenn sich `meeting.counts` im Stapel ändert. `stage` ohne Kennung für
         Leser mit `stage.read`, wenn sich `openCount` oder `deliveredCount` ändert (M2).
       - Ohne sichtbares Thema entsteht keine Nachricht. `subjects` höchstens 100, darüber entfällt das Feld.
       - **Ein `change` je Stapel (Codex P2):** Die Beiträge aller Ereignisse eines Stapels (einer Zustellung von
         `store.subscribe` bzw. eines Nachladens im Verteiler) werden zu **einer** `change`-Nachricht zusammengeführt:
         `seq` = das letzte abgedeckte Ereignis des Stapels, Vereinigung der Themen und der Kennungen (höchstens 100,
         darüber ohne `subjects`). Beispiel: `captureQuestions` mit drei Einzelfragen hängt drei `QuestionCaptured` in
         einer Benachrichtigung an und ergibt eine Nachricht mit drei Kennungen. `event`-Nachrichten bleiben je Ereignis.
     - **Ereignisse ohne `meetingId`** gehen nur als `event` an Leser mit `event.read` (M4), nie als `change`.
   - **Nachlauf** `replayMessage(readerActors, events, stateNow)` für den Bereich `(cursor, Kopf]`, ohne historische
     Projektionen:
     - Leser mit `event.read`: alle Ereignisse als `event` (035b schreibt sie).
     - Übrige: Gegenstände werden **nur** mit `can(a, …, q_now)` bzw. `isOnStage(q_now)` geprüft (M3). Ist der Leser für
       `questions` oder `stage` **gegenstandsgebunden** und liegt ein Ereignis aus `SCOPE_EXIT_EVENTS` im Bereich, lautet
       das Ergebnis `reset` statt Nachlauf. Für `questions` heißt gegenstandsgebunden, bestimmt über `can()` auf Daten
       statt über die Art des Umfangs: Der Leser hält das Thema, und im aktuellen Zustand gibt es eine Frage, für die
       `can()` ihm die Lesung verweigert. **Für `stage` gilt jeder Leser mit `stage.read` als gegenstandsgebunden**
       (Entscheidung des Orchestrators, Nachprüfung 30.09.2026, Option a): Die Bühne ist über `isOnStage` immer an den
       Gegenstand gebunden, `can(a, 'stage.read')` prüft aber nicht je Frage. Für ihn führt jedes Ereignis aus
       `SCOPE_EXIT_EVENTS` **oder** `QuestionStaged` im Bereich zu `reset`. Sonst eine `change`-Nachricht mit `replay: true`, `id` = Kopf, Themen als Vereinigung wie
       live, `subjects` aus den jetzt lesbaren Gegenständen (höchstens 100).
   - **Akteur je Jahrgang:**
     - `resolveMeetingActor(state, current, now)`: die bisherige Closure `actor()`, ausgelagert, gleiches Verhalten.
     - `resolveReaderActors(states, subjectId, now): ReadonlyMap<meetingId, Actor>`: je Jahrgang mit aktiver Zuordnung
       der aufgelöste Akteur. Diese Karte ist die Referenz, gegen die 035b vergleicht (M4). Sie entsteht aus derselben
       Projektion, die auch die Sichtbarkeit bestimmt (M6).
   - **Sichtbarkeitstabelle (vor dem Bau, abgeleitet aus `ROLE_PERMISSIONS`; Freigabe = Eigentümerfrage 1):**

     | Rolle | `event` | `meeting` | `speakers` | `contributions` | `questions` | `stage` | `roles` |
     |---|---|---|---|---|---|---|---|
     | admin | ja (global, maskiert) | – | – | – | – | – | – |
     | moderation | nein | ja | ja | ja | ja | ja | nur eigene |
     | capture | nein | ja | ja | ja | ja | nein | nur eigene |
     | coordination | nein | ja | ja | ja | ja | nein | nur eigene |
     | expert | nein | ja | nein | nein | nur Fragen, die er vorher oder nachher lesen darf (eigener Fachbereich) | nein | nur eigene |
     | legal | nein | ja | nein | nein | ja | nein | nur eigene |
     | approver | nein | ja | nein | nein | ja | ja | nur eigene |
     | podium | nein | ja | nein | nein | nein | nur Fragen vorher oder nachher auf der Bühne; Zähler | nur eigene |
     | observer | nein | ja (Zähler, ohne Kennung) | nein | nein | nur `delivered`/`closed` | nein | nur eigene |

     „Bühne“ heißt für jede Rolle: Frage vor oder nach dem Stapel auf der Bühne (`isOnStage`), gelesen mit `stage.read`.
3. **Demo und In-Process (ADR 0002), `HvApi.subscribe`.** Die Signatur wird rückwärtsverträglich erweitert:
   `subscribe(listener: (events: ReadEvent[], change?: StreamChange) => void)`.
   - Die In-Process-Implementierung berechnet je Zustellung mit **derselben** Funktion gegen den aktuellen Akteur:
     Leser mit `event.read` erhalten wie bisher die Ereignisse, die übrigen `[]` plus `change`.
   - Wirft `actor()` (keine aktive Zuordnung, etwa nach Rollenwechsel im Umschalter), erhält der Hörer `[]` ohne
     `change`. Die Benachrichtigung der übrigen Hörer bricht nicht ab (m6).
   - Ein Ereignis ohne Hash wird wie heute übersprungen und über `onIntegrityError` gemeldet. Das Stromende mit
     `unavailable` im Dienst regelt 035b.
   - Für „vorher“ hält `subscribe` eine Kopie der Lesbarkeit der betroffenen Gegenstände vor dem Anhängen. Die Änderung
     liegt im Block `subscribe` und im Projektions-Hörer `store.subscribe` von `createInProcessApi` (`api.ts:300`,
     m6).
4. **Regelregister.** `R-PERM-04`, Art „Recht“, Quelle „Prozess“ mit Fundstelle ADR 0014 („Rechteprüfung wie bei den
   Leserechten“) und Bedrohungsmodell T-G1-I-09 (M9). `verified: false`.

## Nicht-Ziele

- Keine Änderung an `ROLE_PERMISSIONS`, `READ_SCOPES`, `PERMISSIONS`, Übergangstabelle oder Wahrheitstabelle.
- Kein Dienstcode, keine Route, kein Verteiler, keine Allowlist-Änderung (035b). Kein Web-Code (036a/036b).
- Keine Filterung für `/v1/events` (043).

## Files allowed

Vertrag zuerst, vom Architekten und vor jedem Code (AGENTS.md R6):

- `docs/slices/035a-sse-domaene-vertrag.md`
- `packages/contract/openapi.yaml` (nur `/stream`, die neuen Schemas und Parameter, `StreamUnavailable`, `info.version`
  0.3.11, ein Absatz in `info.description`; **Architekt**)
- `packages/contract/CHANGELOG.md` (Abschnitt 0.3.11; Architekt)
- `packages/contract/src/types.ts` (nur regeneriert)

Domäne:

- `packages/domain/src/stream.ts` (neu)
- `packages/domain/src/api.ts` (nur: `maskEvent`, `resolveMeetingActor` und das Bühnenprädikat nutzen bzw. auslagern;
  Block `subscribe`; Projektions-Hörer `store.subscribe` für den Zustand „vorher“; Typ von `HvApi.subscribe`)
- `packages/domain/src/state.ts` (nur falls `isOnStage` dort liegt)
- `packages/domain/src/index.ts` (nur Exporte)
- `packages/domain/src/rules.ts` (nur R-PERM-04)
- `packages/domain/src/types.ts` (nur neue Typen)
- `packages/domain/src/__tests__/stream035.test.ts` (neu)
- `docs/sicherheit/bedrohungsmodell.md` (nur Zeilen T-G1-I-09 und T-G3-I-01: Stand Domäne)
- `docs/folgeliste.md` (nur nicht blockierende Befunde; Sicherheitsbefunde nie)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)

Weitere Dateien sind Scope-Befunde (Liste im nächsten Abschnitt).

## Ausdrücklich nicht erlaubt

`packages/domain/src/permissions.ts`, `packages/domain/policy-truth-table.md`, `packages/contract/allowlist.json` und alle
`apps/**`. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. Vertrag 0.3.11 liegt vom Architekten vor, `pnpm contract:types` ohne Diff, `contract:lint` grün, Allowlist-Eintrag
   `streamEvents` unverändert.
2. Liefert die ausgelagerte `resolveMeetingActor` für jede bestehende Stelle dasselbe Ergebnis? Alle Tests grün vor der
   ersten neuen Zeile.
3. Welche Zustandsfelder ändert `reduce` je Ereignistyp (`state.ts`)? Das ist die Grundlage für `EVENT_SUBJECTS`. Weicht
   der Code von den Beispielen in Entscheidung 2 ab, gilt der Code, und der Test 2b entscheidet.
4. Weichen Zeilenangaben ab, melden und anhalten.

## Tests zuerst (rot, dann grün; `stream035.test.ts`)

1. `EVENT_TOPICS`, `EVENT_SUBJECTS` sind für jeden `EventType` gesetzt (Typ plus Laufzeitprüfung).
2. **Themen nicht zu eng:** Über den Seed-Korpus wird jedes Ereignis angewandt. Jede Lesesicht, die sich ändert, gehört
   zu einem Thema aus `EVENT_TOPICS`.
   **2b (M2), je Rolle aus `ROLE_PERMISSIONS` erzeugt:** Für jede Lesemethode, die die Rolle aufrufen darf und deren
   Ergebnis sich durch ein Ereignis ändert, meldet `visibleMessages` ein Thema. Bei Einzelzugriffen (`getQuestion`,
   `getQuestionHistory`, `getSpeaker`, `getContribution`) kommt zusätzlich die Kennung. Ausdrücklich enthalten:
   `QuestionCaptured` (Redebeitrag, Wortmeldung, `speakerListVersion`) und `QuestionMerged` (`intoQuestionId`).
3. **Sichtbarkeitstabelle** aus `ROLE_PERMISSIONS` erzeugt und gleich der Tabelle in Entscheidung 2.
4. **observer erhält keine Entwurfsereignisse (M1):** Folge Erfassen → Einordnen → Zuweisen → Entwurf → Einreichen →
   Freigabe → Bühne → Vorlesen. Vor `QuestionDelivered` erhält der Beobachter höchstens `meeting` **ohne** `subjects`
   (Zähler). Er erhält kein `questions`, kein `stage`, keine Kennung der Frage und kein `event`. Ab `delivered` erhält er
   `questions` mit der Kennung. Die serialisierte Ausgabe enthält den Entwurfstext nie.
5. **expert:** kein Thema und keine Kennung zu Fragen eines anderen Fachbereichs. Wird eine Frage aus seinem Fachbereich
   wegverteilt, erhält er einmal `questions` mit ihrer Kennung (Zustand vorher).
6. **podium:** `stage` nur für Fragen vorher oder nachher auf der Bühne, sonst nur als Zählersignal ohne Kennung.
7. **admin:** `event` mit genau dem JSON von `listEvents` für dasselbe `seq`; auch für Ereignisse eines Jahrgangs, in dem
   er keine Zuordnung hat, solange `event.read` in einem aktiven Jahrgang gilt (M5). Ohne aktiven Jahrgang: nichts.
8. **In-Process-`subscribe`:** `change` entspricht für jede Rolle der Funktion. Ein Rollenwechsel im Umschalter wirkt ab
   der nächsten Zustellung. Wirft `actor()`, gibt es `[]` ohne `change`, und ein zweiter Hörer wird trotzdem
   benachrichtigt (m6). Bestehende `subscribe`-Tests bleiben grün.
9. **Nachlauf (M3):** (a) podium, Bereich mit `QuestionDelivered` → `reset`, ebenso mit `QuestionStaged`; Bereich nur
   mit `QuestionClassified` → kein `reset` (höchstens `meeting`); (a2) moderation bzw. approver (`stage.read` und
   `question.read`): Bereich mit `QuestionStaged` oder `QuestionDelivered` → `reset`, obwohl die Frage jetzt über
   `questions` lesbar ist; Bereich nur mit `QuestionClassified` → `change` mit `replay: true`, Themen `questions` ohne
   `stage`; (b) expert, Bereich mit `QuestionAssigned`
   einer Frage aus seinem Fachbereich in einen anderen → `reset`; (c) capture (nicht gegenstandsgebunden) über denselben
   Bereich → `change` mit `replay: true`; (d) observer, Bereich nur mit Entwurfsereignissen und ohne
   `SCOPE_EXIT_EVENTS` → höchstens `meeting` ohne Kennung.
10. **Akteurkarte (M4):** `resolveReaderActors` mit zwei Jahrgängen, Entzug in einem → die Karte verliert diesen
    Jahrgang; `RoleAssigned` in einem zweiten Jahrgang → die Karte gewinnt einen Eintrag. Ein Ereignis ohne `meetingId`
    → nur `event` für Leser mit `event.read`, sonst nichts.
11. (m11) `isOnStage` ist die einzige Stelle mit dem Status der Bühne (Test über `getStage` und `visibleMessages` mit
    derselben Frage); `subjects` mit 101 Kennungen → Feld entfällt; `IdempotencyRecorded` → nur `event`.
12. **Ein `change` je Stapel (Codex P2):** `captureQuestions` mit drei Einzelfragen als capture im In-Process-
    `subscribe` → genau ein Hörer-Aufruf mit genau einer `change`: alle drei Kennungen der Fragen (dazu Redebeitrag und
    Wortmeldung), `seq` des letzten der drei Ereignisse. Dasselbe über `visibleMessages` mit dem Stapel direkt.
13. **`cursor` (Codex P2), Prüfpunkt statt Laufzeittest:** Diese Scheibe hat keine Route. Der Review des Vertrags
    prüft, dass die Beschreibung von `/stream` in `openapi.yaml` enthält: `cursor` sofort nach dem Aufbau ohne Cursor und
    nach dem Nachlauf; nach `reset` Neuaufbau ohne Cursor, dann `cursor` mit dem Kopf; bei `EventSource` eine neue
    Instanz ohne `Last-Event-ID`. Das Laufzeitverhalten testet 035b (Tests 13b und 13c). Ein Test der Domäne liest
    keine Vertragsdatei (keine I/O im Kern).

## Akzeptanzkriterium

1. Vertrag 0.3.11 vom Architekten vor dem Code; `pnpm contract:types` ohne Diff; Allowlist unverändert (035b).
2. Tests 1–12 grün und Prüfpunkt 13 im Review, zuerst rot belegt; bestehende Domänentests unverändert grün; Wahrheitstabelle ohne Diff;
   `role-literals` grün.
3. Bedrohungsmodell T-G1-I-09 und T-G3-I-01 mit Stand „Domäne gebaut, Dienst in 035b“ und Testnamen.
4. `pnpm gates` grün auf sauberem Baucommit; `slice-scope` akzeptiert nur die Dateien oben.
5. Lesebefund vor dem Bau; Security-Review in frischem Kontext; Blocker/Major vor dem Merge. Jeder Commit nennt
   „Scheibe 035a“ und endet mit `[skip netlify]`.

## Nachweise

Schluss von `pnpm gates`; Testnamen 1–12; erzeugte Sichtbarkeitstabelle aus Test 3 im Bericht; serialisierte
Beobachter-Ausgabe aus Test 4.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] Vertrag, Ereignis [x] Rolle, Recht (R-PERM-04) [x] vertrauliche Daten (SG1, SG2)
Perspektive(n): Security (6.5), Vertrag (6.4) · Nachweise: Tests 1–12, Prüfpunkt 13, Tabelle · Offene Entscheidung: Eigentümerfrage 1

## Wirkung und Risiko

- **Invariante.** Ein Leser erfährt aus `visibleMessages` und `replayMessage` nichts über einen Gegenstand, den er weder
  vorher noch nachher (live) bzw. jetzt (Nachlauf) lesen darf. Die einzige Ausnahme sind Zählersignale ohne Kennung.
- **Missbrauchsfall MF-SSE-1 (T-G1-I-09 a).** observer oder ein Fachbereich will Entwürfe oder fremde Fragen über
  Änderungssignale erkennen. Abwehr: nur Themen mit Leserecht, Kennungen nur für lesbare Gegenstände, kein Inhalt.
  Erkennung: Tests 3–6 und 9 als Tor; im Betrieb ist ein Leck nicht beobachtbar, daher Pflicht-Tor statt Alarm.
- **Restrisiko.** Aktivitätsvolumen über `id`-Sprünge und Zeitpunkte (Eigentümerfrage 2 in 035b).
- **Fehlerfall.** `EVENT_SUBJECTS` zu eng → veraltete Anzeige im Client, kein Leck; Test 2b verhindert es.

## Sicherheits-Checkliste (Antworten für den Reviewer)

| Punkt | Antwort |
|---|---|
| SC-01 | ja: jede Entscheidung über `can()` im Kern, Kontext (Fachbereich, Jahrgang) aus der Projektion, nie vom Client; kein Rollenname |
| SC-02 | ja: keine neue Aktion, `ROLE_PERMISSIONS` unverändert; Sichtbarkeitstabelle vor dem Bau, Freigabe Eigentümerfrage 1; Negativtests 4–6, 9 |
| SC-03 | ja: Kennungen nur für lesbare Gegenstände; Zähler ohne Kennung (T-G1-I-04, hingenommen); Tests 4–6, 9, 11 |
| SC-04 | ja: `subjects` höchstens 100, Nachlauf höchstens 1000 (Durchsetzung 035b) |
| SC-05 | nicht anwendbar in 035a (Sitzung und Entzug im Dienst, 035b) |
| SC-06 | ja: MF-SSE-1 oben |
| SC-07 | ja: nur lesend, kein Ereignis wird erzeugt oder verändert |
| SC-08 | nicht anwendbar (keine Persistenz) |
| SC-09 | nicht anwendbar (kein Nachbarsystem); T-G3-I-01 profitiert vom selben Filter |
| SC-10 | ja: keine neue Abhängigkeit |
| SC-11 | ja: keine Log-Ausgabe, keine Kennzahl |
| SC-12 | ja: keine Tore, Hooks oder Snapshots berührt |
| SP-2 | ja: Längen- und Wertegrenzen im Vertrag (`maxItems`, `maximum`, Muster) |
| SP-3 | nicht anwendbar (keine Sitzung in 035a) |
| SP-4 | nicht anwendbar (keine Oberfläche) |
| SP-5 | ja: kein Geheimnis im Diff; kein Sitzungstoken in der Domäne |
| SP-6 | ja: T-G1-I-09 (a, b), T-G3-I-01; Tests oben |
| SP-7 | nicht anwendbar in 035a (Sperrliste im Strom: 035b) |

## Offene Eigentümerfragen

1. **Freigabe der Sichtbarkeitstabelle R-PERM-04 (Rechte).** Standard, gebaut: die Tabelle in Entscheidung 2. Rollen
   ohne `event.read` erhalten Änderungssignale ohne Inhalt zu Gegenständen, die sie lesen dürfen, und Zählersignale ohne
   Kennung. `event.read` bleibt bei der Administration.

## Bericht (nach Bau ausfüllen)

```
Slice: 035a-sse-domaene-vertrag
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; Testnamen 1–12; Sichtbarkeitstabelle
Open: Eigentümerfrage 1; Dienst in 035b
Touched: <Dateiliste>
```

## Review findings

Lesebefund zu Spec 035 (Opus, frischer Kontext, `9f2560c`): nicht baureif. In dieser Fassung eingearbeitet: M1 (Test 4),
M2 (`EVENT_SUBJECTS`, Zählersignal `stage`, Test 2b), M3 (`can()` je Frage, `SCOPE_EXIT_EVENTS`, Test 9), M4 (Akteurkarte,
Ereignisse ohne Jahrgang, Test 10), M5 (a), M9, m1, m2, m3, m6, m10, m11 (Domänenteil). B1, M6–M8 und die übrigen Minor
stehen in 035b.
