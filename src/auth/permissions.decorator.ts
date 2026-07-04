import { SetMetadata } from '@nestjs/common';
import { AuthPermission } from '../common/enums/auth-permission.enum';

export const PERMISSIONS_KEY = 'auth:permissions';

export const RequirePermissions = (...permissions: AuthPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
