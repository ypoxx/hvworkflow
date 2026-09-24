/**
 * The Wortmeldeliste as the API hands it out: sorted by round and position, with the `_actions` the
 * calling actor may take. Refetches whenever the event log grows or the actor changes
 * (`useApiVersion`), and on demand after a refused write.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Speaker } from '@hv/domain';
import { api } from '../../api';
import { getActor, useActor } from '../../api/actor';
import { useApiVersion } from '../../api/useApiVersion';
import { showProblem } from '../../components';
import { getLang, translate } from '../../i18n';

export type LoadStatus = 'loading' | 'ready' | 'error' | 'forbidden';

export interface SpeakersState {
  status: LoadStatus;
  speakers: readonly Speaker[];
  reload: () => void;
}

/**
 * A denied read (R-PERM-02 "no read permission" or R-PERM-03 "read scope exceeded", slice 010).
 * Structural, not `instanceof`: the interface talks to `HvApi`, and an HTTP adapter hands out a
 * plain problem object rather than the domain's error class. Read by ruleId alone, never by role
 * name (AGENTS.md rule 4, docs/slices/010b-lesepfade-oberflaeche.md Ziel 4).
 *
 * Test gap 8c (review round 2): identical in `capture/useCapture.ts`, `answers/lib.ts`,
 * `stage/lib.ts` and `history/lib.ts` — not one shared implementation. This slice's "Files
 * allowed" (docs/slices/010b-lesepfade-oberflaeche.md) is five feature folders, nothing else; the
 * house's own convention for a feature helper this small is to keep it local rather than import it
 * from a neighbour (`stage/lib.ts`'s own docstring: "must not start depending on the backlog's
 * machinery" — `clockTime` is duplicated the same way, in `answers/lib.ts`, `stage/lib.ts` and
 * `history/lib.ts`, each with its own house-specific format). Every copy carries its own test
 * (`useSpeakers.test.ts` here) covering the same table, so a change to one that silently drifts
 * from the others fails loudly rather than staying unnoticed.
 */
export function isReadForbidden(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? (error as { status: unknown }).status : undefined;
  const ruleId = 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
  return status === 403 && (ruleId === 'R-PERM-02' || ruleId === 'R-PERM-03');
}

const NO_SPEAKERS: readonly Speaker[] = [];

