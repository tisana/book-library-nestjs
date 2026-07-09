import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PermissionsService } from '../auth/permissions.service';
import { MembershipTypesController } from './membership-types.controller';
import { MembershipTypesService } from './membership-types.service';
import {
  MembershipTypeModelName,
  MembershipTypeSchema,
} from './schemas/membership-type.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MembershipTypeModelName, schema: MembershipTypeSchema },
    ]),
  ],
  controllers: [MembershipTypesController],
  providers: [MembershipTypesService, PermissionsGuard, PermissionsService],
  exports: [MembershipTypesService],
})
export class MembershipTypesModule {}
