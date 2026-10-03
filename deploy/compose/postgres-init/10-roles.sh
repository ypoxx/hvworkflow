#!/bin/sh
# Slice 037a, decision 8: the database roles of the local stack. The entrypoint of the postgres image runs this once, on
# an empty data volume, as the bootstrap superuser `postgres` (POSTGRES_USER). Nothing else uses that superuser.
#
#   hv_owner    LOGIN, no superuser, no CREATEROLE, no CREATEDB; owns the database `hv` and therefore, as a member of
#               pg_database_owner, the schema `public` (Postgres >= 15). Migrations and the one-off fill run as hv_owner.
#   hv_runtime  LOGIN, no superuser, no CREATEROLE, no CREATEDB; the service. Its table rights come from the migration.
#
# The passwords come from postgres.env (generated once per installation, outside the repository). They reach psql as
# psql variables through \getenv, never on a command line and never in the output; the SQL is a heredoc on standard input.
set -eu
# Fail before psql if a password is missing; the expansion checks presence only and prints no value.
: "${HV_OWNER_PASSWORD:?missing}" "${HV_RUNTIME_PASSWORD:?missing}"

psql -v ON_ERROR_STOP=1 --quiet --no-psqlrc --username "$POSTGRES_USER" --dbname postgres <<'SQL'
-- A failing statement must never be echoed to the server log, because the CREATE ROLE lines carry the passwords.
SET log_min_error_statement = panic;
\getenv owner_password HV_OWNER_PASSWORD
\getenv runtime_password HV_RUNTIME_PASSWORD
CREATE ROLE hv_owner LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB PASSWORD :'owner_password';
CREATE DATABASE hv OWNER hv_owner;
CREATE ROLE hv_runtime LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB PASSWORD :'runtime_password';
REVOKE ALL ON DATABASE hv FROM PUBLIC;
GRANT CONNECT ON DATABASE hv TO hv_runtime;
SQL
