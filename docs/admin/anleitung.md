# Übungs-HV einrichten (Stand 041) — Admin-Anleitung v1

Diese Anleitung beschreibt, was die Verwaltung (Ansicht `/admin`, Scheibe 041) heute kann. Sie richtet eine
Übungs-Hauptversammlung mit dem ein, was es gibt: Rollen zuordnen, Fachbereiche, Tagesordnung und Bühnenplätze pflegen,
Rollenkarten lesen. Alle Daten sind synthetisch; diese Anleitung nennt keine Zugangsdaten und keine echten Namen.

> **Was mit 041b folgt:** Hauptversammlung anlegen oder klonen, Konfigurationsfreeze mit Hash, Override mit Grund,
> Start, Vertretungen, Nummernkreise. Erst damit gibt es den Ablauf „Übungs-HV in unter zwei Stunden anlegen“. Bis
> dahin verwaltet die Ansicht die **aktuelle** Hauptversammlung; die übrigen stehen nur lesend in der Liste.

## 1. Wo

- **Demo** (Betriebsart im Browser): oben rechts die Rolle auf „Administration“ wechseln, links in der Navigation
  „Verwaltung“ wählen.
- **Projekt `http`** (echter Dienst mit Anmeldung): mit einer Kennung anmelden, der die Rolle Administration zugeordnet
  ist. Im CI-Job `e2e-http` ist das die synthetische Testperson `admin`.
- **Lokales Paket** (`scripts/stack.mjs`): hat noch keine Person mit Verwaltungsrolle (Folgeliste, Eigentümerfrage 5).

Wer die Seite ohne das Recht „Rollen zuordnen“ öffnet, sieht nur den gesperrten Zustand
(`docs/evidence/041-gesperrt-de.png`). Ob eine Person das Recht hat, entscheidet der Dienst, nicht die Oberfläche.

## 2. Hauptversammlung prüfen

Unter der Überschrift steht in einer Zeile die verwaltete Hauptversammlung: Titel, Datum, Zustand (in Vorbereitung,
läuft, geschlossen), Gesellschaft und **Version**. Jede Änderung an Fachbereichen, Tagesordnung oder Bühnenplätzen hebt
die Version um eins. Der Tab „Hauptversammlungen“ listet alle Hauptversammlungen mit Datum und Zustand; die verwaltete
trägt das Zeichen „verwaltet“.

## 3. Fachbereiche anlegen und benennen

Tab „Fachbereiche“ → „Fachbereich anlegen“: Name (Pflicht) und Kurzname (optional). „Ändern“ benennt einen
Fachbereich um; seine ID bleibt, damit Zuordnungen und Einzelfragen an ihm hängen bleiben. Die Spalte „Offen“ zeigt die
offenen Einzelfragen je Fachbereich.

Ein Fachbereich mit offenen Fragen oder mit einer aktiven Rollenzuordnung **bleibt**: Der Dienst lehnt das Entfernen mit
`R-ADM-02` ab (`docs/evidence/041-abgelehnt-de.png`). Erst Fragen weiterleiten oder abschließen und Zuordnungen
entziehen, dann entfernen. Bild: `docs/evidence/041-fachbereiche-de.png`.

## 4. Tagesordnung anlegen

Tab „Tagesordnung“ → „TOP anlegen“: Nummer (vorbelegt mit der nächsten freien) und Titel. Die Spalte „Stand“ zeigt, ob
ein TOP aufgerufen ist und wie die Abstimmung steht; die Ablaufsteuerung selbst liegt nicht hier. Ein aufgerufener TOP
oder einer, zu dem es Einzelfragen gibt, bleibt (`R-ADM-02`).

## 5. Bühnenplätze

Tab „Bühnenplätze“ → „Bühnenplatz anlegen“: Bezeichnung (Pflicht), Position (vorbelegt), Person und Gerät (optional).
Person und Gerät sind **pseudonyme Kennungen** — keine E-Mail-Adresse, kein Klarname, kein Leerzeichen; der Dienst lehnt
anderes mit 422 ab. Zwei Plätze dürfen weder dieselbe Position noch dasselbe Gerät haben. Ein Platz, dem Einzelfragen
zugeordnet sind, bleibt (`R-ADM-02`). Die Spalte „Auf der Bühne“ zählt die gestellten, noch nicht vorgelesenen Fragen.

