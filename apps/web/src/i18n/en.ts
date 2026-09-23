/**
 * American English dictionary. Typed as `Dictionary`, so TypeScript enforces exactly the same keys
 * as the German reference — a translation can never silently go missing.
 */
import type { Dictionary } from './types';
import { shellEn } from './shell.en';
import { speakersEn } from './speakers.en';
import { captureEn } from './capture.en';
import { answersEn } from './answers.en';
import { stageEn } from './stage.en';
import { historyEn } from './history.en';

export const en: Dictionary = {
  ...shellEn,
  ...speakersEn,
  ...captureEn,
  ...answersEn,
  ...stageEn,
  ...historyEn,
};
