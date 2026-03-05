import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsNumber, Min, IsDateString } from 'class-validator';

export class ConvertLeadDto {
  @ApiPropertyOptional({ description: 'Account name (default: lead company or lead name)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  accountName?: string;

  @ApiPropertyOptional({ description: 'Opportunity name (default: derived from lead)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  opportunityName?: string;

  @ApiPropertyOptional({ description: 'Opportunity amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  opportunityAmount?: number;

  @ApiPropertyOptional({ description: 'Opportunity close date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  opportunityCloseDate?: string;

  @ApiPropertyOptional({ description: 'Opportunity stage (default: prospecting)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  opportunityStage?: string;
}
