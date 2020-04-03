import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { BookDto } from './book.dto';

@Controller('books')
export class BooksController {
    @Get()
    findAll(@Query('author') author:string): string {
        console.log('author ${author}');
        return "all books " + author;
    }

    @Get(':id')
    fineOne(@Param('id') id:string): string {
        console.log(id);
        return "book of #${id}";
    }

    @Post()
    create(@Body() bookDto: BookDto): string {
        console.log(bookDto);
        return "create new books";
    }
}
