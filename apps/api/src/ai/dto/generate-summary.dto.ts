import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const ENTITY_TYPES = ['account', 'contact', 'lead', 'opportunity'] as const;

export class GenerateSummaryDto {
  @ApiProperty({ description: 'Entity type', enum: ENTITY_TYPES })
  @IsString()
  @IsIn(ENTITY_TYPES)
  entityType: (typeof ENTITY_TYPES)[number];

  @ApiProperty({ description: 'Entity ID (cuid)' })
  @IsString()
  entityId: string;

  @ApiPropertyOptional({ description: 'Number of days to include (default 30)', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;

  @ApiPropertyOptional({ description: 'Max number of activities to include (default 50)', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
