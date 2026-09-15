# Feedback-Auswertung — Quickview der HV-Projektleitung

**Quelle:** fünf Audionachrichten nach einem unbegleiteten Klickdurchgang durch hvtool.netlify.app
(Stand Commit `ed95cf9`), transkribiert. **Einordnung:** kein vollständiges Feedback, sondern ein
erster Eindruck plus Antworten auf einen Teil der offenen Fragen. **Zweck dieses Dokuments:** je
Aussage festhalten, was schon berücksichtigt ist, was geplant und nicht gebaut ist, was neu ist und
was unklar bleibt — als Grundlage für die Vervollständigung.

**Statusschlüssel:** `ist` berücksichtigt und gebaut · `plan` konzipiert, nicht gebaut ·
`neu` nicht vorgesehen · `zurück` vorhanden, aber vereinfachen oder entfernen · `umbau` vorhanden,
gehört aber an eine andere Stelle oder Rolle · `unklar` Rückfrage nötig.
**Aufwand:** S unter einem halben Tag · M ein bis zwei Tage · L mehr, meist mit Vertragsänderung.

---

## 1. Neue Fakten — sie beantworten offene Fragen aus `erste-version-und-offene-fragen.md`

| Aussage | Beantwortet | Folge für das Produkt |
|---|---|---|
| Rund 200 Fragen, rund 25 Redner, Generaldebatte rund 8 Stunden | F8, F9 | Demo-Korpus auf 25–30 Wortmeldungen und 200–250 Einzelfragen umstellen. 800 bleibt als Lasttest in den Tests, nicht in der Demo. |
| Backoffice bis zu 50 Personen gleichzeitig in verschiedenen Rollen; Aufteilung folgt | F10 | Für den Piloten sind HTTP-Dienst mit Datenbank und Anmeldung je Person Pflicht; die In-Browser-Betriebsart trägt das nicht. |
| Transkriptionstool: bis zu 15 Personen parallel; Wortlaut, keine sinngemäße Fassung; jede Frage einzeln | F12, F13, F14 | Atomisierung und Wortlaut sind bestätigt. Parallele Erfassung braucht die geplante Übernahme-Sperre (Claim/Lease). Ingest-Schnittstelle wird gebraucht. |
| Jedes Podiumsmitglied hat ein eigenes Gerät, bedient es selbst, die Antwort wird darauf angezeigt | F4, F5, F6 | Die Bühne ist nicht ein Podium mit einer Warteschlange, sondern eine Ansicht je Person. Siehe Abschnitt 3a. |
| Eine Antwortrunde: etwa 20 Antworten, je rund 2 Minuten, insgesamt 30–60 Minuten; etwa 20 Fragen werden gebündelt | F7, F11 | Die Antwortrunde ist ein Bündel und muss als solches sichtbar sein. Wer es zusammenstellt, ist offen. Siehe 3a und Frage 3. |
| Der Vorstand liest den freigegebenen Text wörtlich vor | F3 | Der freigegebene Text ist die Vorlesevorlage. Damit zählen Format, Lesbarkeit und Anzeigeeinstellungen auf der Bühne. |
| Außerhalb des Tools: Telefon mit anderen Abteilungen, Zuruf, Teams | F2 | Im Tool wird der Prozess abgebildet; die Nebenkommunikation bleibt daneben. Ob ein Rückfragefeld je Frage gewünscht ist, bleibt offen (Frage 5). |
| Größtes Risiko sind die Menschen am Tool; Rollen mit eigenen Logins; nicht alle dürfen alles | F1 | Bestätigt Designprinzipien und Rechtekonzept. Für den Piloten: Anmeldung je Person (U4). |

---

## 2. Bewertung je Aussage

### Rollen und Allgemeines

