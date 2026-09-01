# Rollen- und Rechtekonzept

**Frage, die dieses Dokument beantwortet:** Wie wird das Berechtigungsmodell flexibel genug, um von Jahr
zu Jahr angepasst zu werden — ohne dass jede Anpassung ein Umbau ist und Fehler produziert?

**Kurzantwort:** Indem Rechte **Daten** sind und nicht Code, indem es **genau einen** Ort gibt, an dem
über Zugriff entschieden wird, und indem jede Änderung an der Rechtetabelle einen Testlauf auslöst, der
zeigt, **welche Zugriffe sich dadurch geändert haben**. Das dritte Element ist das eigentlich
entscheidende: ohne es bleibt jede Rechteänderung ein Blindflug, egal wie sauber das Modell ist.

---

## 1. Der heutige Kern ist richtig

Das bestehende Tool bindet Rechte an den **Status** einer Frage: je Status sind Personen hinterlegt,
und wohin weitergeleitet werden darf, hängt von den Rechten ab — Expert Track nur ins juristische
Clearing, Administration überall hin.

Das ist ein tragfähiges Modell und es entspricht dem mentalen Modell der Anwender. Es wird nicht ersetzt.
Es wird an drei Stellen ergänzt und an **einem** Ort zusammengeführt.

---

## 2. Vier Schichten, bewusst entkoppelt

### 2.1 Der Code kennt keine Rollen, nur Berechtigungen

Nirgends im Code steht `if (user.role === "legal")`. Es steht immer `can(actor, "answer.approve.legal", question)`.

Rollen sind **Bündel von Berechtigungen** und liegen als Daten vor. Eine neue Rolle, eine geänderte
Rolle, eine zusätzliche Freigabestufe — nichts davon berührt Code.

> **Regel:** Eine neue Rolle darf niemals ein Code-Release erfordern. Wenn sie es doch tut, ist das ein
> Architekturfehler und kein Feature-Wunsch.

Berechtigungen werden fein geschnitten und sprechend benannt, weil sie in Assessments und in der
Betriebsvereinbarung gelesen werden:

```
speech.round.reorder          Wortmeldeliste umsortieren
speech.timer.control          Redezeitmessung starten und stoppen
question.create               Frage erfassen
question.split                Redebeitrag oder Blatt in Einzelfragen zerlegen
question.classify             Antwortpfad zuweisen
question.answer.draft         Antwortentwurf schreiben
question.answer.approve.expert   Fachfreigabe
question.answer.approve.legal    Rechtsfreigabe
question.refuse.propose       Verweigerung vorschlagen
question.refuse.approve       Verweigerung freigeben
question.forward              Weiterleiten
stage.read                    Bühnenansicht sehen
stage.mark.delivered          "Vorgelesen, weiter"
stage.return                  Antwort ins Backoffice zurückgeben
question.identity.reveal      Klarnamen des Fragestellers auflösen
export.dossier                Dossier exportieren
admin.roles.manage            Rollen und Zuweisungen verwalten
```

### 2.2 Genau ein Entscheidungspunkt

Eine einzige Funktion beantwortet jede Zugriffsfrage im System:

```
can(actor, action, resource, context) -> Allow | Deny(reason)
```

Alles fragt diese Funktion: die API-Autorisierung, die Workflow-Übergänge, die Sichtbarkeit von Feldern,
die Zusammenstellung der Bühnenansicht. Es gibt keinen zweiten Ort.

**Das Frontend hält keine Kopie der Regeln.** Der Server liefert an jedem Vorgang mit, welche Aktionen
für diesen Benutzer gerade erlaubt sind:

```json
{ "id": "F-2027-0412", "status": "legal_clearing",
  "_actions": ["answer.approve.legal", "question.refuse.propose", "question.forward"] }
```

Die Oberfläche rendert daraus die Bedienelemente. Ein Button, den man nicht drücken darf, wird nicht
ausgegraut — er existiert nicht.

> Das ist der klassische Fehlerherd: Frontend und Backend führen zwei Kopien derselben Regel, und beim
> nächsten Umbau driften sie auseinander. Ein ausgegrauter Button ist außerdem für Gelegenheitsnutzer
> am HV-Tag eine Einladung zum Rückfrageanruf.

### 2.3 Rolle allein reicht nicht — Kontextattribute

Fünf Attribute entscheiden mit, weil die HV-Realität sie verlangt:

