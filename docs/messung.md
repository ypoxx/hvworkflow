# Messung — Verbrauch, Runden, Befunde je Scheibe

Geführt ab dem ersten Bautag (docs/agentische-entwicklung-plan.md, 7.3). Die Modellkosten werden aus
den Nutzungsberichten der Sitzung übernommen; wo nur Tokenzahlen vorliegen, steht der Listenpreis
daneben. Zeiten in Europe/Berlin.

## Bautag 1 — 2. September 2026 (Demo-Nacht)

| Scheibe | Rolle · Modell | Start | Ende | Reviewrunden | Befunde (blocker/major/minor) | Tore grün | Bemerkung |
|---|---|---|---|---|---|---|---|
| Fundament (Vertrag, Kern, Seed, Tests, Gerüst, Doku) | Architekt · Fable 5.1 | 21:40 | 22:05 | — | — | ja | Domäne mit 35 Tests, Wahrheitstabelle generiert |
| 001 Shell, Designsystem, i18n | Implementierer · Opus 5 (bewusst statt Sonnet: setzt das Aussehen des gesamten Produkts) | 22:07 | 22:37 | 1 (Review Sonnet 5, 152 Tsd. Token, 7 min; Design-Kritik Fable: bestanden) | 0/0/2 | ja (e2e + Screenshot) | 235 Tsd. Token, 77 Werkzeugaufrufe; Schriften lokal gebündelt statt CDN; akzeptiert ohne Nacharbeit |
| 004 API-Dienst (Hono) | Implementierer · Sonnet 5 | 22:07 | 22:27 | 1 (Review Opus 5, 153 Tsd. Token, 11 min) | 3/3/9 | ja (19 Tests) | 240 Tsd. Token, 107 Werkzeugaufrufe; SSE ausgelassen (optional); Domänenlücke gemeldet: Klassifizierung ohne Pfadprüfung → im Kern behoben. Review fand zusätzlich: fehlende Body-Validierung (500 statt 422) und Idempotenz-Schlüssel ohne Akteur-Bezug → Kern R-IDEM-01 behoben, Nacharbeit (373 Tsd. Token, 17 min): Validierung jeder Anfrage gegen den Vertrag, 25 Tests; vom Architekten verifiziert und akzeptiert |
| 002 Wortmeldeliste, Erfassung | Implementierer · Opus 5 (eigener Worktree) | 22:44 | 23:23 | 1 (Review Sonnet 5, 217 Tsd. Token, 14 min; Design-Kritik Fable: bestanden) | 0/1/3 | ja (2 e2e + 2 Screenshots) | 389 Tsd. Token, 152 Werkzeugaufrufe, 39 min; Nacharbeit durch Mechaniker (Haiku, 104 Tsd. Token, 6 min): Tastenkürzel über i18n, Leerzustand der Wortmeldeliste; Satzerkennung vom Architekten nachgezogen (Haiku-Fassung nahm vorangehende Aussagesätze mit); akzeptiert |
| 003 Beantwortung, Bühne, Historie | Implementierer · Opus 5 (eigener Worktree) | 22:44 | 23:23 | 1 (Review Sonnet 5, 166 Tsd. Token, 8 min; Design-Kritik Fable: bestanden) | 0/2/1 | ja (2 e2e + 4 Screenshots) | 357 Tsd. Token, 115 Werkzeugaufrufe, 39 min; fand Kernfehler: Freigabe fehlte in _actions (Guard ohne Payload) → im Kern behoben; Nacharbeit: Workaround entfernen, Zustand „Freigabe erloschen“, Link zum Redebeitrag |
| Abnahmesatz e2e, Screenshots | Implementierer · Sonnet 5 | 23:35 | 23:48 | — | — | ja (1 e2e, 5 Screenshots; Filter 101 ms, Bühne 119 ms) | 198 Tsd. Token, 81 Werkzeugaufrufe; fand Demo-Problem: 100 Fragen bereits auf der Bühne, neue Frage erst nach 103 Klicks erreichbar → Korpus auf kurze Warteschlange umgestellt |
| Deployment Netlify | Architekt | | | | | | |

## Abweichungen vom Plan

- Slice 001 mit Opus 5 statt Sonnet 5: Das Designsystem ist die eine Stelle, an der ein Fehler alle
  folgenden Scheiben prägt; die Mehrkosten (Faktor 2,5 auf einer Scheibe) sind gegenüber dem Risiko
  einer schwachen Oberfläche in der Entscheidungsdemo gering.
- Reviews laufen in derselben Nacht; Nacharbeit wird gebündelt, um die Demo bis zum Morgen zu
  erreichen. Befunde, die nicht mehr behoben werden, stehen im Demo-Skript als bekannte Punkte.
