# takt-022 — Netlify baut keine Deploy-Previews mehr

**Status:** review · **Risikoklasse:** niedrig · **Lane:** infra
**Regeln:** AGENTS.md R11 (Deployment nur nach Go), R12; Bedrohungsmodell T-Q-R-01, BF-20
**Ausgangspunkt:** Laut PR-Texten #54 und #57 hat Netlify beim Anlegen der PRs Deploy-Previews gebaut, bevor
`[skip netlify]` im Titel stand. `netlify.toml` hat keinen `ignore`-Befehl; Netlify baut daher jeden Kontext
(production, deploy-preview, branch-deploy), sobald ein Build-Anlass ohne Überspring-Marke kommt.

## Ziel

`netlify.toml` bekommt im `[build]`-Block einen `ignore`-Befehl: außerhalb des Kontexts `production`
(Netlify-Build-Variable `CONTEXT`) endet der Build sofort mit Exit 0 (Netlify: „überspringen“). Deploy-Previews und
Branch-Deploys veröffentlichen damit nichts mehr, egal was in Titel oder Commit steht. Der Kontext `production`
verhält sich wie bisher; `[skip netlify]` im Commit bleibt dort die Sperre.

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

Befehl aus `netlify.toml` (per `tomllib` gelesen) je Kontext ausgeführt:

```
skip: context deploy-preview
deploy-preview -> exit 0
skip: context branch-deploy
branch-deploy -> exit 0
production -> exit 1
```

## Review findings

Review in frischem Kontext (reviewer-sonnet, 29.09.2026), Urteil „reparieren (klein)“, alles behoben:

1. **minor (behoben):** Verweis `netlify.toml:1-4, 14-19` in Zeile 28 des Bedrohungsmodells nicht verschoben → `17-22`.
2. **minor (behoben):** T-Q-R-01 und BF-20 sprachen vom „Demo-Build bei jedem Push“; jetzt „Produktions-Build“, mit
   Hinweis auf den `ignore`-Befehl.
3. **nit:** `ignore` korrekt und fail-safe (leeres `CONTEXT` → übersprungen; Quoting als TOML-Literal-String hält
   `"$CONTEXT"` für die Shell); vollständige Sperre bleibt die Netlify-Einstellung des Eigentümers.
