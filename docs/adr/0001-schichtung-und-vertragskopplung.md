# ADR 0001 — Schichtung und Kopplung

**Status:** vorgeschlagen · **Datum:** offen · **Entscheider:** Umsetzung, Projektleitung

## Kontext

Aus dem Projekt kam die Frage, ob „komplett autarke Schichten" die beste Bauform sind — insbesondere ein
Frontend, das technisch nicht von Änderungen der übrigen Schichten abhängt.

Rahmen: gewachsenes Altsystem mit UI-Paradigmen von vor über zehn Jahren, kleines Umsetzungsteam,
ein Unternehmen als einziger Nutzer, und die ausdrückliche Erwartung, den Workflow **von Jahr zu Jahr**
zu optimieren. Die Oberfläche ist der Teil, der sich am häufigsten ändern wird.

## Die Beobachtung hinter der Frage

Vollständige Autarkie zwischen Frontend und Backend gibt es nicht. Beide sind immer über **einen
Vertrag** gekoppelt — die Schnittstelle. Die Frage ist nie *ob* gekoppelt wird, sondern **woran**:

- **An volatile Logik gekoppelt** heißt: das Frontend weiß, dass „Legal darf im Status X freigeben".
  Ändert sich die Regel, muss es mitgeändert werden — und wenn es vergessen wird, driften zwei Kopien
  derselben Regel auseinander. Das ist der Zustand, aus dem gewachsene Systeme nicht mehr herauskommen.
- **An einen stabilen Vertrag gekoppelt** heißt: das Frontend weiß nur, dass ein Vorgang eine Liste
  erlaubter Aktionen mitbringt. Die Regel dahinter darf sich beliebig ändern.

Ergänzend: dass das Altsystem starr ist, liegt erfahrungsgemäß **nicht** an fehlenden Schichten. Die
üblichen Ursachen sind Geschäftsregeln, die in Oberflächencode liegen; ein fehlender Schnittstellenvertrag;
das Datenbankschema als faktische API; und fehlende Tests, die jede Änderung zum Risiko machen. Mehr
Schichten allein heilen davon keine einzige.

## Entscheidung

Drei Grenzen werden hart gezogen. Innerhalb der Grenzen wird auf Schichtungszeremonie verzichtet.

**Grenze 1 — Oberfläche gegen Anwendung: der API-Vertrag.**
Die Oberfläche ist eine eigenständige Anwendung und spricht ausschließlich über die versionierte
HTTP-Schnittstelle. Sie enthält **keine** Geschäftsregeln, keine Rechtelogik und keine Statusmaschine.
Erlaubte Aktionen liefert der Server je Vorgang mit. Damit ist die Oberfläche austauschbar und jährlich
überarbeitbar, ohne die Anwendung anzufassen — und genau das ist hier der Nutzen.

**Grenze 2 — Fachlichkeit gegen Technik: Ports und Adapter.**
Der fachliche Kern (Vorgang, Status, Freigabe, Fristen, Rechte) kennt weder Datenbank noch HTTP noch
Dateisystem. Alles Technische hängt an Schnittstellen, die der Kern definiert.

**Grenze 3 — Eigenes gegen Fremdes: ein Adapter je Nachbarsystem.**
Transkription, KI-Wissensbasis und Aktienregister sprechen jeweils über einen eigenen Adapter, der auf
das interne Kanonikalmodell übersetzt. Kein Fremdformat erreicht den Kern.

**Bewusst nicht gezogen:** eine klassische n-Schichten-Aufteilung mit Service-, Manager- und
Repository-Ebene über jeder Entität. Bei einem Team dieser Größe kostet sie pro Feature vier bis fünf
Dateien und liefert keine Austauschbarkeit, die jemals genutzt wird.

## Konsequenzen

**Positiv.** Die Oberfläche kann komplett neu gebaut werden, ohne die Anwendung zu berühren — bei einer
jährlichen Optimierung der wahrscheinlichste Fall. Die Nachbarsysteme sind austauschbar. Der fachliche
Kern ist ohne Datenbank und ohne HTTP testbar, was schnelle Tests der Rechts- und Statusregeln erlaubt.
Die Rechtelogik existiert genau einmal.

**Negativ.** Der Vertrag muss gepflegt werden: Spezifikation, Versionierung, Vertragstests. Das ist
laufender Aufwand, und er ist nicht verhandelbar — ohne ihn ist die Trennung nur behauptet. Zwei
Deployment-Artefakte statt einem.

**Risiko.** Wenn die Oberfläche anfängt, Regeln „zur Sicherheit" nachzubauen, ist der Vorteil weg. Das
muss im Review konsequent zurückgewiesen werden.

## Verworfene Alternativen

**Serverseitig gerenderter Monolith.** Für ein System dieser Größe grundsätzlich attraktiv und deutlich
billiger im Betrieb. Verworfen, weil die Bühnenansicht ein eigenständiger, netzunabhängig gepufferter
Client sein muss — sie muss weiterlaufen, wenn die Verbindung 20 Sekunden weg ist — und weil die
Oberfläche der Teil ist, der jährlich überarbeitet wird. Beides spricht für einen echten Client.

**Strikte n-Schichten-Architektur.** Verworfen wie oben: Kosten pro Feature ohne realisierten Nutzen.

**Vollständige Entkopplung über einen Message-Broker zwischen allen Teilen.** Verworfen: das Volumen
trägt es nicht, und die zusätzliche Betriebsfläche wäre am HV-Tag ein Risiko statt einer Absicherung.

## Offen

Konkrete Technologiewahl innerhalb dieses Rahmens — abhängig von Konzernvorgaben und davon, womit die
Umsetzung dauerhaft arbeiten kann. Siehe Fragenliste in
[`../erste-version-und-offene-fragen.md`](../erste-version-und-offene-fragen.md).
