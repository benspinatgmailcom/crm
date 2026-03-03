import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { FollowUpService } from './followup.service';
import { SnoozeTaskDto } from './dto/snooze-task.dto';

@ApiTags('Follow-ups')
@Controller()
@ApiBearerAuth()
export class FollowUpController {
  constructor(private readonly followUpService: FollowUpService) {}

  @Post('followups/generate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually run follow-up suggestion generation (admin only)' })
  @ApiResponse({ status: 201, description: 'Returns { created, skipped, errors }' })
  async runGenerate(): Promise<{ created: number; skipped: number; errors: number }> {
    return this.followUpService.generateSuggestionsForOpenOpportunities();
  }

  @Post('followups/:suggestionId/create-task')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Create a task from a follow-up suggestion' })
  @ApiResponse({ status: 201, description: 'Task created' })
  @ApiResponse({ status: 400, description: 'Suggestion not in SUGGESTED status' })
  @ApiResponse({ status: 404, description: 'Suggestion not found' })
  createTaskFromSuggestion(@Param('suggestionId') suggestionId: string) {
    return this.followUpService.createTaskFromSuggestion(suggestionId);
  }

  @Post('tasks/:taskActivityId/complete')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Mark a task as completed' })
  @ApiResponse({ status: 201, description: 'Task completed' })
  @ApiResponse({ status: 400, description: 'Task not open' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async completeTask(@Param('taskActivityId') taskActivityId: string): Promise<{ ok: true }> {
    await this.followUpService.completeTask(taskActivityId);
    return { ok: true };
  }

  @Post('tasks/:taskActivityId/dismiss')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Dismiss a task' })
  @ApiResponse({ status: 201, description: 'Task dismissed' })
  @ApiResponse({ status: 400, description: 'Task not open' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async dismissTask(@Param('taskActivityId') taskActivityId: string): Promise<{ ok: true }> {
    await this.followUpService.dismissTask(taskActivityId);
    return { ok: true };
  }

  @Post('tasks/:taskActivityId/snooze')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Snooze a task until a given time' })
  @ApiResponse({ status: 201, description: 'Task snoozed' })
  @ApiResponse({ status: 400, description: 'Task not open or invalid until' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async snoozeTask(
    @Param('taskActivityId') taskActivityId: string,
    @Body() dto: SnoozeTaskDto,
  ): Promise<{ ok: true }> {
    await this.followUpService.snoozeTask(taskActivityId, new Date(dto.until));
    return { ok: true };
  }
}
