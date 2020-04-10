import { Injectable } from '@nestjs/common';
import { Book } from './interfaces/book.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookDto } from './dto/book.dto';

@Injectable()
export class BooksService {
  constructor(@InjectModel('Book') private bookModel: Model<Book>) {}

  async create(book: BookDto): Promise<Book> {
    const createdBook = new this.bookModel(book);
    return createdBook.save();
  }

  async findAll(): Promise<Book[]> {
    return this.bookModel.find().exec();
  }
}
