import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PermissionsService } from '../auth/permissions.service';
import { BookCategoriesController } from './book-categories.controller';
import { BookCategoriesService } from './book-categories.service';
import {
  BookCategoryModelName,
  BookCategorySchema,
} from './schemas/book-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookCategoryModelName, schema: BookCategorySchema },
    ]),
  ],
  controllers: [BookCategoriesController],
  providers: [BookCategoriesService, PermissionsGuard, PermissionsService],
  exports: [BookCategoriesService],
})
export class BookCategoriesModule {}
