import {
  evaluateChangedLineCoverage,
  filterChangedLines,
  parseChangedLines,
  parseLcov,
} from '../../scripts/quality/changed-line-coverage';

describe('changed-line coverage', () => {
  it('parses only added lines from renamed files and normalizes repository paths', () => {
    const changed =
      parseChangedLines(`diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 78%
rename from src/old-name.ts
rename to src/new-name.ts
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -8,2 +8,3 @@ export function example() {
-  removed();
+  covered();
+  uncovered();
   retained();
diff --git a/frontend/src/view.tsx b/frontend/src/view.tsx
--- a/frontend/src/view.tsx
+++ b/frontend/src/view.tsx
@@ -1 +1,2 @@
+export const View = () => null;
 export {};
`);

    expect(changed).toEqual(
      new Map([
        ['src/new-name.ts', new Set([8, 9])],
        ['frontend/src/view.tsx', new Set([1])],
      ]),
    );
  });

  it('counts an added source line beginning with +++ without mistaking it for a file header', () => {
    const changed =
      parseChangedLines(`diff --git a/src/counter.ts b/src/counter.ts
--- a/src/counter.ts
+++ b/src/counter.ts
@@ -1,0 +1,2 @@
+++ +counter;
+export const next = counter;
diff --git a/src/next.ts b/src/next.ts
--- a/src/next.ts
+++ b/src/next.ts
@@ -3 +3,2 @@
+export const later = true;
 export {};
`);

    expect(changed).toEqual(
      new Map([
        ['src/counter.ts', new Set([1, 2])],
        ['src/next.ts', new Set([3])],
      ]),
    );
  });

  it('decodes quoted Git file headers before normalizing paths', () => {
    const changed =
      parseChangedLines(`diff --git "a/src/space name.ts" "b/src/space name.ts"
--- "a/src/space name.ts"
+++ "b/src/space name.ts"
@@ -4 +4,2 @@
+export const space = true;
 export {};
diff --git "a/src/quote\\\"slash\\\\tab\\t.ts" "b/src/quote\\\"slash\\\\tab\\t.ts"
--- "a/src/quote\\\"slash\\\\tab\\t.ts"
+++ "b/src/quote\\\"slash\\\\tab\\t.ts"
@@ -1 +1,2 @@
+export const escaped = true;
 export {};
`);

    expect(changed).toEqual(
      new Map([
        ['src/space name.ts', new Set([4])],
        ['src/quote"slash/tab\t.ts', new Set([1])],
      ]),
    );
  });

  it('decodes adjacent octal UTF-8 bytes and matches the LCOV path exactly', () => {
    const changed =
      parseChangedLines(`diff --git "a/src/caf\\303\\251-\\303\\261.ts" "b/src/caf\\303\\251-\\303\\261.ts"
--- "a/src/caf\\303\\251-\\303\\261.ts"
+++ "b/src/caf\\303\\251-\\303\\261.ts"
@@ -6 +6,2 @@
+export const café = 'mañana';
 export {};
`);
    const lcov = parseLcov('SF:src/café-ñ.ts\nDA:6,1\nend_of_record\n');

    expect(changed).toEqual(new Map([['src/café-ñ.ts', new Set([6])]]));
    expect(evaluateChangedLineCoverage(changed, lcov)).toMatchObject({
      passed: true,
      covered: 1,
      total: 1,
    });
  });

  it.each([
    ['truncated octal escape', '"b/src/caf\\30.ts"'],
    ['invalid UTF-8 bytes', '"b/src/caf\\303\\050.ts"'],
  ])('rejects a quoted Git path with %s', (_case, path) => {
    expect(() =>
      parseChangedLines(`diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ ${path}
@@ -1,0 +1,1 @@
+export const example = true;
`),
    ).toThrow('invalid-git-path');
  });

  it('parses LCOV line hits using normalized case-preserving paths', () => {
    expect(
      parseLcov(`TN:
SF:C:\\repo\\src\\Example.ts
DA:10,1
DA:11,0
end_of_record
`),
    ).toEqual(
      new Map([
        [
          'src/Example.ts',
          new Map([
            [10, 1],
            [11, 0],
          ]),
        ],
      ]),
    );
  });

  it('normalizes absolute backend and frontend LCOV paths only within their producer scope', () => {
    expect(
      parseLcov(
        'SF:E:\\repo\\.worktrees\\feature\\src\\Backend.ts\nDA:7,1\nend_of_record\n',
        'backend',
      ),
    ).toEqual(new Map([['src/Backend.ts', new Map([[7, 1]])]]));
    expect(
      parseLcov(
        'SF:E:\\repo\\.worktrees\\feature\\frontend\\src\\View.tsx\nDA:9,1\nend_of_record\n',
        'frontend',
      ),
    ).toEqual(new Map([['frontend/src/View.tsx', new Map([[9, 1]])]]));
  });

  it('passes at the inclusive changed-line threshold', () => {
    expect(
      evaluateChangedLineCoverage(
        new Map([['src/example.ts', new Set([10, 11, 12, 13, 14])]]),
        new Map([
          [
            'src/example.ts',
            new Map([
              [10, 1],
              [11, 1],
              [12, 1],
              [13, 1],
              [14, 0],
            ]),
          ],
        ]),
        80,
      ),
    ).toMatchObject({ passed: true, pct: 80, covered: 4, total: 5 });
  });

  it('ignores changed non-executable lines in a represented LCOV file', () => {
    expect(
      evaluateChangedLineCoverage(
        new Map([['src/example.ts', new Set([10, 11])]]),
        new Map([['src/example.ts', new Map([[10, 1]])]]),
      ),
    ).toMatchObject({ passed: true, pct: 100, covered: 1, total: 1 });
  });

  it('fails closed when a changed production file is absent from LCOV', () => {
    expect(
      evaluateChangedLineCoverage(
        new Map([['src/missing.ts', new Set([10, 11])]]),
        new Map([['src/example.ts', new Map([[10, 1]])]]),
      ),
    ).toMatchObject({
      passed: false,
      pct: 0,
      covered: 0,
      total: 2,
      missingFiles: ['src/missing.ts'],
    });
  });

  it('reports an unaffected scope as not applicable', () => {
    expect(evaluateChangedLineCoverage(new Map(), new Map())).toMatchObject({
      passed: true,
      status: 'not-applicable',
      total: 0,
    });
  });

  it('keeps backend and frontend changed-line gates independent', () => {
    const changed = new Map([
      ['src/service.ts', new Set([4])],
      ['frontend/src/view.tsx', new Set([7])],
    ]);
    const lcov = new Map([
      ['src/service.ts', new Map([[4, 1]])],
      ['frontend/src/view.tsx', new Map([[7, 0]])],
    ]);

    expect(
      evaluateChangedLineCoverage(filterChangedLines(changed, 'backend'), lcov),
    ).toMatchObject({ passed: true, total: 1, covered: 1 });
    expect(
      evaluateChangedLineCoverage(
        filterChangedLines(changed, 'frontend'),
        lcov,
      ),
    ).toMatchObject({ passed: false, total: 1, covered: 0 });
  });

  it('mirrors backend and frontend coverage eligibility for a whole-repository diff', () => {
    const changed =
      parseChangedLines(`diff --git a/src/service.ts b/src/service.ts
--- a/src/service.ts
+++ b/src/service.ts
@@ -10,0 +10,5 @@
+export const one = 1;
+export const two = 2;
+export const three = 3;
+export const four = 4;
+export const five = 5;
diff --git a/src/service.spec.ts b/src/service.spec.ts
--- a/src/service.spec.ts
+++ b/src/service.spec.ts
@@ -1,0 +1,1 @@
+it('is excluded', () => undefined);
diff --git a/src/books/interfaces/book.interface.ts b/src/books/interfaces/book.interface.ts
--- a/src/books/interfaces/book.interface.ts
+++ b/src/books/interfaces/book.interface.ts
@@ -1,0 +1,1 @@
+export interface Book {}
diff --git a/frontend/src/view.tsx b/frontend/src/view.tsx
--- a/frontend/src/view.tsx
+++ b/frontend/src/view.tsx
@@ -20,0 +20,5 @@
+export const One = 1;
+export const Two = 2;
+export const Three = 3;
+export const Four = 4;
+export const Five = 5;
diff --git a/frontend/src/view.test.tsx b/frontend/src/view.test.tsx
--- a/frontend/src/view.test.tsx
+++ b/frontend/src/view.test.tsx
@@ -1,0 +1,1 @@
+it('is excluded', () => undefined);
diff --git a/frontend/src/test/setup.ts b/frontend/src/test/setup.ts
--- a/frontend/src/test/setup.ts
+++ b/frontend/src/test/setup.ts
@@ -1,0 +1,1 @@
+export const setup = true;
diff --git a/frontend/src/main.tsx b/frontend/src/main.tsx
--- a/frontend/src/main.tsx
+++ b/frontend/src/main.tsx
@@ -1,0 +1,1 @@
+export const bootstrap = true;
diff --git a/frontend/src/schema.d.ts b/frontend/src/schema.d.ts
--- a/frontend/src/schema.d.ts
+++ b/frontend/src/schema.d.ts
@@ -1,0 +1,1 @@
+export type Schema = string;
diff --git a/frontend/src/__generated__/routes.ts b/frontend/src/__generated__/routes.ts
--- a/frontend/src/__generated__/routes.ts
+++ b/frontend/src/__generated__/routes.ts
@@ -1,0 +1,1 @@
+export const generated = true;
diff --git a/frontend/src/styles.css b/frontend/src/styles.css
--- a/frontend/src/styles.css
+++ b/frontend/src/styles.css
@@ -1,0 +1,1 @@
+.root { display: block; }
`);
    const backend = evaluateChangedLineCoverage(
      filterChangedLines(changed, 'backend'),
      parseLcov(
        'SF:src/service.ts\nDA:10,1\nDA:11,1\nDA:12,1\nDA:13,1\nDA:14,0\nend_of_record\n',
      ),
    );
    const frontend = evaluateChangedLineCoverage(
      filterChangedLines(changed, 'frontend'),
      parseLcov(
        'SF:src\\view.tsx\nDA:20,1\nDA:21,1\nDA:22,1\nDA:23,1\nDA:24,0\nend_of_record\n',
        'frontend',
      ),
    );

    expect(backend).toMatchObject({
      status: 'passed',
      passed: true,
      pct: 80,
      covered: 4,
      total: 5,
      missingFiles: [],
    });
    expect(frontend).toMatchObject({
      status: 'passed',
      passed: true,
      pct: 80,
      covered: 4,
      total: 5,
      missingFiles: [],
    });
  });

  it('reports both scopes not applicable when a repository diff changes only excluded files', () => {
    const changed = new Map([
      ['src/service.spec.ts', new Set([1])],
      ['frontend/src/view.test.tsx', new Set([1])],
    ]);

    expect(
      evaluateChangedLineCoverage(
        filterChangedLines(changed, 'backend'),
        new Map(),
      ),
    ).toMatchObject({ status: 'not-applicable', passed: true, total: 0 });
    expect(
      evaluateChangedLineCoverage(
        filterChangedLines(changed, 'frontend'),
        new Map(),
      ),
    ).toMatchObject({ status: 'not-applicable', passed: true, total: 0 });
  });

  it('keeps nested non-root source paths outside both repository coverage scopes', () => {
    const changed =
      parseChangedLines(`diff --git a/docs/src/example.ts b/docs/src/example.ts
--- a/docs/src/example.ts
+++ b/docs/src/example.ts
@@ -1,0 +1,1 @@
+export const docsExample = true;
diff --git a/examples/frontend/src/example.tsx b/examples/frontend/src/example.tsx
--- a/examples/frontend/src/example.tsx
+++ b/examples/frontend/src/example.tsx
@@ -1,0 +1,1 @@
+export const Example = () => null;
diff --git "a/docs/src/caf\\303\\251.ts" "b/docs/src/caf\\303\\251.ts"
--- "a/docs/src/caf\\303\\251.ts"
+++ "b/docs/src/caf\\303\\251.ts"
@@ -2,0 +2,1 @@
+export const café = true;
`);

    expect(changed).toEqual(
      new Map([
        ['docs/src/example.ts', new Set([1])],
        ['examples/frontend/src/example.tsx', new Set([1])],
        ['docs/src/café.ts', new Set([2])],
      ]),
    );
    expect(
      evaluateChangedLineCoverage(
        filterChangedLines(changed, 'backend'),
        new Map(),
      ),
    ).toMatchObject({ status: 'not-applicable', passed: true, total: 0 });
    expect(
      evaluateChangedLineCoverage(
        filterChangedLines(changed, 'frontend'),
        new Map(),
      ),
    ).toMatchObject({ status: 'not-applicable', passed: true, total: 0 });
  });
});
