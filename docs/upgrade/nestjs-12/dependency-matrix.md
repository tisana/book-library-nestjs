# Dependency matrix

Verified 2026-10-02 against npm registry using `npm_config_cache=/tmp/nestjs-t0-npm-cache`. Every target query exited 0. No dependency files changed. Full engines, peers, repositories and registry dist-tags: [evidence/targets.json](evidence/targets.json).

| Package | Locked baseline | Planned target | Node engine | Peer requirements |
| --- | --- | --- | --- | --- |
| @nestjs/common | 11.1.17 | 12.1.1 | not declared | rxjs: ^7.1.0; class-validator: >=0.13.2; reflect-metadata: ^0.1.12 \|\| ^0.2.0; class-transformer: >=0.4.1 |
| @nestjs/core | 11.1.18 | 12.1.1 | >= 20 | rxjs: ^7.1.0; @nestjs/common: ^12.0.0; reflect-metadata: ^0.1.12 \|\| ^0.2.0; @nestjs/websockets: ^12.0.0; @nestjs/microservices: ^12.0.0; @nestjs/platform-express: ^12.0.0 |
| @nestjs/platform-express | 11.2.6 | 12.1.1 | not declared | @nestjs/core: ^12.0.0; @nestjs/common: ^12.0.0 |
| @nestjs/testing | 11.1.13 | 12.1.1 | not declared | @nestjs/core: ^12.0.0; @nestjs/common: ^12.0.0; @nestjs/microservices: ^12.0.0; @nestjs/platform-express: ^12.0.0 |
| @nestjs/config | 4.0.4 | 12.0.1 | not declared | rxjs: ^7.1.0; @nestjs/common: ^11.0.0 \|\| ^12.0.0 |
| @nestjs/jwt | 11.0.2 | 12.0.2 | not declared | @nestjs/common: ^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0 \|\| ^11.0.0 \|\| ^12.0.0 |
| @nestjs/mongoose | 11.0.4 | 12.0.0 | not declared | rxjs: ^7.0.0; mongoose: ^7.0.0 \|\| ^8.0.0 \|\| ^9.0.0; @nestjs/core: ^11.0.0 \|\| ^12.0.0; @nestjs/common: ^11.0.0 \|\| ^12.0.0 |
| @nestjs/passport | 11.0.5 | 12.0.0 | not declared | passport: ^0.5.0 \|\| ^0.6.0 \|\| ^0.7.0; @nestjs/common: ^11.0.0 \|\| ^12.0.0 |
| @nestjs/schedule | 6.1.3 | 12.0.2 | >=20.19.0 | @nestjs/core: ^11.0.0 \|\| ^12.0.0; @nestjs/common: ^11.0.0 \|\| ^12.0.0 |
| @nestjs/swagger | 11.4.7 | 12.0.2 | ^20.19.0 || >=22.12.0 | typescript: ^5.5.0 \|\| ^6.0.0; @nestjs/core: ^12.0.0; @nestjs/common: ^12.0.0; @fastify/static: ^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0; class-validator: *; reflect-metadata: ^0.1.12 \|\| ^0.2.0; class-transformer: * |
| @nestjs/cli | 11.0.19 | 12.0.8 | >= 20.11 | webpack: ^5.105.4; @swc/cli: ^0.8.0; @swc/core: ^1.15.18; ts-loader: ^9.5.4; @rspack/core: ^1.7.7 \|\| ^2.1.10; webpack-node-externals: ^3.0.0; tsconfig-paths-webpack-plugin: ^4.2.0; fork-ts-checker-webpack-plugin: ^9.1.0 |
| @nestjs/schematics | 11.0.10 | 12.0.6 | ^22.22.3 || ^24.15.0 || >=26.0.0 | prettier: ^3.0.0; typescript: >=6.0.0 |
| typescript | 5.9.3 | 6.0.2 | >=14.17 |  |
| ts-jest | 29.4.6 | 29.4.14 | ^14.15.0 || ^16.10.0 || ^18.0.0 || >=20.0.0 | jest: ^29.0.0 \|\| ^30.0.0; jest-util: ^29.0.0 \|\| ^30.0.0; babel-jest: ^29.0.0 \|\| ^30.0.0; typescript: >=4.3 <7; @babel/core: >=7.0.0-beta.0 <9; @jest/types: ^29.0.0 \|\| ^30.0.0; @jest/transform: ^29.0.0 \|\| ^30.0.0 |

