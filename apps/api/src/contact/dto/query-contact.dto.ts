import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class QueryContactDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by name (partial match on first or last)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by email (contains)' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: ['firstName', 'lastName', 'email', 'createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['firstName', 'lastName', 'email', 'createdAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
