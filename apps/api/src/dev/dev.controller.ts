import { ForbiddenException, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { DevService } from './dev.service';

@ApiTags('Dev')
@Controller('dev')
@Public()
export class DevController {
  constructor(private readonly devService: DevService) {}

  @Post('seed')
  @ApiOperation({ summary: 'Seed database with sample data (dev only)' })
  @ApiResponse({ status: 201, description: 'Seed completed' })
  @ApiResponse({ status: 403, description: 'Not available in production' })
  async seed(): Promise<{ message: string; counts: Record<string, number> }> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Seed endpoint is disabled in production');
    }
    return this.devService.seed();
  }
}
