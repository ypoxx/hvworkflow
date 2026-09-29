# takt-021 — Nightly wieder grün: gitleaks-Fehlalarme auf Speicherschlüsseln

**Status:** review · **Risikoklasse:** hoch (Secrets-Kontrolle, Leitplanken §4; nach Codex P1 von niedrig korrigiert) · **Lane:** infra · **Perspektive:** Security
**Regeln:** AGENTS.md R2, R11, R12; docs/agentische-entwicklung-plan.md 6.4 (012)
**Ausgangspunkt:** Der Workflow `nightly` ist seit seinem ersten geplanten Lauf rot (Läufe 3–6, 26.–29.09.2026,
zuletzt auf `ccc8725`). Ursache laut Job-Log: der gitleaks-Vollscan über die ganze Historie meldet zwei
`generic-api-key`-Funde, beide Namen von Browser-Speicherschlüsseln, keine Zugangsdaten: die Konstanten
`COLLAPSE_KEY` (`apps/web/src/app/AppShell.tsx`, seit `e4e7a5c`) und `STAGE_CONTRAST_KEY`
(`apps/web/src/features/stage/Page.tsx`, seit `438f105`), jeweils gebunden an ein Literal der Form `hv-<name>-v1`.
Die Zeilen werden hier bewusst nicht wörtlich zitiert: ein Zitat in Markdown löst dieselbe Regel aus (Review-Blocker).
Semgrep und `pnpm audit` liefen wegen des frühen Abbruchs gar nicht.

## Ziel

`scripts/gitleaks.toml` bekommt eine Allowlist für **genau diese zwei Zeilen**: Konstantenname und Literal wörtlich,
geprüft gegen die ganze Zeile (`regexTarget = "line"`, verankert). Jede andere Konstante, jeder andere Wert und jede
Datei bleibt unter der Standardregel. (Erste Fassung erlaubte jede `…_KEY`-Konstante mit `hv-…-vN`-Wert; Codex P1:
zu weit.) Eine zusätzliche Pfadbindung ist mit gitleaks 8.24.3 nicht möglich: ein globaler `[[allowlists]]`-Block wird
ignoriert, und `condition = "AND"` wirkt im globalen `[allowlist]` nicht (Pfad ODER Zeile) — lokal belegt; die
wörtliche Zeile braucht keine Pfadbindung.

## Bedrohungen und Missbrauchsfall

- **T-Q-I-01** (Secrets in Repositorium): die Allowlist darf keinen echten Schlüssel befreien — belegt durch die
  Negativkontrollen unten (fremde Konstante, gleicher Name mit geheimnisartigem Wert, Mischzeile → gemeldet).
- **T-Q-T-03** (Agent macht die eigene Arbeit grün, indem er Tore ändert): eine Allowlist ist genau so ein Eingriff in
  ein Tor; deshalb nur zwei wörtliche Zeilen, Risikoklasse hoch, Security-Review in frischem Kontext.
- **Missbrauchsfall (neu, kein MF-01..08 passt):** Die Allowlist wird später unbemerkt erweitert, um einen echten Fund
  zu unterdrücken. Erkennung: `scripts/**` muss in „Files allowed“ der Spec stehen (Tor `slice-scope`, SC-12), jede
  Änderung an `scripts/gitleaks.toml` läuft durch Review; Signal ist der Diff dieser Datei, Empfänger der Reviewer der
  Scheibe und der Eigentümer über den PR. Keine Kennzahl je Person.

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
- Negativkontrollen (`gitleaks dir` mit der Hauskonfiguration auf Probedateien, Stand nach Codex P1):

