import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NormalizedAuthContext } from '../common/enums/auth-permission.enum';

export interface AuthenticatedRequestUser {
  id: string;
  subjectId: string;
  roleArea: NormalizedAuthContext['roleArea'];
  permissions: NormalizedAuthContext['permissions'];
  authVersion: number;
  authContext: NormalizedAuthContext;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

export function getRequestAuthContext(
  user?: Partial<AuthenticatedRequestUser>,
): NormalizedAuthContext | undefined {
  return user?.authContext;
}
