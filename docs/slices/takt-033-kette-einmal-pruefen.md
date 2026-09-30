# takt-033 — Ereigniskette je Anfrage nur einmal und inkrementell prüfen

**Status:** spec · **Risikoklasse:** hoch (Integrität der Ereigniskette, Produktivpersistenz, Auflösung des Akteurs; Leitplanken §4) · **Lanes:** service, domain · **Perspektive:** Security (Integrität), Betrieb
**Rolle:** service-implementer; Review in frischem Kontext mit Perspektive Security, Lesebefund der Spec vor dem Bau (Leitplanken §4, hoch; nie gebündelt), Modell nur in `.claude/agents/`
**Regeln:** AGENTS.md R2, R3, R7 (append-only), R8, R11, R12; ADR 0011 (Umschlag v2, Hash-Kette); Scheibe 024 (Kettenprüfung beim Laden), 027 (Postgres, Dienstrolle nur INSERT/SELECT, Prüfung nach Neustart), 034a (Zeitbudgets); Bedrohungsmodell T-G2-T-01, T-G2-R-01, SG4
**Depends on:** takt-030 ist keine Code-Abhängigkeit: diese Dienst-Scheibe wurde auf der aktuellen Basis ohne takt-030 gebaut; takt-030 betrifft nur die Reihenfolge und den späteren Nachweis aus Abnahmekriterium 6.
**Aufgeteilt:** Der Web-Teil (kein Doppelabruf beim Einhängen, `useApiVersion`) steht in `docs/slices/takt-033b-einhaengen-ohne-doppelabruf.md` (mittel). Beide Teile haben verschiedene Lanes, Risikoklassen und Reviewperspektiven und sind im Code unabhängig.
**Quellen-IDs:** Diagnoselauf für Scheibe 031b, gemessen gegen Postgres am 30.09.2026 (2069 Ereignisse, lokal); E41 (Performance-Ziel D9, offen); `apps/web/e2e/abnahme.spec.ts:257` (bestehende Grenze 1500 ms)

## Befund (Ist-Stand, gelesen auf `5a013f9`, Messwerte aus dem Diagnoselauf)

- Jede Anfrage durch `postgresBoundary` (`apps/api/src/app.ts:506-596`) lädt den ganzen Snapshot, auch Lesezugriffe
  und Anfragen, die mit 403 enden. `loadPostgresSnapshot` (`app.ts:534`, `apps/api/src/persistence/postgres.ts:303-363`)
  liest alle Ereignisse (12–17 ms) und prüft die Kette mit `verifyEventChain` (`postgres.ts:338`, 45–49 ms). Danach
  prüft `createInMemoryEventStore({ load })` (`app.ts:537`, `packages/domain/src/store.ts:27`) dieselbe, gerade
  geprüfte Kette ein zweites Mal (ca. 44 ms). Die Projektion für `getStage` braucht unter 1 ms.
- `GET /v1/stage` dauert 140–300 ms je Anfrage. Das ist synchrone CPU-Arbeit; die Anfragen reihen sich deshalb auf der
  Event-Loop hintereinander.
- Im OIDC-Sitzungsmodus lädt und prüft der Auth-Adapter den ganzen Snapshot ein **drittes** Mal je Anfrage, auf eigener
  Verbindung und in eigener Transaktion (`app.ts:274-280`; `authEvents` ist `readSnapshotEvents`, `app.ts:250-267, 269`).
  Dasselbe gilt für `/auth/me` (`app.ts:790`), den Callback (`app.ts:760`) und `/metrics` (`app.ts:692`, dort mit
  10-s-Cache).
- Folge im Web: `/stage` braucht nach der Navigation im CI-Projekt `http` 2374 ms. Die Grenze liegt bei 1500 ms
  (`abnahme.spec.ts:257`); im Projekt `in-process` sind es ca. 150 ms. Der zweite Beitrag, der doppelte Abruf beim
  Einhängen, ist Gegenstand von takt-033b.
- Die bestehenden Manipulationstests (`apps/api/src/__tests__/postgres027.test.ts`, „refuses a fresh business read when
  the stored %s is corrupt“ und „blocks business reads on a %s person row“) bauen für jeden Fall eine **frische** App.
  Einen Cache, der vor der Manipulation gefüllt wurde, prüfen sie nicht.
