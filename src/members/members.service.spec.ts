import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import {
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
  AuthIdentifierType,
} from '../auth/schemas/auth-identifier.schema';
import {
  AuthSubjectType,
  RefreshTokenFamilyStatus,
} from '../auth/schemas/refresh-token-family.schema';
import {
  SecurityActivityActorType,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from '../auth/schemas/security-activity-event.schema';
import {
  LibraryItemStatus,
  MemberAuthStatus,
  MemberStatus,
  StaffRole,
} from '../common/enums/library-status.enum';
import { MembershipTypesService } from '../membership-types/membership-types.service';
import { MembersService } from './members.service';
import { MemberDocument } from './schemas/member.schema';
import { queryResult } from '../../test/support/backend-coverage-fixtures';
import { createMemberDocument as createSharedMemberDocument } from '../../test/support/critical-auth-fixtures';

describe('MembersService', () => {
  const validMemberId = '665f4d3b8f4c8a001f5f0a12';
  const actor = {
    id: 'staff-user-id',
    email: 'staff@example.com',
    roles: [StaffRole.Staff],
  };

  const activeMembershipType = {
    id: '64f000000000000000000001',
    code: 'STANDARD',
    name: 'Standard Member',
    maxActiveLoans: 3,
    status: LibraryItemStatus.Active,
  };

  type MockMemberModel = jest.Mock & {
    exists?: jest.Mock;
    find?: jest.Mock;
    findOne?: jest.Mock;
    updateOne?: jest.Mock;
  };

  type MockMemberDocument = Omit<Partial<MemberDocument>, 'save'> & {
    save: jest.Mock;
  };

  function asModel(model: MockMemberModel): Model<MemberDocument> {
    return model as unknown as Model<MemberDocument>;
  }

  function createMemberDocument(
    overrides: Partial<MockMemberDocument> = {},
  ): MockMemberDocument {
    return {
      _id: { toString: () => 'member-id' } as MemberDocument['_id'],
      id: 'member-id',
      memberNumber: 'MEM-0001',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123456789',
      membershipTypeId: '64f000000000000000000001',
      status: MemberStatus.Active,
      activeLoanCount: 1,
      save: jest.fn(),
      ...overrides,
    };
  }

  function createMembershipTypesService(
    overrides: Partial<MembershipTypesService> = {},
  ): MembershipTypesService {
    return {
      findOne: jest.fn().mockResolvedValue(activeMembershipType),
      validateActivePolicy: jest.fn().mockResolvedValue(activeMembershipType),
      ...overrides,
    } as unknown as MembershipTypesService;
  }

  function createServiceWithMember(
    member: MemberDocument,
    overrides?: {
      model?: MockMemberModel;
      membershipTypesService?: MembershipTypesService;
      identifierModel?: ReturnType<typeof createIdentifierModel>;
      refreshTokenFamilyModel?: { updateMany: jest.Mock };
      securityActivityService?: { record: jest.Mock };
      installExists?: boolean;
    },
  ): MembersService {
    const model = overrides?.model ?? (jest.fn() as MockMemberModel);
    model.findOne ??= jest.fn().mockReturnValue(queryResult(member));
    if (overrides?.installExists !== false) {
      model.exists ??= jest.fn().mockResolvedValue(null);
    }

    return new MembersService(
      asModel(model),
      overrides?.membershipTypesService ?? createMembershipTypesService(),
      overrides?.identifierModel as never,
      overrides?.refreshTokenFamilyModel as never,
      overrides?.securityActivityService as never,
    );
  }

  it('creates active members with normalized member number, active policy validation, and audit actor', async () => {
    const createdDocuments: any[] = [];
    const model: MockMemberModel = jest.fn().mockImplementation((document) => {
      createdDocuments.push(document);

      return {
        save: jest.fn().mockResolvedValue(createMemberDocument(document)),
      };
    });
    model.exists = jest.fn().mockResolvedValue(null);
    const membershipTypesService = createMembershipTypesService();
    const service = new MembersService(asModel(model), membershipTypesService);

    const result = await service.create(
      {
        memberNumber: ' mem-0001 ',
        fullName: 'Ada Lovelace',
        email: 'ADA@EXAMPLE.COM',
        phone: '123456789',
        membershipTypeId: '64f000000000000000000001',
      },
      actor,
    );

    expect(membershipTypesService.validateActivePolicy).toHaveBeenCalledWith(
      '64f000000000000000000001',
    );
    expect(model.exists).toHaveBeenCalledWith({
      memberNumber: { $eq: 'MEM-0001' },
    });
    expect(createdDocuments[0]).toMatchObject({
      memberNumber: 'MEM-0001',
      email: 'ada@example.com',
      membershipTypeId: '64f000000000000000000001',
      status: MemberStatus.Active,
      activeLoanCount: 0,
      createdBy: 'staff-user-id',
      updatedBy: 'staff-user-id',
    });
    expect(result).toMatchObject({
      id: 'member-id',
      memberNumber: 'MEM-0001',
      status: MemberStatus.Active,
      activeLoanCount: 0,
    });
  });

  it('rejects duplicate member numbers before persisting', async () => {
    const model: MockMemberModel = jest.fn();
    model.exists = jest.fn().mockResolvedValue({ _id: 'existing-id' });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(
      service.create({
        memberNumber: 'mem-0001',
        fullName: 'Ada Lovelace',
        membershipTypeId: '64f000000000000000000001',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(model.exists).toHaveBeenCalledWith({
      memberNumber: { $eq: 'MEM-0001' },
    });
    expect(model).not.toHaveBeenCalled();
  });

  it('lists members filtered by search, status, and membership type with pagination', async () => {
    const exec = jest.fn().mockResolvedValue([createMemberDocument()]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const find = jest.fn().mockReturnValue({ sort });
    const model: MockMemberModel = jest.fn();
    model.find = find;
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    const result = await service.findAll({
      q: 'ada',
      status: MemberStatus.Active,
      membershipTypeId: '64f000000000000000000001',
      page: 2,
      limit: 10,
    });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $eq: MemberStatus.Active },
        membershipTypeId: {
          $eq: expect.objectContaining({
            _bsontype: 'ObjectId',
          }),
        },
      }),
    );
    expect(sort).toHaveBeenCalledWith({ memberNumber: 1 });
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(1);
  });

  it('builds literal case-insensitive search filters', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const find = jest.fn().mockReturnValue({ sort });
    const model: MockMemberModel = jest.fn();
    model.find = find;
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await service.findAll({
      q: 'Ada.*',
      page: 1,
      limit: 20,
    });

    const filter = find.mock.calls[0][0];
    expect(filter.$or[0].memberNumber).toEqual(/Ada\.\*/i);
    expect(filter.$or[1].fullName).toEqual(/Ada\.\*/i);
    expect(filter.$or[2].email).toEqual(/Ada\.\*/i);
  });

  it('returns not found for missing members', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(service.findOne(validMemberId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns self-service profile with readable membership tier metadata', async () => {
    const exec = jest.fn().mockResolvedValue(createMemberDocument());
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const membershipTypesService = createMembershipTypesService();
    const service = new MembersService(asModel(model), membershipTypesService);

    await expect(
      service.findSelfServiceProfile(validMemberId),
    ).resolves.toEqual({
      id: 'member-id',
      memberNumber: 'MEM-0001',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123456789',
      membershipStatus: MemberStatus.Active,
      membershipTypeId: '64f000000000000000000001',
      membershipTypeCode: 'STANDARD',
      membershipTypeName: 'Standard Member',
      activeLoanCount: 1,
    });
    expect(membershipTypesService.findOne).toHaveBeenCalledWith(
      '64f000000000000000000001',
    );
  });

  it('updates status, loan count, membership type, and audit actor', async () => {
    const document = createMemberDocument();
    document.save.mockResolvedValue(document);
    const exec = jest.fn().mockResolvedValue(document);
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const membershipTypesService = createMembershipTypesService();
    const service = new MembersService(asModel(model), membershipTypesService);

    const result = await service.update(
      validMemberId,
      {
        membershipTypeId: '64f000000000000000000002',
        status: MemberStatus.Suspended,
        activeLoanCount: 2,
      },
      actor,
    );

    expect(membershipTypesService.validateActivePolicy).toHaveBeenCalledWith(
      '64f000000000000000000002',
    );
    expect(document.membershipTypeId).toBe('64f000000000000000000002');
    expect(document.status).toBe(MemberStatus.Suspended);
    expect(document.activeLoanCount).toBe(2);
    expect(document.updatedBy).toBe('staff-user-id');
    expect(result).toMatchObject({
      status: MemberStatus.Suspended,
      activeLoanCount: 2,
    });
  });

  it('reports remaining allowance and eligibility for active members below limit', async () => {
    const exec = jest.fn().mockResolvedValue(
      createMemberDocument({
        activeLoanCount: 1,
        status: MemberStatus.Active,
      }),
    );
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(service.getPolicyStatus(validMemberId)).resolves.toEqual({
      memberId: 'member-id',
      status: MemberStatus.Active,
      membershipTypeId: '64f000000000000000000001',
      maxActiveLoans: 3,
      activeLoanCount: 1,
      remainingAllowance: 2,
      eligibleByStatus: true,
      withinLimit: true,
      limitReached: false,
    });
  });

  it('reports limit reached and inactive status eligibility separately', async () => {
    const exec = jest.fn().mockResolvedValue(
      createMemberDocument({
        activeLoanCount: 3,
        status: MemberStatus.Suspended,
      }),
    );
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(service.getPolicyStatus(validMemberId)).resolves.toMatchObject(
      {
        status: MemberStatus.Suspended,
        activeLoanCount: 3,
        remainingAllowance: 0,
        eligibleByStatus: false,
        withinLimit: false,
        limitReached: true,
      },
    );
  });

  it('looks up credentials with normalized login identifiers and the password hash selected', async () => {
    const member = createMemberDocument({
      loginIdentifier: 'ada@example.com',
      passwordHash: 'stored-hash',
      authVersion: 4,
    });
    const exec = jest.fn().mockResolvedValue(member);
    const select = jest.fn().mockReturnValue({ exec });
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ select });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(
      service.findByLoginIdentifierWithPassword(' ADA@EXAMPLE.COM '),
    ).resolves.toBe(member as MemberDocument);

    expect(model.findOne).toHaveBeenCalledWith({
      $or: [
        { loginIdentifier: { $eq: 'ada@example.com' } },
        { memberNumber: { $eq: 'ADA@EXAMPLE.COM' } },
        { email: { $eq: 'ada@example.com' } },
      ],
    });
    expect(select).toHaveBeenCalledWith('+passwordHash');
  });

  it.each([
    [MemberStatus.Suspended, MemberAuthStatus.Active],
    [MemberStatus.Active, MemberAuthStatus.Locked],
  ])(
    'rejects a non-active member status pair (%s, %s) as not found',
    async (status, authStatus) => {
      const exec = jest
        .fn()
        .mockResolvedValue(createMemberDocument({ status, authStatus }));
      const model: MockMemberModel = jest.fn();
      model.findOne = jest.fn().mockReturnValue({ exec });
      const service = new MembersService(
        asModel(model),
        createMembershipTypesService(),
      );

      await expect(
        service.findActiveById(validMemberId),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('returns the active-member not-found contract when the member does not exist', async () => {
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(service.findActiveById(validMemberId)).rejects.toMatchObject({
      message: 'Member not found',
    });
    expect(model.findOne).toHaveBeenCalledWith({
      _id: { $eq: expect.objectContaining({ _bsontype: 'ObjectId' }) },
    });
  });

  it('updates last login atomically without loading the member document', async () => {
    const model: MockMemberModel = jest.fn();
    model.updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await service.touchLastLogin(validMemberId);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: { $eq: expect.objectContaining({ _bsontype: 'ObjectId' }) } },
      { $set: { lastLoginAt: expect.any(Date) } },
    );
  });

  it('sets normalized credentials, increments auth version, and records the actor', async () => {
    const member = createMemberDocument({
      authVersion: 2,
      loginIdentifier: 'old@example.com',
    });
    member.save.mockResolvedValue(member);
    const exec = jest.fn().mockResolvedValue(member);
    const model: MockMemberModel = jest.fn();
    model.exists = jest.fn().mockResolvedValue(null);
    model.findOne = jest.fn().mockReturnValue({ exec });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await service.setMemberCredentials(
      validMemberId,
      ' ADA@EXAMPLE.COM ',
      'plain-text-password',
      actor,
    );

    expect(member.loginIdentifier).toBe('ada@example.com');
    expect(member.passwordHash).not.toBe('plain-text-password');
    await expect(
      bcrypt.compare('plain-text-password', member.passwordHash!),
    ).resolves.toBe(true);
    expect(member.authVersion).toBe(3);
    expect(member.authStatus).toBe(MemberAuthStatus.Active);
    expect(member.updatedBy).toBe('staff-user-id');
    expect(member).not.toHaveProperty('password');
  });

  it('keeps a same-owner active identifier idempotent without a prior member login', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      loginIdentifier: undefined,
      authVersion: 4,
    });
    member.save = jest.fn().mockResolvedValue(member);
    const identifierModel = createIdentifierModel({
      _id: 'identifier-1',
      status: AuthIdentifierStatus.Active,
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-id',
    });
    const service = createServiceWithMember(member, { identifierModel });

    await service.setMemberCredentials(
      validMemberId,
      ' ADA@EXAMPLE.TEST ',
      'replacement-password',
      actor,
    );

    expect(identifierModel.findOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.findOne).toHaveBeenCalledWith({
      normalizedIdentifier: 'ada@example.test',
    });
    expect(identifierModel.create).not.toHaveBeenCalled();
    expect(identifierModel.updateOne).not.toHaveBeenCalled();
    expect(member.authVersion).toBe(5);
  });

  it.each([
    ['another member', AuthIdentifierSubjectType.Member],
    ['staff', AuthIdentifierSubjectType.Staff],
  ])(
    'rejects an active identifier owned by %s',
    async (_owner, subjectType) => {
      const member = createSharedMemberDocument({ id: 'member-id' });
      const identifierModel = createIdentifierModel({
        _id: 'identifier-1',
        status: AuthIdentifierStatus.Active,
        subjectType,
        subjectId: 'foreign-subject-id',
      });
      const service = createServiceWithMember(member, { identifierModel });

      await expect(
        service.setMemberCredentials(
          validMemberId,
          'reserved@example.test',
          'replacement-password',
          actor,
        ),
      ).rejects.toThrow('Sign-in identifier is already reserved');

      expect(identifierModel.findOne).toHaveBeenCalledTimes(1);
      expect(identifierModel.findOne).toHaveBeenCalledWith({
        normalizedIdentifier: 'reserved@example.test',
      });
      expect(member.save).not.toHaveBeenCalled();
      expect(identifierModel.updateOne).not.toHaveBeenCalled();
    },
  );

  it('reactivates a released reservation with member ownership and no release timestamp', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      authVersion: 2,
    });
    const identifierModel = createIdentifierModel({
      _id: 'identifier-1',
      status: AuthIdentifierStatus.Released,
      subjectType: AuthIdentifierSubjectType.Staff,
      subjectId: 'former-owner-id',
      releasedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = createServiceWithMember(member, { identifierModel });

    await service.setMemberCredentials(
      validMemberId,
      'reactivated@example.test',
      'replacement-password',
      actor,
    );

    expect(identifierModel.findOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.findOne).toHaveBeenCalledWith({
      normalizedIdentifier: 'reactivated@example.test',
    });
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      { _id: 'identifier-1', status: AuthIdentifierStatus.Released },
      {
        $set: {
          status: AuthIdentifierStatus.Active,
          identifierType: AuthIdentifierType.LoginIdentifier,
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: 'member-id',
          updatedBy: 'staff-user-id',
        },
        $unset: { releasedAt: '' },
      },
    );
  });

  it('maps an identifier create duplicate-key rejection to the fixed conflict', async () => {
    const member = createSharedMemberDocument({ id: 'member-id' });
    const identifierModel = createIdentifierModel(null);
    identifierModel.create.mockRejectedValue({ code: 11000 });
    const service = createServiceWithMember(member, { identifierModel });

    await expect(
      service.setMemberCredentials(
        validMemberId,
        'new@example.test',
        'replacement-password',
        actor,
      ),
    ).rejects.toThrow('Sign-in identifier is already reserved');

    expect(identifierModel.findOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.findOne).toHaveBeenCalledWith({
      normalizedIdentifier: 'new@example.test',
    });
    expect(member.save).not.toHaveBeenCalled();
  });

  it.each([
    ['nonduplicate coded object', { code: 42, reason: 'write-rejected' }],
    ['nonduplicate object without a code', new Error('write-rejected')],
    ['string primitive', 'write-rejected'],
    ['null primitive', null],
  ])(
    'propagates an identifier create %s rejection unchanged',
    async (_shape, rejection) => {
      const member = createSharedMemberDocument({ id: 'member-id' });
      const identifierModel = createIdentifierModel(null);
      identifierModel.create.mockRejectedValue(rejection);
      const service = createServiceWithMember(member, { identifierModel });

      await expect(
        service.setMemberCredentials(
          validMemberId,
          'new@example.test',
          'replacement-password',
          actor,
        ),
      ).rejects.toBe(rejection);

      expect(identifierModel.findOne).toHaveBeenCalledTimes(1);
      expect(identifierModel.findOne).toHaveBeenCalledWith({
        normalizedIdentifier: 'new@example.test',
      });
      expect(member.save).not.toHaveBeenCalled();
    },
  );

  it('does not release its active reservation when credentials keep the same normalized identifier', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      loginIdentifier: 'ada@example.test',
      authVersion: 1,
    });
    const identifierModel = createIdentifierModel({
      _id: 'identifier-1',
      status: AuthIdentifierStatus.Active,
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-id',
    });
    const service = createServiceWithMember(member, { identifierModel });

    await service.setMemberCredentials(
      validMemberId,
      ' ADA@EXAMPLE.TEST ',
      'replacement-password',
      actor,
    );

    expect(identifierModel.findOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.findOne).toHaveBeenCalledWith({
      normalizedIdentifier: 'ada@example.test',
    });
    expect(member.save).toHaveBeenCalledTimes(1);
    expect(identifierModel.create).not.toHaveBeenCalled();
    expect(identifierModel.updateOne).not.toHaveBeenCalled();
    expect(member.authVersion).toBe(2);
  });

  it('releases only the newly acquired reservation when credential persistence fails', async () => {
    const persistenceError = new Error('member write rejected');
    const member = createSharedMemberDocument({
      id: 'member-id',
      loginIdentifier: 'previous@example.test',
      save: jest.fn().mockRejectedValue(persistenceError),
    });
    const identifierModel = createIdentifierModel(null);
    const service = createServiceWithMember(member, { identifierModel });

    await expect(
      service.setMemberCredentials(
        validMemberId,
        'new@example.test',
        'replacement-password',
        actor,
      ),
    ).rejects.toBe(persistenceError);

    expect(identifierModel.create).toHaveBeenCalledTimes(1);
    expect(identifierModel.updateOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      {
        normalizedIdentifier: 'new@example.test',
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-id',
        status: AuthIdentifierStatus.Active,
      },
      {
        $set: expect.objectContaining({
          status: AuthIdentifierStatus.Released,
          releasedAt: expect.any(Date),
        }),
      },
    );
  });

  it('saves hashed and versioned credentials without the optional identifier model', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      loginIdentifier: 'previous@example.test',
      authVersion: 6,
    });
    const service = createServiceWithMember(member);

    await service.setMemberCredentials(
      validMemberId,
      ' ADA@EXAMPLE.TEST ',
      'replacement-password',
      actor,
    );

    expect(member.save).toHaveBeenCalledTimes(1);
    expect(member.loginIdentifier).toBe('ada@example.test');
    await expect(
      bcrypt.compare('replacement-password', member.passwordHash!),
    ).resolves.toBe(true);
    expect(member.authVersion).toBe(7);
  });

  it('leaves member credentials unchanged when the normalized login identifier conflicts', async () => {
    const member = createMemberDocument({
      authVersion: 2,
      loginIdentifier: 'old@example.com',
      passwordHash: 'existing-hash',
    });
    const exec = jest.fn().mockResolvedValue(member);
    const model: MockMemberModel = jest.fn();
    model.exists = jest.fn().mockResolvedValue({ _id: 'other-member' });
    model.findOne = jest.fn().mockReturnValue({ exec });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(
      service.setMemberCredentials(
        validMemberId,
        ' OTHER@EXAMPLE.COM ',
        'new-password',
        actor,
      ),
    ).rejects.toMatchObject({
      message: 'Member login identifier already exists',
    });

    expect(member).toMatchObject({
      loginIdentifier: 'old@example.com',
      passwordHash: 'existing-hash',
      authVersion: 2,
    });
    expect(model.exists).toHaveBeenCalledWith({
      _id: { $ne: member._id },
      loginIdentifier: { $eq: 'other@example.com' },
    });
    expect(member.save).not.toHaveBeenCalled();
  });

  it('rejects a missing member when bumping its auth version', async () => {
    const model: MockMemberModel = jest.fn();
    model.updateOne = jest.fn().mockResolvedValue({ matchedCount: 0 });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(service.bumpAuthVersion(validMemberId)).rejects.toMatchObject({
      message: 'Member not found',
    });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: { $eq: expect.objectContaining({ _bsontype: 'ObjectId' }) } },
      { $inc: { authVersion: 1 } },
    );
  });

  it('updates a member profile without validating membership policy when membership and status do not change', async () => {
    const member = createMemberDocument();
    member.save.mockResolvedValue(member);
    const exec = jest.fn().mockResolvedValue(member);
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const membershipTypesService = createMembershipTypesService();
    const service = new MembersService(asModel(model), membershipTypesService);

    await service.update(validMemberId, { fullName: 'Grace Hopper' }, actor);

    expect(member.fullName).toBe('Grace Hopper');
    expect(membershipTypesService.validateActivePolicy).not.toHaveBeenCalled();
  });

  it('reserves a changed email, revokes active sessions, and audits identifier and status changes', async () => {
    const member = createMemberDocument({
      email: 'ada@example.com',
      authVersion: 0,
    });
    member.save.mockResolvedValue(member);
    const exec = jest.fn().mockResolvedValue(member);
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const identifierModel = createIdentifierModel(null);
    const refreshTokenFamilyModel = {
      updateMany: jest.fn().mockResolvedValue({}),
    };
    const securityActivityService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
      identifierModel as never,
      refreshTokenFamilyModel as never,
      securityActivityService as never,
    );

    await service.update(
      validMemberId,
      { email: ' NEW@EXAMPLE.COM ', status: MemberStatus.Suspended },
      actor,
    );

    expect(member).toMatchObject({
      email: 'new@example.com',
      status: MemberStatus.Suspended,
      authVersion: 2,
      updatedBy: 'staff-user-id',
    });
    expect(identifierModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedIdentifier: 'new@example.com',
        subjectId: 'member-id',
        createdBy: 'staff-user-id',
      }),
    );
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedIdentifier: 'ada@example.com',
        subjectId: 'member-id',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ updatedBy: 'staff-user-id' }),
      }),
    );
    expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'member-id' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          revokedReason: 'member-account-updated',
        }),
      }),
    );
    expect(securityActivityService.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actorType: 'staff',
        actorId: 'staff-user-id',
        targetType: 'member',
        targetId: 'member-id',
        subjectType: 'member',
        subjectId: 'member-id',
        reasonCategory: 'member-identifier-updated',
      }),
    );
    expect(securityActivityService.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        actorType: 'staff',
        actorId: 'staff-user-id',
        targetId: 'member-id',
        reasonCategory: 'member-status-updated',
      }),
    );
  });

  it('releases a newly reserved email when saving the member change fails', async () => {
    const member = createMemberDocument({ email: 'ada@example.com' });
    member.save.mockRejectedValue(new Error('database write failed'));
    const exec = jest.fn().mockResolvedValue(member);
    const model: MockMemberModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const identifierModel = createIdentifierModel(null);
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
      identifierModel as never,
    );

    await expect(
      service.update(validMemberId, { email: 'new@example.com' }, actor),
    ).rejects.toThrow('database write failed');

    expect(identifierModel.create).toHaveBeenCalledTimes(1);
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedIdentifier: 'new@example.com' }),
      expect.objectContaining({
        $set: expect.objectContaining({ releasedAt: expect.any(Date) }),
      }),
    );
  });

  it('recovers a released credential identifier and revokes sessions after saving credentials', async () => {
    const member = createMemberDocument({
      loginIdentifier: 'old@example.com',
      authVersion: 3,
    });
    member.save.mockResolvedValue(member);
    const exec = jest.fn().mockResolvedValue(member);
    const model: MockMemberModel = jest.fn();
    model.exists = jest.fn().mockResolvedValue(null);
    model.findOne = jest.fn().mockReturnValue({ exec });
    const identifierModel = createIdentifierModel({
      _id: 'released-id',
      status: 'released',
      subjectType: 'member',
      subjectId: 'another-member',
    });
    const refreshTokenFamilyModel = {
      updateMany: jest.fn().mockResolvedValue({}),
    };
    const securityActivityService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
      identifierModel as never,
      refreshTokenFamilyModel as never,
      securityActivityService as never,
    );

    await service.setMemberCredentials(
      validMemberId,
      'new@example.com',
      'plain-text-password',
      actor,
    );

    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      { _id: 'released-id', status: 'released' },
      expect.objectContaining({
        $set: expect.objectContaining({ subjectId: 'member-id' }),
        $unset: { releasedAt: '' },
      }),
    );
    expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'member-id' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          revokedReason: 'member-credentials-updated',
        }),
      }),
    );
    expect(securityActivityService.record).toHaveBeenCalledWith(
      expect.objectContaining({ reasonCategory: 'member-identifier-updated' }),
    );
  });

  it('releases a newly reserved credential identifier when saving credentials fails', async () => {
    const member = createMemberDocument({ loginIdentifier: 'old@example.com' });
    member.save.mockRejectedValue(new Error('database write failed'));
    const exec = jest.fn().mockResolvedValue(member);
    const model: MockMemberModel = jest.fn();
    model.exists = jest.fn().mockResolvedValue(null);
    model.findOne = jest.fn().mockReturnValue({ exec });
    const identifierModel = createIdentifierModel(null);
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
      identifierModel as never,
    );

    await expect(
      service.setMemberCredentials(
        validMemberId,
        'new@example.com',
        'plain-text-password',
        actor,
      ),
    ).rejects.toThrow('database write failed');

    expect(identifierModel.create).toHaveBeenCalledTimes(1);
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedIdentifier: 'new@example.com' }),
      expect.objectContaining({
        $set: expect.objectContaining({ releasedAt: expect.any(Date) }),
      }),
    );
  });

  it.each([0, 2])(
    'creates without an optional exists method and preserves activeLoanCount %i',
    async (activeLoanCount) => {
      const modelRequests: Array<Record<string, unknown>> = [];
      const model: MockMemberModel = jest
        .fn()
        .mockImplementation((request: Record<string, unknown>) => {
          modelRequests.push(request);
          const saved = createSharedMemberDocument({
            id: 'member-id',
            memberNumber: request.memberNumber as string,
            fullName: request.fullName as string,
            email: request.email as string | undefined,
            phone: request.phone as string | undefined,
            membershipTypeId: request.membershipTypeId as string,
            status: request.status as MemberStatus,
            activeLoanCount: request.activeLoanCount as number,
          });
          return { save: jest.fn().mockResolvedValue(saved) };
        });
      const service = new MembersService(
        asModel(model),
        createMembershipTypesService(),
      );

      const result = await service.create({
        memberNumber: ' mem-0001 ',
        fullName: 'Ada Lovelace',
        membershipTypeId: '64f000000000000000000001',
        activeLoanCount,
      });

      expect(model.exists).toBeUndefined();
      expect(JSON.parse(JSON.stringify(modelRequests[0]))).toEqual({
        memberNumber: 'MEM-0001',
        fullName: 'Ada Lovelace',
        membershipTypeId: '64f000000000000000000001',
        status: MemberStatus.Active,
        activeLoanCount,
        authVersion: 0,
      });
      expect(JSON.parse(JSON.stringify(result))).toEqual({
        id: 'member-id',
        memberNumber: 'MEM-0001',
        fullName: 'Ada Lovelace',
        membershipTypeId: '64f000000000000000000001',
        status: MemberStatus.Active,
        activeLoanCount,
      });
    },
  );

  it('clears email without reserving an empty identifier and revokes sessions', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      email: 'ada@example.test',
      authVersion: 0,
    });
    const identifierModel = createIdentifierModel(null);
    const refreshTokenFamilyModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
    };
    const securityActivityService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = createServiceWithMember(member, {
      identifierModel,
      refreshTokenFamilyModel,
      securityActivityService,
    });

    const result = await service.update(validMemberId, { email: '   ' });

    expect(result).toEqual({
      id: 'member-id',
      memberNumber: 'MEM-0001',
      fullName: 'Library Member',
      email: '',
      phone: '+15550000001',
      membershipTypeId: '507f1f77bcf86cd799439024',
      status: MemberStatus.Active,
      activeLoanCount: 0,
    });
    expect(member.authVersion).toBe(1);
    expect(member.updatedBy).toBeUndefined();
    expect(identifierModel.findOne).not.toHaveBeenCalled();
    expect(identifierModel.create).not.toHaveBeenCalled();
    expect(identifierModel.updateOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      {
        normalizedIdentifier: 'ada@example.test',
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-id',
        status: AuthIdentifierStatus.Active,
      },
      {
        $set: {
          status: AuthIdentifierStatus.Released,
          releasedAt: expect.any(Date),
          updatedBy: 'system',
        },
      },
    );
    expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
      {
        subjectType: AuthSubjectType.Member,
        subjectId: 'member-id',
        status: RefreshTokenFamilyStatus.Active,
      },
      {
        $set: {
          status: RefreshTokenFamilyStatus.Revoked,
          revokedAt: expect.any(Date),
          revokedReason: 'member-account-updated',
        },
        $unset: { currentTokenHash: '', previousTokenHash: '' },
      },
    );
    expect(securityActivityService.record).toHaveBeenCalledTimes(1);
    expect(securityActivityService.record).toHaveBeenCalledWith({
      actorType: SecurityActivityActorType.System,
      actorId: undefined,
      targetType: 'member',
      targetId: 'member-id',
      subjectType: 'member',
      subjectId: 'member-id',
      outcome: SecurityActivityOutcome.Success,
      eventType: SecurityActivityEventType.IdentifierReservationRecovered,
      reasonCategory: 'member-identifier-updated',
    });
    expect(
      JSON.stringify(securityActivityService.record.mock.calls),
    ).not.toContain('ada@example.test');
  });

  it('skips identifier and lifecycle effects for the same normalized email', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      email: 'ada@example.test',
      authVersion: 4,
    });
    const identifierModel = createIdentifierModel(null);
    const refreshTokenFamilyModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };
    const securityActivityService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = createServiceWithMember(member, {
      identifierModel,
      refreshTokenFamilyModel,
      securityActivityService,
    });

    const result = await service.update(validMemberId, {
      email: ' ADA@EXAMPLE.TEST ',
    });

    expect(result).toEqual({
      id: 'member-id',
      memberNumber: 'MEM-0001',
      fullName: 'Library Member',
      email: 'ada@example.test',
      phone: '+15550000001',
      membershipTypeId: '507f1f77bcf86cd799439024',
      status: MemberStatus.Active,
      activeLoanCount: 0,
    });
    expect(member.authVersion).toBe(4);
    expect(identifierModel.findOne).not.toHaveBeenCalled();
    expect(identifierModel.create).not.toHaveBeenCalled();
    expect(identifierModel.updateOne).not.toHaveBeenCalled();
    expect(refreshTokenFamilyModel.updateMany).not.toHaveBeenCalled();
    expect(securityActivityService.record).not.toHaveBeenCalled();
  });

  it('initializes an absent auth version and revokes only active member families on status change', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      status: MemberStatus.Active,
      authVersion: undefined,
    });
    const identifierModel = createIdentifierModel(null);
    const refreshTokenFamilyModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const securityActivityService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = createServiceWithMember(member, {
      identifierModel,
      refreshTokenFamilyModel,
      securityActivityService,
    });

    const result = await service.update(validMemberId, {
      status: MemberStatus.Suspended,
    });

    expect(result).toEqual({
      id: 'member-id',
      memberNumber: 'MEM-0001',
      fullName: 'Library Member',
      email: 'member@example.test',
      phone: '+15550000001',
      membershipTypeId: '507f1f77bcf86cd799439024',
      status: MemberStatus.Suspended,
      activeLoanCount: 0,
    });
    expect(member.authVersion).toBe(1);
    expect(identifierModel.findOne).not.toHaveBeenCalled();
    expect(identifierModel.create).not.toHaveBeenCalled();
    expect(identifierModel.updateOne).not.toHaveBeenCalled();
    expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
      {
        subjectType: AuthSubjectType.Member,
        subjectId: 'member-id',
        status: RefreshTokenFamilyStatus.Active,
      },
      {
        $set: {
          status: RefreshTokenFamilyStatus.Revoked,
          revokedAt: expect.any(Date),
          revokedReason: 'member-account-updated',
        },
        $unset: { currentTokenHash: '', previousTokenHash: '' },
      },
    );
    expect(securityActivityService.record).toHaveBeenCalledTimes(1);
    expect(securityActivityService.record).toHaveBeenCalledWith({
      actorType: SecurityActivityActorType.System,
      actorId: undefined,
      targetType: 'member',
      targetId: 'member-id',
      subjectType: 'member',
      subjectId: 'member-id',
      outcome: SecurityActivityOutcome.Success,
      eventType: SecurityActivityEventType.AccountStatusChanged,
      reasonCategory: 'member-status-updated',
    });
    expect(
      JSON.stringify(securityActivityService.record.mock.calls),
    ).not.toContain('stored-password-hash');
  });

  it('completes the owned member update when every optional integration is absent', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      email: 'old@example.test',
      authVersion: 2,
    });
    const service = createServiceWithMember(member, {
      identifierModel: undefined,
      refreshTokenFamilyModel: undefined,
      securityActivityService: undefined,
      installExists: false,
    });

    const result = await service.update(validMemberId, {
      email: 'new@example.test',
      status: MemberStatus.Inactive,
    });

    expect(member.save).toHaveBeenCalledTimes(1);
    expect(member.authVersion).toBe(4);
    expect(result).toEqual({
      id: 'member-id',
      memberNumber: 'MEM-0001',
      fullName: 'Library Member',
      email: 'new@example.test',
      phone: '+15550000001',
      membershipTypeId: '507f1f77bcf86cd799439024',
      status: MemberStatus.Inactive,
      activeLoanCount: 0,
    });
  });

  it('updates a phone while an unchanged status leaves authorization lifecycle state untouched', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      phone: '+15550000001',
      status: MemberStatus.Active,
      authVersion: 7,
    });
    const refreshTokenFamilyModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };
    const securityActivityService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = createServiceWithMember(member, {
      refreshTokenFamilyModel,
      securityActivityService,
    });

    const result = await service.update(validMemberId, {
      phone: '+15550000099',
      status: MemberStatus.Active,
    });

    expect(member.save).toHaveBeenCalledTimes(1);
    expect(member.phone).toBe('+15550000099');
    expect(member.authVersion).toBe(7);
    expect(result.phone).toBe('+15550000099');
    expect(refreshTokenFamilyModel.updateMany).not.toHaveBeenCalled();
    expect(securityActivityService.record).not.toHaveBeenCalled();
  });

  it('does not compensate an unchanged email when a different profile write fails', async () => {
    const writeError = new Error('member write rejected');
    const member = createSharedMemberDocument({
      id: 'member-id',
      email: 'ada@example.test',
      save: jest.fn().mockRejectedValue(writeError),
    });
    const identifierModel = createIdentifierModel(null);
    const service = createServiceWithMember(member, { identifierModel });

    await expect(
      service.update(validMemberId, {
        email: ' ADA@EXAMPLE.TEST ',
        fullName: 'Changed Name',
      }),
    ).rejects.toBe(writeError);

    expect(identifierModel.findOne).not.toHaveBeenCalled();
    expect(identifierModel.create).not.toHaveBeenCalled();
    expect(identifierModel.updateOne).not.toHaveBeenCalled();
  });

  it('compensates a failed email change with the public system actor contract', async () => {
    const writeError = new Error('member write rejected');
    const member = createSharedMemberDocument({
      id: 'member-id',
      email: 'old@example.test',
      save: jest.fn().mockRejectedValue(writeError),
    });
    const identifierModel = createIdentifierModel(null);
    const service = createServiceWithMember(member, { identifierModel });

    await expect(
      service.update(validMemberId, { email: ' NEW@EXAMPLE.TEST ' }),
    ).rejects.toBe(writeError);

    expect(identifierModel.create).toHaveBeenCalledWith({
      normalizedIdentifier: 'new@example.test',
      identifierType: AuthIdentifierType.Email,
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-id',
      status: AuthIdentifierStatus.Active,
      createdBy: 'system',
      updatedBy: 'system',
    });
    expect(identifierModel.updateOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      {
        normalizedIdentifier: 'new@example.test',
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-id',
        status: AuthIdentifierStatus.Active,
      },
      {
        $set: {
          status: AuthIdentifierStatus.Released,
          releasedAt: expect.any(Date),
          updatedBy: 'system',
        },
      },
    );
  });

  it('returns the member document only for the fully active public state pair', async () => {
    const member = createSharedMemberDocument({
      status: MemberStatus.Active,
      authStatus: MemberAuthStatus.Active,
    });
    const service = createServiceWithMember(member);

    await expect(service.findActiveById(validMemberId)).resolves.toBe(member);
  });

  it('bumps an existing member authorization version without returning an error', async () => {
    const model: MockMemberModel = jest.fn();
    model.updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(
      service.bumpAuthVersion(validMemberId),
    ).resolves.toBeUndefined();
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: { $eq: expect.objectContaining({ _bsontype: 'ObjectId' }) } },
      { $inc: { authVersion: 1 } },
    );
  });

  it.each([
    [
      'active staff owner with the same subject id',
      AuthIdentifierStatus.Active,
      AuthIdentifierSubjectType.Staff,
      'member-id',
    ],
    [
      'active member owner with a different subject id',
      AuthIdentifierStatus.Active,
      AuthIdentifierSubjectType.Member,
      'foreign-member-id',
    ],
    [
      'pending member owner with the same subject id',
      AuthIdentifierStatus.Pending,
      AuthIdentifierSubjectType.Member,
      'member-id',
    ],
  ])(
    'rejects %s instead of treating it as the exact active owner',
    async (_label, status, subjectType, subjectId) => {
      const member = createSharedMemberDocument({ id: 'member-id' });
      const identifierModel = createIdentifierModel({
        _id: 'identifier-1',
        status,
        subjectType,
        subjectId,
      });
      const service = createServiceWithMember(member, { identifierModel });

      await expect(
        service.setMemberCredentials(
          validMemberId,
          'reserved@example.test',
          'replacement-password',
          actor,
        ),
      ).rejects.toMatchObject({
        message: 'Sign-in identifier is already reserved',
      });

      expect(member.save).not.toHaveBeenCalled();
      expect(identifierModel.updateOne).not.toHaveBeenCalled();
    },
  );

  it('persists a system-owned credential replacement with exact lifecycle effects', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      loginIdentifier: 'old@example.test',
      authVersion: 0,
    });
    const identifierModel = createIdentifierModel(null);
    const refreshTokenFamilyModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const securityActivityService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = createServiceWithMember(member, {
      identifierModel,
      refreshTokenFamilyModel,
      securityActivityService,
    });

    await service.setMemberCredentials(
      validMemberId,
      ' NEW@EXAMPLE.TEST ',
      'replacement-password',
    );

    expect(identifierModel.create).toHaveBeenCalledWith({
      normalizedIdentifier: 'new@example.test',
      identifierType: AuthIdentifierType.LoginIdentifier,
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-id',
      status: AuthIdentifierStatus.Active,
      createdBy: 'system',
      updatedBy: 'system',
    });
    expect(identifierModel.updateOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      {
        normalizedIdentifier: 'old@example.test',
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-id',
        status: AuthIdentifierStatus.Active,
      },
      {
        $set: {
          status: AuthIdentifierStatus.Released,
          releasedAt: expect.any(Date),
          updatedBy: 'system',
        },
      },
    );
    expect(member.authVersion).toBe(1);
    expect(member.updatedBy).toBeUndefined();
    expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
      {
        subjectType: AuthSubjectType.Member,
        subjectId: 'member-id',
        status: RefreshTokenFamilyStatus.Active,
      },
      {
        $set: {
          status: RefreshTokenFamilyStatus.Revoked,
          revokedAt: expect.any(Date),
          revokedReason: 'member-credentials-updated',
        },
        $unset: { currentTokenHash: '', previousTokenHash: '' },
      },
    );
    expect(securityActivityService.record).toHaveBeenCalledTimes(1);
    expect(securityActivityService.record).toHaveBeenCalledWith({
      actorType: SecurityActivityActorType.System,
      actorId: undefined,
      targetType: 'member',
      targetId: 'member-id',
      subjectType: 'member',
      subjectId: 'member-id',
      outcome: SecurityActivityOutcome.Success,
      eventType: SecurityActivityEventType.IdentifierReservationRecovered,
      reasonCategory: 'member-identifier-updated',
    });
  });

  it('compensates a failed credential write with the public system actor contract', async () => {
    const writeError = new Error('credential write rejected');
    const member = createSharedMemberDocument({
      id: 'member-id',
      loginIdentifier: 'old@example.test',
      save: jest.fn().mockRejectedValue(writeError),
    });
    const identifierModel = createIdentifierModel(null);
    const service = createServiceWithMember(member, { identifierModel });

    await expect(
      service.setMemberCredentials(
        validMemberId,
        ' NEW@EXAMPLE.TEST ',
        'replacement-password',
      ),
    ).rejects.toBe(writeError);

    expect(identifierModel.create).toHaveBeenCalledWith({
      normalizedIdentifier: 'new@example.test',
      identifierType: AuthIdentifierType.LoginIdentifier,
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-id',
      status: AuthIdentifierStatus.Active,
      createdBy: 'system',
      updatedBy: 'system',
    });
    expect(identifierModel.updateOne).toHaveBeenCalledTimes(1);
    expect(identifierModel.updateOne).toHaveBeenCalledWith(
      {
        normalizedIdentifier: 'new@example.test',
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-id',
        status: AuthIdentifierStatus.Active,
      },
      {
        $set: {
          status: AuthIdentifierStatus.Released,
          releasedAt: expect.any(Date),
          updatedBy: 'system',
        },
      },
    );
  });

  it.each([
    ['absent', undefined],
    ['locked', MemberAuthStatus.Locked],
    ['reset-required', MemberAuthStatus.ResetRequired],
  ])(
    'uses the same public active-member error for %s auth status',
    async (_label, authStatus) => {
      const member = createSharedMemberDocument({
        status: MemberStatus.Active,
        authStatus,
      });
      const service = createServiceWithMember(member);

      await expect(service.findActiveById(validMemberId)).rejects.toThrow(
        'Active member not found',
      );
    },
  );

  it('clamps remaining policy allowance at zero above the tier maximum', async () => {
    const member = createSharedMemberDocument({
      id: 'member-id',
      activeLoanCount: 5,
      status: MemberStatus.Active,
    });
    const service = createServiceWithMember(member);

    await expect(service.getPolicyStatus(validMemberId)).resolves.toEqual({
      memberId: 'member-id',
      status: MemberStatus.Active,
      membershipTypeId: '507f1f77bcf86cd799439024',
      maxActiveLoans: 3,
      activeLoanCount: 5,
      remainingAllowance: 0,
      eligibleByStatus: true,
      withinLimit: false,
      limitReached: true,
    });
  });
});

function createIdentifierModel(existing: unknown | unknown[]) {
  const results = Array.isArray(existing) ? [...existing] : [existing];

  return {
    findOne: jest
      .fn()
      .mockImplementation(() => queryResult(results.shift() ?? null)),
    create: jest.fn().mockResolvedValue(undefined),
    updateOne: jest.fn().mockResolvedValue({}),
  };
}
