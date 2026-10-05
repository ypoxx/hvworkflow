# Scheibe 041 — Verwaltung /admin (erster Schnitt für die Freigabe-Demo) und Admin-Anleitung v1

**Status:** spec (05.10.2026; gelesen auf `c5990c8`: 040a und 040b gebaut und gemergt, 040c und 040d zurückgestellt, Vertrag 0.4.4. Eigentümerentscheidung 05.10.2026: 041 darf für die Freigabe-Demo teilweise gebaut werden. Diese Spec schneidet den Teil, der nur vorhandene Operationen nutzt; alles, was 040c, 040d oder neue Endpunkte braucht, geht nach **041b** (Skizze unten). Plan §11 „Folgen der Zurückstellung“ nennt diesen Zuschnitt schon)
**Risikoklasse:** mittel · 3,5 AStd (Spanne 3,0–4,0; Plan 041: mittel · 2,5 AStd für die ganze Planzeile einschließlich Anlegen und Freeze, die hier nach 041b gehen; Begründung in „Warum mittel“ und „Aufwand“) · Plan 041: 04.11.2026 (W6), tatsächlich als letzte Scheibe der Oberflächenkette der Freigabe-Demo (Register E57) · Lanes: web-admin (neu, `apps/web/src/features/admin/**`); web-shell (eine Zeile im Feature-Register, drei Shell-Schlüssel, Modulregistrierung); web-api (nur ein neues reines Wertemodul für die Rollenkarten mit Test); e2e (eigene Datei in beiden Projekten, eine zehnte Testperson nur im Harness von `e2e-http`); docs (Admin-Anleitung v1, Glossarzeilen, eine Zeile Bedrohungsmodell, Nachweise)
**Bedrohungsmodell:** berührt SG6 (Rechteverwaltung), MF-01 und MF-07 (Selbst- und Gegenzuordnung; abgewehrt im Kern durch R-ADM-07, angezeigt hier), T-G1-E-01 und T-G1-T-02 (Stammdaten verändern). Keine neue Angriffsfläche im Dienst: kein neuer Endpunkt, kein neues Recht, kein neues Feld, kein neuer Ereignistyp. Neu ist eine synthetische Testperson mit der Rolle Administration im Realm des CI-Jobs `e2e-http` (nur dort, Geheimnisse je Lauf wie bei den neun anderen).
**Rolle:** implementierer-oberflaeche; Design-Kritik D1–D10 durch design-kritiker vor dem Review; Review in frischem Kontext mit den Perspektiven **Security/Admin** (kein Rollenname in Logik, If-Match bei jedem Listenersatz, keine Entscheidung im Client, Testperson im Harness) und **UX/Barrierefreiheit** (D1–D10, Tastatur, axe). Ablauf nach E57 für Oberflächenscheiben mittleren Risikos: kein gesonderter Lesebefund der Spec, ein Review nach dem Bau; Sicherheits-, Rechts- und Datenschutzbefunde werden nie vertagt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue fachliche Regel. In der Oberfläche bedient und belegt: R-ADM-01 (Konfiguration eines geschlossenen Jahrgangs unveränderlich), R-ADM-02 (referenzierte Stammdaten bleiben), R-ADM-07 (keine Selbstzuordnung), R-ADM-08 (letzte tragfähige Verwaltungszuordnung nicht entziehbar), R-PERM-01 (Recht fehlt), R-IDEM-01 (Wiederholung). Dazu AGENTS.md R2, R3, R4, R6, R9, R10, R12; `docs/design-prinzipien.md` D1–D10; Leitplanken 6.8 und 6.9
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 041 (Zeile 650–655), Eintrag 040 (Zeile 644–649), Eintrag 082 (Zeile 408–413), Eintrag 089b (Zeile 855–860), Eintrag 062 (Rollenkarte), §11 „Freigabe-Demo“ und „Folgen der Zurückstellung“ (Zeile 1362); Register E57; `docs/rollen-und-rechtekonzept.md` §2.1 (`admin.roles.manage`), §4 („Administration ist Rechteverwaltung, nicht Inhaltsbearbeitung“), §5 (zwei benannte Vertreter, Ablauf); Leitplanken §4, 6.5, 6.8, 6.9; Specs 040a (gemeinsame Entscheidungen 1, 4, 5; R-ADM-07/08), 040b (Operationen, R-ADM-01/02, Maskierung von `personId`/`deviceId`), 040c und 040d (Hinweise an 041), 053 (Registerzeile ohne Quelle der Rechtemenge, gesperrter Zustand), 082 (Feature-Register), 090 (Daten je Akteur), takt-008 (Fokus nach Aktion), takt-046 (Laufzeit `e2e-http`)
**Depends on:** 040a (gemergt `c000567`), 040b (gemergt `6146251`, Vertrag 0.4.1), 030 (gemergt), 082 (gemergt `c8bcf83`). **Nicht** 040c, 040d (zurückgestellt; was deshalb fehlt, steht in „Teilung und Zuschnitt“)
**Perspektive:** Security/Admin, UX · **Glossar: neue Begriffe:** ja (Verwaltung als Ansicht, Rollenzuordnung, Rollenkarte, Kennung)

## Warum mittel

Der Plan führt 041 als „mittel“; diese Spec bleibt dabei (keine Herabstufung, kein Fall für `downgrade-check`). Die
Leitplanken (§4) nennen „Administration, Konfigurationsfreeze“ unter den Hoch-Auslösern. Gemeint ist eine Änderung an
Verwaltungsregeln, Rechten oder am Freeze. 041 ändert keine davon:

- **Rechte und Regeln:** kein neues Recht, keine Zeile in `ROLE_PERMISSIONS`, kein Wahrheitstabellen-Diff, keine Regel.
  Jede Schreibhandlung ist eine Operation, die 026, 040a und 040b mit Klasse hoch gebaut und geprüft haben
  (`assignRole`, `revokeRole`, `replaceMeetingUnits`, `replaceMeetingAgendaItems`, `replaceMeetingStageSeats`). Der Dienst
  entscheidet über `can()`; die Oberfläche zeigt seine Antwort mit Regel-id.
- **Freeze:** nicht in 041 (kein Freeze im Kern; 040d zurückgestellt). Kein Freeze-Knopf, keine Hash-Anzeige.
- **Personenbezogene Daten:** Die Ansicht zeigt pseudonyme Kennungen (`subjectId`, `StageSeat.personId`, `deviceId`), die
  der Dienst nur Haltern der Verwaltungsrechte liefert (040b Entscheidung 7). Keine Klarnamen, keine Kennzahl je Person.
- **Rollenkarten:** lesen die Rechtetabelle als Daten. Kein Rollenname im Code der Ansicht (Test 8).

Verbleibendes Risiko ist Verhalten der Oberfläche, und das ist hier ernster als in einer Leseansicht: Ein Listenersatz
aus veraltetem Stand könnte Einträge still entfernen oder zurückbenennen, und ein falsch gesendetes Feld ändert Rechte.
Beides deckt die Spec ab: jeder Listenersatz sendet `If-Match` mit der Version, die **vor** der Liste gelesen wurde
(Entscheidung 6, Test 6), und jede Eingabe der Rollenzuordnung ist auf genau die Vertragsfelder begrenzt (Test 7c). Die
zehnte Testperson im Harness ist synthetisch und lebt nur im Realm eines Laufs. Hält der Review die Einstufung für falsch,
hebt der Eigentümer sie an (Eigentümerfrage 1); eine Hochstufung ist kein Herabstufungsfall.

## Befund (Ist-Stand, gelesen auf `c5990c8`)

- **Vorhandene Operationen** (Vertrag 0.4.4, `HvApi` in `packages/domain/src/api.ts:85-166`, HTTP-Client
  `apps/web/src/api/http.ts:614-621`, Live-Puffer `liveStore.ts:47, 58, 77, 88-89`, Adaptertest `http.test.ts:148-155`):

  | Zweck | `HvApi` | Recht (Dienst) | Bemerkung |
  |---|---|---|---|
  | Hauptversammlungen lesen | `listMeetings(status?)`, `getMeetingById(id)`, `getMeeting()` | jeder Angemeldete | `Meeting.version` ist das ETag |
  | TOPs lesen/ersetzen | `listMeetingAgendaItems(id)`, `replaceMeetingAgendaItems(id, items, opts)` | lesen alle; ersetzen `agenda.manage` | ganze Liste, `AgendaItemsReplaced`; 409 R-ADM-01/02; 412 bei veraltetem `If-Match` |
  | Fachbereiche lesen/ersetzen | `listMeetingUnits(id)`, `replaceMeetingUnits(id, items, opts)` | lesen alle; ersetzen `admin.units.manage` | ganze Liste, `UnitsReplaced`; 409 R-ADM-02 auch bei aktiver Rollenzuordnung |
  | Bühnenplätze lesen/ersetzen | `listMeetingStageSeats(id)`, `replaceMeetingStageSeats(id, items, opts)` | lesen alle (ohne `personId`/`deviceId`); ersetzen `admin.seats.manage` | 422 für doppelte `position`/`deviceId` und nicht pseudonyme Kennungen |
  | Rollenzuordnungen | `listRoleAssignments(filter?)`, `assignRole(input, opts)`, `revokeRole(id, reason?, opts)` | `admin.roles.manage` | **nur für den aktuellen Jahrgang** (Alias, `meetingRoute()`); kein `If-Match` im Vertrag; 409 R-ADM-07, R-ADM-08, „besteht schon“ |