| Attribut | Wirkung | Beispiel aus eurem Prozess |
|---|---|---|
| **Status** | erlaubte Übergänge | Expert Track darf nur ins juristische Clearing |
| **Zuweisung** | Sichtbarkeit | ein Segment sieht nur seine Fragen, nicht den Gesamtbestand |
| **Bühnenzuordnung** | Bühnenansicht | der Vorstand sieht nur, was ihm zugeordnet **und** bereit ist |
| **Zeitfenster** | Gültigkeit | Rechte gelten von T-x bis T+x und laufen automatisch ab |
| **Vertraulichkeitsstufe** | Existenz | Sperrvermerk-Fragen sind für Nichtberechtigte nicht einmal sichtbar |

Rolle **und** Attribute, ausgewertet an derselben Stelle. Das erspart die Rollenexplosion: aus
„Fachbeantwortung Segment Technik" und „Fachbeantwortung Segment Finanzen" wird **eine** Rolle plus ein
Zuweisungsattribut.

### 2.4 Workflow-Übergänge sind eine Tabelle

Die Statusmaschine liegt als Daten vor, nicht als Verzweigungen im Code:

| von | nach | Berechtigung | Pflichtfelder | Vier-Augen |
|---|---|---|---|---|
| `classified` | `expert_answering` | `question.forward` | Segment | – |
| `expert_answering` | `legal_clearing` | `question.forward` | Antworttext, Quelle | – |
| `legal_clearing` | `ready_for_stage` | `answer.approve.legal` | Freigabevermerk | Ersteller ≠ Freigeber |
| `legal_clearing` | `expert_answering` | `question.forward` | Rückgabegrund | – |
| beliebig | `refused` | `question.refuse.approve` | Verweigerungsgrund, Begründung | Ersteller ≠ Freigeber |

Eine zusätzliche Freigabestufe einzuziehen heißt: **eine Zeile ergänzen.** Kein Codeumbau, keine neue
Klasse, kein Regressionsrisiko in unbeteiligten Pfaden.

---

## 3. Was Änderungssicherheit tatsächlich herstellt

Ein sauberes Modell allein verhindert keine Fehler. Diese fünf Mechanismen tun es.

**1 · Rechte als versioniertes Artefakt.** Die Matrix liegt im Repository, wird wie Code behandelt:
Diff, Review, Vier-Augen-Freigabe, Rollback. Wer im März eine Rolle ändert, erzeugt einen lesbaren
Änderungssatz und keinen stillen Datenbankeintrag.

**2 · Policy-Tests als Wahrheitstabelle.** Für jede Kombination aus Rolle, Aktion und Status existiert
ein erwartetes Ergebnis. Ändert jemand die Matrix, meldet der Testlauf **genau, welche Zugriffe sich
geändert haben** — die gewollten und die ungewollten:

```
+ fast_track_member  question.refuse.propose  status=classified   DENY -> ALLOW
- legal_clearing     export.dossier           status=*            ALLOW -> DENY   (nicht beabsichtigt?)
```

Das ist der Mechanismus, der Umbauten angstfrei macht. Ohne ihn ist jede Rechteänderung ein Blindflug.

**3 · Eingefrorener Snapshot je HV-Jahrgang.** Beim Konfigurations-Freeze wird die wirksame Matrix
eingefroren und gehasht. Damit ist Monate später belegbar, wer am HV-Tag was durfte — und der Vergleich
zum Vorjahr ist ein Diff statt einer Rekonstruktion.

**4 · Deny by default.** Eine neue Aktion ist zunächst für niemanden erlaubt und muss ausdrücklich
vergeben werden. Der häufigste Rechte-Bug ist die zu breite Vererbung: beim Umbau erhält jemand still
ein Recht, das niemand vergeben wollte.

**5 · Simulationsmodus.** „Ansicht als Rolle X" zeigt vor dem HV-Tag, was eine Rolle tatsächlich sieht
und darf. Das ist zugleich das Prüfwerkzeug für die Generalprobe, für die Assessments und für den
Betriebsrat — und es ersetzt das Testen mit echten fremden Accounts.

---

## 4. Was bewusst nicht konfigurierbar ist

Flexibilität darf nicht zur Selbstentwaffnung führen. Diese Invarianten sind Code, nicht Konfiguration,
und ihre Änderung erfordert ein Release mit Rechtsfreigabe:

- **Ersteller ≠ Freigeber.** Kein Recht und keine Rollenkombination kann das Vier-Augen-Prinzip
  abschalten — auch nicht durch Rollenwechsel innerhalb derselben Sitzung.
- **Keine physische Löschung** einer Frage, eines Antwortstands oder eines Auditeintrags. Für niemanden,
  auch nicht für die Administration oder die Datenbankrolle.
- **Kein Abschalten des Audit-Logs**, für keine Rolle und keinen Zeitraum.
- **Keine Verweigerung ohne zugeordneten Grund und Begründung.** Der Zustand ist ohne diese Felder nicht
  speicherbar.
