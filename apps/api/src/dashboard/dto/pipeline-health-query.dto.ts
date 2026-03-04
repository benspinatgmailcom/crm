import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsIn,
  IsBooleanString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class PipelineHealthQueryDto {
  @ApiPropertyOptional({ description: 'Owner: me | all | <userId>', example: 'me' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ description: 'Comma-separated stages', example: 'prospecting,qualification' })
  @IsOptional()
  @IsString()
  stages?: string;

  @ApiPropertyOptional({ description: 'Comma-separated health statuses', example: 'warning,critical' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Only overdue next steps', enum: ['true', 'false'] })
  @IsOptional()
  @IsBooleanString()
  overdueOnly?: string;

  @ApiPropertyOptional({ description: 'Only stale touch (≥7 days)', enum: ['true', 'false'] })
  @IsOptional()
  @IsBooleanString()
  staleOnly?: string;

  @ApiPropertyOptional({ description: 'Filter queue to opportunities with this health signal code', example: 'STALE_TOUCH' })
  @IsOptional()
  @IsString()
  signalCode?: string;

  @ApiPropertyOptional({
    description: 'Sort queue',
    enum: ['risk', 'amount', 'lastTouch', 'stageAge', 'overdue'],
    default: 'risk',
  })
  @IsOptional()
  @IsIn(['risk', 'amount', 'lastTouch', 'stageAge', 'overdue'])
  sort?: string = 'risk';

  @ApiPropertyOptional({ description: 'Page (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}
