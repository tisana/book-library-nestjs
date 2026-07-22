import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AuthPermission,
  NormalizedAuthContext,
} from '../common/enums/auth-permission.enum';

export interface CurrentMemberContext {
  id: string;
  subjectId?: string;
  memberNumber: string;
  roleArea: 'member';
  permissions?: AuthPermission[];
  authVersion?: number;
  authContext?: NormalizedAuthContext;
}

export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentMemberContext | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: CurrentMemberContext }>();
    return request.user;
  },
);
