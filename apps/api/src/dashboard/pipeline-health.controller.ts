import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PipelineHealthService, PipelineHealthResponse } from './pipeline-health.service';
import { PipelineHealthQueryDto } from './dto/pipeline-health-query.dto';
import type { User } from '@crm/db';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth()
export class PipelineHealthController {
  constructor(private readonly pipelineHealthService: PipelineHealthService) {}

  @Get('pipeline-health')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({
    summary: 'Pipeline Health Dashboard',
    description:
      'Returns summary tiles, top risk drivers, by-stage breakdown, and paginated at-risk queue. Query: owner (me|all|<userId>), stages, status, overdueOnly, staleOnly, sort (risk|amount|lastTouch|stageAge|overdue), page, pageSize. Non-admin is forced to owner=me.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  @ApiResponse({ status: 403, description: 'Forbidden when non-admin requests another user' })
  getPipelineHealth(
    @Query() query: PipelineHealthQueryDto,
    @CurrentUser() user: User,
  ): Promise<PipelineHealthResponse> {
    return this.pipelineHealthService.getPipelineHealth(user, query);
  }
}
