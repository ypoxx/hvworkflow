#!/usr/bin/env node
/**
 * Rights are data (AGENTS.md rule 4): the only place a `Role` name may appear as a string literal is
 * `ROLE_PERMISSIONS` (`packages/domain/src/permissions.ts`), the synthetic actors of the demo corpus
 * (`packages/domain/src/seed.ts`) and the `Role` union itself (`packages/domain/src/types.ts`).
 *
 * Review rework (round 1, major 2): the role list is derived from that union — never hard-coded here
 * — so a role added later (e.g. 019's `coordination`) is covered without touching this file, and the
 * gate fails loudly if the union can't be parsed at all (an empty list would silently disable the
 * whole gate). `podium`, `expert` and `legal` are also `Track`/`StageAssignment` values
 * (docs/slices/012-architektur-sicherheitstore.md), so a bare `track === 'podium'` must not be a
 * finding: those three keep a "role context" requirement (`.role`, `['role']`, or a bare `role`
 * variable nearby). Every *other* role name is unambiguous and is flagged wherever it appears as a
 * literal at all — quoted (single/double/backtick) or as an unquoted object-literal key — because
 * there is no legitimate reason for e.g. "admin" or "observer" to show up as a value anywhere else
 * outside the excluded files.
 *
 * Matching runs over the whole file text (not line by line), so a comparison, `switch` header or
 * `.includes(...)` call split across lines is still caught.
 *
 * Review rework (round 2, minors 2-4): only the `Role` union's own text *range* inside
 * `packages/domain/src/types.ts` is exempt now, not the whole file (anything else in that file is
 * still scanned like any other); the union is parsed from a comment-masked copy so a `;` inside a
 * trailing `//` comment can never be mistaken for the union's own terminator; the derived role list is
 * cross-checked against `ROLE_PERMISSIONS`'s own keys (`packages/domain/src/permissions.ts`) and the
 * gate refuses to run at all on a mismatch — the two are supposed to be exactly the same set; object-
 * key access (`({podium: 1})[actor.role]`) and `new Set([...]).has(actor.role)` are additional
 * ambiguous-role forms (`.includes(...)`, backticks, `['role']` and `case` were already covered).
 *
 * Run as part of `pnpm gates` (`pnpm role-literals`). Deterministic, no network.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const TYPES_PATH = 'packages/domain/src/types.ts';
const PERMISSIONS_PATH = 'packages/domain/src/permissions.ts';
const SCAN_ROOTS = ['apps/api/src', 'packages/domain/src'];
const EXCLUDED_FILES = new Set([
  PERMISSIONS_PATH, // ROLE_PERMISSIONS: the one decision point (AGENTS.md rule 4)
  'packages/domain/src/seed.ts', // synthetic actors of the demo corpus (data, not policy)
  // TYPES_PATH is deliberately NOT excluded wholesale (round 2, minor 2): only the Role union's own
  // text range is blanked out below, so anything else in that file is still scanned.
]);
const isTestFile = (relPath) => relPath.includes('/__tests__/') || relPath.endsWith('.test.ts');

// Values that double as Track/StageAssignment values: only these keep the "role context" requirement.
const AMBIGUOUS_ROLES = new Set(['podium', 'expert', 'legal']);

/** Replaces every `//`-to-end-of-line comment with spaces of the same length (never changes the
 * string's length or its newlines), so character offsets found in the result still index correctly
 * into the original text, while a `;` or quote inside a comment can no longer be mistaken for real
 * code (round 2, minor 3). */
