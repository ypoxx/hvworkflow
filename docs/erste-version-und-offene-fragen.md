# Erste lauffähige Version — Schnitt, Nagelprobe, offene Fragen

**Zweck:** festlegen, was eine erste Version beweisen muss, damit die Entscheidung „hier lohnt sich
weitere Zeit" belastbar getroffen werden kann — und welche Antworten dafür gebraucht werden.

---

## 1. Was diese Version beweisen muss

Nicht Funktionsumfang. Drei Dinge:

1. **Sie trägt unter echter Last.** Nicht zwölf Demofragen, sondern das Volumen einer realen
   Generaldebatte. Ein Board mit zwölf Einträgen sieht immer gut aus.
2. **Sie überzeugt in der schwierigen Szene.** Nicht das Anlegen einer Frage, sondern die Antwortrunde
   am Nachmittag: Rückstau, parallele Bearbeitung, das Podium wartet.
3. **Sie spricht die Sprache des Hauses.** Wortmeldung, Redebeitrag, Antwortpfad, Bühnenzuordnung,
   Klassifizierung — nicht Ticket, Assignee, Workflow-Instanz. Fremdes Vokabular kostet die Zustimmung
   der Projektleitung in den ersten dreißig Sekunden.

**Abnahmesatz, an dem sich die Version messen lässt:**

> Eine Person, die das Werkzeug nie gesehen hat, erfasst aus einem Redebeitrag sieben Einzelfragen,
> klassifiziert sie, schickt sie in die Beantwortung, eine zweite Person beantwortet und gibt frei,
> und der Vorstand liest sie am Podiumsgerät vor und schließt sie ab — bei 800 Fragen im Bestand,
> ohne Anleitung, ohne dass jemand erklären muss, wo man klickt.

---

## 2. Schnitt der ersten Version

**Enthalten — die Wirbelsäule des Prozesses, Ende zu Ende:**

- Wortmeldeliste mit Runden und Drag-and-drop, Redezeitmessung
- Erfassung eines Redebeitrags und **Atomisierung** in Einzelfragen mit Restabdeckungsanzeige
- Klassifizierung auf die drei Antwortpfade
- **Ein** Antwortpfad vollständig — Vorschlag: Expert Track, weil er die meisten Stufen hat
- Freigabe mit Bindung an die Textversion
- Bühnenansicht mit „vorgelesen, weiter" und „Antwort zurückgeben"
- Vorgangshistorie und Filterung nach Status
- Rechte je Status für drei bis vier Rollen
- Volltextsuche über den Bestand

**Bewusst nicht enthalten:** Chat, Wissensdatenbank, KI-Anbindung, Verweigerungspfad, Nachfragen,
Notarschnittstelle, Publikation, Nachbereitung, die anderen beiden Antwortpfade. Alles davon ist wichtig
— aber keines davon entscheidet, ob sich die Fortsetzung lohnt.

**Nicht verhandelbar auch in der ersten Version:** unveränderliche Vorgangshistorie, Freigabe an die
Textversion gebunden, kein physisches Löschen. Diese drei sind später nicht nachrüstbar, ohne alles
anzufassen.

---

## 3. Fragen an die HV-Projektleitung

### Die drei wichtigsten

**F1 · Erzähl mir die letzte Hauptversammlung ab 14 Uhr.** Was ist passiert, was ist schiefgegangen, wo
wurde improvisiert, wo wurde es eng?
*Warum:* Eine Stunde Erzählung liefert mehr Anforderungen als ein Workshop. Die Stellen, an denen
improvisiert wurde, sind exakt die Stellen, an denen das Werkzeug heute nicht trägt.

**F2 · Welche drei Dinge macht ihr heute außerhalb des Tools?** Excel, Teams, Zuruf, Papier, Telefon.
*Warum:* Jeder Nebenkanal ist eine Funktionslücke — und zugleich der Ort, an dem die Nachweiskette
reißt. Das sind die wertvollsten Features, und sie stehen in keiner Anforderungsliste.

**F3 · Liest der Vorstand die Antwort wörtlich vor, oder spricht er frei auf Basis der Antwort?**
*Warum:* Das entscheidet das gesamte Antwortprodukt. Wörtliches Vorlesen verlangt Sprechfassung,
Vorlesedauer und ausgeschriebene Zahlen. Freies Sprechen verlangt Kernaussage plus Belege — und macht
die Erfassung der tatsächlich gegebenen Antwort zwingend, weil Entwurf und gesprochenes Wort dann
regelmäßig auseinandergehen.

