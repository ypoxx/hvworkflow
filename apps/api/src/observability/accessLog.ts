/**
 * Access log port and adapters (ADR 0013 level 2, slice 033a). The sink receives one finished JSON
 * line per request; it is separate from the process log (stdout/stderr) and from the event history.
 *
 * `file`: one file per UTC day of the injected clock (`access-YYYY-MM-DD.jsonl`, mode 0600,
 * O_APPEND). The file of day D is removed once today > D + retention (entries stay at least the
 * full period); only regular files that match the name exactly are ever touched (`lstat`, so a
 * symlink or a foreign file with a similar name stays).
 */
import { closeSync, constants, lstatSync, openSync, readdirSync, unlinkSync, writeSync } from 'node:fs';
import { join } from 'node:path';

export interface AccessLogSink {
  /** Throws on failure; the caller answers the request anyway (fail-open) and reports once a minute. */
  write(line: string, at: Date): void;
}

/** Test adapter: keeps the lines in memory. */
export function createMemorySink(): AccessLogSink & { readonly lines: string[] } {
  const lines: string[] = [];
  return { lines, write(line) { lines.push(line); } };
}

/** Default of `createApp` and of the demo without a directory: nothing is kept. */
export const discardSink: AccessLogSink = { write() {} };

const NAME = /^access-(\d{4})-(\d{2})-(\d{2})\.jsonl$/;
const DAY_MS = 86_400_000;

function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

export interface FileSinkOptions {
  dir: string;
  retentionDays: number;
  clock: () => Date;
}

export function createFileSink(options: FileSinkOptions): AccessLogSink {
  const { dir, retentionDays, clock } = options;
  let sweptDay: number | undefined;

  const sweep = (now: Date): void => {
    sweptDay = dayNumber(now);
    let names: string[];
    try { names = readdirSync(dir); } catch { return; }
    for (const name of names) {
      const match = NAME.exec(name);
      if (!match) continue;
      const fileDay = Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS);
      if (dayNumber(now) - fileDay <= retentionDays) continue;
      const path = join(dir, name);
      try {
        if (lstatSync(path).isFile()) unlinkSync(path);
      } catch { /* A file that vanished or cannot be removed is retried at the next new day. */ }
    }
  };
  sweep(clock());

  return {
    write(line, at) {
      if (sweptDay !== dayNumber(at)) sweep(at);
      const file = join(dir, `access-${at.toISOString().slice(0, 10)}.jsonl`);
      // O_NOFOLLOW: a symlink planted under today's name must not redirect the write.
      const fd = openSync(file, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
      try {
        writeSync(fd, `${line}\n`);
      } finally {
        closeSync(fd);
      }
    },
  };
}
