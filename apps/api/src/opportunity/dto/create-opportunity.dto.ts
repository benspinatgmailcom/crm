import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: '2025-03-31' })
  @IsOptional()
  @IsDateString()
  closeDate?: string;

  /** Set owner (ADMIN only). If omitted, creator is set as owner. */
  @ApiPropertyOptional({ description: 'Owner user ID (ADMIN only); defaults to current user' })
  @IsOptional()
  @IsString()
  ownerId?: string;
}
