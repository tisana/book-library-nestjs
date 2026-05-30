import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuditActor } from '../common/audit/audit-context';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuditActor | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuditActor }>();
    return request.user;
  },
);