- **Nicht vorhanden:** `createMeeting` und `freezeMeetingConfig` stehen nur vorab erklärt in der Allowlist (`slice` 040,
  Ablauf 25.11.2026); kein Override, kein Start, keine Nummernkreise, keine Vertretungsregel R-ADM-06. Der Domänentyp
  `Meeting` (`types.ts:141-168`) trägt **weder** `configFrozenAt` noch `configHash`, `format` oder `clonedFromMeetingId`
  (der Vertrag erklärt sie, der Kern projiziert sie nicht). `pseudonymiseForUnits` steht im Domänentyp, nicht im Vertrag;
  die Ansicht zeigt es nicht (im Projekt `http` fehlte es).
- **Kern-Prüfungen von `assignRole`** (`api.ts:1002-1036`): `subjectId` pseudonym (kein `@`, kein Leerraum, ≤ 128);
  `personId` muss in der Personentabelle der Wortmeldungen stehen (Podiums- und Fachpersonen stehen dort nicht);
  `expiresAt` in der Zukunft; `unitId` ein Fachbereich des Jahrgangs; Duplikat einer aktiven Zuordnung → 409 ohne Regel-id;
  `deputyForSubjectId` wird nur auf Form geprüft (R-ADM-06 kommt mit 040d). Ohne `expiresAt` setzt der Kern **kein**
  Ablaufdatum; der Vertrag sagt „Standard: Ende der Hauptversammlung“.
- **Demo:** Die Persona `u-admin` (`apps/web/src/api/actor.ts:20`) ist nicht zuordnungsgebunden; sie liest
  `listRoleAssignments` und sieht die eine Startzuordnung `DEMO_BINDINGS` (Fachkraft `u-exp-fin`, `unit-fin`). R-ADM-08
  ist in der Demo nicht auslösbar (keine Zuordnung mit `admin.roles.manage`).
- **Projekt `http`:** Es gibt **keine** Testperson mit Verwaltungsrolle. `scripts/lib/demo-persons.mjs` führt neun Personen
  (geteilt mit dem lokalen Paket 037a); `scripts/e2e-http-031.mjs:229-237` und `scripts/e2e-http-031.test.mjs:40-47`
  prüfen „neun“; `apps/web/e2e/http/anmeldung.setup.ts:11-13` meldet acht davon an. Das lokale Paket liest dieselbe Liste
  (`scripts/stack.mjs`, `scripts/stack-seed.mjs:51-57`, gespeicherter Zustand mit einem Passwort je Person).
- **Rechtemenge der Oberfläche:** wie in 053: `visibleRoutes(routes, granted?)` existiert, wird aber nie mit einer Menge
  gerufen; die Navigation zeigt jeden Eintrag. Die Quelle der Menge kommt mit 089b (nach 041). `Meeting` trägt kein
  `_actions`.
- **Modulgrenze:** `apps/web/src/features/**` darf aus `@hv/domain` nur Typen laden (Regel
  `web-features-i18n-domain-types-only`, heute Warnung); Werte wie `ROLE_PERMISSIONS` gehören nach `apps/web/src/api/**`.
- **Beschriftungen vorhanden:** `roleLabel(t, role)` (`i18n/labels.ts:164`, Schlüssel `role.*`), `actionLabel(t,
  permission)` für **jedes** Recht (`ACTION_KEYS`, erschöpfend), `meeting.state.*`. Die Historie hebt Handlungen der
  Verwaltung schon hervor (040a).
- **Feature-Register:** `featureRegistry.test.ts:174-181` erwartet `history` als letzten Eintrag. Alt+1…6 sind belegt.
- **i18n:** Paritätstest (f) zählt 621 Schlüssel je Sprache (`parity.test.ts:178-185`); Module shell, speakers, capture,
  answers, stage, history, steering, focus.
- **e2e `http`:** `SHARED_SPECS` in `apps/web/playwright.config.ts:38-42`, Reihenfolge-Pin in
  `scripts/e2e-http-031.test.mjs:26-31`; jede Datei startet vom Datenbankstand ihrer Vorgänger; Warnschwelle der Harness
  6:30 (`WARN_MS`, takt-046).
- **`docs/admin/`** existiert nicht.

**Kein Vertrags-, Kern- oder Dienstschritt nötig.** Stellt der Bau fest, dass etwas fehlt, hält er an und meldet es; er
ändert weder den Vertrag noch die Domäne noch den Dienst (AGENTS.md R6).

## Teilung und Zuschnitt

| Punkt der Planzeile 041 | In 041 | Wohin sonst | Grund |
|---|---|---|---|
| Route `/admin`, eine Zeile im Feature-Register | **ja**, `requires: 'admin.roles.manage'`, ohne Kürzel | Ausblenden in der Navigation: 089b | Register gebaut; Quelle der Rechtemenge fehlt (Befund) |
| Jahrgang | **lesend**: Kopf mit der aktuellen Hauptversammlung, Liste aller Hauptversammlungen | Anlegen, Klonen, Auswahl eines anderen Jahrgangs zum Bearbeiten: **041b** (040c) | `createMeeting` nicht montiert; Rollen-Methoden nur für den Alias |
| Fachbereiche, TOPs, Bühnenplätze | **ja**, lesen, anlegen, ändern, entfernen | — | 040b |
| Personen mit Einheit und Rollen mit Ablauf | **ja**, Rollenzuordnungen mit Fachbereich und Ablauf, zuordnen, entziehen | Vertretungen (`deputyForSubjectId` mit R-ADM-06, R-ADM-10): **041b** (040d) | Vertretungsregel nicht gebaut |
| Konfiguration | **lesend**, was der Domänentyp trägt (Titel, Datum, Status, Version, Gesellschaft) | `format`, `podiumVisibility` und weitere Konfiguration: 041b bzw. 047 | Felder nicht projiziert |
| Freeze mit Hash-Anzeige im Kopf | nein | **041b** (040d) | kein Freeze im Kern, Felder nicht im Domänentyp |
| Rollenkarten-Vorschau je Rolle aus `ROLE_PERMISSIONS` | **ja** | druckbare Rollenkarte beim ersten Login: 062 | — |
| Admin-Anleitung „Übungs-HV in unter zwei Stunden anlegen“ | **v1**: Einrichten einer Übungs-HV mit dem, was es gibt | der Zwei-Stunden-Ablauf mit Anlegen und Freeze: **041b** | ohne `createMeeting` gibt es kein „anlegen“ (Entscheidung 10) |
| Playwright „Jahrgang anlegen → Freeze → Änderung abgelehnt“ | **ersetzt** durch abgelehnte Änderungen, die es heute gibt: R-ADM-02, R-ADM-07, R-ADM-08 | der Ablauf mit Freeze und R-ADM-03: **041b** | kein Freeze |
| Screenshots DE/EN | **ja** | — | — |

## Ziel und Entscheidungen vor Bau

Die Verwaltung richtet eine Hauptversammlung auf einer Seite ein: Sie sieht oben, welche Hauptversammlung sie verwaltet
und in welchem Stand (Version), ordnet Kennungen Rollen mit Fachbereich und Ablauf zu und entzieht sie, pflegt
Fachbereiche, Tagesordnung und Bühnenplätze und prüft in den Rollenkarten, was jede Rolle liest und darf. Jede Ablehnung
des Dienstes erscheint mit Grund und Regel-id im offenen Dialog. Kein Code vergleicht einen Rollennamen (R4) oder
entscheidet über einen Status (R5); der Dienst entscheidet.

Alle Punkte sind **auf Standard gebaut**, wo nicht anders gesagt; ein späterer Wechsel kostet die genannten Beträge.

### 1. Route und Registerzeile (`apps/web/src/app/featureRegistry.ts`)

- Genau eine neue Zeile in `FEATURES`, **als letzter Eintrag nach `history`** (die Verwaltung ist keine Phase des Tages):
  `{ id: 'admin', path: '/admin', labelKey: 'nav.admin', icon: <lucide, Vorschlag SlidersHorizontal>, testId: 'nav-admin',
  helpKey: 'page.admin.description', i18nModule: 'admin', requires: 'admin.roles.manage', Component: AdminPage }`.
  **Kein `shortcutKey`, kein Zähler.**
- `requires` ist Daten, kein Rollenname. Weil die Navigation keine Rechtemenge übergibt (Befund), ist der Eintrag für jede
  Rolle sichtbar, wie `/steering` und `/my`; 089b blendet ihn aus.
- Keine weitere Änderung an Shell, Router, Navigation oder Kurzbefehl-Dialog.

### 2. Seite (`features/admin/Page.tsx`)

- **Kopf:** `PageHeader` (`page.admin.title`, `page.admin.description`), darunter eine Zeile „Hauptversammlung“ aus
  `useMeeting()`: Titel, Datum (Europe/Berlin, wie `MeetingPanel`), Status-Badge (`meeting.state.*`), Gesellschaft, falls
  gesetzt, und **Version in Mono** (`admin-meeting-version`, D5). Die Version ist sichtbar, damit jede Änderung als
  Version + 1 beobachtbar ist (e2e) und „Stand veraltet“ erklärbar bleibt. Kein Freeze-Feld (041b).
