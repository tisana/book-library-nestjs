import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BooksController } from './books/books.controller';
import { BooksModule } from './books/books.module';
import { BookCategoriesModule } from './book-categories/book-categories.module';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HealthModule } from './health/health.module';
import { LoggerMiddleware } from './logger.middleware';
import { MembersModule } from './members/members.module';
import { MembershipTypesModule } from './membership-types/membership-types.module';
import { StaffUsersModule } from './staff-users/staff-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [authConfig, databaseConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('database.uri') ??
          'mongodb://localhost:27017/bookstore',
        directConnection: true,
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    AuthModule,
    StaffUsersModule,
    HealthModule,
    BookCategoriesModule,
    BooksModule,
    MembershipTypesModule,
    MembersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes(BooksController);
  }
}