export function useSpeakers(): SpeakersState {
  const version = useApiVersion();
  const [token, setToken] = useState(0);
  const [read, setRead] = useState<KeyedRead | null>(null);
  /**
   * Slice 010d, Ziel 1: the list is kept with the key of the load that read it, and handed out only
   * to that load's actor (`keyBelongsTo`). After a role switch the previous role's rows — with its
   * `_actions`: call, finish, move, withdraw, drag — are not offered for the one response time
   * until the new role has answered; the page shows its skeleton instead. A newer `version` of the
   * same actor keeps the rows on screen while it loads (nothing jumps, design principle 8).
   */
  const [list, setList] = useState<{ key: string; speakers: readonly Speaker[] } | null>(null);

  /**
   * Slice 010c, Ziel 4: every answer used to be set as it came — ready, refused and failed alike —
   * so a failure already replaced an earlier refusal here. What was missing is the key: an answer
   * asked for the previous actor that lands in the gap between an actor switch and the `version`
   * bump (api/useApiVersion.ts) used to be taken — the refusal of a role that is no longer signed
   * in stood until the new role's own answer came in. It is dropped now (`isCurrentLoad`), and the
   * refusal is the view's verdict like everywhere else (`readVerdict`): it belongs to the actor, so
   * a plain failure of the same actor's next load keeps it (review round 1, finding 4).
   */
  const actorId = useActor().id;
  const [shownVerdict, setShownVerdict] = useState<ReadVerdict>(NO_VERDICT);
  const verdict = readVerdict(shownVerdict, [{ read, key: loadKey(actorId, version) }], actorId);
  if (verdict !== shownVerdict) setShownVerdict(verdict);
  useEffect(() => {
    let cancelled = false;
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    api
      .listSpeakers()
      .then((next) => {
        if (!isCurrentLoad(requested, current())) return;
        setList({ key: requested, speakers: next });
        setRead({ key: requested, status: 'ready' });
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        if (isReadForbidden(error)) {
          // Ziel 1 (slice 010b): a gestalteter Zustand, not an error toast — the Wortmeldeliste
          // is simply not readable in this role.
          setList({ key: requested, speakers: NO_SPEAKERS });
          setRead({ key: requested, status: 'forbidden' });
          return;
        }
        // The language is read at call time so that a language switch does not re-run the load.
        showProblem(error, translate(getLang(), 'toast.problem'));
        setRead({ key: requested, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [version, token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  // The refusal is the verdict's; a stored refusal the verdict does not carry is still on its way,
  // and so is any answer given to another actor (slice 010d) — its "ready" or "error" says nothing
  // about this actor's list.
  const status: LoadStatus = verdict.forbidden
    ? 'forbidden'
    : read === null || read.status === 'forbidden' || !keyBelongsTo(read.key, actorId)
      ? 'loading'
      : read.status;
  const speakers = list !== null && keyBelongsTo(list.key, actorId) ? list.speakers : NO_SPEAKERS;
  return { status, speakers, reload };
}

/**
 * Slice 010c (Lesezustand je Ladevorgang): a read state — ready, refused, failed — belongs to the
 * load that produced it, and a load is keyed by the actor who asked and the `version` it asked at.
 * Two rules follow, and every view keeps both:
 * - An answer counts only for its own load (`isCurrentLoad`). One that was overtaken — a newer
 *   `version`, or another actor in the gap before the `version` bump that follows every actor
 *   switch (api/useApiVersion.ts) — never reports.
 * - The view's verdict ("keine Leseberechtigung" or not) changes only once every read it depends on
 *   has answered for the current key (`readVerdict`). Until then the previous verdict stands, so
 *   nothing flickers while a load is on its way (design principle 8; review round 1, finding 7).
 *   A refusal belongs to the actor it was given to (review round 1, finding 4): a ready answer or a
 *   refusal replaces it, and so does a failure of another actor's load — but a plain failure of the
 *   same actor's next load says nothing new about that actor's rights, and the refusal stands.
 *
 * Kept as a small local copy per feature (`speakers/useSpeakers.ts`, `capture/useCapture.ts`,
 * `answers/lib.ts`, `stage/lib.ts`, `history/lib.ts`) — the spec allows no shared folder outside the
 * features — and covered by the same test table in each.
 */
export type ReadStatus = 'ready' | 'forbidden' | 'error';

/** What one load answered, and which load that was. */
export interface KeyedRead {
  readonly key: string;
  readonly status: ReadStatus;
}

/** The verdict a view shows, and the actor it was reached for (`null` before any). */
export interface ReadVerdict {
  readonly actor: string | null;
  readonly forbidden: boolean;
}

export const NO_VERDICT: ReadVerdict = { actor: null, forbidden: false };

/** The key of one load: who asked, and at which `version` (plus, where needed, what was asked). */
export function loadKey(actorId: string, version: number | string): string {
  return JSON.stringify([actorId, String(version)]);
}

/**
 * Whether an answer asked under `requested` still speaks for the view. `current` is the view's key
 * at the moment the answer arrives, or `null` once the view has moved on (its effect was cleaned up).
 */
export function isCurrentLoad(requested: string, current: string | null): boolean {
  return current !== null && requested === current;
}

/**
 * The verdict a view shows for `actorId`: `previous` until every read has answered for its own
 * current key, then "refused" if one of those answers is a refusal — or if every one of them failed
 * and the previous refusal was this very actor's. An unchanged verdict is returned as the same
 * object, so a caller may store it during render without looping.
 */
export function readVerdict(
  previous: ReadVerdict,
  reads: readonly { read: KeyedRead | null; key: string }[],
  actorId: string,
): ReadVerdict {
  const answers: ReadStatus[] = [];
  for (const { read, key } of reads) {
    if (read === null || read.key !== key) return previous;
    answers.push(read.status);
  }
  const keepsRefusal =
    previous.forbidden &&
    previous.actor === actorId &&
    answers.every((status) => status === 'error');
  const forbidden = answers.includes('forbidden') || keepsRefusal;
  return previous.actor === actorId && previous.forbidden === forbidden
    ? previous
    : { actor: actorId, forbidden };
}

/**
 * Slice 010d (Ansichtsdaten gehören dem Schlüssel des Akteurs): whether data loaded under `key` may
 * be offered to `actorId` — only data of that very actor, at any `version`. Data of another actor
 * (the previous role, until the new one has answered) carries that actor's `_actions` and read
 * scope; it is not offered (design principle 9), and the view shows its loading state instead.
 * `null`: nothing loaded yet. The actor is read from the key as a whole (`loadKey` is JSON), so
 * one id that is a prefix of another never matches.
 *
 * Kept as a small local copy per feature that holds such data (`speakers/useSpeakers.ts`,
 * `capture/useCapture.ts`, `answers/lib.ts`, `history/lib.ts`), next to the 010c pattern above, and
 * covered by the same test table in each.
 */
export function keyBelongsTo(key: string | null, actorId: string): boolean {
  if (key === null) return false;
  const [owner] = JSON.parse(key) as unknown[];
  return owner === actorId;
}