- **Abschnitte als Tabs** (`role="tablist"`, Pfeiltasten, Pos1/Ende nach WAI-ARIA, `aria-controls`; Zustand in der
  Komponente, Start auf „Rollenzuordnungen“):
  1. Rollenzuordnungen (`admin-tab-roles`) — Entscheidung 3
  2. Fachbereiche (`admin-tab-units`) — Entscheidung 4
  3. Tagesordnung (`admin-tab-agenda`) — Entscheidung 4
  4. Bühnenplätze (`admin-tab-seats`) — Entscheidung 4
  5. Rollenkarten (`admin-tab-role-cards`) — Entscheidung 5
  6. Hauptversammlungen (`admin-tab-meetings`) — lesend: Titel, Datum (Mono), Status je Eintrag aus `listMeetings()`;
     die aktuell verwaltete trägt das Badge `admin.meetings.current`. Keine Aktion.
- **Genau eine primäre Aktion je Tab** (D2), rechts oben im Tab: „Rolle zuordnen“, „Fachbereich anlegen“, „TOP anlegen“,
  „Bühnenplatz anlegen“; Rollenkarten und Hauptversammlungen haben keine. Zeilenaktionen sind sekundär (Textschaltflächen).
- **Gesperrter Zustand (D9, wie 053):** Die Seite liest zuerst `listRoleAssignments()`. Antwortet der Dienst 403, zeigt
  sie statt Tabs nur `admin.forbidden.title`/`.body` (`data-testid="admin-forbidden"`, `role="status"`) und liest nichts
  weiter. Der Text nennt das Recht über `actionLabel(t, 'admin.roles.manage')`, nie eine Rolle. Eigentümerfrage 2.
- **Zustände (D6, D8):** Laden je Tab mit Zeilenskeletten in Zeilenhöhe; Lesefehler je Tab `admin.failed` mit „Erneut
  laden“ (`role="status"`); leere Listen erklären den nächsten Schritt (`admin.units.empty` usw.).
- **Live:** jede Liste wird bei `useApiVersion()` neu gelesen (Thema `meeting` für Stammdaten, `roles` für Zuordnungen);
  ein offener Dialog bleibt offen, der Fokus springt nicht (6.9).
- **Daten je Akteur (090):** Bei Akteurwechsel (Vergleich über `actor.id`, nie über die Rolle) schließt ein offener Dialog,
  der gesperrte Zustand wird neu bestimmt, der Tab bleibt.
- **Fokus nach Aktion (takt-008):** nach erfolgreichem Speichern zurück auf die auslösende Schaltfläche (Zeilenaktion bzw.
  primäre Aktion), sobald die neue Liste da ist; nach dem Entfernen einer Zeile auf die primäre Aktion des Tabs.

### 3. Rollenzuordnungen (`RolesTab.tsx`, `AssignDialog.tsx`, `RevokeDialog.tsx`, `assignments.ts`)

- **Tabelle** (eine Zeile je Zuordnung, sortiert nach Kennung, dann nach der Reihenfolge der Rollen in der Rechtetabelle):
  Kennung (`subjectId`, Mono), Rolle (`roleLabel`), Fachbereich (Kurzname aus den Stammdaten, sonst `common.none`),
  Gültig bis (`expiresAt` in Europe/Berlin, Mono; ohne Wert `admin.roles.expires.meetingEnd` „Ende der Hauptversammlung“,
  so sagt es der Vertrag), Zugeordnet (Zeit in Mono, `assignedBy.displayName`), Zustand-Badge. `deputyForSubjectId`,
  falls vorhanden, als Zusatz `admin.roles.deputyFor` unter der Kennung (nur Anzeige). `personId` wird nicht gezeigt
  (kein Zweck in 041, Datensparsamkeit).
- **Zustand** als reine Funktion `assignmentState(a, now)` → `'revoked' | 'expired' | 'active'` (entzogen vor abgelaufen
  vor aktiv). `now` wird übergeben, nie in der Funktion gelesen. Das ist Anzeige, keine Entscheidung: Der Dienst prüft
  Ablauf und Entzug selbst. Schalter `admin.roles.showInactive` (Standard aus) blendet entzogene und abgelaufene ein.
- **„Rolle zuordnen“** (`AssignDialog`, Muster D: Titel `actionLabel(t, 'admin.roles.manage')`, Erklärungssatz, Eingaben,
  rechts unten Abbrechen/Primär):
  1. **Kennung** (Pflicht, Textfeld, `admin-assign-subject`) mit `<datalist>` der Kennungen, die schon in der Tabelle
     stehen (Daten, keine Namen). Hinweis `admin.assign.subject.hint`: pseudonyme Kennung des Anmeldedienstes, keine
     E-Mail-Adresse und kein Klarname. Die Form prüft der Dienst (422); der Client prüft nur „nicht leer“.
  2. **Rolle** (Pflicht, Auswahl ohne Vorauswahl, `admin-assign-role`): Optionen sind die Rollen der Rechtetabelle in
     ihrer Reihenfolge (`roleCards()`, Entscheidung 5), beschriftet mit `roleLabel`.
  3. **Fachbereich** (optional, `admin-assign-unit`, erste Option `admin.assign.unit.none`). Ist die gewählte Rolle laut
     Rechtetabelle einheitsgebunden (`card.unitBound`, Daten aus `ROLE_PERMISSIONS`), steht darunter
     `admin.assign.unit.boundHint` („Diese Rolle liest nur Fragen ihres Fachbereichs; ohne Fachbereich liest sie keine.“).
     Kein Pflichtfeld daraus: Die Regel liegt im Kern (026).
  4. **Gültig bis** (optional, `datetime-local`, `admin-assign-expires`), gelesen als Ortszeit **Europe/Berlin** (die Zeit
     des Saals, wie Uhr und Historie), umgerechnet mit der reinen Funktion `berlinLocalToIso` (Entscheidung 8). Leer heißt:
     Feld wird nicht gesendet, Anzeige „Ende der Hauptversammlung“.
  - **Kein** Feld für `personId` (Personentabelle der Wortmeldungen, Befund) und **keins** für `deputyForSubjectId`
    (R-ADM-06 fehlt; 041b).
  - Gesendet wird genau `{ subjectId, role, ...(unitId ? { unitId } : {}), ...(expiresAt ? { expiresAt } : {}) }`
    (`exactOptionalPropertyTypes`; Test 7c).
  - Primär gesperrt (`aria-disabled`, takt-008), solange Kennung oder Rolle fehlt oder geschrieben wird.
- **„Entziehen“** je aktiver Zeile (`admin-revoke`, sekundär) öffnet `RevokeDialog`: Satz mit Kennung und Rolle, optionaler
  Grund (≤ 500 Zeichen, `admin-revoke-reason`; leer → ohne Grund senden), Primär `admin.revoke.submit`.
- **Ablehnungen im Dialog** (Entscheidung 7): R-ADM-07 „Niemand ordnet sich selbst eine Rolle zu.“, R-ADM-08 „Die letzte
  gültige Zuordnung mit Rechteverwaltung bleibt.“, Duplikat „Diese Kennung hat die Rolle schon.“, 404 Fachbereich, 422
  Eingabe. Der Dialog bleibt mit den Eingaben offen.

### 4. Stammdaten: Fachbereiche, Tagesordnung, Bühnenplätze (`MasterDataTab.tsx`, `EntryDialog.tsx`, `RemoveDialog.tsx`, `lists.ts`)

**Entscheidung: Bearbeiten je Eintrag, nicht als Listeneditor.** Jede Handlung (anlegen, ändern, entfernen) ist ein
eigener Dialog und **ein** Listenersatz mit genau dieser einen Änderung. Grund: ein Ereignis je Absicht in der Historie,
eine Ablehnung bezieht sich auf genau eine Zeile (R-ADM-02 nennt dann den entfernten Eintrag), kein Zwischenzustand. Ein
Listeneditor mit mehreren Änderungen je Speichern ist eine Option (Eigentümerfrage 9).

- **Reine Hilfen** (`lists.ts`, ohne React, ohne Domänenwerte):
  - `unitsToInput(units)`, `agendaToInput(items)`, `seatsToInput(seats)`: Antwortform → Eingabeform; jede `id` bleibt,
    optionale Felder nur, wenn gesetzt; Fortschrittszeiten der TOPs werden nie gesendet (der Kern behält sie je `id`).
  - `withAdded(list, entry)`, `withReplaced(list, id, entry)`, `withRemoved(list, id)`: neue Liste, Eingabe unverändert,
    Reihenfolge erhalten; ein neuer Eintrag ohne `id` (die vergibt der Dienst).
  - `nextAgendaNumber(items)` = größte Nummer + 1, sonst 1; `nextSeatPosition(seats)` ebenso über `position`.
- **Fachbereiche:** Spalten Kurzname, Name, id (Mono, gedämpft), „Offen“ = `meeting.counts.byUnit[id]` (Mono,
  rechtsbündig; fehlt der Zähler, `–`). Der Zähler erklärt, warum ein Entfernen abgelehnt wird. Dialog: Name (Pflicht,
  ≤ 200), Kurzname (optional, ≤ 32).
- **Tagesordnung:** Spalten Nummer (Mono), Titel, Stand (Badge `admin.agenda.progress.opened` bzw. `.votingOpened`,
  `.votingClosed` aus `openedAt`/`votingOpenedAt`/`votingClosedAt`; reine Anzeige der Felder, keine Statuslogik). Dialog:
  Nummer (Pflicht, ganze Zahl ≥ 1, vorbelegt mit `nextAgendaNumber` beim Anlegen), Titel (Pflicht, ≤ 500).
