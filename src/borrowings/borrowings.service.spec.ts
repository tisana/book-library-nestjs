import { BorrowingsRulesService } from './borrowings-rules.service';
import { BorrowingsService } from './borrowings.service';
import { UnauthorizedException } from '@nestjs/common';
import { LoanState } from '../common/enums/library-status.enum';
import { BorrowingQueryDto } from './dto/borrowing.dto';

describe('BorrowingsService', () => {
  function createService(
    borrowingModel: Record<string, unknown> = {},
  ): BorrowingsService {
    return new BorrowingsService(
      {} as never,
      borrowingModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new BorrowingsRulesService(),
    );
  }

  it('calculates due dates from the book category loan period in UTC days', () => {
    const service = createService();
    const borrowedAt = new Date('2026-06-01T00:00:00.000Z');

    expect(service.calculateDueAt(borrowedAt, 14).toISOString()).toBe(
      '2026-06-15T00:00:00.000Z',
    );
  });

  it('does not mutate the borrowed date while calculating the due date', () => {
    const service = createService();
    const borrowedAt = new Date('2026-06-01T00:00:00.000Z');

    service.calculateDueAt(borrowedAt, 7);

    expect(borrowedAt.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('requires an authenticated staff actor before creating borrowing records', async () => {
    const service = createService();

    await expect(
      service.create({
        memberId: '665f4d3b8f4c8a001f5f0a12',
        bookId: '665f4d3b8f4c8a001f5f0a13',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requires an authenticated staff actor before returning borrowing records', async () => {
    const service = createService();

    await expect(service.returnBorrowing('borrowing-id')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('filters current borrowings to unreturned active and overdue records', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const populate = jest.fn().mockReturnValue({ sort });
    const find = jest.fn().mockReturnValue({ populate });
    const service = createService({ find });
    const query = {
      currentOnly: true,
      page: 1,
      limit: 20,
    } as BorrowingQueryDto & { currentOnly: boolean };

    await service.findAll(query);

    expect(find).toHaveBeenCalledWith({
      returnedAt: { $exists: false },
      status: { $in: [LoanState.Active, LoanState.Overdue] },
    });
  });
});
