import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsService } from './permissions.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<AuthPermission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    const authContext = this.permissionsService.normalizeRequestContext(
      request.user as Parameters<
        PermissionsService['normalizeRequestContext']
      >[0],
    );

    if (requiredPermissions.length === 0) {
      throw new ForbiddenException('Permission policy is required');
    }

    const requiresStaffPermission = requiredPermissions.some(
      (permission) => permission !== AuthPermission.MemberSelfRead,
    );

    if (requiresStaffPermission && authContext?.roleArea === 'member') {
      throw new ForbiddenException('Staff permission is required');
    }

    if (
      !this.permissionsService.hasEveryPermission(
        authContext,
        requiredPermissions,
      )
    ) {
      throw new ForbiddenException('Required permission is missing');
    }

    return true;
  }
}
