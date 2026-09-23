# ADR 0015 — Vertragsversionierung

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Umsetzer (Plan 4 nennt für 0015 keine weitere Person) · **Annahme:** Prüfpunkt 1 (Plan 4)

## Kontext

`packages/contract/openapi.yaml` ist die einzige Wahrheit; Oberfläche und Dienst leiten sich daraus
ab (Regel 6). ADR 0001 nennt die Vertragspflege — Spezifikation, Versionierung, Vertragstests — als
laufenden, nicht verhandelbaren Aufwand. Ein Tor prüft heute, dass jede `operationId` in den
Vertragstests ausgeübt wird. Der Plan ändert den Vertrag in seriellen Zyklen durch den Architekten
(019, 043, …); Partner (ADR 0008) brauchen Kompatibilität über zwei Zyklen (Ist-Analyse
Abschnitt 6.1, zitiert in Plan 3). Vor der Generalprobe darf sich der Vertrag nicht mehr bewegen.

## Entscheidung

Standardannahme aus Plan 4 (Zeile 0015) und Plan 3 („Exportpfad des Transkriptionstools", „Jahrgang
und Tagesordnung"):

- **Semver** für den Vertrag; jede Änderung steht im `CHANGELOG.md` des Vertrags, geprüft durch ein
  Versions- und Changelog-Tor.
- **Brechende Änderungen nur mit ADR-Verweis.**
- **Neue Pflichtfelder werden erst optional** eingeführt, mit Ablaufdatum, und in einem Folgezyklus
  Pflicht (Plan 4). Das Veralten von Feldern folgt dem Beispiel aus 019 (`kind` und
  `requestedMinutes` auf `Speaker`, veraltet in 0.2.0, gelöscht in 080); eine allgemeine
  Veraltungsregel steht nicht im Plan (Vorschlag, nicht im Plan).
- **Vorab deklarierte Operationen** stehen in einer Allowlist mit Ablaufdatum, damit das Tor „jede
  `operationId` wird ausgeübt" bestehen bleibt und keine tote Operation im Vertrag überdauert.
- **Vertragsfreeze vor der Generalprobe.**
- **/v1-Kompatibilität für Partner über zwei Vertragszyklen** (ADR 0008).
- Kanonisch ist `/v1/meetings/{id}/…`; `/v1/meeting` bleibt Alias für „aktuelle HV" bis Vertrag 0.5
  (Plan 3).

## Konsequenzen

**Positiv.** Kern, Web und e2e können einem Vertragszyklus nachfolgen, ohne dass Tests brechen:
was hinzukommt, ist optional, was geht, ist vorher veraltet. Das Tor „jede `operationId` wird
ausgeübt" bleibt scharf; die Allowlist macht jede Ausnahme sichtbar und endlich. Partner planen
gegen ein Datum.

**Negativ.** Ein Pflichtfeld braucht zwei Zyklen. Allowlist-Einträge und Ablaufdaten sind zu
pflegen; ein abgelaufener Eintrag macht das Tor rot. Der Freeze bindet den Vertrag an den Kalender
der Generalprobe (E20, E45).

**Risiko.** Eine „kleine" Vertragsänderung ohne Changelog oder ADR ist der Weg zurück in die
Kopplung an volatile Logik (ADR 0001); das Versions- und Changelog-Tor aus 019 fängt das ab.

## Kosten bei Änderung

- Der Plan beziffert die Versionierungsregel selbst nicht in AStd. Er beziffert einen Vertragszyklus
  für eine Formänderung: 1 AStd plus Allowlist-Eintrag (Plan 3, E3a).
- Die Vertragspflege ist laufender Aufwand und nicht verhandelbar (ADR 0001).

## Verworfene Alternativen

- **Brechende Änderung ohne ADR.** Verworfen: Plan 4; eine Grenze verschiebt nur ein ADR.
- **Pflichtfeld sofort.** Verworfen: bricht Partner, Demo-Protokolle und die Kompatibilität über
  zwei Zyklen.
- **Allowlist ohne Ablaufdatum** oder Tor für deklarierte Operationen abschalten. Verworfen: das Tor
  würde ausgehöhlt; deshalb Ablaufdatum je Operation (Plan 4).
- **Kein Vertragsfreeze.** Verworfen: die Recherche verlangt einen Change-Freeze in Stufen (Z.314);
  der Vertrag ist Teil davon.
- **Kompatibilität nur einen Zyklus.** Verworfen: zwei Zyklen für Partner (Ist-Analyse 6.1, Plan 3).

## Nachweis

Scheibe **019** (Plan 4): `pnpm contract:types`-Diff; `contract:lint`; CHANGELOG-Eintrag 0.2.0;
Allowlist mit Ablauf je Operation; `pnpm gates`. Folgezyklen: 043 (0.4.0); Freeze-Tor aktiv zum
Feature-Stopp (077, Plan 7).

## Offene Registerzeilen

- Keine eigene Registerzeile im Plan. Abhängig: **E3a** (Vertragsform der Segmente wird in 043
  eingefroren) und **E20** (HV-Datum bestimmt den Freeze-Termin).