function maskLineComments(text) {
  return text.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/** Parses `export type Role = | 'a' // ... | 'b' ...;` from `packages/domain/src/types.ts` — the
 * single source of truth for which strings are role names (never hard-coded here). Returns the names
 * and the union's own `[start, end)` character range in the *original* (unmasked) file text, so the
 * caller can blank exactly that range out of an otherwise fully-scanned file. */
function deriveRoleUnion() {
  const text = readFileSync(join(ROOT, TYPES_PATH), 'utf8');
  const head = text.match(/export type Role\b\s*=/);
  if (!head) {
    throw new Error(`${TYPES_PATH}: could not find "export type Role = ...;" — has the union moved or been renamed?`);
  }
  const bodyStart = head.index + head[0].length;
  // Bound the search to the next top-level "export" so a missing terminator can never run away and
  // scan the rest of a large file.
  const rest = text.slice(bodyStart);
  const nextExport = rest.match(/^export\s/m);
  const bounded = nextExport ? rest.slice(0, nextExport.index) : rest;
  const masked = maskLineComments(bounded);
  const semiIdx = masked.indexOf(';');
  if (semiIdx === -1) {
    throw new Error(`${TYPES_PATH}: no terminating ";" found for "export type Role = ...".`);
  }
  const names = [...masked.slice(0, semiIdx).matchAll(/['"]([A-Za-z0-9_]+)['"]/g)].map((mm) => mm[1]);
  if (names.length === 0) {
    throw new Error(`${TYPES_PATH}: derived an empty Role list from the union — refusing to run a no-op gate.`);
  }
  return { names, range: { start: bodyStart, end: bodyStart + semiIdx + 1 } };
}

/** Parses `ROLE_PERMISSIONS`'s own top-level object keys from `packages/domain/src/permissions.ts` —
 * the *other* source of truth for role names (AGENTS.md rule 4: it is the one decision point). The
 * two lists are supposed to be exactly the same set; a mismatch means either a role was added to one
 * without the other, or this parser and that file's shape have drifted apart (round 2, minor 3). */
function deriveRolePermissionsKeys() {
  const text = readFileSync(join(ROOT, PERMISSIONS_PATH), 'utf8');
  const head = text.match(/export const ROLE_PERMISSIONS\s*:[^=]*=\s*\{/);
  if (!head) {
    throw new Error(`${PERMISSIONS_PATH}: could not find "export const ROLE_PERMISSIONS: ... = {" — has it moved or been renamed?`);
  }
  const bodyStart = head.index + head[0].length;
  let depth = 1;
  let i = bodyStart;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
  }
  const body = text.slice(bodyStart, i - 1);
  const keys = [...body.matchAll(/(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*:/g)].map((mm) => mm[1]);
  if (keys.length === 0) {
    throw new Error(`${PERMISSIONS_PATH}: derived an empty ROLE_PERMISSIONS key list — refusing to run a no-op cross-check.`);
  }
  return keys;
}

const ROLE_UNION = deriveRoleUnion();
const ALL_ROLES = ROLE_UNION.names;
const ROLE_PERMISSIONS_KEYS = deriveRolePermissionsKeys();
{
  const fromUnion = new Set(ALL_ROLES);
  const fromPermissions = new Set(ROLE_PERMISSIONS_KEYS);
  const onlyInUnion = ALL_ROLES.filter((r) => !fromPermissions.has(r));
  const onlyInPermissions = ROLE_PERMISSIONS_KEYS.filter((r) => !fromUnion.has(r));
  if (onlyInUnion.length > 0 || onlyInPermissions.length > 0) {
    throw new Error(
      `Role list mismatch between ${TYPES_PATH} (${[...fromUnion].join(', ')}) and ${PERMISSIONS_PATH} ` +
        `(${[...fromPermissions].join(', ')}): only in the Role union: ${onlyInUnion.join(', ') || '(none)'}; ` +
        `only in ROLE_PERMISSIONS: ${onlyInPermissions.join(', ') || '(none)'}.`,
    );
  }
}
const AMBIGUOUS_ROLE_LIST = ALL_ROLES.filter((r) => AMBIGUOUS_ROLES.has(r));
const UNAMBIGUOUS_ROLES = ALL_ROLES.filter((r) => !AMBIGUOUS_ROLES.has(r));
const AMBIGUOUS_ALT = AMBIGUOUS_ROLE_LIST.join('|');
const UNAMBIGUOUS_ALT = UNAMBIGUOUS_ROLES.join('|');

// `.role`, `['role']`, `["role"]`, `` [`role`] `` — any way of reaching the role property.
const ROLE_ACCESS = String.raw`(?:\.role\b|\[\s*['"\`]role['"\`]\s*\])`;

function collectTsFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith('.ts')) out.push(full);
    }
  };
  walk(join(ROOT, root));
  return out;
}

/** Every match of a `g`-flagged regex, as `{index, text}` (guards against zero-length infinite loops). */
function findAll(re, text) {
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push({ index: m.index, text: m[0] });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
function snippet(text, index) {
  const start = Math.max(0, text.lastIndexOf('\n', index - 1) + 1);
  const end = text.indexOf('\n', index) === -1 ? text.length : text.indexOf('\n', index);
  return text.slice(start, end).trim();
}

/** Unambiguous roles: a quoted literal (any quote style) or an unquoted object-literal key, anywhere
 * in the file. This alone covers `role: 'admin'`, `actor.role === 'admin'` (either operand order,
 * any line layout), `` role: `admin` ``, `actor['role'] === 'admin'`, `['admin','moderation']
 * .includes(actor.role)` (the array holds the literal) and `{admin:1}[actor.role]` (via the second
 * pattern below) without needing a separate pattern per syntactic form. */
function unambiguousFindings(text) {
  if (UNAMBIGUOUS_ALT === '') return [];
  const out = [];
  out.push(...findAll(new RegExp(`['"\`](${UNAMBIGUOUS_ALT})['"\`]`, 'g'), text));
  out.push(...findAll(new RegExp(`[{,]\\s*(${UNAMBIGUOUS_ALT})\\s*:`, 'g'), text));
  return out;
}

/** Ambiguous roles (podium/expert/legal): still require role context, but now over the whole file
 * (multi-line comparisons and switch headers), with `['role']` and backticks as alternatives to
 * `.role`/quotes, and an explicit `.includes(...)` form. */
function ambiguousFindings(text) {
  if (AMBIGUOUS_ALT === '') return [];
  const alt = AMBIGUOUS_ALT;
  const patterns = [
    new RegExp(`${ROLE_ACCESS}\\s*(?:===|!==|==|!=)\\s*['"\`](${alt})['"\`]`, 'g'),
    new RegExp(`['"\`](${alt})['"\`]\\s*(?:===|!==|==|!=)\\s*[\\w.]*${ROLE_ACCESS}`, 'g'),
    new RegExp(`\\brole\\s*(?:===|!==|==|!=)\\s*['"\`](${alt})['"\`]`, 'g'), // bare `role` (destructured)
    new RegExp(`['"\`](${alt})['"\`]\\s*(?:===|!==|==|!=)\\s*\\brole\\b`, 'g'),
    new RegExp(`\\brole\\s*:\\s*['"\`](${alt})['"\`]`, 'g'), // object property `role: 'podium'`
    // ['podium','expert'].includes(actor.role) — an array of ambiguous literals tested against a role access
    new RegExp(`\\[[^\\]]*['"\`](?:${alt})['"\`][^\\]]*\\]\\s*\\.includes\\s*\\([^)]*(?:${ROLE_ACCESS}|\\brole\\b)[^)]*\\)`, 'g'),
    // actor.role.includes(...) style is not valid JS for a scalar, but guard the reverse form anyway:
    new RegExp(`(?:${ROLE_ACCESS}|\\brole\\b)\\s*\\.includes\\s*\\([^)]*['"\`](?:${alt})['"\`][^)]*\\)`, 'g'),
    // ({podium: 1})[actor.role] — an object literal keyed by an ambiguous role, indexed by a role
    // access (round 2, minor 4).
    new RegExp(`\\{\\s*(?:${alt})\\s*:[^{}]*\\}\\s*\\)?\\s*\\[\\s*[\\w.]*(?:${ROLE_ACCESS}|\\brole\\b)\\s*\\]`, 'g'),
    // new Set(['podium', 'expert']).has(actor.role) (round 2, minor 4).
    new RegExp(
      `new\\s+Set\\s*\\(\\s*\\[[^\\]]*['"\`](?:${alt})['"\`][^\\]]*\\]\\s*\\)\\s*\\.has\\s*\\(\\s*[\\w.]*(?:${ROLE_ACCESS}|\\brole\\b)\\s*\\)`,
      'g',
    ),
  ];
  const out = [];
  for (const p of patterns) out.push(...findAll(p, text));
  return out;
}

/** `case 'podium':` inside a `switch (...)` whose (possibly multi-line) expression mentions `role`,
 * found by brace-depth counting over the raw character stream from the switch header onward. */
function switchCaseFindings(text) {
  if (AMBIGUOUS_ALT === '') return [];
  const out = [];
  const headerRe = /switch\s*\(([\s\S]*?)\)/g;
  let m;
  while ((m = headerRe.exec(text))) {
    if (!/\brole\b/.test(m[1])) continue;
    const braceStart = text.indexOf('{', headerRe.lastIndex);
    if (braceStart === -1) continue;
    let depth = 0;
    let end = text.length;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = text.slice(braceStart, end);
    const caseRe = new RegExp(`case\\s*['"\`](${AMBIGUOUS_ALT})['"\`]\\s*:`, 'g');
    for (const hit of findAll(caseRe, body)) out.push({ index: braceStart + hit.index, text: hit.text });
  }
  return out;
}

/** Replaces every character in `[start, end)` with a space, except newlines (so line numbers of
 * whatever comes after are unaffected) — used to blank out just the `Role` union's own text range in
 * `types.ts`, rather than excluding that whole file (round 2, minor 2). */
function blankRange(text, start, end) {
  const blanked = text.slice(start, end).replace(/[^\n]/g, ' ');
  return text.slice(0, start) + blanked + text.slice(end);
}

const findings = [];
for (const root of SCAN_ROOTS) {
  for (const absFile of collectTsFiles(root)) {
    const rel = relative(ROOT, absFile).split('\\').join('/');
    if (EXCLUDED_FILES.has(rel) || isTestFile(rel)) continue;
    let text = readFileSync(absFile, 'utf8');
    if (rel === TYPES_PATH) text = blankRange(text, ROLE_UNION.range.start, ROLE_UNION.range.end);
    const hits = [...unambiguousFindings(text), ...ambiguousFindings(text), ...switchCaseFindings(text)];
    for (const hit of hits) findings.push({ file: rel, line: lineOf(text, hit.index), text: snippet(text, hit.index) });
  }
}

const seen = new Set();
const unique = findings.filter((f) => {
  const key = `${f.file}:${f.line}:${f.text}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
unique.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

if (unique.length > 0) {
  console.error('Role-literal check failed (AGENTS.md rule 4): a role name is used as a literal outside the policy layer.');
  for (const f of unique) console.error(`  ${f.file}:${f.line}: ${f.text}`);
  console.error(
    '\nMove the decision into packages/domain/src/permissions.ts (ROLE_PERMISSIONS) or packages/domain/src/api.ts (can()); ' +
      'a role name may only appear there, in seed.ts (demo corpus data), in the Role union itself, or in a test file.',
  );
  process.exit(1);
}

console.log(
  `Role-literal check: no role-name literal outside the policy layer (${SCAN_ROOTS.join(', ')}); ` +
    `roles from ${TYPES_PATH}: ${ALL_ROLES.join(', ')} (role-context required only for: ${AMBIGUOUS_ROLE_LIST.join(', ') || '(none)'}).`,
);
