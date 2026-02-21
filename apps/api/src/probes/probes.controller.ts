import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { Prisma } from '@crm/db';

@Controller()
export class ProbesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: process is running */
  @Get('healthz')
  @Public()
  healthz(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness: app can accept traffic (DB reachable). Returns 503 if DB unreachable. */
  @Get('readyz')
  @Public()
  async readyz(): Promise<{ status: string; db: string }> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      return { status: 'ok', db: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', db: 'error' });
    }
  }
}
