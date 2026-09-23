# 010 — Lesepfade unter can() mit Leserechten

**Status:** spec (nachgeschärft nach der Fable-Prüfung vom 23.09.2026: 2 Blocker, 4 major, 8 minor eingearbeitet;
Nachprüfung: 2 weitere Blocker (Kriterium 2, 404-Vorrang für podium) und 2 minor eingearbeitet)
**Risikoklasse:** hoch · 2 AStd · Kalender 06.10.2026 (W2) · Lanes: core, contract, service (`apps/api`), die
Oberflächen-Lanes web-speakers, web-capture, web-answers, web-stage, web-history und e2e (Plan 5.2 nennt nur „core";
die Plan-Zeile berichtigt der Orchestrator)
**Rolle/Modell:** Implementierer-Backend · Sonnet (Auftrag A) und Implementierer-Oberfläche · Sonnet (Auftrag B);
Review Opus 5.5 mit Perspektive Security
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 5, 6, 10, 12; Leitplanken 6.5 (deny by default, Zähler lückenlos, keine
ableitbare ID); R-PERM-01, R-PERM-02, R-PERM-03 (neu)
**Quellen-IDs:** Plan 1 B2; Plan 5.2 Scheibe 010; Audit A1 (Lesepfade); Review 019 Befund 4 (Stammdaten lesen);
Rechtekonzept 2.2 (ein Entscheidungspunkt)
**Depends on:** 019 (gemergt), 012 (gemergt), 016 (gemergt), 020 (gemergt); Auftrag B zusätzlich 013 (hält die
Alt-e2e-Specs und `apps/web/src/features/**`)
**Perspektive:** Security, Datenschutz · **Glossar: neue Begriffe:** nein

## Festlegungen des Architekten (Standard; der Wahrheitstabellen-Diff geht an den Eigentümer)

1. **Stammdaten** (`getMeeting` mit `counts`, `listAgendaItems`, `listUnits`) liest jede angemeldete Rolle. Hier gibt es
   nur die Akteurprüfung (im Dienst 401 ohne gültigen Akteur), keinen `can()`-Aufruf, weil es kein Recht „angemeldet"
   gibt. Ein Test „jede Rolle darf" deckt es ab. 403 bleibt hier für künftige Attributregeln (047) reserviert.
