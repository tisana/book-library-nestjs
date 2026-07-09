import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuditActor } from '../common/audit/audit-context';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import { BorrowingsService } from './borrowings.service';
import {
  BorrowingQueryDto,
  BorrowingResponseDto,
  CreateBorrowingDto,
  ReturnBorrowingDto,
} from './dto/borrowing.dto';

@Controller('borrowings')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({ description: 'Required permission is missing.' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BorrowingsController {
  constructor(private readonly borrowingsService: BorrowingsService) {}

  @Post()
  @RequirePermissions(AuthPermission.BorrowingsManage)
  @ApiOkResponse({ type: BorrowingResponseDto })
  create(
    @Body() dto: CreateBorrowingDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingsService.create(dto, actor);
  }

  @Get('overdue')
  @RequirePermissions(AuthPermission.BorrowingsRead)
  @ApiOkResponse({ type: BorrowingResponseDto, isArray: true })
  findOverdue(
    @Query() query: BorrowingQueryDto,
  ): Promise<BorrowingResponseDto[]> {
    return this.borrowingsService.findOverdue(query);
  }

  @Get()
  @RequirePermissions(AuthPermission.BorrowingsRead)
  @ApiOkResponse({ type: BorrowingResponseDto, isArray: true })
  findAll(@Query() query: BorrowingQueryDto): Promise<BorrowingResponseDto[]> {
    return this.borrowingsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(AuthPermission.BorrowingsRead)
  @ApiOkResponse({ type: BorrowingResponseDto })
  findOne(@Param('id') id: string): Promise<BorrowingResponseDto> {
    return this.borrowingsService.findOne(id);
  }

  @Post(':id/return')
  @RequirePermissions(AuthPermission.BorrowingsManage)
  @HttpCode(200)
  @ApiOkResponse({ type: BorrowingResponseDto })
  returnBorrowing(
    @Param('id') id: string,
    @Body() dto: ReturnBorrowingDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingsService.returnBorrowing(id, dto, actor);
  }
}
