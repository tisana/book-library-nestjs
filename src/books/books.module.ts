import { Module, Global } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

// @Global()
@Module({
    controllers: [BooksController],
    providers: [BooksService],
    exports: [BooksService]
})
export class BooksModule {
    // constructor(private booksService: BooksService){}
}
