/**
 * Dependency direction (docs/agentische-entwicklung-plan.md section 5.1; slice 012). Run with
 * `pnpm arch` (root package.json). Rules (a), (b), (c) block the build (`severity: error`); rule
 * (b2) only warns — the findings are listed in docs/slices/012-architektur-sicherheitstore.md
 * ("Bericht") and the cleanup is a separate, later change (this slice's Nicht-Ziele).
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-apps',
      severity: 'error',
      comment:
        'packages/domain is the application core: no framework, no I/O (AGENTS.md rule 6, ADR 0002). ' +
        'It must never import from an app.',
      from: { path: '^packages/domain/src' },
      to: { path: '^apps/' },
    },
    {
      // Review rework round 1, minor 15: this used to enumerate only the I/O-shaped core modules
      // (fs, net, http, ...). packages/domain also runs in the browser (ADR 0002, demo runs the
      // domain in-process in the browser) — *any* Node core module (e.g. `path`, `util`, `assert`,
      // Node's own `crypto`) is equally out of place there, I/O or not.
      name: 'domain-no-node-core-modules',
      severity: 'error',
      comment:
        'packages/domain runs in the browser too (ADR 0002); it has no I/O of its own and must not ' +
        'depend on any Node core module, not just the I/O-shaped ones.',
      from: { path: '^packages/domain/src' },
      to: { dependencyTypes: ['core'] },
    },
    {
      // dependency-cruiser's own predefined rule (configs/rules/not-to-unresolvable.cjs), inlined
      // rather than referenced so this config stays a single self-contained file.
      name: 'not-to-unresolvable',
      severity: 'error',
      comment:
        "This module depends on a module that cannot be found ('resolved to disk'). If it's an npm " +
        'module: add it to package.json. In all other cases you likely already know what to do.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'web-no-api',
      severity: 'error',
      comment:
        'apps/web talks to HvApi only (ADR 0002); it has no server-side persistence today. This also ' +
        'covers any future apps/api/src/persistence/** — apps/web must never import from apps/api.',
      from: { path: '^apps/web/src' },
      to: { path: '^apps/api/' },
    },
    {
      name: 'web-features-i18n-domain-types-only',
      severity: 'warn',
      comment:
        'ADR 0001/0002 boundary: only apps/web/src/api/** (createInProcessApi, storage, seed) may pull ' +
        'values from @hv/domain; apps/web/src/features/** and apps/web/src/i18n/** may import types ' +
        'only ("import type"). Not blocking yet — see docs/slices/012-architektur-sicherheitstore.md ' +
        '("Bericht") for the inventory of today\'s violations (review finding of slice 009); the ' +
        'cleanup is its own small change, not part of this slice.',
      from: { path: '^apps/web/src/(features|i18n)/' },
      to: { path: '^packages/domain/src', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'no-adapter-to-adapter',
      severity: 'error',
      comment:
        'A neighbouring-system adapter must not import another adapter. Reserved for future adapters ' +
        'under apps/api/src/adapters/*/** (empty today; the path is only kept alive for the rule).',
      from: { path: '^apps/api/src/adapters/([^/]+)/' },
      to: { path: '^apps/api/src/adapters/([^/]+)/', pathNot: '^apps/api/src/adapters/$1/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage|playwright-report|test-results|\\.git)(/|$)' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};
