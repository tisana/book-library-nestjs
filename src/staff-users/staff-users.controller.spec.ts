import { AuditActor } from '../common/audit/audit-context';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import {
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import { StaffUsersController } from './staff-users.controller';
import {
  CreateStaffUserDto,
  StaffUserQueryDto,
  StaffUserResponseDto,
  UpdateStaffUserDto,
} from './dto/staff-user.dto';

describe('StaffUsersController', () => {
  const actor: AuditActor = {
    id: 'admin-1',
    email: 'admin@example.test',
    displayName: 'Admin One',
    roles: [StaffRole.Admin],
  };

  function createFixture() {
    const service = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
    };

    return {
      controller: new StaffUsersController(service as never),
      service,
    };
  }

  it('forwards the original create DTO and actor and returns the service response', async () => {
    const { controller, service } = createFixture();
    const createDto: CreateStaffUserDto = {
      email: 'staff@example.test',
      displayName: 'Staff One',
      password: 'ChangeMe12345',
      roles: [StaffRole.Staff],
    };
    const response: StaffUserResponseDto = {
      id: 'staff-1',
      email: 'staff@example.test',
      displayName: 'Staff One',
      roles: [StaffRole.Staff],
      permissions: [AuthPermission.CatalogRead],
      status: StaffUserStatus.Active,
    };
    service.create.mockResolvedValue(response);

    await expect(controller.create(createDto, actor)).resolves.toBe(response);
    expect(service.create).toHaveBeenCalledWith(createDto, actor);
    const [forwardedDto, forwardedActor] = service.create.mock.calls[0] as [
      CreateStaffUserDto,
      AuditActor,
    ];
    expect(forwardedDto).toBe(createDto);
    expect(forwardedActor).toBe(actor);
  });

  it('forwards the exact list query and returns the service response', async () => {
    const { controller, service } = createFixture();
    const query: StaffUserQueryDto = {
      page: 2,
      limit: 20,
      role: StaffRole.Admin,
      status: StaffUserStatus.Suspended,
    };
    const response: StaffUserResponseDto[] = [
      {
        id: 'staff-2',
        email: 'suspended-admin@example.test',
        displayName: 'Suspended Admin',
        roles: [StaffRole.Admin],
        permissions: [AuthPermission.RolesRead],
        status: StaffUserStatus.Suspended,
      },
    ];
    service.findAll.mockResolvedValue(response);

    await expect(controller.findAll(query)).resolves.toBe(response);
    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(service.findAll.mock.calls[0]?.[0]).toBe(query);
  });

  it('forwards the id, original update DTO, and actor and returns the service response', async () => {
    const { controller, service } = createFixture();
    const updateDto: UpdateStaffUserDto = {
      roles: [StaffRole.Admin],
      status: StaffUserStatus.Inactive,
    };
    const response: StaffUserResponseDto = {
      id: 'staff-3',
      email: 'former-staff@example.test',
      displayName: 'Former Staff',
      roles: [StaffRole.Admin],
      permissions: [AuthPermission.RolesManage],
      status: StaffUserStatus.Inactive,
    };
    service.update.mockResolvedValue(response);

    await expect(
      controller.update('staff-3', updateDto, actor),
    ).resolves.toBe(response);
    expect(service.update).toHaveBeenCalledWith('staff-3', updateDto, actor);
    const [forwardedId, forwardedDto, forwardedActor] = service.update.mock
      .calls[0] as [string, UpdateStaffUserDto, AuditActor];
    expect(forwardedId).toBe('staff-3');
    expect(forwardedDto).toBe(updateDto);
    expect(forwardedActor).toBe(actor);
  });
});
