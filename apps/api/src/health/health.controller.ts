import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@crm/db';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Get('db')
  async checkDb(): Promise<{ ok: boolean }> {
    await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
    return { ok: true };
  }
}
