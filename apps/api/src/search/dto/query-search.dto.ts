import { IsInt, IsOptional, IsString, Min, Max, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class QuerySearchDto {
  @IsString()
  @MinLength(2)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}
