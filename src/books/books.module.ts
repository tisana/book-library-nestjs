import { Module, Global } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { MongooseModule } from '@nestjs/mongoose';
import { BookSchema } from './schemas/book.schema';

// @Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: 'Book', schema: BookSchema }])],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {
  // constructor(private booksService: BooksService){}
}
