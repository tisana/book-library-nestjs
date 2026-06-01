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
import { BorrowingsService } from '../borrowings/borrowings.service';
import {
  BorrowingQueryDto,
  BorrowingResponseDto,
} from '../borrowings/dto/borrowing.dto';
import {
  CreateMemberDto,
  MemberPolicyStatusResponseDto,
  MemberQueryDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MembersService } from './members.service';

@Controller('members')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.Staff, StaffRole.Admin)
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly borrowingsService: BorrowingsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateMemberDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<MemberResponseDto> {
    return this.membersService.create(dto, actor);
  }

  @Get()
  findAll(@Query() query: MemberQueryDto): Promise<MemberResponseDto[]> {
    return this.membersService.findAll(query);
  }

  @Get(':id/policy-status')
  getPolicyStatus(
    @Param('id') id: string,
  ): Promise<MemberPolicyStatusResponseDto> {
    return this.membersService.getPolicyStatus(id);
  }

  @Get(':id/borrowings')
  findBorrowings(
    @Param('id') id: string,
    @Query() query: BorrowingQueryDto,
  ): Promise<BorrowingResponseDto[]> {
    return this.borrowingsService.findByMember(id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<MemberResponseDto> {
    return this.membersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<MemberResponseDto> {
    return this.membersService.update(id, dto, actor);
  }
}
