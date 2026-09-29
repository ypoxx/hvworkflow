-- Slice 034a: bounded clean-up of login states (finding 029b major). The runtime role has no DELETE
-- right on `auth_login_states`; it may only run this function, which removes consumed rows and rows
-- that expired before the caller's `p_now` (the injected clock of the service), at most 500 per call.
CREATE FUNCTION {{schema}}.auth_purge_login_states(p_now timestamptz) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  WITH doomed AS (
    SELECT state_hash FROM {{schema}}.auth_login_states
    WHERE consumed_at IS NOT NULL OR expires_at <= p_now
    ORDER BY expires_at
    LIMIT 500
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM {{schema}}.auth_login_states
    WHERE state_hash IN (SELECT state_hash FROM doomed)
    RETURNING 1
  )
  SELECT count(*)::integer FROM deleted
$$;

-- Functions are executable for PUBLIC by default; close that here, not only in the runtime grant step
-- (which runs only when a runtime role is configured).
REVOKE ALL ON FUNCTION {{schema}}.auth_purge_login_states(timestamptz) FROM PUBLIC;

CREATE INDEX auth_login_states_expires_idx ON {{schema}}.auth_login_states (expires_at);
