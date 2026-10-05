// Line-based check of the minimumReleaseAge setting in pnpm-workspace.yaml (takt-047).
// No YAML dependency on purpose: the file is tiny and an unknown line in the exclude block must fail.

const DAY_MS = 24 * 60 * 60 * 1000;
const VERSION_ENTRY = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+@\d+\.\d+\.\d+(?:\|\|\d+\.\d+\.\d+)*$/;
const PATTERN_ENTRY = /^(?:@[a-z0-9._*-]+\/)?[a-z0-9._*-]+$/;
const ENTRY_LINE = /^ {2}- "([^"]+)" # (.+)$/;
const COMMENT =
  /^(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|CVE-\d{4}-\d{4,}) added (\d{4}-\d{2}-\d{2}) expires (\d{4}-\d{2}-\d{2})$/;

function parseDate(s) {
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s ? null : t;
}

export function checkReleaseAge(text, today) {
  const errors = [];
  const todayMs = parseDate(today);
  if (todayMs === null) return [`invalid reference date: ${today}`];
  const lines = text.split('\n');

  const ageLines = lines.filter((l) => /^minimumReleaseAge\s*:/.test(l));
  if (ageLines.length !== 1) {
    errors.push(`minimumReleaseAge must occur exactly once, found ${ageLines.length}`);
  } else if (!/^minimumReleaseAge: 10080\s*(#.*)?$/.test(ageLines[0])) {
    errors.push(`minimumReleaseAge must be the number 10080: ${ageLines[0]}`);
  }

  const start = lines.findIndex((l) => /^minimumReleaseAgeExclude\s*:/.test(l));
  if (start === -1) {
    errors.push('minimumReleaseAgeExclude is missing');
    return errors;
  }
  if (lines.filter((l) => /^minimumReleaseAgeExclude\s*:/.test(l)).length !== 1) {
    errors.push('minimumReleaseAgeExclude must occur exactly once');
  }
  const head = lines[start].replace(/\s+$/, '');
  if (head === 'minimumReleaseAgeExclude: []') return errors;
  if (head !== 'minimumReleaseAgeExclude:') {
    errors.push(`unexpected minimumReleaseAgeExclude line: ${lines[start]}`);
    return errors;
  }

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) break; // next top-level key ends the block
    const m = ENTRY_LINE.exec(line);
    if (!m) {
      errors.push(`unknown line in minimumReleaseAgeExclude: ${line}`);
      continue;
    }
    const [, entry, comment] = m;
    const isVersion = VERSION_ENTRY.test(entry);
    const isPattern = entry.includes('*') && !entry.includes('@', 1) && PATTERN_ENTRY.test(entry);
    if (!isVersion && !isPattern) {
      errors.push(`entry must be name@x.y.z or a name pattern with *: ${entry}`);
    }
    const c = COMMENT.exec(comment);
    if (!c) {
      errors.push(`comment needs advisory id, added and expires: ${entry}`);
      continue;
    }
    const added = parseDate(c[2]);
    const expires = parseDate(c[3]);
    if (added === null || expires === null) {
      errors.push(`invalid date in comment: ${entry}`);
    } else if (expires < added || expires - added > 7 * DAY_MS) {
      errors.push(`expires must be 0 to 7 days after added: ${entry}`);
    } else if (expires < todayMs) {
      errors.push(`entry expired on ${c[3]}, remove it: ${entry}`);
    }
  }
  return errors;
}
