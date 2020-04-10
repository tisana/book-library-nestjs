import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BooksController } from './books/books.controller';
import { BooksModule } from './books/books.module';
import { LoggerMiddleware } from './logger.middleware';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    BooksModule,
    MongooseModule.forRoot('mongodb://localhost/bookstore'),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes(BooksController);
  }
}