| Nr. | Aussage | Status | Konsequenz | Aufwand |
|---|---|---|---|---|
| 1 | Intuitive, einfache Oberfläche; Menschen sind das größte Risiko | ist | Bestätigung der Designprinzipien. Die Feinarbeit liegt in rollenspezifischen Fokusansichten (24, 29). | — |
| 2 | Rollen trennen, verschiedene Logins | plan | Rechte als Daten und `_actions` sind gebaut; die Demo simuliert Rollen über den Schalter. Anmeldung je Person über den Identity Provider steht für den Piloten aus. | M |
| 3 | Vorstand braucht klare Übersicht und andere Rechte als Erfassung und Beantwortung | ist | Podiumsrolle sieht nur die Bühne. Folge: „Nur Bühne" wird für diese Rolle Standard (9). | S |
| 4 | Es braucht vernünftige Antworten; Recherche kostet Zeit | plan | Schnittstelle zur KI-Wissensbasis (Antwortvorschläge mit Quellen) ist im Vertrag vorgesehen, nicht gebaut. | L |
| 5 | Telefon, Zuruf und Teams laufen daneben; „der Prozess soll im Tool abgebildet werden" | unklar | Ob ein Rückfrage- oder Notizfeld je Frage gewünscht ist, das den Teams-Chat ersetzt. Frage 5. | — |

### Bühne

| Nr. | Aussage | Status | Konsequenz | Aufwand |
|---|---|---|---|---|
| 6 | Individualisierung der Vorstandsansicht: Zeilenabstand, Fettung, Schrift | neu | Anzeigeeinstellungen je Gerät (Schriftgröße, Zeilenabstand, Kontrast, gemerkt im Gerät). Fettungen kommen aus dem Antwortformat (30). | S |
| 7 | Jeder auf der Bühne hat ein eigenes Gerät und bedient es selbst | umbau | Datenmodell trägt es (Bühnenzuordnung je Frage). Die Ansicht zeigt heute eine globale Warteschlange. Nötig: Bühne je Bühnenzuordnung mit eigener Reihenfolge und eigenem Fortschritt. | M |
| 8 | Antwortrunde mit rund 20 gebündelten Antworten | unklar / neu | Antwortrunde als Bündel im Modell und auf der Bühne. Offen: wer stellt sie zusammen, nach welcher Regel. Frage 3. | M |
| 9 | „Nur Bühne" gefällt; klar, was vorgelesen ist und was nicht | ist | Standardansicht der Podiumsrolle; Umschalten in die Vollansicht bleibt möglich. | S |
| 10 | Nächste Fragen anklicken, sich durchklicken, sehen wie viele noch kommen, Antwort vorab ansehen | neu | Warteschlange anklickbar: Vorschau ohne „vorgelesen"; Zähler „noch n". | S |
| 11 | Gesamtübersicht: wie viele Fragen liegen wo, bei wem auf der Bühne, bei wem in Bearbeitung | teils | Prozessbalken zeigt die Verteilung je Status. Fehlt: Verteilung je Bühnenzuordnung und je Fachbereich als eigene Übersicht. | M |

### Wortmeldeliste

| Nr. | Aussage | Status | Konsequenz | Aufwand |
|---|---|---|---|---|
| 12 | Aufmachung, Navigation, Leiste oben und Grafik gefallen | ist | Beibehalten. | — |
| 13 | Prominente Ortszeit nicht nötig | zurück | Uhr klein oder entfernen. | S |
| 14 | Viel zu viele Fragen, unübersichtlich; realistisch 25–30 Wortmeldungen, 200–250 Einzelfragen | zurück | Demo-Korpus umstellen (siehe Abschnitt 1). Die Verdichtungsentscheidungen der letzten Runde waren für 800 gedacht; mit 230 werden Listen einfacher. | S |
| 15 | Name und Organisation wichtig; Art unwichtig; Runde relevant; Redezeit nicht relevant | zurück | Redezeit, Zeitbudget-Ring und Minutenangabe entfernen oder ausblenden; Spalte Art entfernen; Aufnahme-Dialog auf Name, Organisation, Runde. | S |
| 16 | „Das mit der Redezeit, den Button Daten verstehe ich nicht" | unklar | Welcher Knopf ist gemeint: Bearbeiten-Stift, Aufnahme-Dialog, Griff? Frage 1 mit Screenshot. | — |
| 17 | Drag-and-drop in den Runden ist wichtig, wurde erst nicht gefunden | ist, Auffindbarkeit | Griff sichtbarer, Hinweis im Rundenkopf statt nur über der Liste, Cursor. | S |
| 18 | Fragenzahl je Person nett; Redner aktivieren funktioniert; Absprung zur Erfassung nicht nötig, aber ok | ist | Beibehalten. | — |

### Erfassung

