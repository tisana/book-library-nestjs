import { readFileSync } from 'node:fs';

const SELECTED_SOURCES = [
  'src/auth/token-session.service.ts',
  'src/auth/auth-identifier-repair.service.ts',
  'src/auth/auth-identifier-reconciliation.service.ts',
  'src/members/members.service.ts',
  'src/borrowings/borrowings.service.ts',
];
const PACKAGE_JEST_CONFIG = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).jest;
const PACKAGE_JEST_CONFIG_WITHOUT_TEST_REGEX = Object.fromEntries(
  Object.entries(PACKAGE_JEST_CONFIG).filter(([key]) => key !== 'testRegex'),
);
const SMOKE_SHARDS = [
  {
    id: 'token-session',
    source: SELECTED_SOURCES[0],
    concurrency: 2,
  },
  {
    id: 'identifier-repair',
    source: SELECTED_SOURCES[1],
    concurrency: 2,
  },
  {
    id: 'identifier-reconciliation',
    source: SELECTED_SOURCES[2],
    concurrency: 2,
  },
  {
    id: 'members',
    source: SELECTED_SOURCES[3],
    concurrency: 4,
  },
  {
    id: 'borrowings',
    source: SELECTED_SOURCES[4],
    concurrency: 2,
  },
];

function requireProfile(profile) {
  if (profile !== 'smoke' && profile !== 'complete') {
    throw new TypeError(
      'MUTATION_PROFILE must be exactly smoke or complete before Stryker starts.',
    );
  }
  return profile;
}

function requireShard(profile, shardId) {
  const shard = SMOKE_SHARDS.find((entry) => entry.id === shardId);
  if (!shard) {
    throw new TypeError(
      `MUTATION_SHARD must be exactly one of ${SMOKE_SHARDS.map((entry) => entry.id).join(', ')} for ${profile}.`,
    );
  }
  return shard;
}

function smokeRanges(manifest, shard) {
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.rules) ||
    manifest.rules.length === 0
  ) {
    throw new TypeError('A non-empty schema-version-1 manifest is required.');
  }
  const ranges = manifest.rules.flatMap((rule, index) => {
    if (
      !SELECTED_SOURCES.includes(rule.source) ||
      !Number.isInteger(rule.startLine) ||
      !Number.isInteger(rule.endLine) ||
      rule.startLine < 1 ||
      rule.startLine > rule.endLine
    ) {
      throw new TypeError(
        `Manifest rule ${index} has an invalid mutation range.`,
      );
    }
    if (rule.source !== shard.source) {
      return [];
    }
    return [`${rule.source}:${rule.startLine}-${rule.endLine}`];
  });
  if (ranges.length === 0) {
    throw new TypeError(`Smoke shard ${shard.id} owns no manifest rules.`);
  }
  return ranges;
}

export function buildStrykerConfig(profile, manifest, shardId) {
  const validatedProfile = requireProfile(profile);
  const shard = requireShard(validatedProfile, shardId);
  const reportRoot = `reports/mutation/${validatedProfile}/shards/${shard.id}`;
  return {
    testRunner: 'jest',
    coverageAnalysis: 'perTest',
    reporters: ['clear-text', 'progress', 'json', 'html'],
    thresholds: { high: 80, low: 70, break: 70 },
    concurrency: validatedProfile === 'complete' ? 4 : shard.concurrency,
    jest:
      validatedProfile === 'smoke' && shard.id === 'members'
        ? {
            projectType: 'custom',
            config: {
              ...PACKAGE_JEST_CONFIG_WITHOUT_TEST_REGEX,
              testMatch: ['<rootDir>/members/members.service.spec.ts'],
              testRegex: [],
            },
            enableFindRelatedTests: true,
          }
        : {
            projectType: 'custom',
            configFile: 'package.json',
            enableFindRelatedTests: true,
          },
    mutate:
      validatedProfile === 'complete'
        ? [shard.source]
        : smokeRanges(manifest, shard),
    jsonReporter: { fileName: `${reportRoot}/mutation.json` },
    htmlReporter: { fileName: `${reportRoot}/mutation.html` },
    tempDirName: `${reportRoot}/.stryker-tmp`,
  };
}

const manifest = JSON.parse(
  readFileSync(
    new URL('./test/quality/critical-rule-manifest.json', import.meta.url),
    'utf8',
  ),
);

export default buildStrykerConfig(
  process.env.MUTATION_PROFILE,
  manifest,
  process.env.MUTATION_SHARD,
);
