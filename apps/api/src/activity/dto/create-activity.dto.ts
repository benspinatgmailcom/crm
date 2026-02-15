import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export const ACTIVITY_ENTITY_TYPES = ['account', 'contact', 'lead', 'opportunity'] as const;
export const ACTIVITY_TYPES = ['note', 'call', 'meeting', 'email', 'task', 'ai_summary', 'stage_change'] as const;

export class CreateActivityDto {
  @ApiProperty({ description: 'Entity type (account, contact, lead, opportunity)', enum: ACTIVITY_ENTITY_TYPES })
  @IsString()
  @IsIn(ACTIVITY_ENTITY_TYPES)
  entityType: (typeof ACTIVITY_ENTITY_TYPES)[number];

  @ApiProperty({ description: 'Entity ID (cuid of the related record)' })
  @IsString()
  entityId: string;

  @ApiProperty({ description: 'Activity type', enum: ACTIVITY_TYPES })
  @IsString()
  @IsIn(ACTIVITY_TYPES)
  type: (typeof ACTIVITY_TYPES)[number];

  @ApiPropertyOptional({ description: 'JSON payload (e.g., subject, notes, duration)', default: {} })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
