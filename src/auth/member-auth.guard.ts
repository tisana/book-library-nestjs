import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AuthPermission,
  NormalizedAuthContext,
} from '../common/enums/auth-permission.enum';

@Injectable()
export class MemberAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: {
        roleArea?: string;
        permissions?: AuthPermission[];
        authContext?: NormalizedAuthContext;
      };
    }>();
    const authContext = request.user?.authContext ?? request.user;

    if (authContext?.roleArea !== 'member') {
      throw new ForbiddenException('Member session is required');
    }

    if (!authContext.permissions?.includes(AuthPermission.MemberSelfRead)) {
      throw new ForbiddenException(
        'Member self-service permission is required',
      );
    }

    return true;
  }
}
