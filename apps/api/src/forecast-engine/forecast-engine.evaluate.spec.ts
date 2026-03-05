import { evaluateForecast } from './forecast-engine.evaluate';
import { FORECAST_ENGINE_CONFIG } from './forecast-engine.config';

const now = new Date('2025-02-15T12:00:00.000Z');

function run(input: {
  stage: string;
  amount?: number | null;
  closeDate?: Date | null;
  daysSinceLastTouch?: number | null;
  daysInStage?: number | null;
  healthScore?: number | null;
  healthStatus: 'healthy' | 'warning' | 'critical';
  healthSignals?: Array<{ code: string; severity: string; penalty: number }>;
  nextFollowUpAt?: Date | null;
}) {
  return evaluateForecast(
    {
      stage: input.stage,
      amount: input.amount ?? null,
      closeDate: input.closeDate ?? null,
      daysSinceLastTouch: input.daysSinceLastTouch ?? null,
      daysInStage: input.daysInStage ?? null,
      healthScore: input.healthScore ?? null,
      healthStatus: input.healthStatus,
      healthSignals: input.healthSignals ?? [],
      nextFollowUpAt: input.nextFollowUpAt ?? null,
    },
    now,
  );
}

describe('forecast-engine.evaluate', () => {
  describe('stage weights', () => {
    it('applies stage weight for prospecting', () => {
      const r = run({
        stage: 'prospecting',
        healthScore: 100,
        healthStatus: 'healthy',
        daysSinceLastTouch: 1,
        daysInStage: 2,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.winProbability).toBe(10 + FORECAST_ENGINE_CONFIG.healthHighBonus + FORECAST_ENGINE_CONFIG.momentumBonus);
      expect(r.forecastCategory).toBe('pipeline');
    });

    it('applies stage weight for negotiation', () => {
      const r = run({
        stage: 'negotiation',
        healthScore: 85,
        healthStatus: 'healthy',
        daysSinceLastTouch: 1,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.winProbability).toBeGreaterThanOrEqual(70);
      expect(r.forecastCategory).toBe('commit');
    });

    it('uses default weight for unknown stage', () => {
      const r = run({
        stage: 'unknown_stage',
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 0,
        daysInStage: 1,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.winProbability).toBe(
        FORECAST_ENGINE_CONFIG.defaultUnknownStageWeight +
          FORECAST_ENGINE_CONFIG.healthHighBonus +
          FORECAST_ENGINE_CONFIG.momentumBonus,
      );
    });
  });

  describe('closed stages', () => {
    it('returns closed category and 100% for closed-won', () => {
      const r = run({
        stage: 'closed-won',
        amount: 50_000,
        healthStatus: 'healthy',
      });
      expect(r.winProbability).toBe(100);
      expect(r.forecastCategory).toBe('closed');
      expect(r.expectedRevenue).toBe(50_000);
      expect(r.drivers).toContainEqual(
        expect.objectContaining({ code: 'CLOSED_WON', impact: 100 }),
      );
    });

    it('returns closed category and 0% for closed-lost', () => {
      const r = run({
        stage: 'closed-lost',
        amount: 10_000,
        healthStatus: 'critical',
      });
      expect(r.winProbability).toBe(0);
      expect(r.forecastCategory).toBe('closed');
      expect(r.expectedRevenue).toBe(0);
      expect(r.drivers).toContainEqual(
        expect.objectContaining({ code: 'CLOSED_LOST', impact: -100 }),
      );
    });
  });

  describe('health adjustment', () => {
    it('applies penalty when healthScore is null', () => {
      const r = run({
        stage: 'proposal',
        healthScore: null,
        healthStatus: 'warning',
        daysSinceLastTouch: 3,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'HEALTH_UNKNOWN' && d.impact < 0)).toBe(true);
    });

    it('applies bonus when healthScore >= 80', () => {
      const r = run({
        stage: 'proposal',
        healthScore: 85,
        healthStatus: 'healthy',
        daysSinceLastTouch: 2,
        daysInStage: 3,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'HEALTH_STRONG' && d.impact > 0)).toBe(true);
    });

    it('applies penalty when healthScore < 50', () => {
      const r = run({
        stage: 'proposal',
        healthScore: 40,
        healthStatus: 'critical',
        daysSinceLastTouch: 2,
        daysInStage: 3,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'HEALTH_WEAK' && d.impact < 0)).toBe(true);
    });
  });

  describe('staleness', () => {
    it('applies severe penalty when daysSinceLastTouch >= 14', () => {
      const r = run({
        stage: 'proposal',
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 20,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'STALE_TOUCH')).toBe(true);
    });

    it('applies moderate penalty when 7 <= daysSinceLastTouch < 14', () => {
      const r = run({
        stage: 'proposal',
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 8,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'STALE_TOUCH')).toBe(true);
    });
  });

  describe('stage age', () => {
    it('applies severe penalty when daysInStage >= 30', () => {
      const r = run({
        stage: 'qualification',
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 2,
        daysInStage: 35,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'STAGE_AGE')).toBe(true);
    });

    it('applies moderate penalty when 14 <= daysInStage < 30', () => {
      const r = run({
        stage: 'qualification',
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 2,
        daysInStage: 16,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'STAGE_AGE')).toBe(true);
    });
  });

  describe('overdue next step', () => {
    it('applies penalty when nextFollowUpAt < now', () => {
      const r = run({
        stage: 'proposal',
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 2,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-02-01'),
      });
      expect(r.drivers.some((d) => d.code === 'OVERDUE_NEXT_STEP')).toBe(true);
    });
  });

  describe('positive momentum', () => {
    it('applies bonus when recent touch and not critical', () => {
      const r = run({
        stage: 'proposal',
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 1,
        daysInStage: 3,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'MOMENTUM' && d.impact > 0)).toBe(true);
    });

    it('does not apply momentum when healthStatus is critical', () => {
      const r = run({
        stage: 'proposal',
        healthScore: 30,
        healthStatus: 'critical',
        daysSinceLastTouch: 1,
        daysInStage: 3,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.drivers.some((d) => d.code === 'MOMENTUM')).toBe(false);
    });
  });

  describe('clamp boundaries', () => {
    it('clamps probability to 100', () => {
      const r = run({
        stage: 'negotiation',
        healthScore: 100,
        healthStatus: 'healthy',
        daysSinceLastTouch: 0,
        daysInStage: 1,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.winProbability).toBeLessThanOrEqual(100);
    });

    it('clamps probability to 0', () => {
      const r = run({
        stage: 'prospecting',
        healthScore: 0,
        healthStatus: 'critical',
        daysSinceLastTouch: 30,
        daysInStage: 60,
        nextFollowUpAt: new Date('2020-01-01'),
      });
      expect(r.winProbability).toBe(0);
    });
  });

  describe('category mapping', () => {
    it('commit when winProbability >= 75 and not critical', () => {
      const r = run({
        stage: 'negotiation',
        healthScore: 85,
        healthStatus: 'healthy',
        daysSinceLastTouch: 1,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.forecastCategory).toBe('commit');
    });

    it('best_case when 45 <= winProbability < 75', () => {
      const r = run({
        stage: 'proposal',
        healthScore: 60,
        healthStatus: 'warning',
        daysSinceLastTouch: 5,
        daysInStage: 10,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(['best_case', 'commit']).toContain(r.forecastCategory);
    });

    it('pipeline when winProbability < 45', () => {
      const r = run({
        stage: 'prospecting',
        healthScore: 40,
        healthStatus: 'critical',
        daysSinceLastTouch: 20,
        daysInStage: 40,
        nextFollowUpAt: new Date('2020-01-01'),
      });
      expect(r.forecastCategory).toBe('pipeline');
    });

    it('commit not applied when healthStatus is critical even if probability high', () => {
      const r = run({
        stage: 'negotiation',
        healthScore: 75,
        healthStatus: 'critical',
        daysSinceLastTouch: 15,
        daysInStage: 20,
        nextFollowUpAt: new Date('2025-02-01'),
      });
      expect(r.forecastCategory).not.toBe('commit');
    });
  });

  describe('expected revenue', () => {
    it('returns amount * (winProbability/100) when amount is set', () => {
      const r = run({
        stage: 'proposal',
        amount: 100_000,
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 2,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.expectedRevenue).toBe((100_000 * r.winProbability) / 100);
    });

    it('returns null when amount is null', () => {
      const r = run({
        stage: 'proposal',
        amount: null,
        healthScore: 80,
        healthStatus: 'healthy',
        daysSinceLastTouch: 2,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(r.expectedRevenue).toBeNull();
    });
  });

  describe('drivers list', () => {
    it('includes multiple drivers when multiple adjustments apply', () => {
      const r = run({
        stage: 'qualification',
        healthScore: null,
        healthStatus: 'warning',
        daysSinceLastTouch: 20,
        daysInStage: 40,
        nextFollowUpAt: new Date('2020-01-01'),
      });
      expect(r.drivers.length).toBeGreaterThan(1);
      expect(r.drivers.every((d) => d.code && d.label && typeof d.impact === 'number')).toBe(true);
    });
  });
});
