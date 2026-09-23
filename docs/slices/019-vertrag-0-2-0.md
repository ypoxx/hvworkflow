# 019 — Vertrag 0.2.0 (nur Vertrag): Redezeit und Art veraltet, Leserechte, Koordination, Rechtsfreigabe-Ereignis, Versionierung

**Status:** spec
**Risikoklasse:** mittel · 1,5 AStd · Kalender 01.10.2026 (W1) · Lane: contract (seriell; keine andere Scheibe
hält sie)
**Rolle/Modell:** Architekt · Fable 5.1 baut; Review Opus 5.5 gegen Recherche, Rechtekonzept und ADR 0001
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 6, 12; Leitplanken 1.3 (Grenze 1: Vertrag), 6.4
**Quellen-IDs:** Plan 5.3 Scheibe 019; Plan 4 (ADR 0015 Vertragsversionierung); Plan 1 B2 (Leserechte),
B6 (Rechtsfreigabe); Plan 3 (Zeilen „Wer klassifiziert", „Letztverantwortung Freigabe und Rechtstor");
Audit A3 (x-legal-notice behauptet Normverweise, die es nicht gibt — Berichtigung ist Sache von 011, hier nicht)
**Depends on:** 009 (gemergt)
**Perspektive:** Security (Leserechte), Legal (Rechtsfreigabe) · **Glossar: neue Begriffe:** nein (Glossarzeilen
„Koordination", „Rechtsfreigabe" folgen in 018)

## Ziel

Eine serielle, rein additive Vertragsänderung; Kern, Seed, Web und e2e folgen in 010, 021 und 080. Alle heutigen
Tests bleiben grün, weil nichts entfernt und nichts Pflicht wird.

