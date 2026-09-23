# 009 — Leitplanken 008 konsolidieren, ADR 0001 zur Annahme vorlegen, Repositorium aufräumen

**Status:** review (Nacharbeitsrunde 1 erledigt)
**Risikoklasse:** niedrig · 1,5 AStd · Kalender 28.09.2026 (W1) · Lane: docs-plan (+ `docs/adr/0001-*` als Architekt)
**Rolle/Modell:** Architekt (Orchestrator, Opus 5.5 in der Rolle des Architekten) · Review Fable 5.1
(Regel 3: der Plan sieht Review Opus vor; weil Opus hier baut, reviewt Fable)
**Rule ids:** AGENTS.md Regeln 1, 2, 3, 7, 11, 12
**Quellen-IDs:** Audit-Befund A4 (Produktplan 2.1); Plan 5.2 Scheibe 009; Plan 4 (ADR 0001 „operativ
bindend über die Leitplanken"); Register E23, E42; Risiko „Scheibe 008 bringt eine zweite Arbeitsordnung" (Plan 9)
**Depends on:** —
**Perspektive:** — (reine Doku) · **Glossar: neue Begriffe:** nein

## Ziel

1. **Leitplanken übernehmen und kürzen.** `docs/qualitaetsleitplanken-produktreife.md` vom Codex-Branch
   (`origin/codex/bewertungsbericht-zum-hv-tool-erstellen`, e4ef4e1, 506 Zeilen) übernehmen und um mindestens
   ein Drittel kürzen: **≤ 340 Zeilen**. Kürzen heißt: Doppelungen mit AGENTS.md, Produktplan und Rechtekonzept
   entfernen, Checklisten zusammenfassen; kein Inhalt wird durch eine neue Regel ersetzt.
2. **Die sieben Befunde einarbeiten.**
   - B1 *ADR 0001 operativ bindend:* Die drei Grenzen aus ADR 0001 gelten für jede Scheibe ab sofort als
     verbindliche Leitplanke, obwohl der ADR formal „vorgeschlagen" ist; die formale Annahme erfolgt an
     Prüfpunkt 1 (E42). Die Zeile „Annahme, Ablösung oder Anpassung der vorgeschlagenen ADR 0001" verschwindet
     aus den offenen Entscheidungen.
   - B2 *Regel 7 nicht verhandelbar:* Die offene Entscheidung „Event Sourcing oder Zustand + Audit/Outbox"
     entfällt; Ereignisse sind nur anhängend, Zustand ist Projektion (AGENTS.md Regel 7). Offen bleibt nur die
     Speicherform (Plan 3, ADR 0003 vorgeschlagen).
   - B3 *Perspektiven auf heutige Rollen:* Security, Datenschutz, Legal, Betrieb, UX sind Checklisten, die
     auf bestehende Rollen abgebildet werden (Reviewer mit benannter Perspektive, Design-Kritik, Sicherheitsreview
     des Architekten an den Prüfpunkten 3, 4, 7, Eigentümer). Keine neue Agentenrolle; fehlt eine Fachperson,
     wird das eine Registerzeile, nicht ein „blockiert".
   - B4 *Mensch entscheidet Herabstufung:* Unklare Einstufung gilt als hoch; herabstufen darf nur der Mensch
     mit der Zeile „Herabstufung freigegeben von <Mensch> am <Datum>" in der Spec (Tor ab 016).
   - B5 *Betriebsrat und Rechtsprüfung als Registerzeilen:* Die Einzelprüfungen „DSFA-/Mitbestimmungsrelevanz"
     und „Rechtsabteilung hat Legal Traces geprüft" sind keine Merge-Bedingung je Scheibe, sondern die
     Registerzeilen E13/E14 (Betriebsrat/DSFA) und E15 (Rechtsprüfung) mit Standardannahme
     (`verified:false`, Markierung „ungeprüft"; nur synthetische Daten). Bis 014 das Register anlegt, stehen
     die beiden Zeilen im Leitplanken-Dokument mit Vermerk „Übernahme durch 014".
   - B6 *Um ein Drittel kürzen:* siehe 1.
   - B7 *Ein durchgerechnetes Beispiel:* Eine reale Scheibe des Plans (021 Koordinationsrolle, Vier-Augen,
     Rechtstor) wird einmal vollständig durch das Dokument geführt: ausgelöste Bereiche, Risikoklasse,
     Perspektiven und Rollen, Nachweise, offene Entscheidungen mit Registernummer.
3. **Offene Entscheidungen** des Codex-Dokuments (Abschnitt 11) werden auf die Registernummern des Plans
   (Abschnitt 10, E1–E49) abgebildet statt als eigene Liste geführt.
4. **Vorlage zur Annahme von ADR 0001** an Prüfpunkt 1 (E42): neue Datei `docs/adr/0001-vorlage-annahme.md`
   (was angenommen wird, was nicht, Nachweise, Entscheider, Unterschriftsfeld mit Datum leer). ADR 0001 selbst
   bleibt inhaltlich unverändert (Plan 4: „keine inhaltliche Änderung").
5. **Arbeitsordnung bleibt eine.** AGENTS.md bleibt die einzige Arbeitsordnung; das Leitplanken-Dokument sagt
   das im ersten Absatz, AGENTS.md verweist in einer Zeile darauf. README-Index erhält je eine Zeile für
   Leitplanken und Annahmevorlage.
6. **Aufräumen.** `.claude/worktrees/agent-*` sind im Repositorium nicht versioniert (`git ls-files` leer) und
   `.claude/worktrees/` steht bereits in `.gitignore` (ripgrep und das Grep-Werkzeug beachten das); im
   Repositorium ist nichts zu entfernen. Lokale Kopien beim Umsetzer räumt `git worktree prune` auf
   (Bericht). Die Spec 008 des Codex-Branches wird als
   `docs/slices/008-produktreife-qualitaetsleitplanken.md` übernommen (Herkunft der Leitplanken, Status
   „ersetzt durch 009"). Der Codex-Branch wird nach dem Merge dieser Scheibe gelöscht (E23, Orchestrator).

## Nicht-Ziele

- Keine Änderung an Code, Vertrag, Regeln, Rechten, Übergängen, CI.
- Kein Entscheidungsregister anlegen (014), keine neuen ADRs (015), keine Agentendefinitionen (016).
- Keine neue Regel in AGENTS.md; nur ein Verweis.

## Files allowed

- `docs/qualitaetsleitplanken-produktreife.md` (neu)
- `docs/adr/0001-vorlage-annahme.md` (neu)
- `docs/slices/008-produktreife-qualitaetsleitplanken.md` (übernommen, Statuszeile angepasst)
- `docs/slices/009-leitplanken-konsolidierung.md` (diese Datei)
- `AGENTS.md` (eine Verweiszeile), `README.md` (Indexzeilen)

## Akzeptanzkriterium

1. `wc -l docs/qualitaetsleitplanken-produktreife.md` ≤ 340 (Codex-Stand 506).
2. Jeder der Befunde B1–B5 und B7 ist mit Abschnittsnummer im Dokument auffindbar (Tabelle im Bericht).
3. Das Dokument enthält die Zeilen „Betriebsrat/DSFA" (E13/E14) und „Rechtsprüfung" (E15) mit Standardannahme
   und Vermerk „Übernahme durch 014".
4. `docs/adr/0001-vorlage-annahme.md` existiert; `git diff` auf `docs/adr/0001-schichtung-und-vertragskopplung.md` ist leer.
5. Keine Stelle im Dokument führt eine neue Rolle, ein neues Tor oder eine zweite Arbeitsordnung ein.
6. Die Abschnitte 9.1 „Produktionsfundament", 9.2 „Pilotbereit", 9.3 „Produktionsbereit" behalten Nummer
   und Namen, weil der Produktplan (Abschnitte 1, 5.4, 5.8, 5.10, 7) darauf verweist.
7. `pnpm gates` grün.
8. Nach dem Merge: `git ls-remote origin` ohne `codex/bewertungsbericht-zum-hv-tool-erstellen` (Orchestrator, E23).

## Nachweise

Zeilenzahl-Diff 506 → n, Befund-Tabelle, Registerzeilen im Dokument, Annahmevorlage, `pnpm gates`,
nach dem Merge `git ls-remote` ohne Codex-Branch.

## Bericht

```
Slice: 009-leitplanken-konsolidierung
Done: Leitplanken vom Codex-Branch übernommen und von 506 auf 340 Zeilen gekürzt (Wörter 4137 → 3419,
      Zeichen 32297 → 26151; darin neu: Perspektiven-Tabelle, Registerzeilen, Beispiel 021); die sieben
      Befunde eingearbeitet; ADR-0001-Annahmevorlage; Verweis in AGENTS.md, zwei Indexzeilen im README;
      Spec 008 als Herkunft übernommen (Status superseded).
Evidence: git diff auf docs/adr/0001-schichtung-und-vertragskopplung.md leer; wc -l Leitplanken = 340;
      pnpm gates nach der Nacharbeit (exit 0), Ausschnitt:
        packages/domain test:       Tests  39 passed (39)
        apps/web test:       Tests  9 passed (9)
        apps/api test:       Tests  25 passed (25)
        > node scripts/vocabulary-check.mjs
        vocabulary-check: ok
        > @hv/web@0.0.0 build /home/user/wt/009/apps/web
        ✓ built in 1.12s
Open: Codex-Branch wird nach dem Merge gelöscht (E23, Orchestrator). .claude/worktrees/ ist bereits in
      .gitignore und nicht versioniert — im Repositorium nichts zu entfernen; lokal beim Umsetzer ggf.
      `git worktree prune`.
Touched: docs/qualitaetsleitplanken-produktreife.md (neu), docs/adr/0001-vorlage-annahme.md (neu),
      docs/slices/008-produktreife-qualitaetsleitplanken.md (übernommen), docs/slices/009-… (diese Datei),
      AGENTS.md (+2 Zeilen Verweis), README.md (+2 Indexzeilen)
```

| Befund | Fundstelle im Dokument |
|---|---|
| B1 ADR 0001 operativ bindend | 1.1 (Quellenstatus), 1.3 (Grenzen, Blocker im Review), 11 (entfällt als offene Frage, E42); Vorlage `docs/adr/0001-vorlage-annahme.md` |
| B2 Regel 7 nicht verhandelbar | 1.3 zweiter Absatz; 11 Abbildung („Event Sourcing oder Zustand → entfällt") |
| B3 Perspektiven auf heutige Rollen | 5 (Tabelle Perspektive → Rolle), 7 (Spalte Rolle) |
| B4 Mensch entscheidet Herabstufung | 4 (letzter Absatz), 3 (Zeile im Planungsblock) |
| B5 Betriebsrat und Rechtsprüfung als Registerzeilen | 6.6 (keine Merge-Bedingung), 6.1 Blocker, 11 (Zeilen E13/E14 und E15, „Übernahme durch 014") |
| B6 um ein Drittel kürzen | 506 → 340 Zeilen |
| B7 durchgerechnetes Beispiel | 12 (Scheibe 021) |

Abschnitte 9.1, 9.2, 9.3 tragen Nummer und Namen wie im Codex-Stand (Plan verweist darauf).

## Review findings

**Runde 1 — Review Fable 5.1** (frischer Kontext, Spec und Diff, 23.09.2026): 0 blocker / 1 major / 10 minor, Urteil
„rework required — eine kurze Runde". Bestätigt ohne Befund: Zeilenzahl, Fundstellen B1–B7, Registerzeilen E13/E14/E15,
vollständige Abbildung der 20 Codex-Entscheidungen auf E-Nummern, 9.1–9.3, Beispiel 021 gegen Plan 5.3, ADR 0001
unverändert, keine neue Rolle/Tor/Arbeitsordnung, Dateiumfang. Nacharbeit durch den Umsetzer (Orchestrator):

| # | Schwere | Befund | Erledigung |
|---|---|---|---|
| 1 | major | Vorlage ADR 0001, Nachweis Grenze 1: „Oberfläche nutzt nur `apps/web/src/api`" stimmt nicht — Features importieren `etagOf`, `QUESTION_STATUSES`, `TERMINAL_STATUSES`, `TRACKS`, `STAGE_ASSIGNMENTS` aus `@hv/domain` | Zelle berichtigt, Befund als „Offen" mit Fundstellen; Abhängigkeitsregel an 012 übergeben |
| 2 | minor | Zitate: `can()` liegt in `api.ts`; „kein Upcaster" ist die geplante Ergänzung zu ADR 0002; Changelog nicht aus Regel 6 | berichtigt (1.1, 6.3, 6.4) |
| 3 | minor | Plan 6.3: nach einer Runde zurück an den Planer, nach zwei an den Architekten | berichtigt (7) |
| 4 | minor | ADR 0003–0016 werden an Prüfpunkten 1 bis 5 angenommen | berichtigt (Vorlage) |
| 5 | minor | `api.ts:153` fällt auf `new Date()` zurück; „noch Uhr" ungenau | Vorlage nennt beide Befunde; 1.3 Punkt 2 „keine eigene Uhr, nur Clock-Port" |
| 6 | minor | „Was die Klasse auslöst" → „Was aus der Klasse folgt" | berichtigt (4) |
| 7 | minor | „zwei Grenzen" kollidiert mit den drei Grenzen aus ADR 0001 | „zwei Festlegungen" (1, 1.3) |
| 8 | minor | „Die Spec nennt ihre Stufe" ist eine neue Anforderung | „kann … im Planungsblock (3) nennen" |
| 9 | minor | Ungenehmigt weggefallen: Backup-Umfang, Sitzungsentzug/Break-Glass, Ausnahmen mit Eigentümer und Ablauf, Betroffenenauskunft | wieder aufgenommen (6.3, 6.5, 2, 6.6) |
| 10 | minor | AGENTS.md: zwei physische Zeilen statt einer | auf eine Zeile gekürzt |
| 11 | minor | Status und Evidence-Format | Status „review", echter `pnpm gates`-Ausschnitt |
