# Reviewer-Checkliste Sicherheit

**Status:** Prüfhilfe für Reviews mit Perspektive Security · **Stand:** 23.09.2026 (Scheibe 039) ·
**Herkunft:** Leitplanken 6.5 (fünf Punkte) und die sieben Sicherheitspunkte aus Plan 5.2, Scheibe 016
(Demo-Seed, Limits, Sitzung, CSP, Secrets, Bedrohungsmodell, Kill-Switch) · **Verlinkt aus:**
`.claude/agents/reviewer.md` durch Scheibe 016 · **Bezug:** [`bedrohungsmodell.md`](bedrohungsmodell.md)

> **Rang.** Die Checkliste führt keine Regel und kein Tor ein (Leitplanken 1). Ein Punkt wird für eine
> Scheibe verbindlich, wenn ihre Spec ihn oder die genannte Bedrohungs-ID als Akzeptanzkriterium übernimmt.
> Blocker im Sinne dieser Liste sind Verstöße gegen AGENTS.md, gegen Leitplanken 1.3 oder gegen ein
> übernommenes Kriterium.

## Gebrauch

Der Reviewer sieht Spec und Diff (AGENTS.md Regel 3). Für jeden Punkt, den die Scheibe berührt, antwortet er
mit `ja` (erfüllt, Beleg genannt), `nein` (relevant, nicht erfüllt), `nicht anwendbar` (kurzer Grund) oder
`blockiert` (Voraussetzung fehlt ohne Standardannahme; Leitplanken 2). Jeder Befund nennt Punkt,
Bedrohungs-ID und Datei:Zeile im Diff, zum Beispiel:

```
SC-03 nein — T-G1-I-01: listQuestions liest ohne can() (packages/domain/src/api.ts:383-388) → Blocker
```

Eine Scheibe mit Sicherheitsauslöser (Leitplanken 4, Klasse hoch) nennt in ihrer Spec die IDs aus
`bedrohungsmodell.md` Abschnitt 6, die sie schließt; fehlt die Liste, ist das ein Hauptbefund (SP-6).

---

## A. Leitplanken 6.5

| Punkt | Prüffrage | Wie prüfen | Blocker, wenn | sichert ab |
|---|---|---|---|---|
| SC-01 | Werden Authentifizierung und Autorisierung im Dienst erzwungen, und kommt der Kontext (Einheit, Bühnenplatz, Vertraulichkeit) nie vom Client? | Jede neue oder geänderte Route läuft über den Actor-Port und `can()`; im Diff nach Kontextfeldern in Body, Query oder Header suchen; kein Rollenname im Code: `grep -rnE "role\s*[!=]==?\s*['\"]" apps/api/src packages/domain/src` | eine Route ohne `can()`; Kontext aus einer Client-Angabe; Rollenname außerhalb `ROLE_PERMISSIONS` und Rollenumschalter | T-G1-S-01, T-G1-E-01, T-G1-E-05, T-G1-I-01 |
| SC-02 | Ist jede neue Aktion für niemanden erlaubt, bis sie in `ROLE_PERMISSIONS` vergeben und getestet ist? | Diff von `packages/domain/src/permissions.ts` und `packages/domain/policy-truth-table.md` lesen; je neuem Recht ein Negativtest; bei Klasse hoch steht der Wahrheitstabellen-Diff vor dem Bau in der Spec | neues Recht ohne Negativtest; Tabellen-Diff ohne Freigabe in der Spec; Recht an `admin` „der Einfachheit halber" | T-G1-E-01, T-G1-E-02, T-G1-E-04, T-G3-E-01 |
| SC-03 | Erkennen Nichtberechtigte weder Inhalt noch ableitbare IDs geschützter Vorgänge? Bleiben Zähler lückenlos, ohne Inhalt preiszugeben? | Lesewege, Suche, Sortierung, Zähler und Fehlermeldungen des Diffs mit einer Rolle ohne Leserecht durchdenken; gibt es einen Negativtest „Rolle X liest Y → 403"? | eine Lesemethode ohne Leserecht; Suche oder Zähler über nicht lesbare Fragen; Fehlermeldung mit fremdem Inhalt | T-G1-I-01, T-G1-I-03, T-G1-I-04, T-G1-I-05, T-G3-I-01 |
| SC-04 | Sind Massenlesen, Export und Rechteerhöhung begrenzt und als Ereignis nachvollziehbar? | Obergrenzen im Vertrag (`maximum`), Rate-Limit, Ereignis je Export (`ExportCreated`), Rollenzuordnung als Ereignis mit Grund und Ablauf | Export oder Zuordnung ohne Ereignis; Seitengröße ohne Obergrenze | T-G1-I-02, T-G1-E-04, T-G3-E-03 |
| SC-05 | Stehen keine Secrets in Repositorium, Artefakt, Log, Screenshot oder Agentenkontext, und funktionieren Sitzungsentzug, Sperrliste und Notfallkonten unabhängig vom Happy Path? | siehe SP-5 und SP-7; Negativtests für Entzug und Notfallkonto vorhanden? | siehe SP-5, SP-7 | T-Q-I-01, T-G3-S-03 |
| SC-06 | Ist für jede Hochrisikoänderung ein Missbrauchsfall mit Erkennung beschrieben, und haben Ausnahmen Eigentümer und Ablauf? | Spec nennt einen Missbrauchsfall aus `bedrohungsmodell.md` Abschnitt 7 (MF-01 bis MF-08) oder beschreibt einen neuen mit Signal und Empfänger; Erkennung ohne Kennzahl je Person (ADR 0013) | Hochrisikoscheibe ohne Missbrauchsfall; Erkennung über eine Kennzahl je Person | je nach Fall, z. B. T-G2-T-01 (MF-04), T-G1-E-05 (MF-06) |

