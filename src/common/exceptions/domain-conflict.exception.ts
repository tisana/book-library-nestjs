import { ConflictException } from '@nestjs/common';

export interface DomainConflictResponse {
  error: 'DomainConflict';
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export class DomainConflictException extends ConflictException {
  constructor(
    message: string,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super({
      error: 'DomainConflict',
      message,
      code,
      details,
    } satisfies DomainConflictResponse);
  }
}
