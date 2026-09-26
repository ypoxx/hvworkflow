# takt-016 — Vertragsbrücke für Scheibe 025 (Papier-Nacherfassung)

**Status:** spec
**Risikoklasse:** mittel · Vertragsform vor der Kernarbeit · Lane: contract, docs-plan (nur Planzeilen 023/025/028 und Versionsverweis in der Risikotabelle), service (nur fokussierter Vertragstest)
**Rolle:** Architekt; unabhängiges Review gegen ADR 0015 und die Nachweise aus 023
**Rule ids:** AGENTS.md Regeln 1, 2, 6, 7, 12; R-MTG-03 wird erst in 025 implementiert
**Quellen-IDs:** Plan 5.4 Scheibe 025; 023-Bericht „Offen“; Vertrag 0.3.1 nach 021c; ADR 0011, 0015
**Depends on:** 021c (0.3.1), 023
**Perspektive:** Vertragskompatibilität und überprüfbare Nachtragsregel · **Glossar: neue Begriffe:** nein

## Ziel

Vertrag 0.3.2 ergänzt genau die Form, die 025 für seinen unveränderten HTTP-Nachweis benötigt:

1. `Meeting.debateClosedAt?: date-time`, `Contribution.lateEntry?: boolean` und
   `MeetingContributionCapture.lateEntryReason?: string` mit `minLength: 1`. Der Grund steht nur im
   kanonischen Body; `ContributionCapture` des Alias bleibt unverändert. Alle drei Felder sind in
   diesem Vertrag optional. Nach dem Schluss verlangt R-MTG-03 in 025 für `paper` und `transcript`
   eine Quellenzeit bis zum Schluss und einen nichtleeren Grund; der Kern setzt `lateEntry: true`
   samt Grund im Ereignis und `lateEntry: true` in der Antwort. Ohne Schluss bleibt das Feld aus.
2. `DebateClosed` ergänzt `Event.type`. Sein `subjectId` ist die `meetingId`; der maßgebliche
   `recordedAt`/`at`-Zeitpunkt projiziert `Meeting.debateClosedAt`. Der Ereignis-Payload bleibt
   ein offenes Objekt wie andere noch nicht gebundene Ereignisse aus 023. Es gibt jetzt **keine**
   öffentliche Schluss-Operation: 087 ergänzt sie mit der Restantenbestätigung R-MTG-07. Der
   025-HTTP-Test stellt den geschlossenen Zustand über ein synthetisches, gültiges v2-Ereignis in
   seiner Test-Fixture her und ruft danach die echte HTTP-Erfassung auf.
3. `Meeting.version` bleibt optional im Vertrag, wird aber ab 025 im Kern projiziert; damit kann
   `GET /meetings/{meetingId}` sein bereits verpflichtendes `ETag` liefern. Seine Beschreibung
   nennt 025 statt 040. `If-Match` und die schon angekündigten Pflichtfelder werden erst in 028
   mit 0.3.3 verpflichtend. Alle Vorblicke in Vertrag und Plan werden angepasst.
4. `info.version` und Paketversion werden 0.3.2; CHANGELOG und generierte Typen folgen. Keine
   neue Operation und kein neuer Allowlist-Eintrag.

## Nicht-Ziele

Keine Implementierung von R-MTG-03, keine Status- oder Rechteänderung, kein Schluss-Endpunkt vor
087, keine Änderung am Alias-Body, keine Pflichtfelder, keine Änderung an 024 und kein Deployment.

## Files allowed

- `docs/slices/takt-016-025-papiervertrag.md`
- `packages/contract/openapi.yaml`
- `packages/contract/src/types.ts` (generiert)
- `packages/contract/CHANGELOG.md`
- `packages/contract/package.json`
- `apps/api/src/__tests__/takt-016-contract.test.ts`
- `docs/produktplan-beta.md` (nur Lane-Hinweis und Zeilen zu 023, 025, 028 sowie der Versionsverweis in der Risikotabelle)

## Akzeptanzkriterium

1. Der fokussierte Vertragstest ist vor der Vertragsänderung rot und danach grün: neue Felder
   sind ausdrücklich im Schema typisiert, leerer Grund wird abgewiesen, `DebateClosed` ist ein
   erlaubter Ereignistyp, der Alias-Body besitzt keinen Nachtragsgrund, Version ist 0.3.2.
2. `pnpm contract:types` erzeugt einen stabilen Typen-Diff; `pnpm contract:lint` und `pnpm gates`
   sind grün. Bericht nennt Commit und den wörtlichen Gates-Schluss.
3. 025 kann danach unverändert die Nachweise `manual nach Schluss → 409 R-MTG-03` und `paper mit
   früherem occurredAt und Grund → 201 mit lateEntry` über den HTTP-Dienst führen. Der Schluss
   wird dafür nur in der Test-Fixture gesetzt; die öffentliche Aktion folgt mit 087.

## Nachweise

Rot/grün des fokussierten Tests, generierte Typen, CHANGELOG 0.3.2, `pnpm gates` auf Commit.

## Bericht

(folgt nach dem Bau)

## Review findings

(folgt im unabhängigen Review)