## B. Die sieben Sicherheitspunkte

| Punkt | Prüffrage | Wie prüfen | Blocker, wenn | sichert ab |
|---|---|---|---|---|
| SP-1 Demo-Seed | Ist Seeden nur im Demo- oder Übungsbetrieb und nur in ein leeres Log möglich? | Diff nach `seedDemo`, `HV_DEMO`, `HV_MODE` durchsuchen; Tests „Seed im Modus live → 403" (042) und „seeding twice is refused" bleiben grün | Seed-Weg ohne Schalter; Seed über bestehendes Log; Demo-Endpunkt ohne Kennzeichen im Vertrag | T-G2-T-04, T-Q-T-04 |
| SP-2 Limits | Hat jeder neue Endpunkt Obergrenzen für Seite, Body, Textlänge und Rate, und liefert er 413, 429, 408 statt zu wachsen? | Vertrag: `maximum`, `maxLength`, `additionalProperties: false` auf Anfrageschemas; Dienst: Limits greifen auch für die neue Route; Speicher, der je Anfrage wächst (Maps, Caches), hat Ablauf und Obergrenze | ungebremster Speicher je Anfrage; Textfeld ohne Längengrenze, das ins Log geht | T-G1-D-01, T-G1-D-02, T-G1-D-03, T-G1-T-02, T-G3-D-02 |
| SP-3 Sitzung | Bleiben Cookie-Attribute, CSRF-Schutz für Schreibvorgänge, Leerlauf-Timeout, Abmelden und 401-Behandlung intakt? Hält das Web nie ein Token? | `grep -rn -e localStorage -e sessionStorage apps/web/src` zeigt keine Sitzung und kein Token; neue Schreibroute prüft CSRF; Negativtests aus 029 bleiben grün | Token im Browserspeicher; Schreibroute ohne CSRF-Prüfung; Header-Identität außerhalb `HV_DEMO=1` | T-G1-S-01, T-G1-S-02, T-G1-T-05, T-G3-S-02 |
| SP-4 CSP | Kommt die Änderung ohne Inline-Skript, `eval` und neue fremde Herkunft aus, und bleibt Text Text? | `grep -rni innerhtml apps/web/src` ohne neuen Treffer; neue Herkunft nur mit CSP-Änderung im Dienst (034) und in der Demo-Konfiguration (037); CSP-Report in e2e ohne Verstoß | HTML aus Nutzereingaben ohne Whitelist-Renderer; CSP gelockert ohne Begründung in der Spec | T-G1-T-06, T-G1-I-06 |
| SP-5 Secrets | Enthält der Diff kein Geheimnis, und kommt jede neue Konfiguration aus der Plattform? | gitleaks-Ergebnis (ab 012) im Bericht; `.env.example` nur mit Platzhaltern; keine Zugangsdaten in Logs, Fehlermeldungen, Screenshots unter `docs/evidence/`; Fehlerlog ohne Nutzdaten | ein Geheimnis im Diff (auch in Tests oder Beispielen); Zugangsdaten im Log | T-Q-I-01, T-G2-S-01, T-G2-I-02, T-Q-I-03 |
| SP-6 Bedrohungsmodell | Nennt die Spec die Bedrohungs-IDs, die die Scheibe schließt oder berührt, und nennt der Bericht je ID den Test? Entsteht eine neue Angriffsfläche ohne ID? | Spec gegen `bedrohungsmodell.md` Abschnitt 6 abgleichen; neue Endpunkte, Nachbarsysteme, Rechte oder Speicherorte ohne ID als Befund an 074 melden | Hochrisikoscheibe ohne ID-Liste (Hauptbefund); geschlossene ID ohne Test im Bericht | alle; Einstieg über Abschnitt 6 |
| SP-7 Kill-Switch | Wirkt die Sperrliste von Subject-IDs ohne Neustart auf neue Anfragen, offene Sitzungen und offene SSE-Ströme? | Test „gesperrtes Subject → 401" (029) bleibt grün; neue Ströme oder Hintergrundjobs prüfen die Sperrliste | ein Weg (Strom, Webhook, Job), der die Sperrliste nicht kennt | T-G1-S-02, T-G1-I-08 |

