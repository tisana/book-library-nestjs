import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  StaffRole,
  LibraryItemStatus,
} from '../common/enums/library-status.enum';
import { BookCategoriesService } from './book-categories.service';
import { Model } from 'mongoose';
import { BookCategoryDocument } from './schemas/book-category.schema';

describe('BookCategoriesService', () => {
  describe('when managing categories', () => {
    const validCategoryId = '665f4d3b8f4c8a001f5f0a11';
    const actor = {
      id: 'staff-user-id',
      email: 'staff@example.com',
      roles: [StaffRole.Staff],
    };

    type MockCategoryModel = jest.Mock & {
      exists?: jest.Mock;
      find?: jest.Mock;
      findOne?: jest.Mock;
    };

    function asModel(model: MockCategoryModel): Model<BookCategoryDocument> {
      return model as unknown as Model<BookCategoryDocument>;
    }

    it('creates active categories with normalized unique code, loan period, and audit actor', async () => {
      const createdDocuments: any[] = [];
      const model: MockCategoryModel = jest
        .fn()
        .mockImplementation((document) => {
          createdDocuments.push(document);

          return {
            save: jest.fn().mockResolvedValue({
              id: 'category-id',
              ...document,
              createdAt: new Date('2026-05-30T00:00:00.000Z'),
              updatedAt: new Date('2026-05-30T00:00:00.000Z'),
            }),
          };
        });
      model.exists = jest.fn().mockResolvedValue(null);
      const service = new BookCategoriesService(asModel(model));

      const result = await service.create(
        {
          code: ' standard ',
          name: 'Standard Collection',
          loanPeriodDays: 14,
        },
        actor,
      );

      expect(model.exists).toHaveBeenCalledWith({
        code: { $eq: 'STANDARD' },
      });
      expect(createdDocuments[0]).toMatchObject({
        code: 'STANDARD',
        name: 'Standard Collection',
        loanPeriodDays: 14,
        status: LibraryItemStatus.Active,
        createdBy: 'staff-user-id',
        updatedBy: 'staff-user-id',
      });
      expect(result).toMatchObject({
        id: 'category-id',
        code: 'STANDARD',
        name: 'Standard Collection',
        loanPeriodDays: 14,
        status: LibraryItemStatus.Active,
      });
    });

    it('rejects duplicate category codes before persisting', async () => {
      const model: MockCategoryModel = jest.fn();
      model.exists = jest.fn().mockResolvedValue({ _id: 'existing-id' });
      const service = new BookCategoriesService(asModel(model));

      await expect(
        service.create({
          code: 'standard',
          name: 'Standard Collection',
          loanPeriodDays: 14,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(model.exists).toHaveBeenCalledWith({
        code: { $eq: 'STANDARD' },
      });
      expect(model).not.toHaveBeenCalled();
    });

    it('lists categories filtered by status with stable code sorting and pagination', async () => {
      const exec = jest.fn().mockResolvedValue([
        {
          id: 'category-id',
          code: 'STANDARD',
          name: 'Standard Collection',
          loanPeriodDays: 14,
          status: LibraryItemStatus.Active,
        },
      ]);
      const limit = jest.fn().mockReturnValue({ exec });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });
      const find = jest.fn().mockReturnValue({ sort });
      const model: MockCategoryModel = jest.fn();
      model.find = find;
      const service = new BookCategoriesService(asModel(model));

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

    it('returns category details or not found for missing identifiers', async () => {
      const exec = jest.fn().mockResolvedValue(null);
      const model: MockCategoryModel = jest.fn();
      model.findOne = jest.fn().mockReturnValue({ exec });
      const service = new BookCategoriesService(asModel(model));

      await expect(service.findOne(validCategoryId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('updates status to deactivated and records the updating actor', async () => {
      const document = {
        id: 'category-id',
        code: 'STANDARD',
        name: 'Standard Collection',
        loanPeriodDays: 14,
        status: LibraryItemStatus.Active,
        updatedBy: undefined as string | undefined,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };
      const exec = jest.fn().mockResolvedValue(document);
      const model: MockCategoryModel = jest.fn();
      model.findOne = jest.fn().mockReturnValue({ exec });
      const service = new BookCategoriesService(asModel(model));

      const result = await service.update(
        validCategoryId,
        { status: LibraryItemStatus.Deactivated },
        actor,
      );

      expect(document.status).toBe(LibraryItemStatus.Deactivated);
      expect(document.updatedBy).toBe('staff-user-id');
      expect(result).toMatchObject({
        id: 'category-id',
        status: LibraryItemStatus.Deactivated,
      });
    });

    it('rejects inactive categories for loan-period validation', async () => {
      const exec = jest.fn().mockResolvedValue({
        id: 'category-id',
        code: 'REFERENCE',
        name: 'Reference',
        loanPeriodDays: 7,
        status: LibraryItemStatus.Deactivated,
      });
      const model: MockCategoryModel = jest.fn();
      model.findOne = jest.fn().mockReturnValue({ exec });
      const service = new BookCategoriesService(asModel(model));

      await expect(
        service.validateActiveLoanPeriod(validCategoryId),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
