# Übergabe an die nächste Orchestrator-Sitzung (25.09.2026, abends)

**Integrationsbranch-Kopf bei Übergabe:** `cab1ebb` (090); nach der Fortschreibung vom 26.09. `252f3fe` (080).

Fortschreibung von `docs/bautage/uebergabe-2026-09-25.md`. **Rolle, Grenzen und Auftrag gelten unverändert** (dort
nachlesen, nicht wiederholt): Orchestrator und Architekt, kein Deploy ohne Go, jeder Commit (auch Squash) mit
`[skip netlify]`, keine echten Daten, Budget rund 75 USD, schlanker Review-Modus, Sitzung nach zwei bis drei Merges neu.

## Stand

- Gemergt heute: **029a** Demo-Verriegelung (BF-01 behoben, `fadf21b`, PR #37); **090** Eingaben gehören dem Akteur
  (Datenschutzbefund aus PR #35, `cab1ebb`, PR #38).
- Tagesbericht `docs/bautage/2026-09-25.md` auf Branch `claude/bautag-2026-09-25`, Draft-PR **#36** (offen; am Ende
  des Bautags mergen, enthält auch diese Datei und die Folgelisten-Nachträge).
- Keine laufenden Agenten, keine offenen Scheiben-PRs. Worktrees unter `/home/user/wt/` sind nach frischem Container weg.
- Subagenten-Token heute: 029a ≈ 91 000; 090 ≈ 287 000 (Bau 183 000 inkl. verworfenem ersten Ansatz, Review 104 000).
  Kopfsitzung nicht gezählt. Eigentümer bitten, die Abrechnung zu prüfen (Hälfte des Budgets → Zwischenmeldung).

## Nächste Schritte (Vorschlag)

1. **080** Redezeit und Art zurückbauen, Sprecher-Zustandstabelle R-SPK, Korpus 28/230 (hoch, W2; Abhängigkeiten
   019, 011, 017 gemergt). Kernscheibe, kein Mensch nötig.
2. **021** Koordinationsrolle, Vier-Augen-Guard R-GUARD-06, Rechtstor vor der Bühne R-GUARD-07 (hoch, W2; schließt
   BF-03/BF-04; hängt an 080). Offene Entscheidungen E1/E25/E37 auf Standard bauen und vermerken.
3. Danach 024 (Ereignis-Umschlag v2) → 025 → 026 → 029 (Rest: OIDC, Sperrliste, Notfallkonten; E11 offen → auf
   Standard/Keycloak-Testrealm).

## Lehren von heute

- **Spec-Annahmen am Code prüfen, bevor gebaut wird.** 090 begann mit `key={actor.id}` an den Routen; das brach 25
  Szenarien. Eine Viertelstunde Lesen (welche Felder sind schon dicht?) hätte den ersten Bau gespart.
- **Leck-Tests müssen zu einer Rolle wechseln, die das Feld auch sieht.** Sonst verdeckt das Aushängen jedes Leck (090
  R1 Blocker). Gilt für jede künftige „je Akteur“-Invariante.
- **Planeinträge nie mit globalem `sed` ändern** (090: Eintrag 011 mitgeändert). Zeilengenau per Python mit
  eindeutigem Anker.
- Neue Scheibennummern brauchen einen Eintrag in `docs/produktplan-beta.md` Abschnitt 5 (Tor `downgrade-check`);
  `plan-graph` verlangt ein Datum `TT.MM.JJJJ (Wnn)` und Abhängigkeiten, die in Abschnitt 5 stehen (sonst „—“).
- Nach einem Review-Nachtrag des Orchestrators den Gates-Lauf **im Bericht** nennen (Codex P1 auf #37).
- Dialoge, die ihr Feld per Effekt beim Öffnen leeren, blitzen den alten Text einen Frame lang auf (Codex P1 auf #38). Muster: `key` aus Akteur-id und Dialogart; e2e-Wächter per MutationObserver.
- Hook blockiert `git push` ohne ausdrückliche Remote und Branch: immer `git push origin <branch>`.

## Beim Eigentümer offen

Unverändert aus der vorigen Übergabe; zusätzlich: 029a macht den Dienst ohne `HV_DEMO=1` unbenutzbar (fail closed),
bis 029 den OIDC-Adapter bringt — nur zur Kenntnis.

## Fortschreibung 26.09.2026

- **080** gemergt (PR #39, `252f3fe`), geteilt: **080b** (Korpus 28/230, Umsortierung mit Begründung) steht im Plan und
  ist die nächste Kernscheibe; 021 hängt an 080 und kann jetzt ebenfalls starten.
- Mit 20 USD Restbudget danach **takt-015** (Folgeliste aus 080) gemergt (PR #41, `eb9fe85`); Integrationsbranch-Kopf `eb9fe85`.
- Budget dieser Sitzung aufgebraucht; neue Sitzung nötig. Bericht: `docs/bautage/2026-09-26.md`.
- Lehre: **Vor der Spec auch die Tests lesen, die Zahlen festnageln** (i18n-Schlüsselzahl, Seed-Fingerabdruck,
  Regel-id-Muster, Statusausnahmen in `apps/api/src/__tests__/helpers.ts`), und sie gleich in Files allowed nehmen.
  Das hätte drei Rückfragen gespart.
- Für 043 vorgemerkt (Folgeliste): `SpeakerUpdate.reason`, 409 für `updateSpeaker`, Löschen von `kind`/`requestedMinutes`.
