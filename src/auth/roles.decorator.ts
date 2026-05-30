import { SetMetadata } from '@nestjs/common';
import { StaffRole } from '../common/enums/library-status.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);
