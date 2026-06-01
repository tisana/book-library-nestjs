import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import {
  LibraryItemStatus,
  MemberStatus,
  StaffRole,
} from '../common/enums/library-status.enum';
import { MembershipTypesService } from '../membership-types/membership-types.service';
import { MembersService } from './members.service';
import { MemberDocument } from './schemas/member.schema';

describe('MembersService', () => {
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
    findById?: jest.Mock;
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
    expect(model.exists).toHaveBeenCalledWith({ memberNumber: 'MEM-0001' });
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
    expect(model.exists).toHaveBeenCalledWith({ memberNumber: 'MEM-0001' });
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
        status: MemberStatus.Active,
        membershipTypeId: '64f000000000000000000001',
      }),
    );
    expect(sort).toHaveBeenCalledWith({ memberNumber: 1 });
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(1);
  });

  it('returns not found for missing members', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const model: MockMemberModel = jest.fn();
    model.findById = jest.fn().mockReturnValue({ exec });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates status, loan count, membership type, and audit actor', async () => {
    const document = createMemberDocument();
    document.save.mockResolvedValue(document);
    const exec = jest.fn().mockResolvedValue(document);
    const model: MockMemberModel = jest.fn();
    model.findById = jest.fn().mockReturnValue({ exec });
    const membershipTypesService = createMembershipTypesService();
    const service = new MembersService(asModel(model), membershipTypesService);

    const result = await service.update(
      'member-id',
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
    model.findById = jest.fn().mockReturnValue({ exec });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(service.getPolicyStatus('member-id')).resolves.toEqual({
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
    model.findById = jest.fn().mockReturnValue({ exec });
    const service = new MembersService(
      asModel(model),
      createMembershipTypesService(),
    );

    await expect(service.getPolicyStatus('member-id')).resolves.toMatchObject({
      status: MemberStatus.Suspended,
      activeLoanCount: 3,
      remainingAllowance: 0,
      eligibleByStatus: false,
      withinLimit: false,
      limitReached: true,
    });
  });
});
