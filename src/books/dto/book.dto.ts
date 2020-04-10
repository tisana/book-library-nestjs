import { IsInt, IsNotEmpty, IsNumberString } from 'class-validator';
export class BookDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  isbn: string;

  author: string;

  @IsInt()
  quantity: number;
}
