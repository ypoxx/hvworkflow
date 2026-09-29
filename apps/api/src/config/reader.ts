/**
 * One reader over the environment for the whole schema (slice 034b): every variable goes through here, is
 * validated with a zod schema, and a failure becomes a fixed sentence (`sentences.ts`). zod's own messages are
 * never used, since they can quote the value.
 */
import type { z } from 'zod';
import { sentence } from './sentences.ts';

export type Env = Readonly<Record<string, string | undefined>>;

export interface Reader {
  readonly env: Env;
  readonly errors: string[];
  /** Names whose value failed its own rule (cross-variable rules skip them). */
  readonly failed: Set<string>;
  /** Set and not empty: an empty value counts as unset (an env file often lists empty placeholders). */
  present(name: string): boolean;
  /** The raw value, for rules that need more than one schema. */
  raw(name: string): string | undefined;
  /**
   * Validated value, or undefined when unset (or empty), or when invalid (then a sentence is recorded).
   * `emptyIsError`: an empty value is a mistake for this variable (033a variables, a path).
   */
  read<T>(name: string, schema: z.ZodType<T>, rule: string, options?: { emptyIsError?: boolean }): T | undefined;
  fail(name: string, rule: string): void;
}

export function createReader(env: Env, errors: string[] = []): Reader {
  const failed = new Set<string>();
  const reader: Reader = {
    env, errors, failed,
    present: (name) => env[name] !== undefined && env[name] !== '',
    raw: (name) => env[name],
    read(name, schema, rule, options) {
      const value = env[name];
      if (value === undefined) return undefined;
      if (value === '' && options?.emptyIsError !== true) return undefined;
      const parsed = schema.safeParse(value);
      if (parsed.success) return parsed.data;
      reader.fail(name, rule);
      return undefined;
    },
    fail(name, rule) {
      errors.push(sentence(name, rule));
      failed.add(name);
    },
  };
  return reader;
}
