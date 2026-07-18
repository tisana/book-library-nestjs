import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsService } from './permissions.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import {
  SecurityActivityActorType,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';
import { SecurityActivityService } from './security-activity.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    @Optional()
    private readonly securityActivityService?: SecurityActivityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      await this.recordDenial(context, authContext, [], 'permission-policy-required');
      throw new ForbiddenException('Permission policy is required');
    }

    const requiresStaffPermission = requiredPermissions.some(
      (permission) => permission !== AuthPermission.MemberSelfRead,
    );

    if (requiresStaffPermission && authContext?.roleArea === 'member') {
      await this.recordDenial(
        context,
        authContext,
        requiredPermissions,
        'staff-permission-required',
      );
      throw new ForbiddenException('Staff permission is required');
    }

    if (
      !this.permissionsService.hasEveryPermission(
        authContext,
        requiredPermissions,
      )
    ) {
      await this.recordDenial(
        context,
        authContext,
        requiredPermissions,
        'required-permission-missing',
      );
      throw new ForbiddenException('Required permission is missing');
    }

    return true;
  }

  private async recordDenial(
    context: ExecutionContext,
    authContext: ReturnType<PermissionsService['normalizeRequestContext']>,
    requiredPermissions: AuthPermission[],
    reasonCategory: string,
  ): Promise<void> {
    if (!this.securityActivityService) return;
    await this.securityActivityService
      .record({
        eventType: SecurityActivityEventType.AuthorizationDenied,
        actorType:
          authContext?.roleArea === 'member'
            ? SecurityActivityActorType.Member
            : authContext?.roleArea === 'staff'
              ? SecurityActivityActorType.Staff
              : SecurityActivityActorType.Unknown,
        ...(authContext?.subjectId ? { actorId: authContext.subjectId } : {}),
        targetType: context.getClass()?.name || 'controller',
        targetId: context.getHandler()?.name || 'handler',
        outcome: SecurityActivityOutcome.Denied,
        reasonCategory,
        context: { requiredPermissions },
      })
      .catch(() => undefined);
  }
}