Retain Jest 30.2.0 and Mongoose 9.8.1 initially. Node baseline is 24.19.0, npm 11.9.0. Schematics requires TypeScript >=6 and Node ^24.15.0 on the selected line; ts-jest target supports TypeScript >=4.3 <7 and Jest 29/30. Core package engine metadata (>=20) is less strict than release runtime requirements (20.19+/22.12+); use the maintained Node 24 line as planned. Optional peers in the raw matrix must not be mistaken for mandatory integrations (e.g. microservices, websockets, Fastify and alternate CLI builders). After upgrade recheck the entire resolved tree, including mapped-types.

## Release evidence

HTTP 200 confirmed the official [Nest 12.0.0](https://github.com/nestjs/nest/releases/tag/v12.0.0), [Nest 12.1.1](https://github.com/nestjs/nest/releases/tag/v12.1.1), [Passport 12.0.0](https://github.com/nestjs/passport/releases/tag/12.0.0) releases and tagged schematics/ts-jest package metadata. Requests/results: [evidence/releases.json](evidence/releases.json).

Nest 12 core ships ESM but supports CommonJS applications through modern Node require(esm). Review lifecycle ordering by component hierarchy, ValidationPipe error options, HTTP adapter error mapping, and Express graceful shutdown. Config introduces Standard Schema validation; retain current custom/class DTO validation. No GraphQL/NATS/Joi migration is needed for this checkout. Nest 12.1.1 fixes logging, circular dependency detection, provider overrides, enum handling and ParseArrayPipe validation. Passport removes deep import shims and strips PassportModule-only options from passport.authenticate; custom getAuthenticateOptions signatures need checking. Do not adopt observability, Vitest or a new app module format.

## Advisory evidence

The npm bulk advisory endpoint returned HTTP 200 and an empty advisory map for all 14 exact targets: [evidence/target-advisories.json](evidence/target-advisories.json). This checks direct target versions only; a future lockfile must be audited separately.

Current-lock `npm audit --json` exits 1: 7 affected packages (2 high, 5 moderate, 0 critical), [evidence/audit.json](evidence/audit.json). High: brace-expansion recursion/CPU denial of service and browserslist memory/crash/prototype-write issues. Moderate: fast-uri normalization, Swagger/js-yaml merge CPU denial of service, and qs/typed-rest-client denial of service. Swagger target 12.0.2 is the reported remediation for the current Swagger 11.4.7/js-yaml chain. npm reports other fixes available; T0 deliberately does not regenerate dependencies. No claim that production exposure or the future transitive tree has been fully assessed.

Optional peer flags and module/exports maps were also queried for all 14 targets, each exit 0: [evidence/target-module-metadata.json](evidence/target-module-metadata.json). The target CLI's webpack/SWC/Rspack/loader peers are optional. Nest core/tests optional microservices/websockets/platform peers do not require adding unused integrations.

All 11 unique exact-target release pages returned HTTP 200, with compact notes in [evidence/release-notes.json](evidence/release-notes.json). Additional relevant notes: Mongoose integration uses native ESM/root exports but CommonJS require(esm) remains supported; Config 12.0.1 fixes environment interpolation and updates dotenv; JWT 12.0.2 refines decode overloads; Schedule 12.0.2 fixes deleted-job resurrection and timer return typing; Swagger fixes schema/plugin handling and Swagger UI escaping; CLI 12.0.8 preserves CommonJS entry exports. Schematics fixes generated ESM Supertest types and CommonJS sub-app e2e execution. TypeScript's tag points to its announcement/issue lists; compiler compatibility is still to be verified in T3. ts-jest 29.4.14 reverts compiler-util changes, while intervening releases add module-resolution/CJS fixes: [target changelog excerpt](evidence/ts-jest-target-changelog.json).


## T3 verified loader exception

The exact Nest/TypeScript targets above were applied. Actual Jest 30.2.0 could not load Nest 12 ESM packages. Coordinator-approved **Jest 30.4.1** is the first supporting stable line plus the required CJS default-interop fix; Jest 30.4.0 failed on tslib and 30.3.0 lacks synchronous require(ESM). Keep the official `--experimental-vm-modules` launch flag. Existing ts-jest 29.4.14 peers accept this Jest minor; Mongoose 9.8.1 and all other unrelated direct dependency versions are retained. [Decision, release, peer and advisory evidence](evidence/t3/jest-loader-decision.md), [resolved versions](evidence/t3/resolved-direct.json). This replaces “retain Jest 30.2.0 initially” only after a demonstrated loader failure, not by selecting latest.
