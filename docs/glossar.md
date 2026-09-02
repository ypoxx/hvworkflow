# Glossar — Hausvokabular ↔ Code

Die Oberfläche spricht die Sprache des Hauses. Der Code spricht Englisch. Diese Tabelle ist die
verbindliche Zuordnung; Abweichungen sind Befunde.

| Deutsch (Oberfläche) | Englisch (Oberfläche, en-US) | Code / Contract | Verboten |
|---|---|---|---|
| Hauptversammlung, HV | General Meeting | `meeting` | AGM (nur in Erläuterungen) |
| Tagesordnungspunkt, TOP | Agenda item | `agendaItem` | — |
| Wortmeldung | Request to speak | `speaker` (Datensatz) | Ticket |
| Wortmeldeliste | Speakers list | `speakers` | Queue |
| Runde | Round | `round` | — |
| Redner / Rednerin | Speaker | `speaker` | — |
| Redebeitrag | Contribution | `contribution` | Transcript (nur als Quelle) |
| Erfassung | Capture | `capture` | Ticket erstellen |
| Atomisierung, Einzelfrage | Atomization, individual question | `question` | Issue, Task |
| Restabdeckung | Remaining coverage | `coverage` | — |
| Klassifizierung | Classification | `classification` | Triage |
| Antwortpfad | Answer track | `track` | Pipeline |
| Pfad A: freie Beantwortung durch den Vorstand | Board answers directly | `podium` | — |
| Pfad B: Fast Track | Fast track | `fast_track` | — |
| Pfad C: Expert Track | Expert track | `expert_track` | — |
| Fachbereich | Answering unit | `unit` | Team, Assignee |
| Zuweisung | Assignment | `assignment` | Assignee |
| Antwortentwurf, Antwortversion | Answer draft, answer version | `answer`, `AnswerVersion` | Comment |
| Zur Prüfung geben, Legal Clearing | Submit for clearing | `submitForReview`, `in_review` | Review request |
| Freigabe | Approval | `approval`, `approved` | Sign-off |
| Zurückgeben | Return | `return` | Reject |
| Bühne, Bühnenzuordnung | Podium, podium assignment | `stage`, `stageAssignment` | Board view |
| Auf die Bühne legen | Send to podium | `stageQuestion`, `staged` | Publish |
| Vorgelesen | Read out | `delivered` | Done |
| Abgeschlossen | Closed | `closed` | Resolved |
| Zurückgezogen | Withdrawn | `withdrawn` | Cancelled |
| Zusammengeführt | Merged | `merged` | Duplicate |
| Vorgangshistorie | History | `history`, events | Audit log (nur intern) |
| Versammlungsbüro | Meeting office | role `moderation` | Admin |
| Erfassung (Rolle) | Capture desk | role `capture` | — |
| Fachbereich (Rolle) | Expert | role `expert` | — |
| Recht | Legal | role `legal` | — |
| Freigabe (Rolle) | Approver | role `approver` | — |
| Podium (Rolle) | Podium | role `podium` | — |
