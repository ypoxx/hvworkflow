/**
 * Verwaltung (Scheibe 041) — where the administration sets up a General Meeting on one page: which meeting it manages
 * and in which state (version), role assignments with answering unit and expiry, the master data (answering units,
 * agenda, podium seats) and the role cards. Every write is an operation the service already has and decides through
 * `can()`; a refusal appears in the open dialog with its rule id. No code here compares a role name (AGENTS.md R4) or
 * decides a status (R5).
 *
 * The page reads the role assignments first (`readAccess`): a 403 is the locked state, and then nothing else is read
 * (decision 2, D9). The tab stays across an actor change; open dialogs fall with it (090); "now" for the display state
 * of the assignments is read here once per answer and passed down.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useActor } from '../../api/actor';
import { useApiVersion } from '../../api/useApiVersion';
import { useMeeting } from '../../app/useMeeting';
import { useLang } from '../../i18n';
import { readAccess } from './access';
import type { Access } from './access';
import { AdminLayout } from './AdminLayout';
import { MasterDataTab } from './MasterDataTab';
import { MeetingsTab } from './MeetingsTab';
import { LoadingRows } from './parts';
import { RoleCardsTab } from './RoleCardsTab';
import { RolesTab } from './RolesTab';
import type { AdminTabId } from './tabs';

export function AdminPage() {
  const lang = useLang();
  const meeting = useMeeting();
  const actorId = useActor().id;
  const version = useApiVersion();
  const [tab, setTab] = useState<AdminTabId>('roles');
  const [access, setAccess] = useState<{ value: Access; now: Date }>({ value: { status: 'loading' }, now: new Date() });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    void readAccess(api).then((value) => {
      // The one place "now" is read: with the answer it belongs to (assignment states are display only).
      if (!cancelled) setAccess({ value, now: new Date() });
    });
    return () => {
      cancelled = true;
    };
  }, [version, tick]);

  const meetingId = meeting?.id;
  const panel = (() => {
    // Until the service has answered whether this page opens at all, no tab reads anything (decision 2).
    if (access.value.status === 'loading') return <LoadingRows />;
    if (tab === 'roleCards') return <RoleCardsTab />;
    if (tab === 'meetings') return <MeetingsTab currentId={meetingId} />;
    if (meetingId === undefined) return <LoadingRows />;
    if (tab === 'roles') {
      return <RolesTab meetingId={meetingId} access={access.value} now={access.now} actorId={actorId} onReload={reload} />;
    }
    return <MasterDataTab key={tab} kind={tab} meetingId={meetingId} meeting={meeting} actorId={actorId} />;
  })();

  return (
    <AdminLayout meeting={meeting} access={access.value} tab={tab} onTab={setTab} lang={lang}>
      {panel}
    </AdminLayout>
  );
}
