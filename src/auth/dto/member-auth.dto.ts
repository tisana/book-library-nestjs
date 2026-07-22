import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { AuthPermission } from '../../common/enums/auth-permission.enum';
import { MemberStatus } from '../../common/enums/library-status.enum';

export class MemberLoginDto {
  @ApiProperty({ example: 'M-1001' })
  @IsString()
  loginIdentifier: string;

  @ApiProperty({ example: 'MemberPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class MemberLoginProfileDto {
  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a12' })
  id: string;

  @ApiProperty({ example: 'M-1001' })
  memberNumber: string;

  @ApiProperty({ example: 'Jane Reader' })
  displayName: string;

  @ApiPropertyOptional({ example: 'jane.reader@example.test' })
  email?: string;

  @ApiProperty({ enum: MemberStatus, example: MemberStatus.Active })
  membershipStatus: MemberStatus;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a11' })
  membershipTypeId: string;

  @ApiProperty({ example: 'STANDARD' })
  membershipTypeCode: string;

  @ApiProperty({ example: 'Standard Member' })
  membershipTypeName: string;
}

export class MemberLoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: 900 })
  expiresIn: number;

  @ApiProperty({ example: 'member:self:read' })
  scope: string;

  @ApiProperty({
    enum: AuthPermission,
    enumName: 'AuthPermission',
    isArray: true,
    example: [AuthPermission.MemberSelfRead],
  })
  permissions: AuthPermission[];

  @ApiProperty({ type: MemberLoginProfileDto })
  member: MemberLoginProfileDto;
}
