import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentMemberContext {
  id: string;
  memberNumber: string;
  roleArea: 'member';
}

export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentMemberContext | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: CurrentMemberContext }>();
    return request.user;
  },
);
