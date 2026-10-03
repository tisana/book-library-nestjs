import config from './mutation-gate-diagnostic-base.mjs';
config.mutate = ['src/auth/token-session.service.ts:249-291'];
config.mutator = { excludedMutations: ['ArrayDeclaration','AssignmentOperator','ArithmeticOperator','BooleanLiteral','EqualityOperator','ArrowFunction','LogicalOperator','ConditionalExpression','OptionalChaining','MethodExpression','StringLiteral','UpdateOperator','ObjectLiteral','UnaryOperator','Regex'] };
export default config;
