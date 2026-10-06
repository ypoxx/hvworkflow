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
| Versammlungsbüro | Meeting office | role `moderation` (bis zur Entscheidung E1) | Admin |
| Erfassung (Rolle) | Capture desk | role `capture` | — |
| Fachbereich (Rolle) | Expert | role `expert` | — |
| Recht | Legal | role `legal` | — |
| Freigabe (Rolle) | Approver | role `approver` | — |
| Podium (Rolle) | Podium | role `podium` | — |
| Koordination | Coordination | role `coordination` | — |
| Verweigerung | Refusal | `answerKind: refusal_no_claim \| refusal_with_ground` | — |
| Verweigerung · kein Auskunftsanspruch | Refusal · no right to information | `answerKind: refusal_no_claim` | „Pfad A“ (ist der Antwortpfad `podium`), „Verweigerungspfad A“ in der Oberfläche |
| Verweigerung · Grund aus Katalog | Refusal · ground from catalogue | `answerKind: refusal_with_ground` | „Pfad B“ (ist `fast_track`), „Verweigerungspfad B“ in der Oberfläche |
| Verweigerungsgrund | Refusal ground | `refusalGroundId`, Katalog `packages/domain/src/refusalGrounds.ts` | — |
| Formulierungsbaustein | Template wording | `stageText`, ungeprüft bis 076 (E15) | — |
| Antwortbündel | Answer bundle | `AnswerBundle` | — |
| Bühnenplatz | Podium seat | `StageSeat`, `seatId` (seit Scheibe 040b) | — |
| Weiterleiten | Forward | `question.submit_review` (Anzeige „Weiterleiten", E5: nächster Schritt; an einen anderen Fachbereich siehe die nächste Zeile, Scheibe 048) | — |
| An anderen Fachbereich weiterleiten | Forward to another answering unit | `question.forward`, `forwardQuestion`, Ereignis `QuestionForwarded` (Scheibe 048; Status bleibt, nur der Fachbereich wechselt) | „Weiterleiten“ allein, Reassign, Ticket weitergeben |
| Grund der Weiterleitung | Reason for forwarding | `reasonCode`: `wrong_unit` (Falscher Fachbereich), `expertise_elsewhere` (Fachwissen liegt in einem anderen Fachbereich), `capacity` (Auslastung), `other` (Sonstiges); geschlossener Code, kein Freitext (Scheibe 048) | Begründung (Hauswort der Verweigerung) |
| Nachfrage | Follow-up question | Frageseite: Relation `follow_up` an der Einzelfrage (`relation`, Ereignis `QuestionLinked`, Scheibe 046); Rednerseite: Grund `follow_up` der Wortmeldung nach R-SPK-05 (`SpeakerReopenReason`); beide unabhängig. Schaltfläche „Nachfrage zu …“ mit Alt+B in der Erfassung (Alt+N ist die Navigation) | Rückfrage (Hauswort des Notizfelds, E4) |
| Klarstellung | Clarification | Relation `clarification` an der Einzelfrage (Scheibe 046): der Redner bittet, eine Antwort oder Frage klarzustellen | Verständnisfrage als Name der Funktion |
| Bezugsfrage | Referenced question | `parentQuestionId` (Scheibe 046): die Einzelfrage desselben Jahrgangs, auf die sich eine Nachfrage oder Klarstellung bezieht; unveränderlich (R-LINK-02) | Elternfrage, Parent |
| Vertraulichkeitsstufe | Confidentiality level | `confidentiality: internal \| restricted \| protected` (ab Scheibe 047) | — |
| Fokusansicht | Focus view | `apps/web/src/features/focus/**` | — |
| Schreibmodus | Writing mode | `apps/web/src/features/focus/WritingMode.tsx`; Frage oben, Antwort groß, Liste ausgeblendet (Scheibe 054) | „Vollbild“ als Name der Funktion (es bleibt die Shell), „Editor“ in Texten |
| Vorlesezeit | Reading time | `readingSeconds` (130 Wörter je Minute, Ziel zwei Minuten, Scheibe 054) | — |
| Hausformat | House format | die Whitelist des Antwortformats aus ADR 0005: Absatz, Aufzählung, fett, kursiv, Hervorhebung (`ANSWER_MARKS`, Werkzeugleiste `answers.format.toolbar`, Scheibe 055b) | „Formatierung frei“ |
| Hervorhebung | Highlight | Marke `highlight`; dargestellt als `<mark>` mit `--color-tone-warning-bg`/`-fg` (Scheibe 055b) | „Markierung“ (meint die Auswahl) |
| Auszeichnung | Formatting | fett, kursiv, Hervorhebung einer Antwort (`marks`); „Nur die Auszeichnung ist geändert“ (Scheibe 055b) | „Styling“ |
| Steuerungsansicht | Steering view | `apps/web/src/features/steering/**` | — |
| Verteilung | Distribution | `Meeting.counts.byUnit` (offen je Fachbereich), `Meeting.counts.bySeat` (auf der Bühne je Bühnenplatz); Summen aus dem Dienst, nie je Person (Scheibe 053) | „Matrix“ (es sind zwei Randsummen), „Dashboard“ |
| Leitstand | Cockpit | `apps/web/src/features/cockpit/**` | — |
| Verwaltung (Ansicht) | Administration (view) | `apps/web/src/features/admin/**`, Route `/admin` (Scheibe 041) | „Admin“, „Admin-Panel“ in deutschen Texten |
| Rollenzuordnung | Role assignment | `RoleAssignment`, `assignRole`, `revokeRole` (Scheibe 026; Oberfläche 041) | „Berechtigungsticket“ |
| Rollenkarte | Role card | `roleCards()` aus `ROLE_PERMISSIONS` (Scheibe 041; druckbar mit 062) | — |
| Kennung | Subject id | `subjectId` (pseudonym, ADR 0004) | „Benutzername“, „E-Mail“ |
| Rechtsfreigabe | Legal clearing | `question.legal.clear` | — |
