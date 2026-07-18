import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthPermission, AuthTokenClaims, permissionsForStaffRoles } from '../common/enums/auth-permission.enum';
import { StaffRole } from '../common/enums/library-status.enum';
import { StaffUsersService, getStaffUserId } from '../staff-users/staff-users.service';
import { AuthIdentifierSubjectType } from './schemas/auth-identifier.schema';

export interface AuthorizedRepairActor {
  subjectType: AuthIdentifierSubjectType.Staff;
  subjectId: string;
  authVersion: number;
  expiresAt: number;
}

@Injectable()
export class AuthIdentifierRepairAuthorizationService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly staffUsersService: StaffUsersService,
    private readonly configService: ConfigService,
  ) {}

  authorizeDryRun(token: string): Promise<AuthorizedRepairActor> {
    return this.authorize(token);
  }

  authorizeMutation(token: string): Promise<AuthorizedRepairActor> {
    return this.authorize(token);
  }

  async authorize(token: string): Promise<AuthorizedRepairActor> {
    if (!token || typeof token !== 'string') throw this.denial();
    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenClaims>(token, {
        secret: this.configService.get<string>('auth.jwtSecret'),
        issuer: this.configService.get<string>('auth.issuer'),
        audience: this.configService.get<string>('auth.audience'),
      });
      if (
        payload.role_area !== 'staff' ||
        !payload.permissions?.includes(AuthPermission.AuthIdentifiersManage)
      ) {
        throw this.denial();
      }
      const account = await this.staffUsersService.findActiveById(payload.sub);
      const currentPermissions = permissionsForStaffRoles(account.roles ?? []);
      if (
        !account.roles?.includes(StaffRole.Admin) ||
        !currentPermissions.includes(AuthPermission.AuthIdentifiersManage) ||
        (account.authVersion ?? 0) !== payload.auth_version
      ) {
        throw this.denial();
      }
      return {
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId: getStaffUserId(account),
        authVersion: account.authVersion ?? 0,
        expiresAt: payload.exp,
      };
    } catch {
      throw this.denial();
    }
  }

  private denial(): UnauthorizedException {
    return new UnauthorizedException('Repair authorization required');
  }
}
