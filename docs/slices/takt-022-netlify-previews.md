# takt-022 — Netlify baut keine Deploy-Previews mehr

**Status:** review · **Risikoklasse:** hoch (Deployment, Leitplanken §4; zunächst falsch als niedrig geführt, vom Orchestrator nach Codex-P1 auf #60 korrigiert) · **Lane:** infra · **Perspektive:** Security, Betrieb
**Regeln:** AGENTS.md R11 (Deployment nur nach Go), R12; Bedrohungsmodell T-Q-R-01, BF-20
**Ausgangspunkt:** Laut PR-Texten #54 und #57 hat Netlify beim Anlegen der PRs Deploy-Previews gebaut, bevor
`[skip netlify]` im Titel stand. `netlify.toml` hat keinen `ignore`-Befehl; Netlify baut daher jeden Kontext
(production, deploy-preview, branch-deploy), sobald ein Build-Anlass ohne Überspring-Marke kommt.

## Ziel

`netlify.toml` bekommt im `[build]`-Block einen `ignore`-Befehl: außerhalb des Kontexts `production`
(Netlify-Build-Variable `CONTEXT`) endet der Build sofort mit Exit 0 (Netlify: „überspringen“). Deploy-Previews und
Branch-Deploys veröffentlichen damit nichts mehr, egal was in Titel oder Commit steht. Für `production` entfällt
Netlifys Standard-Diff-Prüfung (`git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF`); weil jeder echte Commit an der
Repo-Wurzel etwas ändert, ist der Unterschied praktisch null (nur ein Neubau ohne Änderung baute bisher nicht). Die
Sperre bleibt `[skip netlify]` im Commit, die Netlify vor dem `ignore`-Befehl prüft.

## Bedrohungen und Missbrauchsfall

- **T-Q-R-01 / BF-20** (Auslieferung ohne nachvollziehbares Go): Previews und Branch-Deploys sind aus dem Repo heraus
  gesperrt; der Produktions-Build bleibt offen bis 037 (Approval-Environment).
- **Missbrauchsfall (neu, kein MF-01..08 passt):** ungewollte Veröffentlichung über eine Deploy-Preview (etwa ein PR,
  dessen erster Commit oder Titel die Überspring-Marke nicht trägt). Erkennung: Netlify-Deploy-Protokoll zeigt einen
  veröffentlichten Preview-Deploy statt „skipped“; Signal ist dieser Protokolleintrag, Empfänger der Eigentümer (einzige
  Person mit Netlify-Zugang). Vollständige Sperre nur über die Projekteinstellung (siehe Akzeptanz 3).

## Nicht-Ziele

Keine Änderung an den Netlify-Projekteinstellungen (das ist Sache des Eigentümers), keine Änderung an Build-Befehl,
Headern oder CSP (037), kein Deployment.

## Files allowed

- `docs/slices/takt-022-netlify-previews.md`
- `netlify.toml`
- `docs/sicherheit/bedrohungsmodell.md` (nur die verschobenen Zeilenverweise auf `netlify.toml` und die Beschreibung von T-Q-R-01/BF-20)

## Akzeptanz

1. Der Befehl selbst lokal geprüft: `CONTEXT=deploy-preview` und `CONTEXT=branch-deploy` → Exit 0 mit Hinweis,
   `CONTEXT=production` → Exit 1 (Build läuft).
2. `pnpm gates` grün.
3. Wirksamkeit auf Netlify zeigt erst der nächste PR (Deploy im Netlify-Protokoll „Canceled/skipped“ statt „Published“).
   Sicherer und vollständig ist zusätzlich die Einstellung im Netlify-Projekt: *Deploy Previews: None* und
   *Branch deploys: None*. Die setzt nur der Eigentümer.

## Nachweis (Orchestrator, 29.09.2026)

Befehl aus `netlify.toml` (per `tomllib` gelesen) je Kontext unter `bash -u` ausgeführt (Stand nach Review):

```
skip: context deploy-preview
'deploy-preview' -> exit 0
skip: context branch-deploy
'branch-deploy' -> exit 0
skip: context unset
'' -> exit 0
'production' -> exit 1
skip: context unset
unset -> exit 0
```

`pnpm gates` Exit 0 auf Commit `a756dbd` (Stand nach Review und `CONTEXT`-Härtung). Wörtlicher Schluss:

```
✓ built in 2.14s
mark-test-run: wrote /home/user/wt/takt-022/.claude/state/last-test-run (clean tree) at commit a756dbd, tree ca17624eb199…
EXIT 0
```

## Review findings

Review in frischem Kontext (reviewer-sonnet, 29.09.2026), Urteil „reparieren (klein)“, alles behoben:

1. **minor (behoben):** Verweis `netlify.toml:1-4, 14-19` in Zeile 28 des Bedrohungsmodells nicht verschoben → `17-22`.
2. **minor (behoben):** T-Q-R-01 und BF-20 sprachen vom „Demo-Build bei jedem Push“; jetzt „Produktions-Build“, mit
   Hinweis auf den `ignore`-Befehl.
3. **nit:** `ignore` korrekt und fail-safe (leeres `CONTEXT` → übersprungen; Quoting als TOML-Literal-String hält
   `"$CONTEXT"` für die Shell); vollständige Sperre bleibt die Netlify-Einstellung des Eigentümers.

Codex (ein Lauf beim Ready-Setzen): 1 × P1 — Gates-Nachweis nannte einen nicht erreichbaren Commit und keinen
wörtlichen Schluss → Gates auf `41e0f62` erneut gelaufen, Schluss oben eingetragen.

Review in frischem Kontext (reviewer, Opus, Perspektive Security/Betrieb, 29.09.2026, nach Höherstufung auf „hoch“):
Befehl korrekt und fail-safe (lokal: `production` → 1; `deploy-preview`, `branch-deploy`, `dev`, leer, ungesetzt,
`Production`, `"production "`, `"x;exit 1"` → 0; kein Injektionsweg).
1. major (behoben): Missbrauchsfall fehlte (SC-06) → Abschnitt „Bedrohungen und Missbrauchsfall“.
2. minor (behoben): „production verhält sich wie bisher“ ungenau → präzisiert (Standard-Diff-Prüfung entfällt).
3. nit (behoben): `"${CONTEXT:-}"` statt `"$CONTEXT"` (robust auch unter `bash -u`).