- **Bühnenplätze:** Spalten Position (Mono), Bezeichnung, Person (`personId`, Mono, sonst `common.none`), Gerät
  (`deviceId`, Mono, sonst `common.none`), „Auf der Bühne“ = `meeting.counts.bySeat[id]` (Mono). Dialog: Bezeichnung
  (Pflicht, ≤ 100), Position (optional, vorbelegt mit `nextSeatPosition`), Person und Gerät (optional, ≤ 128) mit Hinweis
  `admin.seats.pseudonymHint` („pseudonyme Kennung, keine E-Mail-Adresse, kein Leerzeichen“). Die Bezeichnungen der
  Standardplätze sind Stammdaten-Inhalt in `de` (040b), keine Oberflächentexte.
- **Entfernen** je Zeile: `RemoveDialog` mit Satz `admin.remove.body` (Name des Eintrags) und Primär `admin.remove.submit`.
- **Schreiben:** `api.replaceMeetingUnits(meetingId, withX(unitsToInput(list), …), { ifMatch: etagOf(version) })`
  (sinngemäß für TOPs und Plätze); `meetingId` und `version` nach Entscheidung 6.

### 5. Rollenkarten (`apps/web/src/api/roleCards.ts`, `features/admin/RoleCardsTab.tsx`)

- **Datenquelle:** `apps/web/src/api/roleCards.ts` (neu; im Ordner `api`, weil nur dort Werte aus `@hv/domain` geladen
  werden, Befund) exportiert `roleCards(): readonly RoleCard[]` mit `RoleCard = { role: Role; reads: readonly
  Permission[]; acts: readonly Permission[]; unitBound: boolean }`:
  - eine Karte je Schlüssel von `ROLE_PERMISSIONS`, in dessen Reihenfolge;
  - `reads` = Rechte der Rolle, die in `READ_PERMISSIONS` stehen; `acts` = die übrigen; beide in der Reihenfolge von
    `PERMISSIONS`;
  - `unitBound` = das Kennzeichen `unitBoundRead` des Bündels.
  - **Kein Rollenname im Modul**, keine Bedingung über eine Rolle; das Modul iteriert die Tabelle. Es fällt damit nicht
    unter die Ausnahme der AGENTS.md-Regel 4 (Rollenwechsler, `ROLE_PERMISSIONS`) und braucht sie nicht: Es nennt keine
    Rolle, es liest die Daten. Kommt eine Rolle oder ein Recht hinzu, erscheint sie ohne Änderung an 041.
- **Ansicht:** links die Liste der Rollen (`role="listbox"`, Pfeiltasten, `admin-role-card-option`, Beschriftung
  `roleLabel`), rechts die Karte der gewählten Rolle (`admin-role-card`): Titel, Abschnitt „Liest“ (`admin.roleCards.reads`)
  und „Darf“ (`admin.roleCards.acts`) mit `actionLabel` je Recht, bei `unitBound` der Satz `admin.roleCards.unitBound`;
  ein leerer Abschnitt zeigt `admin.roleCards.none`. Erste Rolle vorgewählt.
- **Einordnung** über der Liste (`admin.roleCards.intro`): „Aus der Rechtetabelle dieses Programmstands. Was eine Person
  tatsächlich darf, entscheidet der Dienst.“ Im Projekt `http` ist es die Tabelle des Web-Builds; Web und Dienst entstehen
  aus demselben Commit. Eine Tabelle vom Dienst ist Eigentümerfrage 6.
- Dieselbe Quelle speist die Rollenauswahl und den Einheitshinweis im Dialog „Rolle zuordnen“ (Entscheidung 3).

### 6. Version und `If-Match` (kein verlorener Stand)

- **Regel:** Ein Listenersatz sendet `If-Match` = `etagOf(v)`, wobei `v` die `Meeting.version` ist, die **vor** der Liste
  gelesen wurde, auf der die Änderung beruht. Ablauf des Lesens je Stammdaten-Tab: `getMeetingById(meetingId)` → `v`,
  danach die Liste. Ändert jemand dazwischen, ist die Liste neuer als `v`, und der Dienst antwortet 412 (sicher). Nie wird
  eine Version gesendet, die neuer ist als die Liste (sonst könnte ein Ersatz eine fremde Änderung still überschreiben).
- `meetingId` ist `useMeeting().id` (der Alias); `useMeeting().version` allein reicht **nicht** als `If-Match`, weil Liste
  und Kopf getrennt nachgezogen werden.
- **412** → Dialog schließt, Toast `admin.stale` („Inzwischen geändert; die Liste ist neu geladen. Bitte erneut
  versuchen.“), Tab liest neu.
- Rollenzuordnungen haben kein `If-Match` im Vertrag; Doppelungen fängt der Kern (409).
- **Kein eigener `Idempotency-Key`:** wie in jeder Ansicht erzeugt der Adapter den Schlüssel je Aufruf
  (`http.ts:189`); die Primärschaltfläche ist gesperrt, solange geschrieben wird.

### 7. Ablehnungen (`problems.ts`)

- Reine Funktion `adminProblemKey(error)` → Schlüssel oder `undefined`:
  409 mit `ruleId` R-ADM-01, R-ADM-02, R-ADM-07, R-ADM-08 → `admin.problem.<ruleId>`; 409 ohne `ruleId` →
  `admin.problem.conflict`; 403 → `admin.problem.forbidden`; 404 → `admin.problem.notFound`; 422 → `admin.problem.invalid`;
  412 → `'stale'` (Entscheidung 6); sonst `undefined` (Toast wie überall, `showProblem`).
- Anzeige im offenen Dialog (`role="alert"`, `data-testid="admin-problem"`) mit Text **und Regel-id** (D5), Eingaben
  bleiben. Die Zuordnung Regel-id → Schlüssel ist eine Tabelle (Daten), keine Verzweigung über Rollen oder Status.

### 8. Zeit (`time.ts`)

- `berlinLocalToIso(value: string): string | undefined` und `isoToBerlinLocal(iso: string): string` über `Intl` ohne
  Bibliothek. Nicht existierende Ortszeit (Umstellung auf Sommerzeit, 28.03.2027 02:00–03:00) → `undefined`, das Feld zeigt
  `admin.assign.expires.invalid`; doppelte Ortszeit (25.10.2026 02:00–03:00) → das frühere Vorkommen (MESZ). Ob die Zeit in
  der Zukunft liegt, prüft der Dienst (422).
- Die Ansicht liest „jetzt“ für `assignmentState` an **einer** Stelle der Seite und gibt es weiter; `now-check` gilt hier
  nicht (Web), die Funktionen bleiben trotzdem ohne eigenen Uhrzugriff, damit sie testbar sind.

### 9. Sprache, Begriffe, Glossar

- Hausvokabular (R9, D6): Verwaltung, Hauptversammlung, Fachbereich, Tagesordnung, TOP, Bühnenplatz, Rollenzuordnung,
  Rolle zuordnen, entziehen, Kennung, Gültig bis, Rollenkarte. In deutschen Texten nie „Admin“, „User“, „Team“,
  „Assignee“, „Ticket“, „Jahrgang“ (Planwort; die Oberfläche sagt Hauptversammlung). Kein Rollenname in einem Text außer
  über `roleLabel` aus Daten.
- **Glossar** (`docs/glossar.md`), vier Zeilen nach „Leitstand“:
  - „Verwaltung (Ansicht)“ / „Administration (view)“ / `apps/web/src/features/admin/**`, Route `/admin` (Scheibe 041) /
    verboten: „Admin“, „Admin-Panel“ in deutschen Texten.
  - „Rollenzuordnung“ / „Role assignment“ / `RoleAssignment`, `assignRole`, `revokeRole` (Scheibe 026; Oberfläche 041) /
    verboten: „Berechtigungsticket“.
  - „Rollenkarte“ / „Role card“ / `roleCards()` aus `ROLE_PERMISSIONS` (Scheibe 041; druckbar mit 062) / —.
  - „Kennung“ / „Subject id“ / `subjectId` (pseudonym, ADR 0004) / verboten: „Benutzername“, „E-Mail“.

### 10. Admin-Anleitung v1 (`docs/admin/anleitung.md`)

**Entscheidung: eine erste Fassung jetzt, beschränkt auf das, was es gibt.** Die Planüberschrift „Übungs-HV in unter zwei
Stunden anlegen“ verspricht Anlegen; das gibt es erst mit 040c. Die v1 heißt deshalb „Übungs-HV einrichten (Stand 041)“
und sagt in einem Kasten, was mit 041b folgt. Gliederung:

1. Wo: Demo (Rollenwechsel auf Administration, Navigation „Verwaltung“) und Projekt `http`; das lokale Paket hat noch
   keine Verwaltungsperson (Eigentümerfrage 5).
2. Hauptversammlung prüfen: Kopf, Version, Liste der Hauptversammlungen.
3. Fachbereiche anlegen und benennen; warum ein Fachbereich mit offenen Fragen oder aktiver Zuordnung bleibt (R-ADM-02).
4. Tagesordnung anlegen; warum ein aufgerufener TOP oder einer mit Fragen bleibt (R-ADM-02).
5. Bühnenplätze mit Person und Gerät (pseudonym); Position.
6. Rollen zuordnen mit Fachbereich und Ablauf; einheitsgebundene Rollen; Entziehen mit Grund; keine Selbstzuordnung
   (R-ADM-07); die letzte Verwaltungszuordnung bleibt (R-ADM-08).
