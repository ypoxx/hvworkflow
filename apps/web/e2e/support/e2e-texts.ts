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

/** Every text the suite writes; none of them may appear in the access log. */
export const WRITTEN_TEXTS: readonly string[] = [
  H8_SPEAKER_NAME,
  H8_CONTRIBUTION_TEXT,
  H8_OTHER_WRITER_QUESTION,
  H8_UNCONFIRMED_QUESTION,
];
