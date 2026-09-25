# Zielbild Oberfläche — UI-Bewertung und Prototyp als Quelle für die Beta

**Quelle:** Bewertung der Demo auf Stand `429632d` (alle acht Rollen, 1440, 1280 und 1024 px) und ein
klickbarer Prototyp mit drei Ansichten, beides am 25.09.2026 auf Wunsch des Eigentümers in einer
Agentensitzung erstellt. **Prototyp:** `docs/zielbild/` (Anleitung dort), Bilder
`docs/evidence/089-*.png`. **Übernahme:** Scheibe 089. **Zweck:** Jeder Punkt hat eine ID und genau einen
Ort im Plan (Abdeckungsmatrix, Plan 5.0): eine Scheibe, die Takt-Spur, eine offene Registerzeile oder ein
bewusstes Nein. Scheiben-Specs zitieren die IDs.

**Statusschlüssel** (wie `2026-09-quickview-projektleitung.md`): `ist` gebaut · `plan` in der genannten
Scheibe vorgesehen · `neu` nicht vorgesehen, wird der genannten Scheibe zugeschlagen · `umbau` vorhanden,
gehört anders · `E..` offen im Entscheidungsregister, gebaut wird die Standardannahme · `nein` bewusst
nicht im Produkt. **Aufwand** in Agentenstunden (AStd) wie Plan und Register, nur für den Anteil, den
dieser Punkt der genannten Scheibe hinzufügt; `—` heißt: schon in deren Aufwand enthalten. Die Spec der
Scheibe schätzt neu (Abschnitt 4).

---

## 1. Befunde der UI-Bewertung (U1–U11)

Was heute stört, unabhängig vom Zielbild. Die `neu`-Punkte liegen unter einer Agentenstunde und gehören in
die Takt-Spur (Plan 5.9); jeder bekommt beim Bau seine Mini-Spec `docs/slices/takt-NNN-*.md`.

