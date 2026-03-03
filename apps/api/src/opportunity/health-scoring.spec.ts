import {
  computeHealthScore,
  HEALTH_SCORING_CONFIG,
  type HealthScoreInput,
} from './health-scoring';

describe('health-scoring', () => {
  const now = new Date('2025-02-15T12:00:00.000Z');

  function run(input: Partial<HealthScoreInput> & Pick<HealthScoreInput, 'stage'>) {
    return computeHealthScore({
      stage: input.stage ?? null,
      daysSinceLastTouch: input.daysSinceLastTouch ?? null,
      daysInStage: input.daysInStage ?? null,
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      now,
    });
  }

  describe('baseline and clamping', () => {
    it('returns 100 and healthy when no penalties apply', () => {
      const result = run({
        stage: 'negotiation',
        daysSinceLastTouch: 2,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthScore).toBe(100);
      expect(result.healthStatus).toBe('healthy');
      expect(result.healthSignals).toHaveLength(0);
    });

    it('clamps score to 0 when total penalty exceeds 100', () => {
      const result = run({
        stage: 'qualification',
        daysSinceLastTouch: 30,
        daysInStage: 45,
        nextFollowUpAt: new Date('2020-01-01'), // overdue
      });
      expect(result.healthScore).toBe(0);
      expect(result.healthStatus).toBe('critical');
    });

    it('clamps score to 100 when no penalties', () => {
      const result = run({
        stage: 'proposal',
        daysSinceLastTouch: 0,
        daysInStage: 1,
        nextFollowUpAt: new Date('2025-03-01'),
      });
      expect(result.healthScore).toBe(100);
      expect(result.healthStatus).toBe('healthy');
    });
  });

  describe('STALE_TOUCH', () => {
    it('applies -20 when daysSinceLastTouch is null', () => {
      const result = run({
        stage: 'proposal',
        daysSinceLastTouch: null,
        daysInStage: 3,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthScore).toBe(80);
      const signal = result.healthSignals.find((s) => s.code === 'STALE_TOUCH');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(20);
      expect(signal!.message).toContain('No recent activity');
    });

    it('applies -20 when daysSinceLastTouch >= 7', () => {
      const result = run({
        stage: 'proposal',
        daysSinceLastTouch: 7,
        daysInStage: 3,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthScore).toBe(80);
      const signal = result.healthSignals.find((s) => s.code === 'STALE_TOUCH');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(20);
    });

    it('applies -35 when daysSinceLastTouch >= 14 (overlapping penalty)', () => {
      const result = run({
        stage: 'proposal',
        daysSinceLastTouch: 14,
        daysInStage: 3,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      const signal = result.healthSignals.find((s) => s.code === 'STALE_TOUCH');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(35);
      expect(result.healthScore).toBe(65);
    });

    it('does not apply when daysSinceLastTouch < 7', () => {
      const result = run({
        stage: 'proposal',
        daysSinceLastTouch: 6,
        daysInStage: 3,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthSignals.some((s) => s.code === 'STALE_TOUCH')).toBe(false);
      expect(result.healthScore).toBe(100);
    });
  });

  describe('STAGE_STUCK', () => {
    it('applies -15 when daysInStage is null', () => {
      const result = run({
        stage: 'discovery',
        daysSinceLastTouch: 2,
        daysInStage: null,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      const signal = result.healthSignals.find((s) => s.code === 'STAGE_STUCK');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(15);
    });

    it('applies -15 when daysInStage >= 14', () => {
      const result = run({
        stage: 'discovery',
        daysSinceLastTouch: 2,
        daysInStage: 14,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      const signal = result.healthSignals.find((s) => s.code === 'STAGE_STUCK');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(15);
    });

    it('applies -35 when daysInStage >= 30', () => {
      const result = run({
        stage: 'qualification',
        daysSinceLastTouch: 2,
        daysInStage: 30,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      const signal = result.healthSignals.find((s) => s.code === 'STAGE_STUCK');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(35);
    });

    it('does not apply when daysInStage < 14', () => {
      const result = run({
        stage: 'proposal',
        daysSinceLastTouch: 2,
        daysInStage: 13,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthSignals.some((s) => s.code === 'STAGE_STUCK')).toBe(false);
    });
  });

  describe('NO_NEXT_STEP', () => {
    it('applies -15 when nextFollowUpAt is null', () => {
      const result = run({
        stage: 'negotiation',
        daysSinceLastTouch: 1,
        daysInStage: 2,
        nextFollowUpAt: null,
      });
      const signal = result.healthSignals.find((s) => s.code === 'NO_NEXT_STEP');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(15);
      expect(result.healthScore).toBe(85);
    });
  });

  describe('OVERDUE_NEXT_STEP', () => {
    it('applies -20 when nextFollowUpAt < now', () => {
      const result = run({
        stage: 'negotiation',
        daysSinceLastTouch: 1,
        daysInStage: 2,
        nextFollowUpAt: new Date('2025-02-10'),
      });
      const signal = result.healthSignals.find((s) => s.code === 'OVERDUE_NEXT_STEP');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(20);
      expect(result.healthScore).toBe(80);
    });

    it('does not apply when nextFollowUpAt is null', () => {
      const result = run({
        stage: 'negotiation',
        daysSinceLastTouch: 1,
        daysInStage: 2,
        nextFollowUpAt: null,
      });
      expect(result.healthSignals.some((s) => s.code === 'OVERDUE_NEXT_STEP')).toBe(false);
    });

    it('does not apply when nextFollowUpAt >= now', () => {
      const result = run({
        stage: 'negotiation',
        daysSinceLastTouch: 1,
        daysInStage: 2,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthSignals.some((s) => s.code === 'OVERDUE_NEXT_STEP')).toBe(false);
    });
  });

  describe('EARLY_STAGE_GHOSTING', () => {
    it('applies -10 for qualification + daysSinceLastTouch >= 7', () => {
      const result = run({
        stage: 'qualification',
        daysSinceLastTouch: 7,
        daysInStage: 10,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      const signal = result.healthSignals.find((s) => s.code === 'EARLY_STAGE_GHOSTING');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(10);
    });

    it('applies -10 for discovery + daysSinceLastTouch >= 7', () => {
      const result = run({
        stage: 'discovery',
        daysSinceLastTouch: 8,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      const signal = result.healthSignals.find((s) => s.code === 'EARLY_STAGE_GHOSTING');
      expect(signal).toBeDefined();
      expect(signal!.penalty).toBe(10);
    });

    it('does not apply for late stage even when touch >= 7', () => {
      const result = run({
        stage: 'negotiation',
        daysSinceLastTouch: 10,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthSignals.some((s) => s.code === 'EARLY_STAGE_GHOSTING')).toBe(false);
    });

    it('does not apply when daysSinceLastTouch < 7', () => {
      const result = run({
        stage: 'qualification',
        daysSinceLastTouch: 6,
        daysInStage: 10,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthSignals.some((s) => s.code === 'EARLY_STAGE_GHOSTING')).toBe(false);
    });

    it('is case-insensitive for stage', () => {
      const result = run({
        stage: 'QUALIFICATION',
        daysSinceLastTouch: 7,
        daysInStage: 5,
        nextFollowUpAt: new Date('2025-02-20'),
      });
      expect(result.healthSignals.some((s) => s.code === 'EARLY_STAGE_GHOSTING')).toBe(true);
    });
  });

  describe('status bands', () => {
    it('80-100 => healthy', () => {
      expect(run({ stage: 'proposal', daysSinceLastTouch: 0, daysInStage: 0, nextFollowUpAt: new Date('2025-03-01') }).healthStatus).toBe('healthy');
      expect(run({ stage: 'proposal', daysSinceLastTouch: 1, daysInStage: 1, nextFollowUpAt: null }).healthScore).toBe(85);
      expect(run({ stage: 'proposal', daysSinceLastTouch: 1, daysInStage: 1, nextFollowUpAt: null }).healthStatus).toBe('healthy');
    });

    it('50-79 => warning', () => {
      const result = run({
        stage: 'proposal',
        daysSinceLastTouch: 7,
        daysInStage: 14,
        nextFollowUpAt: null,
      });
      expect(result.healthScore).toBeLessThanOrEqual(79);
      expect(result.healthScore).toBeGreaterThanOrEqual(50);
      expect(result.healthStatus).toBe('warning');
    });

    it('0-49 => critical', () => {
      const result = run({
        stage: 'qualification',
        daysSinceLastTouch: 20,
        daysInStage: 35,
        nextFollowUpAt: null,
      });
      expect(result.healthStatus).toBe('critical');
    });
  });

  describe('null-safe', () => {
    it('handles all nulls without throwing', () => {
      const result = run({
        stage: null,
        daysSinceLastTouch: null,
        daysInStage: null,
        nextFollowUpAt: null,
      });
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthStatus).toBeDefined();
      expect(Array.isArray(result.healthSignals)).toBe(true);
    });
  });

  it('config is in one place and exported', () => {
    expect(HEALTH_SCORING_CONFIG.STALE_TOUCH_DAYS).toBe(7);
    expect(HEALTH_SCORING_CONFIG.STALE_TOUCH_SEVERE_DAYS).toBe(14);
    expect(HEALTH_SCORING_CONFIG.EARLY_STAGES).toContain('qualification');
    expect(HEALTH_SCORING_CONFIG.EARLY_STAGES).toContain('discovery');
  });
});
