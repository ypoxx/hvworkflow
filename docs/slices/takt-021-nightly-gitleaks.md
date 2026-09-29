# takt-021 — Nightly wieder grün: gitleaks-Fehlalarme auf Speicherschlüsseln

**Status:** review · **Risikoklasse:** niedrig · **Lane:** infra
**Regeln:** AGENTS.md R2, R11, R12; docs/agentische-entwicklung-plan.md 6.4 (012)
**Ausgangspunkt:** Der Workflow `nightly` ist seit seinem ersten geplanten Lauf rot (Läufe 3–6, 26.–29.09.2026,
zuletzt auf `ccc8725`). Ursache laut Job-Log: der gitleaks-Vollscan über die ganze Historie meldet zwei
`generic-api-key`-Funde, beide Namen von Browser-Speicherschlüsseln, keine Zugangsdaten: die Konstanten
`COLLAPSE_KEY` (`apps/web/src/app/AppShell.tsx`, seit `e4e7a5c`) und `STAGE_CONTRAST_KEY`
(`apps/web/src/features/stage/Page.tsx`, seit `438f105`), jeweils gebunden an ein Literal der Form `hv-<name>-v1`.
Die Zeilen werden hier bewusst nicht wörtlich zitiert: ein Zitat in Markdown löst dieselbe Regel aus (Review-Blocker).
Semgrep und `pnpm audit` liefen wegen des frühen Abbruchs gar nicht.

## Ziel

`scripts/gitleaks.toml` bekommt eine eng gefasste Allowlist für genau diese Form: eine Großbuchstaben-Konstante auf
`_KEY`, gebunden an ein kleingeschriebenes Literal `hv-…-vN`, geprüft gegen die ganze Zeile (`regexTarget = "line"`).
Alles andere bleibt unter der Standardregel.

## Nicht-Ziele

Keine Änderung an `nightly.yml` oder `gates.yml`, keine Umbenennung der Schlüssel, keine fingerabdruckbasierte
`.gitleaksignore` (Fingerabdrücke hängen am Commit und brechen beim nächsten Anfassen der Zeile), kein Deployment.

## Files allowed

- `docs/slices/takt-021-nightly-gitleaks.md`
- `scripts/gitleaks.toml`

## Akzeptanz

1. Rot vorher: `gitleaks detect -c scripts/gitleaks.toml` (8.24.3, dieselbe Version wie die Action) über die volle
   Historie meldet 2 Funde.
2. Grün nachher: derselbe Lauf meldet 0 Funde. Negativkontrolle: eine Datei mit `const API_KEY = '<hohe Entropie>'`
   neben einem erlaubten Speicherschlüssel meldet weiterhin genau 1 Fund.
3. `pnpm gates` grün; nach dem Merge ein manueller `workflow_dispatch` von `nightly` (durch den Eigentümer oder den
   Orchestrator, falls berechtigt) als Laufnachweis. Semgrep oder `pnpm audit` könnten danach eigene Befunde zeigen;
   die sind dann eine eigene Scheibe.

## Nachweis (Orchestrator, 29.09.2026)

- Vorher: `653 commits scanned … leaks found: 2`.
- Nachher: `653 commits scanned … no leaks found`.
- Negativkontrolle (`gitleaks dir` auf Probedatei): `leaks found: 1`.

## Review findings

Review in frischem Kontext (reviewer-sonnet, 29.09.2026):

1. **blocker (behoben):** Die erste Fassung dieser Spec zitierte beide Schlüsselzeilen wörtlich; der Vollscan fand
   genau diese zwei Zeilen erneut. Zitate entfernt, Commit vor dem Push ersetzt; Vollscan danach `655 commits scanned …
   no leaks found`.
2. **nit:** Allowlist eng genug (Proben: erlaubter Schlüssel neben echtem `API_KEY` → 1 Fund; Geheimnis auf derselben
   Zeile → 1 Fund; Großbuchstaben im Literal → 1 Fund). Restrisiko: ein Geheimnis nur aus Kleinbuchstaben, Ziffern und
   `-` in der Form `hv-…-vN` ginge durch; vertretbar.
