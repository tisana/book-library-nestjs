import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export class CreateBookDto {
  @ApiProperty({ example: 'Clean Code' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Robert C. Martin' })
  @IsOptional()
  @IsString()
  author: string;

  @ApiPropertyOptional({ example: '9780132350884' })
  @IsOptional()
  @IsString()
  isbn?: string;

  @ApiProperty({ example: 'BOOK-0001' })
  @IsString()
  catalogIdentifier: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  categoryId: string;

  @ApiProperty({ minimum: 0, example: 3 })
  @IsInt()
  @Min(0)
  totalQuantity: number;
}

export class UpdateBookDto {
  @ApiPropertyOptional({ example: 'Clean Code' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Robert C. Martin' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ example: '9780132350884' })
  @IsOptional()
  @IsString()
  isbn?: string;

  @ApiPropertyOptional({ example: 'BOOK-0001' })
  @IsOptional()
  @IsString()
  catalogIdentifier?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({ minimum: 0, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalQuantity?: number;

  @ApiPropertyOptional({
    enum: LibraryItemStatus,
    enumName: 'LibraryItemStatus',
  })
  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export class BookQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search term for title or identifier.' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 'Robert C. Martin' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: LibraryItemStatus,
    enumName: 'LibraryItemStatus',
  })
  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;

  @ApiPropertyOptional({
    description: 'When true, only books with available copies are returned.',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  availableOnly?: boolean;
}

export class BookResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'Clean Code' })
  title: string;

  @ApiPropertyOptional({ example: 'Robert C. Martin' })
  author?: string;

  @ApiPropertyOptional({ example: '9780132350884' })
  isbn?: string;

  @ApiProperty({ example: 'BOOK-0001' })
  catalogIdentifier: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  categoryId: string;

  @ApiProperty({ minimum: 0, example: 3 })
  totalQuantity: number;

  @ApiProperty({ minimum: 0, example: 2 })
  availableQuantity: number;

  @ApiProperty({
    enum: LibraryItemStatus,
    enumName: 'LibraryItemStatus',
  })
  status: LibraryItemStatus;
}

export { CreateBookDto as BookDto };
