import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Activity } from '@crm/db';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { AiService, type NextActionsResponse } from './ai.service';
import { ConvertActionDto } from './dto/next-actions.dto';
import { NextActionsDto } from './dto/next-actions.dto';

@ApiTags('AI')
@Controller('ai')
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('next-actions')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Generate next best actions' })
  @ApiResponse({ status: 200, description: 'Returns activityId and actions' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  generateNextActions(@Body() dto: NextActionsDto): Promise<NextActionsResponse> {
    return this.aiService.generateNextActions(dto);
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
  ): Promise<Activity> {
    return this.aiService.convertToTask(activityId, dto.actionIndex);
  }
}
