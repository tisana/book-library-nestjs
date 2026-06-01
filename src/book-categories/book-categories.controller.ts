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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditActor } from '../common/audit/audit-context';
import { StaffRole } from '../common/enums/library-status.enum';
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
@ApiForbiddenResponse({ description: 'Staff or admin role is required.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.Staff, StaffRole.Admin)
export class BookCategoriesController {
  constructor(private readonly bookCategoriesService: BookCategoriesService) {}

  @Post()
  create(
    @Body() dto: CreateBookCategoryDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BookCategoryResponseDto> {
    return this.bookCategoriesService.create(dto, actor);
  }

  @Get()
  findAll(
    @Query() query: BookCategoryQueryDto,
  ): Promise<BookCategoryResponseDto[]> {
    return this.bookCategoriesService.findAll(query);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookCategoryDto,
    @CurrentUser() actor?: AuditActor,
  ): Promise<BookCategoryResponseDto> {
    return this.bookCategoriesService.update(id, dto, actor);
  }
}
