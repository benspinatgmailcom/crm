import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, ValidateBy } from 'class-validator';
import { ACTIVITY_ENTITY_TYPES, ACTIVITY_TYPES } from './create-activity.dto';
import { PaginationDto } from '../../common/pagination.dto';

const validTypesSet = new Set(ACTIVITY_TYPES);
const TYPE_FILTER_REGEX = /^([a-z_]+)(,[a-z_]+)*$/;

function isValidTypeFilter(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value === '') return true; // no filter
  if (!TYPE_FILTER_REGEX.test(value)) return false;
  return value.split(',').every((t) => validTypesSet.has(t.trim() as (typeof ACTIVITY_TYPES)[number]));
}

export class QueryActivityDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by entity type (required for timeline). Use with entityId.',
    enum: ACTIVITY_ENTITY_TYPES,
  })
  @IsOptional()
  @IsString()
  @IsIn(ACTIVITY_ENTITY_TYPES)
  entityType?: (typeof ACTIVITY_ENTITY_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Filter by entity ID (required for timeline). Use with entityType.',
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by activity type. Single value or comma-separated (e.g. note,call,meeting)',
    example: 'note,call',
  })
  @IsOptional()
  @ValidateBy({
    name: 'isValidActivityTypeFilter',
    validator: {
      validate: isValidTypeFilter,
      defaultMessage: () => `type must be one or more of: ${ACTIVITY_TYPES.join(', ')}`,
    },
  })
  type?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'type'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'type'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