| Nr. | Aussage | Status | Konsequenz | Aufwand |
|---|---|---|---|---|
| 19 | Wie kommt das Transkript herein? Vermutlich Integration über das Transkriptionstool | plan | Ingest-Schnittstelle (`POST /v1/ingest/speech-segments`) ist im Schnittstellenkonzept vorgesehen, nicht gebaut. Exportweg des Tools klären. Frage 4. | M–L |
| 20 | Fragen markieren und erfassen funktioniert gut | ist | Beibehalten. | — |
| 21 | An der Einzelfrage viel zu viele Daten | zurück | Karte in der Erfassung zeigt nur Nummer, Wortlaut, Stand. Alles Weitere gehört in die Beantwortung (22). | S |
| 22 | Die erfassende Person entscheidet nicht über den Pfad; Bühnenzuordnung kommt im nächsten Schritt; andere Rolle | umbau | Klassifizierung (Pfad, Bühnenzuordnung, Zuweisung) wandert in die Steuerungsansicht der Beantwortung; Recht `question.classify` von der Rolle Erfassung zu einer Koordinationsrolle. Rechtetabelle plus Verschiebung der Bedienelemente, keine Logikänderung. Wer diese Rolle im Haus ist: Frage 2. | M |
| 23 | Tagesordnungspunkt nicht relevant | zurück | Feld optional, standardmäßig ausgeblendet; bleibt im Modell für die Nachweisführung. | S |

### Beantwortung

| Nr. | Aussage | Status | Konsequenz | Aufwand |
|---|---|---|---|---|
| 24 | Zu komplex; Filter sind für die Administration, nicht für die einzelne Person | umbau | Zwei Ansichten: **Fokus** für Beantworter (nur eigene Zuweisungen, keine Filter) und **Steuerung** für Koordination (Verteilung, Filter, Klassifizierung, Zuweisung). Beide aus denselben Daten und Rechten. | M |
| 25 | Die Verteilung oben („Deklarierung") ist nett gemacht | ist | Bleibt in der Steuerungsansicht. | — |
| 26 | „Wieso kann ich hier nicht rein? Ich gehe in eine andere Rolle" | unklar / UX | Vermutlich fehlte in der gewählten Rolle das Bearbeitungsrecht und die Ansicht erklärte es nicht. Kurzer Lesehinweis („In dieser Rolle nur lesen") ergänzen; Ursache am Screenshot klären. | S |
| 27 | Antwortfeld gefällt nicht; in die Frage klicken, dann eine Word-ähnliche Maske | neu | Editor mit Formatierung, siehe 30 und 31. | M |
| 28 | TOP und Erfassungszeit sind für Beantworter nicht relevant | zurück | Aus der Fokusansicht entfernen. | S |
| 29 | Doppelklick öffnet die Antwort; klare Fokussierung; Vollbild | neu | Fokusmodus: Frage oben, Antwort groß, alles andere weg. | S–M |
| 30 | Word-ähnliche Funktionen: Schriften, Fettung, Markierung | neu | Begrenzte Formatierung: fett, kursiv, Hervorhebung, Aufzählung. Keine Schriftwahl (siehe 31). Antwortformat wird Teil des Vertrags; Bühne und Historie rendern es einheitlich. | M–L |
| 31 | Das System muss die Formatierung überall gleich halten; beim Speichern und Weiterleiten auf dieselbe Schrift setzen | neu | Hausformat: gespeichert wird nur die erlaubte Auszeichnung, Schrift und Größe kommen von der Ansicht. Damit ist 30 ohne Schriftwahl konsistent. | in 30 |
| 32 | Ein Knopf, um Frage und Antwort weiterzuleiten | ist, Begriff | „Zur Prüfung geben" heißt im Haus „Weiterleiten". Offen, ob auch Weiterleiten an Kolleginnen oder einen anderen Fachbereich gemeint ist. Frage 6. | S |

### Fazit der Projektleitung

| Nr. | Aussage | Status | Konsequenz |
|---|---|---|---|
| 33 | „An sich nicht schlecht, aber viel Detailarbeit. Entscheidend: wie schnell lassen sich Mini-Anmerkungen umsetzen, von KI und Entwickler?" | Prozess | Das ist das Kriterium F19, das er selbst benennt. Antwort in Abschnitt 5: ein messbarer Änderungstakt. |

**Zählung:** 33 Aussagen. 10 sind berücksichtigt, 4 konzipiert und nicht gebaut, 7 neu, 7 zurückzubauen
oder zu vereinfachen, 3 Umbauten, 5 unklar (Mehrfachnennungen möglich).

