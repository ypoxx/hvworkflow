# Scheibe 026 — Personentabelle und Rollenereignisse

**Status:** geplant · **Risikoklasse:** hoch · **Lanes:** core, service
**Grundlage:** AGENTS.md R1–R12; `docs/produktplan-beta.md` §5.4/026; ADR 0004, 0009, 0011, 0013; Vertrag 0.3.3. Scheibe 025 ist mit PR #53 (`7bd0e30`) integriert. E8 baut auf der Standardannahme: die Zuordnungstabelle im Tool ist die Wahrheit, IdP-Gruppen sind später nur Vorschläge.

## Ziel und Grenzen

1. Der Kern führt `Person {personId, displayName, organisation?}` als eigene, je Jahrgang rekonstruierbare Entität. Neue Sprecherereignisse tragen eine pseudonyme `subjectId`, `personId` im Umschlag und personenbezogene Felder nur in `payload.pii` mit `keyId`; `SpeakerRegistered.payload` enthält keinen Klarnamen. Die Identitäts-Codec-Grenze aus 024 bleibt erhalten. Historische Ereignisse bleiben unverändert lesbar; sie werden nie umgeschrieben. Die physische Postgres-Personentabelle folgt in 027.
2. `question.identity.reveal` ist ein eigenes Recht. Für 026 erhalten es ausdrücklich `coordination`, `moderation`, `legal`, `approver` und `podium`; alle übrigen Rollen einschließlich `admin`, `capture`, `expert`, `observer` sehen „Redner <Nummer>“. Der Kern projiziert Sprecher- und Frageansichten aus der Personentabelle, ohne Namen in Frageereignissen zu duplizieren. Die Jahrgangskonfiguration `pseudonymiseForUnits` steht auf `true`; ein öffentlicher Umschalter gehört nicht zu 026.
3. `RoleAssigned`/`RoleRevoked` werden als append-only Fakten mit globaler `seq`, Jahrgang, pseudonymer Subject-ID, Rolle, optionaler Einheit, Person-ID, Ablauf und Vertretung geschrieben. Die drei vorab deklarierten kanonischen Operationen `listRoleAssignments`, `assignRole`, `revokeRole` werden gemountet und aus der 026-Allowlist entfernt. `admin.roles.manage` wird nur `admin` ausdrücklich gewährt, mit Negativtests und generiertem Wahrheitstabellen-Diff. Doppelte aktive Zuordnung oder doppelte Entziehung liefert 409; fremde Jahrgangs- und Zuordnungs-IDs liefern 404. Ablaufzeit und `MeetingClosed` entziehen die Rolle für folgende Anfragen; die Sperre laufender Sitzungen folgt in 029b.
4. Eine neue, über diese Tabelle zugeordnete Rolle ist nur mit gültigem, nicht widerrufenem Eintrag nutzbar. Ein `expert`-Eintrag ohne `unitId` berechtigt nicht zu `question.read`; die Einheit wird aus der Zuordnung, nie aus Body/Query/Header, abgeleitet. Bis der Sitzungsadapter aus 029b diese Tabelle zur einzigen Quelle macht, bleibt die bestehende synthetische Demo-Identität ohne Zuordnung als explizit begrenzter Kompatibilitätspfad nutzbar. Außerhalb des Demo-Modus erlaubt der bestehende Actor-Adapter ohnehin keinen selbst behaupteten Rollenheader.

## Rechteentscheidung und Sicherheit vor Bau

Der Role-×-Action-Diff wird vor den Codeänderungen in der Spec festgelegt: `question.identity.reveal` = ja nur für `coordination`, `moderation`, `legal`, `approver`, `podium`; `admin.roles.manage` = ja nur für `admin`; alle übrigen Zellen = nein. Die Tabelle `packages/domain/policy-truth-table.md` und ein Negativtest je neuem Recht belegen die Entscheidung. Eine Änderung der Rollenliste ist ein neuer Rechteentscheid, kein beiläufiger Code-Fix.

**Berührte Bedrohungen:** T-G1-I-03 (Klarnamen), T-G1-E-04 (Admin als Inhaltskonto), T-G2-I-01 (PII-Umschlag), T-G3-E-03 (Zuordnung als Rechteerhöhung), T-G1-S-01 (Rollenheader nur Demo), T-G1-D-01 (bestehende HTTP-Limits noch offen bis 034). 026 schließt keine dieser IDs allein vollständig; Nachweise sind Pseudonym-/Negativtests, keine Namensfelder im neuen Ereignis-Payload, Rollenablauf- und Fremd-ID-Tests. Der Bericht nennt je ID den ausgeführten Test und die verbleibende Grenze.

