import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MemberAuthGuard } from '../auth/member-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PermissionsService } from '../auth/permissions.service';
import { BorrowingsModule } from '../borrowings/borrowings.module';
import { MembershipTypesModule } from '../membership-types/membership-types.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberModelName, MemberSchema } from './schemas/member.schema';
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
import { SecurityActivityService } from '../auth/security-activity.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MemberModelName, schema: MemberSchema },
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
    MembershipTypesModule,
    BorrowingsModule,
  ],
  controllers: [MembersController],
  providers: [
    MembersService,
    MemberAuthGuard,
    PermissionsGuard,
    PermissionsService,
    SecurityActivityService,
  ],
  exports: [MembersService],
})
export class MembersModule {}
