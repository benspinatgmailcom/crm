import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Opportunity } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { requireTenantId } from '../common/tenant.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { OpportunityService } from './opportunity.service';
import { FollowUpService } from '../followup-engine/followup.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { AddDealTeamMemberDto, UpdateDealTeamMemberDto } from './dto/deal-team.dto';
import { PipelineQueryDto } from './dto/pipeline-query.dto';
import { QueryOpportunityDto } from './dto/query-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import type { User } from '@crm/db';

@ApiTags('Opportunity')
@Controller('opportunities')
@ApiBearerAuth()
export class OpportunityController {
  constructor(
    private readonly opportunityService: OpportunityService,
    private readonly followUpService: FollowUpService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Create opportunity' })
  @ApiResponse({ status: 201, description: 'Opportunity created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  create(@Body() dto: CreateOpportunityDto, @CurrentUser() user: User): Promise<Opportunity> {
    return this.opportunityService.create(dto, user);
  }

  @Get('pipeline')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({
    summary: 'Get opportunities grouped by stage for pipeline/Kanban view',
    description: 'Query param owner: "me" (default for non-admin), "all" (default for admin), or a user ID (ADMIN only)',
  })
  @ApiResponse({ status: 200, description: 'Returns { [stage]: [{ id, name, amount, closeDate, stage, accountId, accountName, ownerId, ownerEmail, daysSinceLastTouch, ... }] }' })
  getPipeline(
    @Query() query: PipelineQueryDto,
    @CurrentUser() user: User,
  ): Promise<Record<string, Array<{
    id: string;
    name: string;
    amount: { toString(): string } | null;
    closeDate: Date | null;
    stage: string | null;
    accountId: string;
    accountName: string;
    ownerId: string;
    ownerEmail: string;
    daysSinceLastTouch: number | null;
    daysInStage: number | null;
    healthScore: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
    healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
  }>>> {
    return this.opportunityService.getPipeline(user, query.owner, query.forecastCategory);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({
    summary: 'List opportunities (paginated)',
    description: 'Query params: page (default 1), pageSize (default 20), accountId, stage, name (contains), sortBy (name|amount|createdAt|closeDate), sortDir (asc|desc)',
  })
  @ApiResponse({ status: 200, description: 'Returns { data, page, pageSize, total }' })
  findAll(@Query() query: QueryOpportunityDto, @CurrentUser() user: User): Promise<PaginatedResult<Opportunity>> {
    const tenantId = requireTenantId(user);
    return this.opportunityService.findAll(query, tenantId);
  }

  @Get(':id/followups')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'List follow-up suggestions and open tasks for an opportunity' })
  @ApiResponse({ status: 200, description: 'Returns { suggestions, openTasks }' })
  listFollowups(@Param('id') id: string, @CurrentUser() user: User) {
    const tenantId = requireTenantId(user);
    return this.followUpService.listOpportunityFollowups(id, tenantId);
  }

  @Get(':id/deal-team')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'List deal team (buying team) for an opportunity' })
  @ApiResponse({ status: 200, description: 'Returns array of { contactId, role, contact }' })
  getDealTeam(@Param('id') id: string, @CurrentUser() user: User) {
    const tenantId = requireTenantId(user);
    return this.opportunityService.getDealTeam(id, tenantId);
  }

  @Post(':id/deal-team')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Add or update a contact on the deal team with a buyer role' })
  @ApiResponse({ status: 201, description: 'Deal team member added or updated' })
  addDealTeamMember(
    @Param('id') id: string,
    @Body() dto: AddDealTeamMemberDto,
    @CurrentUser() user: User,
  ) {
    const tenantId = requireTenantId(user);
    return this.opportunityService.addDealTeamMember(id, dto.contactId, dto.role, tenantId);
  }

  @Patch(':id/deal-team/:contactId')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Update deal team member role' })
  @ApiResponse({ status: 200, description: 'Deal team member updated' })
  updateDealTeamMember(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateDealTeamMemberDto,
    @CurrentUser() user: User,
  ) {
    const tenantId = requireTenantId(user);
    return this.opportunityService.updateDealTeamMemberRole(id, contactId, dto.role, tenantId);
  }

  @Delete(':id/deal-team/:contactId')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Remove a contact from the deal team' })
  @ApiResponse({ status: 204, description: 'Deal team member removed' })
  async removeDealTeamMember(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    const tenantId = requireTenantId(user);
    await this.opportunityService.removeDealTeamMember(id, contactId, tenantId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'Get opportunity by ID' })
  @ApiResponse({ status: 200, description: 'Opportunity found' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: User): Promise<Opportunity> {
    const tenantId = requireTenantId(user);
    return this.opportunityService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Update opportunity' })
  @ApiResponse({ status: 200, description: 'Opportunity updated' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
    @Body('lostNotes') bodyLostNotes: string | undefined,
    @CurrentUser() user: User,
  ): Promise<Opportunity> {
    const dtoWithNotes = bodyLostNotes !== undefined ? { ...dto, lostNotes: bodyLostNotes } : dto;
    return this.opportunityService.update(id, dtoWithNotes, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Delete opportunity' })
  @ApiResponse({ status: 204, description: 'Opportunity deleted' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    const tenantId = requireTenantId(user);
    await this.opportunityService.remove(id, tenantId);
  }
}
