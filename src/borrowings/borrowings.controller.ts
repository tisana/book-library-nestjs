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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.Staff, StaffRole.Admin)
export class BorrowingsController {
  constructor(private readonly borrowingsService: BorrowingsService) {}

  @Post()
  create(
    @Body() dto: CreateBorrowingDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingsService.create(dto, actor);
  }

  @Get('overdue')
  findOverdue(
    @Query() query: BorrowingQueryDto,
  ): Promise<BorrowingResponseDto[]> {
    return this.borrowingsService.findOverdue(query);
  }

  @Get()
  findAll(@Query() query: BorrowingQueryDto): Promise<BorrowingResponseDto[]> {
    return this.borrowingsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<BorrowingResponseDto> {
    return this.borrowingsService.findOne(id);
  }

  @Post(':id/return')
  @HttpCode(200)
  returnBorrowing(
    @Param('id') id: string,
    @Body() dto: ReturnBorrowingDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingsService.returnBorrowing(id, dto, actor);
  }
}
