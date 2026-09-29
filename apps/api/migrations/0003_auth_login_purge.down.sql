DROP INDEX {{schema}}.auth_login_states_expires_idx;
DROP FUNCTION {{schema}}.auth_purge_login_states(timestamptz);
