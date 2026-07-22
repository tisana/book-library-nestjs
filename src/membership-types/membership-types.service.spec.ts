import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import {
  StaffRole,
  LibraryItemStatus,
} from '../common/enums/library-status.enum';
import { MembershipTypesService } from './membership-types.service';
import { MembershipTypeDocument } from './schemas/membership-type.schema';

describe('MembershipTypesService', () => {
  const validMembershipTypeId = '665f4d3b8f4c8a001f5f0a11';
  const actor = {
    id: 'staff-user-id',
    email: 'staff@example.com',
    roles: [StaffRole.Staff],
  };

  type MockMembershipTypeModel = jest.Mock & {
    exists?: jest.Mock;
    find?: jest.Mock;
    findOne?: jest.Mock;
  };

  function asModel(
    model: MockMembershipTypeModel,
  ): Model<MembershipTypeDocument> {
    return model as unknown as Model<MembershipTypeDocument>;
  }

  it('creates active membership types with normalized code, borrowing limit, and audit actor', async () => {
    const createdDocuments: any[] = [];
    const model: MockMembershipTypeModel = jest
      .fn()
      .mockImplementation((document) => {
        createdDocuments.push(document);

        return {
          save: jest.fn().mockResolvedValue({
            id: 'membership-type-id',
            ...document,
          }),
        };
      });
    model.exists = jest.fn().mockResolvedValue(null);
    const service = new MembershipTypesService(asModel(model));

    const result = await service.create(
      {
        code: ' standard ',
        name: 'Standard Member',
        maxActiveLoans: 3,
      },
      actor,
    );

    expect(model.exists).toHaveBeenCalledWith({ code: { $eq: 'STANDARD' } });
    expect(createdDocuments[0]).toMatchObject({
      code: 'STANDARD',
      name: 'Standard Member',
      maxActiveLoans: 3,
      status: LibraryItemStatus.Active,
      createdBy: 'staff-user-id',
      updatedBy: 'staff-user-id',
    });
    expect(result).toMatchObject({
      id: 'membership-type-id',
      code: 'STANDARD',
      maxActiveLoans: 3,
      status: LibraryItemStatus.Active,
    });
  });

  it('rejects duplicate membership type codes before persisting', async () => {
    const model: MockMembershipTypeModel = jest.fn();
    model.exists = jest.fn().mockResolvedValue({ _id: 'existing-id' });
    const service = new MembershipTypesService(asModel(model));

    await expect(
      service.create({
        code: 'standard',
        name: 'Standard Member',
        maxActiveLoans: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(model.exists).toHaveBeenCalledWith({ code: { $eq: 'STANDARD' } });
    expect(model).not.toHaveBeenCalled();
  });

  it('lists membership types filtered by status with stable code sorting and pagination', async () => {
    const exec = jest.fn().mockResolvedValue([
      {
        id: 'membership-type-id',
        code: 'STANDARD',
        name: 'Standard Member',
        maxActiveLoans: 3,
        status: LibraryItemStatus.Active,
      },
    ]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const find = jest.fn().mockReturnValue({ sort });
    const model: MockMembershipTypeModel = jest.fn();
    model.find = find;
    const service = new MembershipTypesService(asModel(model));

    const result = await service.findAll({
      status: LibraryItemStatus.Active,
      page: 2,
      limit: 10,
    });

    expect(find).toHaveBeenCalledWith({
      status: { $eq: LibraryItemStatus.Active },
    });
    expect(sort).toHaveBeenCalledWith({ code: 1 });
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(1);
  });

  it('returns not found for missing membership types', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const model: MockMembershipTypeModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const service = new MembershipTypesService(asModel(model));

    await expect(service.findOne(validMembershipTypeId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates borrowing limits and deactivates membership types with audit actor', async () => {
    const document = {
      id: 'membership-type-id',
      code: 'STANDARD',
      name: 'Standard Member',
      maxActiveLoans: 3,
      status: LibraryItemStatus.Active,
      updatedBy: undefined as string | undefined,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    const exec = jest.fn().mockResolvedValue(document);
    const model: MockMembershipTypeModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const service = new MembershipTypesService(asModel(model));

    const result = await service.update(
      validMembershipTypeId,
      {
        maxActiveLoans: 1,
        status: LibraryItemStatus.Deactivated,
      },
      actor,
    );

    expect(document.maxActiveLoans).toBe(1);
    expect(document.status).toBe(LibraryItemStatus.Deactivated);
    expect(document.updatedBy).toBe('staff-user-id');
    expect(result).toMatchObject({
      id: 'membership-type-id',
      maxActiveLoans: 1,
      status: LibraryItemStatus.Deactivated,
    });
  });

  it('rejects inactive membership types for borrowing policy validation', async () => {
    const exec = jest.fn().mockResolvedValue({
      id: 'membership-type-id',
      code: 'REFERENCE',
      name: 'Reference Member',
      maxActiveLoans: 0,
      status: LibraryItemStatus.Deactivated,
    });
    const model: MockMembershipTypeModel = jest.fn();
    model.findOne = jest.fn().mockReturnValue({ exec });
    const service = new MembershipTypesService(asModel(model));

    await expect(
      service.validateActivePolicy(validMembershipTypeId),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
