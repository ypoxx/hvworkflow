import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPTS_DIR, '..');
const SCRIPT = join(SCRIPTS_DIR, 'auswertungskatalog.mjs');
const catalog = JSON.parse(readFileSync(join(ROOT, 'apps/api/src/metrics/catalog.json'), 'utf8'));

function generate(env = {}) {
  const out = mkdtempSync(join(tmpdir(), 'katalog-'));
  const r = spawnSync('node', [SCRIPT, '--out', out], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, GITHUB_SHA: '', ...env } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const md = readFileSync(join(out, 'auswertungskatalog.md'), 'utf8');
  const json = readFileSync(join(out, 'auswertungskatalog.json'), 'utf8');
  rmSync(out, { recursive: true, force: true });
  return { md, json };
}

test('two runs are byte-identical (no timestamps)', () => {
  const a = generate();
  const b = generate();
  assert.equal(a.md, b.md);
  assert.equal(a.json, b.json);
});

test('the commit comes only from GITHUB_SHA, else "lokal"', () => {
  assert.match(generate().md, /Commit: lokal/);
  assert.equal(JSON.parse(generate().json).commit, 'lokal');
  assert.match(generate({ GITHUB_SHA: 'abc123synthetic' }).md, /Commit: abc123synthetic/);
});

test('names every catalog metric with definition, purpose, labels, aggregation and personal reference', () => {
  const { md, json } = generate();
  const parsed = JSON.parse(json);
  assert.deepEqual(parsed.metrics.map((m) => m.name), catalog.metrics.map((m) => m.name));
  for (const metric of catalog.metrics) {
    assert.ok(md.includes(`\`${metric.name}\``), metric.name);
    assert.ok(md.includes(metric.help), `${metric.name}: definition`);
    assert.ok(md.includes(metric.purpose), `${metric.name}: purpose`);
    assert.ok(md.includes(metric.aggregation), `${metric.name}: aggregation`);
    assert.ok(md.includes(metric.personalReference), `${metric.name}: personal reference`);
  }
});

test('states "Es gibt keine Kennzahl je Person." and the section "Nicht im Katalog"', () => {
  const { md, json } = generate();
  assert.ok(md.includes('Es gibt keine Kennzahl je Person.'));
  assert.match(md, /^## Nicht im Katalog$/m);
  for (const term of ['Rate-Limit-Zähler', 'Zugriffslog', 'Vorgangshistorie']) assert.ok(md.includes(term), term);
  assert.equal(JSON.parse(json).notInCatalog.length, 3);
});

// Scheibe 061, G1: the reports of the catalog (a view that shows figures) get their own section.
test('G1 writes the section "Berichte (Oberfläche)" with the report leitstand and "reports" into the JSON', () => {
  const { md, json } = generate();
  const parsed = JSON.parse(json);
  assert.match(md, /^## Berichte \(Oberfläche\)$/m);
  assert.deepEqual(parsed.reports.map((r) => r.id), catalog.reports.map((r) => r.id));
  const report = catalog.reports.find((r) => r.id === 'leitstand');
  assert.ok(report, 'leitstand in catalog.json');
  assert.match(md, /^### Bericht `leitstand`$/m);
  for (const text of [report.purpose, report.permission, report.operationId, 'Scheibe 061', 'Mindestzahl: nicht festgelegt']) {
    assert.ok(md.includes(text), text);
  }
  for (const field of report.fields) assert.ok(md.includes(`| \`${field.path}\` | ${field.source} | ${field.personalReference} |`), field.path);
  assert.deepEqual(parsed.reports.find((r) => r.id === 'leitstand').fields, report.fields);
});
