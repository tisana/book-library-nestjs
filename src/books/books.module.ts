import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PermissionsService } from '../auth/permissions.service';
import { BookModelName, BookSchema } from './schemas/book.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BookModelName, schema: BookSchema }]),
  ],
  controllers: [BooksController],
  providers: [BooksService, PermissionsGuard, PermissionsService],
  exports: [BooksService],
})
export class BooksModule {}
