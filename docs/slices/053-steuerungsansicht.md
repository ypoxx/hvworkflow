# Scheibe 053 — Steuerungsansicht der Koordination

**Status:** spec (04.10.2026; gelesen auf `7405efb`: 043a, 040b, 044a, 044b, 045 und 048 gemergt, Vertrag 0.4.3; dritte Scheibe der Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041, Register E57; zugeschnitten ohne 047, Teil 053b für die Mehrfachauswahl skizziert, Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** mittel · 3,4 AStd (Spanne 3,0–4,0; Plan 053: mittel · 2,5 AStd inklusive Mehrfachauswahl, die hier nach 053b geht; Begründung in „Warum mittel“ und „Aufwand“) · Plan 053: 13.11.2026 (W7), tatsächlich direkt nach 048 als dritte Oberflächenscheibe der Freigabe-Demo · Lanes: web-steering (neu, `apps/web/src/features/steering/**`); web-answers (gemeinsamer Weiterleiten-Dialog, Herauslösen der Schreibtür und eines reinen Listenfilters, ohne Verhaltensänderung); web-shell (eine Zeile im Feature-Register und drei Shell-Schlüssel); web-api (nur eine neue Testdatei für die Zeitmessung); e2e (eigene Datei, im Projekt `http` eingereiht); docs (eine Glossarzeile, Nachweise)
**Bedrohungsmodell:** berührt T-G1-I-01 (Anzeige) und MF-14 (Weiterleiten erweitert den Leserkreis um den Zielfachbereich; Regel und Umfang in 048). Keine neue Angriffsfläche: kein neuer Endpunkt, kein neues Recht, kein neues Feld; die Oberfläche macht eine vorhandene, geprüfte Operation erstmals bedienbar.
**Rolle:** implementierer-oberflaeche; Review in frischem Kontext mit den Perspektiven **UX/Barrierefreiheit** (D1–D10, Tastatur) und **Datenschutz** (Weiterleiten-Dialog: geschlossener Code, kein Freitext, keine Vorauswahl des Ziels, Hinweis auf den Leserkreis; Verteilung nur als Summen). Ablauf nach E57 für Oberflächenscheiben mittleren Risikos: kein gesonderter Lesebefund der Spec, ein Review nach dem Bau; Sicherheits-, Rechts- und Datenschutzbefunde werden nie vertagt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue fachliche Regel. In der Oberfläche bedient und belegt: R-TRANS-01 (Klassifizieren), R-TRANS-02 (Zuweisen), R-TRANS-17 und R-GUARD-15 (An anderen Fachbereich weiterleiten), R-TRANS-15 (Verweigerung vorschlagen, Dialog aus 045 unverändert), R-GUARD-03 (nur Textpfade, über `_actions`), R-PERM-01 und R-PERM-03 (über `_actions` und Lesepfade). Dazu AGENTS.md R2, R3, R4, R5, R6, R9, R10, R12; `docs/design-prinzipien.md` D1–D10
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 053 (Zeile 753–758), Eintrag 054 (Zeile 759–765), Eintrag 082 (Zeile 408–413), Eintrag 084 (Zeile 462), §1 B8 (Zeile 30), §11 „Freigabe-Demo“; Register E1, E5, E57; `docs/feedback/2026-09-quickview-projektleitung.md` #11, #22, #25; `docs/anforderungen-recherche.md:392` (Triage, Mehrfachmarkierung, Einzeltaste); Specs 045 (Verweigerungsdialog, Isolation im e2e, Lehre zum Serverfilter), 048 (Weiterleiten, „Hinweise an Folgescheiben: 053/054“), 040b (`counts.byUnit`, `counts.bySeat`, Bühnenplätze), 021b (Koordination), 082 (Feature-Register), 010d und 090 (Daten und Eingaben je Akteur), takt-008 (Fokus nach Aktion); `packages/domain/policy-truth-table.md` Zeilen 53–72 (`coordination`); Glossar Zeilen 23, 29, 42, 49–52, 55
**Depends on:** 048 (gemergt `7405efb`, Vertrag 0.4.3), 045 (gemergt `c0db7f5`), 040b (gemergt), 036b (gemergt), 082 (gemergt `c8bcf83`; das Register steht, die Quelle der Rechtemenge fehlt, siehe Befund). **Nicht** 047 (nicht gebaut; was deshalb fehlt, steht in „Teilung und Zuschnitt“)
**Perspektive:** UX, Datenschutz · **Glossar: neue Begriffe:** ja (Verteilung)

## Warum mittel

Der Plan führt 053 als „mittel“; diese Spec bleibt dabei (keine Herabstufung, kein Fall für `downgrade-check`). Die
Hoch-Auslöser der Leitplanken (§4) sind Änderungen an Rechten, Freigabe, Verweigerung, personenbezogenen Daten,
Auswertungen. 053 ändert keinen davon:

- **Rechte:** kein neues Recht, keine Zeile in `ROLE_PERMISSIONS`, kein Wahrheitstabellen-Diff. Jede Schaltfläche folgt
  `_actions`; die Registerzeile trägt das Recht `question.classify` als Daten.
- **Verweigerung:** Der Dialog aus 045 wird unverändert wiederverwendet (gleiche Komponente, gleicher Schlüssel je Akteur
  und Frage, gleiche Behandlung der Abweisungen). Kein Wortlaut, kein Vermerk, keine Begründung wird neu gezeigt.
- **Personenbezogene Daten:** Die Liste und das Detail zeigen, was die Beantwortung heute schon zeigt (Wortmeldung mit
  Anzeigenamen nach `question.identity.reveal` im Kern). Die Verteilung sind Summen je Fachbereich und je Bühnenplatz aus dem
  Dienst, nie je Person (040b).
- **Weiterleiten:** Die Erweiterung des Leserkreises ist die Regel aus 048 (dort hoch, gebaut und geprüft). 053 macht sie
  erstmals bedienbar; der Dialog sendet nur einen geschlossenen Code und einen Fachbereich ohne Vorauswahl und sagt vor dem
  Absenden, wer danach liest.

Verbleibendes Risiko ist Verhalten der Oberfläche: das Herauslösen der Schreibtür aus `answers/Page.tsx` (Regression in
der Beantwortung) und ein falsch gesendeter Zielfachbereich. Beides deckt diese Spec mit Tests ab. Hält der Review die
Einstufung für falsch, hebt der Eigentümer sie an (Eigentümerfrage 8); eine Hochstufung ist kein Herabstufungsfall.

## Befund (Ist-Stand, gelesen auf `7405efb`)

- **Feature-Register ist gebaut (082, angenommen, `c8bcf83`).** `apps/web/src/app/featureRegistry.ts` führt je Feature
  Pfad, Navigation, Icon, `testId`, Zähler, Hilfeschlüssel, i18n-Modul, `requires?: Permission`, `shortcutKey?` und
  Komponente; Router (`AppShell.tsx:100`), Navigation (`SideNav.tsx`) und Kurzbefehle lesen daraus. **Was fehlt, ist die
  Quelle der Rechtemenge:** `visibleRoutes(routes, granted?)` existiert, wird aber nirgends mit einer Menge gerufen; die
  Navigation zeigt alle Einträge (082 „Festlegung des Architekten“: die Quelle bringen 010 bzw. 029; beide haben sie nicht
  geliefert). `GET /auth/me` liefert Rollen, keine Rechte (`openapi.yaml:2831-2860`); `Meeting` trägt kein `_actions`.
  Die Oberfläche kennt also heute keine Rechtemenge der angemeldeten Person, nur `_actions` je Einzelfrage.
- **`featureRegistry.test.ts`** sichert zu, dass `visibleRoutes(FEATURES, new Set())` alle Einträge liefert („no route
  requires permissions“, Zeile 62–64) und dass der erste Eintrag `speakers`, der letzte `history` ist (Zeile 127–130).
- **Beantwortung** (`features/answers`): `WorkList.tsx` (Filter Suche, Status, Antwortpfad, Fachbereich, TOP, Sortierung;
  Zeilen mit `data-number`, `data-status`, `data-unit`), `useBacklog.ts` (Serverfilter `q`, `track`, `unitId`,
  `agendaItemId`; Status und Sortierung im Speicher, Zeile 273–281; `LIST_LIMIT` 2000), `QuestionDetail.tsx` (759 Zeilen,
  Editor, Versionen, Historie), `ActionDialogs.tsx` (`AssignDialog` mit Vorauswahl „aktueller oder erster Fachbereich“,
  `ReasonDialog`, `MergeDialog`), `RefusalDialog.tsx` und `refusal.ts` (045). `Page.tsx` hält die Schreibtür `run`
  (Zeile 148–229: Sperre bis der Datensatz nachgezogen hat, `If-Match`, `stillShown`/`onScreen` nach 010d, 412 als „Stand
  veraltet“, `settleProblem` mit `onProblem` nach 045, Neulesen bei Abweisung) zusammen mit dem Dialogzustand und dem
  Zurücksetzen bei Akteurwechsel (Zeile 102–110).
- **Weiterleiten (048):** `HvApi.forwardQuestion(id, { unitId, reasonCode }, opts)`; HTTP-Client und Live-Puffer
  (`http.ts:643`, `liveStore.ts:95`) fertig; `ACTION_KEYS['question.forward']` = „An anderen Fachbereich weiterleiten“;
  `forwardReasonLabel(t, code)` und die vier Bezeichnungen in `i18n/labels.ts:173-186` und `history.{de,en}.ts`; die
  Historie fasst `QuestionForwarded` mit Fachbereichswechsel und Grund zusammen. **Keine Ansicht bietet das Weiterleiten
  an.** Halter: `coordination`, gebundenes `expert`.
- **Klassifizieren:** `features/capture/ClassifyDialog.tsx` (Antwortpfad, Bühnenzuordnung über das Enum `STAGE_ASSIGNMENTS`;
  eigener Schreibweg mit `If-Match`, Toast, Schließen bei 412). Der Reduzierer setzt `seatId` aus `stageAssignment`
  (`state.ts:393-400`); die vier Bühnenplätze des Seeds haben genau die Enum-Werte als id (`seed.ts:57-62`). Ein Bühnenplatz,
  den die Administration mit anderer id anlegt, ist im Dialog nicht wählbar.
- **Zähler (040b):** `Meeting.counts.byUnit` = offene Einzelfragen je Fachbereich (alle außer `delivered`, `closed`,
  `withdrawn`, `merged`, also auch `approved` und `staged`), jeder Fachbereich als Schlüssel, auch mit 0;
  `counts.bySeat` = Einzelfragen **auf der Bühne** je Bühnenplatz (`isOnStage`). Beide sind **Randsummen über
  verschiedene Mengen**; eine Kreuztabelle Fachbereich × Bühnenplatz lässt sich daraus nicht bilden (`state.ts:77-102`).
  Im Typ optional (der Vertrag erklärt sie optional), die Projektion setzt sie immer.
- **Seed `CORPUS_DEMO`** (230 Einzelfragen, gemessen auf `7405efb` über `seedEvents`): `counts.open` 100; `byUnit` fin 20,
  legal 6, hr 10, esg 4, strat 6, ir 6, ops 15, fast 19, ar 0 (Summe 86; 14 offene ohne Fachbereich); `bySeat`
  Aufsichtsratsvorsitz 1, Vorstandsvorsitz 3, Finanzvorstand 1, Vorstandsmitglied 1. Für `coordination`: 5 `captured`
  (F-0211, F-0224, F-0228, F-0229, F-0230), 7 `classified` (davon 5 `expert_track` ohne Fachbereich, 2 `fast_track`),
  15 `assigned` (Operations: F-0111, F-0143, F-0152, F-0159; Finanzen: F-0121, F-0128, F-0135, F-0204); 55 Einzelfragen mit
  `question.forward`, 12 mit `question.classify` in `_actions`.
- **Lastkorpus:** `CORPUS_LOAD` (800 Einzelfragen) steht in `seed.ts:371`, wird aber von keiner Oberfläche geladen; die Demo
  sät `CORPUS_DEMO` (`api/index.ts:162`). Ein Zeitbudget-Tor gibt es nicht: 084 ist nicht spezifiziert und nicht gebaut;
  `abnahme.spec.ts:159-168` misst den Statusfilter weich (Log, harte Grenze 1500 ms) bei 230.
- **Abhängigkeit 047** ist nicht gebaut: kein Feld `confidentiality`, kein `insiderRelevance` im Vertrag.
- **„Zurückstellen“** ist im Kern keine Aktion: weder Zeile in `transitions.ts` noch Recht. Plan und Register (S6, E30)
  ordnen es 046 zu, das in der Kette E57 **nach** 053 steht und nicht unter den Abhängigkeiten von 053.
- **i18n.** Paritätstest (f): 561 Schlüssel je Sprache (`parity.test.ts:166-173`); Module shell, speakers, capture,
  answers, stage, history; ein neues Modul kommt in `de.ts`, `en.ts` und die Modulliste des Paritätstests.
- **e2e `http`.** `SHARED_SPECS` in `apps/web/playwright.config.ts:38-41`, Reihenfolge-Pin `scripts/e2e-http-031.test.mjs:26-30`
  (`SHARED_FILES`, `HTTP_ORDER`); Personen `approver`, `capture`, `coordination`, `expert` (gebunden an `unit-fin`),
  `legal`, `moderation`, `norole`, `podium`, `revoke`. Schritt „End-to-end http project …“ mit `timeout-minutes: 9`
  (`.github/workflows/gates.yml`, Job `e2e-http`). Gemessene Dauer dieses Schritts in den letzten drei grünen Läufen:
  37208636753 **4:17** (14:17:14–14:21:31 UTC), 37207858473 **4:19** (14:04:29–14:08:48), 37205371922 **3:05**
  (13:23:00–13:26:05), alle am 04.10.2026; Gesamtgrenze der Harness 8:00 (045, Vor-dem-Bau-Punkt 6).
- **Rollenname (E1).** Die Anzeige „Koordination“ steht nur im Wörterbuch (`role.coordination`, `shell.de.ts:86`) und im
  Rollenwechsler der Demo. Diese Scheibe nennt in keinem Text eine Rolle; E1 bleibt ohne Wirkung auf 053.

**Kein Vertrags-, Kern- oder Dienstschritt nötig.** Stellt der Bau fest, dass etwas fehlt, hält er an und meldet es; er
ändert weder `packages/**` noch `apps/api/**` (AGENTS.md R6).

## Teilung und Zuschnitt

Die Planzeile 053 bündelt acht Punkte. Ohne 047 und ohne 046 sind drei nicht baubar, einer gehört der Sache nach in eine
eigene Scheibe, und der Zeitnachweis braucht 084. Zuschnitt:

| Punkt der Planzeile | In 053 | Wohin sonst | Grund |
|---|---|---|---|
| Route `/steering`, Zeile im Feature-Register, Recht `question.classify` | **ja**: eine Zeile mit `requires: 'question.classify'` | Filter der Navigation: Folgepunkt „Quelle der Rechtemenge“ | Register gebaut (082); die Menge der Rechte kennt die Oberfläche nicht (Befund). Kein Rollenname |
| Klassifizierung: Antwortpfad, Bühnenplatz | **ja**, Dialog aus der Erfassung wiederverwendet | — | — |
| Klassifizierung: Insider-Kennzeichen | nein | 047 (Feld `insiderRelevance`) | kein Vertragsfeld |
| Zuweisung | **ja**, `AssignDialog` wiederverwendet | — | — |
| Weiterleiten | **ja**, Dialog **einmal** gebaut, gemeinsam mit 054 | 054 setzt denselben Dialog in die Fokusansicht | Entscheidung 4 |
| Verweigerung vorschlagen | **ja**, Dialog aus 045 unverändert | — | — |
| Zurückstellen | nein | 046 (E30, Kennzeichen mit Pflichtgrund) | keine Aktion im Kern; 046 steht nach 053 |
| Verteilung je Fachbereich und je Bühnenplatz (Feedback #11, #25) | **ja**, als zwei Leisten aus `counts.byUnit` und `counts.bySeat` | Kreuztabelle: Eigentümerfrage 4 | keine Matrix aus zwei Randsummen (Befund) |
| Mehrfachauswahl mit Einzeltasten | nein | **053b** (Skizze unten) | eigene Fehlerlogik bei Teilerfolg; über 3,5 AStd zusammen |
| Filter bleiben hier | **ja**, die Filter der Arbeitsliste | — | — |
| Vertraulichkeits-Badge | nein | 047 (Feld `confidentiality`, Badge) | kein Vertragsfeld |
| Zeitmessung Filterwechsel p90 < 150 ms bei 800 (Tor) | **teilweise**: In-Process-Pfad bei 800 in Vitest, weiche Browser-Messung bei 230 | hartes Browser-Tor bei 800: 084 | Entscheidung 8 |
| Screenshots DE/EN, axe, Matrix-Zahlen gegen counts | **ja** | — | — |

**053b · Mehrfachauswahl mit Einzeltasten (Skizze, eigene Spec vor dem Bau).** Leertaste markiert Zeilen der Arbeitsliste
(`aria-multiselectable`), Einzeltasten lösen „Zuweisen“ bzw. „An anderen Fachbereich weiterleiten“ für alle markierten
Einzelfragen aus; angeboten wird nur, was **jede** markierte Zeile in `_actions` trägt (Schnittmenge, keine Statuslogik).
Ein Dialog, danach je Einzelfrage ein eigener Schreibvorgang mit eigenem `If-Match` und eigenem `Idempotency-Key`, der Reihe
nach; Ergebnis als Zusammenfassung (n erledigt, m abgewiesen mit Nummer und Regel-id); Markierungen gehören dem Akteur und
fallen bei Wechsel (090). Recherche `:392`. Klasse mittel, **1,25 AStd** (Spanne 1,0–1,5), Lanes web-steering, e2e. Kein
Vertragsschritt (keine Sammeloperation). Reihenfolge: Eigentümerfrage 7.

**Was ohne 047 fehlt, ausdrücklich:** das Vertraulichkeits-Badge in Liste und Detail und das Insider-Kennzeichen im
Klassifizierungsdialog. Beides kommt mit 047 (dort ohnehin „Badge in der Oberfläche“), sobald Vertrag und Kern die Felder
tragen; geschätzt < 0,5 AStd in den Dateien dieser Scheibe. Bis dahin zeigt die Steuerung keine Vertraulichkeitsangabe und
behauptet keine.

**Was ohne die Quelle der Rechtemenge fehlt, ausdrücklich:** Die Registerzeile trägt `requires: 'question.classify'`
(Daten, kein Rollenname), und `visibleRoutes` blendet sie ohne das Recht aus (Test 9). Weil die Navigation heute keine
Menge übergibt, ist der Eintrag **für jede Rolle sichtbar**, wie alle anderen Ansichten heute. Wer `question.read` nicht
hält, sieht auf der Seite einen gestalteten Zustand ohne Liste; wer liest, aber nicht steuert, sieht keine Schaltfläche
(D9). Die Quelle der Menge ist ein Folgepunkt mit Vertragsschritt (Eigentümerfrage 3).

## Ziel und Entscheidungen vor Bau

Die Koordination steuert auf einer eigenen Seite: Sie sieht oben, wo die offenen Einzelfragen liegen (je Fachbereich, und
was je Bühnenplatz auf der Bühne steht), filtert die Arbeitsliste darauf, wählt eine Einzelfrage und nimmt den nächsten
Schritt: klassifizieren, zuweisen oder an einen anderen Fachbereich weiterleiten, als Nebenaktion eine Verweigerung
vorschlagen. Jede Schaltfläche folgt `_actions`; kein Code vergleicht einen Rollennamen (R4) oder einen Status zur
Entscheidung über eine Aktion (R5).

Alle Punkte sind **auf Standard gebaut**, wo nicht anders gesagt; ein späterer Wechsel kostet die genannten Beträge.

### 1. Route und Registerzeile (`apps/web/src/app/featureRegistry.ts`)

- Genau eine neue Zeile in `FEATURES`, **zwischen `capture` und `answers`** (Ablauf des Tages: erfassen, steuern,
  beantworten): `{ id: 'steering', path: '/steering', labelKey: 'nav.steering', icon: <lucide, Vorschlag Waypoints>,
  testId: 'nav-steering', helpKey: 'page.steering.description', i18nModule: 'steering', requires: 'question.classify',
  Component: SteeringPage }`. **Kein `shortcutKey`** (Alt+6 ist für 054 vorgesehen; Eigentümerfrage 3 nennt die Option).
  Kein Zähler an der Navigation.
- Keine weitere Änderung an Shell, Router, Navigation oder Kurzbefehl-Dialog (Zweck von 082). `SideNav.tsx` bleibt, wie es
  ist; ein Ausblenden über `visibleRoutes` folgt mit der Quelle der Rechtemenge.

### 2. Seite (`apps/web/src/features/steering/Page.tsx`, neu)

- Aufbau: `PageHeader` (`page.steering.title`, `page.steering.description`), darunter die **Verteilung** (Entscheidung 3)
  über volle Breite, darunter `SplitPane` (`storageKey="hv-steering-split-v1"`, wie die Beantwortung) mit der
  **Arbeitsliste** links und dem **Steuerungsdetail** rechts (Entscheidung 5).
- **Arbeitsliste:** `WorkList` und `useBacklog` aus `features/answers` **unverändert wiederverwendet** (gleiche Filter,
  gleiche Fensterung, gleiche Zeilenattribute). Eigene Filter- und Auswahlzustände der Seite, Start mit `EMPTY_FILTERS`
  (Eigentümerfrage 5 nennt eine Voreinstellung als Option).
- **Lesbarkeit:** Ist `backlog.listForbidden` wahr, rendert die Seite statt Liste und Detail einen eigenen Zustand
  `steering.forbidden.title`/`.body` (`data-testid="steering-forbidden"`, `role="status"`) und keine Verteilung. Die Seite
  zeigt also nicht den Text der Beantwortung („darf die Beantwortung nicht lesen“). `WorkList.tsx` bleibt unverändert.
- **Daten je Akteur (010d, 090):** Bei Akteurwechsel (Vergleich über `actor.id`, nie über die Rolle) fallen in derselben
  Darstellung der offene Dialog und „Stand veraltet“ (über die Schreibtür, Entscheidung 6), und der Suchtext wird geleert;
  die übrigen Filter bleiben (wie `answers/Page.tsx:102-110`).
- **Fokus nach Aktion (takt-008):** Nach einem erfolgreichen Schreibvorgang aus dieser Seite geht der Fokus auf die
  primäre Aktion des Steuerungsdetails, falls eine steht, sonst auf die Kopfzeile des Details
  (`steering-detail-number`, `tabIndex={-1}`), sobald der neue Datensatz da ist.

### 3. Verteilung (`features/steering/distribution.ts` rein, `DistributionPanel.tsx`)

- **Zwei Leisten, keine Matrix** (Befund; Eigentümerfrage 4):
  - **„Offen je Fachbereich“** (`steering.distribution.units`): je Fachbereich der Stammdaten (`backlog.units`, Reihenfolge
    der Stammdaten) eine Zelle mit Kurzname und `counts.byUnit[unit.id]`; dazu eine Zelle **„Ohne Fachbereich“**
    (`steering.distribution.noUnit`) mit `max(0, counts.open − Σ counts.byUnit)`. Hilfetext `steering.distribution.unitsHelp`
    nennt die Menge (nicht vorgelesen, geschlossen, zurückgezogen, zusammengeführt) und „nie je Person“.
  - **„Auf der Bühne je Bühnenplatz“** (`steering.distribution.seats`): je Bühnenplatz aus `api.listMeetingStageSeats(meeting.id)`
    (Reihenfolge `position`, dann Bezeichnung; ohne Bezeichnung die id in Mono) eine Zelle mit `counts.bySeat[seat.id]`;
    Hilfetext `steering.distribution.seatsHelp`.
- **Quelle der Zahlen:** ausschließlich `useMeeting()` (`app/useMeeting.ts`, neu gelesen bei jedem Stromereignis über
  `useApiVersion`; `QuestionForwarded`, `QuestionAssigned` und `QuestionClassified` tragen das Thema `meeting`). Die Seite
  zählt nichts selbst aus der Liste (eine gefilterte Liste sagt nichts über das, was sie weglässt).
- **Reine Hilfen** in `distribution.ts` (ohne React): `unitCells(counts, units)` → `{ unitId, name, count }[]` und
  `noUnitCount(counts)`; `seatCells(counts, seats)` → `{ seatId, label, count }[]`; fehlt `counts.byUnit` bzw. `bySeat`
  (Vertrag optional), liefern sie `undefined`, und die Leiste zeigt `steering.distribution.failed`.
- **Drill-down:** Jede Fachbereichszelle ist eine Schaltfläche (`data-testid="steering-unit-cell"`, `data-unit`,
  `data-count`, `aria-label` = `steering.distribution.filter` mit Name und Zahl); Aktivieren setzt den Fachbereichsfilter
  der Arbeitsliste auf diesen Fachbereich und den Statusfilter auf „alle“. Die Zelle des aktiven Filters trägt
  `aria-pressed="true"`. „Ohne Fachbereich“ (`steering-unit-none`) und die Bühnenplatzzellen (`steering-seat-cell`,
  `data-seat`, `data-count`) sind **keine** Schaltflächen: Es gibt keinen Serverfilter „ohne Fachbereich“ und keinen
  Bühnenplatzfilter (`QuestionFilter`), und 053 baut keinen.
- **Zustände (D6):** `meeting === null` oder Bühnenplätze laden → Zeile in Leistenhöhe mit `steering.distribution.loading`
  (nichts springt, D8 der Muster); Lesefehler der Bühnenplätze oder fehlende Zähler → `steering.distribution.failed`
  (`role="status"`), die Liste bleibt bedienbar; keine Fachbereiche und keine Bühnenplätze → `steering.distribution.empty`.
  Kein Toast aus der Verteilung.
- **Darstellung:** Zahlen in Mono, rechtsbündig (D5); eine Zelle mit 0 in Grau 300 wie die Prozessleiste; keine Farbflächen,
  keine Balkenfarben nach Höhe (D4).

### 4. Weiterleiten-Dialog: einmal gebaut, gemeinsam mit 054 (`features/answers/ForwardDialog.tsx`, `forward.ts`)

**Entscheidung:** Der Dialog entsteht **in 053 einmal** als eigene Komponente im Feature `answers`, wo die übrigen
Schreibdialoge liegen (`ActionDialogs.tsx`). 053 bietet ihn im Steuerungsdetail an; **054** setzt **dieselbe Komponente**
in die Fokusansicht (dort als zweite Aktion nach dem nächsten Schritt, Z9, 048 „Hinweise 054“) und baut keinen zweiten. Das
Beantwortungsdetail (`QuestionDetail.tsx`) bleibt in 053 unverändert (Eigentümerfrage 1 nennt die Option). Grund: Die
Koordination leitet in der Steuerung weiter (048 „Hinweise 053“), die Fachkraft in der Fokusansicht; beide brauchen
dieselben Felder und dieselbe Fehlerbehandlung. Ersparnis in 054 rund 0,4 AStd.

- **Reine Hilfen** (`forward.ts`, ohne React): `forwardTargets(units, currentUnitId)` → alle Fachbereiche außer dem
  aktuellen, Reihenfolge der Stammdaten (ohne aktuellen Fachbereich: alle); `buildForwardRequest(form)` →
  `ForwardRequest | undefined` (nur mit Fachbereich **und** Code; genau die Schlüssel `unitId`, `reasonCode`);
  `forwardProblemKey(error)` → `'guard15'` (409 mit `ruleId` R-GUARD-15), `'invalid'` (422), `'gone'` (404) oder
  `undefined`; `forwardProblemHandler(show, close, gone)` nach dem Muster von `refusalProblemHandler` (045): `guard15` und
  `invalid` → Meldung im Dialog, `true`; `gone` → Dialog schließen, Toast `answers.forward.gone` mit Nummer, `true`
  (kein „Stand veraltet“; nach einem Weiterleiten aus dem eigenen Bereich kann die Frage nicht mehr lesbar sein, 048
  Entscheidung 5); 412 → schließen, wenn `stillShown()`, `false`; alles andere → `false` (Toast wie heute).
- **Aufbau** (Muster D: Titel = `actionLabel(t, 'question.forward')`, Erklärungssatz `answers.forward.body`, Eingaben,
  rechts unten Abbrechen/Primär):
  1. Aktueller Fachbereich als Text (`answers.detail.unit`), sonst `common.none`.
  2. **Zielfachbereich** (`answers.forward.unit.label`), Auswahl aus `forwardTargets`, **ohne Vorauswahl**, Platzhalter
     `answers.forward.unit.placeholder` (`data-testid="forward-unit"`). Bewusst anders als `AssignDialog`, der den ersten
     Fachbereich vorwählt: Eine Vorauswahl hieße, den Leserkreis per Standard auf einen Fachbereich zu erweitern, den
     niemand gewählt hat.
  3. **Grund der Weiterleitung** (`answers.forward.reason.label`), Radiogruppe der vier Codes aus `FORWARD_REASON_CODES`
     (als Typ) mit `forwardReasonLabel`, **ohne Vorauswahl** (`data-testid="forward-reason-<code>"`). **Kein Freitextfeld**,
     auch nicht bei „Sonstiges“ (048 Entscheidung 4).
  4. Hinweis zum Leserkreis `answers.forward.readers` (`role="note"`, über `aria-describedby` mit der Auswahl verknüpft):
     Der Zielfachbereich liest danach die Einzelfrage mit Rückgabegrund und Historie (048 „Warum hoch“).
- **Absenden** (`actionLabel(t, 'question.forward')`, primär, `data-testid="forward-submit"`) gesperrt (`aria-disabled`,
  takt-008), solange Zielfachbereich oder Grund fehlt. Meldungen im Dialog mit `role="alert"` und Regel-id (D5)
  (`data-testid="forward-problem"`).
- **Zustand je Akteur und je Frage (090):** nur gerendert, solange offen, Schlüssel `${actorId}:${question.id}:forward`;
  jedes Öffnen beginnt leer; erhalten bleiben Eingaben nur über eine Abweisung im offenen Dialog hinweg (409 R-GUARD-15,
  422).
- **Schreiben** über die Schreibtür (Entscheidung 6): `run('question.forward', (o) => api.forwardQuestion(id,
  request, o), onDone, forwardProblemHandler(...))`.

### 5. Steuerungsdetail (`features/steering/SteeringDetail.tsx`, `steering.ts`)

- **Inhalt** (kompakt, kein Editor, keine Versionsliste, keine Historie; dafür bleibt die Beantwortung):
  Nummer in Mono (`steering-detail-number`), Statusbadge, Antwortpfad-Badge, Fachbereich (`steering-detail-unit`,
  Kurzname aus den Stammdaten, sonst `common.none`), Bühnenplatz (`steering-detail-seat`, Bezeichnung aus der Bühnenplatzliste,
  sonst id in Mono, sonst `common.none`; Beschriftung `answers.detail.stageAssignment`), Wortmeldung
  (`answers.detail.speaker`, Anzeigename, wie der Kern ihn liefert), Wortlaut (`answers.detail.label`), Rückgabegrund
  (`answers.detail.returned`), falls gesetzt, und das Badge `answers.refusal.badge`, wenn `latestIsRefusal(question)` (045).
  Keine Begründung einer Verweigerung, kein Wortlaut einer Version.
- **Aktionen nur aus `_actions`**, reine Hilfe `steeringActions(actions)` → `{ primary?: SteeringAction; secondary:
  SteeringAction[] }` mit `SteeringAction` ∈ `classify | assign | forward | refuse`:
  - Rangfolge der primären Aktion: **`question.forward` vor `question.assign` vor `question.classify`**; die erste, die in
    `_actions` steht, ist primär (D2). `question.refuse.propose` ist **nie** primär (045).
  - **Steht `question.forward` in `_actions`, wird „Zuweisen“ hier nicht angeboten** (Eigentümerfrage 2): Weiterleiten hält
    den Grund im Protokoll fest, Zuweisen nicht (048 „Überschneidung mit R-TRANS-02“). In der Beantwortung bleibt Zuweisen,
    wie es ist.
  - Die Hilfe liest **nur** die Liste der Rechte, nie den Status (R5): Dieselbe `_actions`-Liste ergibt in jedem Status
    dasselbe Ergebnis (Test 4). Ergebnis im Seed für `coordination`: `captured` → Klassifizieren; `classified` (Textpfad)
    → Zuweisen, daneben Klassifizieren und Verweigerung vorschlagen; `classified` (Podium) → Klassifizieren;
    `assigned`, `answer_drafted`, `in_review` → Weiterleiten, daneben Verweigerung vorschlagen; `approved` → nur
    Verweigerung vorschlagen (sekundär, keine primäre Aktion).
  - Schaltflächen: `steering-classify`, `steering-assign`, `steering-forward`, `steering-refuse`; die primäre trägt
    `data-primary="true"` und die Primärvariante des Bausatzes. Ohne Aktion keine Aktionsleiste (D9).
- **Klassifizieren:** `ClassifyDialog` aus `features/capture` **unverändert** wiederverwendet, nur gerendert, solange offen,
  Schlüssel `${actorId}:${question.id}:classify`. Er schreibt über seinen eigenen Weg (If-Match, Toast, Schließen bei 412)
  und nicht über die Schreibtür dieser Seite; das ist sein Verhalten in der Erfassung und bleibt so. Bühnenplätze nur über
  die vier Enum-Werte (Befund; Eigentümerfrage 6).
- **Zuweisen:** `AssignDialog` aus `ActionDialogs.tsx` unverändert über die Schreibtür (`question.assign`), wie in
  `answers/Page.tsx`. Seine Vorauswahl bleibt, wie sie ist (keine Änderung durch 053; Eigentümerfrage 2 nennt sie).
- **Verweigerung vorschlagen:** `RefusalDialog` mit `useRefusalGrounds` und `refusalProblemHandler` genau wie in
  `answers/Page.tsx:395-412`, nur gerendert, solange offen, Schlüssel `${actorId}:${question.id}:refusal`.

### 6. Schreibtür herauslösen (`features/answers/useWriteDoor.ts`, neu; `answers/Page.tsx`)

Die Steuerung braucht dieselbe Schreibtür wie die Beantwortung (Sperre bis zum nachgezogenen Datensatz, `If-Match`,
`stillShown`/`onScreen`, 412 als „Stand veraltet“, `onProblem`, Neulesen). **Sie wird nicht kopiert**, sondern als Hook
herausgelöst:

- `useWriteDoor<D extends string>({ question, selectedId, reload })` → `{ run, busy, dialog, setDialog, staleFor,
  clearStale }`. Er übernimmt **wörtlich** aus `answers/Page.tsx`: `WriteLock`, `Shown`, `lock`/`writing`/`busy`, das
  Freigeben der Sperre in der Darstellung, `shown` im Layout-Effekt, das Zurücksetzen von Dialog und „Stand veraltet“ bei
  Akteurwechsel, das Leeren von „Stand veraltet“ bei neuer Auswahl und `run` mit allen Kommentaren.
- `answers/Page.tsx` nutzt den Hook; **kein Verhalten der Beantwortung ändert sich** (Filter, Suchtext-Zurücksetzen nach 090,
  `draftResetToken`, `versionFocus`, Dialoge bleiben in der Seite). Nachweis: die bestehenden Szenarien 003, 010c, 010d,
  013, 021b, 021c, 045 und 090 laufen unverändert grün (Akzeptanzkriterium 2); keine Zusicherung wird angepasst.
- Gelingt das Herauslösen nicht ohne Verhaltensänderung, hält der Bau an und meldet; er kopiert die Tür nicht.

### 7. Sprache, Begriffe, Glossar

- Hausvokabular (R9, D6): Steuerung, Verteilung, Fachbereich, Bühnenplatz, Antwortpfad, Einzelfrage, Wortmeldung, „An anderen
  Fachbereich weiterleiten“, Grund der Weiterleitung. Nie „Weiterleiten“ allein für `question.forward` (Glossar Zeile 51),
  nie „Matrix“, „Dashboard“, „Team“, „Assignee“, „Ticket“. Kein Rollenname in einem Text.
- **Glossar** (`docs/glossar.md`, eine neue Zeile nach „Steuerungsansicht“): „Verteilung“ / „Distribution“ /
  `Meeting.counts.byUnit` (offen je Fachbereich), `Meeting.counts.bySeat` (auf der Bühne je Bühnenplatz); Summen aus dem
  Dienst, nie je Person (Scheibe 053) / verboten: „Matrix“ (es sind zwei Randsummen), „Dashboard“.

### 8. Zeitmessung (Zuschnitt des Plan-Tors)

Das Plan-Tor „Filterwechsel p90 < 150 ms bei 800“ setzt zweierlei voraus, das es nicht gibt: einen Lastkorpus in der
Oberfläche (die Demo sät 230) und das Tor aus 084 (nicht spezifiziert). Beides in 053 zu bauen hieße, `api/index.ts` (Start
der Demo) und den CI-Ablauf zu ändern, außerhalb der Lane. **Zuschnitt (Eigentümerfrage 5b):**

- **Vitest bei 800, hart:** `apps/web/src/api/timing053.test.ts` (neu; im Ordner `api`, weil nur dort Werte aus `@hv/domain`
  geladen werden dürfen, Regel `web-features-i18n-domain-types-only`) sät `CORPUS_LOAD` über `seedEvents` in einen
  `createInProcessApi` mit injizierter Uhr und misst als `coordination` je Lauf den Filterwechsel des In-Process-Pfads:
  `listQuestions({ limit: LIST_LIMIT, unitId })` für wechselnde Fachbereiche **plus** den Statusfilter mit Sortierung im
  Speicher über die herausgelöste reine Funktion `applyClientFilters(pool, status, sort)` (aus `useBacklog.ts:273-281` nach
  `answers/lib.ts`, ohne Verhaltensänderung). 5 Aufwärmläufe, dann 30 gemessene mit `performance.now()`; **p90 < 150 ms**
  ist hart, p90 gegen 100 ms (D9, E41) wird nur ausgewiesen (Log-Zeile `[timing] 053 in-process filter p90 … ms (D9 100 ms)`).
  Ausgabe im Bericht.
- **Browser bei 230, weich:** im e2e S10 Statusfilter und Drill-down auf `/steering` mit `[timing]`-Zeile, harte Grenze
  1500 ms wie `abnahme.spec.ts:168`.
- **Nicht gemessen:** das Rendern bei 800 im Browser. Die Liste ist gefenstert (`ROW_HEIGHT` 36); das Tor dafür bleibt bei
  084 (Hinweise an den Orchestrator).

### 9. i18n-Schlüssel (25 je Sprache; Paritätstest (f) 561 → 586)

| Modul | Schlüssel | de | en |
|---|---|---|---|
| shell | `nav.steering` | Steuerung | Steering |
| shell | `page.steering.title` | Steuerung | Steering |
| shell | `page.steering.description` | Klassifizieren, zuweisen und an andere Fachbereiche weiterleiten; Verteilung je Fachbereich und Bühnenplatz. | Classify, assign and forward to other answering units; distribution per answering unit and podium seat. |
| steering | `steering.distribution.title` | Verteilung | Distribution |
| steering | `steering.distribution.units` | Offen je Fachbereich | Open per answering unit |
| steering | `steering.distribution.unitsHelp` | Einzelfragen, die weder vorgelesen noch geschlossen, zurückgezogen oder zusammengeführt sind. Summen aus dem Dienst, nie je Person. | Questions not yet read out, closed, withdrawn or merged. Totals from the service, never per person. |
| steering | `steering.distribution.noUnit` | Ohne Fachbereich | No answering unit |
| steering | `steering.distribution.seats` | Auf der Bühne je Bühnenplatz | On the podium per seat |
| steering | `steering.distribution.seatsHelp` | Gestellt und noch nicht vorgelesen. | Staged and not yet read out. |
| steering | `steering.distribution.filter` | {unit}: {count} offen. Liste auf diesen Fachbereich filtern. | {unit}: {count} open. Filter the list to this answering unit. |
| steering | `steering.distribution.loading` | Verteilung wird geladen … | Loading the distribution … |
| steering | `steering.distribution.failed` | Verteilung nicht lesbar; die Liste bleibt bedienbar. | The distribution cannot be read; the list stays usable. |
| steering | `steering.distribution.empty` | Für diese Hauptversammlung sind noch keine Fachbereiche und Bühnenplätze angelegt. | No answering units or podium seats have been set up for this general meeting yet. |
| steering | `steering.detail.empty.title` | Keine Einzelfrage gewählt | No question selected |
| steering | `steering.detail.empty.body` | Links eine Einzelfrage wählen. Hier stehen Antwortpfad, Bühnenplatz, Fachbereich und der nächste Schritt der Steuerung. | Choose a question on the left. Its answer track, podium seat, answering unit and next steering step appear here. |
| steering | `steering.forbidden.title` | In dieser Rolle keine Leseberechtigung für diese Ansicht | No read permission for this view in this role |
| steering | `steering.forbidden.body` | Diese Rolle darf die Einzelfragen nicht lesen. | This role may not read the questions. |
| answers | `answers.forward.body` | Nur der Fachbereich wechselt; Status, Antwortversionen, Rechtsfreigabe und Freigabe bleiben. | Only the answering unit changes; status, answer versions, legal clearance and approval stay. |
| answers | `answers.forward.readers` | Der Zielfachbereich liest danach die Einzelfrage mit Rückgabegrund und Historie. | Afterwards the target answering unit reads the question with its return reason and history. |
| answers | `answers.forward.unit.label` | Zielfachbereich | Target answering unit |
| answers | `answers.forward.unit.placeholder` | Fachbereich wählen | Choose an answering unit |
| answers | `answers.forward.reason.label` | Grund der Weiterleitung | Reason for forwarding |
| answers | `answers.forward.error.guard15` | Die Einzelfrage liegt schon in diesem Fachbereich. | The question is already with this answering unit. |
| answers | `answers.forward.error.invalid` | Eingabe abgewiesen: Fachbereich unbekannt oder Grund fehlt. | Input rejected: unknown answering unit or reason missing. |
| answers | `answers.forward.gone` | {number}: weitergeleitet oder nicht mehr sichtbar. | {number}: forwarded or no longer visible. |

Summe: shell 3, steering 14, answers 8 = **25**. Mitbenutzt, nicht neu: `action.question.forward`,
`action.question.classify`, `action.question.assign`, `action.question.refuse.propose`, `history.forward.reason.*` (über
`forwardReasonLabel`), `answers.detail.{label,speaker,unit,stageAssignment,returned,loading}`, `answers.refusal.badge`,
`capture.classify.*`, `answers.assign.*`, `common.*`. Die Texte darf der Bau glätten; die Zahl ändert er nur mit
Begründung im Bericht.

## Nicht-Ziele

- Keine Änderung an `packages/**`, `apps/api/**`, Seed, Rechten, Übergangstabelle, Wahrheitstabelle, Vertrag.
- Kein Insider-Kennzeichen, kein Vertraulichkeits-Badge, keine Attributregel (047).
- Kein Zurückstellen (046, E30).
- Keine Mehrfachauswahl, keine Einzeltasten-Kürzel, keine Sammelaktion (053b).
- Keine Quelle der Rechtemenge (kein Feld an `/auth/me`, kein Ausblenden in `SideNav.tsx`); kein Tastenkürzel für die Route.
- Keine Kreuztabelle Fachbereich × Bühnenplatz, kein Bühnenplatzfilter, kein Filter „ohne Fachbereich“, keine Zahl je Person.
- Keine Änderung an `QuestionDetail.tsx`, `WorkList.tsx`, `ActionDialogs.tsx`, `RefusalDialog.tsx`, `refusal.ts`,
  `ClassifyDialog.tsx` und an der Erfassung (das Klassifizieren bleibt dort zusätzlich angeboten; Feedback #22 verlangt
  den Ort Steuerung, nicht das Entfernen aus der Erfassung, Eigentümerfrage 6).
- Kein Weiterleiten im Beantwortungsdetail und keine Fokusansicht (054).
- Kein Lastkorpus in der Demo, kein Browser-Tor bei 800, keine Änderung an `.github/workflows/**` (084).
- Keine Änderung an bestehenden Szenarien außer der Reihenfolge im Projekt `http`; keine Zusicherung wird geschwächt.
- Keine Politur aus `docs/folgeliste.md`.

## Files allowed

- `apps/web/src/features/steering/Page.tsx` (neu)
- `apps/web/src/features/steering/DistributionPanel.tsx` (neu), `apps/web/src/features/steering/DistributionPanel.test.tsx` (neu)
- `apps/web/src/features/steering/SteeringDetail.tsx` (neu), `apps/web/src/features/steering/SteeringDetail.test.tsx` (neu)
- `apps/web/src/features/steering/distribution.ts` (neu), `apps/web/src/features/steering/distribution.test.ts` (neu)
- `apps/web/src/features/steering/steering.ts` (neu), `apps/web/src/features/steering/steering.test.ts` (neu)
- `apps/web/src/features/answers/ForwardDialog.tsx` (neu), `apps/web/src/features/answers/ForwardDialog.test.tsx` (neu)
- `apps/web/src/features/answers/forward.ts` (neu), `apps/web/src/features/answers/forward.test.ts` (neu)
- `apps/web/src/features/answers/useWriteDoor.ts` (neu)
- `apps/web/src/features/answers/Page.tsx` (nur Umstellung auf `useWriteDoor`, ohne Verhaltensänderung)
- `apps/web/src/features/answers/useBacklog.ts` (nur Aufruf von `applyClientFilters`)
- `apps/web/src/features/answers/{lib,lib.test}.ts` (nur `applyClientFilters` und ihr Test)
- `apps/web/src/api/timing053.test.ts` (neu)
- `apps/web/src/app/featureRegistry.ts` (nur die Zeile `steering`, ihr Import und ihr Icon)
- `apps/web/src/app/featureRegistry.test.ts` (nur die Erwartungen zur neuen Zeile und zu `requires`)
- `apps/web/src/i18n/steering.de.ts` (neu), `apps/web/src/i18n/steering.en.ts` (neu)
- `apps/web/src/i18n/{de,en}.ts` (nur das Modul `steering`)
- `apps/web/src/i18n/{shell.de,shell.en}.ts` (nur die drei Schlüssel `nav.steering`, `page.steering.*`)
- `apps/web/src/i18n/{answers.de,answers.en}.ts` (nur die acht Schlüssel `answers.forward.*`)
- `apps/web/src/i18n/parity.test.ts` (nur Modul `steering` und 561 → 586)
- `apps/web/e2e/053-steuerung.spec.ts` (neu)
- `apps/web/playwright.config.ts` (nur `SHARED_SPECS`: die neue Datei eintragen)
- `scripts/e2e-http-031.test.mjs` (nur `SHARED_FILES` und `HTTP_ORDER`: die neue Datei an ihrer Pfadstelle zwischen 045 und 080)
- `docs/evidence/053-*.png`
- `docs/glossar.md` (nur die Zeile „Verteilung“ aus Entscheidung 7)
- `docs/folgeliste.md` (nur nicht blockierende Befunde des Baus und des Reviews)
- `docs/slices/053-steuerungsansicht.md` (diese Spec: Bericht, Review findings)

## Ausdrücklich nicht erlaubt

`packages/**`, `apps/api/**`, `apps/web/src/api/**` außer der neuen Testdatei, `apps/web/src/components/**` (ein
fehlendes Bauteil wird in der Ansicht gebaut oder gemeldet), `apps/web/src/app/**` außer den zwei Registerdateien,
`apps/web/src/features/{capture,stage,history,speakers}/**`, `apps/web/src/features/answers/{QuestionDetail,WorkList,ActionDialogs,RefusalDialog,AnswerEditor}.tsx`,
`apps/web/src/features/answers/refusal.ts`, `apps/web/src/i18n/labels.ts`, fremde e2e-Dateien, `.github/**`,
`docs/produktplan-beta.md` (Hinweise an den Orchestrator unten). Dieser Abschnitt steht bewusst außerhalb von „Files allowed“.

## Vor dem Bau prüfen

1. 048 gemergt, Vertrag 0.4.3, `forwardQuestion` im HTTP-Client und in `WRITE_METHODS`; `forwardReasonLabel` exportiert aus
   `i18n/labels.ts` (048 Befund 4: nicht über `i18n/index.ts`). Fehlt etwas: anhalten.
2. `listQuestions` liefert `_actions` je Listeneintrag in beiden Projekten (die Liste wird nur zur Auswahl gebraucht; das
   Detail liest die Einzelfrage ohnehin neu). Sonst meldet der Bericht es; 053 braucht es nicht, 053b schon.
3. `listMeetingStageSeats(meeting.id)` ist für `coordination` in beiden Projekten lesbar (maskiert, mit `label`). Sonst zeigt
   die Bühnenplatzleiste den Fehlerzustand, und der Bericht nennt es.
4. Seed in beiden Projekten wie im Befund: mindestens zwei `captured`, zwei `classified` Textpfad-Fragen ohne Fachbereich
   und zwei `assigned` in „Operations“ (`unit-ops`). Im Projekt `http` außerdem prüfen, welche Fragen 002, 021b, 021c und 045
   vor dieser Datei verändern (`HTTP_ORDER`), und ob „AR-Büro“ (`unit-ar`) als Ziel frei ist. Abweichung: Konstanten in der
   Datei anpassen und im Bericht nennen; fehlt eine Vorbedingung im Projekt `http`, anhalten und melden.
5. Die Namen der Fachbereiche im Filter: der Kurzname (`shortName`, 045: „Finanzen“). Konstanten `SOURCE_UNIT = 'Operations'`,
   `TARGET_UNIT = 'AR-Büro'`, `EXPERT_UNIT = 'Finanzen'` (nur zum Ausschließen) mit Quelle in der Datei. **Keine Konstante
   heißt SECRET, TOKEN, KEY oder PASSWORD** (Lehre aus 045, gitleaks).
6. **Laufzeit `e2e-http`.** Die Dauer des Schritts „End-to-end http project …“ aus den letzten drei grünen Läufen von
   `e2e-http` neu lesen (`gh api repos/ypoxx/hvworkflow/actions/runs/<id>/jobs`, Felder `steps[].started_at` und
   `completed_at`). Stand der Spec: höchstens **4:19** (Befund). Schätzung der Mehrzeit dieser Datei: rund 12 Rollenwechsel
   × höchstens 3 s + 4 Schreibschritte × 1 s + Navigation, Historie, axe und Screenshots rund 50 s ≈ **1,5 min**; Ist plus
   Schätzung ≈ 5,8 min < 8:00 (Harness) < 9:00 (Schritt). **Liegt Ist plus Schätzung über 8:00, anhalten und melden**; der
   Bau ändert den Workflow nicht. Ist, Schätzung und tatsächliche Dauer stehen im Bericht.
7. Ob `featureRegistry.test.ts` weitere Annahmen über die Zahl der Einträge trifft (`001-shell.spec.ts:40-53` zählt nicht,
   sondern prüft Sichtbarkeit; bleibt grün).

## Tests zuerst (rot, dann grün)

Jeder Test steht vor der Änderung und ist rot (Ausgabe im Bericht), danach grün.

**Unit (Vitest)**

1. `distribution.test.ts`, `unitCells`/`noUnitCount`: eine Zelle je Fachbereich in Stammdatenreihenfolge mit genau dem
   Wert aus `counts.byUnit` (auch 0); ein Schlüssel in `byUnit` ohne Stammdatensatz erscheint nicht; „Ohne Fachbereich“ =
   `open − Σ byUnit`, nie negativ; `byUnit` fehlt → `undefined`.
2. `distribution.test.ts`, `seatCells`: Reihenfolge nach `position`, dann Bezeichnung; Wert aus `counts.bySeat`; ohne
   Bezeichnung die id; `bySeat` fehlt → `undefined`.
3. `DistributionPanel.test.tsx` (statisch gerendert wie `Podium.test.tsx`): jede Zelle trägt `data-count` gleich dem
   Zähler und zeigt ihn als Text; Fachbereichszellen sind `<button>` mit `aria-label` aus `steering.distribution.filter`,
   aktiver Filter `aria-pressed="true"`; „Ohne Fachbereich“ und Bühnenplätze sind keine Schaltflächen; Zustände laden,
   Fehler (fehlende Zähler), leer; kein Text enthält eine Person.
4. `steering.test.ts`, `steeringActions`: Rangfolge forward vor assign vor classify; mit `question.forward` kein
   `assign` in primär oder sekundär; `question.refuse.propose` allein → keine primäre, eine sekundäre Aktion; leere Liste →
   nichts; **Statusunabhängigkeit**: dieselbe Liste für Datensätze in `classified`, `assigned` und `in_review` ergibt
   dasselbe Ergebnis; fremde Rechte (`answer.draft`, `question.approve`) werden ignoriert.
5. `forward.test.ts`: `forwardTargets` ohne aktuellen Fachbereich, Reihenfolge erhalten, ohne aktuellen alle;
   `buildForwardRequest` nur mit beiden Angaben, genau die Schlüssel `unitId` und `reasonCode`, keine Schlüssel mit
   `undefined`; `forwardProblemKey`: 409 R-GUARD-15 → `guard15`, 422 → `invalid`, 404 → `gone`, 409 R-TRANS-00, 412, 403 →
   `undefined`; `forwardProblemHandler`: `guard15`/`invalid` → `true` ohne Schließen, `gone` → schließt und meldet, 412 →
   schließt nur bei `stillShown()` und gibt `false`.
6. `ForwardDialog.test.tsx` (statisch, `vi.mock` des Dialograhmens wie 045 Test 6; optionale Eigenschaft
   `initialForm` nur für Tests): Absenden gesperrt ohne Fachbereich, ohne Grund; aktueller Fachbereich nicht unter den
   Optionen; vier Gründe mit den Bezeichnungen aus `forwardReasonLabel`, keiner vorgewählt; kein Zielfachbereich
   vorgewählt; **kein `<textarea>` und kein Texteingabefeld**; Hinweis zum Leserkreis mit `role="note"` und über
   `aria-describedby` verknüpft; Meldungen `guard15`/`invalid` mit `role="alert"` und Regel-id.
7. `SteeringDetail.test.tsx` (statisch): Schaltflächen genau nach `_actions` (Fälle aus Entscheidung 5 als `_actions`-Listen),
   die primäre mit `data-primary="true"`; ohne Steuerungsrecht keine Aktionsleiste; Fachbereich und Bühnenplatz als
   Bezeichnung, unbekannter Bühnenplatz als id in Mono; Verweigerungsbadge bei letzter Version Verweigerung; ein Datensatz
   mit `refusalJustification` rendert den Begründungstext nicht.
8. `lib.test.ts`, `applyClientFilters`: Status „alle“ und ein Status; Sortierung nach Nummer und nach Alter; Ergebnis gleich
   der bisherigen Inline-Fassung (Vergleich auf einem Seed-Ausschnitt), Eingabe unverändert.
9. `featureRegistry.test.ts`: Zeile `steering` mit `path` `/steering`, `requires` `question.classify`, ohne `shortcutKey`,
   zwischen `capture` und `answers`; `visibleRoutes(FEATURES, new Set())` enthält `steering` **nicht** und alle übrigen;
   mit `{ 'question.classify' }` enthält es sie; ohne Menge alle (Navigation heute unverändert); Kurzbefehle weiter
   Alt+1…5 eindeutig. Die bisherige Erwartung „no route requires permissions“ wird ersetzt, nicht gelöscht: sie gilt für
   alle Zeilen außer `steering`.
10. `parity.test.ts` (f): 586 je Sprache; Modul `steering` mit Präfix `steering`.
11. `timing053.test.ts`: Entscheidung 8; p90 < 150 ms hart, Log-Zeile mit p90 und D9-Ausweis.

**Playwright, `apps/web/e2e/053-steuerung.spec.ts`, Projekte `in-process` und `http`**

**Aufbau und Isolation (wie 045).**
- `test.describe.serial('053 …')`. Jeder Test bringt seine Vorbedingung selbst mit; kein Test verlässt sich auf den
  Browser-Zustand eines anderen. Eine Hilfe in der Datei: **`findSteerable(page, role, opts: { status: QuestionStatus;
  button: 'steering-classify' | 'steering-assign' | 'steering-forward' | 'steering-refuse'; unitName?: string; exclude?:
  readonly string[] })`**: wechselt per `asRole`, öffnet `/steering`, leert die Suche, setzt den Statusfilter
  (`answers-filter-status-<status>`, im Client); ist `unitName` gesetzt, wählt sie den Fachbereich im Filter
  (`answers-filter-unit`) und **wartet, bis jede Zeile `data-unit` dieses Fachbereichs trägt** (der Fachbereichsfilter wirkt
  im Dienst; in `http` kommt die gefilterte Liste verzögert, Lehre aus 045, CI-Lauf 37152696332). Dann wählt sie die erste
  Zeile, deren Nummer nicht in `exclude` steht, wartet, bis `steering-detail-number` diese Nummer zeigt, und prüft die
  Schaltfläche `button`. Nie eine feste Nummer; nie eine Frage in `EXPERT_UNIT`.
- Nach jedem Schreibschritt wartet der Test auf den neuen Datensatz (Statusbadge oder `steering-detail-unit`) und auf die
  neue Zahl in der Verteilung (`expect.poll` auf `data-count`), bevor er weitergeht.
- Im Projekt `in-process` beginnt jeder Test mit frischem Demo-Zustand; `--repeat-each=3` ist damit unabhängig.
- Im Projekt `http` bleibt die Datenbank über Dateien hinweg bestehen. **Endzustand nach der Datei**, als Kommentar am
  Dateikopf und im Bericht:
  - S2: eine zuvor `captured` Einzelfrage ist `classified` (`expert_track`, Bühnenplatz Finanzvorstand);
  - S3: eine zuvor `classified` Textpfad-Frage ohne Fachbereich ist `assigned` an „Operations“;
  - S4: eine `assigned` Einzelfrage aus „Operations“ liegt in „AR-Büro“, Status `assigned`, mit einem `QuestionForwarded`
    (Grund `expertise_elsewhere`);
  - keine Frage in „Finanzen“ (Einheit der Expert-Testperson) ist berührt; die Bühne ist unverändert; S1, S5–S10 schreiben
    nichts.
  Folgen für die Nachfolger: `080-sprecher-zustand.spec.ts` berührt nur Wortmeldungen; `abnahme.spec.ts` erfasst und
  klassifiziert eigene Fragen und braucht nur mindestens eine `classified`-Zeile für seine Zeitmessung (Seed 7, S2 +1, S3 −1).
  Die CI startet `e2e-http` mit frischer Datenbank.

**Fälle**

- **S1 Verteilung gegen die Zähler @screenshot.** `coordination` öffnet `/steering`: Verteilung sichtbar; jede Zelle zeigt
  als Text genau ihr `data-count`; Σ der Fachbereichszellen ≤ Zahl in `header-counter-open` und Σ der Bühnenplatzzellen ≤
  Zahl in `header-counter-staged` (dieselbe Quelle `counts`; eine Frage ohne oder mit unbekanntem Fachbereich bzw.
  Bühnenplatz zählt unter keiner Zelle, daher ≤). Die eigentliche Probe ist der **Drill-down:** Zelle `SOURCE_UNIT` aktivieren → Fachbereichsfilter
  zeigt `SOURCE_UNIT`, warten, bis jede Zeile `data-unit = unit-ops` trägt; die Summe der Zähler der Statussegmente
  `captured` bis `staged` der Arbeitsliste (`answers-filter-status-<s>`, Zahl am Ende des Segmenttexts) ist gleich `data-count`
  der Zelle. Eine Einzelfrage wählen; Screenshots `053-steuerung-de.png`, `053-steuerung-en.png`. axe ohne
  serious/critical (S8).
- **S2 Klassifizieren.** `findSteerable(page, 'coordination', { status: 'captured', button: 'steering-classify' })`:
  Klassifizieren ist primär; Dialog: Antwortpfad `expert_track`, Bühnenzuordnung Finanzvorstand, speichern → Status
  „klassifiziert“, Detail zeigt Antwortpfad und Bühnenplatz; „Ohne Fachbereich“ unverändert, Bühnenplatzleiste
  unverändert (die Frage steht nicht auf der Bühne).
- **S3 Zuweisen.** `findSteerable(page, 'coordination', { status: 'classified', button: 'steering-assign' })` (eine
  Textpfad-Frage; Podiumsfragen bieten Zuweisen nicht an, R-GUARD-03): Zuweisen ist primär, Klassifizieren und
  Verweigerung vorschlagen sekundär; Dialog, `SOURCE_UNIT` wählen, zuweisen → Status „zugewiesen“, `steering-detail-unit`
  zeigt `SOURCE_UNIT`; Zelle `SOURCE_UNIT` +1, „Ohne Fachbereich“ −1 (live über den Strom).
- **S4 Weiterleiten @screenshot.** `findSteerable(page, 'coordination', { status: 'assigned', button: 'steering-forward',
  unitName: SOURCE_UNIT })`: Weiterleiten ist primär, **Zuweisen fehlt**; Dialog: Absenden gesperrt; `SOURCE_UNIT` nicht unter
  den Optionen; nur Ziel gewählt → gesperrt; nur Grund gewählt → gesperrt; Hinweis zum Leserkreis sichtbar; kein Textfeld;
  `TARGET_UNIT` und „Fachwissen liegt in einem anderen Fachbereich“ wählen; Screenshots `053-weiterleiten-de.png`,
  `053-weiterleiten-en.png`; absenden → Status unverändert „zugewiesen“, `steering-detail-unit` zeigt `TARGET_UNIT`, Fokus
  nach Entscheidung 2; Zellen `SOURCE_UNIT` −1, `TARGET_UNIT` +1. In der Historie derselben Einzelfrage (Suche nach Nummer)
  die Zeile „An anderen Fachbereich weitergeleitet“ mit „Operations → AR-Büro“ und „Grund: Fachwissen liegt in einem anderen
  Fachbereich“. axe auf dem offenen Dialog (S8).
- **S5 Rechte als Daten (schreibt nichts).** `capture` auf `/steering`: Liste sichtbar, keine der vier Schaltflächen im
  Detail einer gewählten Frage. `approver`: auf einer `classified` Textpfad-Frage „Zuweisen“ vorhanden, „Klassifizieren“ und
  „Weiterleiten“ fehlen; auf einer `assigned` Frage „Zuweisen“ vorhanden (kein `question.forward`), „Weiterleiten“ fehlt.
  `podium`: `steering-forbidden` sichtbar, keine Liste, keine Verteilung. Navigation: der Eintrag `nav-steering` ist für alle
  drei sichtbar (Befund; Eigentümerfrage 3), das ist hier Zusicherung, damit eine spätere Quelle der Rechtemenge diesen Test
  bewusst ändert.
- **S6 Eingaben je Akteur und je Frage (090).** `coordination` öffnet den Weiterleiten-Dialog auf Frage X, wählt Ziel und
  Grund; Wechsel zu `capture` und zurück: Dialog geschlossen; erneut öffnen → kein Ziel, kein Grund gewählt. Abbrechen,
  Frage Y wählen, öffnen → leer; zurück zu X → leer. Schreibt nichts.
- **S7 Tastatur (D8).** Von der Seitenüberschrift per Tab zur ersten Fachbereichszelle, Enter filtert (Filter zeigt den
  Fachbereich), Fokus sichtbar. Weiterleiten-Dialog vollständig per Tastatur: Tab zur Auswahl, Pfeile, Tab zur Radiogruppe,
  Pfeile, Tab bis Absenden; **Absenden hat den Fokus und ist aktiv, wird aber nicht ausgelöst**; Escape schließt ohne
  Schreiben (Muster 045 E7).
- **S8 axe** ohne serious/critical auf Seite, Weiterleiten-Dialog und Klassifizierungsdialog, de und en (innerhalb von S1,
  S2, S4).
- **S9 Verweigerung aus der Steuerung (schreibt nichts).** `coordination` auf einer `assigned` Frage (nicht `EXPERT_UNIT`):
  `steering-refuse` ist sekundär und öffnet den Dialog „Verweigerung vorschlagen“ aus 045 (Titel, Radiogruppe ohne
  Vorauswahl); Abbrechen.
- **S10 Zeit (weich).** Statusfilterwechsel und Drill-down auf `/steering` mit `[timing]`-Zeile, harte Grenze 1500 ms
  (Entscheidung 8).

Im Projekt `http` laufen S1–S10 genauso; die Screenshots gehen dort in das Ausgabeverzeichnis (`support/evidence.ts`).
Lokal mit `E2E_HTTP_IDP=none` läuft die Datei nicht (sie braucht Anmeldungen).

**Ersetztes Prüfziel des Plans.** „Playwright Matrix-Zahlen gegen counts“: Eine Matrix gibt es nicht (Befund). Ersetzt
durch Test 3 (jede Zelle gleich dem Zähler), S1 (Summen gegen die Kopfzähler, Drill-down gegen die Liste) und S3/S4 (Zellen
bewegen sich mit dem Schreibvorgang).

## Akzeptanzkriterium

1. Tests 1–11 und S1–S10 vor der Änderung rot (Ausgabe im Bericht), danach grün; S1–S10 im Projekt `in-process` auch mit
   `--repeat-each=3`.
2. Volle Playwright-Suite `in-process` grün (Anzahl nennen), darunter **unverändert** 003, 010c, 010d, 013, 021b, 021c, 045
   und 090 (Nachweis für Entscheidung 6); axe ohne serious/critical. Projekt `http` grün im CI-Lauf `e2e-http` des PR.
3. Vier Screenshots in `docs/evidence/` aus dem Projekt `in-process`: `053-steuerung-de.png`, `053-steuerung-en.png`,
   `053-weiterleiten-de.png`, `053-weiterleiten-en.png`. Auf dem Steuerungsbild sind beide Leisten der Verteilung, die
   Arbeitsliste und das Detail mit genau einer primären Aktion lesbar; auf dem Dialogbild der Hinweis zum Leserkreis und
   keine Vorauswahl.
4. Kein Rollenname in einem Vergleich in `apps/web/src` (`pnpm role-literals`); keine Statusabfrage zur Wahl einer Aktion
   in `features/steering/**` und `forward.ts`; kein Literal in Komponenten (`pnpm i18n-literals`); `pnpm vocabulary` grün;
   Paritätstest 586.
5. `timing053.test.ts` grün mit p90 < 150 ms; p90 und D9-Ausweis im Bericht.
6. `pnpm slice-scope` grün auf dem Branch `claude/slice-053-…`.
7. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Nachweise

- Ausgabe der roten Tests vor der Änderung, Schluss von `pnpm gates`, Playwright-Zahlen, Zeitmessung aus Test 11.
- `docs/evidence/053-*.png` (vier Dateien aus `in-process`, Akzeptanzkriterium 3). Das ist der Bildnachweis.
- **Projekt `http`:** der grüne CI-Lauf `e2e-http` des PR mit **Lauf-ID**, Job-ID und dem **Schluss des Logs**, in dem die
  Zeilen der Fälle aus `053-steuerung.spec.ts` stehen; dazu die Dauer des Schritts „End-to-end http project …“ gegen das
  Limit 9:00. Kein Artefakt nötig, keine Workflow-Änderung.
- Laufzeitmessung aus Vor-dem-Bau-Punkt 6 (Ist, Schätzung, tatsächliche Dauer im PR-Lauf).
- Design-Kritik D1–D10 als Tabelle im Bericht (je Zeile ja/nein mit einem Satz), gegen die Vorgaben unten.

### Design-Vorgaben D1–D10 (Checkliste `docs/design-prinzipien.md`)

| D | Vorgabe für diese Scheibe | Prüfung |
|---|---|---|
| D1 | In 30 s klar: oben „wo liegt was“, links die Liste, rechts eine Einzelfrage mit ihrem nächsten Schritt. Titel und ein Beschreibungssatz, keine Erklärtexte über der Liste. | Screenshot, Review |
| D2 | Im Detail höchstens eine primäre Aktion, aus `steeringActions`; „Verweigerung vorschlagen“ nie primär; im Dialog nur Absenden primär. | Test 4, 7; S2–S4 |
| D3 | Verteilung im 8-px-Raster, Zellen gleicher Höhe, Kanten fluchten mit Liste und Detail; Panels 16–24 px Innenabstand. | Screenshot |
| D4 | Keine Farbflächen, keine Balkenfarbe nach Höhe; Null in Grau 300; Status- und Verweigerungsbadge als zarte Tönung. | Screenshot, Review |
| D5 | Zahlen der Verteilung, Nummern und ids in Mono, rechtsbündig; Meldungen im Dialog mit Regel-id. | Test 3, 6 |
| D6 | Laden, Fehler und leer für die Verteilung, leerer Zustand des Details, Lesezustand ohne Recht (`steering-forbidden`). | Test 3; S5 |
| D7 | 25 Schlüssel je Sprache, Hausvokabular („An anderen Fachbereich weiterleiten“, „Verteilung“, nie „Matrix“), kein Rollenname. | Test 10; `pnpm vocabulary`, `pnpm i18n-literals` |
| D8 | Kernszene mit Tastatur: Zelle per Tab und Enter, Dialog ganz per Tastatur, Fokus sichtbar, Fokus nach Aktion (takt-008). | S7 |
| D9 | Was nicht erlaubt ist, fehlt (keine ausgegraute Schaltfläche); Filterwechsel im In-Process-Pfad bei 800 gemessen (p90 < 150 ms, Ausweis gegen 100 ms). | Test 7, 11; S5, S10 |
| D10 | Ruhig und präzise: eine schmale Leiste statt Diagramm, keine Kacheln, keine Symbole ohne Bedeutung. | Screenshot, Design-Kritik |

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: mittel
Ausgelöst: [x] Fachregel, Status (nur Anzeige und vorhandene Übergänge) [ ] Vertrag, Ereignis, Konfiguration [ ] Persistenz,
Migration, Nebenläufigkeit [ ] Rolle, Recht, Identität, Schutzklasse (nur `_actions` und eine Registerzeile als Daten, keine
Änderung) [ ] personenbezogene oder vertrauliche Daten (keine neue Anzeige; Weiterleiten nach 048) [ ] Betrieb,
Wiederherstellung [ ] Administration [x] Oberfläche, Barrierefreiheit [ ] Nachbarsystem [ ] KI, Agenten [x] Dokumentation,
Schulung (Glossar)
Perspektive(n): UX, Datenschutz · Nachweise: oben · Offene Entscheidung: E1 (ohne Wirkung), E5 (Standard aus 048)

## Wirkung und Risiko

| Risiko | Abwehr | Nachweis |
|---|---|---|
| Herauslösen der Schreibtür ändert die Beantwortung | Hook übernimmt den Code wörtlich; Halt statt Kopie | Akzeptanzkriterium 2 (bestehende Szenarien unverändert grün) |
| Weiterleiten an einen nicht gewählten Fachbereich (Leserkreis) | keine Vorauswahl, Absenden erst mit Ziel und Grund, Hinweis zum Leserkreis | Test 5, 6; S4 |
| Freitext im Grund gelangt ins Log | kein Textfeld; Anfrage hat genau zwei Schlüssel | Test 5, 6 |
| Schaltfläche ohne Recht, Rollen- oder Statuslogik in der Oberfläche | `steeringActions` liest nur `_actions` | Test 4, 7; S5; `pnpm role-literals` |
| Verteilung zeigt etwas anderes als der Dienst | nur `counts`, keine eigene Zählung | Test 1–3; S1, S3, S4 |
| e2e greift eine Zeile, bevor der Serverfilter angekommen ist | Warten auf `data-unit` jeder Zeile | S1, S4 (Lehre 045) |
| e2e hinterlässt im Projekt `http` einen Stand, der Nachfolger stört | Endzustand benannt, nie „Finanzen“, Bühne unberührt | Endzustand, Vor-dem-Bau-Punkt 4 |
| Eingaben einer Person im Dialog einer anderen | nur offen montiert, Schlüssel aus Akteur und Frage | S6 |
| Steuerung für Rollen ohne Recht in der Navigation sichtbar | Seite zeigt Lesezustand bzw. keine Schaltflächen; Quelle der Rechtemenge als Folgepunkt | S5; Eigentümerfrage 3 |
| `e2e-http` überschreitet 9 min | Messung vor dem Bau, Halt über 8:00 | Vor-dem-Bau-Punkt 6 |

## Aufwand

Geschätzt **3,4 AStd** (Spanne 3,0–4,0) statt 2,5 laut Plan, der die Mehrfachauswahl (053b, 1,25 AStd) mitzählt:

| Teil | AStd |
|---|---|
| Registerzeile, Seitenrahmen, Lesezustand, Shell-Schlüssel, Test 9 | 0,2 |
| Schreibtür herauslösen, Beantwortung darauf umstellen, Regressionslauf | 0,45 |
| Verteilung (reine Hilfen, Leisten, Drill-down, Zustände), Tests 1–3 | 0,5 |
| Steuerungsdetail mit `steeringActions`, Verdrahtung von Klassifizieren, Zuweisen, Verweigerung, Fokus nach Aktion, Tests 4, 7 | 0,5 |
| Weiterleiten-Dialog mit `forward.ts`, Tests 5, 6 | 0,5 |
| i18n 25 Schlüssel je Sprache, Modul, Parität, Glossarzeile | 0,15 |
| `applyClientFilters`, Zeitmessung Test 8, 11 | 0,15 |
| e2e S1–S10 in beiden Projekten, Isolation und Endzustand, Einreihung `http`, Reihenfolge-Pin, Laufzeitmessung | 0,7 |
| Screenshots, axe, Design-Kritik, `pnpm gates`, Bericht, CI-Nachweis | 0,25 |

**Teilung:** Die volle Planzeile käme auf rund 4,65 AStd und läge damit über einem Agententag mit Puffer; die
Mehrfachauswahl ist fachlich abtrennbar (eigene Fehlerlogik bei Teilerfolg, kein Abnehmer in 054–061). Deshalb 053 (diese
Spec) und 053b (Skizze oben, eigene Spec vor dem Bau).

**Zuschnitt bei Überschreitung (vorbereitet).** Zeichnet sich ab, dass der Bau über 4,0 AStd geht, committet er nach
Entscheidung 1, 2, 4, 5 und 6 (Route, Seite, Weiterleiten-Dialog, Detail, Schreibtür) mit Tests 4–7, 9, 10 und S2–S7, S9 einen
Zwischenstand und meldet. Der Rest (Verteilung, Entscheidung 3 und 8, Tests 1–3, 8, 11, S1, S8 für die Verteilung, S10, die
Steuerungs-Screenshots) folgt als 053c **erst nach einer eigenen Spec** `docs/slices/053c-*.md` (Ziel, Nicht-Ziele, Regel-ids,
Abnahme, „Files allowed“ als Teilmenge dieser Liste; AGENTS.md Regel 1). Der Orchestrator schreibt sie aus diesem Abschnitt, bevor
der Rest gebaut wird (Codex P1 auf #144).

## Standards (auf Standard gebaut)

| Standard | Was 053 baut | Kosten einer späteren Änderung |
|---|---|---|
| Weiterleiten-Dialog einmal, im Feature `answers`, in 053 nur in der Steuerung angeboten | `ForwardDialog`, `forward.ts` | zusätzlich im Beantwortungsdetail: rund 0,2 AStd |
| In der Steuerung ersetzt Weiterleiten das Zuweisen, wo beides erlaubt ist | `steeringActions` | beides anbieten: < 0,1 AStd |
| Kein Ziel und kein Grund vorgewählt | Dialog | Vorauswahl: < 0,1 AStd (Datenschutz-Review nötig) |
| Navigationseintrag für alle sichtbar, bis die Rechtemenge eine Quelle hat | `requires` als Daten | Quelle der Menge: Vertragsfeld an `/auth/me` und In-Process-Ableitung, rund 1,0 AStd, eigene Scheibe |
| Kein Tastenkürzel für `/steering` | Registerzeile ohne `shortcutKey` | Alt+7: < 0,1 AStd |
| Zwei Leisten statt Kreuztabelle | `distribution.ts` | Kreuztabelle aus der Liste (nur offene mit Bühnenplatz): rund 0,4 AStd |
| Klassifizieren über den Dialog der Erfassung (Enum der Bühnenzuordnung) | Wiederverwendung | Dialog auf Bühnenplätze der Stammdaten mit `seatId`: rund 0,3 AStd |
| Filter starten leer | `EMPTY_FILTERS` | Voreinstellung (etwa „erfasst“): < 0,1 AStd |
| Zeitmessung des In-Process-Pfads bei 800, Browser weich bei 230 | `timing053.test.ts`, S10 | Browser-Tor bei 800: rund 0,6 AStd mit Lastkorpus-Schalter im Demo-Start (084) |

## Offene Eigentümerfragen

Keine blockiert den Bau; alle mit Standard.

1. **Weiterleiten auch im Beantwortungsdetail?** Standard: nein, nur in der Steuerung (053) und in der Fokusansicht (054,
   derselbe Dialog). Option: zusätzlich im Beantwortungsdetail für alle mit `question.forward`, rund 0,2 AStd; dann leitet die
   gebundene Fachkraft schon vor 054 weiter.
2. **Weiterleiten statt Zuweisen in der Steuerung**, wo beides erlaubt ist (`assigned`). Standard: nur Weiterleiten (Grund im
   Protokoll). Option: beides, < 0,1 AStd. Hinweis: Der unveränderte `AssignDialog` wählt den aktuellen oder ersten
   Fachbereich vor; das bleibt, wie es seit 021b ist.
3. **Navigation und Tastenkürzel.** Standard: `/steering` steht für alle Rollen in der Navigation (wie alle Ansichten heute),
   ohne Kürzel. Option A: Quelle der Rechtemenge bauen (Vertragsfeld `permissions` an `GET /auth/me`, In-Process aus
   `can()`), rund 1,0 AStd mit Vertragsschritt, eigene Scheibe; dann blendet `visibleRoutes` den Eintrag ohne
   `question.classify` aus. Option B: Alt+7 für die Steuerung, < 0,1 AStd.
4. **Verteilung als Kreuztabelle?** Standard: zwei Leisten aus den Zählern des Dienstes. Option: Kreuztabelle Fachbereich ×
   Bühnenplatz aus der gelesenen Liste (offene Fragen mit Bühnenplatz), rund 0,4 AStd; die Zahlen kämen dann nicht aus
   `counts`.
5. **Voreinstellung der Filter** (a) und **Zeitnachweis** (b). Standard (a): alle Status. Standard (b): In-Process-Pfad bei
   800 hart in Vitest, Browser weich bei 230; das Browser-Tor bei 800 bleibt bei 084. Option (b): Lastkorpus-Schalter im
   Demo-Start und Playwright-Tor in dieser Scheibe, rund 0,6 AStd, Lanes web-api und e2e.
6. **Klassifizieren.** Standard: Dialog der Erfassung wiederverwendet, das Klassifizieren bleibt zusätzlich auf der
   Erfassungskarte, Bühnenplätze über das Enum. Option: Dialog auf die Bühnenplätze der Stammdaten (`seatId`), rund
   0,3 AStd; Entfernen aus der Erfassung < 0,1 AStd plus e2e 021b.
7. **053b einplanen.** Standard: 053b hinten an die Kette E57 (nach 041), damit die vereinbarte Reihenfolge bleibt. Option:
   direkt nach 054.
8. **Risikoklasse.** Standard: mittel wie im Plan (Begründung „Warum mittel“). Hochstufen darf der Eigentümer jederzeit;
   dann kommt ein Lesebefund vor dem Bau hinzu (rund 0,3 AStd).

## Hinweise an den Orchestrator

- **Plan-Eintrag 053 (§5, Zeile 753–758)** stimmt in mehreren Punkten nicht mit dem Stand überein; nicht Teil dieser Spec:
  - „Matrix aus counts.byUnit und counts.bySeat“: Die Zähler sind zwei Randsummen über verschiedene Mengen (offen je
    Fachbereich, auf der Bühne je Bühnenplatz); eine Matrix lässt sich daraus nicht bilden. Vorschlag: „Verteilung je
    Fachbereich und je Bühnenplatz aus counts.byUnit und counts.bySeat“; Nachweis „Playwright Matrix-Zahlen gegen counts“ →
    „Zellen gleich den Zählern, Drill-down gegen die Liste“.
  - Abhängigkeit **082** ist erfüllt (`c8bcf83`); offen ist die **Quelle der Rechtemenge** (082 hat sie an 010/029
    verwiesen, keine hat sie geliefert). „sichtbar über das Recht question.classify“ wirkt erst mit dieser Quelle. Vorschlag:
    eigener Folgepunkt (Eigentümerfrage 3A), auch für 054, 059 und 061, die dieselbe Annahme treffen.
  - **„Zurückstellen“** braucht 046 (E30), das weder Abhängigkeit von 053 ist noch vor 053 steht; streichen und bei 046
    führen.
  - **„Insider-Kennzeichen“** und **„Vertraulichkeits-Badge“** sind 047; als „mit 047“ markieren.
  - **„Mehrfachauswahl mit Einzeltasten“** → 053b (1,25 AStd).
  - **Zeitmessung** setzt 084 voraus (nicht spezifiziert) und einen Lastkorpus in der Oberfläche; Abhängigkeit 084 ergänzen
    oder das Tor dort führen.
  - Abhängigkeiten „021c, 043, 036, 047, 040, 082“ → „045, 048, 040, 036, 082“ (047 als Ergänzung später); Aufwand
    2,5 → 3,4 AStd plus 1,25 für 053b; Lanes „web-steering“ → zusätzlich web-answers, web-shell, e2e.
- **Plan-Eintrag 054:** den Weiterleiten-Dialog aus 053 wiederverwenden (`features/answers/ForwardDialog.tsx`), nicht neu
  bauen; Aufwand dort um rund 0,4 AStd senken.
- **084:** Das Browser-Tor bei 800 braucht einen Lastkorpus-Schalter im Demo-Start (`apps/web/src/api/index.ts`) bzw. eine
  mit 800 gesäte Datenbank im Projekt `http`; `timing053.test.ts` misst bis dahin den In-Process-Pfad.
- Folgeliste (Einträge legt der Bau an): Quelle der Rechtemenge (Eigentümerfrage 3A); Klassifizieren auf `seatId` der
  Stammdaten (Eigentümerfrage 6); Vorauswahl im `AssignDialog` prüfen (Leserkreis, wie beim Weiterleiten).

## Hinweise an Folgescheiben

- **054 (Fokusansicht):** `ForwardDialog` und `forwardProblemHandler` übernehmen; 404 heißt „weitergeleitet oder nicht mehr
  sichtbar“ (`answers.forward.gone`), schon gebaut. Die Schreibtür `useWriteDoor` steht für eine dritte Seite bereit.
- **047:** Badge in `SteeringDetail` und in der Arbeitsliste, Insider-Kennzeichen im Klassifizierungsdialog; der
  Weiterleiten-Dialog braucht bei `protected` gegebenenfalls einen eigenen Hinweis (048 „Hinweise 047“).
- **053b:** Schnittmenge der `_actions` markierter Zeilen; Dialoge aus 053 (Zuweisen, Weiterleiten) mit Liste statt einer
  Frage; Schreibtür je Einzelfrage.
- **061 (Leitstand):** „Rückstand je Fachbereich“ kann `unitCells` aus `distribution.ts` nutzen.
- **046:** Zurückstellen als sekundäre Aktion im Steuerungsdetail über `steeringActions`, sobald das Recht und die Zeile
  stehen.

## Bericht (nach Bau ausfüllen)

```
Slice: 053-steuerungsansicht
Done: …
Evidence: …, docs/evidence/053-{steuerung,weiterleiten}-{de,en}.png
Open: …
Touched: …
```

## Review findings

(nach dem Review)
