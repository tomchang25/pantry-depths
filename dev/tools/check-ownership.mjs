#!/usr/bin/env node
/**
 * Raw-state access census for the rules layer.
 *
 * Counts two things per source module: how many bindings take the whole run state, and how many
 * direct mutations are made through it. Both are compared against a recorded allowlist and may only
 * shrink, so a change that widens raw-state access fails a check instead of passing review.
 *
 * This is a census, not a boundary. A local alias defeats a token count, and so does a rename. The
 * hard limits live in the import rules in .dependency-cruiser.cjs and in the contract types; this
 * measures the direction of travel and refuses a step backwards.
 *
 * The one boundary it does hold is the fenced-tree check below: the decision modules may not name the
 * run state type at all, which is cheap to check by token because those trees are small and new.
 *
 * Usage: node dev/tools/check-ownership.mjs [--report]
 *        --report prints the measured counts as allowlist JSON instead of checking them.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_DIR = path.join(ROOT, "src");
const ALLOWLIST = path.join(ROOT, "dev", "standards", "raw_world_allowlist.json");

/** The run state type. Naming it in a decision module is what the fenced trees forbid outright. */
const STATE_TYPE = "World";

/**
 * Trees whose modules may not name the run state type.
 *
 * The attack slice's executor is exempt because holding raw state on the slice's behalf is its job;
 * the import fence exempts it for the same reason. The behavior tree has no exemption.
 */
const FENCED_TREES = [
  { directory: "src/core/player/melee", exempt: ["src/core/player/melee/execute-melee.ts"] },
  { directory: "src/core/enemy/behaviors", exempt: [] },
];

/** Collection calls that mutate the receiver. A call not on this list is a read. */
const MUTATING_CALLS = ["push", "splice", "pop", "shift", "unshift", "sort", "reverse", "fill", "copyWithin", "set"];

/** A path rooted at the state parameter: dotted segments and index access, one or more deep. */
const STATE_PATH = String.raw`\bworld(?:\.[A-Za-z_$][\w$]*|\[[^\]\n]*\])+`;

/** A binding annotated as the run state. A return position is not one: returning state is not taking it. */
const PARAMETER = new RegExp(String.raw`\b[A-Za-z_$][\w$]*\s*:\s*${STATE_TYPE}\b`, "g");

/** Assignment and compound assignment. The lookahead keeps comparisons and arrows out. */
const ASSIGNMENT = new RegExp(
  `${STATE_PATH}` + String.raw`\s*(?:\*\*=|<<=|>>>=|>>=|&&=|\|\|=|\?\?=|[+\-*/%&|^]=|=(?![=>]))`,
  "g",
);

const STEP = new RegExp(`(?:${STATE_PATH}\\s*(?:\\+\\+|--))|(?:(?:\\+\\+|--)\\s*${STATE_PATH})`, "g");

const MUTATING_CALL = new RegExp(
  String.raw`\bworld(?:\.[A-Za-z_$][\w$]*|\[[^\]\n]*\])*\.(?:${MUTATING_CALLS.join("|")})\s*\(`,
  "g",
);

/**
 * Comments are stripped before counting. The rules layer documents its own state heavily, and a
 * comment quoting an assignment would otherwise be counted as one.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function countOf(source, pattern) {
  return (source.match(pattern) ?? []).length;
}

function sourceFiles(directory) {
  const found = [];

  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      found.push(full);
    }
  }

  return found;
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function measure() {
  if (!existsSync(SOURCE_DIR)) {
    return new Map();
  }

  const counts = new Map();

  for (const file of sourceFiles(SOURCE_DIR)) {
    const source = stripComments(readFileSync(file, "utf8"));
    const params = countOf(source, PARAMETER);
    const mutations = countOf(source, ASSIGNMENT) + countOf(source, STEP) + countOf(source, MUTATING_CALL);

    if (params > 0 || mutations > 0) {
      counts.set(relative(file), { params, mutations });
    }
  }

  return counts;
}

function fencedViolations() {
  const named = new RegExp(String.raw`\b${STATE_TYPE}\b`);
  const violations = [];

  for (const tree of FENCED_TREES) {
    const directory = path.join(ROOT, tree.directory);

    if (!existsSync(directory)) {
      continue;
    }

    for (const file of sourceFiles(directory)) {
      const relativePath = relative(file);

      if (tree.exempt.includes(relativePath)) {
        continue;
      }

      if (named.test(stripComments(readFileSync(file, "utf8")))) {
        violations.push(relativePath);
      }
    }
  }

  return violations;
}

const measured = measure();

if (process.argv.includes("--report")) {
  const sorted = Object.fromEntries([...measured].sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(ALLOWLIST, `${JSON.stringify(sorted, null, 2)}\n`);
  process.stdout.write(`ownership: recorded ${measured.size} modules to ${relative(ALLOWLIST)}\n`);
  process.exit(0);
}

if (!existsSync(ALLOWLIST)) {
  process.stderr.write(`ownership: no allowlist at ${relative(ALLOWLIST)} — record one with --report\n`);
  process.exit(1);
}

const allowed = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
const errors = [];

for (const [file, counts] of measured) {
  const limit = allowed[file];

  if (!limit) {
    errors.push(`${file}: not on the allowlist (${counts.params} parameters, ${counts.mutations} mutations)`);
    continue;
  }

  if (counts.params > limit.params) {
    errors.push(`${file}: ${counts.params} whole-state parameters, allowed ${limit.params}`);
  }

  if (counts.mutations > limit.mutations) {
    errors.push(`${file}: ${counts.mutations} direct mutations, allowed ${limit.mutations}`);
  }
}

for (const file of fencedViolations()) {
  errors.push(`${file}: names ${STATE_TYPE}, which a decision module may not`);
}

// Not an error: children move modules constantly, and an entry outstanding after a move is how the
// ratchet reports work still to do rather than a failure to fix here.
const stale = Object.keys(allowed).filter((file) => !measured.has(file));

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`ownership: ${error}\n`);
  }

  process.stderr.write("\nThe allowlist may only shrink. See dev/standards/project_structure.addendum.md\n");
  process.exit(1);
}

const params = [...measured.values()].reduce((total, entry) => total + entry.params, 0);
const mutations = [...measured.values()].reduce((total, entry) => total + entry.mutations, 0);
const staleNote = stale.length > 0 ? `, ${stale.length} allowlist entries now unused` : "";
process.stdout.write(
  `ownership: OK (${measured.size} modules, ${params} parameters, ${mutations} mutations${staleNote})\n`,
);
