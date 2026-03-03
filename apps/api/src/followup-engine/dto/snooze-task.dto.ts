import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class SnoozeTaskDto {
  @ApiProperty({ description: 'Snooze until (ISO 8601 date)', example: '2025-02-15T09:00:00.000Z' })
  @IsISO8601()
  until: string;
}