- Eine reine Grenzprüfung (nur die Zeile am gecachten `seq` mit Hash und `prev_hash` vergleichen) erkennt **nicht**,
  wenn eine ältere Zeile unterhalb dieses `seq` geändert wird. Ziel 2 verlangt deshalb eine Prüfung des ganzen
  gespeicherten Präfixes auf Datenbankseite.

## Ziel

1. **Einmal prüfen je geladener Kette.** `createInMemoryEventStore` prüft die Kette weiterhin standardmäßig. Es
   überspringt die Prüfung nur für ein Log, das die Domäne selbst als geprüft markiert hat:
   - Neue Domänenfunktion in `packages/domain/src/envelope.ts`, Vorschlag
     `sealVerifiedLog(prefix: VerifiedEventLog | undefined, suffix): VerifiedEventLog`. Sie prüft `suffix` gegen das Ende
     von `prefix` (erster `seq` = `prefix.length + 1`, erster `prevHash` = letzter Hash von `prefix` bzw. `''`), friert
     das Ergebnis und jedes neue Ereignis tief ein und legt das Ergebnis in eine modulinterne `WeakSet`.
     `verifyEventChain` bekommt dafür einen optionalen Startpunkt `{ seq, prevHash }`; der Standard `{ 0, '' }` lässt
     das heutige Verhalten unverändert.
   - `createInMemoryEventStore` überspringt `verifyEventChain` genau dann, wenn `persistence.load()` ein Array
     zurückgibt, das in dieser `WeakSet` liegt. Jedes andere Array, auch eine Kopie eines versiegelten Logs, wird wie
     heute geprüft. Es gibt keinen booleschen Schalter, den ein Aufrufer setzen könnte.
2. **Inkrementell prüfen mit Cache je App-Instanz.** Neue Datei `apps/api/src/persistence/chainCache.ts`. Der Cache
   lebt in der Closure von `createApp` und damit je Prozess und je App; Tests bleiben so voneinander getrennt. Er hält:
   das versiegelte Log (`VerifiedEventLog`), die daraus abgeleiteten erwarteten Personenzeilen und eine kleine,
   begrenzte Liste von Prüfpunkten `{ seq, lastHash, prefixDigest }`, höchstens 16 Stück, alle Präfixe desselben Logs.
   Je Anfrage läuft in der Transaktion der Anfrage und damit auf **ihrem** Snapshot:
   - (a) Eine Abfrage liefert `count(*)`, `max(seq)` und einen Digest auf Datenbankseite (eingebautes `sha256`, ab
     Postgres 11; CI nutzt 16) über alle Zeilen mit `seq <= p.seq`. `p` ist der größte Prüfpunkt mit `p.seq <= max(seq)`.
     Der Digest umfasst jede Spalte, die `loadPostgresSnapshot` heute prüft (`seq`, `id`, `meeting_id`, `hash`,
     `prev_hash`, `envelope::text`), in injektiver Kodierung (Längenpräfix oder Digest je Zeile), geordnet nach `seq`.
   - (b) Stimmen der Digest und `count(*) = max(seq)`, werden nur die Zeilen mit `seq > p.seq` gelesen. Für sie gelten
     dieselben Zeilenprüfungen wie heute (Form, Index gegen Umschlag), dann folgt `sealVerifiedLog(prefix bis p.seq,
     suffix)`. Die Personenzeilen werden weiter **vollständig** gelesen und gegen die erwarteten Zeilen verglichen
     (Cache plus Suffix); diese Prüfung bleibt so streng wie heute.
   - (c) **Jede Abweichung führt zur vollständigen Prüfung** über den heutigen Pfad: Digest ungleich, `max(seq)` kleiner
     als jeder Prüfpunkt, Lücke (`count(*) ≠ max(seq)`), kein Cache, Suffix bricht die Kette. Scheitert sie, greift der
     bestehende Integritätspfad unverändert (`PostgresIntegrityError`, 500 mit `seq`, kein Inhalt), und der Cache wird
     geleert. Besteht sie, ersetzt ihr Ergebnis den Cache.
   - (d) **Rücksicherung, Rückrollen, gekürztes Log:** `max(seq)` liegt unter dem gecachten `seq` oder das Präfix hat sich
     geändert. Das heißt: vollständige Prüfung. Eine gültige ältere Kette wird wie heute angenommen und ersetzt den
     Cache (siehe offene Frage 1 zur Meldung). Ein Lesezugriff mit älterem REPEATABLE-READ-Snapshot, gestartet vor
     einem gleichzeitigen COMMIT, nutzt einen älteren Prüfpunkt, sofern einer passt. Sonst läuft die vollständige
     Prüfung; das ist korrekt, nur langsamer.
   - (e) **Aktualisieren nur aus geprüften Datenbankdaten** und nur per Vergleich-und-Tausch auf das Cache-Objekt, von
     dem die Anfrage ausging. Eigene `pendingEvents` fließen nach dem COMMIT nicht in den Cache; die nächste Anfrage
     liest sie als Suffix. Ein verlorener Tausch kostet nur Geschwindigkeit, nie Korrektheit.
   - (f) Die Schreibanfrage (READ COMMITTED unter der Advisory-Sperre) nutzt denselben Lader. Reihenfolge und
     Zeitbudgets aus 034a bleiben: die Prüfung auf Zeitüberschreitung nach dem Laden bleibt stehen.
