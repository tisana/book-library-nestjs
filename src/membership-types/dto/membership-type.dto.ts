import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export class CreateMembershipTypeDto {
  @ApiProperty({ example: 'STANDARD' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Standard Membership' })
  @IsString()
  name: string;

  @ApiProperty({ example: 5, minimum: 0 })
  @IsInt()
  @Min(0)
  maxActiveLoans: number;
}

export class UpdateMembershipTypeDto {
  @ApiPropertyOptional({ example: 'Premium Membership' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 10, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxActiveLoans?: number;

  @ApiPropertyOptional({
    enum: LibraryItemStatus,
    example: LibraryItemStatus.Active,
  })
  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export class MembershipTypeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: LibraryItemStatus,
    example: LibraryItemStatus.Active,
  })
  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export class MembershipTypeResponseDto {
  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a11' })
  id: string;

  @ApiProperty({ example: 'STANDARD' })
  code: string;

  @ApiProperty({ example: 'Standard Membership' })
  name: string;

  @ApiProperty({ example: 5, minimum: 0 })
  maxActiveLoans: number;

  @ApiProperty({ enum: LibraryItemStatus, example: LibraryItemStatus.Active })
  status: LibraryItemStatus;
}
