import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { MemberLoginResponseDto } from './member-auth.dto';
import { LoginResponseDto } from '../../staff-users/dto/staff-user.dto';

export class SharedLoginDto {
  @ApiProperty({
    example: 'reader@example.com',
    description: 'A reserved staff email, member email, or member number.',
  })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiProperty({ example: 'ChangeMe12345' })
  @IsOptional()
  @IsString()
  password?: string;
}

export class SharedStaffLoginResponseDto extends LoginResponseDto {
  @ApiProperty({ enum: ['staff'], example: 'staff' })
  roleArea: 'staff';
}

export class SharedMemberLoginResponseDto extends MemberLoginResponseDto {
  @ApiProperty({ enum: ['member'], example: 'member' })
  roleArea: 'member';
}

export type SharedLoginResponseDto =
  | SharedStaffLoginResponseDto
  | SharedMemberLoginResponseDto;
