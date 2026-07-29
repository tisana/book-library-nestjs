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
