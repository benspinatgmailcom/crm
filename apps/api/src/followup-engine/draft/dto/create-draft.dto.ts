import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { DRAFT_CHANNELS, DRAFT_TONES, DRAFT_LENGTHS, DRAFT_CTAS } from '../draft-dto';

export class CreateDraftDto {
  @ApiPropertyOptional({ enum: DRAFT_CHANNELS, default: 'email' })
  @IsOptional()
  @IsIn(DRAFT_CHANNELS)
  channel?: (typeof DRAFT_CHANNELS)[number];

  @ApiPropertyOptional({ enum: DRAFT_TONES, default: 'friendly' })
  @IsOptional()
  @IsIn(DRAFT_TONES)
  tone?: (typeof DRAFT_TONES)[number];

  @ApiPropertyOptional({ enum: DRAFT_LENGTHS, default: 'short' })
  @IsOptional()
  @IsIn(DRAFT_LENGTHS)
  length?: (typeof DRAFT_LENGTHS)[number];

  @ApiPropertyOptional({ enum: DRAFT_CTAS })
  @IsOptional()
  @IsIn(DRAFT_CTAS)
  cta?: (typeof DRAFT_CTAS)[number];
}
