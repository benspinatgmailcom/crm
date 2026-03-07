import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { requireTenantId } from '../common/tenant.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@crm/db';
import { FollowUpService } from './followup.service';
import { FollowUpDraftService } from './draft/followup-draft.service';
import { ListFollowupsDto } from './dto/list-followups.dto';
import { SnoozeTaskDto } from './dto/snooze-task.dto';
import { CreateDraftDto } from './draft/dto/create-draft.dto';
import { MarkDraftSentDto } from './draft/dto/mark-sent.dto';

@ApiTags('Follow-ups')
@Controller()
@ApiBearerAuth()
export class FollowUpController {
  constructor(
    private readonly followUpService: FollowUpService,
    private readonly draftService: FollowUpDraftService,
  ) {}

  @Get('followups')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'List follow-up suggestions and open tasks across opportunities' })
  @ApiQuery({ name: 'assignee', required: false, description: 'me | all | userId (admin only)' })
  @ApiQuery({ name: 'opportunityId', required: false, description: 'Filter by opportunity ID' })
  @ApiResponse({ status: 200, description: 'Returns { items }' })
  async listFollowups(
    @Query() dto: ListFollowupsDto,
    @CurrentUser() user: User,
  ): Promise<{ items: Array<{ kind: 'suggestion' | 'openTask'; id: string; opportunityId: string; opportunityName: string; ownerId: string | null; ownerEmail: string | null; title: string; description?: string; dueAt: string; createdAt: string; snoozedUntil?: string; severity?: string }> }> {
    const tenantId = requireTenantId(user);
    const userId = (user as { id?: string }).id;
    if (!userId) throw new Error('User not found');
    const isAdmin = (user as { role?: string }).role === 'ADMIN';
    return this.followUpService.listAllFollowups(
      dto.assignee ?? 'me',
      dto.opportunityId,
      userId,
      isAdmin,
      tenantId,
    );
  }

  @Post('followups/generate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually run follow-up suggestion generation (admin only). Tenant-scoped.' })
  @ApiResponse({ status: 201, description: 'Returns { created, skipped, errors }' })
  async runGenerate(@CurrentUser() user: User): Promise<{ created: number; skipped: number; errors: number }> {
    const tenantId = requireTenantId(user);
    return this.followUpService.generateSuggestionsForOpenOpportunities(tenantId);
  }

  @Post('followups/:suggestionId/draft')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Generate AI draft follow-up from a suggestion' })
  @ApiResponse({ status: 201, description: 'Draft created' })
  @ApiResponse({ status: 404, description: 'Suggestion not found' })
  createDraftFromSuggestion(
    @Param('suggestionId') suggestionId: string,
    @Body() dto: CreateDraftDto,
    @CurrentUser() user: User,
  ) {
    const tenantId = requireTenantId(user);
    return this.draftService.generateDraftFromSuggestion(suggestionId, dto, tenantId);
  }

  @Post('followups/:suggestionId/create-task')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Create a task from a follow-up suggestion' })
  @ApiResponse({ status: 201, description: 'Task created' })
  @ApiResponse({ status: 400, description: 'Suggestion not in SUGGESTED status' })
  @ApiResponse({ status: 404, description: 'Suggestion not found' })
  createTaskFromSuggestion(@Param('suggestionId') suggestionId: string, @CurrentUser() user: User) {
    const tenantId = requireTenantId(user);
    return this.followUpService.createTaskFromSuggestion(suggestionId, tenantId);
  }

  @Post('tasks/:taskActivityId/draft')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Generate AI draft follow-up from an open task' })
  @ApiResponse({ status: 201, description: 'Draft created' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  createDraftFromTask(
    @Param('taskActivityId') taskActivityId: string,
    @Body() dto: CreateDraftDto,
    @CurrentUser() user: User,
  ) {
    const tenantId = requireTenantId(user);
    return this.draftService.generateDraftFromTask(taskActivityId, dto, tenantId);
  }

  @Post('tasks/:taskActivityId/complete')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Mark a task as completed' })
  @ApiResponse({ status: 201, description: 'Task completed' })
  @ApiResponse({ status: 400, description: 'Task not open' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async completeTask(@Param('taskActivityId') taskActivityId: string, @CurrentUser() user: User): Promise<{ ok: true }> {
    const tenantId = requireTenantId(user);
    await this.followUpService.completeTask(taskActivityId, tenantId);
    return { ok: true };
  }

  @Post('tasks/:taskActivityId/dismiss')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Dismiss a task' })
  @ApiResponse({ status: 201, description: 'Task dismissed' })
  @ApiResponse({ status: 400, description: 'Task not open' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async dismissTask(@Param('taskActivityId') taskActivityId: string, @CurrentUser() user: User): Promise<{ ok: true }> {
    const tenantId = requireTenantId(user);
    await this.followUpService.dismissTask(taskActivityId, tenantId);
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
    @CurrentUser() user: User,
  ): Promise<{ ok: true }> {
    const tenantId = requireTenantId(user);
    await this.followUpService.snoozeTask(taskActivityId, new Date(dto.until), tenantId);
    return { ok: true };
  }

  @Post('drafts/:draftActivityId/mark-sent')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Mark a draft as sent (records followup_sent, updates lastActivityAt)' })
  @ApiResponse({ status: 201, description: 'Marked as sent' })
  @ApiResponse({ status: 400, description: 'Draft not in DRAFT status' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async markDraftSent(
    @Param('draftActivityId') draftActivityId: string,
    @Body() dto: MarkDraftSentDto,
    @CurrentUser() user: User,
  ): Promise<{ ok: true }> {
    const tenantId = requireTenantId(user);
    await this.draftService.markDraftSent(draftActivityId, { channel: dto.channel, notes: dto.notes }, tenantId);
    return { ok: true };
  }
}
