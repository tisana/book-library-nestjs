import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Types } from 'mongoose';
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
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from '../auth/schemas/security-activity-event.schema';
import {
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import {
  createIdentifierModelHarness,
  createStaffDocument,
  createStaffModelHarness,
} from '../../test/support/backend-coverage-fixtures';
import { StaffUsersService } from './staff-users.service';

const staffId = '507f1f77bcf86cd799439011';

function createService(options?: {
  staff?: ReturnType<typeof createStaffModelHarness>;
  identifier?: ReturnType<typeof createIdentifierModelHarness>;
  refreshTokenFamilyModel?: { updateMany: jest.Mock };
  securityActivityService?: { record: jest.Mock };
}) {
  const staff = options?.staff ?? createStaffModelHarness();
  const passwordHasher = { hash: jest.fn().mockResolvedValue('hashed-value') };
  const service = new StaffUsersService(
    staff.model as never,
    passwordHasher as never,
    options?.identifier?.model as never,
    options?.refreshTokenFamilyModel as never,
    options?.securityActivityService as never,
  );

  return { service, staff, passwordHasher };
}

function createDto(roles: StaffRole[] = [StaffRole.Admin]) {
  return {
    email: ' Admin@Example.TEST ',
    displayName: 'Library Administrator',
    password: 'a-valid-password',
    roles,
  };
}

describe('StaffUsersService staff-account lifecycle', () => {
  describe('create', () => {
    it('falls back when transactions are unavailable, reserves the normalized email, and saves once', async () => {
      const session = {
        withTransaction: jest
          .fn()
          .mockRejectedValue(new Error('Transaction requires a replica set')),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      const staff = createStaffModelHarness({
        startSession: jest.fn().mockResolvedValue(session),
      });
      const identifier = createIdentifierModelHarness();
      const { service, passwordHasher } = createService({ staff, identifier });
      const dto = createDto();

      const result = await service.create(dto, {
        id: 'actor-1',
        email: 'actor@example.test',
        roles: [StaffRole.Admin],
      });
      const constructorInput = staff.calls.constructorInputs[0] as Record<
        string,
        unknown
      >;

      expect(result).toMatchObject({
        email: 'admin@example.test',
        roles: [StaffRole.Admin],
        status: StaffUserStatus.Active,
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(passwordHasher.hash).toHaveBeenCalledTimes(1);
      expect(
        Object.is(passwordHasher.hash.mock.calls[0]?.[0], dto.password),
      ).toBe(true);
      expect(constructorInput.passwordHash).toBe('hashed-value');
      expect(
        Object.prototype.hasOwnProperty.call(constructorInput, 'password'),
      ).toBe(false);
      expect(staff.calls.constructorInputs).toEqual([
        expect.objectContaining({
          email: 'admin@example.test',
          roles: [StaffRole.Admin],
          status: StaffUserStatus.Active,
          createdBy: 'actor-1',
        }),
      ]);
      expect(staff.calls.existsFilters).toEqual([
        { email: { $eq: 'admin@example.test' } },
      ]);
      expect(identifier.calls.findOneFilters).toEqual([
        { normalizedIdentifier: 'admin@example.test' },
      ]);
      expect(identifier.calls.sessionValues).toEqual([null]);
      expect(identifier.calls.createArguments).toEqual([
        [
          [
            expect.objectContaining({
              normalizedIdentifier: 'admin@example.test',
              identifierType: AuthIdentifierType.Email,
              subjectType: AuthIdentifierSubjectType.Staff,
              status: AuthIdentifierStatus.Active,
            }),
          ],
          { session: undefined },
        ],
      ]);
      expect(staff.document.save).toHaveBeenCalledTimes(1);
      expect(staff.document.save).toHaveBeenCalledWith();
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('releases a fallback reservation when the staff save fails', async () => {
      const staff = createStaffModelHarness();
      (staff.document.save as jest.Mock).mockRejectedValueOnce(
        new Error('staff save failed'),
      );
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      await expect(service.create(createDto())).rejects.toThrow(
        'staff save failed',
      );

      expect(identifier.model.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            normalizedIdentifier: 'admin@example.test',
            status: AuthIdentifierStatus.Active,
          }),
        ]),
        expect.any(Object),
      );
      expect(identifier.model.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          normalizedIdentifier: 'admin@example.test',
          status: AuthIdentifierStatus.Active,
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: AuthIdentifierStatus.Released,
          }),
        }),
        expect.any(Object),
      );
      expect(identifier.calls.updateOneArguments).toEqual([
        [
          expect.objectContaining({
            normalizedIdentifier: 'admin@example.test',
            subjectType: AuthIdentifierSubjectType.Staff,
            status: AuthIdentifierStatus.Active,
          }),
          expect.objectContaining({
            $set: expect.objectContaining({
              status: AuthIdentifierStatus.Released,
            }),
          }),
          { session: undefined },
        ],
      ]);
    });

    it('rejects an existing staff email before hashing or constructing a document', async () => {
      const staff = createStaffModelHarness({ existsResult: { _id: staffId } });
      const identifier = createIdentifierModelHarness();
      const { service, passwordHasher } = createService({ staff, identifier });

      await expect(service.create(createDto())).rejects.toThrow(
        new ConflictException('Staff user email already exists'),
      );

      expect(staff.calls.existsFilters).toEqual([
        { email: { $eq: 'admin@example.test' } },
      ]);
      expect(staff.calls.constructorInputs).toEqual([]);
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(identifier.calls.createArguments).toEqual([]);
    });

    it('uses one successful transaction for the identifier reservation and staff save', async () => {
      const session = {
        withTransaction: jest.fn(async (work: () => Promise<void>) => work()),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      const staff = createStaffModelHarness({
        startSession: jest.fn().mockResolvedValue(session),
      });
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      await service.create(createDto());

      expect(identifier.calls.sessionValues).toEqual([session]);
      expect(identifier.calls.createArguments).toEqual([
        [
          [expect.objectContaining({ normalizedIdentifier: 'admin@example.test' })],
          { session },
        ],
      ]);
      expect(staff.document.save).toHaveBeenCalledWith({ session });
      expect(staff.document.save).toHaveBeenCalledTimes(1);
      expect(session.withTransaction).toHaveBeenCalledTimes(1);
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('falls back when a transaction completes without creating the staff document', async () => {
      const session = {
        withTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      const staff = createStaffModelHarness({
        startSession: jest.fn().mockResolvedValue(session),
      });
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      await service.create(createDto());

      expect(identifier.calls.sessionValues).toEqual([null]);
      expect(staff.document.save).toHaveBeenCalledWith();
      expect(staff.document.save).toHaveBeenCalledTimes(1);
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('does not fall back from a non-transaction conflict', async () => {
      const session = {
        withTransaction: jest
          .fn()
          .mockRejectedValue(
            new ConflictException('Sign-in identifier is already reserved'),
          ),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      const staff = createStaffModelHarness({
        startSession: jest.fn().mockResolvedValue(session),
      });
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      await expect(service.create(createDto())).rejects.toThrow(
        new ConflictException('Sign-in identifier is already reserved'),
      );

      expect(identifier.calls.findOneFilters).toEqual([]);
      expect(staff.document.save).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('recognizes a non-Error mongos failure and uses the fallback path', async () => {
      const session = {
        withTransaction: jest.fn().mockRejectedValue('mongos unavailable'),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      const staff = createStaffModelHarness({
        startSession: jest.fn().mockResolvedValue(session),
      });
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      await service.create(createDto());

      expect(staff.document.save).toHaveBeenCalledTimes(1);
      expect(identifier.calls.sessionValues).toEqual([null]);
    });

    it('continues without a transaction when session startup is unavailable', async () => {
      const staff = createStaffModelHarness({
        startSession: jest.fn().mockRejectedValue(new Error('server unavailable')),
      });
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      await service.create(createDto());

      expect(identifier.calls.sessionValues).toEqual([null]);
      expect(staff.document.save).toHaveBeenCalledWith();
      expect(staff.document.save).toHaveBeenCalledTimes(1);
    });

    it('maps a duplicate identifier key to the stable conflict response', async () => {
      const staff = createStaffModelHarness();
      const identifier = createIdentifierModelHarness();
      identifier.model.create.mockRejectedValueOnce({ code: 11000 });
      const { service } = createService({ staff, identifier });

      await expect(service.create(createDto())).rejects.toThrow(
        new ConflictException('Sign-in identifier is already reserved'),
      );

      expect(staff.document.save).not.toHaveBeenCalled();
    });

    it('reactivates a released reservation for the new staff subject', async () => {
      const releasedId = new Types.ObjectId();
      const identifier = createIdentifierModelHarness({
        findOneResult: {
          _id: releasedId,
          normalizedIdentifier: 'admin@example.test',
          status: AuthIdentifierStatus.Released,
        } as never,
      });
      const { service } = createService({ identifier });

      await service.create(createDto(), {
        id: 'actor-2',
        email: 'actor@example.test',
        roles: [StaffRole.Admin],
      });

      expect(identifier.calls.updateOneArguments).toEqual([
        [
          { _id: releasedId, status: AuthIdentifierStatus.Released },
          {
            $set: expect.objectContaining({
              status: AuthIdentifierStatus.Active,
              subjectType: AuthIdentifierSubjectType.Staff,
              updatedBy: 'actor-2',
            }),
            $unset: { releasedAt: '' },
          },
          { session: undefined },
        ],
      ]);
      expect(identifier.calls.createArguments).toEqual([]);
    });

    it('rejects an active reservation owned by another subject', async () => {
      const identifier = createIdentifierModelHarness({
        findOneResult: {
          status: AuthIdentifierStatus.Active,
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: 'member-1',
        } as never,
      });
      const { service, staff } = createService({ identifier });

      await expect(service.create(createDto())).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(staff.document.save).not.toHaveBeenCalled();
      expect(identifier.calls.updateOneArguments).toEqual([]);
      expect(identifier.calls.createArguments).toEqual([]);
    });

    it('keeps an active reservation already owned by the new staff subject', async () => {
      const staff = createStaffModelHarness();
      const identifier = createIdentifierModelHarness();
      identifier.model.findOne.mockImplementationOnce((filter: unknown) => {
        identifier.calls.findOneFilters.push(filter);
        const query = {
          select: jest.fn(() => query),
          session: jest.fn((value: unknown) => {
            identifier.calls.sessionValues.push(value);
            return query;
          }),
          exec: jest.fn(async () => {
            const input = staff.calls.constructorInputs[0] as { _id: Types.ObjectId };
            return {
              status: AuthIdentifierStatus.Active,
              subjectType: AuthIdentifierSubjectType.Staff,
              subjectId: input._id.toString(),
            };
          }),
        };
        return query;
      });
      const { service } = createService({ staff, identifier });

      await service.create(createDto());

      expect(identifier.calls.findOneFilters).toEqual([
        { normalizedIdentifier: 'admin@example.test' },
      ]);
      expect(identifier.calls.updateOneArguments).toEqual([]);
      expect(identifier.calls.createArguments).toEqual([]);
      expect(staff.document.save).toHaveBeenCalledTimes(1);
    });

    it('maps a non-Error identifier failure to the stable generic error', async () => {
      const staff = createStaffModelHarness();
      const identifier = createIdentifierModelHarness();
      identifier.model.create.mockRejectedValueOnce('unexpected failure');
      const { service } = createService({ staff, identifier });

      await expect(service.create(createDto())).rejects.toThrow(
        'Identifier update failed',
      );

      expect(staff.document.save).not.toHaveBeenCalled();
    });

    it('saves when the optional identifier model is absent', async () => {
      const staff = createStaffModelHarness();
      const { service } = createService({ staff });

      const result = await service.create(createDto([StaffRole.Staff]));

      expect(result.email).toBe('admin@example.test');
      expect(staff.document.save).toHaveBeenCalledWith();
      expect(staff.document.save).toHaveBeenCalledTimes(1);
    });

    it('normalizes duplicate approved roles before constructing the staff user', async () => {
      const staff = createStaffModelHarness();
      const { service } = createService({ staff });

      const result = await service.create(
        createDto([StaffRole.Admin, StaffRole.Admin, StaffRole.Staff]),
      );

      expect(result.roles).toEqual([StaffRole.Admin, StaffRole.Staff]);
      expect(staff.calls.constructorInputs).toEqual([
        expect.objectContaining({ roles: [StaffRole.Admin, StaffRole.Staff] }),
      ]);
    });

    it.each([
      ['an empty role list', []],
      ['an unknown role', ['superuser']],
    ])('rejects %s', async (_label, roles) => {
      const { service, staff } = createService();

      await expect(
        service.create(createDto(roles as StaffRole[])),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(staff.calls.constructorInputs).toEqual([]);
    });
  });

  describe('update', () => {
    it('saves ordinary changes without bumping authorization or revoking sessions', async () => {
      const document = createStaffDocument({
        roles: [StaffRole.Staff, StaffRole.Admin],
        authVersion: 7,
      });
      const staff = createStaffModelHarness({ document });
      const refreshTokenFamilyModel = { updateMany: jest.fn() };
      const securityActivityService = { record: jest.fn() };
      const { service } = createService({
        staff,
        refreshTokenFamilyModel,
        securityActivityService,
      });

      const result = await service.update(staffId, {
        displayName: 'Renamed User',
        roles: [StaffRole.Admin, StaffRole.Staff],
      });

      expect(result.displayName).toBe('Renamed User');
      expect(document.authVersion).toBe(7);
      expect(document.save).toHaveBeenCalledWith();
      expect(refreshTokenFamilyModel.updateMany).not.toHaveBeenCalled();
      expect(securityActivityService.record).not.toHaveBeenCalled();
    });

    it('updates email, roles, and status transactionally, then revokes and audits prior values', async () => {
      const document = createStaffDocument({
        _id: new Types.ObjectId(staffId),
        id: staffId,
        email: 'staff@example.test',
        roles: [StaffRole.Staff],
        status: StaffUserStatus.Active,
        authVersion: 3,
      });
      const session = {
        withTransaction: jest.fn(async (work: () => Promise<void>) => work()),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      const staff = createStaffModelHarness({
        document,
        startSession: jest.fn().mockResolvedValue(session),
      });
      const identifier = createIdentifierModelHarness();
      const refreshTokenFamilyModel = {
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };
      const securityActivityService = {
        record: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = createService({
        staff,
        identifier,
        refreshTokenFamilyModel,
        securityActivityService,
      });

      const result = await service.update(
        staffId,
        {
          email: ' ADMIN@EXAMPLE.TEST ',
          roles: [StaffRole.Admin],
          status: StaffUserStatus.Suspended,
        },
        {
          id: 'admin-actor',
          email: 'actor@example.test',
          roles: [StaffRole.Admin],
        },
      );

      expect(result).toMatchObject({
        email: 'admin@example.test',
        roles: [StaffRole.Admin],
        status: StaffUserStatus.Suspended,
      });
      expect(document.authVersion).toBe(4);
      expect(identifier.calls.findOneFilters).toEqual([
        { normalizedIdentifier: 'admin@example.test' },
      ]);
      expect(identifier.calls.sessionValues).toEqual([session]);
      expect(identifier.calls.createArguments).toEqual([
        [
          [expect.objectContaining({ normalizedIdentifier: 'admin@example.test' })],
          { session },
        ],
      ]);
      expect(identifier.calls.updateOneArguments).toEqual([
        [
          {
            normalizedIdentifier: 'staff@example.test',
            subjectType: AuthIdentifierSubjectType.Staff,
            subjectId: staffId,
            status: AuthIdentifierStatus.Active,
          },
          {
            $set: expect.objectContaining({
              status: AuthIdentifierStatus.Released,
              updatedBy: 'admin-actor',
            }),
          },
          { session },
        ],
      ]);
      expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
        {
          subjectType: AuthSubjectType.Staff,
          subjectId: staffId,
          status: RefreshTokenFamilyStatus.Active,
        },
        {
          $set: expect.objectContaining({
            status: RefreshTokenFamilyStatus.Revoked,
            revokedReason: 'staff-account-updated',
          }),
          $unset: { currentTokenHash: '', previousTokenHash: '' },
        },
      );
      expect(securityActivityService.record).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          eventType: SecurityActivityEventType.RoleChanged,
          outcome: SecurityActivityOutcome.Success,
          context: {
            previousRoles: [StaffRole.Staff],
            roles: [StaffRole.Admin],
          },
        }),
      );
      expect(securityActivityService.record).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          eventType: SecurityActivityEventType.AccountStatusChanged,
          outcome: SecurityActivityOutcome.Success,
          context: {
            previousStatus: StaffUserStatus.Active,
            status: StaffUserStatus.Suspended,
          },
        }),
      );
    });

    it('compensates a failed fallback email update by releasing the new reservation', async () => {
      const document = createStaffDocument({
        _id: new Types.ObjectId(staffId),
        id: staffId,
        email: 'staff@example.test',
      });
      (document.save as jest.Mock).mockRejectedValueOnce(
        new Error('update save failed'),
      );
      const staff = createStaffModelHarness({ document });
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      await expect(
        service.update(staffId, { email: ' ADMIN@EXAMPLE.TEST ' }),
      ).rejects.toThrow('update save failed');

      expect(identifier.calls.createArguments).toEqual([
        [
          [expect.objectContaining({ normalizedIdentifier: 'admin@example.test' })],
          { session: undefined },
        ],
      ]);
      expect(identifier.calls.updateOneArguments).toEqual([
        [
          {
            normalizedIdentifier: 'admin@example.test',
            subjectType: AuthIdentifierSubjectType.Staff,
            subjectId: staffId,
            status: AuthIdentifierStatus.Active,
          },
          {
            $set: expect.objectContaining({
              status: AuthIdentifierStatus.Released,
            }),
          },
          { session: undefined },
        ],
      ]);
    });

    it('falls back when an email-change transaction completes without applying updates', async () => {
      const document = createStaffDocument({
        _id: new Types.ObjectId(staffId),
        id: staffId,
        email: 'staff@example.test',
      });
      const session = {
        withTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      const staff = createStaffModelHarness({
        document,
        startSession: jest.fn().mockResolvedValue(session),
      });
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      const result = await service.update(staffId, {
        email: 'admin@example.test',
      });

      expect(result.email).toBe('admin@example.test');
      expect(identifier.calls.sessionValues).toEqual([null]);
      expect(document.save).toHaveBeenCalledWith();
      expect(identifier.calls.updateOneArguments).toHaveLength(1);
    });

    it('propagates a non-transaction update failure without fallback writes', async () => {
      const document = createStaffDocument({
        _id: new Types.ObjectId(staffId),
        id: staffId,
        email: 'staff@example.test',
      });
      const session = {
        withTransaction: jest.fn().mockRejectedValue(new Error('write failed')),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      const staff = createStaffModelHarness({
        document,
        startSession: jest.fn().mockResolvedValue(session),
      });
      const identifier = createIdentifierModelHarness();
      const { service } = createService({ staff, identifier });

      await expect(
        service.update(staffId, { email: 'admin@example.test' }),
      ).rejects.toThrow('write failed');

      expect(identifier.calls.findOneFilters).toEqual([]);
      expect(document.save).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('defaults missing stored roles and authVersion while updating roles without optional services', async () => {
      const document = createStaffDocument({ authVersion: undefined as never });
      document.roles = undefined as never;
      const staff = createStaffModelHarness({ document });
      const { service } = createService({ staff });

      const result = await service.update(staffId, {
        roles: [StaffRole.Admin],
      });

      expect(result.roles).toEqual([StaffRole.Admin]);
      expect(document.authVersion).toBe(1);
      expect(document.save).toHaveBeenCalledWith();
    });

    it('records a system role-change audit without a status-change audit', async () => {
      const document = createStaffDocument({ roles: [StaffRole.Staff] });
      const staff = createStaffModelHarness({ document });
      const securityActivityService = {
        record: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = createService({ staff, securityActivityService });

      await service.update(staffId, { roles: [StaffRole.Admin] });

      expect(securityActivityService.record).toHaveBeenCalledTimes(1);
      expect(securityActivityService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityActivityEventType.RoleChanged,
          actorId: undefined,
        }),
      );
    });

    it('records a status-change audit without a role-change audit', async () => {
      const document = createStaffDocument({
        roles: [StaffRole.Staff],
        status: StaffUserStatus.Active,
      });
      const staff = createStaffModelHarness({ document });
      const securityActivityService = {
        record: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = createService({ staff, securityActivityService });

      await service.update(staffId, { status: StaffUserStatus.Inactive });

      expect(securityActivityService.record).toHaveBeenCalledTimes(1);
      expect(securityActivityService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityActivityEventType.AccountStatusChanged,
          context: {
            previousStatus: StaffUserStatus.Active,
            status: StaffUserStatus.Inactive,
          },
        }),
      );
    });
  });

  describe('queries and public response helpers', () => {
    it('rejects an inactive user from the active lookup', async () => {
      const staff = createStaffModelHarness({
        document: createStaffDocument({ status: StaffUserStatus.Inactive }),
      });
      const { service } = createService({ staff });

      await expect(service.findActiveById(staffId)).rejects.toThrow(
        new NotFoundException('Active staff user not found'),
      );
    });

    it('rejects a missing staff user lookup', async () => {
      const staff = createStaffModelHarness({ findOneResult: null });
      const { service } = createService({ staff });

      await expect(service.findActiveById(staffId)).rejects.toThrow(
        new NotFoundException('Staff user not found'),
      );
    });

    it('returns an active staff document', async () => {
      const document = createStaffDocument({ status: StaffUserStatus.Active });
      const staff = createStaffModelHarness({ document });
      const { service } = createService({ staff });

      await expect(service.findActiveById(staffId)).resolves.toBe(document);
      expect(staff.calls.findOneFilters).toEqual([
        { _id: { $eq: new Types.ObjectId(staffId) } },
      ]);
    });

    it('sends exact filters, sort, skip, and limit values to findAll', async () => {
      const documents = [
        createStaffDocument({ email: 'admin@example.test' }),
        createStaffDocument({ email: 'staff@example.test' }),
      ];
      const staff = createStaffModelHarness({ findResult: documents });
      const { service } = createService({ staff });

      const result = await service.findAll({
        page: 3,
        limit: 5,
        status: StaffUserStatus.Active,
        role: StaffRole.Admin,
      });

      expect(result).toHaveLength(2);
      expect(staff.calls.findFilters).toEqual([
        {
          status: { $eq: StaffUserStatus.Active },
          roles: { $eq: StaffRole.Admin },
        },
      ]);
      expect(staff.calls.sortValues).toEqual([{ email: 1 }]);
      expect(staff.calls.skipValues).toEqual([10]);
      expect(staff.calls.limitValues).toEqual([5]);
    });

    it('normalizes email and selects the password hash for credential lookup', async () => {
      const document = createStaffDocument();
      const staff = createStaffModelHarness({ document });
      const { service } = createService({ staff });

      await expect(
        service.findByEmailWithPassword(' STAFF@EXAMPLE.TEST '),
      ).resolves.toBe(document);

      expect(staff.calls.findOneFilters).toEqual([
        { email: { $eq: 'staff@example.test' } },
      ]);
      const findQuery = staff.model.findOne.mock.results[0]?.value as {
        select: jest.Mock;
      };
      expect(findQuery.select).toHaveBeenCalledWith('+passwordHash');
    });

    it('sends an empty filter when optional findAll filters are absent', async () => {
      const staff = createStaffModelHarness({ findResult: [] });
      const { service } = createService({ staff });

      await expect(service.findAll({ page: 1, limit: 20 })).resolves.toEqual([]);

      expect(staff.calls.findFilters).toEqual([{}]);
      expect(staff.calls.skipValues).toEqual([0]);
      expect(staff.calls.limitValues).toEqual([20]);
    });

    it('records exact touch-last-login and auth-version update requests', async () => {
      const staff = createStaffModelHarness();
      const { service } = createService({ staff });

      await service.touchLastLogin(staffId);
      await service.bumpAuthVersion(staffId);

      expect(staff.calls.updateOneArguments).toEqual([
        [
          { _id: { $eq: new Types.ObjectId(staffId) } },
          { $set: { lastLoginAt: expect.any(Date) } },
        ],
        [
          { _id: { $eq: new Types.ObjectId(staffId) } },
          { $inc: { authVersion: 1 } },
        ],
      ]);
    });

    it('uses safe public defaults and redacts stored credentials in responses', () => {
      const { service } = createService();

      const result = service.toResponse({
        _id: new Types.ObjectId(staffId),
        passwordHash: 'stored-hash',
      });

      expect(result).toMatchObject({
        id: staffId,
        email: '',
        displayName: '',
        roles: [StaffRole.Staff],
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
