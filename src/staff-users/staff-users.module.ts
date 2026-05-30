import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { RolesGuard } from '../auth/roles.guard';
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
    ]),
  ],
  controllers: [StaffUsersController],
  providers: [StaffUsersService, PasswordHasherService, RolesGuard],
  exports: [StaffUsersService],
})
export class StaffUsersModule {}
