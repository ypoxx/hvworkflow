# Scheibe 054 — Fokusansicht der Beantworter

**Status:** angenommen (04.10.2026, gemergt als cc97005, PR #149; Spec als #147 `4f37d07`) · gebaut und im Review nachgearbeitet (1 major, 010d-Testumfang, behoben) · spec (04.10.2026; gelesen auf `e0798e1` und auf dem Branch der Scheibe 053 bei `5a6f28b`; 053 ist inzwischen gemergt (`d73f8fa`, PR #145), der Bau beginnt auf der Integration mit 053. Nacharbeit nach Codex P1 auf #147 (04.10.2026, Entscheidungen des Orchestrators): die Demo-Fachkraft wird in dieser Scheibe an Finanzen gebunden (Entscheidung 2a), das Zurückholen nach dem Weiterleiten ist als 054c mit Register E58 eingeplant. Vierte Scheibe der Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041, Register E57; nicht geteilt, Rückfallteilung 054b vorbereitet, Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** mittel · 3,7 AStd (Spanne 3,2–4,3; Plan 054: mittel · 2 AStd; Begründung in „Warum mittel“ und „Aufwand“) · Plan 054: 16.11.2026 (W8), tatsächlich direkt nach 053 als vierte Oberflächenscheibe der Freigabe-Demo · Lanes: web-focus (neu, `apps/web/src/features/focus/**`); web-shell (eine Zeile im Feature-Register mit Alt+6 und drei Shell-Schlüssel); web-api (Bindung der Demo-Fachkraft als Daten in `actor.ts` und ein Schritt im Demo-Start in `index.ts`, dazu eine neue Testdatei für den Zuschnitt je Akteur); e2e (eigene Datei, im Projekt `http` eingereiht, Texte in `e2e-texts.ts`; ein Schritt in `020-rueckbau-passung.spec.ts` wegen der Bindung); docs (zwei Glossarzeilen, Nachweise). **Keine** Änderung in web-answers oder web-steering: Weiterleiten-Dialog, Schreibtür und Fokusregel aus 053 werden nur importiert.
**Bedrohungsmodell:** berührt T-G1-I-01 (Anzeige) und MF-14 (Weiterleiten erweitert den Leserkreis um den Zielfachbereich; Regel und Umfang in 048, Dialog in 053). Keine neue Angriffsfläche: kein neuer Endpunkt, kein neues Recht, kein neues Feld; die Seite bedient drei vorhandene, geprüfte Operationen (`draftAnswer`, `submitForReview`, `forwardQuestion`).
**Rolle:** implementierer-oberflaeche; Review in frischem Kontext mit den Perspektiven **UX/Barrierefreiheit** (D1–D10, Tastaturpfad Doppelklick/Enter/Escape/Strg+Enter) und **Datenschutz** (Zuschnitt „Meine Fragen“ nur über `_actions` und die Einheitsbindung des Dienstes; Weiterleiten-Dialog unverändert aus 053; Anzeige der Wortmeldung so, wie der Kern sie liefert). Ablauf nach E57 für Oberflächenscheiben mittleren Risikos: kein gesonderter Lesebefund der Spec, ein Review nach dem Bau; Sicherheits-, Rechts- und Datenschutzbefunde werden nie vertagt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue fachliche Regel. In der Oberfläche bedient und belegt: R-TRANS-03 (Antwortversion anlegen; R-GUARD-03 nur Textpfade), R-TRANS-04 (Weiterleiten zum nächsten Schritt, `question.submit_review`, Anzeige „Weiterleiten“ nach E5), R-TRANS-17 und R-GUARD-15 (An anderen Fachbereich weiterleiten, Dialog aus 053), R-GUARD-04 (Hinweis: eine neue Version hebt eine Freigabe auf), R-PERM-01, R-PERM-02 und R-PERM-03 (über `_actions`, Lesepfade und die Einheitsbindung gebundener Fachkräfte). Dazu AGENTS.md R2, R3, R4, R5, R6, R9, R10, R12; `docs/design-prinzipien.md` D1–D10
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 054 (Zeile 773–779), Eintrag 053 (Zeile 767–772), Eintrag 048 (Zeile 706), Eintrag 082 (Zeile 409), Eintrag 055 (Zeile 787–790, hängt an 054), §11 „Freigabe-Demo“ (Zeile 1317, 1344); `docs/feedback/2026-09-zielbild-oberflaeche.md` Z1 (Zeile 44), Z5 (48), Z7 (50), Z8 (51), Z9 (52), Z2–Z4 (45–47, nach E50/E51); `docs/feedback/2026-09-quickview-projektleitung.md` #24 (Zeile 80), #28 (84), #29 (85), #32 (88); Register E5 (Zeile 39), E50 (85), E51 (86), E57 (92); Specs 053 (Weiterleiten-Dialog Entscheidung 4, Schreibtür Entscheidung 6, Fokus nach Aktion, Nacharbeit `af78c0c`, „Hinweise an Folgescheiben: 054“), 048 („Einheitsbindung“, Zeile 92–97; „Antwort nach dem Weiterleiten aus dem eigenen Bereich“, Zeile 240–246; „Hinweise an Folgescheiben: 054“, Zeile 719–724), 045 (Isolation im e2e, Lehre zum Serverfilter, CI-Lauf 37152696332), 010d und 090 (Daten und Eingaben je Akteur), takt-008 (Fokus nach Aktion, `aria-disabled`); `docs/folgeliste.md` „Steuerung (aus 053)“ (auf dem 053-Branch Zeile 668–695); Glossar Zeilen 50, 51, 54
**Depends on:** 053 (gemergt `d73f8fa`, PR #145: `ForwardDialog`, `forward.ts`, `useWriteDoor`, `mayMoveFocus`, Paritätszahl 586), 048 (gemergt `7405efb`, Vertrag 0.4.3), 045 (gemergt `c0db7f5`), 036b (gemergt), 021c (gemergt), 082 (gemergt `c8bcf83`; das Register steht, die Quelle der Rechtemenge fehlt wie in 053, siehe Befund)
**Perspektive:** UX, Datenschutz · **Glossar: neue Begriffe:** ja (Schreibmodus, Vorlesezeit)

## Warum mittel

Der Plan führt 054 als „mittel“; diese Spec bleibt dabei (keine Herabstufung, kein Fall für `downgrade-check`). Die
Hoch-Auslöser der Leitplanken (§4) sind Änderungen an Rechten, Freigabe, Verweigerung, personenbezogenen Daten und
Auswertungen. 054 ändert keinen davon:

- **Rechte:** kein neues Recht, keine Zeile in `ROLE_PERMISSIONS`, kein Wahrheitstabellen-Diff. Welche Einzelfragen die
  Seite zeigt und welche Schaltflächen sie anbietet, folgt `_actions` je Einzelfrage; dass eine gebundene Fachkraft nur ihren
  Fachbereich sieht, entscheidet der Dienst (`can()`, R-PERM-03), nicht die Oberfläche. Die Registerzeile trägt das Recht
  `answer.draft` als Daten.
- **Freigabe, Verweigerung:** keine neue Anzeige. Die Seite bietet „Verweigerung vorschlagen“ nicht an (heute hält kein
  Akteur mit eigenen Einzelfragen das Recht, Befund); eine Begründung einer Verweigerung wird nie gezeigt.
- **Personenbezogene Daten:** Die Wortmeldung steht so da, wie der Kern sie liefert: ohne `question.identity.reveal` als
  „Redner 15“ (`api.ts:458-463`), für die Fachkraft also nie mit Klarnamen (Z8). Keine neue Zahl je Person.
- **Weiterleiten:** Dialog, Fehlerbehandlung (404 „weitergeleitet oder nicht mehr sichtbar“, `stillShown`) und Hinweis zum
  Leserkreis kommen unverändert aus 053; 054 baut keinen zweiten Dialog.
- **Bindung der Demo-Fachkraft (Entscheidung 2a):** Sie **verengt** Lese- und Schreibrechte der Demo-Person `u-exp-fin` auf
  Finanzen (vorher alle 230 Einzelfragen, danach 35). Mittel bleibt es, weil kein Recht, keine Zeile in `ROLE_PERMISSIONS`,
  keine Übergangszeile, kein Vertrag und kein Seed geändert wird: Die Bindung ist eine Rollenzuordnung (`RoleAssigned` mit
  `unitId`), geschrieben über die vorhandene, geprüfte Operation `assignRole` des Kerns, genau so, wie die Harness die
  Testperson im Projekt `http` bindet; sie wirkt nur im Demo-Modus. Das Risiko ist Regression in bestehenden in-process-e2e,
  die die ungebundene Fachkraft voraussetzen; Entscheidung 2a nennt sie.

Verbleibendes Risiko ist Verhalten der Oberfläche: ein ungespeicherter Text, der beim Weiterleiten oder durch einen fremden
Schreibvorgang verloren geht, und ein Zuschnitt „Meine Fragen“, der zu viel zeigt. Beides deckt diese Spec mit Regeln und
Tests ab. Hält der Review die Einstufung für falsch, hebt der Eigentümer sie an (Eigentümerfrage 10); eine Hochstufung ist
kein Herabstufungsfall.

## Befund (Ist-Stand, gelesen auf `e0798e1` und 053 bei `5a6f28b`)

- **Feature-Register (082)** mit Zeile `steering` aus 053 (`requires: 'question.classify'`, ohne `shortcutKey`, zwischen
  `capture` und `answers`). Kurzbefehle Alt+1…5 belegt (speakers, capture, answers, stage, history); `AppShell.tsx:53-75`
  liest `event.key` als Zahl und sucht `shortcutKey`, ignoriert Eingabefelder (`isTextEntry`) sowie Strg und Meta.
  `ShortcutsDialog.tsx` zeigt den Bereich aus `getNavigationShortcutRange()` (heute „Alt 1 … 5“, mit einer sechsten Zeile
  „Alt 1 … 6“ ohne Codeänderung). **Die Quelle der Rechtemenge fehlt weiter** (053 Befund, Folgeliste „Steuerung (aus 053)“
  erster Punkt): `visibleRoutes` wird nirgends mit einer Menge gerufen, `GET /auth/me` liefert Rollen, keine Rechte.
- **Tastenkürzel Alt+6, Kollisionsprüfung.** In der Anwendung: Alt+1…5 (Register), Alt+N (Navigation einklappen,
  `AppShell.tsx:66`), Alt+Q (Einzelfrage aus Markierung, `ContributionText.tsx:149`, nur mit Erfassungsrecht), `?`, Escape
  (`Dialog.tsx:53`). Die Bühne fängt Tasten nur ohne Strg/Meta/Alt (`stage/Page.tsx:504`). **Alt+6 ist frei.** Außerhalb der
  Anwendung gilt für Alt+6 dasselbe wie für Alt+1…5: Unter Linux belegen manche Browser Alt+Ziffer für Tabs, unter macOS
  liefert Option+6 ein Sonderzeichen in `event.key` (dann greift kein Kürzel, auch nicht Alt+1…5). Keine neue Klasse von
  Kollision; 013 prüft Alt+2…4 mit echter Tastatureingabe und bleibt unberührt.
- **Weiterleiten-Dialog (053):** `apps/web/src/features/answers/ForwardDialog.tsx` (`ForwardDialog({ question, units,
  busy, onClose, onSubmit, initialForm? })`, Zeile 50), `apps/web/src/features/answers/forward.ts`
  (`forwardProblemHandler(show, close, gone)`, Zeile 71: 409 R-GUARD-15 und 422 im Dialog, 404 schließt nur bei
  `stillShown()` und meldet immer `answers.forward.gone`, 412 schließt bei `stillShown()` und überlässt den Hinweis der Tür).
  Kein Ziel und kein Grund vorgewählt, kein Textfeld, Hinweis zum Leserkreis. Gerendert nur, solange offen, Schlüssel
  `${actorId}:${question.id}:forward` (`steering/Page.tsx:282-305`).
- **Schreibtür (053):** `apps/web/src/features/answers/useWriteDoor.ts` (`useWriteDoor<D>({ question, selectedId, reload })`
  → `{ run, busy, dialog, setDialog, staleFor, clearStale }`, Zeile 54), wörtlich aus der Beantwortung herausgelöst.
- **Fokus nach Aktion (053, Nacharbeit `af78c0c`):** `mayMoveFocus(active, body, detail)` in
  `apps/web/src/features/steering/steering.ts:42` (nur aus `body` oder aus dem Detail heraus); Muster `pendingFocus` /
  `settleFocus` / `armFocus` mit Versionsvergleich über Refs in `steering/Page.tsx:117-155`.
- **Beantwortung:** `useBacklog(filters, selectedId)` liest die ganze Liste (`LIST_LIMIT` 2000) je Version und je
  Serverfilter; ohne Serverfilter ist die Liste vollständig (`poolComplete`), und ein 404 der Detaillesung für eine
  Einzelfrage, die die Liste nicht mehr enthält, wird verschluckt (`listOmits`, `lib.ts:263-271`). `selectedHistory` liefert
  die Ereignisse der gewählten Einzelfrage. `QuestionDetail.tsx` (759 Zeilen) hält den Entwurf als eigenen Zustand mit
  leerem Editor (`AnswerEditor.tsx`, 6 Zeilen) und wählt die primäre Aktion nach `_actions` (Zeile 377-391).
  `relativeAge(t, iso, now)` (`lib.ts:34`) liefert „eben“, „vor 12 min“, Stunden, Tage. `ACTION_KEYS`:
  `question.submit_review` = „Weiterleiten“ (E5, `shell.de.ts:191`), `question.forward` = „An anderen Fachbereich
  weiterleiten“ (Zeile 189), `answer.draft` = „Antwort entwerfen“.
- **Zuweisung ist heute eine Zuweisung an einen Fachbereich, nicht an eine Person.** `Question` trägt `unitId`, kein Feld für
  eine Person (`types.ts:309-342`); `claim` ist Anwesenheit (Präsenz), keine Zuweisung. Der Client kennt die Einheit der
  angemeldeten Person nicht: `Actor` im Vertrag hat `id`, `role`, `displayName`, `personId` (`openapi.yaml:2554-2566`), die
  Einheit (`unitId`, `assignmentScoped`) ist intern (`types.ts:27-29`, „never accepted from a request body“).
- **Einheitsbindung (048 Befund):** `expert` ist ein `unitBound`-Bündel mit `answer.draft`, `question.submit_review`,
  `question.claim`, `question.read`, `history.read`, `question.forward` (`permissions.ts:62-64`). Für einen gebundenen Akteur
  (`assignmentScoped` mit `unitId`) verweigert `can()` jede Aktion und jede Lesung auf einer Einzelfrage eines anderen
  Fachbereichs mit R-PERM-03 (`api.ts:231`). **Im Projekt `http`** ist die Testperson `expert` an `unit-fin` gebunden
  (`scripts/e2e-http-031.test.mjs:71-74`) und liest nur Finanzen. **In-process** ist die Demo-Person `u-exp-fin`
  („Fachbereich Finanzen“, `apps/web/src/api/actor.ts`) heute **nicht gebunden**: kein `unitId`, kein `assignmentScoped`, und
  der Seed schreibt kein `RoleAssigned`; sie liest alle 230 Einzelfragen, und `_actions` gilt für alle Fachbereiche (048 Zeile
  97: „Im Demo-Rollenwechsel ist `expert` nicht gebunden und sieht alle Fragen“). **Woher die Bindung kommt:** Der Kern
  bindet einen Akteur nur über eine aktive Rollenzuordnung im Ereignisprotokoll (`resolveMeetingActor`, `stream.ts:224-229`,
  gerufen von `actor()` in `api.ts:447`): Hat die Person eine Zuordnung, wird sie `assignmentScoped` mit deren `unitId`. Ein
  Demo-Akteur mit eigenem `unitId`/`assignmentScoped` ohne Zuordnung bekäme dagegen 403 R-PERM-01 (`resolveMeetingActor`
  liefert `null`). Die echte Quelle ist also die Zuordnung, nicht die Akteursdefinition.
- **`_actions` im Seed `CORPUS_DEMO`** (gemessen auf `5a6f28b` über `createInProcessApi` und `seedDemo`, Liste mit
  `limit: 2000`), Auszug für die Rechte der Beantwortung:
  - `u-exp-fin` (ungebunden): `answer.draft` auf allen Textpfad-Fragen in `classified`, `assigned`, `answer_drafted`,
    `in_review`, `approved` (R-TRANS-03); `question.forward` auf `assigned`, `answer_drafted`, `in_review` (R-TRANS-17);
    `question.submit_review` auf `answer_drafted`. **`assigned` oder `answer_drafted` mit `answer.draft` und
    `question.forward`: 40 Einzelfragen** über alle Fachbereiche (15 `assigned`, 25 `answer_drafted`); in Finanzen
    `assigned` F-0121, F-0128, F-0135, F-0204 und `answer_drafted` F-0208, F-0214, F-0226. Keine davon hat einen
    Rückgabegrund.
  - an `unit-fin` gebundene Fachkraft (über `assignRole`): 35 lesbare Einzelfragen, davon genau die **7** Finanzen-Fragen
    oben; `in_review` 6.
  - `legal`: dieselben 40 mit `answer.draft` (und `question.refuse.propose`), aber **ohne** `question.forward`.
  - `coordination`: `question.forward` auf denselben, aber **ohne** `answer.draft`. `approver`, `capture`, `moderation`,
    `admin`, `observer`: keines der beiden auf diesen Fragen; `podium` liest die Liste nicht (R-PERM-02).
- **Rückgabegrund und Weiterleitungsgrund.** `question.returnReason` (Freitext aus `question.return`, gesetzt von Recht,
  Freigabe, Versammlungsbüro, Podium oder Administration; entfällt mit einer neuen Antwortversion, R-TRANS-03 Ableitung). Den Grund einer
  Weiterleitung trägt die Einzelfrage nicht; er steht nur im Ereignis `QuestionForwarded { unitId, fromUnitId?, reasonCode }`
  (`events.ts:106`), lesbar über `history.read` (048 „Hinweise 054“: „Den letzten Weiterleitungsgrund liest die Ansicht aus
  der Historie“).
- **i18n.** Paritätstest (f) nach 053: **586** Schlüssel je Sprache (`parity.test.ts:171-178` auf dem 053-Branch); ein neues
  Modul kommt in `de.ts`, `en.ts` und die Modulliste des Paritätstests.
- **e2e `http`.** `SHARED_SPECS` (`apps/web/playwright.config.ts`) und Reihenfolge-Pin (`scripts/e2e-http-031.test.mjs:26-30`,
  `SHARED_FILES`, `HTTP_ORDER`) enthalten nach 053: 002, 021b, 021c, (030, 031), 045, 053, 080, abnahme. Eine Datei
  `054-fokusansicht.spec.ts` läuft nach Pfadreihenfolge zwischen 053 und 080. Texte, die das Projekt `http` schreibt,
  stehen in `apps/web/e2e/support/e2e-texts.ts` und in `WRITTEN_TEXTS` (die Harness prüft, dass keiner im Zugriffslog landet).
  Vor 054 schreiben in Finanzen: 045 E1 (erste `assigned` in Finanzen → `answer_drafted` mit Verweigerung als letzter Version
  und Rückgabegrund „e2e 045“); 053 berührt Finanzen nie (053 Endzustand). In Finanzen bleiben also mindestens drei `assigned`
  und drei `answer_drafted` ohne Rückgabegrund (Vor-dem-Bau-Punkt 3 prüft es).
- **Laufzeit `e2e-http`**, Schritt „End-to-end http project …“, letzte grüne Läufe mit ausgeführtem Schritt (gelesen am
  04.10.2026 über `gh api repos/ypoxx/hvworkflow/actions/runs/<id>/jobs`): 37214710167 (053, `2a12e0d`) **5:04**
  (15:54:31–15:59:35 UTC), 37215934378 (053, `5a6f28b`) **4:11** (16:13:49–16:18:00), 37208636753 (048) **4:17**
  (14:17:14–14:21:31). Mit 053 also höchstens **5:04**. Grenze der Harness 8:00 (`TOTAL_MS = 480_000`,
  `scripts/e2e-http-031.mjs:45`), Schritt `timeout-minutes: 9`.

**Kein Vertrags-, Kern- oder Dienstschritt nötig.** Stellt der Bau fest, dass etwas fehlt, hält er an und meldet es; er
ändert weder `packages/**` noch `apps/api/**` (AGENTS.md R6).

## Teilung und Zuschnitt

Die Planzeile 054 bündelt neun Punkte, das Zielbild fünf weitere. Zuschnitt:

| Punkt | In 054 | Wohin sonst | Grund |
|---|---|---|---|
| Route `/my`, Zeile im Feature-Register, Alt+6 | **ja**: eine Zeile mit `requires: 'answer.draft'`, `shortcutKey: 6` | Ausblenden in der Navigation: Folgepunkt „Quelle der Rechtemenge“ | wie 053; kein Rollenname |
| Nur eigene Zuweisungen (Einheit/Person) | **ja, enger Standard**: Fachbereich über `_actions` und die Einheitsbindung des Dienstes (Entscheidung 2); die Demo-Fachkraft wird an Finanzen gebunden (Entscheidung 2a) | Person: keine Scheibe geplant (Eigentümerfrage 1b) | es gibt keine Zuweisung an eine Person |
| Keine Filter | **ja** | — | — |
| Doppelklick öffnet Vollbild-Schreibmodus (Z7, #29) | **ja**, Schreibmodus füllt den Inhaltsbereich (Entscheidung 4) | Kopfzeile und Navigation ausblenden: Eigentümerfrage 9 | `app/**` bleibt unberührt |
| Enter/Escape-Pfad (D8) | **ja**, dazu Strg+Enter zum Speichern (Entscheidung 5) | Strg+Enter auch für „Weiterleiten“: Eigentümerfrage 3 | ein Tastendruck soll nie an Recht übergeben |
| Lesehinweis bei fehlendem Recht | **ja**: Lesezustand ohne Leserecht, Hinweis ohne eigene Einzelfragen | — | — |
| TOP und Erfassungszeit ausgeblendet (#28) | **ja**; das Alter steht relativ da („vor 12 min“, Z1), keine Uhrzeit | — | Z1 verlangt das Alter, #28 verbietet die Uhrzeit |
| Rückgabegrund prominent | **ja**, als erster Block im Detail und im Schreibmodus, Kennzeichen in der Zeile; dazu der letzte Weiterleitungsgrund aus der Historie | — | 048 „Hinweise 054“ |
| „Weiterleiten“ als primäre Aktion mit Dialog für Einheit und Grund | **ja, nach E5 und Z9 gelesen** (Entscheidung 3): „Weiterleiten“ (`question.submit_review`) ist primär; „An anderen Fachbereich weiterleiten“ ist die zweite Aktion und öffnet den Dialog aus 053 | — | die Planzeile vermengt die zwei Bedeutungen von E5 (Hinweise an den Orchestrator) |
| Z1 älteste oben, Text zweizeilig, Alter in Minuten | **ja** | — | — |
| Z5 Vorlesezeit (130 Wörter je Minute, Ziel 2 min) | **ja** | 054b, wenn der Bau über 4,0 AStd geht | — |
| Z8 „Wortmeldung 15“ statt Name | **ja, ohne eigenen Code**: der Kern liefert ohne `question.identity.reveal` „Redner 15“ | — | Maskierung bleibt im Kern |
| Z9 Strg+Enter, Rückgängig, danach öffnet die nächste Frage | **teilweise**: nächste Frage ja (Entscheidung 6), Strg+Enter nur Speichern, **kein Rückgängig** | Rückgängig: **054c** (Plan §5, 19.11.2026, Klasse hoch, nach Rechtsblick), Register **E58** | kein Übergang macht `question.submit_review` für die Fachkraft rückgängig; ein neuer Übergang braucht Rechtsblick |
| Z2–Z4 Erwartungskarte, Zahlenprüfung | nein | nach E50, E51 | Standard dort ist Nichtbau |
| Verweigerung vorschlagen | nein | Beantwortung | heute hält kein Akteur mit eigenen Einzelfragen das Recht |

**Teilungsentscheidung: keine Teilung.** Geschätzt 3,7 AStd (Abschnitt „Aufwand“), knapp über der Schwelle von rund 3,5 AStd,
seit die Bindung der Demo-Fachkraft und ihre Regressionsprüfung dazukamen (+0,3). Der
Kern der Planzeile (Liste, Schreibmodus mit Doppelklick und Tastaturpfad, Weiterleiten zum nächsten Schritt, An anderen
Fachbereich weiterleiten) ist nur zusammen prüfbar: der Plan-Nachweis „Doppelklick → Vollbild → speichern“ und die nächste
Frage nach dem Weiterleiten hängen an derselben Seite, und die Bindung gehört zum Zuschnitt „Meine Fragen“. Will der Orchestrator
unter 3,5 bleiben, zieht er 054b (unten) vor: dann 054 rund 3,25 und 054b rund 0,45 AStd.

**054b · Vorlesezeit und letzter Weiterleitungsgrund (Rückfallteilung, nur bei Überschreitung).** Zeichnet sich im Bau ab,
dass er über 4,0 AStd geht, committet er nach den Entscheidungen 1–8 ohne die Vorlesezeit (Entscheidung 7, Teil Z5) und ohne
die Zeile zum letzten Weiterleitungsgrund (Entscheidung 7, Teil Historie) einen Zwischenstand mit Tests 1–3, 5–12, von Test 4
nur den Entwurfshilfen, F1–F6 (F2 ohne den Schritt zur Vorlesezeit, F5 ohne `focus-forwarded`), F8 und meldet. Der Rest —
`readingSeconds`, `formatReading`, `lastForward`, ihre Anzeige, die Schlüssel `focus.reading.*` und `focus.forwarded`, Test 4
vollständig, F7, die fehlenden Schritte in F2 und F5, die Glossarzeile „Vorlesezeit“ — folgt als
054b **erst nach einer eigenen Spec** `docs/slices/054b-fokus-vorlesezeit.md` (Ziel, Nicht-Ziele, Regel-ids, Abnahme,
„Files allowed“ als Teilmenge dieser Liste; AGENTS.md Regel 1). Der Orchestrator schreibt sie aus diesem Absatz, bevor der Rest
gebaut wird (Lehre Codex P1 auf #144). Im Zwischenstand stehen 20 der 24 Schlüssel (Paritätstest 606), 054b bringt die
übrigen vier (610). Klasse mittel, rund 0,45 AStd, Lanes web-focus, e2e.

## Ziel und Entscheidungen vor Bau

Die Fachkraft sieht auf einer eigenen Seite nur die Einzelfragen, deren Antwort sie jetzt entwerfen und weiterleiten darf,
die älteste zuerst, ohne Filter, ohne TOP und Uhrzeit. Sie wählt eine, liest Wortlaut, Rückgabegrund und den Grund, aus dem
die Einzelfrage zu ihr kam, öffnet mit Doppelklick oder Enter den Schreibmodus (Frage oben, Antwort groß, alles andere
weg), speichert mit Strg+Enter, verlässt ihn mit Escape und gibt die Antwort mit „Weiterleiten“ an den nächsten Schritt;
danach steht die nächste Einzelfrage da. Gehört die Einzelfrage in einen anderen Fachbereich, leitet sie sie mit dem Dialog
aus 053 dorthin weiter. Jede Schaltfläche folgt `_actions`; kein Code vergleicht einen Rollennamen (R4) oder wählt eine
Aktion nach dem Status (R5).

Alle Punkte sind **auf Standard gebaut**, wo nicht anders gesagt; ein späterer Wechsel kostet die genannten Beträge.

### 1. Route und Registerzeile (`apps/web/src/app/featureRegistry.ts`)

- Genau eine neue Zeile in `FEATURES`, **direkt nach `answers`** (die gemeinsame Beantwortung, daneben die eigene Sicht):
  `{ id: 'focus', path: '/my', labelKey: 'nav.focus', icon: <lucide, Vorschlag Focus>, testId: 'nav-focus', helpKey:
  'page.focus.description', i18nModule: 'focus', requires: 'answer.draft', shortcutKey: 6, Component: FocusPage }`. Kein
  Zähler an der Navigation (ein Zähler je Person bräuchte eine eigene Quelle).
- `requires: 'answer.draft'` ist Daten, kein Rollenname. `visibleRoutes` blendet die Zeile ohne das Recht aus (Test 10). Weil
  die Navigation heute keine Menge übergibt, ist der Eintrag **für jede Rolle sichtbar**, wie `/steering` (053, Eigentümerfrage
  3A dort, Folgeliste). Wer nicht liest, sieht den Lesezustand; wer liest, aber keine eigenen Einzelfragen hat, sieht den
  Hinweis (Entscheidung 2).
- **Alt+6** über `shortcutKey: 6`; `AppShell.tsx` und `ShortcutsDialog.tsx` bleiben unverändert (Zweck von 082). In
  `featureRegistry.ts` dürfen nur die Kommentare, die den Bereich „Alt+1…5“ nennen, auf „Alt+1…6“ geändert werden.

### 2. Zuschnitt „Meine Fragen“ (`features/focus/focus.ts`, rein)

Eine Zuweisung an eine Person gibt es nicht (Befund); 054 baut keine. Der engste Zuschnitt, der ohne Vertrags- und
Kernschritt geht und nur Daten liest:

- **`myQuestions(items: readonly Question[]): Question[]`** = alle Einzelfragen der gelesenen Liste mit
  1. `status` ∈ `FOCUS_STATUSES = ['assigned', 'answer_drafted'] as const satisfies readonly QuestionStatus[]`
     (zugewiesen und noch nicht an das Legal Clearing gegeben; eine zurückgegebene Einzelfrage steht wieder in
     `answer_drafted`), **und**
  2. `_actions` enthält **`answer.draft` und `question.forward`**,

  sortiert nach `createdAt` aufsteigend, bei Gleichstand nach `number` (älteste oben, Z1); die Eingabe bleibt unverändert.
- **Warum beide Rechte:** In den Rechtedaten hält heute genau die Arbeit eines Fachbereichs beide auf derselben Einzelfrage.
  Recht entwirft, leitet aber nicht weiter; die Koordination leitet weiter, entwirft aber nicht (Befund). Für eine
  gebundene Fachkraft ist „beide Rechte“ zugleich „mein Fachbereich“, weil `can()` beide an die Einheit bindet. Es ist eine
  Lesart von `_actions`, kein Rollenvergleich; ändert sich ein Bündel, ändert sich die Liste mit, und Test 12 bemerkt es.
- **Warum ein fester Statusbereich:** `_actions` allein trennt `in_review` nicht von `answer_drafted` (die Fachkraft hält in
  `in_review` weiter `answer.draft` und `question.forward`). Der Bereich ist ein Ausschnitt der Liste wie der Statusfilter
  der Beantwortung, **keine** Entscheidung über eine Aktion; welche Schaltfläche erscheint, sagt nur `_actions`
  (Entscheidung 3). Eine Einzelfrage in `in_review` ist beim Legal Clearing und verlässt deshalb „Meine Fragen“.
- **Was das heißt, je Projekt (ausdrücklich):**
  - **`http`:** Die an `unit-fin` gebundene Testperson sieht nur Finanzen (der Dienst liefert nichts anderes); auf dem Seed
    7 Einzelfragen.
  - **in-process:** dasselbe, sobald die Demo-Fachkraft nach Entscheidung 2a gebunden ist: 7 Einzelfragen auf dem Seed
    (ohne Bindung wären es 40 aus allen Fachbereichen). Beide Projekte erzählen damit dieselbe Geschichte.
- **Daten:** `useBacklog(EMPTY_FILTERS, selectedId)` aus `features/answers` unverändert (ganze Liste, kein Serverfilter, also
  `poolComplete`); die Seite wendet `myQuestions` auf `backlog.items` an. Kein eigener Abruf.
- **Lesbarkeit und Hinweis (D6, „Lesehinweis bei fehlendem Recht“):**
  - `backlog.listForbidden` → statt Liste und Detail der Zustand `focus.forbidden.title`/`.body`
    (`data-testid="focus-forbidden"`, `role="status"`), wie die Steuerung.
  - Liste gelesen und `myQuestions` leer → `focus.empty.title`/`.body` (`data-testid="focus-empty"`, `role="status"`): „Hier
    stehen die Einzelfragen, deren Antwort Sie entwerfen und weiterleiten dürfen. Gerade liegt keine bei Ihnen.“ Derselbe Text
    für eine Fachkraft ohne offene Arbeit und für eine Rolle ohne Beantwortungsrechte; die Seite unterscheidet das nicht über
    die Rolle.
  - Liste lädt → Gerüst in Listenhöhe, nichts springt; Lesefehler → der gestaltete Fehlerzustand mit „Erneut versuchen“
    (`backlog.listFailed`, `backlog.reload`).

### 2a. Bindung der Demo-Fachkraft an Finanzen (`apps/web/src/api/actor.ts`, `apps/web/src/api/index.ts`)

Codex P1 auf #147: „Meine Fragen“ ist in der Demo nur dann „meine“, wenn die Demo-Fachkraft gebunden ist. Entscheidung des
Orchestrators (04.10.2026): Bindung in dieser Scheibe, als Daten, verengend, ohne Go des Eigentümers.

- **Mechanismus:** eine Rollenzuordnung im Ereignisprotokoll der Demo, geschrieben über `api.assignRole({ subjectId:
  'u-exp-fin', role: 'expert', unitId: 'unit-fin' })` als Administration (`admin.roles.manage`). Der Kern löst die Person danach
  über `resolveMeetingActor` als `assignmentScoped` mit `unitId` `unit-fin` auf; `can()` bindet Lesen, `answer.draft`,
  `question.submit_review` und `question.forward` an Finanzen (R-PERM-03). Das ist derselbe Weg, auf dem die Harness die
  Testperson `expert` im Projekt `http` bindet. Kein Code vergleicht dafür eine Rolle.
- **Daten:** in `apps/web/src/api/actor.ts` (die einzige Oberflächendatei, die Rollennamen nennen darf) eine Liste
  `DEMO_BINDINGS: readonly RoleAssignmentCreate[]` mit genau diesem einen Eintrag, neben `DEMO_ACTORS`, mit Kommentar
  (Scheibe 054, Codex P1). `DEMO_ACTORS` bleibt unverändert: ein Akteur mit eigenem `unitId` ohne Zuordnung bekäme 403
  (Befund).
- **Schritt im Demo-Start:** in `apps/web/src/api/index.ts`, Funktion `seedIfEmpty`, nach dem Seeden **und** beim Start eines
  schon gesäten Speichers (damit auch ein vor 054 gesäter Browser gebunden wird): als Administration für jeden Eintrag aus
  `DEMO_BINDINGS` `assignRole`; die Antwort 409 „An active assignment already exists“ heißt „schon gebunden“ und wird
  übergangen; die vorige Person wird danach wiederhergestellt (wie heute beim Seeden). Ein anderer Fehler blockiert den Start
  nicht, wird aber als `console.warn` mit fester Meldung ausgegeben (ohne Inhalte); die Fachkraft bleibt dann ungebunden, und
  der Bericht nennt es. Nur bei `DEMO_MODE`; im Projekt `http` läuft nichts davon.
- **Nicht** über den Seed: Ein `RoleAssigned` in `packages/domain/src/seed.ts` änderte den Korpus (Ereigniszahl, Fingerabdruck
  in `seed-fictitious-names.test.ts`), säte die Zuordnung auch in die Datenbank des Projekts `http` und läge außerhalb der Lane.
- **Was sich in-process ändert** (gemessen auf `5a6f28b` mit genau dieser Zuordnung): `u-exp-fin` liest 35 statt 230
  Einzelfragen (nur `unit-fin`: 4 `assigned`, 3 `answer_drafted`, 6 `in_review`, 6 `approved`, 1 `staged`, 6 `delivered`, 9
  `closed`); `myQuestions` 7 statt 40; bei `CORPUS_LOAD` 131 lesbar, `myQuestions` 21 statt 100. Das Ereignisprotokoll hat ein
  Ereignis mehr (`RoleAssigned`, 1740 → 1741 auf dem Demo-Seed); Koordination, Recht, Erfassung und alle anderen Personen lesen
  unverändert 230 und haben 0 eigene Einzelfragen. Die Administration sieht in-process eine Rollenzuordnung.
- **Regression, vor dem Bau zu prüfen** (alle in-process; keine dieser Dateien läuft im Projekt `http` mit der Demo-Person):
  - **sicher betroffen:** `apps/web/e2e/020-rueckbau-passung.spec.ts` Schritt „m3“ (Zeile 394–404): die Fachkraft filtert auf
    `captured` und erwartet den Hinweis „In dieser Rolle nur lesen“; eine gebundene Fachkraft liest keine Einzelfrage ohne
    Fachbereich, die Liste bleibt leer. **Kleinste Änderung:** dieser eine Schritt wechselt zu `approver` (liest `captured`,
    hält dort keine Aktion, also derselbe Hinweis; liest auch `closed` für die zweite Hälfte); der Kommentar nennt 054. Der
    spätere Schritt ab Zeile 468 wechselt ohnehin wieder zu `expert` und nimmt die erste `answer_drafted`-Zeile, die dann in
    Finanzen liegt. Keine Zusicherung wird geschwächt.
  - **neu laufen lassen, voraussichtlich unverändert grün** (die Fachkraft nimmt dort die erste Zeile eines Status, die nun in
    Finanzen liegt, oder liest nur): `003-answers-stage.spec.ts` (Zeile 55, 137: `assigned`, `approved`; Finanzen hat 4 bzw. 6),
    `010b-lesepfade.spec.ts` (Bühne verweigert wie bisher, Historie mit Treffern aus Finanzen), `010c-lesezustand.spec.ts`,
    `010d-ansichtsdaten.spec.ts`, `013-tastaturpfad.spec.ts` (013c: erste `assigned`), `045-verweigerung.spec.ts` (E2 liest eine
    Finanzen-Frage, unverändert), `090-eingaben-je-akteur.spec.ts` (erste `assigned`), `abnahme.spec.ts` (die Koordination
    weist die eigene Frage dem ersten Fachbereich der Auswahl zu, `unit-fin`, wie im Projekt `http`), dazu
    `024-ereignis-umschlag.spec.ts` und `040a-administration.spec.ts` wegen des zusätzlichen Ereignisses bzw. der Zuordnung.
  - Bricht eine weitere Datei, darf der Bau sie nur so ändern wie 020 (eine Zeile wählen, die die gebundene Fachkraft liest,
    oder für einen reinen Leseschritt eine andere lesende Rolle) und nennt sie im Bericht; braucht es mehr, hält er an und meldet.
  - Unit-Tests unter `apps/web/src` rufen `seedIfEmpty` nicht (gesucht am 04.10.2026); `packages/**` bleibt unberührt.
- **Folge für die Planung:** 048 Befund Zeile 97 („im Demo-Rollenwechsel nicht gebunden“) gilt ab 054 nicht mehr
  (Hinweise an den Orchestrator).

### 3. Aktionen nur aus `_actions` (`focus.ts`: `focusActions`)

E5 und Z9: „Weiterleiten“ heißt im Haus der nächste Schritt (`question.submit_review`, Anzeige seit 020); „An anderen
Fachbereich weiterleiten“ ist die Übergabe an einen anderen Fachbereich (048). Die Planzeile 054 meint mit „Weiterleiten als
primäre Aktion mit Dialog für Einheit und Grund“ beides zugleich; diese Spec liest sie wie Z9 und 048 „Hinweise 054“:

- **`focusActions(actions: readonly Permission[], ui: { dirty: boolean; writing: boolean }): { primary?: FocusAction;
  secondary: FocusAction[] }`**, `FocusAction` ∈ `'save' | 'submit' | 'write' | 'forward'`. Die Hilfe liest **nur** die Liste
  der Rechte und die zwei Zustände der Oberfläche, nie den Status (R5): dieselbe Liste ergibt in jedem Status dasselbe
  (Test 2).
  - `'save'` (Entwurf speichern, `answers.editor.save`) nur im Schreibmodus, nur mit `answer.draft`; **primär, solange
    ungespeicherter Text da ist**; ohne ungespeicherten Text gesperrt angezeigt (`aria-disabled`, takt-008), nie versteckt,
    weil der Schreibmodus ein Eingabeformular ist.
  - `'submit'` („Weiterleiten“, `actionLabel(t, 'question.submit_review')`) mit `question.submit_review`; primär, wenn kein
    ungespeicherter Text da ist.
  - `'write'` („Antwort schreiben“ `focus.write.open`, mit ungespeichertem Text „Entwurf fortsetzen“
    `focus.write.continue`) nur außerhalb des Schreibmodus, mit `answer.draft`; öffnet den Schreibmodus. Primär, wenn
    `'submit'` nicht primär ist (also ohne `question.submit_review` oder mit ungespeichertem Text).
  - `'forward'` („An anderen Fachbereich weiterleiten“, `actionLabel(t, 'question.forward')`) mit `question.forward`;
    **immer sekundär**, außer es ist die einzige Aktion.
  - **Ungespeicherter Text sperrt die Übergaben:** Mit `dirty` fehlen `'submit'` und `'forward'` (nicht ausgegraut, D9), und
    eine Zeile `focus.draft.unsaved` (`data-testid="focus-draft-unsaved"`) sagt „Ungespeicherter Text. Erst speichern; danach
    lässt sich die Einzelfrage weiterleiten.“ So gibt niemand eine ältere Version weiter, während der neue Text nur im
    Browser steht, und kein Weiterleiten verwirft Text.
  - `question.refuse.propose`, `question.claim` und alle übrigen Rechte werden ignoriert (Nicht-Ziele).
- Ergebnis auf dem Seed für die Fachkraft: `assigned` → primär „Antwort schreiben“, sekundär „An anderen Fachbereich
  weiterleiten“; `answer_drafted` → primär „Weiterleiten“, sekundär „Antwort schreiben“ und „An anderen Fachbereich
  weiterleiten“.
- Schaltflächen: `focus-write`, `focus-submit`, `focus-forward` im Detail; `focus-save`, `focus-writing-submit`,
  `focus-writing-forward` im Schreibmodus. Die primäre trägt `data-primary="true"` und die Primärvariante des Bausatzes.
  Ohne Aktion keine Aktionsleiste (D9).

### 4. Liste, Detail und Schreibmodus (`FocusList.tsx`, `FocusDetail.tsx`, `WritingMode.tsx`, `Page.tsx`)

- **Aufbau der Seite:** `PageHeader` (`page.focus.title`, `page.focus.description`), darunter `SplitPane`
  (eigener Speicherschlüssel nach dem Muster der übrigen Seiten, `hv-<feature>-split-v1` mit `focus`) mit der Liste links und dem Detail rechts. Keine Filterleiste, kein Suchfeld, keine
  Statuschips, keine Sortierwahl.
- **Liste (`FocusList`, eigene Komponente, nicht `WorkList`):** `role="listbox"`, `tabIndex={0}`, `aria-label`
  `focus.list.label`, `aria-activedescendant` auf die gewählte Zeile (Muster `WorkList.tsx:313-334`, 583-605), Pfeiltasten
  wählen. Wurzel mit `data-testid="focus-list"` und `data-state` = `loading` | `ready` | `failed` (für das Warten im e2e).
  Je Zeile (`role="option"`, `data-testid="focus-row"`, `data-number`, `data-status`, `data-unit`, `data-created`
  = `createdAt`, `data-returned="true"` bei Rückgabegrund): Nummer in Mono, Statusbadge, Alter mit `relativeAge` (`focus-row-age`, Neuberechnung alle 30 s wie `WorkList`),
  Kennzeichen „Zurückgegeben“ (`answers.detail.returned`, `focus-row-returned`), Badge `answers.refusal.badge`, wenn
  `latestIsRefusal`; darunter der **Wortlaut über zwei Zeilen** (`line-clamp-2`, `focus-row-text`). **Kein TOP, keine
  Uhrzeit, kein Rednername neben dem Text** (die Wortmeldung steht im Detail). Keine Fensterung (die Liste ist klein; bei 800
  und gebundener Demo-Fachkraft 21 Zeilen, gemessen auf `5a6f28b`, Test 12); Fuß mit `focus.list.count`. Zeilen tragen `select-none`,
  damit ein Doppelklick kein Wort markiert.
- **Auswahl:** Klick wählt; **Doppelklick wählt und öffnet den Schreibmodus**; Enter auf der Liste öffnet den Schreibmodus
  der gewählten Zeile. Beides nur, wenn der gelesene Datensatz der gewählten Einzelfrage `answer.draft` in `_actions` trägt
  (die Liste kann älter sein als das Detail); sonst bleibt es beim Detail.
- **Detail (`FocusDetail`):** Nummer in Mono (`focus-detail-number`, `tabIndex={-1}`), Statusbadge, Fachbereich
  (`focus-detail-unit`, Kurzname), und in dieser Reihenfolge:
  1. **Rückgabegrund**, falls gesetzt, als erster Block (`focus-returned`, `role="note"`, Tönung wie der Hinweis zum
     Leserkreis, Beschriftung `answers.detail.returned`, Text in voller Länge);
  2. **letzte Weiterleitung**, falls die Historie ein `QuestionForwarded` in den aktuellen Fachbereich trägt
     (`focus-forwarded`, `focus.forwarded`: „Weitergeleitet von {from}. Grund: {reason}“, Fachbereich mit Kurzname, ohne
     `fromUnitId` `common.none`, Grund über `forwardReasonLabel`); ohne `history.read` oder ohne Ereignis keine Zeile;
  3. Wortlaut groß (`focus-detail-text`, Beschriftung `answers.detail.label`), Wortmeldung (`answers.detail.speaker`,
     `speakerDisplayName`, wie der Kern ihn liefert);
  4. letzte Antwortversion lesend (`focus.latest.title`, Text und Quellen; ohne Version `focus.latest.none`), bei
     Verweigerung als letzter Version nur das Badge und der Wortlaut der Version, **nie** `refusalJustification`; Vorlesezeit
     der letzten Version (Entscheidung 7);
  5. `focus-draft-unsaved`, falls ungespeicherter Text da ist; Aktionsleiste nach `focusActions`.
  Keine Versionsliste, kein Vergleich, keine Historie, kein Freigabeblock (dafür bleibt die Beantwortung).
- **Schreibmodus (`WritingMode`, `data-testid="focus-writing"`):** eine Umschaltung der Seite, **kein Dialog und keine
  Ebene**: Liste und Detail werden nicht gerendert, der Schreibbereich füllt den Inhaltsbereich; Kopfzeile, Navigation und
  Sprachumschaltung der Shell bleiben (Eigentümerfrage 9). Inhalt: Überschrift `focus.write.title` mit Nummer, Rückgabegrund
  (wie oben, falls gesetzt), Wortlaut der Einzelfrage vollständig, **großes Textfeld** (`focus-editor`, füllt die Höhe,
  Beschriftung `answers.editor.label`), Quellen (`focus-sources`, `answers.editor.sources.*`), Hinweis R-GUARD-04
  (`answers.editor.hint`), wenn eine Freigabe besteht, Vorlesezeit des Textfelds, Tastenhinweis `focus.write.keys`,
  Aktionsleiste nach `focusActions` mit `focus-writing-close` („Schreibmodus verlassen“, `focus.write.close`, Ghost).
  `StaleBanner` der Schreibtür (412) steht auch hier.
- **Entwurf (Text des Schreibmodus):** ein Speicherplatz der Seite `{ key: `${actorId}:${questionId}`, text, sources,
  baseVersion, baseText, baseSources }`, angelegt beim ersten Öffnen für diese Einzelfrage:
  - **vorbelegt mit der letzten Antwortversion** (Text und Quellen), außer deren Art ist eine Verweigerung
    (`latestIsRefusal`): dann leer, mit dem Hinweis `answers.refusal.editorHint` (045; ein Entwurf verdrängt die
    Verweigerung). Ohne Version leer.
  - `dirty` = Text (getrimmt) oder Quellen weichen von `baseText`/`baseSources` ab.
  - Escape und „Schreibmodus verlassen“ behalten den Text; erneutes Öffnen zeigt ihn wieder.
  - Der Speicherplatz fällt bei Akteurwechsel (090, Vergleich über `actor.id`) und wenn die Einzelfrage „Meine Fragen“
    verlässt.
  - **Fremde Version während des Schreibens:** Trifft eine neuere Antwortversion ein (Strom), wird ein unveränderter Text
    still auf sie umgestellt; ein veränderter bleibt, und der Schreibmodus zeigt `StaleBanner` mit `focus.write.rebase`
    („Inzwischen liegt eine neuere Antwortversion vor. Ihr Text ist nicht gespeichert.“), dessen Neu-laden-Schaltfläche den
    Text durch die neue Version ersetzt. Speichern bleibt möglich (eine neue Version nach R-TRANS-03, bewusst nach dem
    Hinweis).
- **Schreiben** nur über die Schreibtür `useWriteDoor<FocusDialog>` aus 053 (`FocusDialog` = `'forward'`):
  - Speichern: `run('answer.draft', (o) => api.draftAnswer(id, { text, ...(sources !== '' ? { sources } : {}) }, o), onSaved)`;
    danach `baseVersion`, `baseText`, `baseSources` auf den gespeicherten Stand, also nicht mehr `dirty`; der Schreibmodus
    bleibt offen.
  - Weiterleiten: `run('question.submit_review', (o) => api.submitForReview(id, o), onHandedOver)`.
  - An anderen Fachbereich weiterleiten: `ForwardDialog` aus 053 unverändert, nur gerendert, solange offen, Schlüssel
    `${actorId}:${question.id}:forward`, mit `forwardProblemHandler(report, close, gone)` und dem Toast
    `answers.forward.gone` genau wie `steering/Page.tsx:282-305`; `onDone` = `onHandedOver`.

### 5. Tastaturpfad (D8): Doppelklick, Enter, Escape, Strg+Enter

| Wo | Taste | Wirkung |
|---|---|---|
| Liste | Pfeil hoch/runter | wählt die vorige/nächste Zeile |
| Liste | Enter | öffnet den Schreibmodus der gewählten Zeile (wie Doppelklick), Fokus ans Ende des Textfelds |
| Detail | Tab | erreicht die Aktionsleiste; `focus-write` öffnet den Schreibmodus |
| Schreibmodus | Strg+Enter (macOS: Cmd+Enter) im Textfeld oder in den Quellen | speichert, wenn `dirty` und `answer.draft` (sonst nichts); nie Weiterleiten |
| Schreibmodus | Escape | verlässt den Schreibmodus, Text bleibt; Fokus auf die Liste (`focus-list`), deren `aria-activedescendant` die Einzelfrage zeigt; ist sie dort nicht mehr, auf die Liste |
| Dialog über dem Schreibmodus | Escape | schließt nur den Dialog (`Dialog.tsx` behandelt Escape im Capture und ruft `preventDefault`); der Schreibmodus bleibt, Fokus zurück auf die öffnende Schaltfläche |
| überall außer Eingabefeldern | Alt+6 | öffnet `/my` (Register) |

- Reine Hilfe `isSaveChord(event: { key; ctrlKey; metaKey; altKey; shiftKey; isComposing? })`: Enter mit Strg **oder**
  Meta, ohne Alt und Shift, nicht während einer Komposition (IME).
- Escape im Schreibmodus wird ignoriert, wenn `event.defaultPrevented` oder ein Dialog der Seite offen ist (beides; Test 9,
  F3). Der Schreibmodus fängt die Tabulatortaste nicht ein (er ist kein Dialog): Kopfzeile und Navigation bleiben
  erreichbar.

### 6. Nächste Einzelfrage und Fokus nach Aktion (Z9, takt-008)

- **Auswahl folgt der Liste** (reine Hilfe `nextSelection(mine, selectedId, lastIndex): string | null`), angewendet, sobald
  die Liste für diesen Akteur geantwortet hat (`!backlog.listLoading`), nie während sie lädt:
  - nichts gewählt und die Liste nicht leer → die erste (älteste) Einzelfrage;
  - die gewählte steht in `mine` → bleibt; die Seite merkt sich ihren Index (`lastIndex`, Ref);
  - die gewählte steht **nicht mehr** in `mine` → die Einzelfrage am gemerkten Index, sonst die letzte; leer → keine.
  Gilt nach eigenem „Weiterleiten“ (die Einzelfrage geht nach `in_review`), nach eigenem „An anderen Fachbereich
  weiterleiten“ aus dem eigenen Bereich (gebunden: nicht mehr lesbar, 048) und nach einem fremden Schreibvorgang.
- **Eine an einen anderen Fachbereich weitergeleitete Einzelfrage verschwindet in beiden Projekten** (die Fachkraft ist
  gebunden, Entscheidung 2a), und die nächste steht da. Nach
  048 antwortet der Dienst auf das Weiterleiten mit 200 und leerem `_actions`; die folgende Detaillesung ist 404, die
  vollständige Liste enthält die Einzelfrage nicht mehr, also verschluckt `useBacklog` den 404 (`listOmits`). Diese Kette
  belegt F5 in beiden Projekten (kein Toast „Aktion nicht möglich“); sie wird hier nicht als „kann nicht vorkommen“
  behauptet, sondern geprüft.
- **Schreibmodus und Wechsel:** Der Schreibmodus gehört zu einer Einzelfrage. Verlässt sie „Meine Fragen“ oder verliert ihr
  Datensatz `answer.draft`, endet er; war der Text `dirty`, meldet ein Toast `focus.write.gone` mit Nummer („… liegt nicht
  mehr bei Ihnen. Der ungespeicherte Text ist verworfen.“). Nach eigenem erfolgreichen Weiterleiten oder Weiterleiten an
  einen anderen Fachbereich endet er in jedem Fall. Eigene Übergaben
  verwerfen nie Text, weil sie mit `dirty` nicht angeboten werden (Entscheidung 3).
- **Fokus nach Aktion:** nach dem Muster von `steering/Page.tsx:117-155` mit `mayMoveFocus` aus `steering.ts` (importiert,
  nicht kopiert): Nach Weiterleiten oder Weiterleiten an einen anderen Fachbereich geht der Fokus, sobald das Detail der nun
  gewählten Einzelfrage in einer neueren Fassung bzw. als andere Einzelfrage dasteht, auf deren primäre Aktion
  (`[data-primary="true"]`), sonst auf `focus-detail-number`; nur aus `body` oder dem Detail heraus, nie aus einem
  Eingabefeld. Speichern bewegt den Fokus nicht (wer mit Strg+Enter speichert, schreibt weiter). Öffnen des Schreibmodus →
  Fokus ins Textfeld; Verlassen → Liste (Entscheidung 5).
- **Daten je Akteur (010d, 090):** Bei Akteurwechsel fallen in derselben Darstellung Schreibmodus, Entwurf, Dialog und „Stand
  veraltet“ (Dialog und Hinweis über die Schreibtür), die Auswahl wird zurückgesetzt und dann nach `nextSelection` neu
  gesetzt.

### 7. Vorlesezeit und letzte Weiterleitung (`focus.ts`)

- **Vorlesezeit (Z5):** `readingSeconds(text)` = `ceil(words / 130 × 60)` mit `words` = Anzahl der durch Leerraum
  getrennten Teile des getrimmten Texts (leer → 0); `formatReading(seconds)` → „m:ss“. Anzeige `focus.reading.time`
  („Vorlesezeit ca. {time} min“, `data-testid="focus-reading-time"`, `data-seconds`), Hilfetext `focus.reading.help`; über
  120 s zusätzlich `focus.reading.over` (`focus-reading-over`, Text, keine Farbfläche, D4). Im Schreibmodus live für das
  Textfeld, im Detail für die letzte Version. Kein Ton, keine Sperre.
- **Letzte Weiterleitung:** `lastForward(history, unitId)` → das letzte `QuestionForwarded` mit `payload.unitId === unitId`
  als `{ fromUnitId?: string; reasonCode }` oder `undefined`; andere Ereignistypen werden übergangen. Liest den Ereignistyp,
  keinen Status.

### 8. Sprache, Begriffe, Glossar

- Hausvokabular (R9, D6): Meine Fragen, Einzelfrage, Antwortversion, Entwurf, Weiterleiten (= `question.submit_review`), An
  anderen Fachbereich weiterleiten, Grund der Weiterleitung, Zurückgegeben, Schreibmodus, Vorlesezeit, Fachbereich. Nie
  „Weiterleiten“ allein für `question.forward` (Glossar Zeile 51), nie „Inbox“, „Task“, „Ticket“, „Assignee“. Kein
  Rollenname in einem Text.
- **Glossar** (`docs/glossar.md`, zwei neue Zeilen nach „Fokusansicht“):
  - „Schreibmodus“ / „Writing mode“ / `apps/web/src/features/focus/WritingMode.tsx`; Frage oben, Antwort groß, Liste
    ausgeblendet (Scheibe 054) / verboten: „Vollbild“ als Name der Funktion (es bleibt die Shell), „Editor“ in Texten;
  - „Vorlesezeit“ / „Reading time“ / `readingSeconds` (130 Wörter je Minute, Ziel zwei Minuten, Scheibe 054) / —.

### 9. i18n-Schlüssel (24 je Sprache; Paritätstest (f) 586 → 610)

| Modul | Schlüssel | de | en |
|---|---|---|---|
| shell | `nav.focus` | Meine Fragen | My questions |
| shell | `page.focus.title` | Meine Fragen | My questions |
| shell | `page.focus.description` | Die Einzelfragen, deren Antwort Sie entwerfen und weiterleiten dürfen, die älteste zuerst. | The questions whose answer you may draft and forward, oldest first. |
| focus | `focus.list.label` | Meine Einzelfragen, die älteste zuerst | My questions, oldest first |
| focus | `focus.list.count` | {n} Einzelfragen | {n} questions |
| focus | `focus.empty.title` | Keine Einzelfrage zum Beantworten | No question to answer |
| focus | `focus.empty.body` | Hier stehen die Einzelfragen, deren Antwort Sie entwerfen und weiterleiten dürfen. Gerade liegt keine bei Ihnen. | The questions whose answer you may draft and forward appear here. There is none with you right now. |
| focus | `focus.forbidden.title` | In dieser Rolle keine Leseberechtigung für diese Ansicht | No read permission for this view in this role |
| focus | `focus.forbidden.body` | Diese Rolle darf die Einzelfragen nicht lesen. | This role may not read the questions. |
| focus | `focus.detail.empty` | Links eine Einzelfrage wählen. | Choose a question on the left. |
| focus | `focus.forwarded` | Weitergeleitet von {from}. Grund: {reason} | Forwarded from {from}. Reason: {reason} |
| focus | `focus.latest.title` | Letzte Antwortversion | Latest answer version |
| focus | `focus.latest.none` | Noch keine Antwortversion. | No answer version yet. |
| focus | `focus.write.open` | Antwort schreiben | Write the answer |
| focus | `focus.write.continue` | Entwurf fortsetzen | Continue the draft |
| focus | `focus.write.title` | Schreibmodus | Writing mode |
| focus | `focus.write.close` | Schreibmodus verlassen | Leave writing mode |
| focus | `focus.write.keys` | Strg+Enter speichert den Entwurf. Escape verlässt den Schreibmodus, der Text bleibt erhalten. | Ctrl+Enter saves the draft. Escape leaves writing mode; the text is kept. |
| focus | `focus.write.gone` | {number} liegt nicht mehr bei Ihnen. Der ungespeicherte Text ist verworfen. | {number} is no longer with you. The unsaved text was discarded. |
| focus | `focus.write.rebase` | Inzwischen liegt eine neuere Antwortversion vor. Ihr Text ist nicht gespeichert. | A newer answer version has arrived meanwhile. Your text is not saved. |
| focus | `focus.draft.unsaved` | Ungespeicherter Text. Erst speichern; danach lässt sich die Einzelfrage weiterleiten. | Unsaved text. Save first; then the question can be forwarded. |
| focus | `focus.reading.time` | Vorlesezeit ca. {time} min | Reading time approx. {time} min |
| focus | `focus.reading.over` | Länger als zwei Minuten. | Longer than two minutes. |
| focus | `focus.reading.help` | Gerechnet mit 130 Wörtern je Minute; Ziel sind zwei Minuten. | Based on 130 words per minute; the target is two minutes. |

Summe: shell 3, focus 21 = **24**. Mitbenutzt, nicht neu: `action.question.submit_review` („Weiterleiten“),
`action.question.forward`, `answers.editor.{label,placeholder,save,hint,sources.label,sources.placeholder,sources.hint}`,
`answers.detail.{label,speaker,unit,returned,loading}`, `answers.refusal.{badge,editorHint}`, `answers.forward.*` (Dialog aus
053), `answers.stale.banner`, `answers.toast.*`, `history.forward.reason.*` (über `forwardReasonLabel`), `time.*`, `toast.*`,
`common.*`. Die Texte darf der Bau glätten; die Zahl ändert er nur mit Begründung im Bericht.

## Nicht-Ziele

- Keine Änderung an `packages/**`, `apps/api/**`, Seed, Rechten, Übergangstabelle, Wahrheitstabelle, Vertrag.
- Keine Zuweisung an eine Person, kein Feld dafür (Eigentümerfrage 1). Keine Bindung über den Seed, keine weitere Bindung als
  die eine aus Entscheidung 2a, keine Änderung an `DEMO_ACTORS`.
- Kein zweiter Weiterleiten-Dialog, keine Änderung an `ForwardDialog.tsx`, `forward.ts`, `useWriteDoor.ts`, `useBacklog.ts`,
  `lib.ts`, `QuestionDetail.tsx`, `AnswerEditor.tsx`, `WorkList.tsx` und an `features/steering/**`.
- Kein Rückgängig nach dem Weiterleiten und kein neuer Übergang dafür: eingeplant als **054c** „Zurückholen nach Weiterleiten“
  (Plan §5, 19.11.2026, Klasse hoch, nach Rechtsblick), Entscheidung **E58** im Register (Eigentümerfrage 4). Bis dahin führt
  der Weg zurück über Zurückgeben durch Recht oder Versammlungsbüro. Strg+Enter löst nie „Weiterleiten“ aus (Eigentümerfrage 3).
- Keine Filter, keine Suche, keine Sortierwahl, kein TOP, keine Uhrzeit der Erfassung.
- Keine Verweigerung vorschlagen, keine Freigabe, keine Rechtsfreigabe, kein Zurückgeben auf dieser Seite (die Beantwortung
  bleibt der Ort; 059 baut die Sicht des Legal Clearing).
- Keine Erwartungskarte, keine Zahlenprüfung, kein Treffer-Kennzeichen (Z2–Z4, E50, E51).
- Kein Blockformat im Editor, keine Werkzeugleiste (055 ersetzt das Textfeld).
- Kein Entwurfspuffer über die Sitzung hinaus, keine Präsenzanzeige (060); der Text lebt nur in der Seite.
- Keine Quelle der Rechtemenge (kein Feld an `/auth/me`, kein Ausblenden in `SideNav.tsx`); keine Änderung an
  `AppShell.tsx`, `ShortcutsDialog.tsx`, `SideNav.tsx`.
- Keine Fensterung der Liste, keine Zeitmessung mit Tor (die Liste ist klein; 084).
- Keine Änderung an bestehenden Szenarien außer der Reihenfolge im Projekt `http`; keine Zusicherung wird geschwächt.
- Keine Politur aus `docs/folgeliste.md`.

## Files allowed

- `apps/web/src/features/focus/Page.tsx` (neu)
- `apps/web/src/features/focus/FocusList.tsx` (neu), `apps/web/src/features/focus/FocusList.test.tsx` (neu)
- `apps/web/src/features/focus/FocusDetail.tsx` (neu), `apps/web/src/features/focus/FocusDetail.test.tsx` (neu)
- `apps/web/src/features/focus/WritingMode.tsx` (neu), `apps/web/src/features/focus/WritingMode.test.tsx` (neu)
- `apps/web/src/features/focus/focus.ts` (neu), `apps/web/src/features/focus/focus.test.ts` (neu)
- `apps/web/src/api/focus054.test.ts` (neu)
- `apps/web/src/api/actor.ts` (nur die neue Liste der Demo-Bindungen mit dem einen Eintrag aus Entscheidung 2a)
- `apps/web/src/api/index.ts` (nur der Bindungsschritt in der Startfunktion der Demo aus Entscheidung 2a)
- `apps/web/e2e/020-rueckbau-passung.spec.ts` (nur die Rolle des Schritts m3, Entscheidung 2a)
- Nachtrag Orchestrator 04.10.2026: `apps/web/e2e/010d-ansichtsdaten.spec.ts` — nur Zeilenwahl im Helfer auf unit-fin (clientseitig, Liste bleibt ungefiltert), weil die Demo-Bindung die Lesbarkeit fremder Einheiten für den Experten entzieht; `apps/web/e2e/020-rueckbau-passung.spec.ts` — zusätzlich `asRole(page,'expert')` vor dem Entwurfsteil.
- `apps/web/src/app/featureRegistry.ts` (nur die Zeile der Fokusansicht, ihr Import, ihr Icon und die Kommentare zum Kürzelbereich)
- `apps/web/src/app/featureRegistry.test.ts` (nur die Erwartungen zur neuen Zeile, zu `requires` und zum Kürzelbereich)
- `apps/web/src/i18n/focus.de.ts` (neu), `apps/web/src/i18n/focus.en.ts` (neu)
- `apps/web/src/i18n/{de,en}.ts` (nur das neue Modul)
- `apps/web/src/i18n/{shell.de,shell.en}.ts` (nur die drei Schlüssel der Fokusansicht)
- `apps/web/src/i18n/parity.test.ts` (nur das neue Modul und 586 → 610)
- `apps/web/e2e/054-fokusansicht.spec.ts` (neu)
- `apps/web/e2e/support/e2e-texts.ts` (nur die Konstanten dieser Scheibe und ihre Einträge in der Liste der geschriebenen Texte)
- `apps/web/playwright.config.ts` (nur die Liste der gemeinsamen Dateien: die neue Datei eintragen)
- `scripts/e2e-http-031.test.mjs` (nur die beiden Dateilisten: die neue Datei zwischen 053 und 080)
- `docs/evidence/054-*.png`
- `docs/glossar.md` (nur die zwei Zeilen aus Entscheidung 8)
- `docs/folgeliste.md` (nur nicht blockierende Befunde des Baus und des Reviews)
- `docs/slices/054-fokusansicht.md` (diese Spec: Bericht, Review findings)

## Ausdrücklich nicht erlaubt

`packages/**` (auch nicht `seed.ts`), `apps/api/**`, `apps/web/src/api/**` außer der neuen Testdatei und den zwei Stellen
aus Entscheidung 2a,
`apps/web/src/components/**` (ein fehlendes Bauteil wird in der Ansicht gebaut oder gemeldet), `apps/web/src/app/**` außer
den zwei Registerdateien, `apps/web/src/features/{answers,steering,capture,stage,history,speakers}/**` (nur Importe daraus),
`apps/web/src/i18n/labels.ts`, fremde e2e-Dateien außer dem einen Schritt in 020 und `apps/web/e2e/support/**` außer `e2e-texts.ts`, `scripts/**` außer dem
Reihenfolge-Pin, `.github/**`, `docs/produktplan-beta.md` (Hinweise an den Orchestrator unten). Dieser Abschnitt steht bewusst
außerhalb von „Files allowed“.
Ausnahme: der Nachtrag des Orchestrators vom 04.10.2026 in „Files allowed“ (010d nur Zeilenwahl im Helfer, 020 zusätzlich
`asRole(page,'expert')` vor dem Entwurfsteil); sonst bleibt jede fremde e2e-Datei unberührt.

## Vor dem Bau prüfen

1. **053 ist gemergt** und der Bau beginnt auf der Integration mit 053: `apps/web/src/features/answers/ForwardDialog.tsx`,
   `apps/web/src/features/answers/forward.ts` (mit `forwardProblemHandler(show, close, gone)` und der Regel „404 schließt nur
   bei `stillShown()`“ aus `af78c0c`), `apps/web/src/features/answers/useWriteDoor.ts`, `mayMoveFocus` in
   `apps/web/src/features/steering/steering.ts`; Paritätstest (f) bei 586; `SHARED_SPECS` und der Reihenfolge-Pin enthalten
   `053-steuerung.spec.ts`. Weicht eine Signatur ab: anhalten und melden, nicht anpassen.
2. **Seed und Bindung, in-process:** mit der Zuordnung aus Entscheidung 2a ergibt `myQuestions` für `u-exp-fin` 7 (alle
   `unit-fin`), ohne sie 40; für jede andere Demo-Person 0. Dann die Bindung allein einbauen und die volle in-process-Suite
   laufen lassen (Regressionsliste in Entscheidung 2a); Ergebnis je Datei im Bericht, rote Fälle vor der Änderung an 020
   wörtlich. Abweichung der Zahlen: Test 12 und F1 anpassen und im Bericht nennen.
3. **Seed, `http`:** nach 002, 021b, 021c, 045 und 053 (`HTTP_ORDER`) in Finanzen mindestens **zwei** `assigned` (F2, F5) und
   mindestens **eine** `answer_drafted` ohne Rückgabegrund und ohne Verweigerung als letzter Version (F4); in Operations
   mindestens eine `assigned` (F7). Prüfen über die Endzustände der Dateikopfe und, wo nötig, eine Probe gegen die lokale
   Datenbank. Fehlt eine Vorbedingung: anhalten und melden.
4. **Historie:** `getQuestionHistory` liefert der gebundenen Fachkraft (in beiden Projekten) das `QuestionForwarded`
   einer in ihren Fachbereich weitergeleiteten Einzelfrage mit `fromUnitId` und `reasonCode` (für `lastForward`). Sonst zeigt
   die Seite keine Weiterleitungszeile, und der Bericht nennt es (F7 dann ohne diesen Schritt, Befund in die Folgeliste).
5. **Konstanten** in der e2e-Datei mit Quelle: `EXPERT_UNIT = 'Finanzen'` / `EXPERT_UNIT_ID = 'unit-fin'`,
   `TARGET_UNIT = 'AR-Büro'` / `TARGET_UNIT_ID = 'unit-ar'` (ohne offene Einzelfrage im Seed; 053 S4 leitet dorthin, niemand
   liest dort weiter), `SOURCE_UNIT = 'Operations'` / `SOURCE_UNIT_ID = 'unit-ops'` (F7). Texte in `e2e-texts.ts`:
   `FOCUS_054_ANSWER`, `FOCUS_054_UNSAVED`, `FOCUS_054_RETURN_REASON`, alle drei in `WRITTEN_TEXTS`. **Keine Konstante heißt
   SECRET, TOKEN, KEY oder PASSWORD** und keine enthält diese Wörter mit einem Literal (Lehre aus 045, gitleaks).
6. **Laufzeit `e2e-http`.** Die Dauer des Schritts „End-to-end http project …“ aus den letzten drei grünen Läufen mit
   ausgeführtem Schritt neu lesen (`gh api repos/ypoxx/hvworkflow/actions/runs/<id>/jobs`, `steps[].started_at` und
   `completed_at`). Stand der Spec: höchstens **5:04** (Befund, mit 053). Schätzung der Mehrzeit dieser Datei: 16
   Rollenwechsel × höchstens 3 s + 6 Schreibschritte × 1 s + Navigation, Historie, axe und vier Screenshots rund 50 s ≈
   **1,7 min**; Ist plus Schätzung ≈ **6,8 min** < 8:00 (Harness) < 9:00 (Schritt). **Liegt Ist plus Schätzung über 8:00,
   anhalten und melden**; der Bau ändert weder Workflow noch Harness. Ist, Schätzung und tatsächliche Dauer stehen im Bericht.
   Hinweis für 055 ff.: Der Abstand zur Grenze schrumpft mit jeder Datei (Hinweise an den Orchestrator).
7. `featureRegistry.test.ts` (auf dem 053-Stand): „each feature with a shortcutKey has a number from 1 to 5“, „The shortcuts
   stay Alt+1…5“ (`[1, 2, 3, 4, 5]`), „returns all routes but steering when granted is an empty set“ und „preserves route
   order“ treffen Annahmen, die die neue Zeile bricht; sie werden auf 1…6, auf `steering` und `focus` bzw. auf eine Menge mit
   `answer.draft` umgestellt, nicht gelöscht. `001-shell.spec.ts` prüft Sichtbarkeit, keine Zahl; 013 bleibt unberührt.

## Tests zuerst (rot, dann grün)

Jeder Test steht vor der Änderung und ist rot (Ausgabe im Bericht), danach grün.

**Unit (Vitest)**

1. `focus.test.ts`, `myQuestions`: nimmt nur `assigned` und `answer_drafted` mit `answer.draft` **und** `question.forward`;
   lässt eine Liste nur mit `answer.draft` (Recht), nur mit `question.forward` (Koordination) und `in_review` mit beiden
   weg; Reihenfolge `createdAt` aufsteigend, Gleichstand nach Nummer; Eingabe unverändert.
2. `focus.test.ts`, `focusActions`: die Fälle aus Entscheidung 3 als `_actions`-Listen, je mit `dirty` und `writing`;
   `'forward'` nie primär außer allein; mit `dirty` weder `'submit'` noch `'forward'`; `'save'` nur mit `writing`,
   `'write'` nur ohne; `question.refuse.propose`, `question.claim`, `question.approve` werden ignoriert; leere Liste →
   nichts; **Statusunabhängigkeit**: dieselbe Liste an Datensätzen in `assigned`, `answer_drafted` und `in_review` ergibt
   dasselbe (mit echten `Question`-Datensätzen, Lehre 053 Review 6).
3. `focus.test.ts`, `nextSelection`: nichts gewählt → erste; vorhanden → bleibt; verschwunden → gleicher Index, sonst letzte;
   leer → `null`. `isSaveChord`: Strg+Enter und Meta+Enter ja; mit Alt oder Shift, ohne Modifikator, während
   `isComposing` nein.
4. `focus.test.ts`, `readingSeconds`/`formatReading`: leer → 0 und „0:00“; 130 Wörter → 60 s; 131 → 61 s; 260 → 120 s
   (nicht über), 261 → über; Mehrfach-Leerraum zählt nicht. `lastForward`: letztes passendes Ereignis gewinnt; Ereignis in
   einen anderen Fachbereich und andere Typen übergangen; ohne `fromUnitId` liefert es `fromUnitId` nicht; leer →
   `undefined`. Entwurfshilfen (`draftBase(question)`, `isDirty(draft)`): Vorbelegung mit der letzten Version, leer bei
   Verweigerung als letzter Version und ohne Version; `dirty` vergleicht getrimmten Text und Quellen.
5. `FocusList.test.tsx` (statisch gerendert): `role="listbox"` mit `aria-activedescendant`; je Zeile die Attribute aus
   Entscheidung 4; Wortlaut mit `line-clamp-2`; Kennzeichen „Zurückgegeben“ nur mit Rückgabegrund; **kein TOP, keine
   Uhrzeit** (kein Text im Muster `\d{2}:\d{2}`), Alter aus `relativeAge`; keine Filter- oder Suchelemente; Zustände laden,
   Fehler, leer (`focus-empty`).
6. `FocusDetail.test.tsx` (statisch): Schaltflächen genau nach `focusActions`, die primäre mit `data-primary="true"`;
   Rückgabegrund mit `role="note"` **vor** dem Wortlaut in der Dokumentreihenfolge; Weiterleitungszeile mit Kurznamen und
   Grundbezeichnung; ein Datensatz mit `refusalJustification` rendert den Begründungstext nicht; mit `dirty`
   `focus-draft-unsaved` und weder `focus-submit` noch `focus-forward`; Wortmeldung als geliefert („Redner 15“).
7. `WritingMode.test.tsx` (statisch): Textfeld vorbelegt mit der letzten Version, leer mit Hinweis
   `answers.refusal.editorHint` bei Verweigerung; `focus-save` mit `aria-disabled="true"` ohne Änderung; Vorlesezeit mit
   `data-seconds`; Tastenhinweis; Aktionsleiste nach `focusActions`; `StaleBanner` mit `focus.write.rebase`, wenn
   `rebase` gesetzt.
8. `focus.test.ts`, Rückfall der Auswahl im Schreibmodus (reine Entscheidung `writingOutcome(prev, next)`, falls der Bau sie
   so schneidet; sonst als Teil von Test 9): Einzelfrage verlässt `mine` mit `dirty` → Ende und Meldung; ohne `dirty` → Ende
   ohne Meldung; neue Version bei unverändertem Text → still umgestellt; bei verändertem Text → `rebase`.
9. Escape-Regel (`focus.test.ts` als reine Hilfe `shouldLeaveWriting({ key, defaultPrevented, dialogOpen })`): nur Escape,
   nicht bei `defaultPrevented`, nicht bei offenem Dialog.
10. `featureRegistry.test.ts`: Zeile `focus` mit `path` `/my`, `requires` `answer.draft`, `shortcutKey` 6, direkt nach
    `answers`, `history` bleibt letzte; Kürzel eindeutig und gleich `[1, 2, 3, 4, 5, 6]`; „number from 1 to 5“ wird „1 to 6“;
    `visibleRoutes(FEATURES, new Set())` enthält weder `steering` noch `focus`, aber alle übrigen; mit `{ 'answer.draft' }`
    enthält es `focus`; ohne Menge alle (Navigation heute unverändert).
11. `parity.test.ts` (f): 610 je Sprache; Modul `focus` mit Präfix `focus`.
12. `apps/web/src/api/focus054.test.ts` (im Ordner `api`, weil nur dort Werte aus `@hv/domain` geladen werden dürfen): sät
    `CORPUS_DEMO` über `seedEvents` in `createInProcessApi` mit injizierter Uhr und wendet `DEMO_BINDINGS` aus `actor.ts` über
    `assignRole` an (wie der Demo-Start) und prüft `myQuestions(listQuestions)` für **jede** Person aus `DEMO_ACTORS` (über
    `id`, nie über die Rolle): `u-exp-fin` genau 7, alle mit `unitId` `unit-fin`, und 35 lesbare Einzelfragen; alle anderen 0
    eigene und 230 lesbare (außer `podium`, das die Liste nicht liest). Kontrolle ohne Bindung: `u-exp-fin` 40 (zeigt, dass die
    Bindung wirkt). Ein zweiter Lauf von `assignRole` antwortet 409 (der Start darf ihn übergehen). Mit `CORPUS_LOAD` (800) nur
    ausgewiesen (Log-Zeile `[size] 054 my questions at 800: n`; auf `5a6f28b` 21 gebunden), nicht hart. Hält den Zuschnitt gegen eine spätere Änderung
    der Bündel fest.

**Playwright, `apps/web/e2e/054-fokusansicht.spec.ts`, Projekte `in-process` und `http`**

**Aufbau und Isolation (wie 045 und 053).**
- `test.describe.serial('054 …')`, `viewport` 1440 × 900. Jeder Test bringt seine Vorbedingung selbst mit; kein Test verlässt
  sich auf den Browser-Zustand eines anderen.
- Eine Hilfe in der Datei: **`waitForMine(page)`** wartet, bis `focus-list` `data-state="ready"` trägt **oder**
  `focus-empty` bzw. `focus-forbidden` sichtbar ist, und zusätzlich, bis **jede** Zeile `data-unit =
  unit-fin` trägt (in beiden Projekten, die Fachkraft ist gebunden) (nach dem Akteurwechsel lädt die Seite neu; die Liste kommt verzögert; Lehre aus 045, CI-Lauf 37152696332,
  und 053 Review 7: auch ohne Serverfilter auf das Eintreffen warten). Erst danach wird eine Zeile gewählt.
- **`findMine(page, opts: { status: 'assigned' | 'answer_drafted'; exclude?: readonly string[] })`**: wechselt per
  `asRole(page, 'expert')`, öffnet `/my`, `waitForMine`, wählt die erste Zeile mit `data-status = status`, `data-unit =
  EXPERT_UNIT_ID` (in beiden Projekten dieselbe Geschichte), ohne `data-returned`, ohne Verweigerungsbadge und nicht in
  `exclude`; Klick; wartet, bis `focus-detail-number` die Nummer zeigt. Liefert Nummer und die Nummer der folgenden Zeile
  (für die nächste Einzelfrage). Nie eine feste Nummer.
- Nach jedem Schreibschritt wartet der Test auf den neuen Datensatz (Statusbadge, Versionstext, Zeile weg) bevor er weitergeht.
- Im Projekt `in-process` beginnt jeder Test mit frischem Demo-Zustand; `--repeat-each=3` ist damit unabhängig.
- Im Projekt `http` bleibt die Datenbank über Dateien hinweg bestehen. **Endzustand nach der Datei**, als Kommentar am
  Dateikopf und im Bericht:
  - F2: eine zuvor `assigned` Einzelfrage in Finanzen ist `answer_drafted` mit einer Version `FOCUS_054_ANSWER`;
  - F4: eine zuvor `answer_drafted` Einzelfrage in Finanzen (ohne Rückgabegrund, ohne Verweigerung) war `in_review` und ist
    nach dem Zurückgeben durch Recht wieder `answer_drafted` mit Rückgabegrund `FOCUS_054_RETURN_REASON`;
  - F5: eine zuvor `assigned` Einzelfrage in Finanzen liegt in „AR-Büro“, Status `assigned`, mit einem `QuestionForwarded`
    (Grund `wrong_unit`);
  - F7: eine zuvor `assigned` Einzelfrage in „Operations“ liegt in Finanzen, Status `assigned`, mit einem
    `QuestionForwarded` (Grund `capacity`);
  - F1, F3, F6, F8 schreiben nichts; die Bühne ist unverändert.
  Folgen für die Nachfolger: `080-sprecher-zustand.spec.ts` berührt nur Wortmeldungen; `abnahme.spec.ts` erfasst, weist zu
  und beantwortet eine eigene Einzelfrage in der Beantwortung und braucht keine bestehende Einzelfrage aus Finanzen, nur den Fachbereich selbst. Die CI startet `e2e-http` mit
  frischer Datenbank.

**Fälle**

- **F1 Liste, Alt+6, Rechte als Daten @screenshot.** `asRole(page, 'expert')` auf `/speakers`, **Alt+6** → URL `/my`,
  Überschrift „Meine Fragen“; `waitForMine`. Jede Zeile `data-status` ∈ {`assigned`, `answer_drafted`}; in beiden Projekten
  jede `data-unit = unit-fin`; in-process genau 7 Zeilen (Test 12), im Projekt `http` mindestens 3. `data-created` nicht fallend
  (Gleichstand nach Nummer). Keine Filterelemente (`answers-filter-*`, `answers-search` fehlen), kein TOP, keine Uhrzeit;
  `focus-row-text` mit berechnetem `-webkit-line-clamp` 2; `focus-row-age` im Muster der `time.*`-Texte. Die erste Zeile ist
  gewählt, das Detail zeigt ihre Nummer. Screenshots `054-fokus-de.png`, `054-fokus-en.png`; axe ohne serious/critical (de,
  en). Schreibt nichts.
- **F2 Doppelklick → Schreibmodus → speichern @screenshot.** `findMine(page, { status: 'assigned' })`; Doppelklick auf die
  Zeile → `focus-writing` sichtbar, `focus-list` nicht im DOM, `focus-editor` hat den Fokus und ist leer; `FOCUS_054_ANSWER`
  tippen → `focus-reading-time` zeigt eine Zeit, `focus-save` ist primär; Screenshot `054-schreibmodus-de.png`; Sprache auf
  en (die Umschaltung der Shell bleibt erreichbar, der Text bleibt) → Screenshot `054-schreibmodus-en.png`; axe (de, en);
  **Strg+Enter** → Toast „Übernommen“; Status „Antwortentwurf“; `focus-save` `aria-disabled="true"`, das Textfeld zeigt den
  gespeicherten Text, `focus-writing-submit` ist da und primär. Escape → Schreibmodus weg, `focus-list` hat den Fokus, ihr
  `aria-activedescendant` zeigt auf die Zeile dieser Nummer; im Detail die letzte Version mit `FOCUS_054_ANSWER`.
- **F3 Tastatur: Enter, Escape, Dialog über dem Schreibmodus (schreibt nichts).** Fachkraft; Alt+6; per Tab zur Liste (Fokus
  sichtbar), Pfeil runter → Detail zeigt die zweite Zeile; Enter → Schreibmodus, Fokus im Textfeld; `FOCUS_054_UNSAVED`
  anhängen; Escape → zurück, Liste hat den Fokus, Detail zeigt `focus-draft-unsaved`, primär ist „Entwurf fortsetzen“,
  `focus-submit` und `focus-forward` fehlen; Enter → Textfeld enthält den Text wieder; den angehängten Text löschen (wieder
  gleich der Basis) → `focus-writing-forward` erscheint; per Tab dorthin, Enter → Dialog; Escape → nur der Dialog schließt,
  `focus-writing` bleibt, Fokus auf `focus-writing-forward`; Escape → Schreibmodus weg. Keine neue Version, Status
  unverändert.
- **F4 Weiterleiten → nächste Einzelfrage; Rückgabegrund prominent.** `findMine(page, { status: 'answer_drafted' })` →
  Nummer N, folgende M; `focus-submit` trägt `data-primary="true"` und heißt „Weiterleiten“; klicken → Toast „Einzelfrage N:
  Weiterleiten“; Zeile N nicht mehr in der Liste; Detail zeigt M (Entscheidung 6); der Fokus liegt im Detail. `asRole(page,
  'legal')`, `/answers`, N über die Suche öffnen, „Zurückgeben“ mit `FOCUS_054_RETURN_REASON`. `asRole(page, 'expert')`, `/my`,
  `waitForMine`: Zeile N mit `focus-row-returned`; wählen → `focus-returned` sichtbar mit `role="note"` und dem Grund, oberhalb
  von `focus-detail-text` (Begrenzungsrechteck).
- **F5 An anderen Fachbereich weiterleiten @screenshot.** `findMine(page, { status: 'assigned' })` → N, M; `focus-forward`
  ist sekundär (ohne `data-primary`), primär ist `focus-write`; öffnen → der Dialog aus 053: Titel „An anderen Fachbereich
  weiterleiten“, `forward-current-unit` „Finanzen“, „Finanzen“ nicht unter den Optionen, kein Ziel und kein Grund gewählt,
  `forward-submit` gesperrt, `forward-readers` sichtbar, kein Textfeld. Screenshot `054-weiterleiten-de.png` (leer, wie 053);
  Escape, Sprache en, erneut öffnen (leer), `TARGET_UNIT` und `forward-reason-wrong_unit` wählen, Screenshot
  `054-weiterleiten-en.png`; axe (de, en); absenden → Toast „Übernommen“, dann:
  Zeile N nicht mehr in der Liste, Detail zeigt M, **kein** Toast „Aktion nicht möglich“ bzw. „Action not possible“ (der 404
  der Detaillesung ist verschluckt, Entscheidung 6); gilt in beiden Projekten.
  Danach `asRole(page, 'coordination')`, Historie von N (Suche nach Nummer): Zeile „An anderen Fachbereich weitergeleitet“ mit
  „Finanzen → AR-Büro“ und „Grund: Falscher Fachbereich“ (die Fachkraft liest N nicht mehr).
- **F6 Lesehinweis, Rechte als Daten (schreibt nichts).** `coordination` auf `/my`: `focus-empty` sichtbar, keine
  `focus-row`; `legal`: ebenso; `podium`: `focus-forbidden` sichtbar, keine Liste. Der Navigationseintrag `nav-focus` ist für
  alle drei sichtbar (Befund; Eigentümerfrage 8): das ist hier Zusicherung, damit eine spätere Quelle der Rechtemenge diesen
  Test bewusst ändert.
- **F7 Zulauf aus der Steuerung: letzter Weiterleitungsgrund.** `coordination` auf `/steering` (053): Statusfilter
  `assigned`, Fachbereichsfilter `SOURCE_UNIT`, warten, bis jede Zeile `data-unit = unit-ops` trägt (Serverfilter), erste Zeile
  N wählen, `steering-forward`, Ziel „Finanzen“, Grund `capacity`, absenden; warten, bis `steering-detail-unit` „Finanzen“
  zeigt. `asRole(page, 'expert')`, `/my`, `waitForMine`: Zeile N mit `data-unit = unit-fin` (neu in der Liste); wählen → `focus-forwarded` nennt „Operations“ und „Auslastung“.
- **F8 Eingaben je Akteur (090, schreibt nichts).** Fachkraft öffnet den Schreibmodus auf einer Zeile und tippt
  `FOCUS_054_UNSAVED`; Wechsel zu `coordination` und zurück: `focus-writing` nicht im DOM; dieselbe Zeile wählen, Schreibmodus
  öffnen → das Textfeld enthält `FOCUS_054_UNSAVED` **nicht** (leer bzw. die letzte Version). Im Projekt `http` fällt der
  Text durch das Neuladen beim Wechsel, in-process durch den Schlüssel (053 Folgeliste, S6); die Zusicherung gilt in beiden.

axe ohne serious/critical auf Seite (F1), Schreibmodus (F2) und Weiterleiten-Dialog (F5), je de und en. Im Projekt `http`
laufen F1–F8 genauso; die Screenshots gehen dort in das Ausgabeverzeichnis (`support/evidence.ts`). Lokal mit
`E2E_HTTP_IDP=none` läuft die Datei nicht (sie braucht Anmeldungen).

## Akzeptanzkriterium

1. Tests 1–12 und F1–F8 vor der Änderung rot (Ausgabe im Bericht), danach grün; F1–F8 im Projekt `in-process` auch mit
   `--repeat-each=3`.
2. Volle Playwright-Suite `in-process` grün (Anzahl nennen), darunter **unverändert** 001, 003, 010b, 010c, 010d, 013, 021b,
   024, 040a, 045, 053, 090 und abnahme, und 020 mit genau der Änderung aus Entscheidung 2a (Ergebnis je Datei im Bericht);
   axe ohne serious/critical. Projekt `http` grün im CI-Lauf `e2e-http` des PR.
   Ausnahme von „unverändert“: 010d und 020 nur im Umfang des Nachtrags des Orchestrators vom 04.10.2026 („Files allowed“).
3. Sechs Screenshots in `docs/evidence/` aus dem Projekt `in-process`: `054-fokus-de.png`, `054-fokus-en.png`,
   `054-schreibmodus-de.png`, `054-schreibmodus-en.png`, `054-weiterleiten-de.png`, `054-weiterleiten-en.png`. Auf dem
   Fokusbild sind die Liste (zweizeiliger Wortlaut, Alter, kein TOP), das Detail mit genau einer primären Aktion und der
   Navigationseintrag lesbar; auf dem Schreibmodusbild Frage oben, großes Textfeld, Vorlesezeit, keine Liste; auf dem
   Dialogbild der Hinweis zum Leserkreis und keine Vorauswahl.
4. Kein Rollenname in einem Vergleich in `apps/web/src` (`pnpm role-literals`); keine Statusabfrage zur Wahl einer Aktion in
   `features/focus/**` (`focusActions` liest nur `_actions`; `FOCUS_STATUSES` nur in `myQuestions`); kein Literal in
   Komponenten (`pnpm i18n-literals`); `pnpm vocabulary` grün; Paritätstest 610.
5. Kein zweiter Weiterleiten-Dialog: `features/focus/**` importiert `ForwardDialog`, `forwardProblemHandler`, `useWriteDoor`
   und `mayMoveFocus` und definiert keine eigene Fassung davon (Review prüft den Diff).
6. `pnpm slice-scope` grün auf dem Branch `claude/slice-054-…`.
7. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Nachweise

- Ausgabe der roten Tests vor der Änderung, Schluss von `pnpm gates`, Playwright-Zahlen, die Log-Zeile aus Test 12.
- `docs/evidence/054-*.png` (sechs Dateien aus `in-process`, Akzeptanzkriterium 3). Das ist der Bildnachweis.
- **Projekt `http`:** der grüne CI-Lauf `e2e-http` des PR mit **Lauf-ID**, Job-ID, Commit und dem **Schluss des Logs**, in dem
  die Zeilen der Fälle F1–F8 aus `054-fokusansicht.spec.ts` stehen; dazu die Dauer des Schritts „End-to-end http project …“
  gegen das Limit 9:00 und die Harness-Grenze 8:00. Kein Artefakt nötig (kein Fall läuft nur gegen Keycloak außerhalb der
  Datei), keine Workflow-Änderung.
- **Laufzeit-Vorprüfung** aus Vor-dem-Bau-Punkt 6 (Ist der drei Läufe, Schätzung, tatsächliche Dauer im PR-Lauf).
- Endzustand im Projekt `http` wie im Dateikopf.
- Design-Kritik D1–D10 als Tabelle im Bericht (je Zeile ja/nein mit einem Satz), gegen die Vorgaben unten.

### Design-Vorgaben D1–D10 (Checkliste `docs/design-prinzipien.md`)

| D | Vorgabe für diese Scheibe | Prüfung |
|---|---|---|
| D1 | In 30 s klar: links „meine“ Einzelfragen, älteste oben, rechts eine Einzelfrage mit Rückgabegrund zuerst und genau einem nächsten Schritt; Titel und ein Satz, keine Erklärtexte über der Liste. | Screenshot, Review |
| D2 | Im Detail und im Schreibmodus höchstens eine primäre Aktion aus `focusActions`; „An anderen Fachbereich weiterleiten“ nie primär, solange es etwas anderes gibt; im Dialog nur Absenden primär. | Test 2, 6, 7; F2, F4, F5 |
| D3 | 8-px-Raster; Zeilen gleicher Höhe (zwei Textzeilen), Kanten von Liste und Detail fluchten; Schreibmodus mit 16–24 px Innenabstand, Textfeld füllt die Höhe ohne Sprung beim Öffnen. | Screenshot |
| D4 | Keine Farbflächen außer der zarten Tönung des Rückgabegrunds und der Badges; Vorlesezeit über zwei Minuten als Text, nicht rot. | Screenshot, Review |
| D5 | Nummern in Mono; Vorlesezeit als „m:ss“; Meldungen im Dialog mit Regel-id (aus 053). | Test 4, 5 |
| D6 | Laden, Fehler und leer der Liste; Hinweis ohne eigene Einzelfragen (`focus-empty`); Lesezustand ohne Recht (`focus-forbidden`); keine Version (`focus.latest.none`). | Test 5; F6 |
| D7 | 24 Schlüssel je Sprache, Hausvokabular („Weiterleiten“ nur für den nächsten Schritt, „An anderen Fachbereich weiterleiten“, „Schreibmodus“, „Vorlesezeit“), kein Rollenname. | Test 11; `pnpm vocabulary`, `pnpm i18n-literals` |
| D8 | Kernszene mit Tastatur: Alt+6, Liste mit Pfeilen, Enter öffnet, Strg+Enter speichert, Escape verlässt mit Fokus auf der Liste, Escape im Dialog schließt nur den Dialog; Fokus sichtbar; Fokus nach Aktion (takt-008). | Test 3, 9; F2, F3, F4 |
| D9 | Was nicht erlaubt ist, fehlt (keine ausgegraute Schaltfläche außer „Entwurf speichern“ ohne Änderung, `aria-disabled`); ungespeicherter Text blendet die Übergaben aus statt sie zu sperren. | Test 2, 6; F3 |
| D10 | Ruhig: keine Filterleiste, keine Kacheln, keine Symbole ohne Bedeutung; der Schreibmodus zeigt nur Frage, Rückgabegrund, Textfeld, Vorlesezeit und die Aktionen. | Screenshot, Design-Kritik |

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: mittel
Ausgelöst: [x] Fachregel, Status (nur Anzeige und vorhandene Übergänge) [ ] Vertrag, Ereignis, Konfiguration [ ] Persistenz,
Migration, Nebenläufigkeit (nur der vorhandene `If-Match` der Schreibtür; fremde Version im Schreibmodus nach Entscheidung 4)
[x] Rolle, Recht, Identität, Schutzklasse (nur verengend: eine Rollenzuordnung der Demo-Fachkraft an Finanzen über
`assignRole`, Entscheidung 2a; sonst nur `_actions` und eine Registerzeile als Daten; kein Recht geändert) [ ]
personenbezogene oder vertrauliche Daten (keine neue Anzeige; Wortmeldung maskiert wie geliefert; Weiterleiten nach 048/053)
[ ] Betrieb, Wiederherstellung [ ] Administration [x] Oberfläche, Barrierefreiheit [ ] Nachbarsystem [ ] KI, Agenten [x]
Dokumentation, Schulung (Glossar)
Perspektive(n): UX, Datenschutz · Nachweise: oben · Offene Entscheidung: E5 (Standard aus 020/048, hier als Z9 gelesen), E58 (Undo → 054c),
E50 und E51 (ohne Wirkung, Standard Nichtbau)

## Wirkung und Risiko

| Risiko | Abwehr | Nachweis |
|---|---|---|
| „Meine Fragen“ zeigt Einzelfragen anderer Fachbereiche | Zuschnitt nur über `_actions` (beide Rechte) und die Einheitsbindung des Dienstes; Demo-Fachkraft gebunden (Entscheidung 2a) | Test 1, 12; F1 (jede Zeile `unit-fin`) |
| Bindung der Demo-Fachkraft bricht bestehende in-process-e2e | Regressionsliste, volle Suite vor und nach der Bindung, kleinste Änderung nur in 020 | Vor-dem-Bau-Punkt 2; Akzeptanzkriterium 2 |
| Ein vor 054 gesäter Browser bleibt ungebunden | Bindungsschritt auch beim Start eines gesäten Speichers, 409 übergangen | Test 12 (zweiter Lauf 409) |
| Recht oder Koordination sehen fremde Arbeit als eigene | beide Rechte nötig; Hinweis statt Liste | Test 1, 12; F6 |
| Ungespeicherter Text geht beim Weiterleiten verloren | Übergaben fehlen mit `dirty`; Escape behält Text | Test 2, 6; F3 |
| Ungespeicherter Text geht durch einen fremden Schreibvorgang verloren | Toast mit Nummer; Entwurfspuffer ist 060 | Test 8; Folgeliste |
| Eigener Text überschreibt still eine fremde neue Version | unveränderter Text wird umgestellt, veränderter zeigt den Hinweis `focus.write.rebase` | Test 7, 8 |
| Strg+Enter gibt versehentlich an Recht | Strg+Enter speichert nur | Test 3; F2 |
| Escape im Dialog verlässt zugleich den Schreibmodus | `defaultPrevented` und offener Dialog werden geprüft | Test 9; F3 |
| Fehler-Toast nach dem Weiterleiten aus dem eigenen Fachbereich (404) | vollständige Liste, `listOmits`; geprüft statt behauptet | F5 (`http`) |
| Zweiter Weiterleiten-Dialog mit abweichender Fehlerbehandlung | Import aus 053, Akzeptanzkriterium 5 | Review |
| Rollen- oder Statuslogik in der Oberfläche | `focusActions` liest nur `_actions`; Rolle nirgends | Test 2; `pnpm role-literals` |
| e2e greift eine Zeile, bevor die Liste angekommen ist | `waitForMine` mit `data-state` und `data-unit` | F1–F8 (Lehre 045, 053 Review 7) |
| e2e hinterlässt im Projekt `http` einen Stand, der Nachfolger stört | Endzustand benannt, Bühne unberührt | Endzustand, Vor-dem-Bau-Punkt 3 |
| `e2e-http` überschreitet die Grenze | Messung vor dem Bau, Halt über 8:00 | Vor-dem-Bau-Punkt 6 |

## Aufwand

Geschätzt **3,7 AStd** (Spanne 3,2–4,3) statt 2 laut Plan. Der Plan rechnete ohne Zielbild-Punkte Z1, Z5, Z9 und mit einem
eigenen Weiterleiten-Dialog; der Dialog kommt aus 053 (−0,4 AStd), dafür kommen Schreibmodus mit Entwurfsregeln, nächste
Einzelfrage, Vorlesezeit, letzte Weiterleitung und der Zuschnittstest dazu:

| Teil | AStd |
|---|---|
| Registerzeile mit Alt+6, Seitenrahmen, Lese- und Hinweiszustand, Shell-Schlüssel, Test 10 | 0,2 |
| Reine Hilfen `myQuestions`, `focusActions`, `nextSelection`, `isSaveChord`, `readingSeconds`, `lastForward`, Entwurfshilfen, Escape-Regel, Tests 1–4, 8, 9 | 0,45 |
| `FocusList` (Listbox, zwei Zeilen, Pfeile, Enter, Doppelklick), Test 5 | 0,3 |
| `FocusDetail` (Rückgabegrund, Weiterleitung, letzte Version, Aktionen), Test 6 | 0,3 |
| `WritingMode` (Textfeld, Strg+Enter, Escape, Vorlesezeit, Hinweis bei fremder Version), Test 7 | 0,4 |
| Seite: Schreibtür, Dialog aus 053, Entwurfsspeicher, nächste Einzelfrage, Fokus nach Aktion, 090 | 0,45 |
| `focus054.test.ts` (Zuschnitt je Demo-Person, gebundene Fachkraft, Größe bei 800) | 0,1 |
| Bindung der Demo-Fachkraft (`DEMO_BINDINGS`, Startschritt), volle in-process-Suite vor und nach der Bindung, Schritt in 020 | 0,3 |
| i18n 24 Schlüssel je Sprache, Modul, Parität, zwei Glossarzeilen | 0,15 |
| e2e F1–F8 in beiden Projekten, Isolation und Endzustand, Einreihung `http`, Reihenfolge-Pin, Texte, Laufzeitprüfung | 0,8 |
| Screenshots, axe, Design-Kritik, `pnpm gates`, Bericht, CI-Nachweis | 0,25 |

053 brauchte für 3,4 geschätzte AStd rund 0,9 (Bericht 053). Die Schätzung bleibt bewusst in den Einheiten des Plans; die
Schwelle für die Rückfallteilung (4,0 AStd) gilt trotzdem.

**Teilung:** keine (3,7, knapp über rund 3,5; Begründung in „Teilung und Zuschnitt“). **Zuschnitt bei Überschreitung (vorbereitet):** 054b nach dem Absatz in „Teilung und
Zuschnitt“, mit eigener Spec `docs/slices/054b-fokus-vorlesezeit.md` vor dem Bau des Rests.

## Standards (auf Standard gebaut)

| Standard | Was 054 baut | Kosten einer späteren Änderung |
|---|---|---|
| „Meine Fragen“ = `assigned`/`answer_drafted` mit `answer.draft` und `question.forward` | `myQuestions` | `in_review` lesend dazunehmen: < 0,1 AStd |
| Demo-Fachkraft `u-exp-fin` an Finanzen gebunden | `DEMO_BINDINGS`, Startschritt | wieder ungebunden für die Breite der Demo: < 0,1 AStd (Eintrag entfernen) plus Rücknahme in 020 |
| Keine Zuweisung an eine Person | nichts | Vertragsfeld, Ereignis, Recht, Anzeige: rund 3 AStd, eigene Scheibe (Eigentümerfrage 1b) |
| „Weiterleiten“ (`question.submit_review`) primär, „An anderen Fachbereich weiterleiten“ zweite Aktion mit dem Dialog aus 053 | `focusActions` | Rangfolge tauschen: < 0,1 AStd |
| Strg+Enter speichert nur | `isSaveChord` | auch Weiterleiten ohne ungespeicherten Text: < 0,1 AStd |
| Schreibmodus füllt den Inhaltsbereich, Shell bleibt | Umschaltung in der Seite | Shell ausblenden oder Fullscreen-API: rund 0,2 AStd, Lane web-shell |
| Schreibmodus vorbelegt mit der letzten Version | `draftBase` | leeres Textfeld wie in der Beantwortung: < 0,1 AStd |
| Ungespeicherter Text blendet die Übergaben aus | `focusActions` | anbieten mit Rückfrage: rund 0,2 AStd |
| Nächste Einzelfrage öffnet automatisch | `nextSelection` | leeres Detail statt nächster: < 0,1 AStd |
| Kein Rückgängig | nichts | 054c (eigener Übergang mit Guard, Klasse hoch): rund 1,25 AStd nach Rechtsblick (E58) |
| Alt+6, Navigationseintrag für alle sichtbar | Registerzeile | Quelle der Rechtemenge: Folgepunkt aus 053 (rund 1,0 AStd mit Vertragsschritt) |

## Offene Eigentümerfragen

Keine blockiert den Bau; alle mit Standard.

1. **Umfang „nur eigene Zuweisungen (Einheit/Person)“.** Standard: Fachbereich über `_actions` (beide Rechte) und die
   Einheitsbindung des Dienstes; die Demo-Fachkraft ist an Finanzen **gebunden** (Entscheidung 2a); keine Person. Option a:
   ungebunden für die Breite der Demo (sie sähe wieder die Arbeit aller Fachbereiche, 40 statt 7; < 0,1 AStd plus Rücknahme in
   020). Option b: Zuweisung an eine Person (Vertragsfeld, Ereignis, Recht, rund 3 AStd, eigene
   Scheibe, nicht in der Freigabe-Demo). Option c: `in_review` lesend in der Liste lassen (< 0,1 AStd).
2. **„Weiterleiten“ nach E5.** Standard: „Weiterleiten“ ist der nächste Schritt und primär; „An anderen Fachbereich
   weiterleiten“ ist die zweite Aktion mit dem Dialog aus 053 (wie Z9 und 048). Option: Weiterleiten an einen anderen
   Fachbereich primär, wie die Planzeile wörtlich liest (< 0,1 AStd). Die Antwort zu E5 im Register bleibt erbeten.
3. **Strg+Enter.** Standard: speichert nur. Option nach Z9: ohne ungespeicherten Text auch „Weiterleiten“ (< 0,1 AStd).
4. **Rückgängig nach dem Weiterleiten (Z9) → Register E58.** Standard: kein Undo in 054; kein Übergang macht
   `question.submit_review` für die Fachkraft rückgängig (`question.return` halten Recht, Freigabe, Versammlungsbüro, Podium
   und Administration). Ein Zurückholen kommt nur mit **054c** nach Rechtsblick (eigene Übergangszeile mit Guard „noch keine
   Rechtsfreigabe“, Klasse hoch, rund 1,25 AStd, Plan §5 19.11.2026); bis dahin geht der Weg zurück über Zurückgeben durch Recht
   oder Versammlungsbüro bzw. eine Weiterleitung durch die Koordination. Fällig 13.11.2026; ohne Antwort wird 054c nicht gebaut.
5. **Nächste Einzelfrage.** Standard: öffnet automatisch, auch wenn ein fremder Schreibvorgang die gewählte entfernt (mit
   Toast nur bei ungespeichertem Text). Option: leeres Detail und Hinweis (< 0,1 AStd).
6. **Vorbelegung des Schreibmodus.** Standard: letzte Version (außer Verweigerung). Option: leer wie die Beantwortung
   (< 0,1 AStd).
7. **Ungespeicherter Text und Übergaben.** Standard: ausgeblendet mit Hinweis. Option: angeboten mit Rückfrage (rund 0,2 AStd).
8. **Navigation.** Standard: `/my` mit Alt+6, für alle Rollen in der Navigation, bis die Quelle der Rechtemenge gebaut ist
   (Folgepunkt aus 053, Eigentümerfrage 3A dort). Option: kein Kürzel (< 0,1 AStd).
9. **Vollbild.** Standard: der Schreibmodus füllt den Inhaltsbereich, Kopfzeile und Navigation bleiben. Option: auch die Shell
   ausblenden oder die Fullscreen-API des Browsers nutzen (rund 0,2 AStd, Lane web-shell).
10. **Risikoklasse.** Standard: mittel wie im Plan. Hochstufen darf der Eigentümer jederzeit; dann kommt ein Lesebefund vor
    dem Bau hinzu (rund 0,3 AStd).

- Entschieden 05.10.2026: Frage 4 (E58): kein Undo nach dem Weiterleiten; 054c entfällt und wird nicht gebaut.
- Entschieden 05.10.2026: Fragen 1 bis 3 und 5 bis 10: Standard wie gebaut angenommen; Frage 2 folgt E5 (Bedeutung wie gebaut, E5 geschlossen); Frage 8: Navigation mit 089b.

## Hinweise an den Orchestrator

- **Plan-Eintrag 054 (§5, Zeile 773–779)** stimmt in mehreren Punkten nicht mit dem Stand überein; nicht Teil dieser Spec:
  - „„Weiterleiten“ als primäre Aktion mit Dialog für Einheit und Grund (Übergang aus 048)“ vermengt die zwei Bedeutungen aus
    E5. Nach Z9 (in derselben Planzeile), Glossar Zeile 50–51 und 048 „Hinweise 054“ ist „Weiterleiten“ der nächste Schritt
    (`question.submit_review`, ohne Dialog); der Dialog für Fachbereich und Grund gehört zu „An anderen Fachbereich
    weiterleiten“ und ist die zweite Aktion. Vorschlag: „„Weiterleiten“ (nächster Schritt) als primäre Aktion; „An anderen
    Fachbereich weiterleiten“ als zweite Aktion mit dem Dialog aus 053“.
  - „nur eigene Zuweisungen (Einheit/Person)“: Eine Zuweisung an eine Person gibt es nicht (kein Vertragsfeld), und der Client
    kennt die Einheit der Person nicht. Vorschlag: „nur Einzelfragen des eigenen Fachbereichs (über `_actions` und die
    Einheitsbindung)“; Person als eigene Frage (Eigentümerfrage 1b).
  - Abhängigkeit **082** ist erfüllt; „Alt+6 über das Feature-Register“ ist baubar, das Ausblenden nach Recht nicht, solange die
    **Quelle der Rechtemenge** fehlt (wie 053; Folgepunkt dort, betrifft auch 059 und 061).
  - Abhängigkeiten „036, 021c, 048, 082“ → „053, 048, 036, 021c, 082“ (053 liefert Dialog, Schreibtür und Fokusregel).
  - „Rückgängig“ aus Z9 braucht einen Übergang, den der Kern nicht hat: mit dieser Nacharbeit als **054c** im Plan (§5, nach
    056, 19.11.2026, Lanes core, web-focus; `plan-graph --strict` grün) und als **E58** im Register eingetragen; die
    „Offene Entscheidung“ von Eintrag 054 verweist darauf. 054c steht noch nicht in der Sammel-Abhängigkeitsliste der Beta
    (Plan Zeile ~954); das bleibt dem Doku-Durchgang.
  - Aufwand 2 → 3,7 AStd; Lanes „web-focus“ → zusätzlich web-shell, web-api (Demo-Bindung und Test), e2e, docs; Nachweise zusätzlich „grüner
    Lauf `e2e-http`“.
  - „TOP und Erfassungszeit ausgeblendet“ und Z1 „Alter in Minuten“ widersprechen sich nur scheinbar; diese Spec zeigt das Alter
    relativ und keine Uhrzeit.
- **Spec 048, Befund Zeile 97** („Im Demo-Rollenwechsel ist `expert` nicht gebunden“) gilt ab 054 nicht mehr; die Demo bindet
  die Fachkraft wie die Harness im Projekt `http`.
- **Plan-Eintrag 048 (Zeile 706):** „Der Dialog „Weiterleiten“ mit Einheit und Grund entsteht in der Fokusansicht (054)“ ist
  überholt; er entstand in 053 (`features/answers/ForwardDialog.tsx`).
- **Laufzeit `e2e-http`:** mit 053 höchstens 5:04, mit 054 geschätzt rund 6,8 min bei 8:00 Harness-Grenze. Ab 055 sollte jede
  Spec mit gemeinsamen Dateien die Grenze ausdrücklich rechnen; eine Anhebung der Grenze oder eine Aufteilung des Jobs ist eine
  eigene Takt-Scheibe (`.github/**`, `scripts/**`).
- Folgeliste (Einträge legt der Bau an): Entwurfstext beim Verlassen von „Meine
  Fragen“ durch fremden Schreibvorgang (060 Entwurfspuffer); Shortcut-Liste kennt Strg+Enter und Escape des Schreibmodus nicht
  (`ShortcutsDialog.tsx`, Lane web-shell).

## Hinweise an Folgescheiben

- **055 (Antwortformat):** ersetzt das Textfeld im `WritingMode` und dessen Vorlesezeit-Grundlage (`readingSeconds` auf der
  Klartextprojektion); Strg+Enter darf mit den Tastenkürzeln des Editors nicht kollidieren.
- **059 (Rechtsfreigabe-Sicht):** kann `FocusList` und den Schreibmodus als Muster nehmen; die Zahlenprüfung (E51) gehört in
  beide Ansichten.
- **060 (Entwurfspuffer und Präsenz):** der Entwurfsspeicher der Seite (ein Platz je Akteur und Einzelfrage) ist die Stelle für
  den Puffer; `focus.write.gone` entfällt dann.
- **046 (Zurückstellen):** als sekundäre Aktion über `focusActions`, sobald Recht und Zeile stehen.
- **047 (Vertraulichkeit):** Badge in `FocusList` und `FocusDetail`.
- **E50/E51:** Erwartungskarte über dem Textfeld des Schreibmodus, Zahlenprüfung als Markierung im Textfeld.
- **Quelle der Rechtemenge:** F6 sichert zu, dass `nav-focus` für alle sichtbar ist; die Scheibe, die die Menge liefert, ändert
  F6 und 053 S5 bewusst.

## Bericht (nach Bau ausfüllen)

```
Slice: 054-fokusansicht
Done: Seite /my „Meine Fragen“ (Alt+6, Registerzeile requires answer.draft) mit Liste, Detail und Schreibmodus;
      Aktionen nur aus _actions (focusActions), Weiterleiten-Dialog, Schreibtür und Fokusregel aus 053 importiert;
      Demo-Fachkraft über DEMO_BINDINGS/assignRole an Finanzen gebunden (Entscheidung 2a).
Evidence: `pnpm gates` grün auf 42ea09c (Schluss unten); docs/evidence/054-*.png (sechs Bilder, in-process);
          Projekt http: CI-Lauf 37225467013 (unten)
Open: Projekt http nur im CI-Lauf e2e-http des PR (lokal ohne Keycloak nicht lauffähig); 010d-Hilfe im Bau ergänzt (unten)
Touched: siehe Liste unten
```

**Vor dem Bau.** (1) 053 gemergt, Signaturen wie im Befund (`ForwardDialog`, `forwardProblemHandler(show, close, gone)`,
`useWriteDoor`, `mayMoveFocus`), Parität 586. (2) Zahlen bestätigt durch Test 12: gebunden 7 (alle `unit-fin`), 35 lesbar;
ohne Bindung 40; jede andere Person 0 eigene. **Abweichung:** die Beobachtung liest 130, nicht 230 (nur Vorgelesenes seit
010); Test 12 nennt das. Bei 800: `[size] 054 my questions at 800: 21`. (3) Projekt `http`, aus den Dateikopfen: nach 045
liegen in Finanzen mindestens zwei `assigned` (vier im Seed, E1 nimmt eine, E3 im ungünstigsten Fall eine zweite) und drei
`answer_drafted` ohne Rückgabegrund; F2 und F5 brauchen zwei `assigned`, F8 findet danach die von F7 zugeleitete; 053 S4
lässt in Operations weitere `assigned` (F7). (4) Die Historie liefert der gebundenen Fachkraft das `QuestionForwarded`
(in-process belegt durch F7). (6) Laufzeit „End-to-end http project“: 37216387775 (`ba23e67`) 5:20, 37214710167 (`2a12e0d`)
5:04, 37215934378 (`5a6f28b`) 4:11; Ist höchstens 5:20, Schätzung +1,7 min ≈ 7:00 < 8:00 (Harness) < 9:00 (Schritt).
In-process dauert die Datei 37 s.

**Bindung allein, volle in-process-Suite** (vor jeder Änderung an 020/010d): rot waren 020 „points 1–9“ (m3:
`answers-filter-status-captured` nicht klickbar, die gebundene Fachkraft liest keine Einzelfrage ohne Fachbereich) und fünf
Fälle in 010d (Zeilen 542, 571, 593, 786, 803: die Rechtsseite wählt die erste Einzelfrage `in_review` über alle Fachbereiche,
die Fachkraft liest sie danach nicht; 786/803 wörtlich „failed: Question fr-0007m does not exist.“). Ein erster Lauf zeigte
weitere rote Fälle (013h, 028, 053 S2b, 090 R1, takt-037); sie kamen von Quelländerungen während des Laufs (Vite lud Module
neu, die Tests patchen `api` über `import('/src/api/index.ts')`) und waren im zweiten Lauf grün; dieselben Dateien auf
`4f37d07` ohne Änderung: 74 grün.
**Änderungen nach Entscheidung 2a:** 020 m3 wechselt zu `approver` und vor der Entwurfshälfte zurück zu `expert` (eine
zusätzliche Zeile `asRole(page, 'expert')`, weil die Entwurfshälfte bisher stillschweigend die Rolle aus m3 weiterverwendete);
010d: die Liste bleibt ungefiltert (vollständig, `poolComplete`); die Hilfen wählen clientseitig Zeilen mit
`data-unit="unit-fin"` (`legalClearableRows`, Dialogfall) und warten, bis der Statusfilter angekommen ist und eine solche Zeile
dasteht (Review-Nacharbeit; die erste Fassung filterte im Dienst). Keine Zusicherung geschwächt. Freigabe beider Dateien über
den Nachtrag des Orchestrators in „Files allowed“.

**Rot vor der Änderung** (neue Tests auf `4f37d07` ohne Umsetzung): Vitest „Test Files 7 failed (7), Tests 4 failed |
13 passed (17)“ (Module `./focus`, `./FocusList`, `./FocusDetail`, `./focus.de` fehlen; Register: „expected 5 to be 6“,
„expected [ 1, 2, 3, 4, 5 ] to deeply equal [ 1, 2, 3, 4, 5, 6 ]“, „expected undefined to be '/my'“). Playwright: F1 rot
(`expect(page).toHaveURL(expected) failed` nach Alt+6); F2–F8 liefen in der Serie danach nicht.
**Grün danach:** Vitest der Scheibe 41 + 4 Fälle; Playwright in-process 157 bestanden (149 vorher + 8), `054` mit
`--repeat-each=3` 24 bestanden; axe ohne serious/critical auf Seite, Schreibmodus und Dialog, je de und en.

**Endzustand im Projekt `http`** wie im Dateikopf von `054-fokusansicht.spec.ts` (F2, F4, F5, F7 schreiben; F1, F3, F6, F8 nicht).

**Design-Kritik D1–D10**

| D | erfüllt | Satz |
|---|---|---|
| D1 | ja | Links die Liste, älteste oben; rechts eine Einzelfrage, Rückgabegrund zuerst, genau ein nächster Schritt (Bild 054-fokus). |
| D2 | ja | `focusActions` liefert höchstens eine primäre; „An anderen Fachbereich weiterleiten“ ist nur allein primär (Test 2, 6, 7). |
| D3 | ja | Zeilen mit zwei Textzeilen gleicher Höhe, Liste und Detail fluchten; Schreibmodus 24/20 px Innenabstand, Textfeld füllt die Höhe. |
| D4 | ja | Farbe nur in Badges und der Tönung des Rückgabegrunds; „Länger als zwei Minuten.“ als Text. |
| D5 | ja | Nummern in Mono, Vorlesezeit „m:ss“, Regel-id im Dialog aus 053. |
| D6 | ja | Laden (Gerüst), Fehler mit „Erneut versuchen“, `focus-empty`, `focus-forbidden`, `focus.latest.none`. |
| D7 | ja | 24 Schlüssel je Sprache, Parität 610; „Weiterleiten“ nur für den nächsten Schritt. |
| D8 | ja | Alt+6, Pfeile, Enter, Strg+Enter, Escape (auch im Dialog nur der Dialog), Fokus nach Aktion (F2–F4). |
| D9 | ja | Nur „Entwurf speichern“ wird gesperrt angezeigt; ungespeicherter Text blendet die Übergaben aus (F3). |
| D10 | ja | Keine Filterleiste, keine Kacheln; der Schreibmodus zeigt Frage, Rückgabegrund, Textfeld, Belege, Vorlesezeit, Aktionen. |

**Touched:** `apps/web/src/features/focus/{Page,FocusList,FocusDetail,WritingMode}.tsx`, `focus.ts` und die vier Testdateien;
`apps/web/src/api/{actor.ts,index.ts,focus054.test.ts}`; `apps/web/src/app/featureRegistry{,.test}.ts`;
`apps/web/src/i18n/{focus.de,focus.en,de,en,shell.de,shell.en,parity.test}.ts`; `apps/web/e2e/054-fokusansicht.spec.ts`,
`apps/web/e2e/020-rueckbau-passung.spec.ts`, `apps/web/e2e/010d-ansichtsdaten.spec.ts`, `apps/web/e2e/support/e2e-texts.ts`,
`apps/web/playwright.config.ts`, `scripts/e2e-http-031.test.mjs`; `docs/evidence/054-*.png`; `docs/glossar.md`,
`docs/folgeliste.md`, diese Spec.

### Schluss von `pnpm gates` (Orchestrator, 04.10.2026)

Lauf auf Commit 42ea09c (letzter Code-Stand dieses PR, nach dem Fokus-Fix unten; spätere Commits nur Doku), mit
Postgres-Testdatenbank, Ausgang 0.
Aus demselben Lauf: `packages/domain` Tests 421 passed, `apps/web` Tests 683 passed, `apps/api` Tests 674 passed,
slice-scope „36 changed file(s), all within … 'Files allowed' list (32 pattern(s))“. Schluss wörtlich:

```
1..318
# tests 318
# suites 0
# pass 318
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15355.545874

> @hv/web@0.0.0 build /home/user/wt/s054/apps/web
> tsc -b && vite build
[… Vite-Ausgabe der Dateigrößen und Warnungen gekürzt …]
✓ built in 1.79s
mark-test-run: wrote /home/user/wt/s054/.claude/state/last-test-run (clean tree) at commit 42ea09c, tree b3478eda6d94…
```

### Nachweis Projekt `http` (Orchestrator, 04.10.2026)

CI-Lauf `e2e-http` auf PR #149, Commit 656b314 (Code-Stand 42ea09c), Lauf-ID 37225467013, Job-ID 111504094239, grün.
Schluss des Logs:

```
✓  48 [http] › e2e/054-fokusansicht.spec.ts:167:3 › 054 Fokusansicht der Beantworter › F1 Liste, Alt+6, Rechte als Daten @screenshot (3.4s)
✓  49 [http] › e2e/054-fokusansicht.spec.ts:237:3 › 054 Fokusansicht der Beantworter › F2 Doppelklick → Schreibmodus → speichern @screenshot (4.0s)
✓  50 [http] › e2e/054-fokusansicht.spec.ts:291:3 › 054 Fokusansicht der Beantworter › F3 Tastatur: Enter, Escape, Dialog über dem Schreibmodus (schreibt nichts) (1.4s)
✓  51 [http] › e2e/054-fokusansicht.spec.ts:342:3 › 054 Fokusansicht der Beantworter › F4 Weiterleiten → nächste Einzelfrage; Rückgabegrund prominent (4.5s)
✓  52 [http] › e2e/054-fokusansicht.spec.ts:384:3 › 054 Fokusansicht der Beantworter › F5 An anderen Fachbereich weiterleiten @screenshot (6.1s)
✓  53 [http] › e2e/054-fokusansicht.spec.ts:446:3 › 054 Fokusansicht der Beantworter › F6 Lesehinweis, Rechte als Daten (schreibt nichts) (2.5s)
✓  54 [http] › e2e/054-fokusansicht.spec.ts:467:3 › 054 Fokusansicht der Beantworter › F7 Zulauf aus der Steuerung: letzter Weiterleitungsgrund (3.9s)
✓  55 [http] › e2e/054-fokusansicht.spec.ts:514:3 › 054 Fokusansicht der Beantworter › F8 Eingaben je Akteur (schreibt nichts) (2.2s)
56 passed (4.1m)
```

Dauer des Schritts „End-to-end http project …“: 18:43:39 bis 18:48:24, rund 4:45 gegen Limit 9:00 und Harness-Grenze 8:00
(Schätzung vor dem Bau 7:00; der frühere Lauf 37223187826 auf 429ab6e dauerte rund 5:30). Artefakt `evidence-031-http`
(ID 11312027170, `sha256:84713b81ab9a5fc99905e6135830358c624d286b786f17a0a74388aee736dbf8`), für diese Scheibe nicht nötig.

Nachtrag Fokus (Orchestrator, 04.10.2026): Der CI-Lauf `e2e-http` auf dem Doku-Commit 37d330a (Lauf 37224478746) war rot in
F4: Nach „Weiterleiten“ blieb der Fokus nicht im Detail. Ursache: Im HTTP-Betrieb kann der Strom die nächste Einzelfrage
liefern, bevor der Schreibaufruf antwortet; `handedOver` scharfte den Fokus danach, und es folgte kein Render mehr. 053 hatte
denselben Fall schon gelöst (Review 053, Minor 3b: `armFocus` ruft `settleFocus` sofort). 42ea09c übernimmt das in
`features/focus/Page.tsx`. Der Lauf auf 429ab6e war grün, weil die Reihenfolge dort günstig war; der neue PR-Lauf auf dem Kopf ist der
Nachweis.

Hinweis: PR #148 (gleicher Inhalt) wurde geschlossen, weil gitleaks `generic-api-key` das JSX-Literal des Speichernamens
in `features/focus/Page.tsx` traf; der Name steht jetzt als Modulkonstante, der Verlauf ist auf einen Commit gekürzt.

## Review findings

Review in frischem Kontext (Opus, schlanker Modus) auf 42b0f61: ein Major, keine Sicherheits-, Rechts- oder
Datenschutzbefunde.

- **Major 1 (behoben):** 010d mit Server-Filter auf unit-fin und eigenmächtig erweiterte Files allowed. Jetzt clientseitige
  Zeilenwahl, Liste ungefiltert; Nachtrag des Orchestrators in Files allowed, „Ausdrücklich nicht erlaubt“ und AK 2.
  Enge Nachprüfung auf 8f1f287: behoben, kein neuer Blocker oder Major (010d, 020, 054 in-process: 38 passed).
- **Minor 2 (bestätigt im Nachtrag):** zusätzliches `asRole(page,'expert')` in 020.
- **Minor 3 (erledigt):** Nachweis `http` oben.
- **Minor 4 (behoben):** F8 bringt seine Vorbedingung selbst mit.
- **Minor 5–8, Nit 9:** in `docs/folgeliste.md` („054 Review 5“ bis „054 Review 8“; 9 stand schon dort).
