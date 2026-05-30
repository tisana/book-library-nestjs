import { IsBoolean, IsEnum, IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export class CreateBookDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  author: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsString()
  catalogIdentifier: string;

  @IsMongoId()
  categoryId: string;

  @IsInt()
  @Min(0)
  totalQuantity: number;
}

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  catalogIdentifier?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalQuantity?: number;

  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export class BookQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;

  @IsOptional()
  @IsBoolean()
  availableOnly?: boolean;
}

export interface BookResponseDto {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  catalogIdentifier: string;
  categoryId: string;
  totalQuantity: number;
  availableQuantity: number;
  status: LibraryItemStatus;
}

export { CreateBookDto as BookDto };
