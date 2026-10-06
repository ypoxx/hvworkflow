# takt-055 — Stack-Build ohne Bake-Berechtigungsabfrage (COMPOSE_BAKE=false)

**Status:** gebaut · **Risikoklasse:** niedrig (nur das lokale/CI-Stack-Skript; kein Produktcode, kein Vertrag, keine Rechte, keine Daten. Leitplanken §4) · ca. 0,3 AStd · **Lanes:** infra
**Rolle:** Orchestrator baut (kleiner Takt); Review in frischem Kontext
**Regeln:** AGENTS.md R1, R2, R3, R11, R12.
**Depends on:** – · **Glossar: neue Begriffe:** nein

## Anlass

CI `stack-037a` scheitert seit dem 06.10.2026 nachmittags (Lauf 37486240677, PR #173) in der Stufe „Images bauen“, bevor ein
Test läuft: `additional privileges requested: pass "--allow=fs.read=…/hv-tool-stack/build-ca.pem" to grant requested privileges`.
Der Läufer bringt eine neuere Docker-Compose-Version mit, die `compose build` standardmäßig über `buildx bake` ausführt; Bake
verlangt für das Build-Secret `build_ca` (Datei im Zustandsverzeichnis) eine ausdrückliche Lesefreigabe. Ein Lauf eine Stunde
früher (PR #174) war grün.

## Ziel

`scripts/stack.mjs` setzt in der Umgebung aller Compose-Aufrufe des Stacks `COMPOSE_BAKE=false`: Compose baut wie bisher mit
dem klassischen Builder, das Secret bleibt ein Build-Secret (kein Wechsel zu Build-Args, keine neue Berechtigung).

## Nicht-Ziele

- Keine Änderung an `deploy/compose/compose.yaml`, an den Dockerfiles oder am Secret-Verfahren.
- Kein `--allow`-Schalter (er hängt an der Bake-Version und würde den Pfad des Zustandsverzeichnisses in die Befehlszeile tragen).

## Abnahme

- `scripts/stack.test.mjs`: `upPlan(...).env.COMPOSE_BAKE === 'false'` (zuerst rot).
- `pnpm gates` grün; CI `stack-037a` grün im PR-Lauf.

## Files allowed

- `scripts/stack.mjs` (nur `upPlan`)
- `scripts/stack.test.mjs` (nur ein Fall)
- `docs/slices/takt-055-compose-bake.md`
