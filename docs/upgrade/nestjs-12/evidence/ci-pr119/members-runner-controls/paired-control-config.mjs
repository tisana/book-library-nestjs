import { buildStrykerConfig } from '/workspace/book-library-nestjs/stryker.config.mjs';
const mode = process.env.MEMBERS_CONTROL_MODE;
if (!['original', 'candidate'].includes(mode)) throw Error('Exact paired control mode required');
const config = buildStrykerConfig('complete', {}, 'members', 2);
// Diagnostic-only controls: member-number denial, credential identifier release,
// and exported getMemberId. Production source ranges/mutators stay unchanged.
config.mutate = ['src/members/members.service.ts:84-86', 'src/members/members.service.ts:350-356', 'src/members/members.service.ts:546-549'];
config.mutator = {excludedMutations:['ArrayDeclaration','AssignmentOperator','ArithmeticOperator','BooleanLiteral','EqualityOperator','ArrowFunction','LogicalOperator','ConditionalExpression','OptionalChaining','MethodExpression','StringLiteral','UpdateOperator','ObjectLiteral','UnaryOperator','Regex']};
config.reporters = ['json', 'clear-text'];
config.jsonReporter = {fileName:`/tmp/members-paired-${mode}-report.json`};
config.tempDirName = `/tmp/members-paired-${mode}/reports/mutation/complete/shards/members/.stryker-tmp`;
config.cleanTempDir = false;
config.jest.config.runner = '/tmp/members-paired-observer.cjs';
export default config;
