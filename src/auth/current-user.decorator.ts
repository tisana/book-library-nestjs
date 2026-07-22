import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuditActor } from '../common/audit/audit-context';
import { AuthenticatedRequestUser } from './jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): (AuditActor & Partial<AuthenticatedRequestUser>) | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuditActor & Partial<AuthenticatedRequestUser> }>();
    return request.user;
  },
);
