/**
 * Workflow Intelligence: Health Scoring v1
 * Pure module — no DB access. Deterministic, unit-tested.
 * Tune thresholds via HEALTH_SCORING_CONFIG below.
 */

export interface HealthScoreInput {
  stage: string | null;
  daysSinceLastTouch: number | null;
  daysInStage: number | null;
  nextFollowUpAt: Date | null;
  now?: Date;
}

export interface HealthSignal {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
  penalty: number;
}

export interface HealthScoreResult {
  healthScore: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  healthSignals: HealthSignal[];
}

/** Tunable constants for v1 scoring model. Change here to adjust thresholds. */
export const HEALTH_SCORING_CONFIG = {
  /** Stale touch: penalty when no recent activity */
  STALE_TOUCH_DAYS: 7,
  STALE_TOUCH_PENALTY: 20,
  STALE_TOUCH_SEVERE_DAYS: 14,
  STALE_TOUCH_ADDITIONAL_PENALTY: 15,

  /** Stage stuck: penalty when in same stage too long */
  STAGE_STUCK_DAYS: 14,
  STAGE_STUCK_PENALTY: 15,
  STAGE_STUCK_SEVERE_DAYS: 30,
  STAGE_STUCK_ADDITIONAL_PENALTY: 20,

  /** No next follow-up scheduled */
  NO_NEXT_STEP_PENALTY: 15,

  /** Overdue follow-up */
  OVERDUE_NEXT_STEP_PENALTY: 20,

  /** Early stage + no touch (ghosting heuristic) */
  EARLY_STAGES: ['qualification', 'discovery'] as const,
  EARLY_STAGE_GHOSTING_DAYS: 7,
  EARLY_STAGE_GHOSTING_PENALTY: 10,

  /** Status bands from score */
  HEALTHY_MIN: 80,
  WARNING_MIN: 50,
} as const;

const MAX_SCORE = 100;
const MIN_SCORE = 0;

function severityFromPenalty(penalty: number): 'warning' | 'critical' {
  return penalty >= 20 ? 'critical' : 'warning';
}

function statusFromScore(score: number): 'healthy' | 'warning' | 'critical' {
  if (score >= HEALTH_SCORING_CONFIG.HEALTHY_MIN) return 'healthy';
  if (score >= HEALTH_SCORING_CONFIG.WARNING_MIN) return 'warning';
  return 'critical';
}

/**
 * Compute health score (0–100), status, and signals from opportunity metrics.
 * Deterministic given the same input and config.
 */
export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const {
    STALE_TOUCH_DAYS,
    STALE_TOUCH_PENALTY,
    STALE_TOUCH_SEVERE_DAYS,
    STALE_TOUCH_ADDITIONAL_PENALTY,
    STAGE_STUCK_DAYS,
    STAGE_STUCK_PENALTY,
    STAGE_STUCK_SEVERE_DAYS,
    STAGE_STUCK_ADDITIONAL_PENALTY,
    NO_NEXT_STEP_PENALTY,
    OVERDUE_NEXT_STEP_PENALTY,
    EARLY_STAGES,
    EARLY_STAGE_GHOSTING_DAYS,
    EARLY_STAGE_GHOSTING_PENALTY,
  } = HEALTH_SCORING_CONFIG;

  const now = input.now ?? new Date();
  const signals: HealthSignal[] = [];
  let totalPenalty = 0;

  const touch = input.daysSinceLastTouch;
  const stageDays = input.daysInStage;
  const nextFollowUp = input.nextFollowUpAt;
  const stageLower = (input.stage ?? '').toLowerCase();

  // A) STALE_TOUCH
  if (touch == null || touch >= STALE_TOUCH_DAYS) {
    let penalty = STALE_TOUCH_PENALTY;
    if (touch != null && touch >= STALE_TOUCH_SEVERE_DAYS) {
      penalty += STALE_TOUCH_ADDITIONAL_PENALTY;
      signals.push({
        code: 'STALE_TOUCH',
        severity: severityFromPenalty(penalty),
        message: `No activity in ${touch} days (≥${STALE_TOUCH_SEVERE_DAYS} days is critical).`,
        penalty,
      });
    } else {
      signals.push({
        code: 'STALE_TOUCH',
        severity: severityFromPenalty(penalty),
        message:
          touch == null
            ? 'No recent activity recorded.'
            : `No activity in ${touch} days (threshold: ${STALE_TOUCH_DAYS} days).`,
        penalty,
      });
    }
    totalPenalty += penalty;
  }

  // B) STAGE_STUCK
  if (stageDays == null || stageDays >= STAGE_STUCK_DAYS) {
    let penalty = STAGE_STUCK_PENALTY;
    if (stageDays != null && stageDays >= STAGE_STUCK_SEVERE_DAYS) {
      penalty += STAGE_STUCK_ADDITIONAL_PENALTY;
      signals.push({
        code: 'STAGE_STUCK',
        severity: severityFromPenalty(penalty),
        message: `In same stage for ${stageDays} days (≥${STAGE_STUCK_SEVERE_DAYS} days is critical).`,
        penalty,
      });
    } else {
      signals.push({
        code: 'STAGE_STUCK',
        severity: severityFromPenalty(penalty),
        message:
          stageDays == null
            ? 'Stage tenure unknown.'
            : `In same stage for ${stageDays} days (threshold: ${STAGE_STUCK_DAYS} days).`,
        penalty,
      });
    }
    totalPenalty += penalty;
  }

  // C) NO_NEXT_STEP
  if (nextFollowUp == null) {
    signals.push({
      code: 'NO_NEXT_STEP',
      severity: severityFromPenalty(NO_NEXT_STEP_PENALTY),
      message: 'No next follow-up scheduled.',
      penalty: NO_NEXT_STEP_PENALTY,
    });
    totalPenalty += NO_NEXT_STEP_PENALTY;
  } else {
    // D) OVERDUE_NEXT_STEP
    if (nextFollowUp < now) {
      signals.push({
        code: 'OVERDUE_NEXT_STEP',
        severity: severityFromPenalty(OVERDUE_NEXT_STEP_PENALTY),
        message: 'Next follow-up is overdue.',
        penalty: OVERDUE_NEXT_STEP_PENALTY,
      });
      totalPenalty += OVERDUE_NEXT_STEP_PENALTY;
    }
  }

  // E) EARLY_STAGE_GHOSTING
  const isEarlyStage = EARLY_STAGES.some((s) => s === stageLower);
  if (isEarlyStage && touch != null && touch >= EARLY_STAGE_GHOSTING_DAYS) {
    signals.push({
      code: 'EARLY_STAGE_GHOSTING',
      severity: severityFromPenalty(EARLY_STAGE_GHOSTING_PENALTY),
      message: `Early stage (${input.stage}) with no touch in ${touch} days.`,
      penalty: EARLY_STAGE_GHOSTING_PENALTY,
    });
    totalPenalty += EARLY_STAGE_GHOSTING_PENALTY;
  }

  const healthScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, MAX_SCORE - totalPenalty));
  const healthStatus = statusFromScore(healthScore);

  return {
    healthScore,
    healthStatus,
    healthSignals: signals,
  };
}
