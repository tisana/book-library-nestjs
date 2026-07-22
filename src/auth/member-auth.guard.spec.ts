import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import { MemberAuthGuard } from './member-auth.guard';

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => function memberRoute() {},
    getClass: () => class MembersController {},
  } as unknown as ExecutionContext;
}

describe('MemberAuthGuard', () => {
  it('records a safe denial when a staff subject enters member self-service', async () => {
    const record = jest.fn().mockResolvedValue(undefined);
    const guard = new MemberAuthGuard({ record } as any);

    await expect(
      guard.canActivate(
        contextFor({
          id: 'staff-1',
          roleArea: 'staff',
          permissions: [AuthPermission.CatalogRead],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'authorization-denied',
        actorType: 'staff',
        actorId: 'staff-1',
        outcome: 'denied',
        reasonCategory: 'member-session-required',
      }),
    );
  });
});
