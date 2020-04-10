import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { BookDto } from './dto/book.dto';
import { BooksService } from './books.service';
import { Book } from './interfaces/book.interface';

@Controller('books')
export class BooksController {
  constructor(private booksService: BooksService) {}

  @Get()
  async findAll(@Query('author') author: string): Promise<Book[]> {
    console.log('author ${author}');
    return this.booksService.findAll();
  }

  @Get(':id')
  fineOne(@Param('id') id: string): string {
    console.log(id);
    return 'book of #${id}';
  }

  @Post()
  async create(@Body() bookDto: BookDto) {
    console.log(bookDto);
    return await this.booksService.create(bookDto);
  }
}