1. **Version** `info.version: 0.2.0`; `packages/contract/package.json` `version` ebenfalls `0.2.0`.
2. **Redezeit und Art veraltet.** `kind` und `requestedMinutes` an `Speaker` und an den Anfrageschemata für
   Registrieren/Ändern einer Wortmeldung werden `deprecated: true`, sind nicht (mehr) in `required` und tragen in
   `description` „veraltet seit 0.2.0, entfällt in 080 (Feedback #15)". Enum und Wertebereich bleiben, damit die
   bestehenden 422-Tests weiter gelten.
3. **Rolle `coordination`** im Enum `Role` (Beschreibung: Arbeitsname, Anzeige „Koordination", Register E1).
4. **Leserechte** im Enum `Action` (Rechtebezeichner): `speaker.read`, `contribution.read`, `stage.read`,
   `history.read`, `event.read` (zusätzlich zum bestehenden `question.read`, falls es dort fehlt: ergänzen). Die
   Beschreibung des Enums nennt, dass die Vergabe ausschließlich in `ROLE_PERMISSIONS` geschieht (Regel 4).
5. **Rechtsfreigabe.** Recht `question.legal.clear` im Enum `Action`; Ereignistyp `QuestionLegalCleared` im
   Ereignis-Enum mit Payload-Schema (mindestens `questionId`, `answerVersion`, optional `note`). Keine neue Operation
   (die Freigabe-Operation kommt, wenn 021 sie braucht; dann über die Allowlist, Punkt 8).
6. **Problemtyp R-PERM-02** für verweigertes Lesen: in der Beschreibung von `Problem.ruleId` bzw. der 403-Antwort
   dokumentiert („R-PERM-01 Schreibrecht fehlt, R-PERM-02 Leserecht fehlt"); alle Leseoperationen dokumentieren
   eine 403-Antwort mit `Problem` (additiv; heute liefern sie sie nie).
7. **CHANGELOG** `packages/contract/CHANGELOG.md` (Keep-a-Changelog-Form): Eintrag 0.1.0 (Ausgangsstand, 29
   Operationen) und 0.2.0 mit Added / Deprecated, je Punkt die Folgescheibe.
8. **Versions- und Changelog-Tor, Allowlist.** Im Contract-Paket (Lane contract): `packages/contract/scripts/check.mjs`,
   aufgerufen über `"test"` in `packages/contract/package.json` (läuft damit in `pnpm -r test` und also in
   `pnpm gates`). Es prüft: (a) `info.version` = `package.json`-Version; (b) `CHANGELOG.md` hat einen Abschnitt für
   genau diese Version; (c) wenn `openapi.yaml` sich gegenüber dem Merge-Base mit dem Integrationsbranch
   `origin/claude/dax-shareholder-meeting-workflow-0s934z` geändert hat (git verfügbar, sonst Prüfung übersprungen
   mit Hinweis), muss auch die Version gestiegen sein; (d) `packages/contract/allowlist.json` — Liste vorab
   deklarierter, noch nicht implementierter Operationen `{operationId, reason, slice, expires}` — ist wohlgeformt,
   jede `operationId` existiert im Vertrag, und kein Eintrag ist abgelaufen (Datum aus der Datei gegen das heutige
   Datum; ein abgelaufener Eintrag lässt das Tor scheitern). Heute ist die Allowlist leer (`[]`). Das Tor wird einmal
   lokal absichtlich rot gemacht (Version nicht erhöht; abgelaufener Allowlist-Eintrag) — Ausgaben im Bericht, nicht
   committen.
9. **Typen** mit `pnpm contract:types` regenerieren (`packages/contract/src/types.ts`), `pnpm contract:lint` ohne
   neue Fehler (bestehende Warnungen zählen und nennen).
10. **ADR 0015** entsteht in Scheibe 015; diese Scheibe verweist in `info.description` und im CHANGELOG darauf
    („Versionierung nach ADR 0015, vorgeschlagen").

## Nicht-Ziele

- Keine Änderung an `packages/domain`, `apps/api`, `apps/web`, e2e, Seed. Nichts wird entfernt; nichts wird Pflicht.
- Kein `x-legal-notice`-Umbau (011), keine neuen Pfade/Operationen, kein If-Match-Pflichtwechsel (028).
- Keine CI-Workflow-Änderung (das Tor läuft über `pnpm gates`).

## Files allowed

- `packages/contract/openapi.yaml`, `packages/contract/src/types.ts` (nur generiert)
- `packages/contract/CHANGELOG.md`, `packages/contract/allowlist.json`, `packages/contract/scripts/check.mjs` (neu)
- `packages/contract/package.json` (Version, `test`-Skript)
- diese Datei (`docs/slices/019-vertrag-0-2-0.md`, Abschnitt „Bericht")

## Akzeptanzkriterium

1. `pnpm contract:types` erzeugt keinen weiteren Diff; `pnpm contract:lint` ohne Fehler.
2. `pnpm gates` grün, darin der neue Contract-Test; alle 25 API-Tests, 39 Kern-Tests und die Web-Tests unverändert grün.
3. Absichtlich rote Läufe des Tors (Version unverändert trotz Vertragsänderung; abgelaufener Allowlist-Eintrag) im Bericht.
4. Typen-Diff im Bericht zusammengefasst (neue Enum-Werte, `deprecated`, neues Payload-Schema).

## Nachweise

`pnpm contract:types`-Diff, `contract:lint`, CHANGELOG 0.2.0, Allowlist mit Format, rote und grüne Läufe des Tors, `pnpm gates`.

## Arbeitsweise

- Worktree `/home/user/wt/019`, Branch `claude/slice-019-vertrag`. Absolute Pfade.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`.
- Playwright-Läufe erzeugen die Bilder unter `docs/evidence/` neu: solche Änderungen nicht committen, außer diese Spec
  verlangt das Bild ausdrücklich (`git checkout -- docs/evidence` vor dem Commit). Nicht pushen.

## Bericht

```
Slice: 019-vertrag-0-2-0
Done: Vertrag 0.2.0 rein additiv: `kind`/`requestedMinutes` auf Speaker, SpeakerRegistration, SpeakerUpdate
      `deprecated: true` und nicht mehr in `required` (Enum/Wertebereich bleiben); Rolle `coordination`; Rechte
      speaker.read, contribution.read, stage.read, history.read, event.read, question.legal.clear; Ereignistyp
      QuestionLegalCleared mit Schema QuestionLegalClearedPayload (questionId, answerVersion, note?), per if/then
      an den Ereignistyp gebunden (alle anderen Typen behalten das offene Objekt); 403 mit Problem an allen zwölf
      Leseoperationen, R-PERM-01/R-PERM-02 in Problem.ruleId und Forbidden dokumentiert; info.description und
      CHANGELOG verweisen auf ADR 0015 (vorgeschlagen). Neu: packages/contract/CHANGELOG.md (0.1.0, 0.2.0),
      allowlist.json (`[]`), scripts/check.mjs als `test`-Skript des Pakets (läuft in `pnpm -r test`, also in
      `pnpm gates`; ohne Netz, ohne neue Abhängigkeit — info.version und operationIds werden zeilenweise gelesen,
      weil `yaml` aus dem Vertragspaket nicht auflösbar ist und die Lockdatei nicht zu den erlaubten Dateien zählt).
Evidence:
  pnpm contract:lint — vorher 9 Warnungen (8× operation-4xx-response an getMeeting, listAgendaItems, listUnits,
  listSpeakers, listContributions, listQuestions, getStage, listEvents; 1× no-unused-components oidc), nachher:
    packages/contract/openapi.yaml: validated in 92ms
    Woohoo! Your API description is valid. 🎉
    You have 1 warning.            <- nur noch no-unused-components: securitySchemes/oidc (Bestand, nicht 019)
  pnpm contract:types — 53 Einfügungen, 12 Löschungen in packages/contract/src/types.ts; zweiter Lauf ohne Diff
  (sha256 d8352e5debccc025 vor und nach dem Lauf). Inhalt des Diffs:
    Role:   + "coordination"
    Action: + "speaker.read" | "contribution.read" | "question.legal.clear" | "stage.read" | "history.read" | "event.read"
    Speaker.kind: `kind: ...` -> `kind?: ...` mit @deprecated; Speaker.requestedMinutes?, SpeakerRegistration.kind?,
      SpeakerRegistration.requestedMinutes?, SpeakerUpdate.requestedMinutes? mit @deprecated und Beschreibung
      „veraltet seit 0.2.0, entfällt in 080 (Feedback #15)"
    Event.type: + "QuestionLegalCleared"; neues Schema QuestionLegalClearedPayload { questionId: string;
      answerVersion: number; note?: string }
    operations: 403: components["responses"]["Forbidden"] an 12 Leseoperationen; Beschreibungen Problem.ruleId,
      Forbidden, Role, Action, Event erweitert. Kein Feld wurde Pflicht, nichts entfernt.
  Ajv-Stichprobe gegen #/components/schemas/Event (Ajv2020 wie in apps/api/src/contractSchema.ts):
    valid   | QuestionApproved, open payload (unchanged)
    valid   | QuestionLegalCleared, full payload
    INVALID | QuestionLegalCleared, payload without answerVersion -> /payload must have required property 'answerVersion'
    INVALID | QuestionLegalCleared, answerVersion 0 -> /payload/answerVersion must be >= 1
  Tor grün (pnpm --filter @hv/contract test):
    contract gate: packages/contract/openapi.yaml (info.version 0.2.0, 29 operations)
      ok    (a) info.version 0.2.0 = package.json version
      ok    (b) CHANGELOG.md has a section for 0.2.0
      ok    (c) openapi.yaml changed against merge base cadbd6e; version 0.1.0 -> 0.2.0
      ok    (d) allowlist.json well-formed, 0 pre-declared operation(s), none expired (today 2026-09-23)
    contract gate: ok
  Tor absichtlich rot 1 (Version in openapi.yaml und package.json auf 0.1.0 zurückgesetzt, Vertrag geändert):
      ok    (a) info.version 0.1.0 = package.json version
      ok    (b) CHANGELOG.md has a section for 0.1.0
      FAIL  (c) openapi.yaml changed against merge base cadbd6e but info.version stayed at 0.1.0 (was 0.1.0) — bump the
            version and add a CHANGELOG section (ADR 0015)
      ok    (d) allowlist.json well-formed, 0 pre-declared operation(s), none expired (today 2026-09-23)
    contract gate: 1 failure(s) — ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @hv/contract@0.1.0 test, Exit status 1
  Tor absichtlich rot 2 (Allowlist: abgelaufener Eintrag getMeeting expires 2026-09-01; unbekannte operationId;
  Eintrag mit Fremdschlüssel und Datum 31.10.2026):
      FAIL  (d) allowlist[0] operationId "getMeeting" expired on 2026-09-01 (today 2026-09-23, slice 019) — implement
            it or remove it from the contract
      FAIL  (d) allowlist[1] operationId "clearQuestionLegally" does not exist in openapi.yaml
      FAIL  (d) allowlist[2] has an unknown key "owner" (allowed: operationId, reason, slice, expires)
      FAIL  (d) allowlist[2] expires "31.10.2026" is not a calendar date YYYY-MM-DD
    contract gate: 4 failure(s) — Exit status 1
  Beide roten Läufe zurückgesetzt (Version 0.2.0, allowlist `[]`), danach Tor wieder grün; nicht committet.
  pnpm gates (exit 0, 19 s; Log-Zeilen desselben Laufs):
    packages/contract test: contract gate: packages/contract/openapi.yaml (info.version 0.2.0, 29 operations)
    packages/contract test: contract gate: ok
    packages/domain test:  Test Files  4 passed (4)
    packages/domain test:       Tests  39 passed (39)
    apps/web test:  Test Files  3 passed (3)
    apps/web test:       Tests  35 passed (35)
    apps/api test:  Test Files  3 passed (3)
    apps/api test:       Tests  25 passed (25)
    vocabulary-check: ok
    ✓ 1713 modules transformed.
    dist/index.html                                        0.43 kB │ gzip:   0.27 kB
    dist/assets/index-BC8cI4Qz.css                        39.09 kB │ gzip:   8.51 kB
    dist/assets/index-CS58249t.js                        525.20 kB │ gzip: 154.17 kB │ map: 2,155.11 kB
    (!) Some chunks are larger than 500 kB after minification. (Bestand)
    ✓ built in 1.10s
    gates exit=0
  Kein Screenshot (reine Vertragsscheibe); docs/evidence/ unverändert.
Open:
  - `coordination` steht im Vertrag, der Server kennt die Rolle bis 021 nicht (apps/api/src/actor.ts prüft gegen
    ROLE_PERMISSIONS): `X-Actor: x:coordination` liefert bis dahin 401. So im Enum beschrieben.
  - Die zwölf Leseoperationen dokumentieren 403/R-PERM-02, liefern es heute nie; Durchsetzung in 010.
  - Eine Registrierung ohne `kind` passiert seit 0.2.0 die Vertragsprüfung und erreicht den Kern, der `kind`
    unverändert übernimmt (packages/domain/src/api.ts:297, Domäntyp weiter Pflicht). Die Oberfläche sendet `kind`
    immer; endgültig löst es 080 (Rückbau). Kein Test betroffen.
  - Tor-Prüfung (c) braucht den Merge-Base mit origin/claude/dax-shareholder-meeting-workflow-0s934z; in einem
    flachen CI-Checkout (actions/checkout@v4, Tiefe 1) wird sie mit Hinweis übersprungen (a, b, d laufen immer).
    Ein `fetch-depth: 0` in gates.yml wäre eine CI-Änderung und damit Nicht-Ziel dieser Scheibe — Vorschlag für 012/CI.
  - Verbleibende Lint-Warnung no-unused-components (securitySchemes/oidc) ist Bestand, nicht Gegenstand von 019.
  - Glossarzeilen „Koordination", „Rechtsfreigabe" folgen laut Spec in 018; ADR 0015 bleibt „vorgeschlagen".
Touched: packages/contract/openapi.yaml, packages/contract/src/types.ts (generiert), packages/contract/package.json,
      packages/contract/CHANGELOG.md (neu), packages/contract/allowlist.json (neu), packages/contract/scripts/check.mjs
      (neu), docs/slices/019-vertrag-0-2-0.md
```

## Review findings

(vom Reviewer)