### Zur Bühne — hier wird das Werkzeug gewonnen oder verloren

**F4** Wie viele Personen sitzen am Podium, und hat jede ein eigenes Gerät — oder gibt es eine zentrale
Ansicht, die eine Assistenz bedient?
**F5** Wer bedient das Gerät: das Vorstandsmitglied selbst oder eine Assistenz daneben?
**F6** Wie kommt die Antwort heute physisch aufs Podium — Bildschirm, Ausdruck, beides?
**F7** Wie läuft eine Antwortrunde ab: wie viele Fragen, wie lange, in welcher Reihenfolge?

### Zum Volumen — damit die Version unter echter Last läuft

**F8** Wie viele Einzelfragen kamen bei der letzten HV zusammen? Grob genügt: Blätter mal Fragen je
Blatt, plus Live-Fragen.
**F9** Wie viele Redner, und wie lange dauerte die Generaldebatte?
**F10** Wie viele Personen arbeiteten im Backoffice, in welchen Rollen, wie viele gleichzeitig?
**F11** Wie hoch ist der Anteil gleichartiger Fragen, und wie oft wird tatsächlich gebündelt?

### Zur Erfassung — der Engpass am Anfang

**F12** Wer schreibt heute mit: Stenografie, eigene Mitarbeitende, das Transkriptionstool? Wie viele
parallel?
**F13** Wird der **Wortlaut** erfasst oder eine sinngemäße Fassung?
**F14** Wie wird heute ein Blatt mit zwölf Fragen erfasst: als ein Vorgang oder als zwölf?

### Zur Statusmaschine — damit sie einmal richtig geschnitten wird

**F15** Wie viele Status gibt es heute tatsächlich, und wie heißen sie im Haus?
**F16** Welche Weiterleitungen sind heute erlaubt — bitte als Matrix, so grob wie sie ist.
**F17** Was passiert heute mit einer Frage, die nicht beantwortet wird? Gibt es den Fall bewusster
Nichtbeantwortung, und wer entscheidet ihn?
**F18** Wo wird die vorbereitete Frage tatsächlich beantwortet, wenn `8A` sie direkt abschließt — in der
Rede, in einer Antwortrunde, anders?

### Zur Bewertung

**F19** Woran würdest du nach der ersten Vorführung festmachen, dass sich die Fortsetzung lohnt?
*Warum:* Wenn das vorher ausgesprochen ist, wird die Vorführung daran gebaut — und nicht an dem, was
sich leicht zeigen lässt.

---

## 4. Fragen an die Umsetzung

**U1 · Welcher Stack?** Womit arbeitest du dauerhaft gern und sicher? Du pflegst das Ergebnis — das
wiegt schwerer als jede Technologieempfehlung von außen.
**U2 · Konzernvorgaben.** Gibt es verbindliche Vorgaben zu Sprache, Laufzeit, Datenbank, Hosting,
Betriebsplattform? Muss es in eine bestimmte Landschaft, oder ist der Prototyp frei?
**U3 · Wo läuft die erste Version?** Deine Maschine, eine interne Umgebung, oder von Anfang an in der
Konzernlandschaft? Das bestimmt, wie viel Betriebsaufwand vor der ersten Vorführung anfällt.
**U4 · Anmeldung.** Gibt es einen Identity Provider, gegen den der Prototyp schon gehen kann, oder
zunächst lokale Konten?
**U5 · Daten.** Darfst du Material der letzten HV in eine Entwicklungsumgebung geben — und sei es
synthetisiert? Ohne realistischen Bestand ist der Lastbeweis nicht führbar. Falls nein, erzeugen wir
einen synthetischen Korpus, der Themen- und Längenverteilung nachbildet.
**U6 · Zeitfenster.** Wann ist die nächste Hauptversammlung, und wann müsste die Entscheidung
„weitermachen" fallen? Der Termin ist der einzige harte Anker der Planung.
**U7 · Publikum.** Wer sieht die erste Version — nur die Projektleitung, oder auch Recht, IR,
Datenschutz? Das ändert, was gezeigt wird.
**U8 · Team.** Baust du allein oder mit anderen? Davon hängt ab, wie viel Struktur sinnvoll ist und wo
sie zur Last wird.
**U9 · Design.** Gibt es ein Design-System oder Vorgaben für interne Weboberflächen, an die ich mich
halten soll?
**U10 · Nachbarsysteme.** Kommst du kurzfristig an deren Teams heran, oder ist das ein längerer Weg?
Davon hängt ab, ob die erste Version die Anbindung schon zeigt oder zunächst simuliert.
