# Abdeckungsmatrix — jede Quelle hat genau einen Ort

**Herkunft:** Produktplan Beta Abschnitt 5.0 (`docs/produktplan-beta.md`), als eigene Datei geführt seit
Scheibe 014 · **Stand:** 23.09.2026, nachgeführt nach dem Bautag 23.09.2026 (gemergt: 009, 012, 014, 015, 017, 019, 039, takt-001 bis takt-003; offene Branches: 016, 020), ermittelt aus den Branches des Repositoriums · **Pflege:** Der Orchestrator setzt die Spalte „Stand" mit
jedem Merge nach (`geplant` → `in Arbeit` → `<Scheibe> gemergt`); eine Zeile ohne Scheibe verweist auf die
B-Liste (Plan 5.10) oder auf ein bewusstes Nein.

Jede Zeile löst sich in eine Scheibe, einen Nach-Beta-Eintrag (B-Liste, mit Eigentümer) oder ein bewusstes
Nein auf. Die Spec einer Scheibe nennt die Quellen-IDs in ihrem Ziel, damit der Reviewer (der nur Spec und
Diff sieht) die Abdeckung prüfen kann.

| Quelle | Punkte | Scheibe(n) | Stand |
|---|---|---|---|
| Audit-Befunde A1–A4 | Lesepfade, Tor-Inventar, Legal-Trace, Leitplanken 008 | 010 · 012/013/016/018/084 · 011 · 009 | A1 geplant · A2: 012 gemergt, 016 in Arbeit, 013/018/084 geplant · A3 geplant · A4: 009 gemergt |
| Feedback S-Punkte | #3, #9, #10, #13, #15, #17, #21, #23, #26, #32, #14 (Korpus) | 020 (Oberfläche), 080 (Redezeit, Art, Korpus) | 020 in Arbeit, 080 geplant |
| Feedback Umbauten | #22 Klassifizierung zur Koordination · #24 zwei Ansichten · #7 Bühne je Person · #6 Anzeigeeinstellungen · #8 Antwortbündel · #11 Übersicht je Einheit/Bühnenplatz · #27/#30/#31 Format · #28 TOP/Zeit aus Fokus · #29 Doppelklick · #2 Anmeldung · #19 Ingest · #5 Notiz · #4 KI | 021 · 053/054 · 056 · 056 · 057 · 053 (counts aus 040) · 055 · 054 · 054 · 029/030 · 064 · 046 · 066 | geplant |
| Feedback Fragen 1–9 | Screenshot, Rolle, Runde, Transkript, Notiz, Weiterleiten, Format, Sichtbarkeit, Personen/IdP | 014 (Fragenpaket) → Register E1–E9 | 014 gemergt |
| Ist-Delta hoch 1–8 | Verweigerung · TOP-Zuordnung · Atomisierung (erfüllt) · Clustering rückverfolgbar · Nachfragen · Ist-Antwort · Rechtstor vor Bühne · Korrekturschleife | 044/045 · 020 (Feld optional, bleibt im Modell) · — · 069 · 046 · 049 · 021 · 046 | TOP-Zuordnung: 020 in Arbeit, übrige geplant |
| Ist-Delta mittel 9–14 | Versionierung (erfüllt) · zwei Datenbereiche · Auskunftsschuldner · Drehbuch-Kopplung · Vorabfragen · Taxonomie | — · 046 (Notiz getrennt) · 048 · 025 (R-MTG, Tagesordnung, Nachtragsregel) · 068 (light) · B-Liste | geplant |
| Ist-Analyse offene Fragen 1–9 | Fragenpaket Woche 1; Frage 5 (Rechtsrollen) eigene Zeile | 014 → Register E31, E40 | 014 gemergt |
| Leitplanken-Register (20 Zeilen) | Persistenz, IdP/Gast/Notfallkonten, Rollenzuschnitt/Vertretungen, DB-Topologie/HA, Betreiber, Legitimation, Veröffentlichung, Letztfreigabe/Rechtstor, ADR 0001, BR, Rechtsprüfung u. a. | 009 (konsolidiert), Register E10–E29, E42 | 009 gemergt · Register: 014 gemergt |
| Recherche MUSS Betrieb/Sicherheit (tragend für die Generalprobe) | Z.263 Offline-Podium · Z.295/296 Hash-Kette, Rebuild · Z.299/205 Referenzuhr · Z.312 IAM · Z.330/344 Bedrohungsmodell, SBOM · Z.340 Rate-Limit · Z.362 Lasttest · Z.365 Entwurfsspeicherung · Z.367 Generalprobe · Z.370/371 Monitoring, Kanarienfrage · Z.373/374 Papier, Katalogkopie · Z.378 Login-Check | 058 · 024/027/038 · 032/033 · 029 · 039/074 · 034 · 071 · 060 · 078 · 037/086 · 068/070 · 062/078 | Z.330/344 Bedrohungsmodell: 039 gemergt (SBOM mit 074 geplant); übrige geplant |
| Recherche SOLL, bewusst mitgenommen | Z.351 Kill-Switch (Sperrliste, billig mit 029) | 029 | geplant |
| Recherche MUSS Recht (tragend) | Z.63/64 Verweigerung · Z.70 Nachfragen · Z.74/259 Verfahrensereignisse · Z.78 Restanten-Feststellung · Z.80 Korrektur · Z.91/422 Rechtstor · Z.103 Soll-Ist · Z.104/126 Legal Hold · Z.116 Pseudonymisierung · Z.129/130 zwei Protokollebenen mit Auswertung zu zweit · Z.231 Vier-Augen · Z.277 Delivery-Entität · Z.449 Auskunftsschuldner, Aufsichtsrat | 044 · 046 · 050 · 087 · 046 · 021 · 049 · 024 · 026 (Standard an)/067 · 033/047 · 021 · 049 · 048, 040/047 | geplant |
| Kritik der Gegenlese (fünf Linsen) | Blocker und Hauptbefunde zu Kalender, Rechtstor, Papierpfad, Vertrag zuerst, Kapazität, Token, Governance | 080–088 neu; Änderungen in 019, 021, 023, 025, 051, 058, 076 u. a.; Plan-Abschnitte 3, 4, 6, 8, 10 | 019 gemergt, übrige geplant |
| Zielbild Oberfläche (`docs/feedback/2026-09-zielbild-oberflaeche.md`, Prototyp `docs/zielbild/`) | Befunde U1–U11 · Zielbild Z1–Z26 | 089 (Übernahme) · 054 (Z1, Z5, Z7–Z9), 055 (Z6), 061 (Z10–Z13), 087 (Z14), 050/085 (Z15), 056/057 (Z16, Z17, Z19, Z22), 062 (Z26), 026 (U10), 080 (U11), 021/053 (U5) · Takt-Spur (U1, U2, U4, U6–U9) · Register E50–E54 (Z2–Z4, Z18, Z20, Z21, U3) · bewusst nein: Z24, Z25 · gebaut: Z23 (020) | 020 gemergt (Z23, Vorschau aus Z16); 089 in Arbeit; übrige geplant |
| Recherche MUSS übrig (§7, §8 Aktionärskanal, MAR-Ampel, PDF/A, Publikation, KI-Anbieter, Nebenstränge, Ethical Wall, Suche, SAML …) | — | B-Liste 5.10 | geplant |

**Lesart der Spalte „Stand".** `geplant`: keine der genannten Scheiben ist gemergt. `in Arbeit`: mindestens
eine genannte Scheibe hat einen offenen Branch im Repositorium; die Scheibe steht dabei. `<Scheibe> gemergt`:
die genannte Scheibe ist im Hauptzweig. Nennt eine Zeile mehrere Scheiben, steht der Stand je Punkt oder je
Scheibe (wie in der Audit-Zeile und der Leitplanken-Zeile); ungenannte Scheiben einer Zeile sind `geplant`.
