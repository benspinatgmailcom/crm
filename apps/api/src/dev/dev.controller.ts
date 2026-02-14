import { Body, ForbiddenException, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { DevService } from './dev.service';
import { SeedStoryService, type SeedStoryResult } from './seed-story.service';
import { SeedStoryDto } from './dto/seed-story.dto';

@ApiTags('Dev')
@Controller('dev')
export class DevController {
  constructor(
    private readonly devService: DevService,
    private readonly seedStoryService: SeedStoryService,
  ) {}

  @Post('seed')
  @Public()
  @ApiOperation({ summary: 'Seed database with sample data (dev only)' })
  @ApiResponse({ status: 201, description: 'Seed completed' })
  @ApiResponse({ status: 403, description: 'Not available in production' })
  async seed(): Promise<{ message: string; counts: Record<string, number> }> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Seed endpoint is disabled in production');
    }
    return this.devService.seed();
  }

  @Post('seed-story')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Seed story-based demo data (dev only, ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Story seed completed' })
  @ApiResponse({ status: 403, description: 'Not available in production or not ADMIN' })
  async seedStory(@Body() dto: SeedStoryDto): Promise<SeedStoryResult> {
    return this.seedStoryService.seedStory(dto);
  }
}
