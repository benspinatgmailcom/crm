import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateSummaryDto {
  @ApiProperty({ description: 'Entity type', enum: ['account', 'contact', 'lead', 'opportunity'] })
  @IsString()
  @IsIn(['account', 'contact', 'lead', 'opportunity'])
  entityType: 'account' | 'contact' | 'lead' | 'opportunity';

  @ApiProperty({ description: 'Entity ID' })
  @IsString()
  entityId: string;

  @ApiPropertyOptional({ description: 'Number of days to summarize', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