**Missbrauchsfall MF-01:** Ein Administrationskonto weist sich selbst eine Freigaberolle zu und entzieht sie wieder. 026 hält beide Fakten mit Subject-ID, Rolle, Jahrgang und Serverzeit unveränderlich im Log. Signal ist die Folge `RoleAssigned`/`RoleRevoked` desselben Subjects innerhalb eines Tages, ohne Frageinhalt oder personenbezogene Kennzahl; Empfänger ist der technische Betrieb mit Vier-Augen-Zugriff auf die Zuordnungshistorie. Automatischer Alarm und Konfigurationsfreeze folgen in 085/040. 026 behauptet daher noch keine vollständige Verhinderung dieses Missbrauchs.

## Nicht-Ziele

Keine echte Anmeldung, kein IdP-Gruppen-Sync, keine Notfallkonten, kein laufender Session-Entzug (029b), keine physische Postgres-Tabelle (027), keine Vertraulichkeitsstufen oder `event.read.personal` (047), kein protokolliertes Aufdecken per Lookup (067), keine Oberfläche zur Rollenverwaltung (040), keine neue Vertragsoperation oder Vertragsversion, kein Deploy.

## Files allowed

- `docs/slices/026-personen-rollen.md`
- `packages/domain/src/types.ts`
- `packages/domain/src/events.ts`
- `packages/domain/src/state.ts`
- `packages/domain/src/api.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/seed.ts`
- `packages/domain/src/envelope.ts` (nur Ereignistypen/PII-Validierung)
- `packages/domain/src/store.ts` (nur Vorabprüfung der neuen Rollenereignisse, falls notwendig)
- `packages/domain/src/rules.ts` (nur neue Regel-IDs mit ehrlicher Fundstelle)
- `packages/domain/src/index.ts`
- `packages/domain/src/__tests__/person-roles026.test.ts`
- `packages/domain/src/__tests__/api.test.ts` (nur Anpassung alter Klarnamen-Erwartungen)
- `packages/domain/src/__tests__/seed.test.ts` (nur neue PII-/Rollen-Fixtures)
- `packages/domain/src/__tests__/seed-fictitious-names.test.ts` (nur Abzug der neuen PII-Struktur vom historischen RNG-Fingerabdruck)
- `packages/domain/src/__tests__/envelope.test.ts` (nur Ereignistyp- und PII-Fixtures)
- `packages/domain/src/__tests__/transitions.test.ts` (nur generierte Role-×-Action-Tabelle)
- `packages/domain/src/__tests__/rules.test.ts` (nur Register-Snapshot)
- `packages/domain/policy-truth-table.md` (nur generierter Diff für zwei neue Rechte)
- `apps/api/src/app.ts`
- `apps/api/src/__tests__/person-roles026.test.ts`
- `apps/api/src/__tests__/helpers.ts` (nur 026-Operation-Coverage)
- `packages/contract/allowlist.json` (nur Einträge mit `slice: "026"`)
- `docs/rollen-und-rechtekonzept.md` (nur Gewährung und zeitliche Grenze)
- `docs/legal-trace.md` (nur generierte Regelzeilen, falls neue Regeln)
- `docs/evidence/026-personen-rollen.jpg` (Browser-Nachweis der pseudonymen Ansicht)

## Tests zuerst und Abnahme

1. Fokussierte Tests laufen vor der Implementierung rot: zwei Personen in getrennten Jahrgängen; neuer Sprecher schreibt keinen Namen außerhalb `pii` und trägt `personId`/`keyId`; fünf Reveal-Rollen sehen Namen, alle anderen Pseudonym; Frage und Bühne verraten bei fehlendem Recht keinen Namen; `expert` ohne Einheit 403; Zuordnung/Entzug/Ablauf/Jahrgangsende; fremde ID 404; alle drei HTTP-Operationen vertragsvalidiert; alte v2-Logs bleiben lesbar.
2. Fokussierte Tests und `pnpm gates` laufen auf sauberem Commit grün. Browser verfügbar: volle E2E-Suite und Screenshot; unabhängiges Review in frischem Kontext, Blocker/Major sowie Security/Legal/Privacy vor Merge beheben. PR-CI auf letztem Commit grün. Jeder Commit nennt „Scheibe 026“ und endet `[skip netlify]`.
3. Bericht nach AGENTS.md mit wörtlichem Schluss von `pnpm gates`, Commit, offenen Grenzen, Bedrohungs-ID→Test und berührten Dateien. Kein Deploy.

## Bericht

(nach Bau, Test, Gate und Review)
