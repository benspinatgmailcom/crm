import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateDealBriefDto {
  @ApiPropertyOptional({
    description: 'Force regeneration even if a recent deal brief exists',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forceRefresh?: boolean = false;

  @ApiPropertyOptional({
    description: 'Number of days of activity to include (default 30)',
    default: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  lookbackDays?: number = 30;
}
