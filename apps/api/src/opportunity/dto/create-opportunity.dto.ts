import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateOpportunityDto {
  @ApiProperty({ description: 'Account ID' })
  @IsString()
  accountId: string;

  @ApiProperty({ example: 'Enterprise Deal' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 'prospecting', default: 'prospecting' })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({ example: 25, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({ example: '2025-03-31' })
  @IsOptional()
  @IsDateString()
  closeDate?: string;
}
