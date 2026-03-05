import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class ListFollowupsDto {
  @ApiPropertyOptional({ description: 'Assignee filter: me (default) | all | userId (admin only)', default: 'me' })
  @IsOptional()
  @IsString()
  assignee?: string = 'me';

  @ApiPropertyOptional({ description: 'Filter by opportunity ID' })
  @IsOptional()
  @IsString()
  opportunityId?: string;
}

export interface FollowupListItem {
  kind: 'suggestion' | 'openTask';
  id: string;
  opportunityId: string;
  opportunityName: string;
  ownerId: string | null;
  ownerEmail: string | null;
  title: string;
  description?: string;
  dueAt: string;
  createdAt: string;
  snoozedUntil?: string;
  severity?: 'warning' | 'critical';
}
