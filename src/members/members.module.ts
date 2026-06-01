import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipTypesModule } from '../membership-types/membership-types.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberModelName, MemberSchema } from './schemas/member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MemberModelName, schema: MemberSchema }]),
    MembershipTypesModule,
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
