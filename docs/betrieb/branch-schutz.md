# Branch-Schutz — Checkliste für den Eigentümer

Privilegierter Schritt (AGENTS.md: kein Agent darf das setzen). Für den Integrationsbranch
`claude/dax-shareholder-meeting-workflow-0s934z` und, sobald er die Rolle übernimmt, für `main`.
Dauer: unter 30 Minuten. Nachweis: ein Screenshot der Regel nach dem Speichern, abgelegt unter
`docs/evidence/` mit Datum im Dateinamen.

## Ziel

Kein Merge bei rotem `gates`-Lauf (`.github/workflows/gates.yml`), keine Force-Pushes, kein Löschen
des Branches, immer der aktuelle Stand des Zielbranches vor dem Merge.

## Klickpfad (GitHub, klassische Branch-Schutzregeln)

1. Repositorium öffnen → **Settings** (Zahnrad, oben rechts im Repo, nicht im Profil).
2. Linke Seitenleiste → **Branches**.
3. Unter „Branch protection rules" → **Add branch protection rule** (bzw. **Add rule**).
4. **Branch name pattern**: `claude/dax-shareholder-meeting-workflow-0s934z` eintragen (für `main`
   später eine zweite Regel mit Muster `main`).
5. **Require a pull request before merging** aktivieren (mindestens eine Genehmigung ist nicht
   Teil dieser Scheibe — Regel 3 „ein anderes Modell reviewt" läuft heute außerhalb von GitHub;
   diese Kleinänderung ist eine spätere Entscheidung des Eigentümers).
6. **Require status checks to pass before merging** aktivieren:
   - **Require branches to be up to date before merging** anhaken.
   - Im Suchfeld darunter den Pflicht-Statuscheck suchen und hinzufügen: **`gates`**
     (der Job-Name aus `.github/workflows/gates.yml`; erscheint in der Liste erst, nachdem der
     Workflow mindestens einmal auf einem Branch dieses Repositoriums gelaufen ist).
7. **Do not allow bypassing the above settings** aktivieren, damit die Regel auch für
   Repository-Administratoren gilt (sonst gilt sie nur für alle anderen).
8. Unter „Rules applied to everyone including administrators" (oder als eigene Regelzeile, je nach
   GitHub-Version):
   - **Allow force pushes** **nicht** aktivieren (Standard: aus — so lassen).
   - **Allow deletions** **nicht** aktivieren (Standard: aus — so lassen).
9. **Create** (bzw. **Save changes**) klicken.
10. Screenshot der gespeicherten Regel (die Übersichtsseite unter Settings → Branches zeigt Branch,
    Pflicht-Statuscheck und die beiden „nicht erlaubt"-Zeilen für Force-Push/Löschen in einer
    Ansicht) unter `docs/evidence/016-branch-schutz-<TT-MM-JJJJ>.png` ablegen.

GitHub bietet seit 2023 zusätzlich **Rulesets** (Settings → Rules → Rulesets → New branch ruleset)
als neuere, kombinierbare Alternative zu den klassischen „Branch protection rules"; dieselben vier
Bedingungen (Pflicht-Statuscheck `gates`, aktueller Stand vor Merge, kein Force-Push, kein Löschen)
lassen sich dort ebenso setzen. Beide Wege erfüllen diese Checkliste — nicht beide gleichzeitig
anlegen, sonst wirken zwei Regelwerke auf denselben Branch.

## Prüfpunkte (nach dem Speichern)

- [ ] Ein PR gegen den Integrationsbranch zeigt `gates` als Pflicht-Statuscheck und lässt sich bei
      Rot nicht mergen (Merge-Knopf ist deaktiviert oder verlangt eine Bestätigung, je nach
      GitHub-Plan).
- [ ] `git push --force` auf den Integrationsbranch wird von GitHub abgelehnt (`protected branch
      hook declined`).
- [ ] Der Branch lässt sich über die GitHub-Oberfläche nicht löschen (kein Papierkorb-Symbol bzw.
      Fehlermeldung beim Versuch über die API/CLI).
- [ ] „Require branches to be up to date before merging" ist aktiv: ein PR, dessen Basis seit dem
      letzten Durchlauf weitergewandert ist, verlangt vor dem Merge einen erneuten `gates`-Lauf.

## Später (`main`)

Sobald `main` den Integrationsbranch ablöst (Plan 8.3, nach `beta-1`), dieselbe Regel für `main`
anlegen (Schritt 4 mit Muster `main` wiederholen); der Integrationsbranch kann dann auf dieselbe
Regel verweisen oder seine eigene behalten, je nachdem, ob er als Zwischenstufe weiterlebt.
