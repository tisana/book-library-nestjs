import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/permissions.guard';
import { RequirePermissions } from '../../src/auth/permissions.decorator';
import { AuthPermission } from '../../src/common/enums/auth-permission.enum';

export const authBenchmarkResponse = Object.freeze({ ok: true });

@Controller('__test/auth-benchmark')
export class AuthBenchmarkController {
  @Get('unprotected')
  unprotected() {
    return authBenchmarkResponse;
  }

  @Get('protected')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(AuthPermission.CatalogRead)
  protected() {
    return authBenchmarkResponse;
  }
}
