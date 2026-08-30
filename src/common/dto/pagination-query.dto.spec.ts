import { plainToInstance } from 'class-transformer';

import {
  createPaginatedResult,
  PaginationQueryDto,
} from './pagination-query.dto';

describe('PaginationQueryDto public query and result contract', () => {
  it.each([
    { input: {}, label: 'undefined' },
    { input: { page: null, limit: null }, label: 'null' },
    { input: { page: '', limit: '' }, label: 'empty strings' },
  ])('uses defaults for $label page and limit values', ({ input }) => {
    const query = plainToInstance(PaginationQueryDto, input);

    expect(query).toMatchObject({ page: 1, limit: 20 });
  });

  it('uses defaults when decimal and nonnumeric page inputs cannot form integer values', () => {
    const query = plainToInstance(PaginationQueryDto, {
      page: '1.5',
      limit: 'not-a-number',
    });

    expect(query).toMatchObject({ page: 1, limit: 20 });
  });

  it('transforms valid numeric strings and produces the public pagination summary', () => {
    const query = plainToInstance(PaginationQueryDto, { page: '2', limit: '2' });

    expect(query).toMatchObject({ page: 2, limit: 2 });
    expect(createPaginatedResult(['a', 'b'], 5, query)).toEqual({
      items: ['a', 'b'],
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
  });

  it('returns zero total pages when the result total is zero', () => {
    const query = plainToInstance(PaginationQueryDto, {});

    expect(createPaginatedResult([], 0, query)).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });
});
