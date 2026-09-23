/**
 * German dictionary — the reference. English (`en.ts`) is typed against it, so a missing or extra
 * key is a compile error (AGENTS.md rule 10). Wording follows the house vocabulary in
 * docs/glossar.md; no literal strings may appear in components.
 * 
 * The dictionary is split into feature modules (shell, speakers, capture, answers, stage, history).
 * Each new key belongs to the module corresponding to its feature prefix; new feature modules are
 * added to the module list below and in parity.test.ts.
 */

import { shellDe } from './shell.de';
import { speakersDe } from './speakers.de';
import { captureDe } from './capture.de';
import { answersDe } from './answers.de';
import { stageDe } from './stage.de';
import { historyDe } from './history.de';

export const de = {
  ...shellDe,
  ...speakersDe,
  ...captureDe,
  ...answersDe,
  ...stageDe,
  ...historyDe,
} as const;
