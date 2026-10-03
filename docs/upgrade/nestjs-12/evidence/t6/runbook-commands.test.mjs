import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Execute the exact published blocks. Never invoke actual Docker, ingress or HTTP.
const runbook = readFileSync(
  new URL('../../release-runbook.md', import.meta.url),
  'utf8',
);
const commands = [...runbook.matchAll(/```sh\n([\s\S]*?)```/g)]
  .map((match) => match[1])
  .filter((block) => block.includes('up -d --no-deps --no-build app'));
assert.equal(
  commands.length,
  2,
  'exact upgrade and rollback command blocks required',
);
for (const [index, block] of commands.entries()) {
  const direction = index === 0 ? 'upgrade' : 'rollback';
  for (const scenario of ['running', 'ps-error', 'empty']) {
    test(`${direction}: ${scenario} predecessor state`, () => {
      const directory = mkdtempSync(join(tmpdir(), 'runbook-shell-'));
      try {
        const bin = join(directory, 'bin');
        mkdirSync(bin);
        const log = join(directory, 'commands.log');
        writeFileSync(
          join(bin, 'docker'),
          `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_COMMAND_LOG"
case "$*" in
  *' ps '*)
    case "$MOCK_SCENARIO" in
      running) printf '%s\\n' 'synthetic-running-container';;
      ps-error) printf '%s\\n' 'synthetic Docker query failure' >&2; exit 2;;
    esac;;
esac
`,
          { mode: 0o755 },
        );
        writeFileSync(join(bin, 'curl'), '#!/bin/sh\nexit 0\n', {
          mode: 0o755,
        });
        const script = join(directory, 'operator.sh');
        writeFileSync(script, block);
        const result = spawnSync('/bin/sh', [script], {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: bin,
            MOCK_COMMAND_LOG: log,
            MOCK_SCENARIO: scenario,
            OLD_IMAGE: 'synthetic:old',
            NEW_IMAGE: 'synthetic:new',
            DEPLOY_ENV_FILE: '/synthetic/protected.env',
            API_BASE_URL: 'https://synthetic.invalid',
          },
        });
        assert.equal(result.error, undefined);
        const invoked = readFileSync(log, 'utf8').split('\n');
        const started = invoked.some((line) => line.includes(' up '));
        if (scenario === 'empty') {
          assert.equal(result.status, 0, result.stderr);
          assert.equal(started, true);
        } else {
          assert.notEqual(
            result.status,
            0,
            'unsafe state must abort command block',
          );
          assert.equal(started, false, 'replacement must not start');
          if (scenario === 'ps-error')
            assert.match(result.stderr, /Cannot verify/);
          else assert.match(result.stderr, /still running/);
        }
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}
