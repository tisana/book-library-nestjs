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
  BookQueryDto,
  BookResponseDto,
  CreateBookDto,
  UpdateBookDto,
} from './dto/book.dto';
import { BooksService } from './books.service';

@Controller('books')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({ description: 'Required permission is missing.' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @RequirePermissions(AuthPermission.CatalogRead)
  findAll(@Query() query: BookQueryDto): Promise<BookResponseDto[]> {
    return this.booksService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(AuthPermission.CatalogRead)
  findOne(@Param('id') id: string): Promise<BookResponseDto> {
    return this.booksService.findOne(id);
  }

  @Post()
  @RequirePermissions(AuthPermission.CatalogManage)
  create(
    @Body() dto: CreateBookDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BookResponseDto> {
    return this.booksService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(AuthPermission.CatalogManage)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BookResponseDto> {
    return this.booksService.update(id, dto, actor);
  }
}
