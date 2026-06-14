import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditActor } from '../common/audit/audit-context';
import { StaffRole } from '../common/enums/library-status.enum';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuditActor }>();
    const user = request.user;
    const userRoles = user?.roles ?? [];

    if (!user || !requiredRoles.some((role) => userRoles.includes(role))) {
      throw new ForbiddenException('Required role is missing');
    }

    return true;
  }
}
