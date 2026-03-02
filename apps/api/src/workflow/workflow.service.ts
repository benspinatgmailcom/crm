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
   * Set Opportunity.lastActivityAt to createdAt only if createdAt is newer
   * (or lastActivityAt is null). Idempotent; minimal write.
   */
  async updateLastActivityAt(opportunityId: string, createdAt: Date): Promise<void> {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { lastActivityAt: true },
    });
    if (!opp) return;
    if (opp.lastActivityAt != null && createdAt <= opp.lastActivityAt) return;
    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { lastActivityAt: createdAt },
    });
  }
}
