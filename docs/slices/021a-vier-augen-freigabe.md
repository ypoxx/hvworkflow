# 021a — Vier-Augen-Guard R-GUARD-06 auf der Freigabe

**Status:** review bestanden (R1, 26.09.)
**Risikoklasse:** hoch (Recht, Rechte) · 0,5 AStd · 09.10.2026 (W2, vorgezogen) · Lanes: core
**Rolle:** Implementierer-Backend; Review in frischem Kontext, Perspektive Legal/Security (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 5, 12; R-TRANS-05, R-GUARD-06 (neu)
**Quellen-IDs:** `docs/produktplan-beta.md` Abschnitt 5, Eintrag 021; `docs/rollen-und-rechtekonzept.md:109` (Vier-Augen
„Ersteller ≠ Freigeber“) und `:156` (nicht abschaltbar); legalRef von R-TRANS-05 („Nicht umgesetzt: … kein Guard“)
**Depends on:** 019, 010, 080 (gemergt)
**Perspektive:** Legal/Security · **Glossar: neue Begriffe:** nein
**Bedrohungs-IDs:** MF-07 „Selbstfreigabe über Rollenwechsel oder Vertretung“ (dieser Guard ist die Kernabwehr; Rollen-
wechsel im Demo-Umschalter bleibt personengleich über die Akteur-id, siehe unten)

## Festlegung des Architekten

Der Planeintrag 021 umfasst drei unabhängige Teile. Nach Lesen des Codes wird er geteilt:

- **021a (diese Scheibe):** R-GUARD-06 „Ersteller der letzten Version ≠ Freigeber“ auf R-TRANS-05. Nur Kern.
- **021b:** Rolle `coordination` (classify/assign/forward/round.assemble), capture verliert classify/assign,
  Demo-Persona, e2e-Personas, Abnahmesatz.
- **021c:** `question.legal.clear` für legal statt approve, R-GUARD-07 mit `LEGAL_GATE_BY_TRACK`, Seed mit
  `QuestionLegalCleared`.

Gelesen: `Guard.check(q, payload)` kennt den Akteur nicht; `can()` (api.ts) und der Schreibweg (api.ts, Aufruf von
`resolveTransition`) haben ihn. `AnswerVersion.createdBy` ist ein `Actor` mit `id`. Die Rolle `legal` hält heute sowohl
`answer.draft` als auch `question.approve`.

- Der Guard vergleicht **Akteur-ids, nie Rollen** (Regel 4): Freigabe verweigert, wenn `actor.id` gleich
  `createdBy.id` der **letzten** Antwortversion ist. Personengenau gilt das nur mit Einzelidentitäten (B18); in der Demo
  ist jede Persona eine Identität. Hat eine andere Person eine neue Version angelegt, darf die frühere Erstellerin
  freigeben (maßgeblich ist die freizugebende Version).
- `resolveTransition` erhält den Akteur als zusätzlichen Kontext (z. B. `ctx: { actor }`), `Guard.check` ebenso; alle
  bestehenden Guards ignorieren ihn. `can()` reicht den Akteur durch, damit `_actions` die Freigabe für die Erstellerin
  gar nicht erst anbietet (die Oberfläche rendert `_actions`, keine Web-Änderung nötig).
- **Nicht abschaltbar:** kein Schalter, keine Option, keine Rolle (auch `admin` nicht) umgeht den Guard.
- Verweigerung: 409 mit `ruleId: 'R-GUARD-06'` wie die übrigen Guards.

## Ziel

1. Guard R-GUARD-06 in `transitions.ts` an R-TRANS-05, mit ehrlichem legalRef (Rechtekonzept :109, :156;
   `verified: false`). Der legalRef von R-TRANS-05 streicht den Satz „es gibt keinen Guard Ersteller ≠ Freigeber“ und
   verweist auf R-GUARD-06; der Rest (kein Freigabevermerk, keine Versiegelung) bleibt.
2. Tests (zuerst, rot vor der Änderung):
   - legal entwirft Version 1 und versucht die Freigabe → 409 R-GUARD-06, kein Ereignis;
   - `admin` entwirft und gibt frei → 409 R-GUARD-06 (keine Rolle umgeht ihn);
   - expert entwirft, approver gibt frei → erlaubt; legal entwirft v1, expert v2, legal gibt v2 frei → erlaubt;
   - `_actions` der Erstellerin enthält `question.approve` nicht, die einer anderen Person schon;
   - über HTTP: 409 mit `ruleId` R-GUARD-06 (`apps/api` negative.test.ts).
3. `docs/legal-trace.md` und `packages/domain/policy-truth-table.md` nur über die Snapshot-Tests neu erzeugt; Diff prüfen.
4. `docs/produktplan-beta.md`: Eintrag 021 geteilt (021a, 021b, 021c), vom Architekten.

## Nicht-Ziele

Koordinationsrolle (021b), Rechtsfreigabe und Rechtstor (021c), Freigabevermerk, Versiegelung, Web-Änderungen,
Vertragsänderung (der Vertrag nennt 409 für die Freigabe bereits; falls nicht: im Bericht melden, nicht ändern).

## Files allowed

- `packages/domain/src/{transitions,api,rules,permissions}.ts`
- `packages/domain/src/__tests__/{transitions,api,rules}.test.ts`
- `apps/api/src/__tests__/{negative,rule-register}.test.ts`
- `docs/legal-trace.md`, `packages/domain/policy-truth-table.md` (nur generiert)
- `docs/produktplan-beta.md` (nur Eintrag 021 und die neuen 021a–c, vom Architekten), `docs/slices/021a-vier-augen-freigabe.md`

## Akzeptanzkriterium

1. Die Tests aus Ziel 2 vor der Änderung rot (Ausgabe im Bericht), danach grün.
2. Volle e2e-Suite grün (Anzahl nennen); bricht ein Szenario, weil dieselbe Persona entwirft und freigibt, **anhalten und
   melden** (keine e2e-Datei ist erlaubt).
3. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/s021a`, Branch `claude/slice-021a-vier-augen` (vom Architekten angelegt).
- Playwright auf eigenem Port (5194), Chromium unter `/opt/pw-browsers`; danach `git checkout -- docs/evidence`.
- Logs nur über `mktemp`. Commits nennen „Scheibe 021a“ und enden mit `[skip netlify]`. Nicht pushen.

## Bericht

```
Slice: 021a-vier-augen-freigabe
Done: R-GUARD-06 an R-TRANS-05: Freigabe verweigert, wenn actor.id = createdBy.id der letzten Version; Akteur als
      Pflichtkontext in resolveTransition/Guard.check (kein Aufrufer kann ihn weglassen), can() und Schreibweg reichen ihn
      durch, _actions ohne Freigabe für die Erstellerin; keine Rolle, auch nicht die mit allen Rechten, umgeht ihn.
      legalRefs R-TRANS-03/05 verweisen auf R-GUARD-06; policy-truth-table unverändert (rollen-, nicht personenabhängig).
Evidence: rot vor der Änderung: domain „Tests 6 failed | 93 passed (99)“ (u. a. „legal drafts version 1 and tries to
      approve it: 409 R-GUARD-06, no event“, „admin drafts and approves“, „the same person under another role“,
      „_actions: the creator is not offered question.approve“); api „409: legal approving its own answer version …
      expected 200 to be 409“. Danach grün. e2e voll auf 422af80: 117 passed (5.5m).
      pnpm gates auf 9915fe8 grün (domain 128, web 181, api 65), Schluss wörtlich:
      ✓ built in 1.31s
      mark-test-run: wrote /home/user/wt/s021a/.claude/state/last-test-run (clean tree) at commit 9915fe8, tree 56ab1c9e7b6a…
      MF-07: Nachweise transitions.test.ts, api.test.ts, apps/api negative.test.ts; Erkennung offen (verweigerter Versuch
      erzeugt kein Ereignis; Protokoll mit 033), eingetragen in docs/sicherheit/bedrohungsmodell.md (d908538, PR #40).
Open: Ein Test „keine Konfiguration schaltet den Guard ab“ entfällt: es gibt keine Konfigurationsstelle, der Guard steht
      fest in der Tabelle. Die Erstellerin, die eine ältere fremde Version freigibt, bekommt R-GUARD-04 (fachlich richtig).
      Review R1: 0/0/2 + 3 nit; minor 1 (MF-07) und minor 2 (legalRef nennt Demo-Adapter, 9915fe8) behoben, nit 3
      (Pfad der Wahrheitstabelle) hier korrigiert.
Touched: packages/domain/src/{transitions,api}.ts, __tests__/{transitions,api}.test.ts;
      apps/api/src/__tests__/negative.test.ts; docs/legal-trace.md (generiert)
```
