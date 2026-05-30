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
  BookQueryDto,
  BookResponseDto,
  CreateBookDto,
  UpdateBookDto,
} from './dto/book.dto';
import { BooksService } from './books.service';

@Controller('books')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.Staff, StaffRole.Admin)
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  findAll(@Query() query: BookQueryDto): Promise<BookResponseDto[]> {
    return this.booksService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<BookResponseDto> {
    return this.booksService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateBookDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BookResponseDto> {
    return this.booksService.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BookResponseDto> {
    return this.booksService.update(id, dto, actor);
  }
}
