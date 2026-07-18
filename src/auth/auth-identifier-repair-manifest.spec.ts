import {
  canonicalizeRepairManifest,
  deriveRepairManifestKey,
  hashRepairManifest,
  verifyRepairManifest,
} from './auth-identifier-repair-manifest';
import { AuthIdentifierSubjectType } from './schemas/auth-identifier.schema';

const vectorManifest = {
  conflictId: 'conflict-001',
  retainedSubject: {
    subjectType: AuthIdentifierSubjectType.Staff,
    subjectId: 'staff-001',
  },
  reassignments: [
    {
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-001',
      newIdentifier: 'member.new@example.com',
    },
  ],
};
const vectorKey = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';

describe('auth identifier repair manifest', () => {
  it('matches the published canonical JSON, HKDF key, and manifest HMAC', () => {
    expect(canonicalizeRepairManifest(vectorManifest)).toBe(
      '{"conflictId":"conflict-001","reassignments":[{"newIdentifier":"member.new@example.com","subjectId":"member-001","subjectType":"member"}],"retainedSubject":{"subjectId":"staff-001","subjectType":"staff"}}',
    );
    expect(deriveRepairManifestKey(vectorKey, 7).toString('base64url')).toBe(
      'mWdLVTX6hitMZ4E7rjsVHqUliKHvF1nNhlt1uNYGOn4',
    );
    expect(hashRepairManifest(vectorManifest, vectorKey, 7).manifestHash).toBe(
      'Zdp_WIBI_lfYpBPJhebXfWQxwyvuOqsiX4EJOF72fok',
    );
  });

  it('normalizes identifiers and sorts reassignments deterministically', () => {
    const reordered = {
      ...vectorManifest,
      reassignments: [
        {
          subjectType: AuthIdentifierSubjectType.Staff,
          subjectId: 'staff-002',
          newIdentifier: ' STAFF.NEW@EXAMPLE.COM ',
        },
        ...vectorManifest.reassignments,
      ],
    };
    const canonical = canonicalizeRepairManifest(reordered);
    expect(canonical.indexOf('member-001')).toBeLessThan(
      canonical.indexOf('staff-002'),
    );
    expect(canonical).toContain('staff.new@example.com');
  });

  it('uses the persisted current or previous key and fails closed on changes', () => {
    const current = hashRepairManifest(vectorManifest, vectorKey, 7);
    expect(
      verifyRepairManifest(vectorManifest, current.manifestHash, vectorKey, 7),
    ).toBe(true);
    expect(
      verifyRepairManifest(
        {
          ...vectorManifest,
          conflictId: 'conflict-002',
        },
        current.manifestHash,
        vectorKey,
        7,
      ),
    ).toBe(false);
    expect(
      verifyRepairManifest(
        vectorManifest,
        current.manifestHash,
        Buffer.alloc(32, 9),
        6,
      ),
    ).toBe(false);
  });
});
