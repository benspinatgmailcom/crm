import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { AiService, type AiSummaryResponse } from './ai.service';
import { GenerateSummaryDto } from './dto/generate-summary.dto';

@ApiTags('AI')
@Controller('ai')
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('summary')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({
    summary: 'Generate AI summary',
    description:
      'Generates an AI summary for an entity based on its data and recent activities. Stores the result as an ai_summary activity.',
  })
  @ApiResponse({ status: 200, description: 'Summary generated and stored' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  generateSummary(@Body() dto: GenerateSummaryDto): Promise<AiSummaryResponse> {
    return this.aiService.generateSummary(dto);
  }
}