3. **Auth auf demselben Cache.** `readSnapshotEvents` und damit Sitzungs-Adapter, `/auth/me`, Callback und `/metrics`
   laden über denselben inkrementellen Lader und denselben Cache, weiter in eigener schreibgeschützter Transaktion auf
   eigener Verbindung (Struktur und Verwerfen der Verbindung aus 034a bleiben). Das Suffix wird bei **jedem** Aufruf
   gelesen. Ein vor der Anfrage festgeschriebenes `RoleRevoked` wirkt also sofort (takt-023). Es gibt keinen zeitbasierten
   Cache für die Auflösung des Akteurs. Die Middleware-Reihenfolge bleibt; Auth und Fachanfrage in **eine** Transaktion
   zu legen ist ein Nicht-Ziel.
4. **Integrität nicht schwächer.** Alle bestehenden Integritäts- und Manipulationstests bleiben unverändert und grün:
   `postgres027.test.ts`, `eventLog024.test.ts`, `packages/domain/src/__tests__/envelope.test.ts`,
   `security028.test.ts`. Neue Tests unter Akzeptanzkriterium 2.
5. **Messbar schneller.** Ein warmer `GET /v1/stage` auf 2000 oder mehr Ereignissen hasht kein Ereignis erneut, wenn
   kein neues hinzugekommen ist. Bei k neuen Ereignissen sind es genau k. Die Zeit liegt deutlich unter der heutigen
   (Akzeptanzkriterium 3).

## Nicht-Ziele

- Keine Vertragsänderung, keine Migration, keine neue Spalte oder Tabelle (Digest je Zeile in der Datenbank wäre eine
  Migration, später denkbar), keine Änderung der Datenbankrechte.
- Kein Cache der **Projektion** (`createInProcessApi` projiziert je Anfrage neu). Bleibt nach Ziel 1 und 2 die
  Zeitgrenze wegen der Projektion verfehlt, ist das ein Befund mit Messaufteilung, keine Erweiterung dieser Scheibe.
- Kein Cache für den JSONL- oder In-Memory-Pfad; dort wird einmal beim Start geprüft wie heute.
- Keine Änderung an Web, e2e, Zeitgrenzen der e2e-Tests oder an E41 (Owner-Entscheidung, bleibt offen). Die Grenze
  von 1500 ms in `abnahme.spec.ts` bleibt, wie sie ist.
- Keine Hintergrund- oder Zeitplanprüfung. Die Erkennung erfolgt je Anfrage über den Digest aus Ziel 2 (a).
- Kein gemeinsamer Cache über Prozesse; mehrere Instanzen haben je ihren eigenen.

## Files allowed

- `docs/slices/takt-033-kette-einmal-pruefen.md`
- `packages/domain/src/envelope.ts` (Startpunkt für verifyEventChain, sealVerifiedLog, VerifiedEventLog)
- `packages/domain/src/store.ts` (Überspringen nur für versiegelte Logs)
- `packages/domain/src/__tests__/envelope.test.ts`, `packages/domain/src/__tests__/store033.test.ts` (neu)
- `apps/api/src/persistence/chainCache.ts` (neu)
- `apps/api/src/persistence/postgres.ts` (inkrementeller Lader, Digest-Abfrage; loadPostgresSnapshot bleibt als voller Pfad)
- `apps/api/src/app.ts` (nur postgresBoundary, readSnapshotEvents und Cache-Verdrahtung, ein optionaler Test-Haken für die Zahl geprüfter Ereignisse in testHooks)
- `apps/api/src/__tests__/chain-cache-takt033.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/postgres-takt033.test.ts` (neu, mit Postgres)
- `docs/sicherheit/bedrohungsmodell.md` (Zeilen T-G2-T-01, T-G2-R-01, SG4: Cache, Digest, Erkennungszeitpunkt)
- `docs/folgeliste.md` (nicht blockierende Reviewbefunde)