2. **„Vorgelesenes" für den Beobachter** bekommt ein eigenes Recht `question.read.delivered`, weil Rechte Daten sind.
   Welche Stände dieses Recht sehen darf, steht als Daten neben den Rechten, nicht als Statusliteral in `api.ts`
   (Regel 5, Rechtekonzept 2.2): `READ_SCOPES` in `packages/domain/src/permissions.ts`, ein Eintrag
   `question.read.delivered → ['delivered', 'closed']`, mit Regel-ID **R-PERM-03** („Leseumfang") und Test.
   `can(actor, 'question.read', q)` erlaubt, wenn der Akteur `question.read` hält, oder wenn er
   `question.read.delivered` hält und `q.status` im Umfang liegt. Allgemein gilt: `can(actor, p, q)` wendet
   `READ_SCOPES[p]` an, wenn `p` einen Umfang hat. Deshalb erlaubt `can(actor, 'question.read.delivered', q)` nur in
   `delivered` und `closed`, auch für admin.
   - `listQuestions` filtert über `can()`.
   - `total` und die Seitenzählung zählen nur die sichtbaren Fragen.
   - Enthält der Statusfilter ein Element außerhalb des Umfangs (z. B. `?status=answer_drafted`), kommt 403 mit
     `ruleId: 'R-PERM-03'`. Die Vorprüfung vergleicht gegen `READ_SCOPES`, nie gegen eine fest geschriebene Menge.
   - `getQuestion` einer Frage außerhalb des Umfangs liefert 404, wie eine unbekannte ID.
3. **Keine ableitbare ID:** Der 404-Vorrang gilt, wenn der Akteur die Einzelfrage weder lesen darf noch das
   Recht der Operation hält. Dann liefert jede Operation auf dieser Frage 404, bevor ein Recht geprüft wird, auch
   `getQuestionHistory`.
   - Hält der Akteur das Recht der Operation, bleibt die heutige Reihenfolge: 404 für eine unbekannte Frage, dann
     409 für einen unzulässigen Übergang. Beispiel: podium hält `question.deliver`, `question.close` und
     `question.return`, darf die Fragen aber nicht lesen, und muss auf der Bühne weiter schreiben können.
   - Tests zeigen: observer plus Schreibversuch auf eine nicht vorgelesene Frage → 404, nicht 403; podium plus
     `getQuestionHistory` → 404; podium plus `deliverQuestion` auf der Frage auf der Bühne → 200.
4. **Vergabe** (nur in `ROLE_PERMISSIONS`):

   | Leserecht | Methoden | Rollen |
   |---|---|---|
   | — (Akteurprüfung) | `getMeeting`, `listAgendaItems`, `listUnits` | alle |
   | `speaker.read` | `listSpeakers`, `getSpeaker` | moderation, capture, admin |
   | `contribution.read` | `listContributions`, `getContribution` | moderation, capture, admin |
   | `question.read` | `listQuestions`, `getQuestion` | moderation, capture, expert, legal, approver, admin |
   | `question.read.delivered` | `listQuestions`, `getQuestion` (Umfang R-PERM-03) | observer, admin |
   | `stage.read` | `getStage` | moderation, approver, podium, admin |
   | `history.read` | `getQuestionHistory` | moderation, capture, expert, legal, approver, admin |
   | `event.read` | `listEvents`; Nutzdaten in `subscribe` | admin |

   podium verliert `question.read`; laut Plan hält podium nur `stage.read`. observer verliert `question.read`; laut
   Plan sieht observer Zähler und Vorgelesenes. Begründung der Vergaben über den Wortlaut von Plan 5.2 hinaus (die
   Liste geht mit dem Diff an den Eigentümer):
   - **moderation `speaker.read`:** Die Moderation führt die Wortmeldeliste (hält `speaker.register`/`reorder`/`update`).
   - **moderation `contribution.read`:** Die Moderation sieht, welche Wortmeldung als Redebeitrag erfasst ist
     (Ist-Analyse, Wortmeldeliste → Redebeitrag).
   - **moderation `stage.read`:** Die Moderation hält `question.stage` und muss sehen, was auf der Bühne liegt.
   - **capture `question.read`:** Die Erfassung zerlegt Redebeiträge in Einzelfragen und klassifiziert sie (hält
     `question.capture`/`classify`).
   - **approver `stage.read`:** Die Freigabe hält `question.stage`.
   - **`history.read` für moderation, capture, expert, legal, approver:** Wer eine Einzelfrage lesen darf, darf
     nachvollziehen, wie sie entstanden ist (Plan 3, Nachvollziehbarkeit). Die personenbezogene Historie kommt erst
     mit 047 (`event.read.personal`).
5. **`subscribe`** (die 13. Lesemethode, nur im Kern; der Dienst hat keine Route dafür) liefert Ereignisse mit
   Nutzdaten nur an Inhaber von `event.read`. Alle anderen erhalten bei jedem Anhängen `[]` als Änderungssignal; die
   Oberfläche nutzt nur das Signal (`api/useApiVersion.ts`). Das Recht wird je Zustellung am aktuellen Akteur geprüft,
   weil der Rollenumschalter der Demo den Akteur zur Laufzeit wechselt.
6. **Welches Leserecht zu einer Methode gehört und welche Regel-ID eine Verweigerung trägt, steht als Daten**:
   `READ_PERMISSIONS` in `packages/domain/src/types.ts` und eine Zuordnung Recht → Verweigerungsregel. Es gibt keine
   Namensprüfung wie `.endsWith('.read')`. Schreibrecht fehlt → R-PERM-01, Leserecht fehlt → R-PERM-02, Leseumfang
   überschritten → R-PERM-03.
7. **Vertragsversion 0.2.1, nicht 0.3.0:** 0.3.0 ist das Vertragspaket 023 (Plan 5.4). Ein additiver Enum-Wert und
   die Dokumentation von R-PERM-03 innerhalb des 0.2-Zyklus sind eine Patch-Stufe, wie 0.3.1 in 028. Der
   CHANGELOG-Abschnitt 0.2.1 nennt diese Konvention in einem Satz. Die Zeile in ADR 0015 trägt der Orchestrator nach.
   023 kann nicht vorher landen, weil die Lane contract seriell ist.

## Ziel

1. **Vertrag zuerst (Regel 6):**
   - `openapi.yaml`: Action-Enum um `question.read.delivered` (Beschreibung wie Festlegung 2); in der Beschreibung von
     `Problem.ruleId` und der 403-Antwort R-PERM-03.
   - `info.version` und `packages/contract/package.json` auf 0.2.1; CHANGELOG-Abschnitt 0.2.1.
   - `pnpm contract:types` ausführen. Das Vertragstor ist grün.
2. **Kern:**
   - `PERMISSIONS` und `READ_PERMISSIONS` in `types.ts`.
   - `ROLE_PERMISSIONS` und `READ_SCOPES` nach den Festlegungen 2, 4 und 6.
   - Alle 13 Lesemethoden in `api.ts` prüfen über `can()` und liefern bei Verweigerung
     `ApiProblem(403, …, ruleId)`.
   - Der 404-Vorrang nach Festlegung 3.
   - Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (Tor `role-literals`). Kein Statusliteral in `api.ts`.
   - `_actions` behält seine Form; der Inhalt ändert sich für podium und observer.
3. **Wahrheitstabelle:** `packages/domain/policy-truth-table.md` wird neu generiert. Die bestehende Tabelle
   „Role × Status × Action" bekommt die neue Spalte `q.read.delivered`, weil der Test Spalten aus jedem
   `question.*`-Recht bildet. Dazu kommt eine zweite, generierte Tabelle „Rolle × Leserecht" aus demselben Test.
4. **Dienst:** `apps/api` liefert für jede verweigerte Leseoperation 403 als Problem mit der Regel-ID aus Festlegung 6
   und bei Festlegung 3 404. Die Antwortschema-Validierung aus 012 bleibt grün. `/events` liefert 403 für jede Rolle
   ohne `event.read`.
5. **Alt-e2e und 020-e2e** (Auftrag B, nach 013; die Rollen wechseln, die Absicht jedes Schritts bleibt):
   - `003-answers-stage.spec.ts` (Schritte ab Historie, heute podium): Zeitleiste unter moderation, Ereignisstrom-Reiter
     unter admin.
   - `abnahme.spec.ts` (podium → Historie der vorgelesenen Frage): Historie unter moderation. **Das ändert einen
     Schritt des Abnahmesatzes der Projektleitung.** Der Bericht zeigt den Satz vorher und nachher; der Orchestrator
     legt ihn dem Eigentümer vor.
   - `020-rueckbau-passung.spec.ts`:
     - expert auf `/speakers` → capture (Lesehinweis ohne Schreibrecht).
     - expert auf `/capture` → moderation.
     - observer mit Filter `status=assigned` → expert auf einer Frage im Stand `captured`.
     - expert auf `/stage` → approver.
   - `001-shell.spec.ts`: Wenn die Startroute unter der dort gewählten Rolle eine verweigerte Hauptabfrage stellt,
     zeigt sie den gestalteten Zustand aus Ziel 6. Der Test prüft das oder wechselt die Rolle; begründet im Bericht.
   - Weitere Brüche, die der Lauf zeigt, werden ebenso gelöst und einzeln im Bericht begründet.
6. **Oberfläche (Auftrag B, nur Ladepfade):**
   - **Gestalteter Zustand statt Fehlermeldung:** Jede Ansicht rendert bei 403 auf ihrer Hauptabfrage den Zustand
     „In dieser Rolle keine Leseberechtigung für diese Ansicht" (i18n im Feature-Modul, DE und en-US, Hausvokabular).
   - **Hauptabfrage je Ansicht:** Wortmeldeliste `listSpeakers`, Erfassung `listContributions`, Beantwortung
     `listQuestions`, Bühne `getStage`, Historie `listQuestions`.
   - **Nebenabfragen:** Eine verweigerte Nebenabfrage (z. B. `listSpeakers` für Namen in der Historie unter expert)
     lässt die Ansicht mit weniger Daten stehen. Dafür wird in `features/history/Page.tsx` das gemeinsame
     `Promise.all` getrennt.
   - **Historie unter observer:** Die Trefferliste zeigt nur Vorgelesenes. Zeitleiste und Ereignisstrom-Reiter zeigen
     den Zustand „keine Leseberechtigung".
   - Keine neue Route, keine Navigation nach Rechten (082).
7. **Tests:**
   - **Domäne:** je Leserecht ein Positiv- und ein Negativtest. Zusätzlich:
     - observer 403 R-PERM-03 auf `listQuestions({status:'answer_drafted'})`.
     - observer sieht in `listQuestions()` nur `delivered`/`closed`, und `total` stimmt.
     - observer `getQuestion` auf eine nicht vorgelesene Frage → 404.
     - observer Schreibversuch darauf → 404.
     - podium 403 auf `listEvents`; podium 404 auf `getQuestionHistory` (Festlegung 3); observer 403 R-PERM-02 auf
       `getQuestionHistory` einer vorgelesenen Frage.
     - expert 403 auf `listSpeakers`.
     - `subscribe` liefert observer `[]` und admin die Ereignisse.
     - Rollenwechsel zwischen zwei Zustellungen.
   - **Bestehende Domänentests** anpassen, die heute auf alten Vergaben beruhen (`api.test.ts`: podium
     `getQuestionHistory`, `_actions` gleich `['question.read']`, observer `firstIn('captured')`, `listEvents` unter
     einem verbliebenen Akteur). Dazu der HTTP-Test `apps/api/src/__tests__/negative.test.ts`: observer
     klassifiziert eine erfasste Frage, heute 403 R-PERM-01, künftig 404. Jede Anpassung wird im Bericht genannt.
   - **HTTP-Tests** für dieselben Fälle mit `ruleId` (ohne `subscribe`).
   - **e2e** `apps/web/e2e/010-lesepfade.spec.ts`:
     - Historie unter observer: nur Vorgelesenes, Zeitleiste im Zustand „keine Leseberechtigung".
     - Beantwortung unter observer zeigt nur vorgelesene Fragen.
     - Bühne unter expert zeigt den Zustand „keine Leseberechtigung".

## Nicht-Ziele

- Keine Attributfilter (Einheit, Bühnenplatz, Vertraulichkeit, Feedback-Frage 8) — 047.
- Keine Koordinationsrolle, kein `question.legal.clear` (021); keine Navigation nach Rechten (082).
- Keine Änderung an Übergängen oder Schreibrechten.
- Keine Änderung an `docs/rollen-und-rechtekonzept.md`, der DSFA oder ADR 0015 (Nachführung durch den Orchestrator).

## Files allowed

- `packages/contract/openapi.yaml`, `packages/contract/package.json`, `packages/contract/CHANGELOG.md`,
  `packages/contract/src/types.ts`
- `packages/domain/src/types.ts`, `packages/domain/src/permissions.ts`, `packages/domain/src/api.ts`,
  `packages/domain/src/index.ts`, `packages/domain/src/__tests__/**`, `packages/domain/policy-truth-table.md`
- `apps/api/src/**`
- `apps/web/src/features/speakers/**`, `apps/web/src/features/capture/**`, `apps/web/src/features/answers/**`,
  `apps/web/src/features/stage/**`, `apps/web/src/features/history/**` (nur Ladepfade und der gestaltete Zustand)
- `apps/web/src/i18n/speakers.de.ts`, `apps/web/src/i18n/speakers.en.ts`, `apps/web/src/i18n/capture.de.ts`,
  `apps/web/src/i18n/capture.en.ts`, `apps/web/src/i18n/answers.de.ts`, `apps/web/src/i18n/answers.en.ts`,
  `apps/web/src/i18n/stage.de.ts`, `apps/web/src/i18n/stage.en.ts`, `apps/web/src/i18n/history.de.ts`,
  `apps/web/src/i18n/history.en.ts`, `apps/web/src/i18n/parity.test.ts` (nur Schlüsselzahl)
- `apps/web/src/i18n/labels.ts`, `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts` (nur die
  `action.*`-Einträge der sechs neuen Leserechte — Auftrag A, sonst bricht `ACTION_KEYS`, eine erschöpfende
  `Record<Permission, TKey>`, den Typecheck von `apps/web`; im Bericht A begründet)
- `scripts/role-literal-check.test.mjs` (nur die Fixture-Zeichenkette des Tests „Role union /
  ROLE_PERMISSIONS key mismatch" — Auftrag A, sie zitiert die alte `observer`-Zeile wörtlich und bricht mit
  Festlegung 4; im Bericht A begründet)
- `apps/web/e2e/010-lesepfade.spec.ts` (neu), `apps/web/e2e/001-shell.spec.ts`,
  `apps/web/e2e/003-answers-stage.spec.ts`, `apps/web/e2e/abnahme.spec.ts`,
  `apps/web/e2e/020-rueckbau-passung.spec.ts` (nur Rollenwechsel nach Ziel 5)
- `docs/evidence/010-*.png` (neu)
- `docs/slices/010-lesepfade-leserechte.md` (Bericht)

## Akzeptanzkriterium

1. Jede der 13 Lesemethoden hat einen Negativtest mit ihrer Regel-ID oder, nach Festlegung 3, mit 404. Die
   Stammdaten haben stattdessen einen Test „jede Rolle darf".
2. **Wahrheitstabellen-Diff:**
   - (a) Spalte `q.read`: podium `·` in jeder Zeile; observer ✓ nur in `delivered` und `closed`, sonst `·`.
   - (b) Neue Spalte `q.read.delivered`: admin und observer ✓ nur in `delivered` und `closed`; alle anderen Rollen
     `·`.
   - (c) Die neue Tabelle „Rolle × Leserecht" entspricht genau Festlegung 4.
   - (d) Keine andere Zelle ändert sich.
3. Vertragstor, `role-literals`, `now-check`, `plan-honesty`, `arch`, `slice-scope` grün; `pnpm gates` grün. Alle
   Playwright-Szenarien grün: die vier Alt-Specs, 013, 020, 082-Kürzel und 010.
4. Screenshots DE/EN:
   - Historie unter observer: nur Vorgelesenes, Zeitleiste ohne Leseberechtigung.
   - Beantwortung unter observer: nur Vorgelesenes.
   - Bühne unter expert: keine Leseberechtigung.
5. Der Abnahmesatz vorher und nachher steht im Bericht.

## Nachweise

`pnpm gates`-Ende; Vertragstor-Ausgabe; Wahrheitstabellen-Diff; Testnamen der Negativtests; Liste der angepassten
Bestandstests mit Grund; Playwright-Zusammenfassung; Screenshots.

## Arbeitsweise

- Worktree `/home/user/wt/010`, Branch `claude/slice-010-lesepfade`. Absolute Pfade. Playwright mit eigenem Port
  (`E2E_PORT=43xx`), Chromium unter `/opt/pw-browsers`.
- **Zwei Bauaufträge auf demselben Branch, ein Merge** (Lehre aus 020: ein Auftrag über alle Lanes überschreitet das
  Tokenbudget):
  - **Auftrag A** (Implementierer-Backend · Sonnet): Ziele 1–4 und die Domänen- und HTTP-Teile von Ziel 7.
    - Startet sofort.
    - Endet mit grünem `pnpm gates`.
    - Playwright läuft danach absichtlich teilweise rot; der Bericht A listet die roten Schritte.
  - **Auftrag B** (Implementierer-Oberfläche · Sonnet): Ziele 5 und 6 und der e2e-Teil von Ziel 7.
    - Startet erst, wenn 013 gemergt ist; der Integrationsbranch wird zuerst eingemergt.
    - Endet mit grünem `pnpm gates` und allen Playwright-Szenarien grün.
  - Ein PR und ein Merge nach dem Review.
- Kleine Commits. Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`. Nicht pushen.
- Playwright-Bilder unter `docs/evidence/` außer `010-*` nicht committen.

## Bericht

(von den Implementierern, getrennt nach Auftrag A und B)

## Review findings

(vom Reviewer)
