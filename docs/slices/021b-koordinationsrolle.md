# 021b — Koordinationsrolle

**Status:** in Arbeit (26.09.)
**Risikoklasse:** hoch (Rechte) · 1 AStd · 09.10.2026 (W2, vorgezogen) · Lanes: core, e2e
**Rolle:** Implementierer-Backend (Rechte, Persona) und e2e-Personas in einem Bau; Review in frischem Kontext, Perspektive Security (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 10, 12; Rechte als Daten (ROLE_PERMISSIONS), Wahrheitstabelle
**Quellen-IDs:** `docs/produktplan-beta.md` Abschnitt 5, Eintrag 021b; Vertrag 0.2.0 (`Role` enthält `coordination` als Arbeitsnamen)
**Depends on:** 021a
**Perspektive:** Security (Rechteverteilung) · **Glossar: neue Begriffe:** nein (Koordination steht im Glossar-Plan 018)
**Bedrohungs-IDs:** keine neue; Rechte werden enger (capture verliert zwei Rechte), keine Rolle gewinnt ein Schreibrecht, das
nicht schon eine andere Rolle hält. Missbrauchsfall: keiner neu; MF-01 (Rechteerhöhung über die Rollenzuordnung)
wird nicht berührt, weil die Zuordnung unverändert bleibt und nur eine Rolle mit engeren Rechten hinzukommt; T-G1-E-02/E-04
bleiben durch `can()` abgedeckt (Negativtests in Domäne und über HTTP).
**Offene Entscheidung:** E1 Rollenname — auf Standard gebaut: Arbeitsname `coordination`, Anzeige „Koordination“ / „Coordination“.

## Festlegung des Architekten

Gelesen: Der Vertrag kennt `coordination` seit 0.2.0; die Domäne (`Role` in types.ts, `ROLE_PERMISSIONS` in
permissions.ts) noch nicht. `question.forward` und `round.assemble` gibt es weder im Vertrag noch in der Domäne; sie
kommen mit ihren eigenen Scheiben (Weiterleiten, Antwortbündel) und werden dort der Koordination gegeben. Die Personas
stehen in `apps/web/src/api/actor.ts` (`DEMO_ACTORS`, einzige Web-Datei mit Rollennamen) und im Seed (`SEED_ACTORS`).
e2e wechselt Rollen über `role-option-<rolle>`; klassifiziert wird heute als `capture` in 002, abnahme und evtl. weiteren.

- Rolle `coordination` in `Role` (types.ts) mit Kommentar; `ROLE_PERMISSIONS.coordination`: `question.classify`,
  `question.assign`, `question.read`, `contribution.read`, `speaker.read`, `history.read`.
- `capture` verliert `question.classify` und `question.assign`; alles andere bleibt.
- Demo-Persona `{ id: 'u-coord-1', role: 'coordination', displayName: 'Koordination' }` in `DEMO_ACTORS` und
  `SEED_ACTORS` (nur als Akteur; **der Seed schreibt seine Ereignisse unverändert**, damit Korpus und Fingerabdruck
  gleich bleiben — historische Klassifizierungen im Demo-Korpus tragen weiter die Erfassung als Akteur; → Folgeliste).
- i18n: `role.coordination` DE „Koordination“, EN „Coordination“ (ein Schlüssel je Sprache: Zahlen im Paritätstest `apps/web/src/i18n/parity.test.ts` 452 → 453).
- Die Oberfläche rendert `_actions`: kein Rollenvergleich neu; die Erfassungsseite zeigt „Klassifizieren“ nur noch der
  Koordination.
- Wahrheitstabelle `packages/domain/policy-truth-table.md` neu erzeugt; der Diff (Zeilen für coordination, zwei Zeilen capture
  verweigert) ist hiermit freigegeben.
- e2e: Szenarien, die als `capture` klassifizieren oder zuweisen, wechseln für diesen Schritt zu `coordination`; das
  Prüfziel bleibt, keine Zusicherung wird geschwächt. Abnahmesatz in `docs/erste-version-und-offene-fragen.md`: „… die
  Koordination klassifiziert sie …“; abnahme.spec.ts folgt.

## Ziel

1. Rolle, Rechte, Persona, i18n wie oben; Tests: capture klassifiziert → 403, coordination klassifiziert und weist zu →
   erlaubt, coordination erfasst nicht (`question.capture` → 403); `_actions` entsprechend.
2. Wahrheitstabelle neu; e2e angepasst; Abnahmesatz umformuliert.
3. Screenshot der Erfassung als Koordination mit sichtbarem „Klassifizieren“ DE/EN: `docs/evidence/021b-koordination-{de,en}.png`.

## Nicht-Ziele

`question.forward`, `round.assemble`, Rechtsfreigabe (021c), Änderung der Seed-Ereignisse, Vertragsänderung.

## Files allowed

- `packages/domain/src/{types,permissions,seed}.ts` (seed.ts nur `SEED_ACTORS`)
- `packages/domain/src/__tests__/{permissions,api,transitions}.test.ts`
- `apps/api/src/__tests__/*.test.ts` (nur Stellen, die capture klassifizieren lassen)
- `apps/web/src/api/actor.ts`, `apps/web/src/i18n/{labels,shell.de,shell.en,parity.test}.ts`
- `apps/web/e2e/*.spec.ts`, `apps/web/e2e/021b-koordination.spec.ts` (neu)
- `packages/domain/policy-truth-table.md`, `docs/legal-trace.md` (nur generiert), `docs/evidence/021b-*.png`
- `scripts/role-literal-check.test.mjs` (Nachtrag 26.09.: nur der Fixture-Rollenname, der `coordination` als erfundene
  Zusatzrolle nutzte; jetzt eine nicht vergebene Rolle)
- `docs/erste-version-und-offene-fragen.md` (nur der Abnahmesatz), `docs/slices/021b-koordinationsrolle.md`

## Akzeptanzkriterium

1. Rechtetests rot vor der Änderung, danach grün; Wahrheitstabellen-Diff nur wie oben.
2. Volle e2e-Suite grün (Anzahl nennen), axe ohne serious/critical; Screenshots DE/EN.
3. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/s021b`, Branch `claude/slice-021b-koordination` (vom Architekten angelegt).
- Playwright auf Port 5195, Chromium unter `/opt/pw-browsers`; danach fremde Evidenz mit `git checkout -- docs/evidence`.
- Logs nur über `mktemp`. Commits nennen „Scheibe 021b“ und enden mit `[skip netlify]`. Nicht pushen.
- Stößt eine Änderung auf eine Datei außerhalb von Files allowed oder eine nicht genannte feste Zahl: anhalten und melden.

## Bericht

(folgt)
