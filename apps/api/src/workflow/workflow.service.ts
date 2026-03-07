import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Updates opportunity workflow timestamps. Used by Activity flow (lastActivityAt)
 * to avoid circular dependency between Activity and Opportunity services.
 */
@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Set Opportunity.lastActivityAt to createdAt only if createdAt is newer.
   * Tenant-scoped; no-op if opportunity not in tenant.
   */
  async updateLastActivityAt(opportunityId: string, createdAt: Date, tenantId: string): Promise<void> {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId },
      select: { lastActivityAt: true },
    });
    if (!opp) return;
    if (opp.lastActivityAt != null && createdAt <= opp.lastActivityAt) return;
    await this.prisma.opportunity.updateMany({
      where: { id: opportunityId, tenantId },
      data: { lastActivityAt: createdAt },
    });
  }
}
