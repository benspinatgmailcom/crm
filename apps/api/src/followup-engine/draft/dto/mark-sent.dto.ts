import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DRAFT_CHANNELS } from '../draft-dto';

export class MarkDraftSentDto {
  @ApiProperty({ enum: DRAFT_CHANNELS })
  @IsIn(DRAFT_CHANNELS)
  channel: (typeof DRAFT_CHANNELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