7. Rollenkarten lesen.
8. Wenn etwas abgelehnt wird: Tabelle Meldung → Regel-id → was tun (R-ADM-01, -02, -07, -08, 403, 412, 422).
9. Was noch fehlt (041b): Hauptversammlung anlegen oder klonen, Freeze mit Hash, Override mit Grund, Start, Vertretungen,
   Nummernkreise; danach der Zwei-Stunden-Ablauf.

Mit Verweisen auf die Screenshots aus `docs/evidence/041-*.png`; keine Zugangsdaten, keine echten Namen (R11). 072 prüft die
Anleitung später mit.

### 11. Testperson Verwaltung im Projekt `http` (nur Harness)

- `scripts/e2e-http-031.mjs` führt eine eigene Liste `PERSONS` = die neun aus `scripts/lib/demo-persons.mjs` **plus**
  `{ key: 'admin', role: 'admin' }` und nutzt sie für Realm, Bootstrap, `credentials.json` und die Prüfung des
  Zugriffslogs; die Zusicherungen „neun“ werden „zehn“. **`scripts/lib/demo-persons.mjs` bleibt unverändert**, damit das
  lokale Paket (037a, gespeicherter Zustand mit einem Passwort je Person) nicht bricht (Eigentümerfrage 5).
- `apps/web/e2e/http/anmeldung.setup.ts` meldet `admin` zusätzlich an; `apps/web/e2e/support/roles.ts` kennt die
  Beschriftung `admin` (de „Administration“, en wie `shell.en.ts`).
- Die neue e2e-Datei läuft in beiden Projekten (`SHARED_SPECS`, Pin an ihrer Pfadstelle zwischen 031 und 045) und **lässt
  den Datenbankstand so, wie sie ihn vorfand**: Sie legt eigene Einträge an und entfernt sie wieder, entzieht jede eigene
  Zuordnung, und ihre abgelehnten Versuche ändern nichts. Seed-Einträge benennt sie nicht um.
- `docs/sicherheit/bedrohungsmodell.md:170` nennt „neun synthetische Personen“ für den Realm `hv-e2e-031`; die Zeile wird
  „zehn (eine mit Verwaltungsrolle, Scheibe 041)“.

### 12. i18n-Schlüssel

Neues Modul `admin` (`admin.de.ts`, `admin.en.ts`) mit den Schlüsseln aus den Entscheidungen 2–8 (Kopf, Tabs, Zustände,
Rollenzuordnungen, zwei Dialoge, drei Stammdaten-Tabs mit Eingabe- und Entfernen-Dialog, Rollenkarten,
Hauptversammlungen, Ablehnungen, Toasts), geschätzt **95–110 je Sprache**; dazu in `shell.{de,en}.ts` genau drei:
`nav.admin` (de „Verwaltung“, en „Administration“), `page.admin.title`, `page.admin.description`. Wiederverwendet statt
neu: `role.*`, `action.*`, `meeting.state.*`, `common.none` und vorhandene `common.*` für Abbrechen/Speichern, wo es sie
gibt. Der Bau nennt die genaue Zahl im Bericht; der Paritätstest (f) zählt sie (621 → 621 + n + 3).

## Nicht-Ziele

- Keine Änderung am Vertrag, an der Domäne, am Dienst, am Seed, an Rechten, an der Übergangs- oder Wahrheitstabelle.
- Kein Anlegen oder Klonen einer Hauptversammlung, keine Auswahl eines anderen Jahrgangs zum Bearbeiten, kein Freeze, keine
  Hash-Anzeige, kein Override, kein Start, keine Nummernkreise, keine Vertretungen (alles 041b).
- Keine Quelle der Rechtemenge, kein Ausblenden in der Navigation, kein Tastenkürzel (089b).
- Kein Feld `personId` an der Rollenzuordnung, keine Personentabelle der Podiums- oder Fachpersonen.
- Keine Gruppenzuordnung aus dem Anmeldedienst (`idpGroups` sind Vorschlag, ADR 0004; nicht in 041).
- Keine druckbare Rollenkarte, kein Onboarding (062).
- Keine Verwaltungsperson im lokalen Paket (Eigentümerfrage 5); keine Änderung am geteilten Personenverzeichnis.
- Keine Änderung an bestehenden e2e-Szenarien außer Reihenfolge-Pin und Personenliste; keine Zusicherung wird geschwächt.
- Keine Politur aus `docs/folgeliste.md`.

## Files allowed

- `apps/web/src/features/admin/**` (neu: Page.tsx, RolesTab.tsx, AssignDialog.tsx, RevokeDialog.tsx,
  MasterDataTab.tsx, EntryDialog.tsx, RemoveDialog.tsx, RoleCardsTab.tsx, MeetingsTab.tsx, assignments.ts, lists.ts,
  problems.ts, time.ts und ihre Tests; Zuschnitt der Dateien innerhalb des Ordners frei)
- `apps/web/src/api/roleCards.ts` (neu), `apps/web/src/api/roleCards.test.ts` (neu)
- `apps/web/src/app/featureRegistry.ts` (nur die Zeile `admin`, ihr Import und ihr Icon)
- `apps/web/src/app/featureRegistry.test.ts` (nur die Erwartungen zur neuen Zeile, zum letzten Eintrag und zu `requires`)
- `apps/web/src/i18n/admin.de.ts` (neu), `apps/web/src/i18n/admin.en.ts` (neu)
- `apps/web/src/i18n/{de,en}.ts` (nur das Modul `admin`)
- `apps/web/src/i18n/{shell.de,shell.en}.ts` (nur `nav.admin`, `page.admin.title`, `page.admin.description`)
- `apps/web/src/i18n/parity.test.ts` (nur Modul `admin` und die Zahl)
- `apps/web/e2e/041-verwaltung.spec.ts` (neu)
- `apps/web/e2e/support/roles.ts` (nur die Beschriftung `admin`)
- `apps/web/e2e/http/anmeldung.setup.ts` (nur `admin` in `SETUP_PERSONS`)
- `apps/web/playwright.config.ts` (nur `SHARED_SPECS`: die neue Datei eintragen)
- `scripts/e2e-http-031.mjs` (nur die Personenliste des Harness und die Zusicherungen zur Personenzahl, Entscheidung 11)
- `scripts/e2e-http-031.test.mjs` (nur Personenzahl und -schlüssel, `SHARED_FILES` und `HTTP_ORDER`)
- `docs/admin/anleitung.md` (neu)
- `docs/glossar.md` (nur die vier Zeilen aus Entscheidung 9)
- `docs/sicherheit/bedrohungsmodell.md` (nur die Zeile zur Personenzahl des Realms, Entscheidung 11)
- `docs/evidence/041-*.png`
- `docs/folgeliste.md` (nur nicht blockierende Befunde des Baus und des Reviews)
- `docs/slices/041-admin-oberflaeche.md` (diese Spec: Bericht, Review findings)

## Ausdrücklich nicht erlaubt

Ohne Pfadauszeichnung, damit `slice-scope` sie nicht als erlaubt liest: der Vertrag und seine Typen, die ganze Domäne
(packages), der Dienst (apps/api), der übrige Ordner apps/web/src/api außer den zwei neuen Dateien, die Bauteile unter
apps/web/src/components (ein fehlendes Bauteil wird in der Ansicht gebaut oder gemeldet), apps/web/src/app außer den zwei
Registerdateien, alle anderen Features, i18n/labels.ts, fremde e2e-Dateien, scripts/lib/demo-persons.mjs, stack.mjs und
stack-seed.mjs, die Workflows unter .github, der Produktplan (Hinweise an den Orchestrator unten).

## Vor dem Bau prüfen

1. 040a und 040b gemergt; die zehn Methoden aus dem Befund stehen in `HvApi`, im HTTP-Client und im Live-Puffer
   (`liveStore.test.ts` grün). `createMeeting` und `freezeMeetingConfig` stehen weiter in der Allowlist. Fehlt etwas:
   anhalten.
2. In-process als `u-admin`: `listRoleAssignments()` liefert die Startzuordnung; `replaceMeetingUnits` mit
   `If-Match` der aktuellen Version auf dem Alias gelingt; dieselbe Liste mit veralteter Version → 412. Sonst anhalten.
3. `roleLabel` und `actionLabel` sind für Features erreichbar (über `i18n/index.ts` oder `i18n/labels.ts`); Befund 4 aus
   048 beachten. Die Rollenreihenfolge in `ROLE_PERMISSIONS` ist die Reihenfolge der Karten.
4. Projekt `http`: Nach dem Bootstrap hält nur `admin` die Rolle Administration, ohne Ablauf, und die Hauptversammlung ist
   in `preparation` oder `running`; dann antwortet „eigene Verwaltungszuordnung entziehen“ 409 R-ADM-08. Welche Dateien vor
   041 (`HTTP_ORDER`: 002, 021b, 021c, 030, 031) Fachbereiche, TOPs oder Plätze verändern: keine erwartet; Abweichung im
   Bericht. Kurzname des Fachbereichs mit offenen Fragen für den R-ADM-02-Versuch: „Finanzen“ (`unit-fin`). Keine
   Konstante heißt SECRET, TOKEN, KEY oder PASSWORD (gitleaks, Lehre aus 045).
5. **Laufzeit `e2e-http`.** Die Dauer des Schritts „End-to-end http project …“ aus den letzten drei grünen Läufen neu
   lesen (`gh api repos/ypoxx/hvworkflow/actions/runs/<id>/jobs`). Schätzung der Mehrzeit: eine zusätzliche Anmeldung
   rund 5 s, die neue Datei mit rund 15 Schreibschritten, 6 Tabwechseln, axe und Screenshots rund 60 s, zusammen
   **≈ 1,1 min**. Liegt Ist plus Schätzung über der Warnschwelle 6:30 (`WARN_MS`), anhalten und melden; der Bau ändert
   weder Workflow noch Grenzen. Ist, Schätzung und tatsächliche Dauer stehen im Bericht.
