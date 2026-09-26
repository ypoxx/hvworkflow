# 080 — Redezeit und Art zurückbauen, Sprecher-Zustandstabelle R-SPK

**Status:** review bestanden (R1 nicht bestanden, Nachprüfung bestanden, 26.09.)
**Risikoklasse:** hoch · 1,5 AStd · 08.10.2026 (W2, vorgezogen) · Lanes: core, web-speakers
**Rolle:** Implementierer-Backend (Kern, Seed, Regeln) und Oberfläche (Wortmeldeliste) in einem Bau; Review in frischem Kontext (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** AGENTS.md Regeln 1, 2, 5, 7, 10, 12; R-SPK-01..05 (neu); Regelregister aus 011
**Quellen-IDs:** Feedback #14, #15; `docs/produktplan-beta.md` Abschnitt 5, Eintrag 080; Ist-Analyse Sprecherstatus
**Depends on:** 019, 011 (`832a5e1`), 017 (alle gemergt)
**Perspektive:** Prozess/Recht (Zustandstabelle) · **Glossar: neue Begriffe:** nein

## Festlegung des Architekten

Der Planeintrag 080 ist für eine Scheibe zu groß (Vertrag, Kern, Seed-Umbau, elf e2e-Dateien). Nach Lesen des Codes
(Lehre aus 090) wird er geteilt:

- **080 (diese Scheibe):** Kern und Web ohne `kind`/`requestedMinutes`; `SPEAKER_TRANSITIONS` als Daten.
- **080b (neu im Plan):** Korpus 28/230 als eine Quelle (`CORPUS_DEMO`, `CORPUS_LOAD`), e2e-Konstanten, Umsortierung
  nach Runde 1 mit Begründung im Ereignis.
- **Vertrag bleibt unverändert.** Die Felder sind seit 0.2.0 veraltet und optional; das Löschen ist nicht additiv und
  gehört nach ADR 0015 in den nächsten Minor-Zyklus des Architekten (0.4.0, Scheibe 043). 0.3.1 ist an 028 vergeben.
  Der Dienst nimmt die Felder weiter an (Vertragsvalidierung, 422 bei falschem `kind` bleibt), der Kern **ignoriert**
  sie: er schreibt sie in kein neues Ereignis und gibt sie in keiner Sicht aus.

**Nachtrag des Architekten (25.09., nach Rückfrage des Implementierers):** (a) Der Guard heißt `R-SPK-GUARD-01`; dafür
wird das Muster in `apps/api/src/__tests__/rule-register.test.ts` auf `/\bR-[A-Z]+(?:-[A-Z]+)?-\d{2,}\b/g` erweitert
und dort auch die Zeilen und Guards aus `SPEAKER_TRANSITIONS` gezählt (Datei erlaubt, nur das). (b) Ein nicht gelistetes
Paar und derselbe Status noch einmal antworten 409 mit `R-SPK-00`, der eigenen Konfliktregel des Auflösers in
`OTHER_RULES` (wie `R-TRANS-00` bei Fragen). (c) Seed: der verworfene Wurf für die Redezeit fällt nach `tick()`, damit
die Zufallsfolge gleich bleibt.

**Nachtrag des Architekten (26.09., nach Review R1):** Bedrohungs-IDs: **T-G1-T-02** (unbekannte Felder im Log). 080
schreibt `SpeakerUpdated` nur noch aus benannten Feldern (`status`, `round`, `reason`). `reason` kommt nur ins Ereignis,
wenn die aufgelöste Zeile einen Guard hat, der den Wert prüft (heute nur R-SPK-05 mit GUARD-01); sonst wird es verworfen.
Test: „`waiting → speaking` mit `reason: 'x'` schreibt keinen Grund“. Damit ist T-G1-T-02 für `updateSpeaker`
geschlossen, für die übrigen Operationen bleibt es bei 023/024. Da `SpeakerUpdate` keine Zusatzfelder verbietet, ist
R-SPK-05 mit `reason: 'follow_up'` **schon über HTTP erreichbar**. Das ist gewollt (geprüfter Wert), steht so im
Bericht, und 043 nimmt das Feld in den Vertrag auf. Missbrauchsfall: keiner aus MF-01..08. Die Scheibe ändert weder
Rechte noch Rollen, Bühne, Ingest oder Demo-Schalter.

Befund beim Lesen: `updateSpeaker` (packages/domain/src/api.ts) prüft heute **keinen** Statusübergang; jeder Wechsel
ist erlaubt, auch `finished → speaking`. Das ist die eigentliche Lücke, die R-SPK schließt.

## Ziel

1. **Zustandstabelle** `SPEAKER_TRANSITIONS` in `packages/domain/src/transitions.ts`, gleiche Form wie `TRANSITIONS`
   (ruleId, from, to, guards, description, legalRef), deny by default:
   - R-SPK-01 `waiting → speaking`
   - R-SPK-02 `speaking → finished`
   - R-SPK-03 `waiting → withdrawn`
   - R-SPK-04 `speaking → withdrawn`
   - R-SPK-05 `finished → waiting` nur mit Grund „Nachfrage“: Guard R-SPK-GUARD-01, Feld `reason: 'follow_up'` im
     Domänentyp `SpeakerUpdate` (im Vertrag erst ab 0.4.0; siehe Nachtrag R1). Der Grund steht im Ereignis `SpeakerUpdated`.
   legalRef ehrlich wie in 011 (`source: 'Prozess'`, Zitat mit Datei:Zeile aus der Ist-Analyse bzw. Feedback,
   `verified: false`; was nicht belegt ist, heißt „Ableitung“ oder „Nicht belegt“).
2. `updateSpeaker` prüft einen Statuswechsel gegen die Tabelle; nicht erlaubt → 409 mit `ruleId` (gleicher Weg wie bei
   Fragen, `ApiProblem`). Gleicher Status wie vorher → 409 (kein stiller Doppelwechsel). Rundenwechsel ohne Status
   bleibt wie heute. Keine Statuslogik außerhalb der Tabelle (Regel 5).
3. `ruleRegister()` (rules.ts) nimmt die R-SPK-Zeilen und den Guard auf; `docs/legal-trace.md` per Snapshot neu
   erzeugt (Diff nur die neuen Zeilen und die Zählzeile).
4. `transitions.test.ts`: ein generierter Test je R-SPK-Zeile (erlaubt) und je nicht gelistetem Paar (409), darunter
   ausdrücklich `finished → speaking` 409 mit Regel-id im Problem; R-SPK-05 ohne Grund 409.
5. **Rückbau:** `kind`, `SpeakerKind`, `requestedMinutes` aus `packages/domain/src/{types,events,state,api}.ts`
   (Record, Sicht, Registrierung, Update, Ereignistypen neuer Ereignisse). Die Projektion liest die Felder alter
   Ereignisse nicht mehr (Ereignisse bleiben unverändert, Regel 7). Seed schreibt die Felder nicht mehr, **zieht die
   Zufallszahlen aber weiter** (Kommentar warum), damit Namen, Organisationen und alle Snapshot-Zählungen gleich
   bleiben.
6. **Web:** Spalten „Art“ und „Redezeit“ in `RoundSection`/`SpeakerRow` weg, Felder Art und Redezeit im
   `RegisterDialog` weg, `SpeakingTimer.tsx` gelöscht und aus `NowSpeaking`/`SpeakerRow` entfernt (auch „gewünscht n
   Min.“ beim Nächsten), `labels.ts` ohne Art; i18n-Schlüssel dazu in DE und EN entfernt. Das Grid der Zeile schließt
   ohne Lücke.
7. Tests, die `kind`/`requestedMinutes` senden oder prüfen, angepasst (siehe Files allowed). `apps/api`: der
   Vertragstest für `requestedMinutes` wird zu „Feld wird angenommen und ignoriert“; ein Test, dass ein Statuswechsel
   `finished → speaking` über HTTP 409 mit `ruleId` R-SPK… liefert.

## Nicht-Ziele

Korpus, `CORPUS_*`, e2e-Konstanten, Umsortierung mit Begründung (alles 080b). Keine Vertragsänderung (0.4.0/043).
Kein Knopf „Nachfrage“ in der Oberfläche. Kein Guard „nur ein Mikrofon offen“ (die Oberfläche beendet heute die
laufende Rede zuerst; → Folgeliste). Die Knopfwahl in `SpeakerRow` nach Status bleibt, wie sie ist (→ Folgeliste:
aus `_actions` ableiten). Keine Politur aus der Folgeliste.

## Files allowed

- `packages/domain/src/{transitions,rules,types,events,state,api,seed}.ts`
- `packages/domain/src/__tests__/{transitions,rules,api,seed}.test.ts`
- `packages/domain/src/__tests__/seed-fictitious-names.test.ts` (Nachtrag 26.09.: nur `maskNames` blendet `kind`/`requestedMinutes` aus, `PRE_CHANGE_FINGERPRINT` auf den so maskierten Altstand, Kommentar zu 080; der Implementierer hat gezeigt, dass der alte Seed ohne die beiden Felder bytegleich zum neuen ist)
- `docs/legal-trace.md`, `docs/policy-truth-table.md` (nur generiert)
- `apps/api/src/__tests__/{contract,acceptance,negative,rule-register}.test.ts`
- `apps/web/src/features/speakers/**`, `apps/web/src/i18n/speakers.{de,en}.ts`
- Nachtrag 26.09.: `apps/web/src/i18n/parity.test.ts` (nur die Schlüsselzahl 464 → 452); `apps/web/src/i18n/shell.{de,en}.ts`
  (nur `page.speakers.description` ohne Redezeit); `apps/api/src/__tests__/helpers.ts` (nur
  `UNDOCUMENTED_STATUS_EXCEPTIONS.updateSpeaker` um 409, Begründung „R-SPK seit 080, im Vertrag ab 0.4.0/043“ — der
  Vertrag nennt 409 für `updateSpeaker` noch nicht; 043 dokumentiert ihn)
- `apps/web/src/app/App.tsx`, `apps/web/src/features/answers/{Page,QuestionDetail}.tsx` (nur falls sie `kind` eines
  Sprechers lesen)
- `apps/web/e2e/*.spec.ts` (nur Zeilen, die `kind`/`requestedMinutes` senden oder Spalten Art/Redezeit prüfen)
- `apps/web/e2e/080-sprecher-zustand.spec.ts` (neu, Screenshot)
- `docs/evidence/080-*.png`
- `docs/produktplan-beta.md` (nur Einträge 080 und 080b, vom Architekten), `docs/slices/080-sprecher-zustand-rueckbau.md`

## Akzeptanzkriterium

1. `grep -rn "requestedMinutes\|SpeakerKind\|SpeakingTimer" packages/domain/src apps/web/src` ohne Treffer
   (Ausnahme: ein Kommentar im Seed zu den weiter gezogenen Zufallszahlen).
2. transitions.test.ts: eine Zeile je R-SPK grün, Negativtest `finished → speaking` 409 mit `ruleId`; seed-Tests
   unverändert grün (gleiche Zählungen).
3. Screenshot Wortmeldeliste ohne Art/Redezeit DE und EN: `docs/evidence/080-wortmeldeliste-{de,en}.png`.
4. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich) und volle e2e-Suite grün, axe ohne serious/critical.

