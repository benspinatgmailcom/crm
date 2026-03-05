import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsIn, ValidateIf } from 'class-validator';
import { TASK_PRIORITIES } from '../../activity/dto/payload-dtos';

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Task title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ description: 'Status: open or done', enum: ['open', 'done'] })
  @IsOptional()
  @IsIn(['open', 'done'])
  status?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @ValidateIf((_o, v) => v != null && v !== '')
  @IsIn(TASK_PRIORITIES)
  priority?: string | null;
}
