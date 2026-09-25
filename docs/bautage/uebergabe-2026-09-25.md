# Übergabe an die nächste Orchestrator-Sitzung (25.09.2026)

Lies zuerst `AGENTS.md` (Regel 3 enthält jetzt den schlanken Review-Modus), dann diese Datei, dann nur die Teile von
`docs/produktplan-beta.md`, die du für die Auswahl brauchst. Den langen Tagesbericht `docs/bautage/2026-09-23.md` nur
bei Bedarf.

## Rolle und Grenzen (unverändert, verbindlich)

- Du bist Orchestrator und Architekt (Opus 5.5): Specs zuerst in `docs/slices/`, Bau und Review durch Agenten
  (`.claude/agents/`), Merge per Squash durch dich nach E48 (grüne CI auf dem letzten Commit, kein offener Blocker oder
  Major).
- Integrationsbranch: `claude/dax-shareholder-meeting-workflow-0s934z`. Scheiben-Branches `claude/slice-NNN-*`, Takte
  `claude/takt-NNN-*`, Tagesbericht `claude/bautag-JJJJ-MM-TT`.
- **Kein Deploy ohne das Go des Eigentümers** (nicht Staging, nicht Übungsmandant, nicht die Netlify-Demo). **Jeder
  Commit, auch der Squash-Merge, trägt `[skip netlify]`.** Keine echten Daten, keine Zugangsdaten.
- Offene Entscheidungen auf dem Standard bauen und als „auf Standard gebaut“ vermerken.

## Auftrag des Eigentümers (25.09.2026)

- **Budget: rund 75 USD Guthaben.** Ziel: dem Betastatus so nah wie möglich kommen, **ohne Menschen einzubeziehen**
  (keine Rechtsprüfung, kein Pentest, kein Betriebsrat, kein Staging).
- **Schlanker Review-Modus** (AGENTS.md Regel 3): ein Review je Scheibe; zweite, enge Nachprüfung nur bei Blocker/Major;
  Minor/Nit/P2 → `docs/folgeliste.md`, keine Nacharbeit; Codex einmal bei „ready“, nur P0/P1 oder
  Sicherheit/Recht/Datenschutz halten den Merge. Wichtige und komplizierte Scheiben: Opus baut und prüft; niedrige
  Risikoklasse: Review mit Sonnet zulässig. Kein Politurbau (Kandidat 010e liegt in der Folgeliste und wartet).
- **Sitzungen früh neu starten**, um Token zu sparen: nach zwei bis drei gemergten Scheiben oder wenn der Kontext groß
  wird, diese Datei fortschreiben (neue Datei mit Datum) und eine frische Sitzung beginnen.
- Kosten in Euro sind aus der Sitzung nicht messbar; Subagenten-Token je Scheibe im Tagesbericht erfassen und den
  Eigentümer bitten, die Abrechnung zu prüfen.

## Stand

- Integrationsbranch-Kopf bei Übergabe: `cdd4f4e` (089 Zielbild) plus takt-014 (diese Datei). Keine offenen PRs,
  keine laufenden Agenten, keine Worktrees (frischer Container).
- Gemergt bis heute (Auswahl): 009, 010, 010b, 010c, 010d, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 023, 039,
  082, 089, takt-001 bis takt-013 (ohne Lücken prüfen: `git log --oneline` auf dem Integrationsbranch).
- Letzte Nachweise: 010d `ba2dca7` — `pnpm gates` grün, Playwright 96/96.

## Lehren (damit es billiger wird)

- Review-Schleifen kosten mehr als der Bau (010c: vier Runden ≈ 969 000 Token). Gegenmittel: in der Spec je Ansicht die
  Invarianten nennen; der Bauer testet sie unter den Reihenfolgen, die sie brechen; zweifache Wiederholungsläufe
  (`--repeat-each=3`) und ein Lauf unter `taskset -c 0,1` mit 1 Worker vor dem Bericht.
- Specs vollständig schreiben: bei Oberfläche `docs/evidence/NNN-*.png` in Files allowed; bei neuen Texten die
  i18n-Dateien **und** `apps/web/src/i18n/parity.test.ts` (Schlüsselzahl).
- e2e: berechnete Stile mit `expect.poll` lesen (Farbübergänge); Module im Seitenkontext einmal laden, kein `import()`
  je Hilfsaufruf.
- CI-Schwankung ist kein Grund zum Neustart: Ursache beheben, mit Wiederholungen belegen.
- Playwright je Agent auf eigenem Port; Chromium unter `/opt/pw-browsers`; nach Läufen `git checkout -- docs/evidence`.
  Logdateien nur über `mktemp`.

## Nächste Schritte (Vorschlag, du entscheidest)

1. Tagesbericht `docs/bautage/2026-09-25.md` auf Branch `claude/bautag-2026-09-25` anlegen, Draft-PR.
2. Aus `docs/produktplan-beta.md` die Beta-Kernscheiben wählen, die **keine Menschen** brauchen und deren
   Abhängigkeiten gemergt sind, in Kalenderreihenfolge (W1/W2 zuerst). Hohe Priorität: **029** (BF-01 kritisch: der
   HTTP-Dienst nimmt `X-Actor` auch ohne `HV_DEMO` an — Sicherheitsbefund, braucht keinen Menschen).
3. Höchstens drei Scheiben parallel; bei 75 USD eher zwei, damit Nacharbeit bezahlbar bleibt.
4. Nach jedem Merge: Tagesbericht-Zeile mit Token; bei rund der Hälfte des Budgets Zwischenmeldung an den Eigentümer.

## Beim Eigentümer offen (nicht blockierend für den Bau)

Budgetstand aus der Abrechnung; Bestätigung Zeitplan (Kern zuerst); Demo-Go für den aktuellen Stand; Freigabe
010-Abnahmeschritt und Wahrheitstabellen-Diff; Anfragen Woche 0 und Betriebsrat; Verlauf umschreiben wegen
E-Mail-Adresse (nur auf ausdrückliches Wort); `permissions.deny` für `.env`; Branch-Löschungen, Branch-Schutz,
`git worktree prune`; Fragenpaket 02.10.; Pentest bis 15.12.; E50–E54 aus 089 (Feedback-Runde 09.10.).