---

## 3. Drei strukturelle Erkenntnisse

Die Details in Abschnitt 2 sind zahlreich, aber drei Punkte verändern den Schnitt und sollten vor
jeder Detailarbeit entschieden werden.

### 3a. Die Bühne ist eine Ansicht je Person, nicht ein Podium

Jedes Podiumsmitglied hat ein eigenes Gerät, bedient es selbst und liest wörtlich vor. Das Modell
trägt es bereits: jede Frage hat eine Bühnenzuordnung. Die Ansicht muss folgen: jede Person sieht
ihre eigene Reihenfolge, ihren Fortschritt, kann vorblättern und stellt Schrift und Zeilenabstand
selbst ein. Dazu kommt die Antwortrunde als Bündel von etwa 20 Antworten; offen ist, wer sie
zusammenstellt. Das Versammlungsbüro braucht die Gesamtsicht „wo liegt was", die Personen auf der
Bühne brauchen nur ihre Liste.

### 3b. Klassifizierung ist Koordination, nicht Erfassung

Die Erfassung liefert Wortlaut und Einzelfragen, sonst nichts. Pfad, Bühnenzuordnung und Zuweisung
entscheidet eine andere Rolle im nächsten Schritt. In der Rechtetabelle ist das ein Zeilentausch, in
der Oberfläche eine Verschiebung der Bedienelemente von der Erfassungskarte in die Steuerungsansicht
der Beantwortung. Dass die Statusmaschine und die Rechte als Daten vorliegen, zahlt sich hier zum
ersten Mal aus: keine Logikänderung, keine neue Prüfung des Kerns. Die Ist-Analyse hatte den Schritt
„klassifizieren" richtig, aber die Rolle falsch zugeordnet.

### 3c. Beantworten heißt Schreiben

Die Person im Fachbereich will die Frage öffnen, groß sehen, schreiben, formatieren und weiterleiten.
Filter, Verteilung, Zeitstempel und Tagesordnungspunkt stören sie. Zugleich muss die Formatierung
überall gleich bleiben. Die Lösung ist ein begrenztes Format (fett, kursiv, Hervorhebung, Aufzählung),
das beim Speichern normalisiert wird, und zwei getrennte Ansichten auf dieselben Daten: Fokus und
Steuerung. Das Antwortformat gehört in den Vertrag, weil Bühne, Historie und spätere Publikation es
rendern.

**Nebenbefund:** Die Verdichtungen der letzten Runde (Marker, Ring, Verteilung, Dringlichkeit) waren
auf 800 Fragen ausgelegt. Bei 200 bis 250 Fragen und 25 bis 30 Wortmeldungen sind einige davon
überflüssig; Redezeit und Art fallen ohnehin. Weniger ist hier richtig.

---

## 4. Unklar — Fragen an die Projektleitung

Kurz, damit sie per Sprachnachricht beantwortbar sind.

1. **„Button Daten":** Welcher Knopf ist gemeint? (Screenshot der Wortmeldeliste beilegen, Knöpfe nummeriert.)
2. **Wer klassifiziert?** Welche Rolle oder Person entscheidet Pfad und Bühnenzuordnung, und wie heißt sie im Haus?
3. **Antwortrunde:** Wer stellt die rund 20 Antworten zusammen, nach welcher Regel, und gibt es eine feste Reihenfolge je Vorstandsmitglied?
4. **Transkriptionstool:** Wie heißt es genau, wie kommen Texte heraus (Schnittstelle, Datei, Kopieren), und erkennt es die sprechende Person?
5. **Rückfragen im Tool:** Soll es je Frage ein Notiz- oder Rückfragefeld geben, das Teams ersetzt, oder bleibt das bewusst außerhalb?
6. **„Weiterleiten":** Nur zum nächsten Schritt, oder auch an eine Kollegin oder einen anderen Fachbereich?
7. **Formatierung:** Reichen fett, kursiv, Hervorhebung und Aufzählung? Ist Schriftwahl bewusst nicht gewünscht, weil das Hausformat gilt?
8. **Bühne je Person:** Sieht ein Vorstandsmitglied nur seine eigenen Fragen, oder alle mit Markierung der eigenen?
9. **Rollen und Personen:** Die angekündigte Aufteilung der bis zu 50 Personen, und ob es einen Identity Provider gibt, gegen den angemeldet werden kann.