6. `featureRegistry.test.ts` und `001-shell.spec.ts`: Annahmen über den letzten Eintrag bzw. die Navigation (001 prüft fünf
   Einträge auf Sichtbarkeit, nicht die Zahl). Nur die Registertests werden angepasst.
7. Paritätszahl (f) neu lesen (Spec: 621).

## Tests zuerst (rot, dann grün)

Jede Testdatei wird zuerst rot gesehen (fehlendes Modul oder fehlschlagende Erwartung); der Bericht zeigt beide Läufe.

**Unit (Vitest, `apps/web`)**

1. `features/admin/lists.test.ts`: `unitsToInput`/`agendaToInput`/`seatsToInput` behalten jede `id`, lassen nicht
   gesetzte optionale Felder weg und senden keine Fortschrittszeiten; `withAdded`/`withReplaced`/`withRemoved` liefern
   neue Listen, ändern die Eingabe nicht (eingefroren im Test) und halten die Reihenfolge; `nextAgendaNumber`
   (leer → 1, Lücken → größte + 1), `nextSeatPosition` ebenso, Plätze ohne `position` zählen nicht.
2. `features/admin/assignments.test.ts`: `assignmentState` mit injiziertem `now`: entzogen vor abgelaufen vor aktiv;
   ohne `expiresAt` aktiv; Ablauf genau `now` → abgelaufen. Sortierung nach Kennung, dann Reihenfolge der Rollen aus den
   Karten; Filter „nur aktive“.
3. `features/admin/time.test.ts`: `berlinLocalToIso`/`isoToBerlinLocal` im Winter und Sommer, Hin und zurück;
   28.03.2027 02:30 → `undefined`; 25.10.2026 02:30 → MESZ-Vorkommen (`…T00:30:00.000Z`); ungültige Eingabe → `undefined`.
4. `api/roleCards.test.ts`: genau eine Karte je Schlüssel von `ROLE_PERMISSIONS`, in dessen Reihenfolge; `reads ∪ acts`
   gleich dem Bündel als Menge, disjunkt, `reads ⊆ READ_PERMISSIONS`; Reihenfolge nach `PERMISSIONS`; `unitBound` genau
   für die Bündel mit `unitBoundRead`. Die Erwartungen werden aus den Daten berechnet, keine Rolle steht im Test als
   Literal außer in einer Stichprobe (eine einheitsgebundene Rolle hat `unitBound`, eine andere nicht; Tests dürfen Rollen
   nennen).
5. `features/admin/problems.test.ts`: jede Zeile der Tabelle aus Entscheidung 7 einschließlich 409 ohne `ruleId`, 412 →
   `'stale'`, 500 → `undefined`.
6. `features/admin/writeVersion.test.ts` (oder im Test des Tabs): Eine Fälschung von `HvApi` protokolliert die Aufrufe.
   (a) Der Tab liest `getMeetingById` **vor** der Liste; (b) der Listenersatz sendet `If-Match` dieser Version, auch wenn
   `useMeeting()` inzwischen eine höhere zeigt; (c) ändert sich die Version zwischen den beiden Lesevorgängen, sendet der
   Ersatz die ältere und bekommt 412 → Toast `admin.stale`, Dialog zu, erneutes Lesen.
7. `features/admin/Page.test.tsx` (Testing Library, gefälschte `HvApi`):
   (a) 403 auf `listRoleAssignments` → `admin-forbidden`, keine Tabliste, kein weiterer Aufruf;
   (b) Start auf „Rollenzuordnungen“; Pfeil rechts/links, Pos1, Ende wechseln den Tab und setzen `aria-selected`;
   (c) „Rolle zuordnen“: Optionen der Rolle in der Reihenfolge von `roleCards()`; bei einer einheitsgebundenen Rolle
   erscheint `admin.assign.unit.boundHint`, bei einer anderen nicht; Absenden ohne Fachbereich und Ablauf sendet genau
   `{ subjectId, role }`, mit beiden genau vier Schlüssel;
   (d) 409 R-ADM-07 → `admin-problem` mit Text und „R-ADM-07“, Dialog und Eingaben bleiben;
   (e) Fachbereich entfernen → 409 R-ADM-02 → Meldung mit Regel-id, Liste unverändert;
   (f) Entziehen mit Grund sendet `revokeRole(id, grund)`; ohne Grund `revokeRole(id)`; 409 R-ADM-08 → Meldung;
   (g) Akteurwechsel schließt einen offenen Dialog (090);
   (h) Rollenkarten: Pfeiltasten wählen die Rolle; die Karte zeigt `actionLabel` je Recht aus den Daten.
8. `features/admin/noRoleNames.test.ts` (R4): liest jede Nicht-Test-Datei unter `features/admin` und
   `api/roleCards.ts` und prüft, dass kein Schlüssel von `ROLE_PERMISSIONS` als Zeichenkettenliteral vorkommt und kein
   Vergleich `role ===`/`!==` mit einem Literal. Die Rollennamen kommen aus den Daten, nicht aus dem Test.
9. `app/featureRegistry.test.ts`: Zeile `admin` mit Pfad `/admin`, `requires: 'admin.roles.manage'`, ohne
   `shortcutKey`, als letzter Eintrag; `visibleRoutes` ohne das Recht blendet sie aus, mit dem Recht zeigt sie sie.
10. `i18n/parity.test.ts`: Modul `admin` in beiden Sprachen, neue Gesamtzahl.

**In-process gegen die echte Domäne (Vitest)**

11. `features/admin/inProcess.test.ts`: `createInProcessApi` mit gesätem `CORPUS_DEMO` und injizierter Uhr, Akteur
    Administration: Fachbereich anlegen über `withAdded` → Ereignis `UnitsReplaced`, alle bisherigen `id` erhalten,
    Version + 1; Umbenennen von „Finanzen“ über `withReplaced` behält die Zuordnung der gebundenen Fachkraft (`unitId`
    unverändert); Entfernen von „Finanzen“ → 409 R-ADM-02 → `adminProblemKey` liefert den Schlüssel; veraltetes
    `If-Match` → 412 → `'stale'`; Selbstzuordnung → R-ADM-07; TOP und Bühnenplatz hinzufügen und wieder entfernen ergibt
    die Ausgangsliste. Test-Dateien dürfen Werte aus `@hv/domain` laden (wie `Timeline.test.tsx`).

**Playwright (`apps/web/e2e/041-verwaltung.spec.ts`, beide Projekte, Rollenwechsel nur über `asRole`)**

- **E1 Überblick:** als Administration über `nav-admin` nach `/admin`; Kopf zeigt Titel und Version (Mono); Tab
  „Rollenzuordnungen“ zeigt mindestens eine Zeile (in-process die Startzuordnung, `http` mindestens die neun Zuordnungen des Bootstraps). axe
  ohne neue Ausnahme. Screenshot `041-rollen-de.png`, nach Sprachwechsel `041-rollen-en.png`.
- **E2 Zuordnen und Entziehen:** Kennung `e2e-041-pruefung`, eine einheitsgebundene Rolle (Hinweis sichtbar), Fachbereich
  „Finanzen“, Gültig bis morgen 18:00 → Zeile aktiv mit Ablauf in Mono; Entziehen mit Grund → Zeile verschwindet aus
  „nur aktive“, erscheint mit „entzogen“ nach Umschalten.
- **E3 Abgelehnte Änderungen (statt „nach dem Freeze“, siehe Zuschnitt):**
  - beide Projekte: Fachbereich „Finanzen“ entfernen → Meldung mit „R-ADM-02“ im Dialog; nach Abbrechen ist die Liste
    unverändert und die Version gleich. Screenshot `041-abgelehnt-de.png` und `041-abgelehnt-en.png`;
  - in-process: Zuordnung an die eigene Kennung `u-admin` → „R-ADM-07“;
  - `http`: die einzige Zeile mit der Rolle Administration entziehen → „R-ADM-08“, Zeile bleibt aktiv.
- **E4 Stammdaten hin und zurück:** Fachbereich „E2E 041 Prüfbereich“ anlegen (Offen 0) → Version + 1 → umbenennen →
  entfernen → Ausgangsliste. TOP mit vorbelegter nächster Nummer anlegen und entfernen. Bühnenplatz mit Gerät `geraet-041`
  anlegen und entfernen. Screenshot `041-fachbereiche-de.png`, `041-fachbereiche-en.png` (vor dem Entfernen).
- **E5 Rollenkarten:** Tab per Tastatur, Rollen mit Pfeiltasten durchgehen; die Karte der Koordination enthält „An anderen
  Fachbereich weiterleiten“, die Karte der einheitsgebundenen Rolle den Satz `admin.roleCards.unitBound`. Screenshots
  `041-rollenkarten-de.png`, `041-rollenkarten-en.png`. axe.
- **E6 Gesperrt:** als Erfassung `/admin` → `admin-forbidden`, keine Tabliste. Screenshot `041-gesperrt-de.png`. axe.
- **E7 Tastatur:** Tabs mit Pfeilen, „Rolle zuordnen“ mit Enter, Escape schließt, Fokus zurück auf die primäre Aktion;
  nach dem Speichern eines Eintrags Fokus auf der auslösenden Schaltfläche.
