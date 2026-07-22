import { ConfigService } from '@nestjs/config';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { AuthIdentifierRepairService } from '../src/auth/auth-identifier-repair.service';
import {
  AuthIdentifierOperationDocument,
  AuthIdentifierOperationModelName,
  AuthIdentifierOperationSchema,
  AuthIdentifierOperationStatus,
} from '../src/auth/schemas/auth-identifier-operation.schema';
import {
  AuthIdentifierRepairBatchDocument,
  AuthIdentifierRepairBatchModelName,
  AuthIdentifierRepairBatchSchema,
} from '../src/auth/schemas/auth-identifier-repair-batch.schema';
import {
  AuthIdentifierConflictResolutionStatus,
  AuthIdentifierDocument,
  AuthIdentifierModelName,
  AuthIdentifierSchema,
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
  AuthIdentifierType,
} from '../src/auth/schemas/auth-identifier.schema';
import {
  SecurityActivityEventDocument,
  SecurityActivityEventModelName,
  SecurityActivityEventSchema,
} from '../src/auth/schemas/security-activity-event.schema';
import { SecurityActivityService } from '../src/auth/security-activity.service';
import {
  MemberDocument,
  MemberModelName,
  MemberSchema,
} from '../src/members/schemas/member.schema';
import {
  StaffUserDocument,
  StaffUserModelName,
  StaffUserSchema,
} from '../src/staff-users/schemas/staff-user.schema';
import {
  MemberAuthStatus,
  MemberStatus,
  StaffRole,
  StaffUserStatus,
} from '../src/common/enums/library-status.enum';

