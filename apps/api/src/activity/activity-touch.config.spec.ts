import { isTouchActivityType, TOUCH_ACTIVITY_TYPES } from './activity-touch.config';

describe('activity-touch.config', () => {
  it('includes expected touch types', () => {
    expect(isTouchActivityType('note')).toBe(true);
    expect(isTouchActivityType('call')).toBe(true);
    expect(isTouchActivityType('email')).toBe(true);
    expect(isTouchActivityType('followup_sent')).toBe(true);
    expect(isTouchActivityType('task_completed')).toBe(true);
  });

  it('excludes non-touch types', () => {
    expect(isTouchActivityType('followup_suggested')).toBe(false);
    expect(isTouchActivityType('followup_draft_created')).toBe(false);
    expect(isTouchActivityType('task_created')).toBe(false);
    expect(isTouchActivityType('task_dismissed')).toBe(false);
    expect(isTouchActivityType('task_snoozed')).toBe(false);
  });

  it('TOUCH_ACTIVITY_TYPES is non-empty', () => {
    expect(TOUCH_ACTIVITY_TYPES.length).toBeGreaterThan(0);
  });
});