- Am Ende jeder Datei ist der Stand wie vorher (Entscheidung 11); ein `afterAll` prüft im Projekt `http` die Fachbereiche,
  TOPs und Plätze gegen den Stand vom Anfang.

## Akzeptanzkriterium

1. `/admin` steht als **eine** Zeile im Feature-Register (`requires: 'admin.roles.manage'`, ohne Kürzel, letzter
   Eintrag); keine andere Shell-Datei ist geändert.
2. Mit dem Recht zeigt die Seite Kopf (Hauptversammlung, Status, Version in Mono) und sechs Tabs; ohne das Recht nur den
   gesperrten Zustand (E6, Test 7a).
3. Rollen lassen sich mit Fachbereich und Ablauf zuordnen und mit Grund entziehen; Zustand aktiv, abgelaufen, entzogen ist
   sichtbar (E2, Tests 2, 7c, 7f).
4. Fachbereiche, TOPs und Bühnenplätze lassen sich anlegen, ändern und entfernen; jede Änderung ist ein Listenersatz mit
   `If-Match` der vor der Liste gelesenen Version (E4, Tests 1, 6, 11).
5. Abgelehnte Änderungen zeigen Grund und Regel-id im Dialog: R-ADM-02 in beiden Projekten, R-ADM-07 in-process, R-ADM-08
   im Projekt `http` (E3, Tests 5, 7d–f, 11).
6. Die Rollenkarten zeigen je Rolle, was sie liest und darf, aus `ROLE_PERMISSIONS`; kein Rollenname im Code der Ansicht
   (E5, Tests 4, 8).
7. `docs/admin/anleitung.md` v1 beschreibt nur Vorhandenes und nennt, was mit 041b folgt.
8. Screenshots DE/EN unter `docs/evidence/041-*.png`; axe ohne neue Ausnahme; e2e in beiden Projekten grün; der Stand
   der Datenbank im Projekt `http` ist nach der Datei derselbe wie davor.
9. `pnpm gates` grün auf dem Commit des Berichts, Schluss der Ausgabe im Bericht (R2).

## Nachweise

- Schluss von `pnpm gates` mit Commit; rote und grüne Läufe der neuen Tests.
- `docs/evidence/041-rollen-{de,en}.png`, `041-fachbereiche-{de,en}.png`, `041-rollenkarten-{de,en}.png`,
  `041-abgelehnt-{de,en}.png`, `041-gesperrt-de.png`.
- CI-Lauf des PR mit Job `e2e-http` grün; Dauer des Schritts „End-to-end http project …“ (Vor dem Bau 5).
- Design-Kritik D1–D10 als Tabelle im Bericht (je Zeile ja/nein mit einem Satz), durch design-kritiker in frischem
  Kontext gegen die Screenshots und die Vorgaben unten, vor dem Review.

### Design-Vorgaben D1–D10 (Checkliste `docs/design-prinzipien.md`)

| | Vorgabe für 041 | Prüfung |
|---|---|---|
| D1 | Kopf sagt in einer Zeile, welche Hauptversammlung in welchem Stand verwaltet wird; der Tabname sagt, was die Liste ist. | Screenshot, Design-Kritik |
| D2 | Je Tab genau eine primäre Aktion rechts oben; Zeilenaktionen als Textschaltflächen; Rollenkarten ohne primäre Aktion. | Screenshot |
| D3 | Tabellen nach dem Muster „Listen“ (fixierter Kopf, Trennlinien Grau 200, Zeilen 36 px); Dialoge 480 px. | Screenshot |
| D4 | Farbe nur für Zustands-Badges (aktiv, abgelaufen, entzogen; TOP-Stand); keine Flächen. | Screenshot |
| D5 | Version, Kennungen, Nummern, Positionen, Zeiten, Zähler und Regel-ids in Mono; Zahlen rechtsbündig. | Screenshot, Test 7d |
| D6 | Laden, leer, Fehler, gesperrt und „Stand veraltet“ gestaltet. | Tests 6, 7a; E6 |
| D7 | Alle Texte aus dem Modul `admin` bzw. `shell`, DE und en-US; Hausvokabular (Entscheidung 9). | Paritätstest, `vocabulary`, `i18n-literals` |
| D8 | Tabs, Listbox der Rollenkarten, Dialoge und Zeilenaktionen per Tastatur; Fokus sichtbar und nach Aktion richtig. | E7, Tests 7b, 7h |
| D9 | Ohne Recht keine Seite (gesperrter Zustand); Listen mit bis zu 200 Einträgen ohne spürbare Verzögerung (keine Fensterung nötig, Vertragsgrenze `maxItems`). | E6 |
| D10 | Ruhig: keine Kacheln, keine Kennzahlenleiste, keine Symbole ohne Bedeutung; eine Konsole zum Einrichten, kein Dashboard. | Screenshot, Design-Kritik |

## Qualitätswirkung

```
Reifestufe: demo · Risikoklasse: mittel
Ausgelöst: [x] Oberfläche, Barrierefreiheit [x] Administration (nur Bedienung vorhandener Operationen) [x] Dokumentation, Schulung
[ ] Fachregel, Status [ ] Vertrag, Ereignis, Konfiguration [ ] Persistenz, Migration, Nebenläufigkeit (If-Match genutzt, nicht geändert)
[ ] Rolle, Recht, Identität, Schutzklasse (keine Änderung; eine synthetische Testperson nur im CI-Realm)
[ ] personenbezogene oder vertrauliche Daten (nur pseudonyme Kennungen, die der Dienst schon liefert) [ ] Betrieb [ ] Nachbarsystem [ ] KI
Perspektive(n): Security/Admin, UX/Barrierefreiheit   Nachweise: siehe oben   Offene Entscheidung: E57 (Ablauf), sonst keine
```

- 6.8: Jede Änderung ist ein Ereignis mit Autor und Zeit (Kern); der Grund ist beim Entziehen möglich, bei Stammdaten sieht
  der Vertrag keinen vor. Freeze wird in 041 nicht erzwungen, weil es ihn nicht gibt (041b). Die Aufgabe gelingt ohne
  Datei-, SQL- oder Kommandozeilenzugriff für alles, was 041 anbietet.
- 6.5: Der Client entscheidet nichts; Selbstzuordnung und letzte Verwaltungszuordnung wehrt der Kern ab, die Oberfläche
  zeigt es. Missbrauchsfall „zwei Verwaltungen ordnen einander Freigabe zu“: in 041 möglich wie heute über die Operation,
  sichtbar in Historie und Tabelle; geschlossen erst durch Freeze und Override mit Grund (040d/041b).
- Dokumentation: Admin-Anleitung v1; Betriebswirkung keine (kein Dienst, keine Konfiguration geändert).

## Wirkung und Risiko

| Risiko | Wirkung | Abwehr | Nachweis |
|---|---|---|---|
| Listenersatz aus veraltetem Stand entfernt eine fremde Änderung | Stammdaten still verloren | `If-Match` mit der Version vor der Liste (Entscheidung 6) | Test 6, Test 11 |
| Rollenauswahl aus festen Namen veraltet bei neuer Rolle | Rolle nicht zuordenbar | Optionen aus `ROLE_PERMISSIONS` | Tests 4, 7c |
| Rollenname in der Oberfläche als Bedingung | R4 verletzt | reine Daten, Quelltest | Test 8 |
| e2e verändert den Stand für Folgedateien im Projekt `http` | rote Folgedateien | Hin-und-zurück, `afterAll`-Vergleich | E4, Entscheidung 11 |
| `e2e-http` überschreitet die Warnschwelle | CI-Warnung | Messung vor dem Bau, Halt | Vor dem Bau 5 |
| Kennung als E-Mail oder Klarname eingegeben | Personenbezug im Log | Kern lehnt `@`/Leerraum ab (422), Hinweis im Feld | Test 7d sinngemäß, E2 |

## Aufwand

| Teil | AStd |
|---|---|
| Seite, Kopf, Tabs, Zustände, gesperrter Zustand | 0,4 |
| Rollenzuordnungen: Tabelle, zwei Dialoge, Zustand, Zeit | 0,6 |
| Stammdaten: drei Tabs über einen Eingabe- und einen Entfernen-Dialog, Listenhilfen, Version | 0,6 |
| Rollenkarten mit Datenmodul | 0,25 |
| Hauptversammlungen (lesend) | 0,1 |
| i18n (rund 100 Schlüssel je Sprache) | 0,2 |
| Unit- und Komponententests, In-process-Test | 0,45 |
| e2e in beiden Projekten, Testperson im Harness, Reihenfolge-Pin | 0,5 |
| Admin-Anleitung v1, Glossar | 0,15 |
| Screenshots, axe, Design-Kritik, `pnpm gates`, Bericht, CI-Nachweis | 0,25 |
| **Summe** | **3,5** (Spanne 3,0–4,0) |

Abweichung zum Plan (2,5 AStd für die ganze Zeile): Der Plan rechnete Anlegen und Freeze mit, nicht aber die Testperson
im Harness, die Rollenkarten-Datenquelle über die Modulgrenze, das sichere `If-Match` und die Anleitung als eigene Datei.
041b kostet zusätzlich rund 2,0 AStd (Skizze).

## Standards (auf Standard gebaut)

- Gesperrter Zustand über den Lesevorgang der Rollenzuordnungen; Schreibschaltflächen für jeden, der die Seite sieht; der
  Dienst entscheidet (Eigentümerfrage 2).