## Arbeitsweise

- Worktree `/home/user/wt/s080`, Branch `claude/slice-080-sprecher-zustand` (vom Architekten angelegt).
- Playwright mit eigenem Port (z. B. 5191), Chromium unter `/opt/pw-browsers`; danach fremde Evidenz mit
  `git checkout -- docs/evidence` zurücksetzen, nur `080-*` behalten.
- Logdateien nur über `mktemp`. Jeder Commit nennt „Scheibe 080“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

```
Slice: 080-sprecher-zustand-rueckbau
Done: SPEAKER_TRANSITIONS R-SPK-01..05 + GUARD-01, Konflikt R-SPK-00; updateSpeaker prüft gegen die Tabelle
      (409 mit ruleId, auch über HTTP), Ereignis nur aus benannten Feldern, reason nur mit Guard (T-G1-T-02 für
      updateSpeaker geschlossen). kind/requestedMinutes/SpeakingTimer aus Kern und Web; Seed bytegleich ohne die Felder.
Evidence: pnpm gates auf 86cdf0d grün (Domäne 109, Web 181, API 64), Schluss wörtlich:
      ✓ built in 1.65s
      mark-test-run: wrote /home/user/wt/s080/.claude/state/last-test-run (clean tree) at commit 86cdf0d, tree e4848fd67911…
      e2e voll auf c4e5d37: 117 passed (6.9m), axe 0 serious/critical; nach der Web-Nacharbeit 080 + 002: 2 passed.
      docs/evidence/080-wortmeldeliste-{de,en}.png
Open: R-SPK-05 mit reason 'follow_up' ist schon über HTTP erreichbar (SpeakerUpdate verbietet keine Zusatzfelder;
      gewollt, Wert geprüft); 409 und reason kommen mit 0.4.0/043 in den Vertrag (bis dahin Ausnahme in helpers.ts).
      Vertragsfelder kind/requestedMinutes löscht 043. Korpus und Umsortierung: 080b.
      Folgeliste: leerer PATCH schreibt leeres SpeakerUpdated; legalRef R-SPK-01 soll die Redezeitmessung der
      Ist-Analyse erwähnen; Tests 412-vor-409 und Idempotenz-Wiederholung; EN-Spaltenkopf „QUESTI…“; Knopfwahl in
      SpeakerRow aus _actions; Guard „nur ein Mikrofon offen“.
Touched: packages/domain/src/{transitions,rules,types,events,state,api,seed}.ts und Tests; apps/api/src/__tests__/
      {contract,acceptance,negative,rule-register,helpers}.ts; apps/web/src/features/speakers/**, i18n speakers/shell,
      parity.test.ts; e2e 002, 010b, 010c, 010d, 080 (neu); docs/legal-trace.md; docs/evidence/080-*.
```
