// Gate: house vocabulary and rights-as-data (AGENTS.md rules 4 and 9).
// 1. Forbidden words in interface texts (i18n dictionaries and components).
// 2. No role-name comparison in interface code outside the actor store / role switcher.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const webSrc = join(root, 'apps/web/src');
const forbidden = [/\bTickets?\b/, /\bAssignee\b/, /\bTasks?\b/, /Workflow-Instanz/, /\bIssues?\b/];
const roleCompare = /\brole\s*(===|!==|==|!=)\s*['"]/;
const allowedRoleFiles = [/RoleSwitcher/, /actor\.ts$/, /\.test\.tsx?$/];

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

if (!existsSync(webSrc)) {
  console.log('vocabulary-check: no apps/web/src yet');
  process.exit(0);
}
let failures = 0;
for (const file of walk(webSrc)) {
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (line.includes('vocabulary-ok')) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments may explain the forbidden terms
    for (const re of forbidden) {
      if (re.test(line)) {
        console.error(`${rel}:${i + 1}: forbidden vocabulary ${re}: ${line.trim()}`);
        failures++;
      }
    }
    if (roleCompare.test(line) && !allowedRoleFiles.some((re) => re.test(file))) {
      console.error(`${rel}:${i + 1}: role-name comparison in interface code (use _actions): ${line.trim()}`);
      failures++;
    }
  });
}
if (failures > 0) {
  console.error(`vocabulary-check: ${failures} finding(s)`);
  process.exit(1);
}
console.log('vocabulary-check: ok');