## C. Ergänzende Prüfpunkte aus dem Bedrohungsmodell

| Punkt | Prüffrage | Wie prüfen | sichert ab |
|---|---|---|---|
| SC-07 Log-Integrität | Werden Ereignisse nur angehängt, aus benannten Feldern gebaut und mit der Zeit des Dienstes versehen? | kein `{ ...input }` oder `{ ...body }` als Payload: `grep -rn -e '\.\.\.input' -e '\.\.\.body' packages/domain/src apps/api/src`; keine Uhr außerhalb des Clock-Ports: `grep -rn -e 'Date.now()' -e 'new Date()' packages/domain/src apps/api/src`; ab 024 Umschlagfelder gefüllt | T-G1-T-02, T-G1-T-07, T-G2-T-01, T-G2-S-02 |
| SC-08 Persistenz | Bestätigt ein Schreibvorgang erst nach dem dauerhaften Speichern, und hat die Dienstrolle nur INSERT und SELECT? | Reihenfolge Speichern → Projektion → Antwort im Adapter; Grants in Migrationen; Lesewege nutzen Index statt Vollscan | T-G2-T-02, T-G2-E-01, T-G2-D-03 |
| SC-09 Nachbarsysteme | Hat jeder Nachbar einen eigenen Systemakteur mit kleinstem Recht, signierte oder authentifizierte Aufrufe und einen Filter nach Leserecht? | Rechtebündel des Systemakteurs im Tabellen-Diff; HMAC oder Client-Credentials; Ziel-URLs aus Konfiguration mit Allowlist | T-G3-S-01, T-G3-T-03, T-G3-E-01, T-G3-E-02, T-G3-I-01 |
| SC-10 Lieferkette | Hat eine neue Abhängigkeit Nutzen, Pflege und passende Lizenz (Leitplanken 6.12), steht sie im Lockfile, und sind Workflow-Änderungen minimal berechtigt und auf Commit-Hash gepinnt? | Diff von `package.json`, `pnpm-lock.yaml`, `.github/**`; `pnpm audit` (ab 012) | T-Q-T-01, T-Q-T-02, T-Q-E-02 |
| SC-11 Datensparsamkeit | Enthalten Logs, Alarme und Kennzahlen keinen Fragetext und keine Kennzahl je Person? | Log-Aufrufe im Diff; Kennzahlen-Allowlist (033) | T-G2-I-02, T-G3-I-03, T-G3-I-04 |
| SC-12 Agenten und Tore | Ändert der Diff Hooks, Agentenrollen, Tore oder Snapshots, und ist das von der Spec gedeckt? | `git diff --stat` über `.claude/**`, `.github/**`, `scripts/**`, `packages/domain/policy-*.md`; Änderung nur mit Nennung in „Files allowed" | T-Q-T-03, T-Q-E-01, T-Q-S-01 |

## D. Befundklassen

- **Blocker:** Verstoß gegen AGENTS.md (Regeln 4, 7, 8, 11), gegen Leitplanken 1.3 oder gegen ein
  übernommenes Kriterium; jede Antwort `nein` auf SC-01, SC-02 oder SP-5.
- **Hauptbefund:** eine Bedrohung aus „muss schließen" der Scheibe ohne Test; fehlende ID-Liste bei
  Hochrisikoscheiben; Missbrauchsfall ohne Erkennung.
- **Nebenbefund:** neue Angriffsfläche ohne ID (Meldung an 074), Zielvorschlag des Modells nicht übernommen
  ohne Begründung.
