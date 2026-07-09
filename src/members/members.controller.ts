import {
  Body,
  Controller,
  ForbiddenException,
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
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentMember } from '../auth/current-member.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MemberAuthGuard } from '../auth/member-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuditActor } from '../common/audit/audit-context';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import { BorrowingsService } from '../borrowings/borrowings.service';
import {
  BorrowingQueryDto,
  BorrowingResponseDto,
} from '../borrowings/dto/borrowing.dto';
import {
  MemberBorrowingsResponseDto,
  MemberSelfServicePolicyStatusDto,
  MemberSelfServiceProfileDto,
} from './dto/member-self-service.dto';
import {
  CreateMemberDto,
  MemberPolicyStatusResponseDto,
  MemberQueryDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MembersService } from './members.service';

@Controller('members')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({ description: 'Required permission is missing.' })
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly borrowingsService: BorrowingsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(AuthPermission.MembersManage)
  create(
    @Body() dto: CreateMemberDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<MemberResponseDto> {
    return this.membersService.create(dto, actor);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(AuthPermission.MembersRead)
  findAll(@Query() query: MemberQueryDto): Promise<MemberResponseDto[]> {
    return this.membersService.findAll(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, MemberAuthGuard)
  @ApiOperation({ summary: 'Get the current member profile' })
  @ApiOkResponse({ type: MemberSelfServiceProfileDto })
  getMe(
    @CurrentMember() member: { id: string },
  ): Promise<MemberSelfServiceProfileDto> {
    return this.membersService.findSelfServiceProfile(member.id);
  }

  @Get('me/policy-status')
  @UseGuards(JwtAuthGuard, MemberAuthGuard)
  @ApiOperation({ summary: 'Get the current member policy status' })
  @ApiOkResponse({ type: MemberSelfServicePolicyStatusDto })
  getMyPolicyStatus(
    @CurrentMember() member: { id: string },
  ): Promise<MemberPolicyStatusResponseDto> {
    return this.membersService.getPolicyStatus(member.id);
  }

  @Get('me/borrowings')
  @UseGuards(JwtAuthGuard, MemberAuthGuard)
  @ApiOperation({ summary: 'Get current member borrowings' })
  @ApiOkResponse({ type: MemberBorrowingsResponseDto, isArray: true })
  findMyBorrowings(
    @CurrentMember() member: { id: string },
    @Query() query: BorrowingQueryDto,
  ): Promise<BorrowingResponseDto[]> {
    this.rejectUserSuppliedMemberId(query, member.id);
    return this.borrowingsService.findByMember(member.id, query);
  }

  @Get('me/borrowings/:borrowingId')
  @UseGuards(JwtAuthGuard, MemberAuthGuard)
  @ApiOperation({ summary: 'Get one current-member-owned borrowing' })
  @ApiOkResponse({ type: MemberBorrowingsResponseDto })
  findMyBorrowing(
    @CurrentMember() member: { id: string },
    @Param('borrowingId') borrowingId: string,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingsService.findOneForMember(borrowingId, member.id);
  }

  @Get(':id/policy-status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(AuthPermission.MembersRead)
  getPolicyStatus(
    @Param('id') id: string,
  ): Promise<MemberPolicyStatusResponseDto> {
    return this.membersService.getPolicyStatus(id);
  }

  @Get(':id/borrowings')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(AuthPermission.MembersRead)
  findBorrowings(
    @Param('id') id: string,
    @Query() query: BorrowingQueryDto,
  ): Promise<BorrowingResponseDto[]> {
    return this.borrowingsService.findByMember(id, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(AuthPermission.MembersRead)
  findOne(@Param('id') id: string): Promise<MemberResponseDto> {
    return this.membersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(AuthPermission.MembersManage)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<MemberResponseDto> {
    return this.membersService.update(id, dto, actor);
  }

  private rejectUserSuppliedMemberId(
    query: BorrowingQueryDto,
    authenticatedMemberId: string,
  ): void {
    if (query.memberId && query.memberId !== authenticatedMemberId) {
      throw new ForbiddenException('Member id must come from the token');
    }
  }
}
