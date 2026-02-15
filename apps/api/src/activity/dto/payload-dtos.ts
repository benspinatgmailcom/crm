import { IsString, IsOptional, IsIn, IsISO8601, MinLength, IsObject, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotePayloadDto {
  @ApiProperty({ description: 'Note text' })
  @IsString()
  @MinLength(1, { message: 'text is required' })
  text: string;
}

export class CallPayloadDto {
  @ApiPropertyOptional({ description: 'Call summary' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: 'Call outcome' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional({ description: 'Next step' })
  @IsOptional()
  @IsString()
  nextStep?: string;
}

export class MeetingPayloadDto {
  @ApiPropertyOptional({ description: 'Meeting summary' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: 'Meeting outcome' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional({ description: 'Next step' })
  @IsOptional()
  @IsString()
  nextStep?: string;
}

export class EmailPayloadDto {
  @ApiPropertyOptional({ description: 'Email subject' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Email body' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Email direction', enum: ['inbound', 'outbound'] })
  @IsOptional()
  @IsString()
  @IsIn(['inbound', 'outbound'])
  direction?: 'inbound' | 'outbound';
}

export class TaskPayloadDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @MinLength(1, { message: 'title is required' })
  title: string;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsString()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional({ description: 'Task status', enum: ['open', 'done'] })
  @IsOptional()
  @IsString()
  @IsIn(['open', 'done'])
  status?: 'open' | 'done';
}

export class StageChangePayloadDto {
  @IsOptional()
  @IsString()
  fromStage?: string;

  @IsOptional()
  @IsString()
  toStage?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  competitor?: string;

  @IsOptional()
  @IsString()
  nextSteps?: string;

  @IsOptional()
  @IsNumber()
  finalAmount?: number;
}

export class AiSummaryPayloadDto {
  @ApiProperty({ description: 'AI summary text' })
  @IsString()
  @MinLength(1, { message: 'text is required' })
  text: string;

  @ApiPropertyOptional({ description: 'Source references' })
  @IsOptional()
  @IsObject()
  sources?: Record<string, unknown>;
}

export const PAYLOAD_DTO_MAP: Record<
  string,
  new (...args: unknown[]) => NotePayloadDto | CallPayloadDto | MeetingPayloadDto | EmailPayloadDto | TaskPayloadDto | StageChangePayloadDto | AiSummaryPayloadDto
> = {
  note: NotePayloadDto,
  call: CallPayloadDto,
  meeting: MeetingPayloadDto,
  email: EmailPayloadDto,
  task: TaskPayloadDto,
  ai_summary: AiSummaryPayloadDto,
  stage_change: StageChangePayloadDto,
};
