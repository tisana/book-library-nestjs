# Minimal Jest loader adjustment

The coordinator authorized exact Jest 30.4.0 after Jest 30.2.0 failed to parse Nest 12 native ESM under Node 24.19.0. npm-packed jest-runtime 30.3.0 lacks synchronous require(ESM); 30.4.0 adds requireEsmModule and the Node 24.9+ synchronous graph APIs. Official [Jest changelog](https://github.com/jestjs/jest/blob/main/CHANGELOG.md#3040) explicitly introduces require(ESM) in 30.4.0. No silent latest selection: registry latest was 30.5.2, but the first supporting stable minor was selected.

The official [Nest migration guide](https://github.com/nestjs/docs.nestjs.com/blob/master/content/migration.md) requires Node 24.9+ for Jest. The official CommonJS [schematics template](https://github.com/nestjs/schematics/blob/master/src/lib/application/files/ts/package.json) launches Jest with node --experimental-vm-modules. Adopt this flag for each existing npm Jest entry; retain CommonJS application semantics and ordinary ts-jest transformation. The initial docs site request returned HTTP 403; official raw GitHub sources succeeded.

Exact Jest 30.4.0 registry engines: ^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0. Existing ts-jest 29.4.14 peers accept Jest ^29 || ^30 and TypeScript >=4.3 <7. Stryker Jest runner 9.6.1 declares the retained core 9.6.1 peer. npm bulk advisory request for exact jest/jest-runtime 30.4.0 returned an empty map. These checks do not replace the final lockfile audit or actual test execution.

Discarded exploration: whitelisting Nest JS for ts-jest parsing hit import.meta; a narrow experimental AST adapter was tried but never accepted. All adapter files/configuration/tests were removed in favor of native Jest support; no package patch or ESM-to-CommonJS dependency rewriting remains.

T5 interface: the VM module flag must also reach Stryker's programmatic Jest workers. The npm Jest entry flag does not automatically reach scripts/quality/run-mutation.mjs or its npx children. Full mutation smoke and that propagation belong to T5; T3 does not claim them verified.

## Verified minimum patch

Actual Jest 30.4.0 failed 34/35 unit suites during loading: tslib/modules/index.js destructured an undefined default export. Native Node loads the same packages correctly. Official Jest 30.4.1 changelog fixes CJS-from-ESM default export semantics to always expose module.exports, removing __esModule unwrapping (PR 16143). Coordinator superseded the first exception with exact Jest **30.4.1**, the smallest patch fixing the observed failure. Exact registry engines remain compatible, existing peers remain valid, and the bulk advisory map for jest/jest-runtime 30.4.1 is empty. Initial failure counts are retained in jest-30.4.0-unit-failure.json.


## Typechecked test compiler

The application, source CLIs and performance build use NodeNext with CommonJS package semantics. Jest uses `tsconfig.jest.json`, extending those settings but selecting TypeScript 6's supported CommonJS/Bundler pair with `isolatedModules: false` and `esModuleInterop: true`. Pinned ts-jest 29.4.14 explicitly supports CommonJS + Bundler on TypeScript 6 (`isBundlerCompatibleModuleKind`). Full program compilation preserves resolved decorator metadata and test type checking.

An isolated transpile trial added fallback `typeof Model !== undefined ? Model : Object` metadata branches, raising coverage branch total from 2831 to 3591 and reducing coverage to 73.21%. Compiler output comparison isolates the generated fallback branches; full program compilation emits the resolved Model directly. The final configuration restores baseline coverage exactly, with no coverage exclusions, deprecation suppressions, artificial fallback classes or changed floors. The temporary explicit esModuleInterop:false setting passed Jest but failed standalone tsc with TS5107; final true passes standalone compilation and matches supported NodeNext interop.
