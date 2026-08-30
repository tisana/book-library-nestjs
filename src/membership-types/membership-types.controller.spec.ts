import { AuditActor } from '../common/audit/audit-context';
import {
  LibraryItemStatus,
  StaffRole,
} from '../common/enums/library-status.enum';
import { MembershipTypesController } from './membership-types.controller';
import {
  CreateMembershipTypeDto,
  MembershipTypeQueryDto,
  MembershipTypeResponseDto,
  UpdateMembershipTypeDto,
} from './dto/membership-type.dto';

describe('MembershipTypesController', () => {
  const actor: AuditActor = {
    id: 'staff-2',
    email: 'librarian@example.test',
    displayName: 'Librarian Two',
    roles: [StaffRole.Staff],
  };

  function createFixture() {
    const service = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
    };

    return {
      controller: new MembershipTypesController(service as never),
      service,
    };
  }

  it('forwards the original create DTO and actor and returns the service response', async () => {
    const { controller, service } = createFixture();
    const createDto: CreateMembershipTypeDto = {
      code: 'STANDARD',
      name: 'Standard Membership',
      maxActiveLoans: 5,
    };
    const response: MembershipTypeResponseDto = {
      id: 'membership-1',
      code: 'STANDARD',
      name: 'Standard Membership',
      maxActiveLoans: 5,
      status: LibraryItemStatus.Active,
    };
    service.create.mockResolvedValue(response);

    await expect(controller.create(createDto, actor)).resolves.toBe(response);
    expect(service.create).toHaveBeenCalledWith(createDto, actor);
    const [forwardedDto, forwardedActor] = service.create.mock.calls[0] as [
      CreateMembershipTypeDto,
      AuditActor,
    ];
    expect(forwardedDto).toBe(createDto);
    expect(forwardedActor).toBe(actor);
  });

  it('forwards the exact list query and returns the service response', async () => {
    const { controller, service } = createFixture();
    const query: MembershipTypeQueryDto = {
      page: 3,
      limit: 5,
      status: LibraryItemStatus.Deactivated,
    };
    const response: MembershipTypeResponseDto[] = [
      {
        id: 'membership-2',
        code: 'ARCHIVED',
        name: 'Archived Membership',
        maxActiveLoans: 0,
        status: LibraryItemStatus.Deactivated,
      },
    ];
    service.findAll.mockResolvedValue(response);

    await expect(controller.findAll(query)).resolves.toBe(response);
    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(service.findAll.mock.calls[0]?.[0]).toBe(query);
  });

  it('forwards the id, original update DTO, and actor and returns the service response', async () => {
    const { controller, service } = createFixture();
    const updateDto: UpdateMembershipTypeDto = {
      maxActiveLoans: 12,
      status: LibraryItemStatus.Deactivated,
    };
    const response: MembershipTypeResponseDto = {
      id: 'membership-3',
      code: 'PREMIUM',
      name: 'Premium Membership',
      maxActiveLoans: 12,
      status: LibraryItemStatus.Deactivated,
    };
    service.update.mockResolvedValue(response);

    await expect(
      controller.update('membership-3', updateDto, actor),
    ).resolves.toBe(response);
    expect(service.update).toHaveBeenCalledWith(
      'membership-3',
      updateDto,
      actor,
    );
    const [forwardedId, forwardedDto, forwardedActor] = service.update.mock
      .calls[0] as [string, UpdateMembershipTypeDto, AuditActor];
    expect(forwardedId).toBe('membership-3');
    expect(forwardedDto).toBe(updateDto);
    expect(forwardedActor).toBe(actor);
  });
});
