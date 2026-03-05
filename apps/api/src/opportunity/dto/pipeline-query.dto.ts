import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

const FORECAST_CATEGORIES = ['pipeline', 'best_case', 'commit', 'closed'] as const;

/** owner=me => current user's deals; owner=all => all (ADMIN default); owner=<userId> => that user (ADMIN only) */
export class PipelineQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by owner: "me" (current user), "all", or a user ID (ADMIN only)',
    example: 'me',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(me|all|.+)$/, {
    message: 'owner must be "me", "all", or a user ID',
  })
  owner?: string;

  @ApiPropertyOptional({
    description: 'Filter by forecast category',
    enum: FORECAST_CATEGORIES,
  })
  @IsOptional()
  @IsString()
  @IsIn(FORECAST_CATEGORIES)
  forecastCategory?: (typeof FORECAST_CATEGORIES)[number];
}
