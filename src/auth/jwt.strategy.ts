import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthPermission, RoleArea } from '../common/enums/auth-permission.enum';
import { StaffRole } from '../common/enums/library-status.enum';
import { MembersService, getMemberId } from '../members/members.service';
import {
  getStaffUserId,
  StaffUsersService,
} from '../staff-users/staff-users.service';
import { PermissionsService } from './permissions.service';

interface JwtPayload {
  sub: string;
  iss?: string;
  aud?: string | string[];
  jti?: string;
  email?: string;
  memberNumber?: string;
  roles?: StaffRole[];
  roleArea?: RoleArea;
  role_area?: RoleArea;
  scope?: string;
  permissions?: AuthPermission[];
  auth_version?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly staffUsersService: StaffUsersService,
    private readonly membersService: MembersService,
    private readonly permissionsService: PermissionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('auth.jwtSecret') ??
        'development-only-secret',
      issuer: configService.get<string>('auth.issuer'),
      audience: configService.get<string>('auth.audience'),
    });
  }

  async validate(payload: JwtPayload) {
    const roleArea = payload.role_area ?? payload.roleArea;

    if (!payload.sub || !payload.jti || !roleArea) {
      throw new UnauthorizedException('Invalid token claims');
    }

    if (roleArea === 'member') {
      const member = await this.membersService.findActiveById(payload.sub);
      const expectedAuthVersion = member.authVersion ?? 0;

      if ((payload.auth_version ?? 0) !== expectedAuthVersion) {
        throw new UnauthorizedException('Stale token');
      }

      const authContext = this.permissionsService.buildMemberContext(
        member,
        payload,
      );

      return {
        id: getMemberId(member),
        subjectId: getMemberId(member),
        memberNumber: member.memberNumber,
        roleArea: 'member',
        permissions: authContext.permissions,
        authVersion: authContext.authVersion,
        authContext,
      };
    }

    if (roleArea !== 'staff') {
      throw new UnauthorizedException('Invalid token role area');
    }

    const user = await this.staffUsersService.findActiveById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token subject');
    }

    const expectedAuthVersion = user.authVersion ?? 0;

    if ((payload.auth_version ?? 0) !== expectedAuthVersion) {
      throw new UnauthorizedException('Stale token');
    }

    const authContext = this.permissionsService.buildStaffContext(
      user,
      payload,
    );

    return {
      id: getStaffUserId(user),
      subjectId: getStaffUserId(user),
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      roleArea: 'staff',
      permissions: authContext.permissions,
      authVersion: authContext.authVersion,
      authContext,
    };
  }
}
