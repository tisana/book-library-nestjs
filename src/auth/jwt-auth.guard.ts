import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { NormalizedAuthContext } from '../common/enums/auth-permission.enum';
import { IS_PUBLIC_KEY } from './public.decorator';

export interface AuthenticatedRequestUser {
  id: string;
  subjectId: string;
  roleArea: NormalizedAuthContext['roleArea'];
  permissions: NormalizedAuthContext['permissions'];
  authVersion: number;
  authContext: NormalizedAuthContext;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return isPublic === true ? true : super.canActivate(context);
  }
}

export function getRequestAuthContext(
  user?: Partial<AuthenticatedRequestUser>,
): NormalizedAuthContext | undefined {
  return user?.authContext;
}
