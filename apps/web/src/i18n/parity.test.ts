import { describe, it, expect } from 'vitest';

import { shellDe } from './shell.de';
import { shellEn } from './shell.en';
import { speakersDe } from './speakers.de';
import { speakersEn } from './speakers.en';
import { captureDe } from './capture.de';
import { captureEn } from './capture.en';
import { answersDe } from './answers.de';
import { answersEn } from './answers.en';
import { stageDe } from './stage.de';
import { stageEn } from './stage.en';
import { historyDe } from './history.de';
import { historyEn } from './history.en';
import { de } from './de';
import { en } from './en';

const modules: Array<{
  name: string;
  de: Record<string, string>;
  en: Record<string, string>;
  prefixes: string[];
}> = [
  {
    name: 'shell',
    de: shellDe as Record<string, string>,
    en: shellEn as Record<string, string>,
    prefixes: [
      'app',
      'boot',
      'error',
      'nav',
      'header',
      'lang',
      'meeting',
      'page',
      'placeholder',
      'process',
      'role',
      'shortcuts',
      'clock',
      'common',
      'demo',
      'status',
      'track',
      'action',
      'event',
      'source',
      'stale',
      'time',
      'toast',
    ],
  },
  { name: 'speakers', de: speakersDe as Record<string, string>, en: speakersEn as Record<string, string>, prefixes: ['speakers'] },
  { name: 'capture', de: captureDe as Record<string, string>, en: captureEn as Record<string, string>, prefixes: ['capture'] },
  { name: 'answers', de: answersDe as Record<string, string>, en: answersEn as Record<string, string>, prefixes: ['answers'] },
  { name: 'stage', de: stageDe as Record<string, string>, en: stageEn as Record<string, string>, prefixes: ['stage'] },
  { name: 'history', de: historyDe as Record<string, string>, en: historyEn as Record<string, string>, prefixes: ['history'] },
];

describe('i18n parity checks', () => {
  modules.forEach(module => {
    describe(`module ${module.name}`, () => {
      it('(a) German and English have the same key set', () => {
        const deKeys = new Set(Object.keys(module.de));
        const enKeys = new Set(Object.keys(module.en));

        const missing = [...deKeys].filter(k => !enKeys.has(k));
        const extra = [...enKeys].filter(k => !deKeys.has(k));

        if (missing.length > 0 || extra.length > 0) {
          const msg = [];
          if (missing.length > 0) msg.push(`Missing in EN: ${missing.join(', ')}`);
          if (extra.length > 0) msg.push(`Extra in EN: ${extra.join(', ')}`);
          throw new Error(msg.join('; '));
        }

        expect(deKeys.size).toBe(enKeys.size);
      });

      it('(b) No value is empty', () => {
        const emptyDe = Object.entries(module.de).filter(([, v]) => !v || (typeof v === 'string' && v.trim() === ''));
        const emptyEn = Object.entries(module.en).filter(([, v]) => !v || (typeof v === 'string' && v.trim() === ''));

        expect(emptyDe).toEqual([]);
        expect(emptyEn).toEqual([]);
      });

      it('(c) Placeholders {name} are the same set in both languages per key', () => {
        const getPlaceholders = (str: string) => {
          const matches = str.match(/\{[^}]+\}/g) || [];
          return new Set(matches);
        };

        Object.keys(module.de).forEach(key => {
          const deVal = module.de[key] || '';
          const enVal = module.en[key] || '';
          const dePlaceholders = getPlaceholders(deVal);
          const enPlaceholders = getPlaceholders(enVal);

          const missing = [...dePlaceholders].filter(p => !enPlaceholders.has(p));
          const extra = [...enPlaceholders].filter(p => !dePlaceholders.has(p));

          if (missing.length > 0 || extra.length > 0) {
            const msg = [];
            if (missing.length > 0) msg.push(`Missing in EN: ${missing.join(', ')}`);
            if (extra.length > 0) msg.push(`Extra in EN: ${extra.join(', ')}`);
            throw new Error(`Key "${key}": ${msg.join('; ')}`);
          }
        });
      });

      it('(d) Each key has the correct prefix for this module, and shell has none of the feature prefixes', () => {
        const featurePrefixes = new Set(['speakers', 'capture', 'answers', 'stage', 'history']);

        Object.keys(module.de).forEach(key => {
          const prefix = key.split('.')[0] || '';

          if (module.name === 'shell') {
            expect(featurePrefixes.has(prefix)).toBe(false);
          } else {
            expect(module.prefixes).toContain(prefix);
          }
        });
      });
    });
  });

  it('(e) No key appears in multiple modules', () => {
    const allKeys = modules.flatMap(m => Object.keys(m.de));
    const uniqueKeys = new Set(allKeys);

    expect(allKeys.length).toBe(uniqueKeys.size);
  });

  // Slice 010 (Lesepfade unter can() mit Leserechten): +6 versus the 436 of slice 020 — one
  // `action.*` key per read permission added to `types.ts`/`ROLE_PERMISSIONS`
  // (`speaker.read`, `contribution.read`, `question.read.delivered`, `stage.read`, `history.read`,
  // `event.read`), needed so `apps/web/src/i18n/labels.ts`'s `ACTION_KEYS` stays an exhaustive map
  // over `Permission` (AGENTS.md rule 10 — every permission label goes through the dictionary).
  // Slice 010b (Lesepfade in der Oberfläche): +14 versus the 442 of slice 010 — one
  // `<feature>.forbidden.title`/`.body` pair per main-query read state (speakers, capture, answers,
  // stage, history: 5 × 2 = 10) plus the two Historie sub-states, `history.timeline.forbidden.*` and
  // `history.stream.forbidden.*` (2 × 2 = 4), Ziel 1/2/3 of docs/slices/010b-lesepfade-oberflaeche.md.
  // Nacharbeit nach Review (Runde 2): +1, `answers.history.forbidden` — the Nebenabfrage
  // `getQuestionHistory` of one open question is refused independently of the Hauptabfrage (major
  // finding); rendered where its lapsed-approval note would otherwise stand.
  // Slice 010d, Ziel 2: +2, `answers.list.error.title`/`.body` — the Beantwortung's list read failed
  // and there are no rows: a gestalteter Fehlerzustand instead of "Kein Treffer".
  it('(f) Total key count is 461 across all modules and matches de and en', () => {
    const totalKeys = modules.reduce((sum, m) => sum + Object.keys(m.de).length, 0);
    const deKeys = Object.keys(de as Record<string, string>).length;
    const enKeys = Object.keys(en as Record<string, string>).length;

    expect(totalKeys).toBe(461);
    expect(deKeys).toBe(461);
    expect(enKeys).toBe(461);
  });
});
