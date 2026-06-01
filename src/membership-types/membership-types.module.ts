import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
  providers: [MembershipTypesService],
  exports: [MembershipTypesService],
})
export class MembershipTypesModule {}
