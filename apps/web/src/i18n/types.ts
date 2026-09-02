/**
 * Types of the dictionary. Kept in their own module so that `en.ts` can be typed against the German
 * reference without a value-level import cycle.
 */
import type { de } from './de';

/** Every key the interface may translate. Adding a key to `de.ts` makes `en.ts` fail until it follows. */
export type Dictionary = typeof de;
export type TKey = keyof Dictionary;

export type Lang = 'de' | 'en';
export const LANGS: readonly Lang[] = ['de', 'en'];

/** Placeholders are written `{name}` in the dictionary and replaced at call time. */
export type TParams = Readonly<Record<string, string | number>>;
export type Translate = (key: TKey, params?: TParams) => string;
