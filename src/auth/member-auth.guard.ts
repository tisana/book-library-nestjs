import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class MemberAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { roleArea?: string } }>();

    if (request.user?.roleArea !== 'member') {
      throw new ForbiddenException('Member session is required');
    }

    return true;
  }
}
