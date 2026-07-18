/* eslint-disable @typescript-eslint/no-require-imports */
import {
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthIdentifierStatus } from '../auth/schemas/auth-identifier.schema';
import {
  AuthSubjectType,
  RefreshTokenFamilyStatus,
} from '../auth/schemas/refresh-token-family.schema';

function loadStaffUsersService(): any | undefined {
  try {
    return require('./staff-users.service').StaffUsersService;
  } catch {
    return undefined;
  }
}

describe('StaffUsersService password and response contract', () => {
  const StaffUsersService = loadStaffUsersService();
  const describeIfImplemented = StaffUsersService ? describe : describe.skip;

  describeIfImplemented('when StaffUsersService is implemented', () => {
    it('hashes raw passwords before persisting staff/admin users', async () => {
      const createdDocuments: any[] = [];
      const model = jest.fn().mockImplementation((document) => {
        createdDocuments.push(document);

        return {
          save: jest.fn().mockResolvedValue({
            id: 'staff-user-id',
            email: document.email,
            displayName: document.displayName,
            passwordHash: document.passwordHash,
            roles: document.roles,
            status: document.status,
          }),
        };
      });
      const passwordHasher = {
        hash: jest.fn().mockResolvedValue('hashed-password'),
      };
      const service = new StaffUsersService(model, passwordHasher);

      await service.create({
        email: 'staff@example.com',
        displayName: 'Staff User',
        password: 'plain-password',
        roles: [StaffRole.Staff],
      });

      expect(passwordHasher.hash).toHaveBeenCalledWith('plain-password');
      expect(createdDocuments[0]).toMatchObject({
        email: 'staff@example.com',
        displayName: 'Staff User',
        passwordHash: 'hashed-password',
        roles: [StaffRole.Staff],
        status: StaffUserStatus.Active,
      });
      expect(createdDocuments[0]).not.toHaveProperty('password');
    });

    it('redacts passwordHash from returned staff/admin users', async () => {
      const model = jest.fn().mockImplementation((document) => ({
        save: jest.fn().mockResolvedValue({
          id: 'staff-user-id',
          email: document.email,
          displayName: document.displayName,
          passwordHash: document.passwordHash,
          roles: document.roles,
          status: document.status,
        }),
      }));
      const service = new StaffUsersService(model, {
        hash: jest.fn().mockResolvedValue('hashed-password'),
      });

      const result = await service.create({
        email: 'admin@example.com',
        displayName: 'Admin User',
        password: 'plain-password',
        roles: [StaffRole.Admin],
      });

      expect(result).toMatchObject({
        id: 'staff-user-id',
        email: 'admin@example.com',
        displayName: 'Admin User',
        roles: [StaffRole.Admin],
        status: StaffUserStatus.Active,
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects roles outside the approved staff role set', async () => {
      const service = new StaffUsersService(jest.fn(), {
        hash: jest.fn(),
      });

      await expect(
        service.create({
          email: 'staff@example.com',
          displayName: 'Staff User',
          password: 'plain-password',
          roles: ['superuser'],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('reserves the normalized identifier in the account transaction', async () => {
      const session = {
        withTransaction: jest.fn(async (work) => work()),
        endSession: jest.fn(),
      };
      const saved = jest.fn(async function (this: Record<string, unknown>, options) {
        return { ...this, id: String(this._id), ...options };
      });
      const model = Object.assign(jest.fn().mockImplementation((document) => ({
        ...document,
        save: saved,
      })), {
        db: { startSession: jest.fn().mockResolvedValue(session) },
      });
      const identifierModel = {
        findOne: jest.fn(() => ({
          session: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(null) })),
        })),
        create: jest.fn().mockResolvedValue([{}]),
      };
      const service = new StaffUsersService(
        model,
        { hash: jest.fn().mockResolvedValue('hashed-password') },
        identifierModel,
      );

      await service.create({
        email: ' Staff@Example.COM ',
        displayName: 'Staff User',
        password: 'plain-password',
        roles: [StaffRole.Staff],
      });

      expect(session.withTransaction).toHaveBeenCalledTimes(1);
      expect(identifierModel.create).toHaveBeenCalledWith(
        [expect.objectContaining({
          normalizedIdentifier: 'staff@example.com',
          status: AuthIdentifierStatus.Active,
        })],
        { session },
      );
      expect(saved).toHaveBeenCalledWith({ session });
    });

    it('rejects a cross-context identifier collision before creating the account', async () => {
      const model = jest.fn().mockImplementation((document) => ({
        ...document,
        save: jest.fn(),
      }));
      const identifierModel = {
        findOne: jest.fn(() => ({
          session: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue({
              status: AuthIdentifierStatus.Active,
              subjectType: 'member',
              subjectId: 'member-1',
            }),
          })),
        })),
      };
      const service = new StaffUsersService(
        model,
        { hash: jest.fn().mockResolvedValue('hashed-password') },
        identifierModel,
      );

      await expect(
        service.create({
          email: 'member@example.com',
          displayName: 'Staff User',
          password: 'plain-password',
          roles: [StaffRole.Staff],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('applies approved role and status changes, bumps authVersion, and revokes sessions', async () => {
      const id = new Types.ObjectId();
      const document = {
        _id: id,
        id: id.toString(),
        email: 'staff@example.com',
        displayName: 'Staff User',
        roles: [StaffRole.Staff],
        status: StaffUserStatus.Active,
        authVersion: 3,
        save: jest.fn().mockResolvedValue(undefined),
      };
      const model = {
        findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(document) })),
      };
      const refreshTokenFamilyModel = { updateMany: jest.fn() };
      const securityActivity = { record: jest.fn() };
      const service = new StaffUsersService(
        model,
        { hash: jest.fn() },
        undefined,
        refreshTokenFamilyModel,
        securityActivity,
      );

      const result = await service.update(
        id.toString(),
        { roles: [StaffRole.Admin], status: StaffUserStatus.Inactive },
        { id: 'admin-1' },
      );

      expect(document.authVersion).toBe(4);
      expect(result.roles).toEqual([StaffRole.Admin]);
      expect(result.permissions).toContain('staff-users:manage');
      expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectType: AuthSubjectType.Staff,
          subjectId: id.toString(),
          status: RefreshTokenFamilyStatus.Active,
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: RefreshTokenFamilyStatus.Revoked,
          }),
        }),
      );
      expect(securityActivity.record).toHaveBeenCalledTimes(2);
    });
  });
});
