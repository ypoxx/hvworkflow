/**
 * Slice 031a: the synthetic texts that the HTTP project of the e2e suite writes to, or reads from, the real
 * service. One source for both sides: the tests type or expect them, and the harness (`scripts/e2e-http-031.mjs`)
 * imports the same constants to prove that none of them reaches the access log (T-G2-I-02).
 *
 * Only `export const` with strings and lists of strings: Node strips the types of this file without a loader,
 * so nothing here may need more than type stripping (no enum, no namespace, no imports).
 */

/** The transparency notice the test service is started with (`HV_TRANSPARENCY_NOTICE_*`). */
export const NOTICE_VERSION = 'e2e-synthetic-1';
export const NOTICE_DE = 'Synthetischer Hinweis für die automatische Prüfung, ohne rechtliche Wirkung.';
export const NOTICE_EN = 'Synthetic notice for the automated check, without legal effect.';
export const DSFA_SUMMARY_URL = 'https://example.org/hv-e2e-dsfa';

/** H8: what the two writers type. Fixed, so that the access log check can look for exactly these words. */
export const H8_SPEAKER_NAME = 'Synthetische Testperson Ypsilon';
export const H8_CONTRIBUTION_TEXT = 'Synthetischer Wortlaut für den Schreibkonflikt im HTTP-Modus.';
export const H8_OTHER_WRITER_QUESTION = 'Synthetische Frage der zweiten schreibenden Person?';
export const H8_UNCONFIRMED_QUESTION = 'Synthetische unbestätigte Frage nach dem Schreibkonflikt?';

/**
 * Slice 031b: the speech of `002-speakers-capture.spec.ts` and `abnahme.spec.ts` (both write it as a Redebeitrag), with
 * exactly seven question sentences, and the other texts of those two files. The files compose the speech from the parts.
 */
export const SPEECH_OPENING = 'Sehr geehrte Damen und Herren, ich danke dem Vorstand für den Bericht zur Lage der Gesellschaft.';
export const SPEECH_QUESTIONS: readonly string[] = [
  'Wie hoch war der Investitionsaufwand im abgelaufenen Geschäftsjahr?',
  'Welche Rückstellungen hat die Gesellschaft für die anhängigen Verfahren gebildet?',
  'Wie entwickelt sich die Eigenkapitalquote im laufenden Geschäftsjahr?',
  'Welche Maßnahmen ergreift der Vorstand gegen den Rückgang der operativen Marge?',
  'Wann rechnet die Gesellschaft mit einer Entscheidung der Kartellbehörde?',
  'Wie viele Stellen sind im Zuge des Sparprogramms bereits entfallen?',
  'Welche Dividende schlägt der Vorstand für das kommende Geschäftsjahr vor?',
];
export const SPEECH_CLOSING = 'Ich danke Ihnen für die Beantwortung.';
export const SPEAKER_002_NAME = 'Henrike Baumgart';
export const SPEAKER_002_FREE_QUESTION = 'Wie viele Stimmrechte waren bei Abstimmung vertreten?';
export const ABNAHME_SPEAKER_NAME = 'Abnahme Testperson';
export const ABNAHME_ANSWER_TEXT =
  'Die Ausschüttungsquote lag im Berichtsjahr bei 47 Prozent des bereinigten Konzernergebnisses. ' +
  'Die Einzelheiten sind im Geschäftsbericht auf Seite 42 dargestellt.';

/** Slice 036b, H13: what the second-browser test writes (a Wortmeldung, a Redebeitrag, one question). */
export const H13_SPEAKER_NAME = 'Synthetische Testperson Sigma';
export const H13_CONTRIBUTION_TEXT = 'Synthetischer Wortlaut für den zweiten Browser im HTTP-Modus.';
export const H13_QUESTION = 'Synthetische Frage für die Einordnung im zweiten Browser?';

/** Scheibe 045: the refusal. The justification sentences are unique, so a test can prove where they never appear. */
export const REFUSAL_045_JUSTIFICATION = 'Synthetische Begründung 045: Offenlegung würde der Gesellschaft einen erheblichen Nachteil zufügen.';
export const REFUSAL_045_NO_CLAIM_JUSTIFICATION = 'Synthetische Begründung 045: kein Bezug zu einem Tagesordnungspunkt erkennbar.';
export const REFUSAL_045_NO_CLAIM_WORDING = 'Synthetischer Wortlaut 045: Diese Frage betrifft keinen Gegenstand der Tagesordnung.';
export const REFUSAL_045_RETURN_REASON = 'e2e 045';
/** Typed into the dialog and never sent (E6, E7, E9). */
export const REFUSAL_045_UNSENT_WORDING = 'Synthetischer Entwurf 045, nie gesendet.';
export const REFUSAL_045_UNSENT_JUSTIFICATION = 'Synthetische Begründung 045, nie gesendet.';

/** Scheibe 054: the focus view. The answer is saved (F2); the unsaved text is typed and never sent (F3, F8). */
export const FOCUS_054_ANSWER = 'Synthetische Antwort 054: Die Rückstellungen sind im Konzernanhang im Einzelnen erläutert.';
export const FOCUS_054_UNSAVED = 'Synthetischer Zusatz 054, nie gespeichert.';
export const FOCUS_054_RETURN_REASON = 'e2e 054';

/** Every text the suite writes; none of them may appear in the access log. */
export const WRITTEN_TEXTS: readonly string[] = [
  SPEECH_OPENING,
  ...SPEECH_QUESTIONS,
  SPEECH_CLOSING,
  SPEAKER_002_NAME,
  SPEAKER_002_FREE_QUESTION,
  ABNAHME_SPEAKER_NAME,
  ABNAHME_ANSWER_TEXT,
  H8_SPEAKER_NAME,
  H8_CONTRIBUTION_TEXT,
  H8_OTHER_WRITER_QUESTION,
  H8_UNCONFIRMED_QUESTION,
  H13_SPEAKER_NAME,
  H13_CONTRIBUTION_TEXT,
  H13_QUESTION,
  REFUSAL_045_JUSTIFICATION,
  REFUSAL_045_NO_CLAIM_JUSTIFICATION,
  REFUSAL_045_NO_CLAIM_WORDING,
  REFUSAL_045_RETURN_REASON,
  FOCUS_054_ANSWER,
  FOCUS_054_UNSAVED,
  FOCUS_054_RETURN_REASON,
];
