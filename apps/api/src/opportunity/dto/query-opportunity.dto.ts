import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class QueryOpportunityDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by name (partial match)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by stage' })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({ enum: ['name', 'amount', 'createdAt', 'closeDate'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['name', 'amount', 'createdAt', 'closeDate'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
