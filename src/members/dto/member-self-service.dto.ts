import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberStatus } from '../../common/enums/library-status.enum';
import { BorrowingResponseDto } from '../../borrowings/dto/borrowing.dto';

export class MemberSelfServiceProfileDto {
  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a12' })
  id: string;

  @ApiProperty({ example: 'M-1001' })
  memberNumber: string;

  @ApiProperty({ example: 'Jane Reader' })
  displayName: string;

  @ApiPropertyOptional({ example: 'jane.reader@example.test' })
  email?: string;

  @ApiPropertyOptional({ example: '+66020001001' })
  phone?: string;

  @ApiProperty({ enum: MemberStatus, example: MemberStatus.Active })
  membershipStatus: MemberStatus;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a11' })
  membershipTypeId: string;

  @ApiProperty({ example: 'STANDARD' })
  membershipTypeCode: string;

  @ApiProperty({ example: 'Standard Member' })
  membershipTypeName: string;

  @ApiProperty({ example: 1, minimum: 0 })
  activeLoanCount: number;
}

export class MemberSelfServicePolicyStatusDto {
  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a12' })
  memberId: string;

  @ApiProperty({ enum: MemberStatus, example: MemberStatus.Active })
  status: MemberStatus;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a11' })
  membershipTypeId: string;

  @ApiProperty({ example: 3, minimum: 0 })
  maxActiveLoans: number;

  @ApiProperty({ example: 1, minimum: 0 })
  activeLoanCount: number;

  @ApiProperty({ example: 2, minimum: 0 })
  remainingAllowance: number;

  @ApiProperty({ example: true })
  eligibleByStatus: boolean;

  @ApiProperty({ example: true })
  withinLimit: boolean;

  @ApiProperty({ example: false })
  limitReached: boolean;
}

export class MemberBorrowingsResponseDto extends BorrowingResponseDto {}