Weitere Dateien sind Scope-Befunde, besonders `postgres027.test.ts`, `eventLog024.test.ts` und
`security028.test.ts`: Sie bleiben unverändert.

## Akzeptanzkriterium

1. **Domäne, Tests zuerst rot, dann grün** (`envelope.test.ts`, `store033.test.ts`):
   (a) `verifyEventChain` ohne Startpunkt verhält sich wie heute (bestehende Tests grün);
   (b) mit Startpunkt: richtiges Suffix grün; falscher erster `seq` bzw. falscher `prevHash` → Fehler mit `seq`;
   (c) `createInMemoryEventStore` mit versiegeltem Log prüft nicht erneut. Der Nachweis ist beobachtbar: Ein versiegeltes
       Log, dessen Ereignisse eingefroren sind, lädt ohne Neuberechnung; ein Zähler oder Spy ist nur über den öffentlichen
       Weg der Domäne zulässig;
   (d) eine **Kopie** eines versiegelten Logs, ein normales Array und ein Array mit manipuliertem Ereignis werden geprüft,
       das manipulierte wirft wie heute;
   (e) ein Schreibversuch auf ein Ereignis des versiegelten Logs ändert nichts (im Strict Mode `TypeError`);
   (f) `sealVerifiedLog` mit einem Suffix, das die Kette bricht, wirft und registriert nichts.
2. **Dienst mit Postgres** (`postgres-takt033.test.ts`, DB je Lauf; jede Anfrage an **dieselbe**, vorher gewärmte App):
   (a) Manipulation nach dem Füllen des Caches, und zwar für jede der sechs Spaltenarten aus `postgres027.test.ts`
       (`envelope`, `seq`, `id`, `meeting_id`, `hash`, `prev_hash`), an einer **alten** Zeile (seq 2, weit unter dem
       gecachten `seq`) → die nächste Fachanfrage antwortet ≥ 500 mit `seq 2` und ohne Inhalt, wie heute bei frischer
       App;
   (b) dieselbe Manipulation an der Zeile am gecachten `seq` (Grenze) → ebenso;
   (c) gekürztes Log (die letzten Zeilen per Owner-Verbindung gelöscht) → vollständige Prüfung; eine gültige Kürzung wird
       wie heute angenommen (Meldung nach offener Frage 1), und der Cache sinkt auf den neuen `seq`; Lücke in der Mitte → ≥ 500 mit `seq`;
   (d) Rücksicherung einer älteren Datenbank mit anschließend **anderen** neuen Ereignissen über den alten gecachten
       `seq` hinaus → Präfix-Digest ungleich → vollständige Prüfung → Antwort aus der neuen Kette, nie aus dem Cache;
   (e) Personenzeile nach dem Füllen des Caches geändert, gelöscht oder hinzugefügt → ≥ 500 wie in `postgres027.test.ts`;
   (f) Suffix: ein neues Ereignis mit gebrochener Kette, eingefügt per Owner-Verbindung → ≥ 500 mit dessen `seq`;
   (g) Sitzungsmodus: nach `RoleRevoked`, festgeschrieben über eine zweite App-Instanz, verliert die nächste Anfrage der
       ersten Instanz sofort die Rolle (kein veralteter Akteur aus dem Cache);
   (h) Nebenläufigkeit: 20 parallele Lesezugriffe und 5 Schreibzugriffe auf einer gewärmten App → alle Antworten
       korrekt; danach stimmt `max(seq)` des Caches mit der Datenbank überein und keine Anfrage erhält 500.