| Zeile in `apps/web/src/app/AppShell.tsx` | Ergebnis |
|---|---|
| erlaubte Zeile `COLLAPSE_KEY` bzw. `STAGE_CONTRAST_KEY` mit ihrem Literal | no leaks found |
| `API_KEY` mit Wert in `hv-…-v1`-Form | leaks found: 1 |
| `COLLAPSE_KEY` mit geheimnisartigem Wert in `hv-…-v1`-Form | leaks found: 1 |
| `API_KEY` mit hoher Entropie | leaks found: 1 |
| erlaubte Zeile und `API_KEY` auf derselben Zeile | leaks found: 2 |

  Grundlinie ohne Allowlist: jede dieser Zeilen meldet 1 Fund. Gegenprobe zur Pfadbindung: mit `[[allowlists]]` wurde
  auch die erlaubte Zeile gemeldet (Block ignoriert); mit `condition = "AND"` im `[allowlist]` wurden fremde Datei und
  fremde Konstante unterdrückt (ODER) — beides verworfen.
- `pnpm gates` Exit 0 auf Commit `ebebcaf` (Stand nach Codex-P1-Fix und Security-Review). Wörtlicher Schluss:

```
✓ built in 1.61s
mark-test-run: wrote /home/user/wt/takt-021/.claude/state/last-test-run (clean tree) at commit ebebcaf, tree 4d3457d0c1b9…
EXIT 0
```

- Nightly per `workflow_dispatch` auf diesem Branch (Lauf 7): gitleaks grün; danach erstmals erreichter Semgrep-Schritt
  mit eigenem Befund aus 029b (`gcm-no-tag-length`) → takt-026 (#63).

## Review findings

Codex (ein Lauf beim Ready-Setzen, auf `54bb779`), 2 × P1, beide behoben:
1. **P1:** Allowlist befreite jede `…_KEY`-Konstante mit `hv-…-vN`-Wert → jetzt nur die zwei wörtlichen Zeilen,
   Negativkontrollen oben.
2. **P1:** Änderung an der Secrets-Kontrolle ist nach Leitplanken §4 „hoch“, nicht „niedrig“ → Risikoklasse korrigiert,
   Security-Review in frischem Kontext (Opus) nachgeholt (siehe unten). `downgrade-check` prüft Takt-Specs nicht →
   Folgeliste.


Review in frischem Kontext (reviewer-sonnet, 29.09.2026):

1. **blocker (behoben):** Die erste Fassung dieser Spec zitierte beide Schlüsselzeilen wörtlich; der Vollscan fand
   genau diese zwei Zeilen erneut. Zitate entfernt, Commit vor dem Push ersetzt; Vollscan danach `655 commits scanned …
   no leaks found`.
2. **nit:** Allowlist eng genug (Proben: erlaubter Schlüssel neben echtem `API_KEY` → 1 Fund; Geheimnis auf derselben
   Zeile → 1 Fund; Großbuchstaben im Literal → 1 Fund). Restrisiko: ein Geheimnis nur aus Kleinbuchstaben, Ziffern und
   `-` in der Form `hv-…-vN` ginge durch; vertretbar. (Überholt: seit dem Fix zu Codex P1 sind Name und Wert wörtlich
   festgelegt, dieses Restrisiko besteht nicht mehr.)

Security-Review in frischem Kontext (reviewer, Opus, 29.09.2026, nach Codex): **freigabefähig**. Allowlist dicht
(Proben in `.tsx` und `.py`: nur die zwei wörtlichen Zeilen, auch mit Leerzeichen/CRLF, bleiben ohne Fund; `export
const`, Suffix-Kommentar mit Geheimnis, `-v2`, geheimnisartiger Wert, Kommentarzeile, doppelte Anführungszeichen,
`API_KEY`, AWS-Schlüssel auf derselben Zeile und die Folgezeile → gemeldet); Aussagen zur Pfadbindung bestätigt;
`gates.yml` und `nightly.yml` nutzen dieselbe gepinnte Action mit dieser Konfiguration.
1. major (behoben): Bedrohungs-IDs und Missbrauchsfall fehlten → Abschnitt „Bedrohungen und Missbrauchsfall“.
2. minor (behoben): Kopfkommentar in `scripts/gitleaks.toml` veraltet → gekürzt.
3. nit (behoben): Hinweis, dass die Allowlist global für alle Regeln gilt.
4. nit (behoben): überholte Restrisiko-Aussage markiert.
