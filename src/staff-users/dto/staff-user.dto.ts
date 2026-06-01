import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  StaffRole,
  StaffUserStatus,
} from '../../common/enums/library-status.enum';

export class CreateStaffUserDto {
  @ApiProperty({ example: 'staff@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Circulation Staff' })
  @IsString()
  displayName: string;

  @ApiProperty({ minLength: 12, example: 'ChangeMe12345' })
  @IsString()
  @MinLength(12)
  password: string;

  @ApiProperty({
    enum: StaffRole,
    enumName: 'StaffRole',
    isArray: true,
    example: [StaffRole.Staff],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(StaffRole, { each: true })
  roles: StaffRole[];
}

export class StaffUserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: StaffUserStatus,
    enumName: 'StaffUserStatus',
  })
  @IsOptional()
  @IsEnum(StaffUserStatus)
  status?: StaffUserStatus;

  @ApiPropertyOptional({ enum: StaffRole, enumName: 'StaffRole' })
  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;
}

export class StaffUserResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'staff@example.com' })
  email: string;

  @ApiProperty({ example: 'Circulation Staff' })
  displayName: string;

  @ApiProperty({
    enum: StaffRole,
    enumName: 'StaffRole',
    isArray: true,
    example: [StaffRole.Staff],
  })
  roles: StaffRole[];

  @ApiPropertyOptional({
    enum: StaffUserStatus,
    enumName: 'StaffUserStatus',
  })
  status?: StaffUserStatus;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-06-01T10:00:00.000Z',
  })
  lastLoginAt?: Date;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe12345' })
  @IsString()
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Bearer token used to authenticate staff API requests.',
  })
  accessToken: string;

  @ApiProperty({ type: StaffUserResponseDto })
  user: StaffUserResponseDto;
}
