import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@crm/db';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { DevService } from './dev.service';
import { SeedStoryService, type SeedStoryResult } from './seed-story.service';
import { SeedStoryDto } from './dto/seed-story.dto';

@ApiTags('Dev')
@Controller('dev')
@ApiBearerAuth()
export class DevController {
  constructor(
    private readonly devService: DevService,
    private readonly seedStoryService: SeedStoryService,
  ) {}

  @Post('seed')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Seed database with sample data (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Seed completed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async seed(): Promise<{ message: string; counts: Record<string, number> }> {
    return this.devService.seed();
  }

  @Post('seed-story')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Seed story-based demo data for the current tenant (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Story seed completed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async seedStory(
    @Body() dto: SeedStoryDto,
    @CurrentUser() user: User,
  ): Promise<SeedStoryResult> {
    return this.seedStoryService.seedStory(dto, user);
  }
}
