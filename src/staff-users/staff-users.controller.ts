import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditActor } from '../common/audit/audit-context';
import { StaffRole } from '../common/enums/library-status.enum';
import {
  CreateStaffUserDto,
  StaffUserQueryDto,
  StaffUserResponseDto,
} from './dto/staff-user.dto';
import { StaffUsersService } from './staff-users.service';

@Controller('staff-users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({ description: 'Admin role is required.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.Admin)
export class StaffUsersController {
  constructor(private readonly staffUsersService: StaffUsersService) {}

  @Post()
  create(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<StaffUserResponseDto> {
    return this.staffUsersService.create(dto, actor);
  }

  @Get()
  findAll(@Query() query: StaffUserQueryDto): Promise<StaffUserResponseDto[]> {
    return this.staffUsersService.findAll(query);
  }
}
