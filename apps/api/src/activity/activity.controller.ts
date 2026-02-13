import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Activity } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { ActivityService } from './activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { QueryActivityDto } from './dto/query-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@ApiTags('Activity')
@Controller('activities')
@ApiBearerAuth()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Create activity (polymorphic)' })
  @ApiResponse({ status: 201, description: 'Activity created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Body() dto: CreateActivityDto): Promise<Activity> {
    return this.activityService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'List activities (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of activities' })
  findAll(@Query() query: QueryActivityDto): Promise<PaginatedResult<Activity>> {
    return this.activityService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'Get activity by ID' })
  @ApiResponse({ status: 200, description: 'Activity found' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  findOne(@Param('id') id: string): Promise<Activity> {
    return this.activityService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Update activity' })
  @ApiResponse({ status: 200, description: 'Activity updated' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto): Promise<Activity> {
    return this.activityService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Delete activity' })
  @ApiResponse({ status: 204, description: 'Activity deleted' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.activityService.remove(id);
  }
}
