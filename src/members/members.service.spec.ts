import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import {
  LibraryItemStatus,
  MemberAuthStatus,
  MemberStatus,
  StaffRole,
} from '../common/enums/library-status.enum';
import { MembershipTypesService } from '../membership-types/membership-types.service';
import { MembersService } from './members.service';
import { MemberDocument } from './schemas/member.schema';

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

      await expect(service.findActiveById(validMemberId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    },
  );

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
    ).rejects.toBeInstanceOf(ConflictException);

    expect(member).toMatchObject({
      loginIdentifier: 'old@example.com',
      passwordHash: 'existing-hash',
      authVersion: 2,
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

    await expect(service.bumpAuthVersion(validMemberId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

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
    const refreshTokenFamilyModel = { updateMany: jest.fn().mockResolvedValue({}) };
    const securityActivityService = { record: jest.fn().mockResolvedValue(undefined) };
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
      expect.objectContaining({ $set: expect.objectContaining({ updatedBy: 'staff-user-id' }) }),
    );
    expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'member-id' }),
      expect.objectContaining({ $set: expect.objectContaining({ revokedReason: 'member-account-updated' }) }),
    );
    expect(securityActivityService.record).toHaveBeenCalledTimes(2);
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
      expect.objectContaining({ $set: expect.objectContaining({ releasedAt: expect.any(Date) }) }),
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
    const refreshTokenFamilyModel = { updateMany: jest.fn().mockResolvedValue({}) };
    const securityActivityService = { record: jest.fn().mockResolvedValue(undefined) };
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
      expect.objectContaining({ $set: expect.objectContaining({ revokedReason: 'member-credentials-updated' }) }),
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
      expect.objectContaining({ $set: expect.objectContaining({ releasedAt: expect.any(Date) }) }),
    );
  });
});

function createIdentifierModel(existing: unknown) {
  return {
    findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) }),
    create: jest.fn().mockResolvedValue(undefined),
    updateOne: jest.fn().mockResolvedValue({}),
  };
}
