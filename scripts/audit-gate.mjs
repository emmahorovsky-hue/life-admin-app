#!/usr/bin/env node
/**
 * CI security gate: `npm audit`, with a narrow allowlist for advisories that
 * have no published fix.
 *
 * This exists because the plain `npm audit --audit-level=moderate` it replaces
 * had no way to express "this one advisory cannot be fixed by anyone right now"
 * (LIF-215). The result was a permanently red job that people stopped reading —
 * the exact outcome LIF-32 fixed the `|| true` to prevent.
 *
 * The gate still fails on ANY moderate-or-worse advisory that is not explicitly
 * allowlisted, so a genuinely new vulnerability turns the build red immediately.
 * Allowlist entries expire; see .audit-allowlist.json.
 *
 * Deliberately dependency-free — it runs before `npm ci`, and a tool that
 * guards the dependency tree should not be adding to it.
 *
 * Usage: node scripts/audit-gate.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST_PATH = join(REPO_ROOT, '.audit-allowlist.json');

/** Fail on this severity and above, matching the old --audit-level=moderate. */
const THRESHOLD = 'moderate';
const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

const isCI = Boolean(process.env.GITHUB_ACTIONS);
const annotate = (level, message) =>
  console.log(isCI ? `::${level}::${message}` : `[${level}] ${message}`);

/**
 * `npm audit --json` exits non-zero whenever it finds anything, so a thrown
 * error is expected and its stdout still holds the report. Only a genuinely
 * unparseable result is treated as a failure — the gate fails closed.
 */
function runAudit() {
  let stdout;
  try {
    stdout = execFileSync('npm', ['audit', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    stdout = error.stdout;
  }

  if (!stdout) {
    throw new Error('`npm audit --json` produced no output');
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Could not parse \`npm audit --json\` output:\n${stdout.slice(0, 2000)}`);
  }
}

/** Collapse the per-package report into one record per distinct advisory. */
function collectAdvisories(report) {
  const byId = new Map();

  for (const [packageName, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      // A string `via` is a re-export of another package's advisory; the
      // advisory object itself appears on the package that actually owns it.
      if (typeof via !== 'object' || !via.url) continue;

      const id = via.url.split('/').pop();
      const existing = byId.get(id);
      if (existing) {
        existing.packages.add(packageName);
        continue;
      }

      byId.set(id, {
        id,
        title: via.title ?? '(untitled)',
        severity: via.severity ?? 'unknown',
        url: via.url,
        packages: new Set([packageName]),
      });
    }
  }

  return [...byId.values()];
}

function loadAllowlist() {
  const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  const entries = new Map();

  for (const entry of parsed.allow ?? []) {
    if (!entry.id) throw new Error(`.audit-allowlist.json: an entry is missing "id"`);
    if (!entry.expires) {
      throw new Error(`.audit-allowlist.json: ${entry.id} is missing "expires"`);
    }

    const expires = new Date(`${entry.expires}T00:00:00Z`);
    if (Number.isNaN(expires.valueOf())) {
      throw new Error(
        `.audit-allowlist.json: ${entry.id} has an unparseable "expires" (${entry.expires}); use YYYY-MM-DD`,
      );
    }

    entries.set(entry.id, { ...entry, expires });
  }

  return entries;
}

function main() {
  const allowlist = loadAllowlist();
  const advisories = collectAdvisories(runAudit());
  const now = new Date();

  const blocking = [];
  const waived = [];

  for (const advisory of advisories) {
    if ((RANK[advisory.severity] ?? 0) < RANK[THRESHOLD]) continue;

    const allowed = allowlist.get(advisory.id);
    if (!allowed) {
      blocking.push({ advisory, why: 'not allowlisted' });
    } else if (allowed.expires <= now) {
      blocking.push({
        advisory,
        why: `allowlist entry expired on ${allowed.expires.toISOString().slice(0, 10)} — re-evaluate it, then extend or remove`,
      });
    } else {
      waived.push({ advisory, allowed });
    }
  }

  for (const { advisory, allowed } of waived) {
    const until = allowed.expires.toISOString().slice(0, 10);
    console.log(
      `WAIVED  ${advisory.severity.padEnd(8)} ${advisory.id}  ${advisory.title}\n` +
        `        expires ${until} · ${advisory.url}`,
    );
  }

  // An entry that no longer matches anything means the advisory was fixed or
  // withdrawn. Surfaced loudly, but not fatal — a build should not break
  // because something got better.
  for (const [id, entry] of allowlist) {
    if (!advisories.some((a) => a.id === id)) {
      annotate(
        'warning',
        `.audit-allowlist.json entry ${id} no longer matches any advisory — it can be deleted (${entry.url ?? 'no url'})`,
      );
    }
  }

  if (blocking.length === 0) {
    const summary = waived.length ? ` (${waived.length} waived)` : '';
    console.log(`\nSecurity gate passed: no unwaived ${THRESHOLD}+ advisories${summary}.`);
    return;
  }

  console.log('');
  for (const { advisory, why } of blocking) {
    annotate(
      'error',
      `${advisory.severity.toUpperCase()} ${advisory.id}: ${advisory.title} — ${why}. ` +
        `Affects: ${[...advisory.packages].join(', ')}. ${advisory.url}`,
    );
  }

  console.log(
    `\nSecurity gate failed: ${blocking.length} ${THRESHOLD}+ advisor${blocking.length === 1 ? 'y' : 'ies'} not covered by .audit-allowlist.json.\n` +
      `Fix by upgrading, or pin a patched version via "overrides" in package.json.\n` +
      `Only allowlist an advisory when NO published fix exists and the code path is unreachable —\n` +
      `see the notes at the top of .audit-allowlist.json.`,
  );
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  annotate('error', `Security gate could not run: ${error.message}`);
  process.exitCode = 1;
}
