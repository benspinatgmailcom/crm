import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Opportunity } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { OpportunityService } from './opportunity.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { QueryOpportunityDto } from './dto/query-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@ApiTags('Opportunity')
@Controller('opportunities')
@ApiBearerAuth()
export class OpportunityController {
  constructor(private readonly opportunityService: OpportunityService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Create opportunity' })
  @ApiResponse({ status: 201, description: 'Opportunity created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  create(@Body() dto: CreateOpportunityDto): Promise<Opportunity> {
    return this.opportunityService.create(dto);
  }

  @Get('pipeline')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'Get opportunities grouped by stage for pipeline/Kanban view' })
  @ApiResponse({ status: 200, description: 'Returns { [stage]: [{ id, name, amount, closeDate, stage, accountId, accountName }] }' })
  getPipeline(): Promise<Record<string, Array<{
    id: string;
    name: string;
    amount: { toString(): string } | null;
    closeDate: Date | null;
    stage: string | null;
    accountId: string;
    accountName: string;
  }>>> {
    return this.opportunityService.getPipeline();
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({
    summary: 'List opportunities (paginated)',
    description: 'Query params: page (default 1), pageSize (default 20), accountId, stage, name (contains), sortBy (name|amount|createdAt|closeDate), sortDir (asc|desc)',
  })
  @ApiResponse({ status: 200, description: 'Returns { data, page, pageSize, total }' })
  findAll(@Query() query: QueryOpportunityDto): Promise<PaginatedResult<Opportunity>> {
    return this.opportunityService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'Get opportunity by ID' })
  @ApiResponse({ status: 200, description: 'Opportunity found' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  findOne(@Param('id') id: string): Promise<Opportunity> {
    return this.opportunityService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Update opportunity' })
  @ApiResponse({ status: 200, description: 'Opportunity updated' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto): Promise<Opportunity> {
    return this.opportunityService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Delete opportunity' })
  @ApiResponse({ status: 204, description: 'Opportunity deleted' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.opportunityService.remove(id);
  }
}
