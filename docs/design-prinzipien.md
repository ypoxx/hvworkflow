# Designprinzipien — was „beste Oberfläche" für dieses Werkzeug heißt

Pflichtlektüre für jede Oberflächen-Scheibe. Maßstab der Design-Kritik. Kurz, damit es gelesen wird.

## Die Situation, für die wir bauen

Ein Raum hinter dem Saal, Nachmittag der Generaldebatte. Rückstau von mehreren hundert Fragen, das
Podium wartet, Recht will jede Zahl belegt sehen. Die Personen sind konzentriert, oft unter Zeitdruck,
und kennen ihren Prozess seit Jahren. Sie brauchen kein Erlebnis, sie brauchen Übersicht, Tempo und
Verlässlichkeit. **Vorbild ist die Konsole, nicht das Dashboard:** Leitstand, Handelssystem,
Redaktionssystem — ruhig, dicht, präzise.

## Zehn Prinzipien

1. **Hierarchie vor Dekoration.** Auf jeder Ansicht ist in einer Sekunde klar: Was ist der Stand, was
   ist zu tun, was ist das Nächste. Genau eine primäre Aktion je Ansicht.
2. **Dichte mit Luft.** Zeilen 36 px, Schrift 13–14 px, aber Panels mit großzügigem Innenabstand
   (16–24 px) und klarer Trennung. Nichts klebt aneinander, nichts verschwendet Fläche.
3. **Typografie trägt.** Inter für Text, JetBrains Mono für Nummern, Zeiten, Versionen. Vier
   Größen genügen (12 / 13–14 / 16 / 20–28 für die Bühne). Gewicht statt Farbe für Betonung.
4. **Farbe ist Bedeutung.** Neutrale warme Grautöne als Grund, ein Akzentblau für Interaktion,
   Statusfarben nur als zarte Tönung von Badges und Balken — nie als Flächen. Keine Verläufe,
   keine Schatten außer bei Dialogen.
5. **Zustände sind sichtbar.** Hover, Fokus, aktiv, deaktiviert, geladen, leer, Fehler — jeder
   Zustand ist gestaltet. Leere Listen erklären, was zu tun ist. Fehler zeigen Grund und Regel-ID.
6. **Die Sprache des Hauses.** Wortmeldung, Redebeitrag, Einzelfrage, Antwortpfad, Bühne. Keine
   Ticket-Metaphern, keine englischen Fachbegriffe in der deutschen Oberfläche.
7. **Tastatur zuerst dort, wo es schnell gehen muss.** Erfassung (`Alt+Q` für Einzelfrage), Bühne
   (`Leertaste` weiter, `R` zurückgeben), Listen (Pfeile, Enter). Sichtbare Fokusringe.
8. **Nichts springt.** Keine Layoutsprünge beim Laden, keine Animation außer 120-ms-Übergängen für
   Hover und Dialoge. Skeletons statt Spinner, wo etwas länger als 200 ms dauert.
9. **Rechte werden nicht erklärt, sie sind einfach da.** Was nicht erlaubt ist, wird nicht angeboten.
   Nichts ist ausgegraut mit Tooltip „keine Berechtigung" — es fehlt.
10. **Die Bühne ist ein anderes Gerät.** Große Schrift, maximaler Kontrast, zwei Tasten, keine
    Navigation. Sie muss aus zwei Metern lesbar sein.

## Konkrete Muster

- **Kopfzeile** 56 px: Titel der HV links, Zähler als kleine Kennzahlen mit Beschriftung darunter,
  Uhr in Mono, rechts Rolle und Sprache. Demo-Hinweis dezent als Badge.
- **Navigation** links 220 px nach Phasen, einklappbar auf Icons; aktiver Punkt mit Akzentbalken.
- **Listen** mit fixiertem Kopf, Zebra-freie Zeilen, Trennlinien in Grau 200, Hover Grau 50,
  ausgewählte Zeile Akzent 50 mit linkem Akzentbalken.
- **Split-Panes** für Erfassung und Beantwortung: Liste links (40 %), Detail rechts, Trenner
  ziehbar, Breite gemerkt.
- **Badges**: 11–12 px, Gewicht 500, abgerundet 4 px, Tönung 100 mit Text 700 der Statusfarbe.
- **Dialoge** 480 px, Titel, Erklärungssatz, Eingaben, rechts unten Abbrechen/Primär.
- **Toasts** unten rechts, 6 s, Fehler bleiben bis Klick.

## Checkliste der Design-Kritik

| Nr. | Frage | Blocker, wenn … |
|---|---|---|
| D1 | Ist in 30 Sekunden ohne Erklärung klar, was die Ansicht zeigt und was zu tun ist? | nein |
| D2 | Gibt es genau eine primäre Aktion, und ist sie als solche erkennbar? | mehrere oder keine |
| D3 | Stimmen Raster, Ausrichtung, Abstände (8-px-Raster, Kanten fluchten)? | sichtbar versetzt |
| D4 | Ist Farbe auf Bedeutung beschränkt? | dekorative Farbe, Verläufe, bunte Flächen |
| D5 | Sind Nummern, Zeiten, Versionen in Mono und rechtsbündig? | nein |
| D6 | Sind leerer Zustand, Ladezustand und Fehlerzustand gestaltet? | einer fehlt |
| D7 | Sind alle sichtbaren Texte Hausvokabular und in beiden Sprachen vorhanden? | Literal oder Fremdwort |
| D8 | Funktioniert die Kernszene mit Tastatur, und ist der Fokus sichtbar? | nein |
| D9 | Bleibt die Ansicht bei 800 Fragen flüssig (unter 100 ms für Filter/Wechsel)? | ruckelt |
| D10 | Wirkt es wie ein Werkzeug von 2026 — ruhig, präzise, nicht generisch? | wirkt wie ein Template |
