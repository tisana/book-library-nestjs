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
  CreateMembershipTypeDto,
  MembershipTypeQueryDto,
  MembershipTypeResponseDto,
  UpdateMembershipTypeDto,
} from './dto/membership-type.dto';
import { MembershipTypesService } from './membership-types.service';

@Controller('membership-types')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({ description: 'Required permission is missing.' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MembershipTypesController {
  constructor(
    private readonly membershipTypesService: MembershipTypesService,
  ) {}

  @Post()
  @RequirePermissions(AuthPermission.MembershipTypesManage)
  create(
    @Body() dto: CreateMembershipTypeDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<MembershipTypeResponseDto> {
    return this.membershipTypesService.create(dto, actor);
  }

  @Get()
  @RequirePermissions(AuthPermission.MembershipTypesRead)
  findAll(
    @Query() query: MembershipTypeQueryDto,
  ): Promise<MembershipTypeResponseDto[]> {
    return this.membershipTypesService.findAll(query);
  }

  @Patch(':id')
  @RequirePermissions(AuthPermission.MembershipTypesManage)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipTypeDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<MembershipTypeResponseDto> {
    return this.membershipTypesService.update(id, dto, actor);
  }
}
