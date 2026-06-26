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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditActor } from '../common/audit/audit-context';
import { StaffRole } from '../common/enums/library-status.enum';
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
@ApiForbiddenResponse({ description: 'Staff or admin role is required.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.Staff, StaffRole.Admin)
export class BorrowingsController {
  constructor(private readonly borrowingsService: BorrowingsService) {}

  @Post()
  @ApiOkResponse({ type: BorrowingResponseDto })
  create(
    @Body() dto: CreateBorrowingDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingsService.create(dto, actor);
  }

  @Get('overdue')
  @ApiOkResponse({ type: BorrowingResponseDto, isArray: true })
  findOverdue(
    @Query() query: BorrowingQueryDto,
  ): Promise<BorrowingResponseDto[]> {
    return this.borrowingsService.findOverdue(query);
  }

  @Get()
  @ApiOkResponse({ type: BorrowingResponseDto, isArray: true })
  findAll(@Query() query: BorrowingQueryDto): Promise<BorrowingResponseDto[]> {
    return this.borrowingsService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: BorrowingResponseDto })
  findOne(@Param('id') id: string): Promise<BorrowingResponseDto> {
    return this.borrowingsService.findOne(id);
  }

  @Post(':id/return')
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
