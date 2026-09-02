/**
 * Optional JSON-lines persistence (`HV_EVENT_LOG=path.jsonl`, AGENTS.md rule 7: events are
 * append-only). The file is only ever appended to — an existing line is never rewritten or
 * removed — and is replayed once at start to rebuild the in-memory projection.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { DomainEvent, Persistence } from '@hv/domain';

export function createFileEventLog(path: string): Persistence {
  let persistedCount = 0;

  return {
    load(): DomainEvent[] | undefined {
      if (!existsSync(path)) return undefined;
      const lines = readFileSync(path, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const events = lines.map((l) => JSON.parse(l) as DomainEvent);
      persistedCount = events.length;
      return events.length > 0 ? events : undefined;
    },
    save(events: readonly DomainEvent[]): void {
      if (events.length <= persistedCount) return;
      const newLines = events
        .slice(persistedCount)
        .map((e) => JSON.stringify(e))
        .join('\n');
      appendFileSync(path, newLines + '\n', 'utf8');
      persistedCount = events.length;
    },
  };
}
