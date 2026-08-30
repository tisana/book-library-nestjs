import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  sourceSha256,
  validateCriticalManifest,
  validateEquivalentAllowlist,
} from './mutation-policy.mjs';

const SELECTED_SOURCES = [
  'src/auth/token-session.service.ts',
  'src/auth/auth-identifier-repair.service.ts',
  'src/auth/auth-identifier-reconciliation.service.ts',
  'src/members/members.service.ts',
  'src/borrowings/borrowings.service.ts',
];
const MANIFEST_PATH = 'test/quality/critical-rule-manifest.json';
const ALLOWLIST_PATH = 'test/quality/mutation-equivalents.json';
const CANDIDATE_PATH = 'reports/mutation/critical-rule-manifest.candidate.json';
const RULE_FIELDS = [
  'id',
  'invariant',
  'source',
  'sourceSha256',
  'startLine',
  'endLine',
  'startAnchor',
  'endAnchor',
];

function fail(message) {
  throw new TypeError(message);
}

function repositoryPath(root, trackedPath) {
  return join(root, ...trackedPath.split('/'));
}

function readJson(root, trackedPath) {
  return JSON.parse(readFileSync(repositoryPath(root, trackedPath), 'utf8'));
}

function readSources(root) {
  return new Map(
    SELECTED_SOURCES.map((source) => [
      source,
      readFileSync(repositoryPath(root, source), 'utf8'),
    ]),
  );
}

function compareRules(left, right) {
  const sourceDifference =
    SELECTED_SOURCES.indexOf(left.source) -
    SELECTED_SOURCES.indexOf(right.source);
  return (
    sourceDifference ||
    left.startLine - right.startLine ||
    left.endLine - right.endLine ||
    left.id.localeCompare(right.id)
  );
}

function assertManifestOrder(manifest) {
  const sorted = [...manifest.rules].sort(compareRules);
  if (sorted.some((rule, index) => rule !== manifest.rules[index])) {
    fail(
      'manifest rules must be ordered by selected source, start line, end line, and id.',
    );
  }
}

function requireCandidateRule(rule, index) {
  if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
    fail(`manifest.rules[${index}] must be an object.`);
  }
  const actualFields = Object.keys(rule).sort();
  const expectedFields = [...RULE_FIELDS].sort();
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some(
      (field, fieldIndex) => field !== expectedFields[fieldIndex],
    )
  ) {
    fail(`manifest.rules[${index}] has an invalid schema.`);
  }
  if (!SELECTED_SOURCES.includes(rule.source)) {
    fail(`manifest.rules[${index}].source is not selected.`);
  }
  for (const field of ['id', 'invariant', 'startAnchor', 'endAnchor']) {
    if (typeof rule[field] !== 'string' || rule[field].trim() === '') {
      fail(`manifest.rules[${index}].${field} must be non-empty.`);
    }
  }
  if (
    !Number.isInteger(rule.startLine) ||
    !Number.isInteger(rule.endLine) ||
    rule.startLine < 1 ||
    rule.startLine > rule.endLine
  ) {
    fail(`manifest.rules[${index}] has an invalid inclusive range.`);
  }
}

function uniqueAnchorLine(lines, anchor, label) {
  const matches = [];
  lines.forEach((line, index) => {
    if (line === anchor) {
      matches.push(index + 1);
    }
  });
  if (matches.length === 0) {
    fail(`${label} is missing from its source.`);
  }
  if (matches.length !== 1) {
    fail(`${label} is not unique.`);
  }
  return matches[0];
}

function buildCandidate(manifest, sourceByPath) {
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest) ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.rules) ||
    manifest.rules.length === 0
  ) {
    fail('manifest must be a non-empty schema-version-1 object.');
  }
  assertManifestOrder(manifest);
  const candidate = {
    schemaVersion: 1,
    rules: manifest.rules.map((rule, index) => {
      requireCandidateRule(rule, index);
      const sourceText = sourceByPath.get(rule.source);
      if (typeof sourceText !== 'string') {
        fail(`manifest.rules[${index}].source is unavailable.`);
      }
      const lines = sourceText.split(/\r?\n/);
      const startLine = uniqueAnchorLine(
        lines,
        rule.startAnchor,
        `manifest.rules[${index}].startAnchor`,
      );
      const endLine = uniqueAnchorLine(
        lines,
        rule.endAnchor,
        `manifest.rules[${index}].endAnchor`,
      );
      if (startLine > endLine) {
        fail(`manifest.rules[${index}] anchors are out of order.`);
      }
      return {
        ...rule,
        sourceSha256: sourceSha256(sourceText),
        startLine,
        endLine,
      };
    }),
  };
  assertManifestOrder(candidate);
  return validateCriticalManifest(candidate, sourceByPath);
}

function check(root) {
  const manifest = readJson(root, MANIFEST_PATH);
  const allowlist = readJson(root, ALLOWLIST_PATH);
  const sourceByPath = readSources(root);
  const validatedManifest = validateCriticalManifest(manifest, sourceByPath);
  assertManifestOrder(validatedManifest);
  validateEquivalentAllowlist(
    allowlist,
    validatedManifest,
    new Date().toISOString(),
  );
  process.stdout.write(
    `Critical mutation manifest check passed (${validatedManifest.rules.length} rules).\n`,
  );
}

function writeCandidate(root) {
  const manifest = readJson(root, MANIFEST_PATH);
  const allowlist = readJson(root, ALLOWLIST_PATH);
  const sourceByPath = readSources(root);
  const candidate = buildCandidate(manifest, sourceByPath);
  validateEquivalentAllowlist(allowlist, candidate, new Date().toISOString());
  const target = repositoryPath(root, CANDIDATE_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote review candidate: ${CANDIDATE_PATH}\n`);
}

function main() {
  const args = process.argv.slice(2);
  if (
    args.length !== 1 ||
    (args[0] !== '--check' && args[0] !== '--candidate')
  ) {
    fail('Usage: update-critical-rule-manifest.mjs --check|--candidate');
  }
  if (args[0] === '--check') {
    check(process.cwd());
  } else {
    writeCandidate(process.cwd());
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Critical mutation manifest error: ${message}\n`);
  process.exitCode = 1;
}
