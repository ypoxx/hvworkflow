# 021c — Rechtsfreigabe und Rechtstor vor der Bühne R-GUARD-07

**Status:** in Arbeit (26.09.)
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

## Files allowed

- `packages/contract/{openapi.yaml,CHANGELOG.md,package.json,allowlist.json}`, `packages/contract/src/types.ts` (generiert)
- `packages/domain/src/**`, `packages/domain/policy-truth-table.md` (generiert)
- `apps/api/src/app.ts`, `apps/api/src/__tests__/*.test.ts`, `apps/api/src/__tests__/helpers.ts`
- `apps/web/src/features/answers/**`, `apps/web/src/i18n/{answers.de,answers.en,shell.de,shell.en,parity.test,labels}.ts`
- `apps/web/e2e/*.spec.ts`, `apps/web/e2e/021c-rechtsfreigabe.spec.ts` (neu), `docs/evidence/021c-*.png`
- `docs/legal-trace.md` (generiert), `docs/erste-version-und-offene-fragen.md` (nur Abnahmesatz)
- `docs/produktplan-beta.md` (nur Einträge 023, 028 und 021c: 0.3.1 → 0.3.2), `docs/slices/021c-rechtsfreigabe-rechtstor.md`

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

(folgt)