| Nr. | Befund | Stelle | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| U1 | In der Beantwortungsliste bleiben vom Fragetext zwei, drei Wörter, bei 1280 px eines; der Name der Rednerin hat Vorrang. Bei 1024 px überlagern sich die Spaltenköpfe. | `apps/web/src/features/answers/WorkList.tsx` (Zeile mit `maxWidth: 96`) | neu | Takt-Spur | 0,5 |
| U2 | Die Kopfzeile läuft ab 1280 px über: Demo-Kennzeichen und Zurücksetzen fallen heraus, bei 1024 px auch Sprachwahl und Rollenwahl. | `apps/web/src/app/Header.tsx` | neu | Takt-Spur | 0,5 |
| U3 | Die Leertaste setzt auf der Bühne sofort „vorgelesen". In der Rolle Podium schließt die Bühne die Frage gleich danach ab (Recht `question.close`, Endzustand `closed`); einen Rückweg gibt es dann nicht. Andere Rollen können nur zurückgeben (R-TRANS-06: zum Antwortentwurf, bei Antwortpfad A zu „klassifiziert"), und die Freigabe gilt nicht mehr. | `apps/web/src/features/stage/Page.tsx` (Tastenhandler), `packages/domain/src/transitions.ts` | E52 | 058 (Rückgängig-Fenster), 056 (Halten nach E52) | siehe Z18 |
| U4 | Drei verschiedene Restzahlen auf der Bühne (Navigation 9, „Offen 332", „noch 8"); die Zahl unter dem Balken der Kopfzeile trägt keine Beschriftung. | Bühne, `apps/web/src/app/HeaderStrip.tsx` | neu | Takt-Spur | 0,25 |
| U5 | Eine erfasste Einzelfrage bietet in der Beantwortung keinen nächsten Schritt; in der Rolle Versammlungsbüro ist „Antwort zurückgeben" das größte Element der Bühne. | Beantwortung, Bühne | umbau | 021/053 (Klassifizierung), 056 (Z22) | — |
| U6 | Der rote Randbalken der Liste hängt nur am Alter und ist ab 45 Minuten immer rot, ohne Legende. | `apps/web/src/features/answers/lib.ts` (`urgencyLevel`) | neu | Takt-Spur (Legende) | 0,25 |
| U7 | Die Kürzel-Kreise (FV, AR, VV, VM) in der Bühnen-Warteschlange werden nirgends erklärt. | `apps/web/src/features/stage/` | neu | Takt-Spur | 0,25 |
| U8 | Die Kürzel-Hilfe (`?`) nennt nur die globalen Tasten, nicht `Alt+Q`, Leertaste und `R`. | `apps/web/src/app/ShortcutsDialog.tsx`, Feature-Register | neu | Takt-Spur | 0,25 |
| U9 | In der Detailansicht steht der Stand doppelt; „keine Angabe" erscheint dreimal untereinander. | `apps/web/src/features/answers/QuestionDetail.tsx` | neu | Takt-Spur | 0,25 |
| U10 | Der Fachbereich sieht die Klarnamen der Redner in Liste und Detail (Recherche Z.116, Register S4 „Standard an"). | Beantwortung | plan | 026, 054 (Z8) | — |
| U11 | Rückmeldungen #14 (Korpus 118/800) und #15 (Redezeit, Art) sind noch sichtbar. | Wortmeldungen | plan | 080 | — |

## 2. Zielbild (Z1–Z26)

### Schreibraum — Fachbereich schreibt eine Antwort (im Produkt: Fokusansicht, 054)

| Nr. | Vorschlag | Begründung | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| Z1 | Nur eigene Zuweisungen, älteste oben, Fragetext zweizeilig lesbar, Alter in Minuten | Rückmeldungen #24, #28; U1 | plan | 054 | — |
| Z2 | Vorbereitete Antwort aus der Erwartungskarte über dem Editor: Übereinstimmung in Prozent, „Ganz lesen", „Übernehmen" mit Rückgängig, Hinweis „Dein Entwurf weicht ab: 45 Prozent statt 47 Prozent"; Treffer-Kennzeichen an der Frage in der Liste | Recherche Z.175 (Fragenprognose), B-Liste „Vorbereitung §7" | E50 | neue Scheibe nach E50 | rund 3 |
| Z3 | Zahlenprüfung im Editor: belegt (durchgezogen unterstrichen), ohne Beleg (gepunktet), Widerspruch zu einer schon vorgelesenen Antwort (rot hinterlegt); Listen „Prüfung vor Legal Clearing" und „Belege zur Antwort"; Recht sieht dieselben Markierungen | Recherche SOLL Z.240; Engpass Rechtsfreigabe (Recherche Z.27) | E51 | neue Scheibe nach E51, Anzeige in 054 und 059 | 3–4 (mit Z4) |
| Z4 | Korrektur per Klick für bekannte Werte („47 Prozent einsetzen"), mit Rückgängig | wie Z3 | E51 | mit Z3 | — |
| Z5 | Vorlesezeit aus der Wortzahl (130 Wörter je Minute), Ziel zwei Minuten, Hinweis bei Überschreitung | Antwortrunde 20 × 2 min (Feedback Abschnitt 1) | neu | 054 | 0,25 |
| Z6 | Werkzeugleiste Hausformat: fett, kursiv, Hervorhebung, Aufzählung; Hinweis „Schrift und Größe kommen von der Ansicht" | #27, #30, #31, E6 | plan | 055 | — |
| Z7 | Vollbild blendet Liste und Prüfung aus | #29 | plan | 054 | — |
| Z8 | „Wortmeldung 15" statt Name für den Fachbereich | Recherche Z.116, S4; U10 | plan | 054 (Anzeige), 026 (Standard) | — |
| Z9 | „Weiterleiten" (E5) als einzige primäre Aktion: im Regelfall zum nächsten Schritt, der Rechtsfreigabe; die Übergabe an einen anderen Fachbereich (048) bleibt die zweite Aktion im Dialog aus 054. Dazu `Strg+Enter`, Rückgängig, danach öffnet die nächste Frage; die Rückfrage bei einem Widerspruch erst mit E51 | #32, E5 | umbau | 054 | 0,25 |

### Lagebild — Versammlungsbüro sieht den ganzen Fluss (im Produkt: Leitstand, 061)

| Nr. | Vorschlag | Begründung | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| Z10 | Eine große Zahl: älteste unbeantwortete Frage mit Station und Einheit, darunter die drei nächstältesten | Recherche Z.247 | plan | 061 | — |
| Z11 | Prognosen aus dem Tempo: „im Legal Clearing abgebaut ca. 16:05 bei 9 Freigaben je 15 min", „nächste Antwortrunde voll ca. 16:02" | Recherche Z.27 | neu | 061 | 0,25 |
| Z12 | Flussbild: ein Punkt je Einzelfrage in ihrer Station, Alter als Farbe und Form, Tempo je Station („+14 in 15 min"), Kennzeichen „Engpass", Tabelle mit denselben Zahlen. Die Stationen kommen im Produkt aus Status und Projektion (README, „Nicht übernehmen") | #11, #25 | neu | 061 | 1 |
| Z13 | Faden je Frage: Stationen mit Uhrzeit, aktuelle Station mit Verweildauer, Absprung in die Fokusansicht | Recherche Z.21 (Nachweisführung) | neu | 061 (Drill-down) | 0,5 |
| Z14 | Rednerwand mit Abschluss-Check: Wortmeldungen mit offenen Fragen zuerst, vollständige in einer Zeile eingeklappt, aufgeklappt jede Antwort mit Uhrzeit und Vorstandsmitglied | Recherche Z.78 | plan (Ansicht neu) | 087 | 0,5 |
| Z15 | Widerspruch zur Niederschrift als eigener Kanal über dem Lagebild, „An Notar übergeben" mit Empfangsvermerk | Recherche Z.74 | plan | 050, 085 | — |

### Teleprompter — ein Gerät je Vorstandsmitglied (im Produkt: Bühne, 056)

| Nr. | Vorschlag | Begründung | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| Z16 | Eigene Setliste mit Fortschritt („3 von 6") und Restzeit; Vorschau ohne „vorgelesen" | #7, #10, E7 | plan; Vorschau und „noch n" ist (020) | 056 (Runde: 057) | — |
| Z17 | Jeder Satz beginnt in einer neuen Zeile; kein Scrollen der Antwort | Recherche Z.250 | neu | 056 | 0,25 |
| Z18 | Rückgängig-Fenster von 5 s nach „vorgelesen": die Absicht wird lokal gehalten und erst danach gesendet; ein Presenter-Klicker schaltet sofort, ebenfalls mit Rückgängig. Dazu, nur nach E52: Weiter erst nach 0,6 s Halten (Finger, Maus, Leertaste) mit Rückmeldung „Etwas länger halten" | U3; das Halten ändert Designprinzip 7 | E52 | 058 (Rückgängig-Fenster, im Standard), 056 (Halten, nach E52) | 0,5 (058); 0,5 (056, nach E52) |
| Z19 | Anzeige je Gerät: Schriftgröße, Zeilenabstand, Saallicht, im Gerät gemerkt | #6 | plan | 056 | — |
| Z20 | Dunkler Grund als Standard des Podiums. Der Kontrastmodus mit dunklem Grund ist gebaut (Umschalter „Kontrast" je Gerät, Standard hell, 005/007); offen ist nur der Standardwert | Blendung unter Bühnenlicht | E53 | 056 | Minuten |
| Z21 | Ruhige Zeile aus dem Versammlungsbüro über dem Text, verdeckt ihn nie | Recherche Z.253, Z.261 (Souffleur-Kanal, B-Liste) | E54 | — (bei Ja 056, 085) | 1,5 (nach E54) |
| Z22 | „Antwort zurückgeben" als leiser Textknopf mit Grundauswahl, nicht als zweitgrößte Fläche | U5 | neu | 056 | 0,25 |
| Z23 | „Nur Bühne" blendet alles außer der Bühne aus | #3, #9 | ist | 020 | — |

### Übergreifend

| Nr. | Vorschlag | Begründung | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| Z24 | Rundgang in neun Schritten mit echten Klicks | Vorführung für die Projektleitung | nein (Produkt) | Vorführhilfe in Feedback-Runden (022, 063) | — |
| Z25 | Zeitraffer im Lagebild | nur Prototyp | nein | — | — |
| Z26 | Hinweise je Ansicht, die beim Überfahren die Stelle markieren | Kontexthilfe | plan | 062 | — |

## 3. Neue Entscheidungen (E50–E54)

Fünf Punkte brauchen eine Antwort der Projektleitung: drei sind nicht eingeplant oder stehen auf der
B-Liste (E50, E51, E54), einer ändert ein Designprinzip (E52), einer einen Standardwert (E53). Sie stehen im
Register mit Standardannahme; gebaut wird der Standard, bis eine Antwort da ist. Vorschlag: in der
Feedback-Runde 2 am 09.10.2026 zusammen mit dem Prototyp zeigen, Antworten bis Prüfpunkt 2 (16.10.2026),
für E52 und E53 spätestens bis 13.11.2026 vor 056.

| Nr. | Frage an die Projektleitung | Standardannahme |
|---|---|---|
| E50 | Soll der Fachbereich schon in der Beta vorbereitete, vor der HV freigegebene Antworten angeboten bekommen (Erwartungskarte)? | Nein, bleibt Teil der B-Liste „Vorbereitung §7"; Z2 bleibt Bild. |
| E51 | Soll das Tool Zahlen im Antworttext gegen eine Faktentabelle und gegen schon vorgelesene Antworten prüfen, bevor Recht freigibt? Wer pflegt die Faktentabelle? | Nein in der Beta; Z3 und Z4 bleiben Bild. |
| E52 | Soll „vorgelesen" auf der Bühne erst nach kurzem Halten gelten? | Nein bis zur Antwort: die Leertaste bleibt wie in Designprinzip 7. Das Rückgängig-Fenster von fünf Sekunden kommt in jedem Fall (058), weil es Designprinzip 7 nicht ändert und „vorgelesen" in der Rolle Podium heute sofort abschließt. |
| E53 | Soll der vorhandene Kontrastmodus der Bühne (dunkler Grund) Standard des Podiums werden? | Nein: Standard bleibt hell, der Umschalter „Kontrast" bleibt, 056 übernimmt ihn in die Anzeigeeinstellungen je Gerät. |
| E54 | Braucht die Bühne einen Rückkanal für kurze Hinweise des Versammlungsbüros? | Nein in der Beta, bleibt B-Liste „Rollen-Chat, Souffleur-Kanal". |

## 4. Wie die Scheiben das Zielbild nutzen

- Die acht Scheiben 050, 054, 055, 056, 058, 061, 062 und 087 tragen im Plan eine Zeile *Zielbild (089)*
  mit ihren Z-Nummern. Für 021/053, 026, 057, 059, 080 und 085 steht der Punkt nur hier und in der
  Abdeckungsmatrix; ihre Spec zitiert die ID. Jede Spec übernimmt ihre Punkte als Text; der Prototyp ist
  Gestaltungsreferenz, nicht Spec.
- **Aufwand.** Ohne Entscheidung kommen in M4 rund 3,75 AStd hinzu: 054 +0,5 (Z5, Z9, bisher 2), 056 +0,5
  (Z17, Z22, bisher 3), 058 +0,5 (Z18 Rückgängig-Fenster, bisher 2,5), 061 +1,75 (Z11, Z12, Z13, bisher 2),
  087 +0,5 (Z14, bisher 2). Die Takt-Spur trägt rund 2,25 AStd (U1, U2, U4, U6–U9). Nach einem Ja zu E50,
  E51, E52 oder E54 kämen bis zu rund 9 AStd dazu. Jede betroffene Spec schätzt neu; die Differenz geht an
  Prüfpunkt 2 (16.10.2026) und in die Budgettabelle je Meilenstein (Plan 6.5). Keine Scheibe kommt dadurch
  über das Doppelte ihrer AStd.
- **Begriffe.** Die Namen im Prototyp sind Arbeitsnamen; die Zuordnung zum Hausvokabular steht in der
  README unter „Namen im Prototyp". Neue Begriffe (Erwartungskarte, Rednerwand, Setliste, Faden, Saallicht,
  Vorlesezeit) kommen mit der Scheibe ins Glossar, die sie in die Oberfläche bringt.
- Implementierer öffnen `docs/zielbild/` (Anleitung in der README dort) und bauen die Ansicht mit den
  Mitteln des Produkts: `HvApi`, `_actions`, Übergangstabelle, i18n DE/EN.
- Die Design-Kritik vergleicht den Screenshot der gebauten Ansicht mit `docs/evidence/089-*.png`.
- Wer einen Punkt baut, setzt hier den Status nach (`plan` → `ist`) und nennt die Scheibe.
