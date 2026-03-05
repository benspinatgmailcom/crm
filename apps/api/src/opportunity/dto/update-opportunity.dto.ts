import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType, OmitType } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOpportunityDto } from './create-opportunity.dto';

const Base = PartialType(OmitType(CreateOpportunityDto, ['accountId', 'ownerId'] as const));

const FORECAST_CATEGORIES = ['pipeline', 'best_case', 'commit', 'closed'] as const;

export class UpdateOpportunityDto extends Base {
  /** Reassign owner (ADMIN or current owner only). */
  @ApiPropertyOptional({ description: 'New owner user ID' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  /** Override win probability 0–100 (forecast engine normally computes this). */
  @ApiPropertyOptional({ description: 'Win probability 0–100', minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  winProbability?: number;

  /** Override forecast category. */
  @ApiPropertyOptional({ description: 'Forecast category', enum: FORECAST_CATEGORIES })
  @IsOptional()
  @IsString()
  @IsIn(FORECAST_CATEGORIES)
  forecastCategory?: (typeof FORECAST_CATEGORIES)[number];

  /** Required when setting stage to closed-lost. Stored in the stage_change activity payload. */
  @ApiPropertyOptional({ description: 'Reason for loss (required when stage is closed-lost)' })
  @IsOptional()
  @IsString()
  lostReason?: string;

  /** Optional note when closing as lost. Stored in the stage_change activity payload. Required when lostReason is "Other". */
  @ApiPropertyOptional({ description: 'Note for loss (required when reason is Other)' })
  @IsOptional()
  @IsString()
  lostNotes?: string;
}
