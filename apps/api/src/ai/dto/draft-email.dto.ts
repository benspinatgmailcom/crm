import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class DraftEmailDto {
  @ApiProperty({
    description: 'Entity type',
    enum: ['opportunity', 'contact', 'lead', 'account'],
    example: 'opportunity',
  })
  @IsString()
  @IsIn(['opportunity', 'contact', 'lead', 'account'])
  entityType: 'opportunity' | 'contact' | 'lead' | 'account';

  @ApiProperty({ description: 'Entity ID', example: 'clxx123abc' })
  @IsString()
  entityId: string;

  @ApiPropertyOptional({ description: 'Recipient email address' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientEmail?: string;

  @ApiPropertyOptional({
    description: 'Email intent',
    enum: ['follow_up', 'recap', 'pricing', 'next_steps', 're_engage', 'intro'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['follow_up', 'recap', 'pricing', 'next_steps', 're_engage', 'intro'])
  intent?: 'follow_up' | 'recap' | 'pricing' | 'next_steps' | 're_engage' | 'intro';

  @ApiPropertyOptional({
    description: 'Tone',
    enum: ['friendly', 'professional', 'direct'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['friendly', 'professional', 'direct'])
  tone?: 'friendly' | 'professional' | 'direct';

  @ApiPropertyOptional({
    description: 'Length',
    enum: ['short', 'medium'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['short', 'medium'])
  length?: 'short' | 'medium';

  @ApiPropertyOptional({ description: 'Additional context for the AI' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalContext?: string;
}

export class LogDraftEmailDto {
  @ApiPropertyOptional({
    description: 'Recipient email when logging outbound',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  toEmail?: string;
}
