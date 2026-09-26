/**
 * Optional JSON-lines persistence (`HV_EVENT_LOG=path.jsonl`, AGENTS.md rule 7: events are
 * append-only). The file is only ever appended to — an existing line is never rewritten or
 * removed — and is replayed once at start to rebuild the in-memory projection.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { assertEventShape, upcastJsonlEvents, type DomainEvent, type Persistence } from '@hv/domain';

export function createFileEventLog(path: string): Persistence {
  let persistedCount = 0;

  return {
    load(): DomainEvent[] | undefined {
      if (!existsSync(path)) return undefined;
      const lines = readFileSync(path, 'utf8').split('\n');
      const events = lines.flatMap((raw, index) => {
        const line = raw.trim();
        if (line.length === 0) return [];
        try {
          const parsed: unknown = JSON.parse(line);
          assertEventShape(parsed);
          return [parsed];
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`Invalid JSONL event at line ${index + 1}: ${reason}.`);
        }
      });
      persistedCount = events.length;
      return events.length > 0 ? upcastJsonlEvents(events) : undefined;
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
