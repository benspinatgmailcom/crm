import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { requireTenantId } from '../common/tenant.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@crm/db';
import { TasksService, TaskListItem } from './tasks.service';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PaginatedResult } from '../common/pagination.dto';

@ApiTags('Tasks')
@Controller('tasks')
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'List tasks (paginated) with filters' })
  @ApiQuery({ name: 'assignee', required: false, description: 'me | all | userId' })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'done'] })
  @ApiQuery({ name: 'overdue', required: false, type: Boolean })
  @ApiQuery({ name: 'dueToday', required: false, type: Boolean })
  @ApiQuery({ name: 'dueThisWeek', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated task list' })
  async findAll(
    @Query() query: QueryTasksDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedResult<TaskListItem>> {
    const tenantId = requireTenantId(user);
    const userId = (user as { id?: string }).id;
    if (!userId) throw new Error('User not found');
    const isAdmin = (user as { role?: string }).role === 'ADMIN';
    return this.tasksService.findAll(query, userId, isAdmin, tenantId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Update task (title, dueAt, status, priority)' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User,
  ): Promise<TaskListItem> {
    const tenantId = requireTenantId(user);
    return this.tasksService.update(id, dto, tenantId);
  }
}