## 6. Rollen zuordnen und entziehen

Tab „Rollenzuordnungen“ → „Rolle zuordnen“ (`docs/evidence/041-rollen-de.png`):

1. **Kennung**: die pseudonyme Kennung der Person im Anmeldedienst. Die Kennungen, die schon in der Tabelle stehen,
   werden vorgeschlagen.
2. **Rolle**: aus der Rechtetabelle. Bei einer einheitsgebundenen Rolle (heute „Fachbereich“) erscheint der Hinweis,
   dass sie nur Fragen ihres Fachbereichs liest — ohne Fachbereich liest sie keine.
3. **Fachbereich** (optional).
4. **Gültig bis** (optional): Ortszeit Berlin. Leer heißt „Ende der Hauptversammlung“. Eine Ortszeit, die es wegen der
   Umstellung auf Sommerzeit nicht gibt, nimmt das Feld nicht an.

**Entziehen** je aktiver Zeile, auf Wunsch mit Grund (höchstens 500 Zeichen, steht in der Historie). Entzogene und
abgelaufene Zuordnungen blendet der Schalter „Entzogene und abgelaufene zeigen“ ein.

Zwei Grenzen setzt der Dienst: Niemand ordnet sich selbst eine Rolle zu (`R-ADM-07`), und die letzte gültige Zuordnung
mit Rechteverwaltung bleibt (`R-ADM-08`) — vorher eine zweite Person mit Verwaltungsrolle zuordnen.

## 7. Rollenkarten lesen

Tab „Rollenkarten“ (`docs/evidence/041-rollenkarten-de.png`): links die Rollen (Pfeiltasten wechseln), rechts, was die
gewählte Rolle **liest** und was sie **darf**, aus der Rechtetabelle dieses Programmstands. Was eine Person tatsächlich
darf, entscheidet der Dienst.

## 8. Wenn etwas abgelehnt wird

Die Meldung steht im offenen Dialog, mit Regel-id; die Eingaben bleiben.

| Meldung | Regel / Status | Was tun |
|---|---|---|
| Die Konfiguration einer geschlossenen Hauptversammlung ist unveränderlich. | `R-ADM-01` | Nichts; eine geschlossene Hauptversammlung bleibt, wie sie ist. |
| Der Eintrag wird noch verwendet … und bleibt. | `R-ADM-02` | Bezüge lösen (Fragen weiterleiten oder abschließen, Zuordnung entziehen), dann erneut. |
| Niemand ordnet sich selbst eine Rolle zu. | `R-ADM-07` | Eine zweite Person mit Verwaltungsrolle ordnet zu. |
| Die letzte gültige Zuordnung mit Rechteverwaltung bleibt. | `R-ADM-08` | Erst eine weitere Verwaltungszuordnung anlegen, dann entziehen. |
| Für diese Änderung fehlt das Recht. | 403 | Die Rolle hält das Recht nicht; Rollenkarte prüfen. |
| Inzwischen geändert; die Liste ist neu geladen. | 412 | Jemand hat gleichzeitig geändert; die Änderung auf der neuen Liste wiederholen. |
| Eingabe abgelehnt. | 422 | Felder prüfen: pseudonyme Kennung ohne `@` und Leerzeichen, Zeit in der Zukunft, Längen, doppelte Nummern, Positionen oder Geräte. |

## 9. Was noch fehlt (041b)

Hauptversammlung anlegen oder klonen, Konfigurationsfreeze mit Hash im Kopf, Override mit Pflichtgrund, Start der
Hauptversammlung, Vertretungen je Rolle (`R-ADM-06`), Nummernkreise je Erfassungsplatz. Danach folgt der Ablauf
„Übungs-HV in unter zwei Stunden anlegen“, einmal mit Zeitprotokoll durchgespielt.
