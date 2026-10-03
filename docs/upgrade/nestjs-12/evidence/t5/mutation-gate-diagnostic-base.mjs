// Bounded diagnostics only: these reports cannot be used for mutation acceptance.
import { buildStrykerConfig } from '../../../../../stryker.config.mjs';
const mode = process.env.T5_DIAGNOSTIC_MODE ?? 'gate-throughput-green';
const config = buildStrykerConfig('complete', {}, 'token-session');
config.mutate = [process.env.T5_DIAGNOSTIC_RANGE ?? 'src/auth/token-session.service.ts:238-291'];
config.logLevel = 'debug';
config.reporters = ['json', 'clear-text'];
config.jsonReporter = { fileName: `/tmp/nestjs-t5-diagnostic-${mode}.json` };
config.tempDirName = `/tmp/nestjs-t5-diagnostic-${mode}-sandbox`;
export default config;