3. **Messbares Budget** (`postgres-takt033.test.ts`, 2000 oder mehr Ereignisse, Masseneinfügen wie im 10.000er-Test von
   `postgres027.test.ts` außerhalb der Messung):
   (a) **deterministisch:** über den Test-Haken aus `app.ts` hasht ein warmer `GET /v1/stage` ohne neue Ereignisse 0
       Ereignisse, mit k = 3 neuen genau 3; der erste, kalte Aufruf hasht alle;
   (b) **Zeit:** der Median von 20 warmen `GET /v1/stage` liegt bei höchstens 50 % des Medians von 20 kalten
       (jeweils frische App) auf derselben Datenbank, und absolut unter 100 ms. Der Bericht nennt beide Mediane. Wird
       (b) auf dem CI-Runner verfehlt, ist das ein Befund mit Messaufteilung (SELECT, Digest, Suffix, Projektion); die
       Grenze wird nicht gelockert.
4. **Ohne Postgres** (`chain-cache-takt033.test.ts`): Vergleich-und-Tausch, begrenzte Zahl der Prüfpunkte, Wahl des
   größten passenden Prüfpunkts, Leeren bei Integritätsfehler. Die Logik liegt als reine Funktion in `chainCache.ts`.
5. `pnpm gates` **mit Postgres-Variablen** grün auf sauberem Commit (eigene DB, z. B. `hv_t033`). Abschnitt „Nachweis“
   mit Gates-Commit und wörtlichem Schluss sowie den gemessenen Medianen (eigener Doku-Commit, gezielt stagen, kein
   Amend). `slice-scope` akzeptiert nur die Dateien oben.
6. **Späterer Nachweis, nicht Teil dieser Abnahme:** Nach 033 und 033b hält `/stage` nach der Navigation im CI-Projekt
   `http` die bestehende Grenze von 1500 ms (`abnahme.spec.ts:257`, Lauf aus 031b).

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Invarianten.** Eine Antwort beruht nur auf einer Kette, die vollständig geprüft ist: als Ganzes oder als Präfix,
  dessen gespeicherte Bytes laut Datenbank-Digest unverändert sind, plus geprüftes Suffix. Ereignisse im Cache sind
  eingefroren und kommen nur aus der Datenbank. Personenzeilen werden je Anfrage vollständig verglichen.
- **Missbrauchsfall (6.5).** Jemand mit Owner- oder DBA-Rechten ändert eine alte Zeile, während der Dienst läuft (die
  Dienstrolle hat kein UPDATE, `assertRuntimePrivileges`). Erkennung: Der Digest-Vergleich der nächsten Anfrage
  schlägt fehl, die vollständige Prüfung scheitert, die Antwort ist 500 mit `seq`. Das ist derselbe Weg wie heute, und
  auch der Zeitpunkt der Erkennung ist gleich (nächste Anfrage). Ohne den Digest bliebe eine solche Änderung bis zum
  Neustart unerkannt; deshalb ist eine reine Grenzprüfung keine Option.
- **Restrisiko (unverändert gegenüber heute).** Wer die ganze Kette neu schreibt und alle Hashes neu berechnet, fällt
  auch heute nicht auf. Neu sichtbar wird: Das Präfix hat sich geändert, die Kette ist aber gültig. Das kann eine
  Rücksicherung sein oder eine Umschreibung. Wie das gemeldet wird, ist offene Frage 1.
- **Fehler- und Wiederherstellungsfall.** Integritätsfehler → Cache leer → die nächste Anfrage prüft vollständig. Es
  gibt kein „weiter mit dem Cache“ nach einem Fehler. Datenbank nicht erreichbar → wie heute 503 bzw. 500, der Cache
  bleibt unverändert und wird erst nach erfolgreicher Prüfung wieder genutzt.
- **Betrieb.** Speicher: ein Log im Prozess (2000 Ereignisse, Größenordnung wenige MB; bei 20.000 Ereignissen
  Größenordnung zehn MB). Die Digest-Abfrage liest je Anfrage alle Zeilen auf Datenbankseite, überträgt aber nur eine
  Zeile; ihre Dauer steht im Nachweis. Kennzahlen und Katalog (033b-Allowlist) bleiben unverändert.
- **Nebenläufigkeit.** Vergleich-und-Tausch, Prüfpunkte nur vorwärts innerhalb eines Logs, ein neues Log nur nach
  vollständiger Prüfung. Parallele Anfragen teilen das eingefrorene Log lesend. `createInMemoryEventStore` kopiert das
  Array wie heute (`[...load()]`), Anhängen verändert den Cache also nicht.
