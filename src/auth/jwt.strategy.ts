import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { StaffRole } from '../common/enums/library-status.enum';
import { MembersService, getMemberId } from '../members/members.service';
import {
  getStaffUserId,
  StaffUsersService,
} from '../staff-users/staff-users.service';

interface JwtPayload {
  sub: string;
  email?: string;
  memberNumber?: string;
  roles?: StaffRole[];
  roleArea?: 'staff' | 'member';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly staffUsersService: StaffUsersService,
    private readonly membersService: MembersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('auth.jwtSecret') ??
        'development-only-secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.roleArea === 'member') {
      const member = await this.membersService.findActiveById(payload.sub);

      return {
        id: getMemberId(member),
        memberNumber: member.memberNumber,
        roleArea: 'member',
      };
    }

    const user = await this.staffUsersService.findActiveById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token subject');
    }

    return {
      id: getStaffUserId(user),
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      roleArea: 'staff',
    };
  }
}
