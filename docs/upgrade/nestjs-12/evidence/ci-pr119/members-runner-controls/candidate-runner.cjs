const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const DefaultRunner = require('jest-runner').default;

const supportedShards = new Map([
  [
    'token-session',
    {
      source: 'auth/token-session.service.ts',
      profiles: ['smoke', 'complete'],
    },
  ],
  ['members', { source: 'members/members.service.ts', profiles: ['complete'] }],
]);
const activeMutantVariable = '__STRYKER_ACTIVE_MUTANT__';
const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

function configurationHash(config) {
  // Stryker requests locations only in the dry run. This reporting flag is the
  // sole measured project-config difference; every other field stays bound.
  return sha256(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(config).filter(
          ([key]) => key !== 'testLocationInResults',
        ),
      ),
    ),
  );
}

function inside(root, filename) {
  const relative = path.relative(root, filename);
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
}

function snapshot(tests) {
  const rootDir = tests[0]?.context.config.rootDir;
  if (!rootDir || !path.isAbsolute(rootDir)) return null;
  const sandbox = path.dirname(rootDir);
  // Only this immutable, runner-owned supported shard sandbox may hold inventory.
  const ancestors = [sandbox];
  for (let index = 0; index < 7; index++)
    ancestors.push(path.dirname(ancestors.at(-1)));
  const shardId = path.basename(ancestors[2]);
  const profile = path.basename(ancestors[4]);
  const supported = supportedShards.get(shardId);
  if (
    !supported ||
    !supported.profiles.includes(profile) ||
    path.basename(rootDir) !== 'src' ||
    !/^sandbox-[A-Za-z0-9]+$/.test(path.basename(sandbox)) ||
    ['.stryker-tmp', shardId, 'shards', profile, 'mutation', 'reports'].some(
      (name, index) => {
        const actual = path.basename(ancestors[index + 1]);
        return actual !== name;
      },
    ) ||
    fs.realpathSync(rootDir) !== rootDir ||
    fs.realpathSync(sandbox) !== sandbox
  )
    return null;
  const configHash = configurationHash(tests[0].context.config);
  const files = tests
    .map((test) => {
      if (
        !path.isAbsolute(test.path) ||
        !inside(rootDir, test.path) ||
        fs.realpathSync(test.path) !== test.path ||
        configurationHash(test.context.config) !== configHash
      ) {
        throw new Error('Test inventory must belong to one immutable sandbox.');
      }
      return { path: test.path, hash: sha256(fs.readFileSync(test.path)) };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(files.map((file) => file.path)).size !== files.length)
    return null;
  const sourcePath = path.join(rootDir, supported.source);
  if (fs.realpathSync(sourcePath) !== sourcePath) return null;
  return {
    schemaVersion: 1,
    rootDir,
    shardId,
    profile,
    source: supported.source,
    configHash,
    sourceHash: sha256(fs.readFileSync(sourcePath)),
    files,
  };
}

function readInventory(filename, binding) {
  if (fs.lstatSync(filename).isSymbolicLink())
    throw new Error('Inventory cannot be a symlink.');
  const inventory = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (
    !inventory ||
    JSON.stringify(Object.keys(inventory).sort()) !==
      JSON.stringify(['binding', 'names']) ||
    JSON.stringify(inventory.binding) !== JSON.stringify(binding) ||
    !inventory.names ||
    Array.isArray(inventory.names)
  )
    throw new Error('Stale inventory.');
  const expected = binding.files.map((file) => file.path).sort();
  if (
    JSON.stringify(Object.keys(inventory.names).sort()) !==
    JSON.stringify(expected)
  )
    throw new Error('Incomplete inventory.');
  for (const names of Object.values(inventory.names)) {
    if (
      !Array.isArray(names) ||
      names.length === 0 ||
      names.some((name) => typeof name !== 'string' || name.trim() === '')
    )
      throw new Error('Invalid registered test names.');
  }
  return inventory;
}

class MutationJestRunner extends DefaultRunner {
  constructor(...args) {
    super(...args);
    this.inventoryResults = new Map();
    this.on('test-file-success', ([test, result]) =>
      this.inventoryResults.set(test.path, result),
    );
    this.on('test-file-failure', ([test]) =>
      this.inventoryResults.set(test.path, null),
    );
  }

  async runTests(tests, watcher, options) {
    this.inventoryResults.clear();
    const pattern = this._globalConfig.testNamePattern;
    let binding;
    try {
      binding = snapshot(tests);
    } catch {
      /* Preserve original dispatch. */
    }
    const filename =
      binding &&
      path.join(
        path.dirname(binding.rootDir),
        `.${binding.shardId}-test-inventory.json`,
      );
    let selected = tests;
    if (pattern && binding) {
      try {
        const inventory = readInventory(filename, binding);
        const regex = new RegExp(pattern, 'i'); // Identical to jest-circus.
        const matching = tests.filter((test) =>
          inventory.names[test.path].some((name) => regex.test(name)),
        );
        if (matching.length) selected = matching;
      } catch {
        /* Unknown, corrupt, stale or empty selection runs all suites. */
      }
    }
    // Preserve the original Jest errors; optimization errors cannot replace them.
    const result = await super.runTests(selected, watcher, options);
    if (
      !pattern &&
      process.env[activeMutantVariable] === undefined &&
      binding &&
      tests.length > 0 &&
      this.inventoryResults.size === tests.length &&
      tests.every((test) => {
        const result = this.inventoryResults.get(test.path);
        return (
          result &&
          !result.testExecError &&
          result.testResults.length > 0 &&
          result.testResults.every(
            (test) =>
              test.status === 'passed' &&
              typeof test.fullName === 'string' &&
              test.fullName.trim() !== '',
          )
        );
      })
    ) {
      const temporary = `${filename}.${process.pid}.tmp`;
      try {
        if (fs.existsSync(filename) && fs.lstatSync(filename).isSymbolicLink())
          throw new Error('Inventory cannot be a symlink.');
        const inventory = {
          binding,
          names: Object.fromEntries(
            tests.map((test) => [
              test.path,
              this.inventoryResults
                .get(test.path)
                .testResults.map((test) => test.fullName),
            ]),
          ),
        };
        fs.writeFileSync(temporary, JSON.stringify(inventory), { flag: 'wx' });
        fs.renameSync(temporary, filename);
      } catch {
        /* A failed publication leaves workers using the original runner. */
      } finally {
        try {
          fs.rmSync(temporary, { force: true });
        } catch {
          /* Best-effort scratch cleanup. */
        }
      }
    }
    return result;
  }
}

module.exports = MutationJestRunner;
