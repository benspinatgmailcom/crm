/**
 * Forecast engine v1 – configurable stage weights and thresholds.
 */

/** Default win probability by stage (0–100). Unknown stages use DEFAULT_UNKNOWN_STAGE_WEIGHT. */
export const FORECAST_ENGINE_CONFIG = {
  stageWeights: {
    prospecting: 10,
    qualification: 20,
    discovery: 35,
    proposal: 50,
    negotiation: 70,
    'closed-won': 100,
    'closed-lost': 0,
  } as Record<string, number>,

  /** Weight for stages not in stageWeights */
  defaultUnknownStageWeight: 10,

  /** Category thresholds (winProbability) */
  commitMinProbability: 75,
  bestCaseMinProbability: 45,

  /** Health adjustment */
  healthNullPenalty: 5,
  healthHighBonus: 10,   // healthScore >= 80
  healthHighMin: 80,
  healthWarningMin: 50,
  healthLowPenalty: 15,  // healthScore < 50

  /** Staleness (daysSinceLastTouch) */
  staleSevereDays: 14,
  staleSeverePenalty: 15,
  staleModerateDays: 7,
  staleModeratePenalty: 8,

  /** Stage age (daysInStage) */
  stageAgeSevereDays: 30,
  stageAgeSeverePenalty: 12,
  stageAgeModerateDays: 14,
  stageAgeModeratePenalty: 6,

  /** Overdue next step */
  overdueNextStepPenalty: 8,

  /** Positive momentum: recent touch + not critical */
  momentumTouchDays: 2,
  momentumBonus: 5,
} as const;