describe('offline identifier repair integration (e2e)', () => {
  jest.setTimeout(120_000);

  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let operations: Model<AuthIdentifierOperationDocument>;
  let batches: Model<AuthIdentifierRepairBatchDocument>;
  let identifiers: Model<AuthIdentifierDocument>;
  let staffUsers: Model<StaffUserDocument>;
  let members: Model<MemberDocument>;
  let events: Model<SecurityActivityEventDocument>;
  let keyAvailable: boolean;
  const key = Buffer.alloc(32, 11).toString('base64url');

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    connection = await mongoose
      .createConnection(replSet.getUri(), { autoIndex: false })
      .asPromise();
    operations = connection.model(
      AuthIdentifierOperationModelName,
      AuthIdentifierOperationSchema,
    );
    batches = connection.model(
      AuthIdentifierRepairBatchModelName,
      AuthIdentifierRepairBatchSchema,
    );
    identifiers = connection.model(AuthIdentifierModelName, AuthIdentifierSchema);
    staffUsers = connection.model(StaffUserModelName, StaffUserSchema);
    members = connection.model(MemberModelName, MemberSchema);
    events = connection.model(
      SecurityActivityEventModelName,
      SecurityActivityEventSchema,
    );
    await Promise.all([
      operations.createCollection(),
      batches.createCollection(),
      identifiers.createCollection(),
      staffUsers.createCollection(),
      members.createCollection(),
      events.createCollection(),
    ]);
    await Promise.all([
      operations.createIndexes(),
      batches.createIndexes(),
      identifiers.createIndexes(),
      events.createIndexes(),
    ]);
  });

  afterAll(async () => {
    await connection.close();
    await replSet.stop();
  });

  beforeEach(async () => {
    keyAvailable = true;
    await Promise.all([
      operations.deleteMany({}),
      batches.deleteMany({}),
      identifiers.deleteMany({}),
      staffUsers.deleteMany({}),
      members.deleteMany({}),
      events.deleteMany({}),
    ]);
  });

  function createService() {
    const authorization = {
      authorizeDryRun: jest.fn().mockResolvedValue({ subjectId: 'admin-1' }),
      authorizeMutation: jest.fn().mockResolvedValue({ subjectId: 'admin-2' }),
    };
    const keyPolicy = {
      repairWorkerDecision: jest.fn(() => ({
        allowed: keyAvailable,
        reason: keyAvailable ? 'repair-key-available' : 'repair-key-required',
      })),
      getKeyMaterial: jest.fn(() => (keyAvailable ? key : undefined)),
    };
    const config = {
      get: (path: string) => {
        if (path === 'auth.auditCorrelationKeyVersion') return 1;
        if (path === 'auth.identifierMaxOperationAssignments') return 1;
        return undefined;
      },
    } as ConfigService;
    return new AuthIdentifierRepairService(
      operations,
      batches,
      identifiers,
      staffUsers,
      members,
      authorization as never,
      keyPolicy as never,
      new SecurityActivityService(events),
      config,
    );
  }

  it('repairs an oversized conflict in bounded transactions, preserves credentials, and replays once', async () => {
    const passwordHashes = ['staff-password-hash', 'member-one-hash', 'member-two-hash'];
    const staff = await staffUsers.create({
      email: 'shared@example.test',
      displayName: 'Staff Claimant',
      passwordHash: passwordHashes[0],
      roles: [StaffRole.Staff],
      status: StaffUserStatus.Active,
      authVersion: 0,
    });
    const membershipTypeId = new Types.ObjectId();
    const memberOne = await members.create({
      memberNumber: 'M-1001',
      fullName: 'Member One',
      membershipTypeId,
      status: MemberStatus.Active,
      activeLoanCount: 0,
      loginIdentifier: 'shared@example.test',
      passwordHash: passwordHashes[1],
      authStatus: MemberAuthStatus.Active,
      authVersion: 0,
    });
    const memberTwo = await members.create({
      memberNumber: 'M-1002',
      fullName: 'Member Two',
      membershipTypeId,
      status: MemberStatus.Active,
      activeLoanCount: 0,
      loginIdentifier: 'shared@example.test',
      passwordHash: passwordHashes[2],
      authStatus: MemberAuthStatus.Active,
      authVersion: 0,
    });
    const conflict = await identifiers.create({
      normalizedIdentifier: 'shared@example.test',
      identifierType: AuthIdentifierType.Email,
      status: AuthIdentifierStatus.Conflict,
      conflictResolutionStatus:
        AuthIdentifierConflictResolutionStatus.ManualRepairRequired,
      conflictingSubjects: [
        { subjectType: AuthIdentifierSubjectType.Staff, subjectId: staff.id },
        { subjectType: AuthIdentifierSubjectType.Member, subjectId: memberOne.id },
        { subjectType: AuthIdentifierSubjectType.Member, subjectId: memberTwo.id },
      ],
      createdBy: 'migration',
      updatedBy: 'migration',
    });
    const manifest = {
      conflictId: conflict.id,
      retainedSubject: {
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId: staff.id,
      },
      reassignments: [
        {
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: memberOne.id,
          newIdentifier: 'member.one@example.test',
        },
        {
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: memberTwo.id,
          newIdentifier: 'member.two@example.test',
        },
      ],
    };

    keyAvailable = false;
    await expect(
      createService().dryRun({
        token: 'stdin-token',
        operationId: 'offline-repair-1',
        manifest,
      }),
    ).rejects.toThrow('repair-key-required');
    await expect(operations.countDocuments({})).resolves.toBe(0);
    await expect(members.findById(memberOne.id).lean()).resolves.toMatchObject({
      loginIdentifier: 'shared@example.test',
      authVersion: 0,
    });

    keyAvailable = true;
    const service = createService();
    await expect(
      service.dryRun({
        token: 'stdin-token',
        operationId: 'offline-repair-1',
        manifest,
      }),
    ).resolves.toMatchObject({
      status: AuthIdentifierOperationStatus.Pending,
      batchCount: 2,
    });
    await expect(
      service.apply({
        token: 'stdin-token',
        operationId: 'offline-repair-1',
        resumeId: 'resume-1',
        manifest,
      }),
    ).resolves.toMatchObject({
      status: AuthIdentifierOperationStatus.Completed,
      batchCount: 2,
      replayed: false,
    });

    await expect(batches.countDocuments({ parentOperationId: 'offline-repair-1' })).resolves.toBe(2);
    await expect(identifiers.findById(conflict.id).lean()).resolves.toMatchObject({
      status: AuthIdentifierStatus.Active,
      subjectType: AuthIdentifierSubjectType.Staff,
      subjectId: staff.id,
    });
    await expect(members.findById(memberOne.id).lean()).resolves.toMatchObject({
      loginIdentifier: 'member.one@example.test',
      authVersion: 1,
    });
    await expect(members.findById(memberTwo.id).lean()).resolves.toMatchObject({
      loginIdentifier: 'member.two@example.test',
      authVersion: 1,
    });
    const credentialDocuments = await Promise.all([
      staffUsers.findById(staff.id).select('+passwordHash').lean(),
      members.findById(memberOne.id).select('+passwordHash').lean(),
      members.findById(memberTwo.id).select('+passwordHash').lean(),
    ]);
    expect(credentialDocuments.map((document) => document?.passwordHash)).toEqual(
      passwordHashes,
    );
    await expect(
      events.countDocuments({
        eventId: 'auth-identifier-operation:offline-repair-1:completed',
      }),
    ).resolves.toBe(1);

    await expect(
      createService().apply({
        token: 'stdin-token',
        operationId: 'offline-repair-1',
        resumeId: 'resume-after-restart',
        manifest,
      }),
    ).resolves.toMatchObject({
      status: AuthIdentifierOperationStatus.Completed,
      replayed: true,
    });
    await expect(
      events.countDocuments({
        eventId: 'auth-identifier-operation:offline-repair-1:completed',
      }),
    ).resolves.toBe(1);
    expect(JSON.stringify(await operations.findOne({ operationId: 'offline-repair-1' }).lean()))
      .not.toContain('member.one@example.test');
  });
});
