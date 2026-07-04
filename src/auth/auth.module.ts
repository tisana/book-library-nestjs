import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { MembersModule } from '../members/members.module';
import { StaffUsersModule } from '../staff-users/staff-users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordHasherService } from './password-hasher.service';
import { MemberAuthGuard } from './member-auth.guard';
import { RolesGuard } from './roles.guard';
import {
  AuthClientModelName,
  AuthClientSchema,
} from './schemas/auth-client.schema';
import {
  RefreshTokenFamilyModelName,
  RefreshTokenFamilySchema,
} from './schemas/refresh-token-family.schema';
import {
  SecurityActivityEventModelName,
  SecurityActivityEventSchema,
} from './schemas/security-activity-event.schema';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';
import { TokenSessionService } from './token-session.service';
import { SecurityActivityService } from './security-activity.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    StaffUsersModule,
    MembersModule,
    MongooseModule.forFeature([
      { name: AuthClientModelName, schema: AuthClientSchema },
      { name: RefreshTokenFamilyModelName, schema: RefreshTokenFamilySchema },
      {
        name: SecurityActivityEventModelName,
        schema: SecurityActivityEventSchema,
      },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = (configService.get<string>('auth.jwtExpiresIn') ??
          '1h') as JwtSignOptions['expiresIn'];

        return {
          secret:
            configService.get<string>('auth.jwtSecret') ??
            'development-only-secret',
          signOptions: {
            expiresIn,
            issuer: configService.get<string>('auth.issuer'),
            audience: configService.get<string>('auth.audience'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PasswordHasherService,
    RolesGuard,
    MemberAuthGuard,
    PermissionsService,
    PermissionsGuard,
    TokenSessionService,
    SecurityActivityService,
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    RolesGuard,
    MemberAuthGuard,
    PermissionsService,
    PermissionsGuard,
    TokenSessionService,
    SecurityActivityService,
  ],
})
export class AuthModule {}
