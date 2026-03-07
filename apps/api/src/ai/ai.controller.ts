import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Activity } from '@crm/db';
import { requireTenantId } from '../common/tenant.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { AiDealBriefService } from './ai-deal-brief.service';
import { AiService, type DraftEmailResult, type NextActionsResponse } from './ai.service';
import type { User } from '@crm/db';
import { GenerateDealBriefDto } from './dto/deal-brief.dto';
import { DraftEmailDto, LogDraftEmailDto } from './dto/draft-email.dto';
import { ConvertActionDto, NextActionsDto } from './dto/next-actions.dto';
import { GenerateSummaryDto } from './dto/summary.dto';

@ApiTags('AI')
@Controller('ai')
@ApiBearerAuth()
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiDealBriefService: AiDealBriefService,
  ) {}

  @Post('draft-email/:activityId/log')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Log AI draft email as outbound email activity' })
  @ApiResponse({ status: 201, description: 'Email activity created' })
  @ApiResponse({ status: 400, description: 'Invalid activity' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  logDraftEmail(
    @Param('activityId') activityId: string,
    @Body() dto: LogDraftEmailDto,
    @CurrentUser() user: User,
  ): Promise<Activity> {
    const tenantId = requireTenantId(user);
    return this.aiService.logDraftEmailAsOutbound(activityId, dto.toEmail, tenantId);
  }

  @Post('draft-email')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Generate AI draft email for an entity' })
  @ApiResponse({ status: 201, description: 'Draft email activity created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  generateDraftEmail(@Body() dto: DraftEmailDto, @CurrentUser() user: User): Promise<DraftEmailResult> {
    const tenantId = requireTenantId(user);
    return this.aiService.generateDraftEmail(dto, tenantId);
  }

  @Post('summary')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Generate AI summary for an entity' })
  @ApiResponse({ status: 201, description: 'AI summary activity created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  generateSummary(@Body() dto: GenerateSummaryDto, @CurrentUser() user: User): Promise<Activity> {
    const tenantId = requireTenantId(user);
    return this.aiService.generateSummary(dto, tenantId);
  }

  @Post('next-actions')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Generate next best actions' })
  @ApiResponse({ status: 200, description: 'Returns activityId and actions' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  generateNextActions(@Body() dto: NextActionsDto, @CurrentUser() user: User): Promise<NextActionsResponse> {
    const tenantId = requireTenantId(user);
    return this.aiService.generateNextActions(dto, tenantId);
  }

  @Post('next-actions/:activityId/convert')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Convert recommendation action to task' })
  @ApiResponse({ status: 201, description: 'Task activity created' })
  @ApiResponse({ status: 400, description: 'Invalid activity or action index' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  convertToTask(
    @Param('activityId') activityId: string,
    @Body() dto: ConvertActionDto,
    @CurrentUser() user: User,
  ): Promise<Activity> {
    const tenantId = requireTenantId(user);
    return this.aiService.convertToTask(activityId, dto.actionIndex, tenantId);
  }

  @Post('deal-brief/:opportunityId')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Generate AI deal brief for an opportunity' })
  @ApiResponse({ status: 201, description: 'Deal brief returned (cached or newly generated)' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  generateDealBrief(
    @Param('opportunityId') opportunityId: string,
    @CurrentUser() user: User,
    @Body() dto?: GenerateDealBriefDto,
  ) {
    const tenantId = requireTenantId(user);
    const options = {
      forceRefresh: dto?.forceRefresh ?? false,
      lookbackDays: dto?.lookbackDays ?? 30,
    };
    return this.aiDealBriefService.generateDealBrief(opportunityId, user.id, tenantId, options);
  }
}
