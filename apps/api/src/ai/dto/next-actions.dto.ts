import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const ENTITY_TYPES = ['account', 'contact', 'lead', 'opportunity'] as const;

export class NextActionsDto {
  @ApiProperty({ enum: ENTITY_TYPES })
  @IsString()
  @IsIn(ENTITY_TYPES)
  entityType: (typeof ENTITY_TYPES)[number];

  @ApiProperty()
  @IsString()
  entityId: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number = 5;
}

export class ConvertActionDto {
  @ApiProperty({ description: 'Index of action in the ai_recommendation (0-based)' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  actionIndex: number;
}
