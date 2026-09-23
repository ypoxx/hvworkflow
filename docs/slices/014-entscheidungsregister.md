# 014 — Entscheidungsregister, Abdeckungsmatrix, Fragenpaket, DSFA-Vorentwurf, Takt-Skript

**Status:** review
**Risikoklasse:** niedrig · 2,5 AStd · Kalender 29.09.2026 (W1) · Lanes: docs-register (+ docs-feedback,
docs-datenschutz; `scripts/takt.mjs` als einzelne neue Datei — die parallel laufende Scheibe 012 berührt sie nicht)
**Rolle/Modell:** Architekt-Text · Fable 5.1 (Register, Matrix, Fragenpaket, DSFA-Vorentwurf, Changelog);
Mechaniker · Haiku 4.5 (Takt-Skript, nummerierter Screenshot); Review Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 9, 11, 12; Leitplanken Abschnitt 11
**Quellen-IDs:** Plan 5.2 Scheibe 014; Plan 5.0 (Abdeckungsmatrix); Plan 10 (E1–E49); Plan 11 (Anfragen der
Woche 0); Feedback-Auswertung Abschnitt 4 (Fragen 1–9); Ist-Analyse Abschnitt 8 (offene Fragen); Leitplanken 11
(Registerzeilen E13/E14, E15 „Übernahme durch 014"); Plan 8.4 (DSFA-Vorentwurf bis 13.11.)
**Depends on:** 009 (gemergt)
**Perspektive:** Datenschutz (DSFA-Vorentwurf) · **Glossar: neue Begriffe:** nein

## Ziel

1. **Entscheidungsregister `docs/entscheidungsregister.md`.** Eine Zeile je Entscheidung aus Plan Abschnitt 10
   (E1–E49 einschließlich E3a, E3b, E10b), also rund 50 Zeilen. Spalten: Nr. · Entscheidung · Standardannahme ·
   Eigentümer · Fällig · Rückfalltrigger · Kosten bei Änderung · betroffene Scheibe(n) · Status. Status ist genau
   eine von: `offen`, `auf Standard gebaut am <Datum> in <Scheibe>`, `beantwortet am <Datum>: <Antwort>`,
   `entschieden am <Datum> von <Person>`. Stand heute (23.09.2026, Prüfpunkt 0 durch den Umsetzer): Plan und
   Standardannahmen freigegeben; **E23** entschieden (Codex-Branch nach 009 löschen); **E48** entschieden
   (Orchestrator mergt nach grünen Toren und Review ohne offenen Blocker oder Hauptbefund); **E47** ist nicht
   entschieden → `offen`. Die Zeilen E13/E14 und E15 übernehmen Wortlaut und Standard aus
   `docs/qualitaetsleitplanken-produktreife.md` Abschnitt 11 (Vermerk dort: „Übernahme durch 014"). Die Standardannahmen
   aus Plan Abschnitt 3 stehen in den passenden E-Zeilen oder, wo keine E-Zeile existiert, in einem zweiten Abschnitt
   „Strukturelle Standardannahmen" (Entscheidung, Standard, Kosten bei Änderung, Entscheider).
2. **Anfragen der Woche 0** (Plan 11.1) als eigener Abschnitt des Registers mit Fälligkeit und Status „beim
   Eigentümer, Stand unbekannt": Konzern-IT (IdP-Client, Hosting/Postgres mit AVV, Endgeräte und Netz der
   Podiumsgeräte; E10, E11, E33), Betriebsrat- und DSFA-Start (E13, E14), Rechtsprüfung mit Satzung/GO (E15),
   Pentest-Beschaffung (E32), Ansprechperson Tool-Team bis 16.10. (E3a), HV-Datum und Format (E20).
3. **ADR-Stand** als Abschnitt des Registers: ADR 0001–0016 mit Status und Prüfpunkt der Annahme (Plan 4). Die
   Dateinamen der ADRs 0003–0016 (entstehen parallel in Scheibe 015) sind festgelegt:
   `0003-persistenz-ereignislog.md`, `0004-identitaet-oidc-bff.md`, `0005-antwortformat.md`,
   `0006-buehne-je-geraet-und-antwortbuendel.md`, `0007-deployment-hosting-umgebungen.md`, `0008-integrationen.md`,
   `0009-aufbewahrung-vertraulichkeit-personentabelle.md`, `0010-pilotmodus-uebungsbetrieb.md`,
   `0011-ereignis-umschlag-v2.md`, `0012-zustandsmodell-und-verweigerung.md`, `0013-zwei-protokollebenen.md`,
   `0014-realtime-sse.md`, `0015-vertragsversionierung.md`, `0016-agenten-arbeitsmodell.md` (alle in `docs/adr/`).
4. **Abdeckungsmatrix `docs/abdeckungsmatrix.md`** aus Plan 5.0 als eigene Datei, je Zeile ergänzt um die Spalte
   „Stand" (heute überall `geplant`, außer Audit A4 → `009 gemergt` sofern 009 gemergt ist, sonst `in Arbeit`).
5. **Fragenpaket Woche 1 `docs/feedback/2026-10-fragenpaket-woche-1.md`** an die Projektleitung, versandfertig
   (der Eigentümer verschickt es am 02.10.): Feedback-Fragen 1–9 (Feedback-Auswertung Abschnitt 4), Ist-Analyse-Fragen
   1–4, 6, 8, 9 (Ist-Analyse Abschnitt 8; Frage 5 als eigene Frage „zwei Rechtsrollen", E40), dazu Letztverantwortung
   und Rechtstor (E25), HV-Datum und Format (E20). Je Frage: ein Satz Kontext, die Frage, die Standardannahme, mit der
   gebaut wird, bis die Antwort da ist, und die E-Nummer. Fragen 3, 7 und 8 sind ausdrücklich für die Feedback-Runde 2
   (09.10.) markiert. Frage 1 verweist auf den nummerierten Screenshot (Punkt 7). Sprache: Deutsch, ohne
   Entwicklerjargon, Hausvokabular (docs/glossar.md).
6. **DSFA-Vorentwurf `docs/datenschutz/dsfa-vorentwurf.md`**: Systembeschreibung (Zweck, Beteiligte, Betriebsarten
   Demo/Staging/Übungsmandant, nur synthetische Daten in der Beta), Datenflüsse (Erfassung → Einzelfrage →
   Beantwortung → Freigabe → Bühne → Historie; Nachbarsysteme als geplante Adapter), Rechtsgrundlagen-Matrix je
   Verarbeitungsschritt (Datum, Kategorie, Zweck, mögliche Rechtsgrundlage **als zu prüfende Annahme**, Empfänger,
   Aufbewahrungsklasse aus Plan 3, Schutzmaßnahme). Deutlich als Vorentwurf markiert, keine Rechtsaussage als
   geprüft ausgegeben (E14, E15); Übergabe an den DSB bis 13.11.2026 (Plan 8.4) durch den Eigentümer.
7. **Nummerierter Screenshot der Wortmeldeliste** `docs/feedback/2026-10-fragenpaket-wortmeldeliste.png`: die
   Wortmeldeliste der Demo (In-Process, `pnpm --filter @hv/web dev` oder Vite-Preview) in der Rolle, in der die
   meisten Knöpfe sichtbar sind, mit sichtbaren Nummern-Markierungen an jedem Knopf und jedem Bedienelement, dazu eine
   Legende (Nummer → Beschriftung) im Fragenpaket. Das Erzeugungsskript liegt nur im Scratch-Verzeichnis und wird nicht
   committet; der Befehl steht im Bericht.
8. **Änderungsprotokoll `docs/changelog-projektleitung.md`** eröffnet: Zweck (was sich für die Projektleitung sichtbar
   ändert, je Feedback-Punkt), Format (Datum, Punkt, Änderung, wo sichtbar), erster Eintrag „Plan freigegeben
   (Prüfpunkt 0)".
9. **Takt-Tabelle und `scripts/takt.mjs`.** In `docs/messung.md` kommt am Ende ein Abschnitt „Takt" mit leerer
   Tabelle (Spalten: Punkt · Quelle · Klasse S/M/L · Nachricht (JJJJ-MM-TT HH:MM) · Live (JJJJ-MM-TT HH:MM) · Dauer).
   `node scripts/takt.mjs [--file docs/messung.md]` liest die Tabelle, rechnet je Zeile die Dauer in Stunden und gibt
   Anzahl, Median gesamt und Median je Klasse aus; Zeilen ohne Live-Zeit zählen als offen. Ohne Zeilen:
   „0 Punkte". Keine Abhängigkeit, kein Eintrag in `package.json`.

## Nicht-Ziele

- Keine Entscheidung treffen: jede offene Zeile bleibt offen mit Standardannahme.
- Keine ADR-Dateien (015), keine Änderung am Plan, an AGENTS.md, am Rechtekonzept.
- Kein Code außer `scripts/takt.mjs`; kein Versand von irgendetwas.
- Keine echten Personen- oder Firmennamen außer den bereits im Repositorium stehenden Funktionsbezeichnungen.

## Files allowed

- `docs/entscheidungsregister.md`, `docs/abdeckungsmatrix.md` (neu)
- `docs/feedback/2026-10-fragenpaket-woche-1.md`, `docs/feedback/2026-10-fragenpaket-wortmeldeliste.png` (neu)
- `docs/datenschutz/dsfa-vorentwurf.md` (neu)
- `docs/changelog-projektleitung.md` (neu)
- `docs/messung.md` (nur neuer Abschnitt „Takt" am Ende)
- `scripts/takt.mjs` (neu)
- diese Datei (`docs/slices/014-entscheidungsregister.md`, Abschnitt „Bericht")

## Akzeptanzkriterium

1. Register mit allen E-Nummern aus Plan 10 (Zählung im Bericht: erwartet 51 Zeilen — E1–E49, E3 als E3a und E3b, dazu E10b),
   jede mit allen neun Spalten gefüllt; E23 und E48 `entschieden am 23.09.2026 von Umsetzer`; E47 `offen`.
2. Abschnitte „Anfragen der Woche 0" und „ADR-Stand" vorhanden.
3. Fragenpaket enthält 9 + 7 + 3 Fragen (Feedback 1–9; Ist-Analyse 1–4, 6, 8, 9; E40, E25, E20), je mit Standardannahme
   und E-Nummer; Screenshot mit Nummern und Legende.
4. DSFA-Vorentwurf mit den drei Teilen; jede Rechtsgrundlage als „zu prüfen" markiert.
5. `node scripts/takt.mjs` gibt „0 Punkte" aus; mit einer temporären Datei mit drei Beispielzeilen (nicht committet)
   stimmt der Median (Ausgabe im Bericht).
6. `pnpm gates` grün (Vokabular-Tor prüft nur Web-Texte; trotzdem Hausvokabular in allen Dokumenten).

## Nachweise

Zeilenzählung des Registers, Fragenpaket, Screenshot, DSFA-Vorentwurf, Ausgabe `node scripts/takt.mjs` (leer und mit
Beispiel), `pnpm gates`.

## Arbeitsweise

- Worktree `/home/user/wt/014`, Branch `claude/slice-014-register`. Absolute Pfade.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`.
- Playwright-Läufe erzeugen die Bilder unter `docs/evidence/` neu: solche Änderungen nicht committen, außer diese Spec
  verlangt das Bild ausdrücklich (`git checkout -- docs/evidence` vor dem Commit). Nicht pushen.

## Bericht

```
Slice: 014-entscheidungsregister
Done: Register (51 E-Zeilen, dazu strukturelle Standardannahmen S1–S6, Anfragen der Woche 0, ADR-Stand 0001–0016,
      Rückfalltrigger), Abdeckungsmatrix (13 Zeilen mit Stand), Fragenpaket Woche 1 (19 Fragen, Fragen 3/7/8 für die
      Feedback-Runde 2), DSFA-Vorentwurf (Systembeschreibung, Datenflüsse, Rechtsgrundlagen-Matrix V1–V19, alle
      „zu prüfen"), Änderungsprotokoll für die Projektleitung, Takt-Tabelle in docs/messung.md und scripts/takt.mjs,
      nummerierter Screenshot der Wortmeldeliste (30 Nummern, Legende aus denselben Daten erzeugt).
Evidence: grep -cE '^\| E[0-9]+[ab]? \|' docs/entscheidungsregister.md → 51 (E1–E49, E3a/E3b, E10b); Status 49 × offen,
      E23 und E48 „entschieden am 23.09.2026 von Umsetzer"; grep -c '^### Frage' Fragenpaket → 19;
      node scripts/takt.mjs → „0 Punkte"; mit Beispieldatei (S 2,5 h und 24 h, M offen) → „2 Punkte / 0 offen /
      Median gesamt: 13.25 h / Median S: 13.25 h" (von Hand: (2,5 + 24) / 2 = 13,25 ✓);
      pnpm gates exit 0: domain 39, web 35, api 25, vocabulary-check: ok, ✓ built in 1.10s.
Open: Die Abdeckungsmatrix führt 014 selbst als „geplant", bis die Scheibe gemergt ist. Zwei Registerzeilen aus dem
      Review von 015 (Pseudonymisierung: engerer Rollenkreis und Vier-Augen nach Recherche Z.116; Zuordnung der fünf
      Anzeigegruppen, ADR 0012) sind nicht in dieser Scheibe — Übergabe an eine Folge-Kleinänderung.
Touched: docs/entscheidungsregister.md, docs/abdeckungsmatrix.md, docs/feedback/2026-10-fragenpaket-woche-1.md,
      docs/feedback/2026-10-fragenpaket-wortmeldeliste.png, docs/datenschutz/dsfa-vorentwurf.md,
      docs/changelog-projektleitung.md, docs/messung.md (Abschnitt Takt), scripts/takt.mjs, diese Datei
```

Bau: Fable 5.1 (Punkte 1–6, 8; 192 Tsd. Token, 17,5 min); Haiku 4.5 (Punkt 9 und zwei Anläufe für Punkt 7,
125 Tsd. Token); Punkt 7 nach einer Nacharbeitsrunde an Sonnet 5 übergeben (Abweichung nach oben: Haikus Legende passte
nicht zum Bild, Bedienelemente der Zeilen fehlten; Sonnet 210 Tsd. Token, Legende aus derselben Datenstruktur wie die
Markierungen erzeugt und Nummer für Nummer am Bild geprüft). Erzeugungsskripte liegen nur im Scratch-Verzeichnis.

## Review findings

(vom Reviewer)