- **Wahrheitstabelle.** Keine Rechte und keine Übergänge berührt; ein Diff der Wahrheitstabelle entfällt.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] Persistenz, Migration, Nebenläufigkeit [x] Rolle, Recht, Identität (Auflösung des Akteurs aus dem Cache) [x] Betrieb, Wiederherstellung
Perspektive(n): Security (6.5, SG4), Betrieb (6.7), Daten und Konsistenz (6.3) · Nachweise: Tests aus Akzeptanzkriterium 1–4, Mediane, Bedrohungsmodell · Offene Entscheidung: E41 (unberührt), offene Frage 1

## Vor dem Bau prüfen

Nach dem Merge von takt-030: `app.ts` (`postgresBoundary`, `readSnapshotEvents`, `authEvents`, `/auth/me`, Callback,
`/metrics`, `testHooks`), `postgres.ts` (`loadPostgresSnapshot`, `expectedPersons`, `assertRuntimePrivileges`),
`store.ts`, `envelope.ts` (`verifyEventChain`, `upcastJsonlEvents` ruft sie ebenfalls). Außerdem prüfen, ob irgendein
Domänen- oder Dienstcode geladene Ereignisse verändert: Das würde mit eingefrorenen Ereignissen werfen. Findet sich eine
solche Stelle, melden und anhalten, nicht auftauen. Weichen die Zeilenangaben ab oder fehlt eine Datei, melden und
anhalten.

## Offene Fragen

1. **Owner/Security:** Präfix geändert oder Log am Ende gekürzt, Kette aber gültig (Rücksicherung oder Umschreibung) – wie reagiert der Dienst?
   (a) still annehmen wie heute, (b) annehmen und je Vorkommen eine feste stderr-Zeile ohne Inhalt schreiben, (c)
   Fachanfragen verweigern bis zum Neustart. Standard bis zur Entscheidung: (b). Eine Rücksicherung geht in der Regel
   mit einem Neustart einher, dann ist der Cache ohnehin leer.
   **Gebaut ist der Standard (b)**, die Entscheidung bleibt beim Owner offen: feste Zeile
   `HV-Tool API: stored event history changed or was shortened; the valid chain was accepted.` je Vorkommen, ohne
   `seq`, ID oder Wert; ausgelöst, wenn ein vorhandener Cache wegen geänderten Präfix-Digests oder wegen
   `max(seq)` unter dem gecachten Ende vollständig geprüft wurde und die Kette gültig ist.
2. Reicht der Anteil ohne Projektion für die Grenze aus 031b? Erst die Messung aus Akzeptanzkriterium 3 zeigt es. Falls
   nein, folgt ein eigener Takt für den Cache der Projektion.

## Umsetzungshinweise (Bau)

- **Digest-Bindung.** Das Log wird aus `envelope::text` geparst (wie der jsonb-Parser des Treibers: `JSON.parse`); der
  Zeilen-Digest entsteht in Node über genau diese Bytes und in Postgres über dieselbe Kodierung
  (`<UTF-8-Länge>:<Text>` bzw. `N` für NULL je Spalte, sha256 je Zeile, sha256 über die Folge). So bezieht sich ein
  Prüfpunkt immer auf die Bytes, aus denen das gecachte Log stammt, auch unter READ COMMITTED.
- **Ältere Prüfpunkte.** Der Lader liest den Cache, bevor die Transaktion ihre erste Anweisung sendet; der Snapshot
  der Anfrage ist deshalb nie älter als ihr Cache-Eintrag. `max(seq)` unter dem gecachten Ende heißt also: Zeilen
  sind verschwunden, und das wird nach (c)/(d) vollständig geprüft. Die Liste von höchstens 16 Prüfpunkten und die
  Wahl des größten passenden (`selectCheckpoint`) sind gebaut und getestet; in dieser Reihenfolge ist der gewählte
  Prüfpunkt stets das Ende.
- **Zähler.** `verifiedEventCount()` (Domäne, öffentlich, monoton) zählt die von `verifyEventChain` gehashten
  Ereignisse; der Test-Haken `testHooks.chain` meldet je Laden die Differenz um die synchronen Prüfaufrufe.
- **Typ.** `Persistence.load()` liefert jetzt `readonly DomainEvent[]`, damit ein versiegeltes Log ohne Kopie
  übergeben werden kann.

## Nachweis

_offen (Gates-Commit, wörtlicher Schluss von `pnpm gates` mit Postgres-Variablen, Mediane warm/kalt)_

## Review findings

_offen_
