# 021c — Rechtsfreigabe und Rechtstor vor der Bühne R-GUARD-07

**Status:** review (26.09.; unabhängiger Befund nachgearbeitet, PR-CI und Abnahme offen)
**Risikoklasse:** hoch (Recht, Rechte, Vertrag) · 2 AStd · 09.10.2026 (W2, vorgezogen) · Lanes: contract, core, service, web-answers, e2e
**Rolle:** Implementierer-Backend (Vertrag nach Festlegung, Kern, Dienst, Seed) und Oberfläche (eine Aktion) in einem Bau; Review in frischem Kontext, Perspektive Legal/Security (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 5, 6, 7, 10, 12; R-TRANS-07, R-TRANS-08, R-TRANS-13 (neu), R-GUARD-06, R-GUARD-07 (neu)
**Quellen-IDs:** `docs/produktplan-beta.md` Abschnitt 5, Eintrag 021c, und Abschnitt 3 (Letztverantwortung und Rechtstor);
Vertrag 0.2.0 (`question.legal.clear`, `QuestionLegalCleared`); Zielpfad Beta-2 (Abschnitt 11)
**Depends on:** 021a (`b4fb7d7`), 021b (`80a918d`)
**Perspektive:** Legal/Security · **Glossar: neue Begriffe:** nein (Rechtsfreigabe steht im Plan 018)
**Offene Entscheidungen, auf Standard gebaut:** E25 Letztverantwortung bei `approver`; E37 Freigabetiefe: Rechtstor auf
allen drei Pfaden.
**Bedrohungs-IDs:** MF-07 (Selbstfreigabe: der Guard R-GUARD-06 gilt auch für die Rechtsfreigabe); kein neuer Missbrauchsfall,
weil `legal` ein Recht verliert (approve) und ein engeres gewinnt.

## Festlegung des Architekten

Gelesen: Der Vertrag kennt seit 0.2.0 die Aktion `question.legal.clear` und das Ereignis `QuestionLegalCleared`
(Payload `questionId`, `answerVersion` Pflicht ≥ 1, `note`), aber **keine Operation**. Die Domäne kennt beides nicht.
`legal` hält heute `answer.draft` und `question.approve`. Der Seed lässt `legal` freigeben. Die Oberfläche zeigt die
Freigabe über `may.includes('question.approve')` in `features/answers/QuestionDetail.tsx`. Acht e2e-Dateien berühren die
Freigabe.

1. **Vertrag 0.3.1 (additiv, ADR 0015 Patch-Stufe).** Neue Operation `clearQuestionLegally`,
   `POST /questions/{questionId}/legal-clearances`, Body `LegalClearanceRequest { answerVersion?: integer ≥ 1, note?: string }`,
   Antwort `Question`, Fehler 403/404/409/412/422 wie `approveQuestion`, If-Match und Idempotency-Key wie dort.
   `QuestionLegalClearedPayload.answerVersion` wird **optional** (Podiumspfad hat keine Antwortversion; bei Pfaden mit
   Antwort setzt der Kern es immer). `Question` erhält `legalClearance?: { answerVersion?: integer, clearedAt, clearedBy }`.
   **Die bisher für 028 vorgesehene Stufe „Pflicht ab 0.3.1“ rückt auf 0.3.2:** alle Vorkommen in `openapi.yaml`, im
   CHANGELOG-Vorblick und in den Einträgen 023/028 des Plans werden auf 0.3.2 umgestellt (zeilengenau, nicht per globalem
   `sed` über fremde Dateien). CHANGELOG-Abschnitt `## [0.3.1] - 2026-09-26`. `pnpm contract:types` neu.
2. **Recht als Daten.** `question.legal.clear` in `PERMISSIONS`; `legal` erhält es und **verliert** `question.approve`,
   behält `answer.draft`, `question.return`; `approver` bleibt unverändert (E25). `admin` hält alles.
3. **R-TRANS-13 „Rechtsfreigabe“** als Zeile der Tabelle ohne Statuswechsel (Aktion `question.legal.clear`, `from`/`to`
   gleich): aus `in_review` bindet sie an die **letzte** Antwortversion (Guards R-GUARD-01 hasAnswer, R-GUARD-06 „Ersteller
   ≠ Freigeber“ wiederverwendet); aus `classified` nur auf dem Podiumspfad (R-GUARD-02), ohne Version. Eine neue
   Antwortversion hebt die Rechtsfreigabe auf (Projektion), wie bei der Freigabe.
4. **R-GUARD-07 „Rechtsfreigabe liegt vor“** auf R-TRANS-07 und R-TRANS-08, Geltungsbereich aus
   `LEGAL_GATE_BY_TRACK` in `transitions.ts` (eingefrorenes Objekt, Standard alle drei Pfade `true`). Pfade mit Antwort:
   Freigabe der **freigegebenen** Version (`legalClearance.answerVersion === approval.answerVersion`). Podiumspfad:
   Rechtsfreigabe vorhanden. Kein Schalter, keine Umgebungsvariable, keine Rolle umgeht ihn; kein Eilpfad.
5. **Dienst:** Route und Validierung aus dem Vertrag, `HvApi.clearQuestionLegally`.
6. **Seed:** Für jede Frage, die im Seed `approved` oder weiter ist, schreibt der Seed vor dem Staging ein
   `QuestionLegalCleared` durch `legal`; die Freigabe (`QuestionApproved`) schreibt `approver` statt `legal`; Podiumsfragen
   ab `staged` erhalten die Rechtsfreigabe ohne Version. **Keine zusätzlichen Zufallszüge.** Der Fingerabdruck in
   `seed-fictitious-names.test.ts` wird neu gesetzt; Nachweis im Bericht: der neue Seed ohne `QuestionLegalCleared`-
   Ereignisse und mit `legal` statt `approver` bei `QuestionApproved` ist bytegleich zum alten (Methode wie in 080).
7. **Oberfläche:** In `QuestionDetail.tsx` eine Aktion „Rechtlich freigeben“ / „Legal clearance“ aus `_actions`
   (`question.legal.clear`), mit derselben Mechanik wie „Freigeben“ (Version, If-Match, Fokus nach Aktion, takt-008);
   Anzeige „rechtlich freigegeben (Version n)“ in der Detailansicht. i18n DE/EN (Schlüsselzahl im Paritätstest nennen).
8. **Wahrheitstabelle** (`packages/domain/policy-truth-table.md`) und `docs/legal-trace.md` nur über Snapshot-Tests neu; der
   Diff (legal verliert approve, gewinnt legal.clear; R-TRANS-13, R-GUARD-07) ist hiermit freigegeben.

**Nachtrag des Architekten (26.09., nach Rückfrage des Implementierers):**
(a) Zwei Zeilen statt einer: **R-TRANS-13** Rechtsfreigabe aus `in_review` (Guards R-GUARD-01, R-GUARD-06, bindet an die
letzte Version) und **R-TRANS-14** Rechtsfreigabe aus `classified` nur auf dem Podiumspfad (Guard R-GUARD-02, ohne
Version). Keine Strukturänderung am Tabellentyp. (b) Seed: wo `legal` selbst entworfen hat (Einheit `unit-legal`),
gibt eine zweite Persona `SEED_ACTORS.legal2` (`u-legal-2`, „Legal Clearing 2“) rechtlich frei; sonst `legal`. Die
Entwürfe bleiben unverändert (Bytegleichheit). (c) Ereignis-id der Rechtsfreigabe im Seed außerhalb des gemeinsamen
Zählers (z. B. `ev-<frage>-lc`), Zeitstempel ohne `tick()` (Zeit des vorigen Ereignisses) — angenommen. (d) 0.3.1 →
0.3.2 auch in `CHANGELOG.md:278` und in der Risikotabelle `docs/produktplan-beta.md` (Zeile „plus 0.3.1 in 028“).
(e) Rückgabe nach `classified` hebt die Rechtsfreigabe auf wie die Freigabe — angenommen. (f) Die Historie darf die
neue Ereignisart mit Version zeigen: `apps/web/src/features/history/eventSummary.ts` und `apps/web/src/i18n/history.{de,en}.ts`
sind erlaubt.

## Ziel und Tests (zuerst, rot vor der Änderung)

- stage ohne Rechtsfreigabe → 409 R-GUARD-07 für **jeden** der drei Pfade; mit Rechtsfreigabe der freigegebenen Version
  erlaubt; Rechtsfreigabe einer älteren Version → 409 R-GUARD-07;
- neue Antwortversion nach der Rechtsfreigabe → Freigabe erlischt;
- legal gibt eine selbst entworfene Version rechtlich frei → 409 R-GUARD-06;
- legal versucht `question.approve` → 403; approver gibt frei → erlaubt;
- `LEGAL_GATE_BY_TRACK` ist eingefroren und alle drei Pfade sind `true` (Test „keine Konfiguration schaltet den Guard ab“);
- `_actions`: legal sieht `question.legal.clear`, nicht `question.approve`;
- HTTP: `POST /questions/{id}/legal-clearances` 200, 403 (expert), 409 R-GUARD-07 beim Staging ohne Rechtsfreigabe.
- e2e: Szenarien, in denen `legal` freigibt, wechseln auf „legal gibt rechtlich frei, approver gibt frei“; Prüfziel bleibt,
  keine Zusicherung wird geschwächt; neue e2e `apps/web/e2e/021c-rechtsfreigabe.spec.ts` mit Screenshots DE/EN.
- `docs/erste-version-und-offene-fragen.md`: Abnahmesatz um „Recht gibt rechtlich frei“ ergänzt; abnahme.spec.ts folgt.

## Nicht-Ziele

Rechtsfreigabe-Sicht (059), Prüflistentiefe je Pfad (E37 bleibt Standard), Verweigerung (044), Freigabevermerk, Versiegelung,
Änderung der Bühnenansicht außer dem, was die Seed-Änderung ohnehin zeigt.

## Files allowed (ursprüngliche Scheibe; historischer Umfang)

- `packages/contract/{openapi.yaml,CHANGELOG.md,package.json,allowlist.json}`, `packages/contract/src/types.ts` (generiert)
- `packages/domain/src/**`, `packages/domain/policy-truth-table.md` (generiert)
- `apps/api/src/app.ts`, `apps/api/src/__tests__/*.test.ts`, `apps/api/src/__tests__/helpers.ts`
- `apps/web/src/features/answers/**`, `apps/web/src/i18n/{answers.de,answers.en,shell.de,shell.en,history.de,history.en,parity.test,labels}.ts`, `apps/web/src/features/history/eventSummary.ts`
- `apps/web/e2e/*.spec.ts`, `apps/web/e2e/021c-rechtsfreigabe.spec.ts` (neu), `docs/evidence/021c-*.png`
- `docs/legal-trace.md` (generiert), `docs/erste-version-und-offene-fragen.md` (nur Abnahmesatz)
- `docs/produktplan-beta.md` (nur Einträge 023, 028, 021c und die Risikotabelle: 0.3.1 → 0.3.2), `docs/slices/021c-rechtsfreigabe-rechtstor.md`

## Akzeptanzkriterium

1. Die Tests oben vor der Änderung rot (Ausgabe im Bericht), danach grün; Seed-Bytegleichheit wie in Festlegung 6 belegt.
2. `pnpm contract:types` ohne Rest-Diff; Vertrags-Tor grün (0.3.1, CHANGELOG).
3. Volle e2e-Suite grün (Anzahl nennen), axe ohne serious/critical; Screenshots DE/EN.
4. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/s021c`, Branch `claude/slice-021c-rechtstor` (vom Architekten angelegt).
- Playwright auf Port 5196, Chromium unter `/opt/pw-browsers`; danach fremde Evidenz mit `git checkout -- docs/evidence`.
- Logs nur über `mktemp`. Commits nennen „Scheibe 021c“ und enden mit `[skip netlify]`. Nicht pushen.
- Wird der Bau größer als erwartet: nach Kern, Vertrag, Dienst und Seed einen Zwischenstand committen und melden, bevor
  Web und e2e folgen. Stößt eine Änderung auf eine Datei außerhalb von Files allowed oder eine nicht genannte feste Zahl:
  anhalten und melden.

## Bericht

```
Slice: 021c-rechtsfreigabe-rechtstor
Done: Rechtsfreigabe auf allen drei Pfaden und Rechtstor vor der Bühne umgesetzt; Version und Vier-Augen-Regeln mit
      Domänen-, Dienst-, Web- und e2e-Tests belegt. Der unabhängige Review-Befund zum Versionskonflikt ist durch
      einen gezielten Guard-Test ergänzt (Commit 3251e68; Draft-PR #45).
Evidence: pnpm gates auf Commit 3251e68 grün (Schluss wörtlich unten); volle Chromium-E2E-Suite 119/119 grün,
      axe ohne serious/critical. Screenshots: docs/evidence/021c-rechtsfreigabe-de.png und
      docs/evidence/021c-rechtsfreigabe-en.png.
Open: PR-CI auf dem letzten Commit und Abnahme durch den Eigentümer stehen aus. Kein Deploy.
Touched: siehe Diff 1b2e402..3251e68; Nacharbeit nur packages/domain/src/__tests__/transitions.test.ts und diese Spec.
```

Wörtlicher Schluss von `pnpm gates` (Node 24, Commit `3251e68`):

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 401ms
mark-test-run: wrote /Users/alex/Documents/Codex/2026-09-26/prior-conversation-with-codex-conversation-role/work/hvworkflow/.claude/state/last-test-run (clean tree) at commit 3251e68, tree f0a2fb316ce9…
```

## Review findings

- Unabhängiges Review 26.09.: Kein bestätigter Produktionsfehler. P3-Testlücke: Eine alte Rechtsfreigabe bei neuerer
  freigegebener Antwort war nicht direkt gegen `R-GUARD-07` geprüft. Im Commit `3251e68` mit einem gezielten
  Tabellen-Guard-Test geschlossen; der Test prüft `approval.answerVersion=2`, `legalClearance.answerVersion=1` und
  `409`/`R-GUARD-07` am Übergang zur Bühne.
- P1-Hotfix-Review: Minor-Testlücke im HTTP-Regressionstest: Je 422-Anfrage wird die unveränderte Frageversion,
  aber nicht zusätzlich `legalClearance` und Ereigniszahl geprüft. Der Domänentest deckt alle drei Invarianten ab.
  Gemäß Lean Review (AGENTS.md Regel 3) wird die zusätzliche HTTP-Assertion als einzelner Folgepunkt in
  `docs/folgeliste.md` erfasst; keine Code-Nacharbeit in diesem Hotfix.

## P1-Hotfix nach Merge 2db7fcf

Das automatische Codex-Review fand einen fehlenden Versionsbezug: `POST /questions/{id}/legal-clearances` mit `{}`
gibt bei einer Textantwort in `in_review` still die neueste Antwortversion rechtlich frei. Für R-TRANS-13 muss der
Aufruf `answerVersion` ausdrücklich benennen. Fehlt das Feld, antwortet die Domäne mit 422; es entsteht kein
`QuestionLegalCleared`-Ereignis und weder Frageversion noch Rechtsfreigabe ändern sich. Das gilt auch bei vorhandenem
gültigem `If-Match`; der Header ersetzt den fachlichen Versionsbezug nicht. Eine genannte veraltete Antwortversion
behält den bestehenden 409/R-GUARD-04-Pfad. Für R-TRANS-14 (Podiumsfrage aus `classified`, ohne Antwort) bleibt `{}`
zulässig und erzeugt weiterhin eine Rechtsfreigabe ohne `answerVersion`.

Der Vertrag bleibt unverändert: `LegalClearanceRequest.answerVersion` ist für den Podiumspfad optional; die
zustandsabhängige Pflicht für den Textpfad wird im Kern geprüft. Die Operation deklariert bereits 422. `If-Match`
wird in diesem Hotfix nicht allgemein zur Pflicht gemacht (028).

## Files allowed

Nur für diesen P1-Hotfix, anstelle des historischen Umfangs oben:

- `docs/slices/021c-rechtsfreigabe-rechtstor.md`
- `packages/domain/src/api.ts`
- `packages/domain/src/__tests__/legal-clearance.test.ts`
- `apps/api/src/__tests__/legal-clearance.test.ts`
- `docs/folgeliste.md` ausschließlich für einen Eintrag zur Minor-Testlücke des 021c-Hotfix-Reviews

## Akzeptanzkriterium für den P1-Hotfix

1. Domänen- und HTTP-Regressionstests prüfen für eine Textantwort in `in_review`: `{}` ohne `If-Match` und `{}` mit gültigem `If-Match` ergeben 422; Ereigniszahl, Frageversion und `legalClearance` bleiben unverändert.
2. Der bestehende Podiumspfad aus `classified` nimmt `{}` weiterhin an und schreibt eine Rechtsfreigabe ohne `answerVersion`; ein Test hält dies fest.
3. Die fokussierten Tests und `pnpm gates` laufen grün; der Hotfix-Bericht nennt den geprüften Commit und den wörtlichen Schluss des Gate-Laufs. Ein unabhängiges Review prüft den P1-Fall vor Merge.

## Bericht zum P1-Hotfix

Slice: 021c-rechtsfreigabe-rechtstor (P1-Hotfix)
Done: Textantworten benötigen bei der Rechtsfreigabe eine ausdrücklich benannte Antwortversion; Podiumsfragen bleiben ohne Version freigebbar. Rote und danach grüne Domänen- und HTTP-Regressionstests belegen den Fall. Das unabhängige Review fand keinen schweren oder Sicherheitsbefund.
Evidence: `pnpm gates` auf Commit `bda9314` grün (wörtlicher Schluss unten); vollständige lokale Chrome-E2E-Suite 119/119 grün, axe ohne serious/critical.
Open: PR-CI und automatisches Codex-Review auf dem Hotfix-PR stehen noch aus; kein Deploy. Der Minor-Testhinweis steht in `docs/folgeliste.md`.
Touched: `packages/domain/src/api.ts`, `packages/domain/src/__tests__/legal-clearance.test.ts`, `apps/api/src/__tests__/legal-clearance.test.ts`, diese Spec und `docs/folgeliste.md`.

Wörtlicher Schluss von `pnpm gates` (Node 24, Commit `bda9314`):

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 703ms
mark-test-run: wrote /Users/alex/Documents/Codex/2026-09-26/prior-conversation-with-codex-conversation-role/work/hvworkflow-021c-hotfix/.claude/state/last-test-run (clean tree) at commit bda9314, tree 406f9785b656…
```
