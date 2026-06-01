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
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditActor } from '../common/audit/audit-context';
import { StaffRole } from '../common/enums/library-status.enum';
import {
  CreateMembershipTypeDto,
  MembershipTypeQueryDto,
  MembershipTypeResponseDto,
  UpdateMembershipTypeDto,
} from './dto/membership-type.dto';
import { MembershipTypesService } from './membership-types.service';

@Controller('membership-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.Staff, StaffRole.Admin)
export class MembershipTypesController {
  constructor(
    private readonly membershipTypesService: MembershipTypesService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateMembershipTypeDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<MembershipTypeResponseDto> {
    return this.membershipTypesService.create(dto, actor);
  }

  @Get()
  findAll(
    @Query() query: MembershipTypeQueryDto,
  ): Promise<MembershipTypeResponseDto[]> {
    return this.membershipTypesService.findAll(query);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipTypeDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<MembershipTypeResponseDto> {
    return this.membershipTypesService.update(id, dto, actor);
  }
}
