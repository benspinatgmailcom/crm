import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/pagination.dto';

const toBool = (v: unknown) => v === 'true' || v === true;

export class QueryTasksDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Assignee filter: me (default), all, or user id for specific user',
    example: 'me',
  })
  @IsOptional()
  @IsString()
  assignee?: string = 'me';

  @ApiPropertyOptional({ description: 'Status: open (default) or done', enum: ['open', 'done'] })
  @IsOptional()
  @IsIn(['open', 'done'])
  status?: 'open' | 'done' = 'open';

  @ApiPropertyOptional({ description: 'Filter overdue (due date before today)' })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Filter due today' })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  dueToday?: boolean;

  @ApiPropertyOptional({ description: 'Filter due this week' })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  dueThisWeek?: boolean;
}
