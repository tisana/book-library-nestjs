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
import { BookCategoriesService } from './book-categories.service';
import {
  BookCategoryQueryDto,
  BookCategoryResponseDto,
  CreateBookCategoryDto,
  UpdateBookCategoryDto,
} from './dto/book-category.dto';

@Controller('book-categories')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({ description: 'Required permission is missing.' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookCategoriesController {
  constructor(private readonly bookCategoriesService: BookCategoriesService) {}

  @Post()
  @RequirePermissions(AuthPermission.CatalogManage)
  create(
    @Body() dto: CreateBookCategoryDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BookCategoryResponseDto> {
    return this.bookCategoriesService.create(dto, actor);
  }

  @Get()
  @RequirePermissions(AuthPermission.CatalogRead)
  findAll(
    @Query() query: BookCategoryQueryDto,
  ): Promise<BookCategoryResponseDto[]> {
    return this.bookCategoriesService.findAll(query);
  }

  @Patch(':id')
  @RequirePermissions(AuthPermission.CatalogManage)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookCategoryDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BookCategoryResponseDto> {
    return this.bookCategoriesService.update(id, dto, actor);
  }
}
