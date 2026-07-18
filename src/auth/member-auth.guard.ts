import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  AuthPermission,
  NormalizedAuthContext,
} from '../common/enums/auth-permission.enum';
import {
  SecurityActivityActorType,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';
import { SecurityActivityService } from './security-activity.service';

@Injectable()
export class MemberAuthGuard implements CanActivate {
  constructor(
    @Optional()
    private readonly securityActivityService?: SecurityActivityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: {
        roleArea?: string;
        permissions?: AuthPermission[];
        authContext?: NormalizedAuthContext;
      };
    }>();
    const authContext = request.user?.authContext ?? request.user;

    if (authContext?.roleArea !== 'member') {
      await this.recordDenial(context, authContext, 'member-session-required');
      throw new ForbiddenException('Member session is required');
    }

    if (!authContext.permissions?.includes(AuthPermission.MemberSelfRead)) {
      await this.recordDenial(
        context,
        authContext,
        'member-self-permission-required',
      );
      throw new ForbiddenException(
        'Member self-service permission is required',
      );
    }

    return true;
  }

  private async recordDenial(
    context: ExecutionContext,
    authContext:
      | { roleArea?: string; subjectId?: string; id?: string }
      | undefined,
    reasonCategory: string,
  ): Promise<void> {
    if (!this.securityActivityService) return;
    await this.securityActivityService
      .record({
        eventType: SecurityActivityEventType.AuthorizationDenied,
        actorType:
          authContext?.roleArea === 'staff'
            ? SecurityActivityActorType.Staff
            : authContext?.roleArea === 'member'
              ? SecurityActivityActorType.Member
              : SecurityActivityActorType.Unknown,
        ...(authContext?.subjectId || authContext?.id
          ? { actorId: authContext.subjectId ?? authContext.id }
          : {}),
        targetType: context.getClass()?.name || 'controller',
        targetId: context.getHandler()?.name || 'handler',
        outcome: SecurityActivityOutcome.Denied,
        reasonCategory,
        context: { requiredPermissions: [AuthPermission.MemberSelfRead] },
      })
      .catch(() => undefined);
  }
}
