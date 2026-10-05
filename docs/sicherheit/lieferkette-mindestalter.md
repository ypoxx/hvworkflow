# Lieferkette: Mindestalter für Paketversionen (takt-047)

**Kontrolle zu:** T-Q-T-01 (kompromittierte Abhängigkeit), Reviewer-Checkliste SC-10.
**Fundstellen:** `pnpm-workspace.yaml`, `scripts/release-age.test.mjs`, `scripts/release-age.mjs`.

## Einstellung und Grund

`pnpm-workspace.yaml` setzt `minimumReleaseAge: 10080` (7 Tage in Minuten, Eigentümerentscheidung 05.10.2026). pnpm löst
nur Versionen auf, die mindestens so alt sind. Grund: kompromittierte frische Versionen werden meist binnen Tagen
entdeckt und zurückgezogen (T-Q-T-01). Die Einstellung wirkt nur beim Auflösen (`pnpm add`, `pnpm update`, geänderte
`package.json`), nicht bei `pnpm install --frozen-lockfile`; bereits gesperrte Versionen prüft sie nicht nachträglich.
Der Status von T-Q-T-01 bleibt „teilweise“ (SBOM aus 074 fehlt weiter).

## Format einer Ausnahme

`minimumReleaseAgeExclude` ist standardmäßig leer. Jeder Eintrag steht auf einer Zeile in genau dieser Form; der Test
`scripts/release-age.test.mjs` prüft sie und lehnt jede andere Zeile im Block ab:

```yaml
minimumReleaseAgeExclude:
  - "hono@4.13.13" # GHSA-xxxx-xxxx-xxxx added 2026-10-06 expires 2026-10-13
```

- Eintrag: bevorzugt exakte Version(en) `name@x.y.z` (auch `name@x.y.z||x.y.w`). Ein Namensmuster mit `*` (z. B.
  `"@oxlint/binding-*"`) nur, wenn pnpm für Muster keine Version zulässt und junge Teilpakete desselben Releases sonst
  nicht auflösbar sind; eine Ausnahme muss alle jungen Pakete desselben Releases nennen. Ein bloßer Paketname ist nicht erlaubt.
- Kommentar: Advisory-Kennung (`GHSA-xxxx-xxxx-xxxx` oder `CVE-JJJJ-NNNN`), `added JJJJ-MM-TT`, `expires JJJJ-MM-TT`;
  `expires` liegt höchstens 7 Tage nach `added`. Ein abgelaufener Eintrag lässt den Test scheitern.

## Ausnahmeweg

1. **Anlass:** ein Sicherheitshinweis (GHSA/CVE) ab `moderate` betrifft ein Paket in `pnpm-lock.yaml` (meist sichtbar
   durch `pnpm audit:check`), und die behobene Version ist jünger als 7 Tage. Bequemlichkeit, neue Funktionen oder
   nicht sicherheitsbezogene Fixes sind kein Anlass; dann wird gewartet.
2. **Entscheidung:** der Orchestrator legt eine eigene takt-Spec an (wie takt-041) mit Hinweis, betroffener Version,
   Erreichbarkeit im Code und den Ausnahmeeinträgen; mindestens mittlere Risikoklasse, Review in frischem Kontext mit
   Perspektive Security. Der Eigentümer wird im Bericht benachrichtigt; eine gesonderte Freigabe ist nicht nötig. Ist der
   Hinweis nicht erreichbar oder ein Eintrag in `scripts/audit-exceptions.json` der kleinere Eingriff, wird gewartet.
3. **Eintrag:** dieselbe Scheibe trägt die Ausnahme(n) im Format oben ein, hebt die Abhängigkeit an und prüft mit
   `pnpm install --frozen-lockfile` und `pnpm audit:check`.
4. **Rückbau:** nach `expires` entfernt die nächste Scheibe, die ohnehin baut, den Eintrag (Zeile in
   `docs/folgeliste.md`, falls niemand baut); spätestens der Test erzwingt es.

## Renovate und Dependabot

Es gibt keine Konfiguration dafür. Kommt später eine dazu, muss sie dasselbe Mindestalter setzen (Renovate
`minimumReleaseAge: "7 days"`), sonst schlagen ihre Vorschläge am Install fehl.
