import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../src/auth/auth.module';
import authConfig from '../../src/config/auth.config';
import databaseConfig from '../../src/config/database.config';
import { AuthBenchmarkController } from './auth-benchmark.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [authConfig, databaseConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('database.uri'),
        directConnection: true,
        serverSelectionTimeoutMS: 5_000,
      }),
    }),
    AuthModule,
  ],
  controllers: [AuthBenchmarkController],
})
export class AuthBenchmarkModule {}
