import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PermissionsService } from '../auth/permissions.service';
import { SecurityActivityService } from '../auth/security-activity.service';
import {
  AuthIdentifierModelName,
  AuthIdentifierSchema,
} from '../auth/schemas/auth-identifier.schema';
import {
  RefreshTokenFamilyModelName,
  RefreshTokenFamilySchema,
} from '../auth/schemas/refresh-token-family.schema';
import {
  SecurityActivityEventModelName,
  SecurityActivityEventSchema,
} from '../auth/schemas/security-activity-event.schema';
import {
  StaffUserModelName,
  StaffUserSchema,
} from './schemas/staff-user.schema';
import { StaffUsersController } from './staff-users.controller';
import { StaffUsersService } from './staff-users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StaffUserModelName, schema: StaffUserSchema },
      { name: AuthIdentifierModelName, schema: AuthIdentifierSchema },
      {
        name: RefreshTokenFamilyModelName,
        schema: RefreshTokenFamilySchema,
      },
      {
        name: SecurityActivityEventModelName,
        schema: SecurityActivityEventSchema,
      },
    ]),
  ],
  controllers: [StaffUsersController],
  providers: [
    StaffUsersService,
    PasswordHasherService,
    JwtAuthGuard,
    PermissionsGuard,
    PermissionsService,
    SecurityActivityService,
  ],
  exports: [StaffUsersService],
})
export class StaffUsersModule {}