- Nur die aktuelle Hauptversammlung wird bearbeitet (Eigentümerfrage 7).
- Bearbeiten je Eintrag, ein Ereignis je Absicht (Eigentümerfrage 9).
- Zeit in Europe/Berlin; leerer Ablauf = Ende der Hauptversammlung.
- Erster Tab: Rollenzuordnungen (die häufigste Verwaltungsaufgabe am HV-Tag, Rechtekonzept §5).

## Offene Eigentümerfragen

Keine blockiert den Bau; alle mit Standard.

1. **Risikoklasse.** Standard: mittel wie im Plan (Begründung „Warum mittel“). Option: hoch; dann Lesebefund der Spec vor
   dem Bau und Review nie gebündelt, rund +0,3 AStd.
2. **Schreibschaltflächen ohne Rechtemenge.** Standard: Wer die Seite öffnen darf (Lesen der Rollenzuordnungen gelingt),
   sieht alle Schreibschaltflächen; heute halten genau dieselben Personen alle vier Verwaltungsrechte, und der Dienst
   entscheidet jede Handlung (403 mit Meldung). Option: bis 089b warten und jede Schaltfläche über ihr eigenes Recht
   zeigen; mit 089b kostet das < 0,1 AStd (Folgepunkt an 089b).
3. **Freeze-Platzhalter für die Demo.** Standard: kein Freeze-Element in 041 (was es nicht gibt, wird nicht angeboten,
   D9). Option: Zeile „Konfigurationsfreeze: noch nicht verfügbar“ im Kopf, < 0,1 AStd.
4. **Anleitung jetzt.** Standard: v1 jetzt, nur Vorhandenes (Entscheidung 10). Option: ganz nach 041b, −0,15 AStd.
5. **Verwaltungsperson im lokalen Paket.** Standard: nein in 041; die zehnte Person lebt nur im Harness von `e2e-http`.
   Option: Person `admin` auch im lokalen Paket (geteiltes Verzeichnis, Zustandsübernahme für bestehende lokale Stände,
   Installationsseite), eigener Takt rund 0,3 AStd in der Lane infra; dann zeigt die Betriebs-Demo auch die Verwaltung.
6. **Rechtetabelle vom Dienst.** Standard: Rollenkarten aus der Tabelle des Web-Builds (gleicher Commit wie der Dienst).
   Option: Endpunkt oder Feld, das die wirksame Tabelle liefert, mit Vertragsschritt; zusammen mit 089b rund 0,5 AStd.
7. **Andere Hauptversammlung bearbeiten.** Standard: nur die aktuelle; die Liste ist lesend. Option: Stammdaten einer
   anderen Hauptversammlung schon in 041 (die Operationen nehmen `meetingId`), Rollenzuordnungen aber erst mit 041b, weil
   `HvApi` sie nur für den Alias kennt; rund 0,3 AStd, mit dem Risiko einer halb wirksamen Auswahl. Empfehlung: Standard.
8. **Navigation.** Standard: Eintrag für alle sichtbar, gesperrter Zustand ohne Recht (wie 053/054); 089b blendet aus.
9. **Listeneditor.** Standard: je Eintrag. Option: mehrere Änderungen in einem Dialog, ein Ersatz; rund 0,3 AStd, dafür
   ungenauere Ablehnungen.

## Hinweise an den Orchestrator

- **Plan-Eintrag 041 (§5, Zeile 650–655):** Abhängigkeiten „040, 030, 082“ → „040a, 040b, 030, 082“ (040c/040d gehen an
  041b); Nachweise „Playwright Jahrgang anlegen → Freeze → Änderung abgelehnt“ → „Playwright abgelehnte Änderungen
  (R-ADM-02, R-ADM-07, R-ADM-08)“, der Freeze-Ablauf bei 041b; Aufwand 2,5 → 3,5 AStd; Lanes „web-admin“ → zusätzlich
  web-shell, web-api (ein Modul), e2e.
- **Neuer Plan-Eintrag 041b** (Skizze unten) nach 040d, Abhängigkeiten 040c, 040d, 041; Lanes web-admin, e2e, docs; plan-graph
  danach laufen lassen. Plan §11 Zeile 1362 „der Plan-Eintrag 041 bleibt dafür bestehen“ → „… folgen mit 041b“.
- **089b:** jede Schreibschaltfläche der Verwaltung über ihr eigenes Recht (`admin.roles.manage`, `admin.units.manage`,
  `admin.seats.manage`, `agenda.manage`) statt über den gesperrten Zustand (Eigentümerfrage 2); `/admin` ausblenden.
- **Folgeliste** (Einträge legt der Bau an): Verwaltungsperson im lokalen Paket (Frage 5); Rechtetabelle vom Dienst
  (Frage 6); Standard-Ablauf `expiresAt` „Ende der Hauptversammlung“ wird im Kern nicht gesetzt, nur so angezeigt
  (Befund; Vertragstext und Projektion angleichen, Lane core).

## 041b · Verwaltung, Teil 2: Anlegen, Freeze, Vertretungen (Skizze, eigene Spec vor dem Bau)

**Braucht:** 040c (gemergt: `createMeeting` mit Klonen, Nummernkreise `listMeetingCaptureRanges`/
`replaceMeetingCaptureRanges`, R-ADM-05), 040d (gemergt: `freezeMeetingConfig`, `overrideMeetingConfig` mit Pflichtgrund,
`startMeeting`, R-ADM-03/04/06/10, R-MTG-08/09, `Meeting.configDrift`), dazu im Domänentyp `Meeting` die Felder
`configFrozenAt`, `configHash`, `configOverriddenAt`, `configDrift`, `clonedFromMeetingId`, `format` (kommen mit 040c/040d)
und **jahrgangsbezogene Rollen-Methoden** in `HvApi` (`listRoleAssignments(meetingId, …)`, `assignRole(meetingId, …)`,
`revokeRole(meetingId, …)`; gemeinsame Entscheidung 5 aus 040a; Vertrag hat `meetingId` im Pfad schon, also nur Kern,
Adapter und Live-Puffer; liefert 040d mit oder ein eigener Kernschritt). Kein Vertragsschritt in 041b selbst, wenn
040c/040d alles mitbringen; sonst vorher.

**Inhalt:**
- Auswahl der verwalteten Hauptversammlung im Kopf; „Hauptversammlung anlegen“ mit optionalem Klonen (Stammdaten, keine
  Inhalte; Vorschau, was kopiert wird).
- **Freeze im Kopf:** Zustand, `configFrozenAt` (Mono), `configHash` (Mono, gekürzt mit vollem Wert zum Kopieren),
  Abweichung aus `configDrift` als Warnung mit Abschnitten; Schaltfläche „Konfiguration einfrieren“ mit Bestätigung
  (R-ADM-04, R-ADM-10 als Ablehnung mit Liste der fehlenden Vertretungen).
- **Override** mit Pflichtgrund und Bereich, sichtbar als herausgehobenes Ereignis; nach dem Freeze laufen Stammdaten- und
  Rollenänderungen nur über diesen Weg (409 R-ADM-03 auf dem normalen Weg, als Meldung).
- „Hauptversammlung starten“ (R-MTG-08/09 als Ablehnung).
- **Vertretungen** im Dialog „Rolle zuordnen“ (`deputyForSubjectId`, R-ADM-06) und eine Übersicht „Vertretungen je Rolle“
  (zwei je besetzter Rolle, Rechtekonzept §5).
- Tab **Nummernkreise** je Erfassungsplatz.
- Playwright „Hauptversammlung anlegen → Freeze → Änderung abgelehnt (R-ADM-03) → Override mit Grund → Änderung
  wirksam“, Screenshots DE/EN mit Hash im Kopf, axe.
- **Admin-Anleitung „Übungs-HV in unter zwei Stunden anlegen“**: der ganze Ablauf, einmal von einem Agenten in frischem
  Kontext mit Zeitprotokoll durchgespielt (Vorbild 072).

**Klasse und Aufwand (Schätzung):** mittel nach dem Muster dieser Spec, weil wieder nur gebaute Operationen bedient
werden; Override und Freeze sind Grenzfälle der Leitplanken §4 (die Spec von 041b entscheidet und begründet, im Zweifel
hoch). Rund **2,0 AStd** (Spanne 1,75–2,5), Lanes web-admin, e2e, docs.

## Bericht (nach Bau ausfüllen)

```
Slice: 041-admin-oberflaeche
Done: <Route /admin mit Registerzeile; Kopf und sechs Tabs; Rollen zuordnen/entziehen mit Fachbereich und Ablauf;
      Stammdaten je Eintrag mit If-Match der vor der Liste gelesenen Version; Rollenkarten aus ROLE_PERMISSIONS;
      Admin-Anleitung v1; Testperson admin im Harness von e2e-http>
Evidence: <Schluss von `pnpm gates` mit Commit>, docs/evidence/041-*.png, CI-Lauf <id> (e2e-http, Dauer des Schritts)
Open: <was nicht erledigt ist, mit Grund; Folgeliste-Einträge>
Touched: <Dateiliste, nur Files allowed>
```

Zusätzlich: Ergebnisse der Punkte „Vor dem Bau prüfen“ (1–7) mit Fundstellen; rote und grüne Testläufe; genaue Zahl der
neuen i18n-Schlüssel; Laufzeit `e2e-http` (Ist vorher, Schätzung, tatsächlich); Design-Kritik D1–D10 als Tabelle;
Abweichungen von der Spec mit Grund.

## Review findings

—
