import {
  evaluateChangedLineCoverage,
  filterChangedLines,
  parseChangedLines,
  parseLcov,
} from '../../scripts/quality/changed-line-coverage';

describe('changed-line coverage', () => {
  it('parses only added lines from renamed files and normalizes repository paths', () => {
    const changed = parseChangedLines(`diff --git a/src/old-name.ts b/src/new-name.ts
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
    const changed = parseChangedLines(`diff --git a/src/counter.ts b/src/counter.ts
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
    const changed = parseChangedLines(`diff --git "a/src/space name.ts" "b/src/space name.ts"
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
        ['src/quote"slash\\tab\t.ts', new Set([1])],
      ]),
    );
  });

  it('decodes adjacent octal UTF-8 bytes and matches the LCOV path exactly', () => {
    const changed = parseChangedLines(`diff --git "a/src/caf\\303\\251-\\303\\261.ts" "b/src/caf\\303\\251-\\303\\261.ts"
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
        ['src/Example.ts', new Map([[10, 1], [11, 0]])],
      ]),
    );
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
      evaluateChangedLineCoverage(filterChangedLines(changed, 'frontend'), lcov),
    ).toMatchObject({ passed: false, total: 1, covered: 0 });
  });
});
