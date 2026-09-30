/**
 * The Keycloak part that the CI checks share (slice 029b built it, slice 031a moved it here): the pinned image, the
 * realm with one confidential client and N synthetic persons, the container start and removal, and the wait for
 * an HTTP answer. Every identity and secret exists only for the run; nothing here prints one.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

/**
 * Tag and digest (SC-10). The digest is the index of the multi-architecture image; it pins the exact bytes, the tag
 * only says which release that is. Update both together, never the tag alone.
 */
export const KEYCLOAK_IMAGE =
  'quay.io/keycloak/keycloak:26.7.4@sha256:82a77884f3af238beab1e7afd63b5f530e1b5c0590bd7aa60b40a40463e29b2c';
export const KEYCLOAK_IMAGE_FORM = /^quay\.io\/keycloak\/keycloak:26\.7\.4@sha256:[0-9a-f]{64}$/;

export const randomSecret = () => randomBytes(32).toString('base64url');

/**
 * Realm with one confidential client (exactly the redirect URIs given) and one user per entry of `persons`.
 * `persons` is a list of keys; the result maps each key to its synthetic user. Username and id are random UUIDs, the
 * address ends in `@example.test`, the password is random per run.
 */
export function buildRealm({ realmName, redirectUris, webOrigins, persons }) {
  const users = Object.fromEntries(persons.map((key) => [key, {
    id: randomUUID(),
    username: `synthetic-${randomUUID()}`,
    password: randomSecret(),
  }]));
  const identity = {
    adminName: `admin-${randomUUID()}`,
    adminPassword: randomSecret(),
    clientId: `hv-ci-${randomUUID()}`,
    clientSecret: randomSecret(),
  };
  const realm = {
    realm: realmName,
    enabled: true,
    registrationAllowed: false,
    resetPasswordAllowed: false,
    clients: [{
      clientId: identity.clientId,
      enabled: true,
      protocol: 'openid-connect',
      publicClient: false,
      secret: identity.clientSecret,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      redirectUris: [...redirectUris],
      webOrigins: [...webOrigins],
    }],
    users: Object.values(users).map((user) => ({
      id: user.id,
      username: user.username,
      email: `${user.username}@example.test`,
      firstName: 'Synthetic',
      lastName: 'Testperson',
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: user.password, temporary: false }],
    })),
  };
  return { identity, users, realm };
}

export async function waitForHttp(url, expectedStatus, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('API process exited before it became ready.');
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status === expectedStatus) return response;
    } catch { /* startup can temporarily refuse connections */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`Timed out waiting for ${new URL(url).pathname}.`);
}

/**
 * Starts the container (port only on 127.0.0.1, realm imported at start) and returns once the process is started; the
 * caller waits for the discovery document. The realm file must be readable by the container user (0644) and holds
 * the secrets of the run: `directory` must be a private temporary directory.
 */
export async function startKeycloak({ directory, container, port, realm, adminName, adminPassword, cwd }) {
  const realmFile = join(directory, 'realm.json');
  const envFile = join(directory, 'keycloak.env');
  await writeFile(realmFile, JSON.stringify(realm), { mode: 0o644 });
  await writeFile(envFile, `KC_BOOTSTRAP_ADMIN_USERNAME=${adminName}\nKC_BOOTSTRAP_ADMIN_PASSWORD=${adminPassword}\n`, { mode: 0o600 });
  await execFile('docker', ['run', '--detach', '--rm', '--name', container,
    '-p', `127.0.0.1:${port}:8080`, '--env-file', envFile,
    '-v', `${realmFile}:/opt/keycloak/data/import/realm.json:ro`, KEYCLOAK_IMAGE,
    'start-dev', '--import-realm', `--hostname=http://localhost:${port}`],
  { cwd, timeout: 120_000 });
}

export async function removeKeycloak(container) {
  await execFile('docker', ['rm', '-f', container], { timeout: 10_000 });
}
