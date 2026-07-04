import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordHasherService } from './password-hasher.service';
import {
  MemberAuthStatus,
  MemberStatus,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import {
  memberRolePermissions,
  permissionsForStaffRoles,
} from '../common/enums/auth-permission.enum';
import { MemberLoginDto, MemberLoginResponseDto } from './dto/member-auth.dto';
import { MembersService, getMemberId } from '../members/members.service';
import { LoginDto, LoginResponseDto } from '../staff-users/dto/staff-user.dto';
import {
  getStaffUserId,
  StaffUsersService,
} from '../staff-users/staff-users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly staffUsersService: StaffUsersService,
    private readonly membersService: MembersService | undefined,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.staffUsersService.findByEmailWithPassword(
      dto.email,
    );

    if (
      !user ||
      user.status !== StaffUserStatus.Active ||
      !(await this.passwordHasher.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid staff credentials');
    }

    const userId = getStaffUserId(user);

    await this.staffUsersService.touchLastLogin(userId);
    const permissions = permissionsForStaffRoles(user.roles);
    const scope = permissions.join(' ');

    return {
      accessToken: await this.jwtService.signAsync({
        sub: userId,
        jti: randomUUID(),
        email: user.email,
        roles: user.roles,
        roleArea: 'staff',
        role_area: 'staff',
        scope,
        permissions,
        auth_version: user.authVersion ?? 0,
      }),
      tokenType: 'Bearer',
      expiresIn: 900,
      scope,
      permissions,
      user: {
        id: userId,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        permissions,
      },
    };
  }

  async memberLogin(dto: MemberLoginDto): Promise<MemberLoginResponseDto> {
    const member = await this.membersService?.findByLoginIdentifierWithPassword(
      dto.loginIdentifier,
    );

    if (
      !member ||
      member.status !== MemberStatus.Active ||
      member.authStatus !== MemberAuthStatus.Active ||
      !member.passwordHash ||
      !(await this.passwordHasher.verify(member.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid member credentials');
    }

    const memberId = getMemberId(member);

    await this.membersService?.touchLastLogin(memberId);
    const profile = await this.membersService?.findSelfServiceProfile(memberId);
    const permissions = [...memberRolePermissions];

    return {
      accessToken: await this.jwtService.signAsync({
        sub: memberId,
        jti: randomUUID(),
        memberNumber: member.memberNumber,
        roleArea: 'member',
        role_area: 'member',
        scope: permissions.join(' '),
        permissions,
        auth_version: member.authVersion ?? 0,
      }),
      tokenType: 'Bearer',
      expiresIn: 900,
      scope: permissions.join(' '),
      permissions,
      member: {
        id: memberId,
        memberNumber: member.memberNumber,
        displayName: member.fullName,
        email: member.email,
        membershipStatus: member.status,
        membershipTypeId: member.membershipTypeId.toString(),
        membershipTypeCode: profile?.membershipTypeCode ?? '',
        membershipTypeName: profile?.membershipTypeName ?? '',
      },
    };
  }
}
