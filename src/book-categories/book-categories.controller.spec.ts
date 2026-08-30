import { AuditActor } from '../common/audit/audit-context';
import {
  LibraryItemStatus,
  StaffRole,
} from '../common/enums/library-status.enum';
import { BookCategoriesController } from './book-categories.controller';
import {
  BookCategoryQueryDto,
  BookCategoryResponseDto,
  CreateBookCategoryDto,
  UpdateBookCategoryDto,
} from './dto/book-category.dto';

describe('BookCategoriesController', () => {
  const actor: AuditActor = {
    id: 'staff-1',
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
      controller: new BookCategoriesController(service as never),
      service,
    };
  }

  it('forwards the original create DTO and actor and returns the service response', async () => {
    const { controller, service } = createFixture();
    const createDto: CreateBookCategoryDto = {
      code: 'FIC',
      name: 'Fiction',
      loanPeriodDays: 21,
    };
    const response: BookCategoryResponseDto = {
      id: 'category-1',
      code: 'FIC',
      name: 'Fiction',
      loanPeriodDays: 21,
      status: LibraryItemStatus.Active,
    };
    service.create.mockResolvedValue(response);

    await expect(controller.create(createDto, actor)).resolves.toBe(response);
    expect(service.create).toHaveBeenCalledWith(createDto, actor);
    const [forwardedDto, forwardedActor] = service.create.mock.calls[0] as [
      CreateBookCategoryDto,
      AuditActor,
    ];
    expect(forwardedDto).toBe(createDto);
    expect(forwardedActor).toBe(actor);
  });

  it('forwards the exact list query and returns the service response', async () => {
    const { controller, service } = createFixture();
    const query: BookCategoryQueryDto = {
      page: 2,
      limit: 10,
      status: LibraryItemStatus.Deactivated,
    };
    const response: BookCategoryResponseDto[] = [
      {
        id: 'category-2',
        code: 'ARCH',
        name: 'Archive',
        loanPeriodDays: 1,
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
    const updateDto: UpdateBookCategoryDto = {
      loanPeriodDays: 28,
      status: LibraryItemStatus.Deactivated,
    };
    const response: BookCategoryResponseDto = {
      id: 'category-3',
      code: 'REF',
      name: 'Reference',
      loanPeriodDays: 28,
      status: LibraryItemStatus.Deactivated,
    };
    service.update.mockResolvedValue(response);

    await expect(
      controller.update('category-3', updateDto, actor),
    ).resolves.toBe(response);
    expect(service.update).toHaveBeenCalledWith('category-3', updateDto, actor);
    const [forwardedId, forwardedDto, forwardedActor] = service.update.mock
      .calls[0] as [string, UpdateBookCategoryDto, AuditActor];
    expect(forwardedId).toBe('category-3');
    expect(forwardedDto).toBe(updateDto);
    expect(forwardedActor).toBe(actor);
  });
});
