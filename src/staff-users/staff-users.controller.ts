import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuditActor } from '../common/audit/audit-context';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import {
  CreateStaffUserDto,
  StaffUserQueryDto,
  StaffUserResponseDto,
  UpdateStaffUserDto,
} from './dto/staff-user.dto';
import { StaffUsersService } from './staff-users.service';

@Controller('staff-users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({ description: 'Required administrator permission is missing.' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffUsersController {
  constructor(private readonly staffUsersService: StaffUsersService) {}

  @Post()
  @RequirePermissions(
    AuthPermission.StaffUsersManage,
    AuthPermission.RolesManage,
  )
  create(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<StaffUserResponseDto> {
    return this.staffUsersService.create(dto, actor);
  }

  @Get()
  @RequirePermissions(AuthPermission.StaffUsersRead, AuthPermission.RolesRead)
  findAll(@Query() query: StaffUserQueryDto): Promise<StaffUserResponseDto[]> {
    return this.staffUsersService.findAll(query);
  }

  @Patch(':id')
  @RequirePermissions(
    AuthPermission.StaffUsersManage,
    AuthPermission.RolesManage,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffUserDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<StaffUserResponseDto> {
    return this.staffUsersService.update(id, dto, actor);
  }
}
