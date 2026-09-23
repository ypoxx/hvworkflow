# ADR 0004 — Identität: OIDC über einen BFF im Dienst

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Konzern-IT (Identity Provider und Client-Typ, E11); Konzern-IT und Projektleitung (Rollenzuweisungspfad, E8); Eigentümer und Konzern-Security (MFA im Rückfall, E38) · **Annahme:** Prüfpunkt 3 (Plan 4)

## Kontext

Heute stellt der Dienst Identität aus dem `X-Actor`-Header her (`HV_DEMO=1`), die Demo aus dem
Rollenumschalter. `apps/api/src/actor.ts` ist der einzige Ort, der Identität herstellt. B1 verlangt
eine echte Anmeldung jeder Person über OIDC, Notfallkonten nur für den IdP-Ausfall und das Ende
des Header-Pfads außerhalb der Demo. Rechte bleiben Daten (Regel 4): `can()` ändert sich durch
diesen ADR nicht; er regelt nur, wie das Actor-Objekt entsteht.

## Entscheidung

Standardannahme aus Plan 3 („Identity Provider und Client-Typ", „Rollenzuweisungspfad") und
Plan 4 (Zeile 0004):

- **OIDC über einen BFF im Dienst.** Authorization Code läuft serverseitig, vertraulicher Client,
  HttpOnly-Sitzungscookie, JWKS-Prüfung; Issuer und Audience sind Konfiguration. Das Web hält nie ein
  Token.
- **`actor.ts` wird ein Port mit drei Adaptern:** `demoHeader` (nur bei `HV_DEMO=1` und ohne
  OIDC-Issuer; sind beide Schalter gesetzt, bricht der Start ab), `sessionCookie` (der OIDC-Pfad) und
  `localBreakGlass` (zwei versiegelte Notfallkonten mit langem Einmalgeheimnis, nur bei gemeldetem
  IdP-Ausfall aktivierbar, zeitlich befristet, jede Nutzung ein Alarmereignis).
- **Sitzungsrichtlinie:** 14 h mit stillem Refresh, Leerlauf-Timeout, Abmelden, Sperrliste von
  Subject-IDs ohne Neustart (Kill-Switch, Recherche SOLL).
- **Rollenzuordnung als Ereignisdaten:** eine administrierte Zuordnungstabelle im Tool (Subject →
  Rollen je Jahrgang, optional `unitId` je Zuordnung) als Ereignisse `RoleAssigned`/`RoleRevoked` mit
  Ablauf am Jahrgangsende. IdP-Gruppen werden als Vorschlag gelesen, nie automatisch zur Rolle.
  Beide Pfade münden im selben Actor-Objekt; die Tabelle ist die eine Wahrheit.
- **Umgebungen:** Staging gegen einen Keycloak-Container mit Testrealm, Produktion gegen den
  Konzern-IdP. Im Rückfall gepoolter Stationsidentitäten (E13, E10b) trägt ein Keycloak-Realm die
  Konten; dann gilt die Standardannahme TOTP-Pflicht für Freigabe-, Rechts- und Admin-Rechte (E38).

## Konsequenzen

**Positiv.** Ein BFF funktioniert mit öffentlichen und vertraulichen Clients; ein IdP-Wechsel ist
Konfiguration plus Claim-Mapping. Die Wahrheitstabelle bleibt unverändert, weil `can()` nicht
berührt wird. Personengenaues Vier-Augen (B6) wird mit Einzelidentitäten erst möglich.

**Negativ.** Ein Sitzungscookie verlangt CSRF-Schutz für Schreibvorgänge und eine Uhr mit
Clock-Skew aus dem injizierten Clock-Port (029). Die CI braucht einen Keycloak-Container. Die
Anmeldeseite trägt einen Transparenzhinweis (Art. 13 DSGVO — ungeprüft (E15)) als Vertragsfeld.
Im Rückfall gepoolter Stationsidentitäten gelten B1, B6, B9 und B15 nur mit Einschränkung (B18).

**Risiko.** Der Konzern-IdP und der Client sind Anfragen an die Konzern-IT (Client bis 27.11.2026,
Rückfall 15.01.2027, E11); bis dahin läuft alles gegen Keycloak.

## Kosten bei Änderung

- IdP-Wechsel: Konfiguration plus Claim-Mapping (Stunden) (Plan 3).
- SAML statt OIDC: zweiter Auth-Adapter, ca. 3 AStd, ohne Domänenberührung (Plan 3).
- Sync-Adapter „IdP führt" für die Rollenzuordnung: < 1,5 AStd, `can()` unverändert (Plan 3).
- Rückfall Keycloak-Realm und Konten: aus Scheibe 088 (E11, E38).

## Verworfene Alternativen

- **Token im Browser (öffentlicher Client, SPA hält Access-Token).** Verworfen: das Web hält nie ein
  Token; der BFF funktioniert mit beiden Client-Typen (Plan 3).
- **`X-Actor`-Header außerhalb der Demo.** Verworfen: B1 schaltet ihn außerhalb `HV_DEMO=1` ab und
  verweigert den Start bei gesetztem OIDC-Issuer.
- **IdP-Gruppen führen die Rolle automatisch.** Verworfen: die Zuordnungstabelle ist die eine
  Wahrheit; „IdP führt" bleibt als Sync-Adapter nachrüstbar (E8).
- **Dauerhaft aktive Notfall- oder Administrationskonten.** Verworfen: Notfallkonten nur bei
  gemeldetem IdP-Ausfall, befristet, jede Nutzung ein Alarmereignis (B1).
- **Gastkonten für Externe in der Beta.** Nicht in der Beta; `observer`/`legal` decken den
  Lesezugang (E24).

## Nachweis

Scheibe **029** (Plan 4): Negativtests abgelaufene Sitzung → 401, falsche Audience → 401,
`X-Actor` ohne Demo → 401, Subject ohne Rolle → 403, gesperrtes Subject → 401, `HV_DEMO=1` mit
Issuer → Start verweigert, Notfallkonto bei laufendem IdP → 403, Nutzung erzeugt Alarm; CI mit
Keycloak grün; Wahrheitstabelle unverändert. Aus B1 zusätzlich der Screenshot der Anmeldeseite.
Die Zuordnungstabelle kommt aus Scheibe 026 (E8).

## Offene Registerzeilen

- **E11** Identity Provider, Client-Typ, Registrierung des Clients, Gastkonten.
- **E8** Rollenzuweisung: Tabelle im Tool oder IdP-Gruppen als Vorschlag.
- **E13 / E10b** Mitbestimmung und Plattform des Übungsmandanten — entscheiden, ob Einzelidentitäten
  oder gepoolte Stationsidentitäten in der Probe gelten.
- **E14** DSFA als Vorbedingung für Personenidentitäten auf Staging.
- **E38** MFA-Richtlinie und Konten für Keycloak im Rückfall.
- **E24** Rollen Notar, Kanzlei, Revision, Versammlungsleitung; Gastzugänge.
