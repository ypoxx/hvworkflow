CREATE TABLE {{schema}}.auth_login_states (
  state_hash char(64) PRIMARY KEY CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  browser_hash char(64) NOT NULL CHECK (browser_hash ~ '^[0-9a-f]{64}$'),
  secret_cipher bytea NOT NULL,
  return_to text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '5 minutes')
);

CREATE TABLE {{schema}}.auth_sessions (
  session_hash char(64) PRIMARY KEY CHECK (session_hash ~ '^[0-9a-f]{64}$'),
  actor_id text NOT NULL CHECK (actor_id <> ''),
  csrf_cipher bytea NOT NULL,
  refresh_cipher bytea,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '14 hours'),
  CHECK (idle_expires_at > created_at AND idle_expires_at <= expires_at)
);

CREATE INDEX auth_sessions_actor_idx ON {{schema}}.auth_sessions (actor_id);

CREATE TABLE {{schema}}.auth_logout_ids (
  session_hash char(64) PRIMARY KEY REFERENCES {{schema}}.auth_sessions (session_hash),
  logged_out_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE {{schema}}.auth_subject_blocks (
  actor_id text PRIMARY KEY CHECK (actor_id <> ''),
  blocked_at timestamptz NOT NULL
);
