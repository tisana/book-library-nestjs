import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { StaffRole } from '../common/enums/library-status.enum';
import {
  getStaffUserId,
  StaffUsersService,
} from '../staff-users/staff-users.service';

interface JwtPayload {
  sub: string;
  email: string;
  roles: StaffRole[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly staffUsersService: StaffUsersService,
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
    const user = await this.staffUsersService.findActiveById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token subject');
    }

    return {
      id: getStaffUserId(user),
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    };
  }
}
