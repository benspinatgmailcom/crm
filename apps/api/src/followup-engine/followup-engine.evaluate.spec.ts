import {
  evaluateOpportunityForFollowups,
} from './followup-engine.evaluate';
import { getOverdueDueDate, getTodayAt5pm, getTomorrowAt9am, getWithinTwoDays9am } from './followup-engine.time';

describe('evaluateOpportunityForFollowups', () => {
  const baseInput = {
    opportunityId: 'opp-1',
    stage: 'proposal',
    nextFollowUpAt: null as Date | null,
    daysSinceLastTouch: null as number | null,
    daysInStage: null as number | null,
    healthStatus: 'healthy' as const,
    healthSignals: [] as Array<{ code: string; severity: string; message: string; penalty: number }>,
  };

  it('returns empty when no rules match', () => {
    const input = {
      ...baseInput,
      daysSinceLastTouch: 3,
      daysInStage: 5,
      nextFollowUpAt: new Date(Date.now() + 86400000),
    };
    const result = evaluateOpportunityForFollowups(input);
    expect(result).toHaveLength(0);
  });

  describe('STALE_TOUCH_NO_NEXT_STEP', () => {
    it('suggests when daysSinceLastTouch >= 7 and no next step', () => {
      const now = new Date('2025-02-12T14:00:00.000Z');
      const result = evaluateOpportunityForFollowups(
        { ...baseInput, daysSinceLastTouch: 7, daysInStage: 5, nextFollowUpAt: null },
        now,
      );
      const spec = result.find((s) => s.ruleCode === 'STALE_TOUCH_NO_NEXT_STEP');
      expect(spec).toBeDefined();
      expect(spec?.title).toBe('Follow up with customer');
      expect(spec?.severity).toBe('warning');
      expect(spec?.reasonCodes).toContain('STALE_TOUCH');
      expect(spec?.reasonCodes).toContain('NO_NEXT_STEP');
      expect(spec?.suggestedDueAt).toEqual(getTomorrowAt9am(now));
      expect(spec?.cooldownDays).toBe(5);
    });

    it('severity is critical when daysSinceLastTouch >= 14', () => {
      const result = evaluateOpportunityForFollowups({
        ...baseInput,
        daysSinceLastTouch: 14,
        nextFollowUpAt: null,
      });
      expect(result.find((s) => s.ruleCode === 'STALE_TOUCH_NO_NEXT_STEP')?.severity).toBe('critical');
    });

    it('does not suggest when nextFollowUpAt is set', () => {
      const result = evaluateOpportunityForFollowups({
        ...baseInput,
        daysSinceLastTouch: 10,
        nextFollowUpAt: new Date(),
      });
      expect(result.find((s) => s.ruleCode === 'STALE_TOUCH_NO_NEXT_STEP')).toBeUndefined();
    });
  });

  describe('OVERDUE_NEXT_STEP', () => {
    it('suggests when nextFollowUpAt is in the past', () => {
      const now = new Date('2025-02-12T10:00:00.000Z');
      const result = evaluateOpportunityForFollowups(
        { ...baseInput, nextFollowUpAt: new Date('2025-02-10T09:00:00.000Z') },
        now,
      );
      expect(result.find((s) => s.ruleCode === 'OVERDUE_NEXT_STEP')).toBeDefined();
      expect(result.find((s) => s.ruleCode === 'OVERDUE_NEXT_STEP')?.severity).toBe('critical');
      expect(result.find((s) => s.ruleCode === 'OVERDUE_NEXT_STEP')?.suggestedDueAt).toEqual(
        getOverdueDueDate(now),
      );
      expect(result.find((s) => s.ruleCode === 'OVERDUE_NEXT_STEP')?.cooldownDays).toBe(3);
    });
  });

  describe('STAGE_STUCK_CHECKPOINT', () => {
    it('suggests when daysInStage >= 14', () => {
      const now = new Date('2025-02-12T12:00:00.000Z');
      const result = evaluateOpportunityForFollowups(
        { ...baseInput, daysInStage: 14 },
        now,
      );
      const spec = result.find((s) => s.ruleCode === 'STAGE_STUCK_CHECKPOINT');
      expect(spec).toBeDefined();
      expect(spec?.severity).toBe('warning');
      expect(spec?.suggestedDueAt).toEqual(getWithinTwoDays9am(now));
      expect(spec?.cooldownDays).toBe(7);
    });

    it('severity is critical when daysInStage >= 30', () => {
      const result = evaluateOpportunityForFollowups({
        ...baseInput,
        daysInStage: 30,
      });
      expect(result.find((s) => s.ruleCode === 'STAGE_STUCK_CHECKPOINT')?.severity).toBe('critical');
    });
  });

  describe('CRITICAL_HEALTH_RECOVERY', () => {
    it('suggests when healthStatus is critical', () => {
      const now = new Date('2025-02-12T12:00:00.000Z');
      const result = evaluateOpportunityForFollowups(
        {
          ...baseInput,
          healthStatus: 'critical',
          healthSignals: [
            { code: 'STALE_TOUCH', severity: 'critical', message: 'x', penalty: 20 },
            { code: 'NO_NEXT_STEP', severity: 'warning', message: 'y', penalty: 15 },
            { code: 'OVERDUE_NEXT_STEP', severity: 'critical', message: 'z', penalty: 20 },
          ],
        },
        now,
      );
      const spec = result.find((s) => s.ruleCode === 'CRITICAL_HEALTH_RECOVERY');
      expect(spec).toBeDefined();
      expect(spec?.reasonCodes).toEqual(['STALE_TOUCH', 'NO_NEXT_STEP', 'OVERDUE_NEXT_STEP']);
      expect(spec?.suggestedDueAt).toEqual(getTomorrowAt9am(now));
      expect(spec?.cooldownDays).toBe(7);
    });

    it('does not suggest when healthStatus is not critical', () => {
      const result = evaluateOpportunityForFollowups({
        ...baseInput,
        healthStatus: 'warning',
      });
      expect(result.find((s) => s.ruleCode === 'CRITICAL_HEALTH_RECOVERY')).toBeUndefined();
    });
  });

  describe('dedupeKey', () => {
    it('is opportunityId:ruleCode', () => {
      const result = evaluateOpportunityForFollowups({
        ...baseInput,
        daysSinceLastTouch: 8,
        daysInStage: 5,
        nextFollowUpAt: null,
      });
      const spec = result.find((s) => s.ruleCode === 'STALE_TOUCH_NO_NEXT_STEP');
      expect(spec?.dedupeKey).toBe('opp-1:STALE_TOUCH_NO_NEXT_STEP');
    });
  });
});

describe('time helpers', () => {
  it('getTomorrowAt9am sets next day 09:00', () => {
    const now = new Date('2025-02-12T14:30:00.000Z');
    const d = getTomorrowAt9am(now);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it('getOverdueDueDate returns today 5pm when before 5pm', () => {
    const now = new Date('2025-02-12T14:00:00.000Z');
    const d = getOverdueDueDate(now);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(17);
  });

  it('getOverdueDueDate returns next day 9am when after 5pm', () => {
    const base = new Date('2025-02-12T12:00:00.000Z');
    const fivePm = getTodayAt5pm(base);
    const afterFive = new Date(fivePm.getTime() + 3600000);
    const d = getOverdueDueDate(afterFive);
    expect(d.getHours()).toBe(9);
    expect(d.getTime()).toBeGreaterThan(afterFive.getTime());
  });

  it('getWithinTwoDays9am is 2 days ahead at 9am', () => {
    const now = new Date('2025-02-12T10:00:00.000Z');
    const d = getWithinTwoDays9am(now);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(9);
  });
});
