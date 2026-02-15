import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
}
