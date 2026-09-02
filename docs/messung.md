# Messung — Verbrauch, Runden, Befunde je Scheibe

Geführt ab dem ersten Bautag (docs/agentische-entwicklung-plan.md, 7.3). Die Modellkosten werden aus
den Nutzungsberichten der Sitzung übernommen; wo nur Tokenzahlen vorliegen, steht der Listenpreis
daneben. Zeiten in Europe/Berlin.

## Bautag 1 — 2. September 2026 (Demo-Nacht)

| Scheibe | Rolle · Modell | Start | Ende | Reviewrunden | Befunde (blocker/major/minor) | Tore grün | Bemerkung |
|---|---|---|---|---|---|---|---|
| Fundament (Vertrag, Kern, Seed, Tests, Gerüst, Doku) | Architekt · Fable 5.1 | 21:40 | 22:05 | — | — | ja | Domäne mit 35 Tests, Wahrheitstabelle generiert |
| 001 Shell, Designsystem, i18n | Implementierer · Opus 5 (bewusst statt Sonnet: setzt das Aussehen des gesamten Produkts) | 22:07 | | | | | |
| 004 API-Dienst (Hono) | Implementierer · Sonnet 5 | 22:07 | | | | | |
| 002 Wortmeldeliste, Erfassung | Implementierer · Sonnet 5 | | | | | | |
| 003 Beantwortung, Bühne, Historie | Implementierer · Sonnet 5 | | | | | | |
| Abnahmesatz e2e, Screenshots | Mechaniker/Implementierer | | | | | | |
| Deployment Netlify | Architekt | | | | | | |

## Abweichungen vom Plan

- Slice 001 mit Opus 5 statt Sonnet 5: Das Designsystem ist die eine Stelle, an der ein Fehler alle
  folgenden Scheiben prägt; die Mehrkosten (Faktor 2,5 auf einer Scheibe) sind gegenüber dem Risiko
  einer schwachen Oberfläche in der Entscheidungsdemo gering.
- Reviews laufen in derselben Nacht; Nacharbeit wird gebündelt, um die Demo bis zum Morgen zu
  erreichen. Befunde, die nicht mehr behoben werden, stehen im Demo-Skript als bekannte Punkte.
