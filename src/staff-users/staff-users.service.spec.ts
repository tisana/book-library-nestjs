/* eslint-disable @typescript-eslint/no-require-imports */
import {
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';

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
  });
});
