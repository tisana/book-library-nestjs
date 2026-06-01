import { BorrowingsRulesService } from './borrowings-rules.service';
import { BorrowingsService } from './borrowings.service';

describe('BorrowingsService', () => {
  function createService(): BorrowingsService {
    return new BorrowingsService(
      {} as never,
      {} as never,
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
});
