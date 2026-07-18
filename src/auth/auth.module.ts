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
import { JwtAuthGuard } from './jwt-auth.guard';
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
import {
  AuthIdentifierModelName,
  AuthIdentifierSchema,
} from './schemas/auth-identifier.schema';
import {
  AuthIdentifierOperationModelName,
  AuthIdentifierOperationSchema,
} from './schemas/auth-identifier-operation.schema';
import {
  AuthIdentifierRepairBatchModelName,
  AuthIdentifierRepairBatchSchema,
} from './schemas/auth-identifier-repair-batch.schema';
import {
  RefreshTokenReplayMarkerModelName,
  RefreshTokenReplayMarkerSchema,
} from './schemas/refresh-token-replay-marker.schema';
import {
  AuthThrottleBucketModelName,
  AuthThrottleBucketSchema,
} from './schemas/auth-throttle-bucket.schema';
import { AuthIdentifierService } from './auth-identifier.service';
import { AuthIdentifierRepairKeyPolicyService } from './auth-identifier-repair-key-policy.service';
import { AuthBrowserOriginGuard } from './auth-browser-origin.guard';
import { AuthThrottleService } from './auth-throttle.service';
import { AuthSourceIdentityService } from './auth-source-identity.service';
import { AuthIdentifierReconciliationService } from './auth-identifier-reconciliation.service';
import { AuthEndpointThrottleGuard } from './auth-endpoint-throttle.guard';
import {
  StaffUserModelName,
  StaffUserSchema,
} from '../staff-users/schemas/staff-user.schema';
import { MemberModelName, MemberSchema } from '../members/schemas/member.schema';
import { AuthIdentifierRepairAuthorizationService } from './auth-identifier-repair-authorization.service';
import { AuthIdentifierRepairService } from './auth-identifier-repair.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    StaffUsersModule,
    MembersModule,
    MongooseModule.forFeature([
      { name: AuthClientModelName, schema: AuthClientSchema },
      { name: StaffUserModelName, schema: StaffUserSchema },
      { name: MemberModelName, schema: MemberSchema },
      { name: RefreshTokenFamilyModelName, schema: RefreshTokenFamilySchema },
      {
        name: RefreshTokenReplayMarkerModelName,
        schema: RefreshTokenReplayMarkerSchema,
      },
      { name: AuthIdentifierModelName, schema: AuthIdentifierSchema },
      {
        name: AuthIdentifierOperationModelName,
        schema: AuthIdentifierOperationSchema,
      },
      {
        name: AuthIdentifierRepairBatchModelName,
        schema: AuthIdentifierRepairBatchSchema,
      },
      {
        name: AuthThrottleBucketModelName,
        schema: AuthThrottleBucketSchema,
      },
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
    JwtAuthGuard,
    PasswordHasherService,
    RolesGuard,
    MemberAuthGuard,
    PermissionsService,
    PermissionsGuard,
    TokenSessionService,
    SecurityActivityService,
    AuthIdentifierService,
    AuthIdentifierRepairKeyPolicyService,
    AuthBrowserOriginGuard,
    AuthThrottleService,
    AuthSourceIdentityService,
    AuthIdentifierReconciliationService,
    AuthEndpointThrottleGuard,
    AuthIdentifierRepairAuthorizationService,
    AuthIdentifierRepairService,
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
    AuthIdentifierService,
    AuthIdentifierRepairKeyPolicyService,
    AuthBrowserOriginGuard,
    AuthThrottleService,
    AuthSourceIdentityService,
    AuthIdentifierReconciliationService,
    AuthEndpointThrottleGuard,
    JwtAuthGuard,
    AuthIdentifierRepairAuthorizationService,
    AuthIdentifierRepairService,
  ],
})
export class AuthModule {}
