import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  StaffRole,
  StaffUserStatus,
} from '../../common/enums/library-status.enum';

export class CreateStaffUserDto {
  @IsEmail()
  email: string;

  @IsString()
  displayName: string;

  @IsString()
  @MinLength(12)
  password: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(StaffRole, { each: true })
  roles: StaffRole[];
}

export class StaffUserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(StaffUserStatus)
  status?: StaffUserStatus;

  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;
}

export interface StaffUserResponseDto {
  id: string;
  email: string;
  displayName: string;
  roles: StaffRole[];
  status?: StaffUserStatus;
  lastLoginAt?: Date;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: StaffUserResponseDto;
}
