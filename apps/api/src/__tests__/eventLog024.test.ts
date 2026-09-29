import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalJson, createInMemoryEventStore, type DomainEvent, type NewEvent } from '@hv/domain';
import { createFileEventLog } from '../eventLog.ts';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function path(): string {
  const directory = mkdtempSync(join(tmpdir(), 'hv-024-'));
  directories.push(directory);
  return join(directory, 'events.jsonl');
}
function event(id: string): NewEvent {
  return { id, type: 'QuestionClosed', at: '2027-04-20T10:00:00.000Z',
    actor: { id: 'tester', role: 'admin' }, subjectId: id, payload: {} } as NewEvent;
}

describe('slice 024 JSONL dev adapter', () => {
  it('loads a legacy prefix, appends only v2 lines and replays the same state after restart', () => {
    const file = path();
    const legacy = JSON.stringify({ ...event('q1'), seq: 1 });
    writeFileSync(file, `${legacy}\n`);
    const first = createInMemoryEventStore(createFileEventLog(file));
    const second = first.append([event('q2')])[0]!;
    expect(first.all()).toHaveLength(2);
    expect(readFileSync(file, 'utf8').split('\n')[0]).toBe(legacy);
    expect(JSON.parse(readFileSync(file, 'utf8').trim().split('\n')[1]!) as DomainEvent)
      .toMatchObject({ seq: 2, schemaVersion: 2, prevHash: first.all()[0]!.hash, hash: second.hash });
    expect(createInMemoryEventStore(createFileEventLog(file)).all()).toEqual(first.all());
  });

  it('names the physical line of invalid JSON and the seq of a broken chain', () => {
    const file = path();
    writeFileSync(file, `\n${JSON.stringify({ ...event('q1'), seq: 1 })}\n{invalid}\n`);
    expect(() => createInMemoryEventStore(createFileEventLog(file))).toThrow(/line 3/i);
    writeFileSync(file, 'null\n');
    expect(() => createInMemoryEventStore(createFileEventLog(file))).toThrow(/line 1/i);
    const valid = createInMemoryEventStore().append([event('q1'), event('q2')]);
    writeFileSync(file, `${JSON.stringify(valid[0])}\n${JSON.stringify({ ...valid[1], subjectId: 'tampered' })}\n`);
    expect(() => createInMemoryEventStore(createFileEventLog(file))).toThrow(/seq 2/i);
  });

  it('rejects structurally incomplete legacy rows with the physical line', () => {
    const file = path();
    const base = { ...event('q1'), seq: 1 };
    const invalid: unknown[] = [
      { ...base, id: undefined },
      { ...base, type: undefined },
      { ...base, subjectId: undefined },
      { ...base, at: undefined },
      { ...base, actor: undefined },
      { ...base, actor: { role: 'admin' } },
      { ...base, actor: { id: 'tester' } },
      { ...base, payload: undefined },
      { ...base, seq: undefined },
      { ...base, type: 'UnknownEvent' },
    ];
    for (const row of invalid) {
      writeFileSync(file, `\n${JSON.stringify(row)}\n`);
      expect(() => createInMemoryEventStore(createFileEventLog(file))).toThrow(/line 2/i);
    }
  });

  it('rejects a v2 actor displayName even when the SHA-256 hash is consistent', () => {
    const file = path();
    const original = createInMemoryEventStore().append([event('q1')])[0]!;
    const withName = { ...original, actor: { ...original.actor, displayName: 'Synthetic Name' } };
    const { hash: _hash, ...withoutHash } = withName;
    const recalculated = { ...withoutHash, hash: createHash('sha256').update(canonicalJson(withoutHash)).digest('hex') };
    writeFileSync(file, `${JSON.stringify(recalculated)}\n`);
    expect(() => createInMemoryEventStore(createFileEventLog(file))).toThrow(/seq 1/i);
  });

  it('takt-028: a broken JSONL line yields a fixed text with the line number and no raw content', () => {
    const file = path();
    writeFileSync(file, `${JSON.stringify({ ...event('q1'), seq: 1 })}\n{"secret":"RAW-MARKER-Erika", oops}\n`);
    let message = '';
    try { createInMemoryEventStore(createFileEventLog(file)); } catch (error) { message = (error as Error).message; }
    expect(message).toBe('Invalid JSONL event at line 2: not valid JSON.');
    expect(message).not.toContain('RAW-MARKER');
    writeFileSync(file, '{"a": RAW-MARKER-2\n');
    expect(() => createInMemoryEventStore(createFileEventLog(file))).toThrow(/^Invalid JSONL event at line 1: not valid JSON\.$/);
  });
});
