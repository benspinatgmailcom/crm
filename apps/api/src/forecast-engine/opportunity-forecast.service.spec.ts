import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OpportunityForecastService } from './opportunity-forecast.service';

describe('OpportunityForecastService', () => {
  let service: OpportunityForecastService;
  let prisma: PrismaService;

  const oppRow = {
    id: 'opp-1',
    stage: 'proposal',
    amount: { toString: () => '50000' },
    closeDate: null as Date | null,
    lastActivityAt: new Date('2025-02-10T00:00:00Z'),
    lastStageChangedAt: new Date('2025-02-01T00:00:00Z'),
    nextFollowUpAt: new Date('2025-03-01T00:00:00Z'),
  };

  const mockPrisma = {
    opportunity: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.opportunity.findUnique.mockResolvedValue(oppRow);
    mockPrisma.opportunity.update.mockImplementation(
      (args: { where: { id: string }; data: object }) =>
        Promise.resolve({ id: args.where.id, ...args.data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityForecastService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OpportunityForecastService>(OpportunityForecastService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('recomputes and persists forecast for an opportunity', async () => {
    await service.recomputeForecast('opp-1');

    expect(mockPrisma.opportunity.findUnique).toHaveBeenCalledWith({
      where: { id: 'opp-1' },
      select: expect.objectContaining({
        id: true,
        stage: true,
        amount: true,
        closeDate: true,
        lastActivityAt: true,
        lastStageChangedAt: true,
        nextFollowUpAt: true,
      }),
    });
    expect(mockPrisma.opportunity.update).toHaveBeenCalledWith({
      where: { id: 'opp-1' },
      data: expect.objectContaining({
        winProbability: expect.any(Number),
        forecastCategory: expect.stringMatching(/^(pipeline|best_case|commit|closed)$/),
        expectedRevenue: expect.any(Number),
      }),
    });
    const updateCall = mockPrisma.opportunity.update.mock.calls[0][0];
    expect(updateCall.data.winProbability).toBeGreaterThanOrEqual(0);
    expect(updateCall.data.winProbability).toBeLessThanOrEqual(100);
  });

  it('throws NotFoundException when opportunity does not exist', async () => {
    mockPrisma.opportunity.findUnique.mockResolvedValue(null);

    await expect(service.recomputeForecast('nonexistent')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.opportunity.update).not.toHaveBeenCalled();
  });
});
