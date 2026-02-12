import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ACTIVITY_TYPES } from './create-activity.dto';

export class UpdateActivityDto {
  @ApiPropertyOptional({ enum: ACTIVITY_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(ACTIVITY_TYPES)
  type?: (typeof ACTIVITY_TYPES)[number];

  @ApiPropertyOptional({ description: 'JSON payload' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
