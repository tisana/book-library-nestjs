import { Types } from 'mongoose';
import {
  AuthIdentifierDocument,
  AuthIdentifierSubjectType,
} from '../../src/auth/schemas/auth-identifier.schema';
import {
  AuthIdentifierOperationCleanupStatus,
  AuthIdentifierOperationDocument,
  AuthIdentifierOperationStatus,
  AuthIdentifierOperationType,
} from '../../src/auth/schemas/auth-identifier-operation.schema';
import {
  AuthSubjectType,
  RefreshTokenFamilyDocument,
  RefreshTokenFamilyStatus,
} from '../../src/auth/schemas/refresh-token-family.schema';
import {
  RefreshTokenReplayMarkerDocument,
  RefreshTokenReplayMarkerStatus,
} from '../../src/auth/schemas/refresh-token-replay-marker.schema';
import { BorrowingDocument } from '../../src/borrowings/schemas/borrowing.schema';
import {
  LoanState,
  MemberAuthStatus,
  MemberStatus,
} from '../../src/common/enums/library-status.enum';
import { MemberDocument } from '../../src/members/schemas/member.schema';
import { StaffUserDocument } from '../../src/staff-users/schemas/staff-user.schema';
import {
  createIdentifierModelHarness,
  createStaffDocument,
  createStaffModelHarness,
  IdentifierQueryDouble,
  queryResult,
} from './backend-coverage-fixtures';

export function createRefreshFamily(
  overrides: Partial<RefreshTokenFamilyDocument> = {},
): RefreshTokenFamilyDocument {
  return {
    _id: new Types.ObjectId('507f1f77bcf86cd799439020'),
    familyId: 'refresh-family-001',
    clientId: 'web',
    subjectType: AuthSubjectType.Staff,
    subjectId: 'staff-user-id',
    scopes: ['catalog:read'],
    authVersion: 0,
    status: RefreshTokenFamilyStatus.Active,
    currentTokenHash: 'a'.repeat(64),
    issuedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastRotatedAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-31T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as RefreshTokenFamilyDocument;
}

export function createReplayMarker(
  overrides: Partial<RefreshTokenReplayMarkerDocument> = {},
): RefreshTokenReplayMarkerDocument {
  return {
    _id: new Types.ObjectId('507f1f77bcf86cd799439021'),
    tokenHash: 'b'.repeat(64),
    familyId: 'refresh-family-001',
    status: RefreshTokenReplayMarkerStatus.Pending,
    rotationOperationId: 'rotation-operation-001',
    leaseExpiresAt: new Date('2026-01-01T00:00:30.000Z'),
    expiresAt: new Date('2026-01-31T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as RefreshTokenReplayMarkerDocument;
}

export function createIdentifierOperation(
  overrides: Partial<AuthIdentifierOperationDocument> = {},
): AuthIdentifierOperationDocument {
  return {
    _id: new Types.ObjectId('507f1f77bcf86cd799439022'),
    operationId: 'identifier-operation-001',
    operationType: AuthIdentifierOperationType.Claim,
    status: AuthIdentifierOperationStatus.Pending,
    assignments: [],
    cleanupStatus: AuthIdentifierOperationCleanupStatus.NotRequired,
    requestedBy: {
      subjectType: AuthIdentifierSubjectType.Staff,
      subjectId: 'admin-user-id',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as AuthIdentifierOperationDocument;
}

export function createMemberDocument(
  overrides: Partial<MemberDocument> = {},
): MemberDocument {
  const objectId = new Types.ObjectId('507f1f77bcf86cd799439023');
  const document = {
    _id: objectId,
    id: objectId.toString(),
    memberNumber: 'MEM-0001',
    fullName: 'Library Member',
    email: 'member@example.test',
    phone: '+15550000001',
    membershipTypeId: new Types.ObjectId('507f1f77bcf86cd799439024'),
    status: MemberStatus.Active,
    activeLoanCount: 0,
    loginIdentifier: 'member@example.test',
    passwordHash: 'stored-password-hash',
    authStatus: MemberAuthStatus.Active,
    authVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn(),
    ...overrides,
  } as unknown as MemberDocument;
  if (!overrides.save) {
    document.save = jest.fn().mockResolvedValue(document);
  }
  return document;
}

export function createBorrowingDocument(
  overrides: Partial<BorrowingDocument> = {},
): BorrowingDocument {
  const objectId = new Types.ObjectId('507f1f77bcf86cd799439025');
  const document = {
    _id: objectId,
    id: objectId.toString(),
    memberId: new Types.ObjectId('507f1f77bcf86cd799439026'),
    bookId: new Types.ObjectId('507f1f77bcf86cd799439027'),
    bookCategoryId: new Types.ObjectId('507f1f77bcf86cd799439028'),
    borrowedAt: new Date('2026-01-01T00:00:00.000Z'),
    dueAt: new Date('2026-01-15T00:00:00.000Z'),
    status: LoanState.Active,
    borrowedByStaffId: 'staff-user-id',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn(),
    ...overrides,
  } as unknown as BorrowingDocument;
  if (!overrides.save) {
    document.save = jest.fn().mockResolvedValue(document);
  }
  return document;
}

export interface CriticalQueryDouble<T> extends IdentifierQueryDouble<T> {
  lean(): CriticalQueryDouble<T>;
  sort(value: unknown): CriticalQueryDouble<T>;
  limit(value: number): CriticalQueryDouble<T>;
}

export function criticalQueryResult<T>(
  value: T,
  capture?: { sort?: unknown; limit?: number },
): CriticalQueryDouble<T> {
  const query = queryResult(value) as CriticalQueryDouble<T>;
  query.lean = jest.fn(() => query);
  query.sort = jest.fn((sort: unknown) => {
    if (capture) capture.sort = sort;
    return query;
  });
  query.limit = jest.fn((limit: number) => {
    if (capture) capture.limit = limit;
    return query;
  });
  return query;
}

export function createCriticalModelHarnesses(options: {
  staffDocument?: StaffUserDocument;
  identifier?: AuthIdentifierDocument | null;
} = {}): {
  staff: ReturnType<typeof createStaffModelHarness>;
  identifier: ReturnType<typeof createIdentifierModelHarness>;
} {
  const staffDocument = options.staffDocument ?? createStaffDocument();
  return {
    staff: createStaffModelHarness({ document: staffDocument }),
    identifier: createIdentifierModelHarness({
      findOneResult: options.identifier ?? null,
    }),
  };
}
