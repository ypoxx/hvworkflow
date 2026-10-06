# takt-055 — Stack-Build ohne Bake-Berechtigungsabfrage (BUILDX_BAKE_ENTITLEMENTS_FS=0)

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

`scripts/stack.mjs` setzt in der Umgebung aller Compose-Aufrufe des Stacks `BUILDX_BAKE_ENTITLEMENTS_FS=0`: Bake prüft die
Dateisystem-Berechtigung für das Build-Secret außerhalb des Build-Kontexts nicht mehr ab. Das Secret bleibt ein Build-Secret
(kein Wechsel zu Build-Args). Die Bake-Definition erzeugt Compose aus der versionierten `compose.yaml`, nicht aus fremder Quelle.

**Nachtrag (Codex P1 auf #175):** Der erste Ansatz `COMPOSE_BAKE=false` wirkt unter Compose v5 nicht (v5 hat den eigenen
Builder entfernt und baut immer über Bake; der Läufer und `docs/evidence/037a-installation-befolgt.txt` nennen Compose 5.1.1).
Compose kennt keinen Schalter, die Freigabe `--allow=fs.read=…` an Bake durchzureichen; die Abschaltung der Prüfung über die
Umgebung ist der kleinste Eingriff, der das Build-Secret im Zustandsverzeichnis lässt.

## Nicht-Ziele

- Keine Änderung an `deploy/compose/compose.yaml`, an den Dockerfiles oder am Secret-Verfahren.
- Kein Umzug des Secrets in den Build-Kontext (es bleibt außerhalb des Repos, wie 037a es verlangt).

## Abnahme

- `scripts/stack.test.mjs`: `upPlan(...).env.BUILDX_BAKE_ENTITLEMENTS_FS === '0'` (zuerst rot).
- `pnpm gates` grün; CI `stack-037a` grün im PR-Lauf.

## Files allowed

- `scripts/stack.mjs` (nur `upPlan`)
- `scripts/stack.test.mjs` (nur ein Fall)
- `docs/slices/takt-055-compose-bake.md`
