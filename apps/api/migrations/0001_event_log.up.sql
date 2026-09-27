CREATE TABLE {{schema}}.events (
  seq bigint PRIMARY KEY CHECK (seq > 0),
  id text NOT NULL UNIQUE,
  meeting_id text NOT NULL,
  hash text NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  prev_hash text NOT NULL CHECK (prev_hash = '' OR prev_hash ~ '^[0-9a-f]{64}$'),
  envelope jsonb NOT NULL CHECK (jsonb_typeof(envelope) = 'object')
);

CREATE INDEX events_meeting_id_seq_idx ON {{schema}}.events (meeting_id, seq);

CREATE TABLE {{schema}}.persons (
  meeting_id text NOT NULL,
  person_id text NOT NULL,
  display_name text NOT NULL,
  organisation text,
  key_id text NOT NULL,
  source_seq bigint NOT NULL REFERENCES {{schema}}.events (seq),
  PRIMARY KEY (meeting_id, person_id)
);

CREATE INDEX persons_source_seq_idx ON {{schema}}.persons (source_seq);
