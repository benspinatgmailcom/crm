import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SeedStoryDto {
  @ApiPropertyOptional({ description: 'If true, wipe CRM data before seeding', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  reset?: boolean = false;

  @ApiPropertyOptional({ description: 'If true, add filler accounts', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeFiller?: boolean = false;

  @ApiPropertyOptional({ description: 'Number of filler accounts when includeFiller=true', default: 2, minimum: 0, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  fillerAccounts?: number = 2;
}