- **Keine Freigabe ohne Bindung an die Textversion.** Jede Textänderung nach Freigabe setzt sie zurück.

**Administration ist Rechteverwaltung, nicht Inhaltsbearbeitung.** Dass die Administration eine Frage
überall hinschicken kann, ist praktisch nötig und bleibt — aber jede administrative Aktion auf Inhalte
erzeugt einen herausgehobenen Auditeintrag und ist im Verlauf der Frage sichtbar. Sonst wird der
Admin-Account zum Loch in der Nachweiskette.

---

## 5. Rollenzuschnitt: wenige Rollen, viele Attribute

Aus der Recherche: acht bis zehn operative Rollen, nicht fünfundzwanzig. Ein zu feines Modell macht am
HV-Tag die Administration zum Nadelöhr — Rechte-Tickets während der Generaldebatte sind die häufigste
selbstverschuldete Verzögerung.

Aus eurem Prozess abgeleiteter Vorschlag:

| Rolle | Prozessbezug |
|---|---|
| Regie / Wortmeldung | Wortmeldeliste, Runden, Redezeit |
| Erfassung | Schritt 2, Atomisierung |
| Eingangskoordination | Schritte 3–4 |
| Klassifizierung | Schritt 5 |
| Fachbeantwortung | Schritt 6 Pfad C, Segment über Attribut |
| Fast Track | Schritt 6 Pfad B |
| Rechtsprüfung | Schritt 7 und Schritt 10 |
| Redaktion / Finalisierung | Schritte 8B und 9 |
| Bühne | Schritt 6 Pfad A und Ausgabe, Zuordnung über Attribut |
| Leitstand / Projektleitung | Schritt 8A, Steuerung, Eskalation |
| Notar | nur lesend |
| Revision | nur lesend |
| Administration | Rechte, keine Inhalte |

Segmente, Bühnenplätze und Vertraulichkeitsstufen sind **Attribute**, keine eigenen Rollen. Für jede
Rolle mindestens **zwei benannte Vertreter** und eine protokollierte Notfall-Rechteerhöhung mit
automatischem Ablauf.

---

## 6. Warum das die Assessments trägt

Das Rechtekonzept ist das zentrale Artefakt für alle drei internen Prüfungen. Wenn es maschinenlesbar
und exportierbar ist, schrumpft der Aufwand jeder Prüfung erheblich.

**Datenschutz.** Berechtigungskonzept und Datenminimierung sind die Kernfragen jeder
Folgenabschätzung. Die Antwort ist hier belegbar statt behauptet: Fachbereiche sehen pseudonymisierte
Fragen; die Auflösung des Klarnamens ist eine eigene, protokollierte Berechtigung; Rechte laufen nach
der HV automatisch ab. Die Matrix wird als Anlage exportiert, nicht in Prosa beschrieben.

**Informationssicherheit.** Need-to-know, Funktionstrennung, Deny by default, Break-Glass mit Alarm —
alles direkt aus derselben Tabelle belegbar. Die Frage „wer konnte am HV-Tag welche unveröffentlichte
Antwort sehen?" beantwortet der eingefrorene Snapshot.

**Betriebsrat.** Hier ist der springende Punkt **nicht** die Rechtematrix, sondern der
**Auswertungskatalog**: welche personenbezogenen Auswertungen sind technisch überhaupt möglich?

Die Verhandlung wird leicht, wenn die Antwort lautet: „Diese hier — und zwar abschließend. Drill-down
auf Einzelpersonen ist technisch deaktiviert, nicht organisatorisch untersagt. Hier ist die Liste als
versionierte Anlage, die sich bei jedem Release automatisch mitändert und im Review sichtbar wird."

Sie wird schwer, wenn die Antwort lautet: „Grundsätzlich alles, wir verpflichten uns, es nicht zu tun."

> **Konkrete Anforderung:** Der Auswertungskatalog wird **aus dem System generiert**, nicht gepflegt.
> Jeder Report trägt seine Aggregationsstufe und Mindestfallzahl im Code; die Anlage zur
> Betriebsvereinbarung ist ein Build-Artefakt. Damit kann kein Release still eine personenbezogene
> Auswertung einführen — der Diff macht es sichtbar, bevor es ausgeliefert wird.

Ergänzend zu trennen sind die beiden Protokollebenen: die fachliche Vorgangshistorie (Nachweis, lange
Aufbewahrung) und die technischen Zugriffslogs (kurz, nur im Zwei-Schlüssel-Verfahren auswertbar). Ihre
Vermischung macht aus einem aktienrechtlichen Nachweis eine Leistungskontrolle — und genau daran
scheitern solche Verhandlungen.