---

## 5. Die entscheidende Frage: der Änderungstakt

Die Projektleitung macht die Entscheidung an einer Größe fest: Wie schnell wird eine kleine
Anmerkung umgesetzt? Das lässt sich nicht behaupten, nur zeigen. Vorschlag:

**Der Takt.** Feedback kommt als Sprach- oder Textnachricht. Am selben Tag entsteht eine Tabelle wie
Abschnitt 2 mit Status und Aufwand. Alles mit Aufwand S wird sofort gebaut, geprüft und
veröffentlicht; M-Punkte bekommen eine Spec und einen Termin; L-Punkte und Unklares eine Rückfrage.
Gemessen wird die Zeit von der Nachricht bis zur sichtbaren Änderung auf hvtool.netlify.app.

**Zielwerte, an denen sich der Takt messen lässt:**

| Klasse | Beispiel aus diesem Feedback | Ziel |
|---|---|---|
| S | Uhr klein, Redezeit weg, Korpus 230, Griff sichtbar, „Weiterleiten" | am selben Tag, unter vier Stunden |
| M | Klassifizierung in die Beantwortung, Fokusansicht, Bühne je Person | innerhalb von zwei Arbeitstagen |
| L | Antwortformat mit Vertragsänderung, Transkript-Ingest, Anmeldung | innerhalb einer Woche, nach Klärung |

**Warum das glaubwürdig ist:** Die Umbauten aus 3b sind Tabellenänderungen, weil Rechte und
Übergänge Daten sind. Die Fokusansicht ist eine neue Komposition aus dem bestehenden Bausatz. Das
Antwortformat ist eine Schemaänderung im Vertrag, die generierte Typen und Tests sofort sichtbar
machen. Jede Änderung läuft durch dieselben Tore wie bisher, deshalb bleibt der Takt auch bei vielen
kleinen Anmerkungen ohne Regression.

**Was nicht „mini" ist:** Editor mit Format, Bühne je Gerät, Antwortrunde, Transkript-Ingest,
Anmeldung. Diese brauchen seine Antworten aus Abschnitt 4 zuerst; ohne sie würde gebaut, was dann
wieder geändert wird.

---

## 6. Vorgeschlagene Scheiben

| Scheibe | Inhalt | Aufwand | Voraussetzung |
|---|---|---|---|
| **008 Rückbau und Passung** | Korpus 28 Wortmeldungen / 230 Fragen; Uhr klein; Redezeit, Ring und Art entfernt; Aufnahme-Dialog auf Name, Organisation, Runde; Erfassungskarte schlank; TOP optional und ausgeblendet; Griff sichtbar mit Hinweis; „Nur Bühne" als Standard der Podiumsrolle; Warteschlange anklickbar mit Vorschau und „noch n"; Begriff „Weiterleiten"; Lesehinweis in fremden Rollen | S, ein halber Tag | keine; sofort möglich |
| **009 Koordination** | Rolle Koordination in der Rechtetabelle; Klassifizierung und Zuweisung in die Steuerungsansicht der Beantwortung; Übersicht „wo liegt was" je Bühnenzuordnung und Fachbereich; Wahrheitstabelle neu generiert und geprüft | M, ein Tag | Frage 2 |
| **010 Beantworten als Schreiben** | Fokusansicht nur eigene Zuweisungen; Doppelklick öffnet; Vollbild; begrenztes Format mit Normalisierung beim Speichern; Antwortformat im Vertrag; Bühne und Historie rendern das Format | M–L, ein bis zwei Tage | Fragen 6, 7 |
| **011 Bühne je Gerät** | Ansicht je Bühnenzuordnung mit eigener Reihenfolge und Fortschritt; Anzeigeeinstellungen je Gerät; Antwortrunde als Bündel | M, ein Tag | Fragen 3, 8 |
| **Pilot** | Anmeldung je Person (OIDC), HTTP-Dienst mit Datenbank für 50 gleichzeitige Nutzer, Transkript-Ingest, Wissensbasis-Schnittstelle, Übernahme-Sperre bei paralleler Erfassung | L | Fragen 4, 9; Konzern-IT |

Reihenfolge: 008 sofort als Nachweis des Takts, parallel die neun Fragen stellen, danach 009 bis 011
in der Reihenfolge der Antworten.
