#!/usr/bin/env node
/**
 * CI gate: fail when the installed dependency tree contradicts itself.
 *
 * This exists because of the 2026-09-13 outage (LIF-266). Three TestFlight
 * builds shipped an app that died in dyld before a line of JS ran:
 *
 *   Symbol not found: ExpoModulesJSI.JavaScriptActor.runIsolated
 *     Referenced from: .../ExpoModulesCore.framework/ExpoModulesCore
 *     Expected in:     .../ExpoModulesJSI.framework/ExpoModulesJSI
 *
 * `expo-modules-core` ships a prebuilt XCFramework compiled against a specific
 * `expo-modules-jsi`. A lockfile regeneration floated core to a version whose
 * jsi requirement (~57.0.8) no longer matched the 57.0.4 an override holds it
 * at, and npm installed the mismatch anyway — overrides win over a declared
 * range, by design.
 *
 * The decisive part: npm *knew*. It had been printing
 *
 *   expo-modules-jsi@57.0.4 invalid: "~57.0.8" from expo-modules-core
 *
 * the whole time. Nothing read it. Every CI job stayed green, because nothing
 * here builds the iOS app and a version skew between two native modules is
 * invisible to a typecheck, a unit test, or a web e2e run.
 *
 * So this gate reads it. It is cheap — no Xcode, no signing, no device, about a
 * second — and it catches the one thing that actually shipped broken.
 *
 * What it does NOT catch: a native module that is internally consistent but
 * still wrong for the SDK (use `npx expo install --check` for that), or Swift
 * that fails to compile (only a real iOS build finds those). It is one layer,
 * not the whole answer. See LIF-266.
 *
 * Deliberately dependency-free, matching scripts/audit-gate.mjs — a tool that
 * guards the dependency tree should not be adding to it.
 *
 * Usage: node scripts/native-surface-gate.mjs
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * npm classifies tree problems with a leading keyword. `invalid` means an
 * installed version does not satisfy what a dependent declared — the shape of
 * the dyld crash above.
 *
 * But `invalid` alone is too broad to enforce. The root package.json pins
 * `uuid` and `decode-uri-component` to patched versions their dependents never
 * declared, deliberately, to clear advisories. Those are pure JavaScript: a
 * version the dependent did not ask for is a judgement call someone already
 * made, and failing on it would make this job red by default — the same way the
 * audit gate went red-forever before LIF-215, which is how people learn to stop
 * reading a gate.
 *
 * So the rule is narrower: an `invalid` is fatal only when the package ships
 * **native** code. That is the case where a version skew stops being a
 * judgement call and becomes a linker error at launch — JavaScript resolves
 * late and forgivingly, a prebuilt XCFramework does not. It selects
 * expo-modules-jsi and leaves the two JS pins alone.
 *
 * `extraneous` is never fatal, for the same red-by-default reason: an
 * unreferenced package is usually local drift (a stray install, a half-cleaned
 * node_modules). Reported, not enforced.
 */
const FATAL = 'invalid';

/**
 * Does this installed package ship platform code? Expo modules declare
 * themselves with expo-module.config.json; React Native modules ship a podspec
 * or an apple/ios source directory. Any of those means CocoaPods will compile
 * or link it into the binary.
 */
function shipsNativeCode(packageDir) {
  try {
    if (!statSync(packageDir).isDirectory()) return false;
  } catch {
    return false;
  }
  let entries;
  try {
    entries = readdirSync(packageDir);
  } catch {
    return false;
  }
  if (entries.includes('expo-module.config.json')) return true;
  if (entries.some((e) => e.endsWith('.podspec'))) return true;
  return ['ios', 'apple', 'android'].some((dir) => {
    try {
      return statSync(join(packageDir, dir)).isDirectory();
    } catch {
      return false;
    }
  });
}

/**
 * npm writes the problem as `invalid: <name>@<version> <absolute install path>`.
 * The trailing path is what we need to inspect the package on disk.
 */
function installPathFromProblem(problem) {
  const match = /^invalid: \S+ (\/.+)$/.exec(problem);
  return match ? match[1] : null;
}

function collectProblems(node, path, out) {
  for (const problem of node.problems ?? []) {
    out.push({ problem, path });
  }
  for (const [name, child] of Object.entries(node.dependencies ?? {})) {
    collectProblems(child, path ? `${path} > ${name}` : name, out);
  }
}

function main() {
  let raw;
  try {
    // `npm ls` exits non-zero whenever it finds any problem, which is the case
    // we care about — so the exit code is not an error condition here, and the
    // JSON on stdout is still complete. Only a genuine failure to run (no
    // node_modules, bad JSON) should stop us.
    raw = execFileSync('npm', ['ls', '--all', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    raw = error.stdout;
    if (!raw) {
      console.error('native-surface-gate: could not run `npm ls`.');
      console.error(error.message);
      process.exit(2);
    }
  }

  let tree;
  try {
    tree = JSON.parse(raw);
  } catch {
    console.error('native-surface-gate: `npm ls --json` did not return JSON.');
    process.exit(2);
  }

  const found = [];
  collectProblems(tree, '', found);

  // Deduplicate: npm repeats every problem on the root node as well as on the
  // offending node, so each one is seen at least twice.
  const seen = new Map();
  for (const entry of found) {
    const existing = seen.get(entry.problem);
    // Keep the occurrence that carries a dependency path — it names the
    // dependent, which is the thing someone has to go and fix.
    if (!existing || (!existing.path && entry.path)) seen.set(entry.problem, entry);
  }

  const fatal = [];
  const other = [];
  for (const entry of seen.values()) {
    if (!entry.problem.startsWith(FATAL)) {
      other.push(entry);
      continue;
    }
    const installPath = installPathFromProblem(entry.problem);
    if (installPath && shipsNativeCode(installPath)) fatal.push(entry);
    else other.push(entry);
  }

  if (other.length > 0) {
    console.log(`native-surface-gate: ${other.length} non-fatal tree problem(s):`);
    for (const { problem } of other) console.log(`  - ${problem}`);
    console.log('');
  }

  if (fatal.length === 0) {
    console.log('native-surface-gate: dependency tree is self-consistent.');
    return;
  }

  console.error(
    `native-surface-gate: ${fatal.length} dependency version conflict(s) in the installed tree.\n`
  );
  for (const { problem, path } of fatal) {
    console.error(`  ${problem}`);
    if (path) console.error(`    via ${path}`);
  }
  console.error(
    [
      '',
      'An installed package does not satisfy what one of its dependents asks for.',
      'For a native module this is not cosmetic: expo-modules-core and friends',
      'ship prebuilt binaries that link against an exact counterpart, so a skew',
      'here crashes the app at launch with a dyld "Symbol missing" abort while',
      'every other CI job stays green. That is LIF-266, and it shipped three',
      'times before anyone read this line.',
      '',
      'Fix it by aligning the versions — `npx expo install --check` for the Expo',
      'surface, which moves it as the unit Expo tested. If an override in the',
      'root package.json is forcing the mismatch, that override is the bug.',
    ].join('\n')
  );
  process.exit(1);
}

main();
