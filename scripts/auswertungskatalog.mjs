#!/usr/bin/env node
/**
 * Generated evaluation catalogue (Auswertungskatalog, first version, slice 033b). Deterministic: no
 * timestamps; the commit comes only from `GITHUB_SHA`, else "lokal". Reads the one catalog
 * `apps/api/src/metrics/catalog.json` and writes `auswertungskatalog.md` and `.json` into
 * `dist/auswertungskatalog/` (`dist/` is ignored). CI uploads both as the artifact `auswertungskatalog`.
 * The diff gate and the completion (legal-basis matrix) follow in slice 073. `--out <dir>` for tests.
 * Slice 061 adds the section "Berichte (Oberfläche)": every report of the catalog with purpose, right,
 * operation, aggregation, minimum group size and its field table.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NO_PERSON = 'Es gibt keine Kennzahl je Person.';
const NOT_IN_CATALOG = [
  { name: 'Rate-Limit-Zähler', why: 'Scheibe 034; flüchtig, prozesslokal, nicht auswertbar, nie im Katalog.' },
  { name: 'Zugriffslog', why: 'Scheibe 033a; technische Zeilen, nur im Verfahren zu zweit einsehbar, keine Kennzahl.' },
  { name: 'Vorgangshistorie', why: 'Protokollebene 1 (ADR 0013); Ereignisse je Vorgang, keine Kennzahl.' },
];

let out = join(ROOT, 'dist', 'auswertungskatalog');
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--out') out = resolve(process.argv[++i]);
  else throw new Error(`unknown argument ${process.argv[i]}`);
}

const catalog = JSON.parse(readFileSync(join(ROOT, 'apps/api/src/metrics/catalog.json'), 'utf8'));
const commit = process.env.GITHUB_SHA ? process.env.GITHUB_SHA : 'lokal';

const data = {
  commit,
  catalogVersion: catalog.version,
  statement: NO_PERSON,
  definitions: catalog.definitions,
  metrics: catalog.metrics.map((m) => ({
    name: m.name, type: m.type, definition: m.help, purpose: m.purpose, labels: m.labels, source: m.source,
    aggregation: m.aggregation, personalReference: m.personalReference, spec: m.spec,
  })),
  // Slice 061: views that show figures (Berichte), e.g. the control desk; absent in older catalogs.
  reports: (catalog.reports ?? []).map((r) => ({
    id: r.id, purpose: r.purpose, permission: r.permission, operationId: r.operationId, aggregation: r.aggregation,
    questionReferences: r.questionReferences, minimumGroupSize: r.minimumGroupSize, fields: r.fields, spec: r.spec,
  })),
  notInCatalog: NOT_IN_CATALOG,
};

const lines = [
  '# Auswertungskatalog (Erstfassung)',
  '',
  `Commit: ${commit}`,
  '',
  NO_PERSON,
  '',
  catalog.definitions,
  '',
  '## Kennzahlen',
  '',
];
for (const m of data.metrics) {
  lines.push(
    `### \`${m.name}\``,
    '',
    `- Typ: ${m.type}`,
    `- Definition: ${m.definition}`,
    `- Zweck: ${m.purpose}`,
    `- Labels: ${m.labels.length === 0 ? 'keine' : m.labels.map((l) => `\`${l}\``).join(', ')}`,
    `- Quelle: ${m.source}`,
    `- Aggregation: ${m.aggregation}`,
    `- Personenbezug: ${m.personalReference}`,
    `- Spezifikation: Scheibe ${m.spec}`,
    '',
  );
}
if (data.reports.length > 0) {
  lines.push('## Berichte (Oberfläche)', '');
  for (const r of data.reports) {
    lines.push(
      `### Bericht \`${r.id}\``,
      '',
      `- Zweck: ${r.purpose}`,
      `- Recht: \`${r.permission}\``,
      `- Operation: \`${r.operationId}\``,
      `- Aggregation: ${r.aggregation.join(', ')}${r.questionReferences ? '; Referenzen je Einzelfrage (nur lesbare, ohne Text und ohne Akteur)' : ''}`,
      `- Mindestzahl: ${r.minimumGroupSize === null ? 'nicht festgelegt (E13)' : r.minimumGroupSize}`,
      `- Spezifikation: Scheibe ${r.spec}`,
      '',
      '| Feld | Quelle | Personenbezug |',
      '|---|---|---|',
      ...r.fields.map((f) => `| \`${f.path}\` | ${f.source} | ${f.personalReference} |`),
      '',
    );
  }
}
lines.push('## Nicht im Katalog', '');
for (const item of NOT_IN_CATALOG) lines.push(`- ${item.name}: ${item.why}`);
lines.push('');

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'auswertungskatalog.md'), lines.join('\n'));
writeFileSync(join(out, 'auswertungskatalog.json'), `${JSON.stringify(data, null, 2)}\n`);
console.log(`auswertungskatalog: written to ${out}`);
