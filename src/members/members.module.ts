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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MemberModelName, schema: MemberSchema },
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
  ],
  exports: [MembersService],
})
export class MembersModule {}
