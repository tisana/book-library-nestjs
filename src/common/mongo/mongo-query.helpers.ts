import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsLiteral(value: string): RegExp {
  return new RegExp(escapeRegExp(value), 'i');
}

export function toMongoObjectId(
  value: string,
  fieldName = 'id',
): Types.ObjectId {
  if (!/^[0-9a-fA-F]{24}$/.test(value) || !Types.ObjectId.isValid(value)) {
    throw new BadRequestException(
      `${fieldName} must be a valid MongoDB ObjectId`,
    );
  }

  return new Types.ObjectId(value);
}

export function equals<T>(value: T): { $eq: T } {
  return { $eq: value };
}
