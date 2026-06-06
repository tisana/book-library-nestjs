import { BadRequestException } from '@nestjs/common';
import {
  containsLiteral,
  equals,
  escapeRegExp,
  toMongoObjectId,
} from './mongo-query.helpers';

describe('mongo query helpers', () => {
  it('escapes regex metacharacters for literal search', () => {
    expect(escapeRegExp('Clean.*(Code)?')).toBe('Clean\\.\\*\\(Code\\)\\?');

    const search = containsLiteral('Clean.*(Code)?');
    expect(search.test('clean.*(code)?')).toBe(true);
    expect(search.test('clean something code')).toBe(false);
  });

  it('casts valid MongoDB ObjectIds and rejects invalid identifiers', () => {
    const objectId = toMongoObjectId('665f4d3b8f4c8a001f5f0a12');

    expect(objectId.toString()).toBe('665f4d3b8f4c8a001f5f0a12');
    expect(() => toMongoObjectId('not-an-id')).toThrow(BadRequestException);
  });

  it('wraps scalar values as explicit equality matches', () => {
    expect(equals('active')).toEqual({ $eq: 'active' });
  });
});
