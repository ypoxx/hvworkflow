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

(vom Umsetzer)

## Review findings

(vom Reviewer)
