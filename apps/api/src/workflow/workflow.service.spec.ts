import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowService } from './workflow.service';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let prisma: PrismaService;

  const mockPrisma = {
    opportunity: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateLastActivityAt', () => {
    const opportunityId = 'opp-1';
    const tenantId = 'tenant-1';

    it('updates when lastActivityAt is null', async () => {
      mockPrisma.opportunity.findFirst.mockResolvedValue({
        id: opportunityId,
        lastActivityAt: null,
      });
      mockPrisma.opportunity.updateMany.mockResolvedValue({ count: 1 });

      const createdAt = new Date('2025-02-01T12:00:00Z');
      await service.updateLastActivityAt(opportunityId, createdAt, tenantId);

      expect(prisma.opportunity.findFirst).toHaveBeenCalledWith({
        where: { id: opportunityId, tenantId },
        select: { lastActivityAt: true },
      });
      expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
        where: { id: opportunityId, tenantId },
        data: { lastActivityAt: createdAt },
      });
    });

    it('updates when createdAt is newer than lastActivityAt', async () => {
      const older = new Date('2025-01-01T00:00:00Z');
      const newer = new Date('2025-02-01T12:00:00Z');
      mockPrisma.opportunity.findFirst.mockResolvedValue({
        id: opportunityId,
        lastActivityAt: older,
      });
      mockPrisma.opportunity.updateMany.mockResolvedValue({ count: 1 });

      await service.updateLastActivityAt(opportunityId, newer, tenantId);

      expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
        where: { id: opportunityId, tenantId },
        data: { lastActivityAt: newer },
      });
    });

    it('does not update when createdAt is older (idempotency)', async () => {
      const older = new Date('2025-01-01T00:00:00Z');
      const newer = new Date('2025-02-01T12:00:00Z');
      mockPrisma.opportunity.findFirst.mockResolvedValue({
        id: opportunityId,
        lastActivityAt: newer,
      });

      await service.updateLastActivityAt(opportunityId, older, tenantId);

      expect(prisma.opportunity.updateMany).not.toHaveBeenCalled();
    });

    it('does not update when createdAt equals lastActivityAt', async () => {
      const same = new Date('2025-02-01T12:00:00Z');
      mockPrisma.opportunity.findFirst.mockResolvedValue({
        id: opportunityId,
        lastActivityAt: same,
      });

      await service.updateLastActivityAt(opportunityId, same, tenantId);

      expect(prisma.opportunity.updateMany).not.toHaveBeenCalled();
    });

    it('does nothing when opportunity does not exist', async () => {
      mockPrisma.opportunity.findFirst.mockResolvedValue(null);

      await service.updateLastActivityAt(opportunityId, new Date(), tenantId);

      expect(prisma.opportunity.updateMany).not.toHaveBeenCalled();
    });
  });
});
