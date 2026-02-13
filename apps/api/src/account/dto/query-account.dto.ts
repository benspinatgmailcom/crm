import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export enum AccountSortField {
  NAME = 'name',
  CREATED_AT = 'createdAt',
}

export class QueryAccountDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by name (partial match)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by industry' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ enum: AccountSortField, default: AccountSortField.CREATED_AT, description: 'Sort field' })
  @IsOptional()
  @IsEnum(AccountSortField)
  sortBy?: AccountSortField = AccountSortField.CREATED_AT;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
