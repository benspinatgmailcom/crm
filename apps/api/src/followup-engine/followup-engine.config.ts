/**
 * Auto Follow-Up Task Engine v1 — rules, thresholds, and constants.
 * Tune here to change suggestion behavior and cooldowns.
 */

export const FOLLOWUP_ENGINE_CONFIG = {
  /** Rule 1: Stale touch + no next step */
  STALE_TOUCH_DAYS: 7,
  STALE_TOUCH_CRITICAL_DAYS: 14,
  STALE_TOUCH_NO_NEXT_STEP_COOLDOWN_DAYS: 5,

  /** Rule 2: Overdue next step */
  OVERDUE_NEXT_STEP_COOLDOWN_DAYS: 3,

  /** Rule 3: Stage stuck */
  STAGE_STUCK_DAYS: 14,
  STAGE_STUCK_CRITICAL_DAYS: 30,
  STAGE_STUCK_COOLDOWN_DAYS: 7,

  /** Rule 4: Critical health */
  CRITICAL_HEALTH_COOLDOWN_DAYS: 7,
  CRITICAL_HEALTH_TOP_SIGNALS: 3,

  /** Default suggestion due time (hour in 0–23) */
  DEFAULT_DUE_HOUR: 9,
  OVERDUE_DUE_HOUR: 17, // 5pm
} as const;
