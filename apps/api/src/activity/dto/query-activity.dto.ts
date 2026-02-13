import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ACTIVITY_ENTITY_TYPES, ACTIVITY_TYPES } from './create-activity.dto';
import { PaginationDto } from '../../common/pagination.dto';

export class QueryActivityDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by entity type', enum: ACTIVITY_ENTITY_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(ACTIVITY_ENTITY_TYPES)
  entityType?: (typeof ACTIVITY_ENTITY_TYPES)[number];

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by activity type', enum: ACTIVITY_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(ACTIVITY_TYPES)
  type?: (typeof ACTIVITY_TYPES)[number];

  @ApiPropertyOptional({ enum: ['createdAt', 'type'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'type'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
