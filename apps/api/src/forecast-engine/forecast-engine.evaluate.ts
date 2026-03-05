/**
 * Forecast engine v1 – pure deterministic evaluation.
 * No DB access. Unit-tested.
 */
import { FORECAST_ENGINE_CONFIG } from './forecast-engine.config';
import type {
  ForecastCategory,
  ForecastDriver,
  ForecastEngineInput,
  ForecastEngineOutput,
} from './forecast-engine.types';

const CLOSED_WON = 'closed-won';
const CLOSED_LOST = 'closed-lost';

function clampProbability(p: number): number {
  return Math.max(0, Math.min(100, Math.round(p)));
}

/**
 * Evaluate win probability, forecast category, expected revenue, and drivers.
 */
export function evaluateForecast(
  input: ForecastEngineInput,
  now: Date = new Date(),
): ForecastEngineOutput {
  const stageLower = (input.stage ?? '').toLowerCase().trim();
  const stageKey = stageLower || 'prospecting';

  // Closed stages: category "closed", probability 100 or 0
  if (stageKey === CLOSED_WON) {
    const amount = input.amount ?? 0;
    return {
      winProbability: 100,
      forecastCategory: 'closed',
      expectedRevenue: input.amount != null ? amount * 1 : null,
      drivers: [{ code: 'CLOSED_WON', label: 'Deal won', impact: 100 }],
    };
  }
  if (stageKey === CLOSED_LOST) {
    return {
      winProbability: 0,
      forecastCategory: 'closed',
      expectedRevenue: 0,
      drivers: [{ code: 'CLOSED_LOST', label: 'Deal lost', impact: -100 }],
    };
  }

  const {
    stageWeights,
    defaultUnknownStageWeight,
    commitMinProbability,
    bestCaseMinProbability,
    healthNullPenalty,
    healthHighBonus,
    healthHighMin,
    healthWarningMin,
    healthLowPenalty,
    staleSevereDays,
    staleSeverePenalty,
    staleModerateDays,
    staleModeratePenalty,
    stageAgeSevereDays,
    stageAgeSeverePenalty,
    stageAgeModerateDays,
    stageAgeModeratePenalty,
    overdueNextStepPenalty,
    momentumTouchDays,
    momentumBonus,
  } = FORECAST_ENGINE_CONFIG;

  let probability =
    stageWeights[stageKey] ?? defaultUnknownStageWeight;
  const drivers: ForecastDriver[] = [];

  // A) Health adjustment
  if (input.healthScore == null) {
    probability -= healthNullPenalty;
    drivers.push({
      code: 'HEALTH_UNKNOWN',
      label: 'Health score unknown',
      impact: -healthNullPenalty,
    });
  } else {
    if (input.healthScore >= healthHighMin) {
      probability += healthHighBonus;
      drivers.push({
        code: 'HEALTH_STRONG',
        label: 'Strong health score',
        impact: healthHighBonus,
      });
    } else if (input.healthScore < healthWarningMin) {
      probability -= healthLowPenalty;
      drivers.push({
        code: 'HEALTH_WEAK',
        label: 'Low health score',
        impact: -healthLowPenalty,
      });
    }
  }

  // B) Staleness
  const touch = input.daysSinceLastTouch;
  if (touch == null || touch >= staleSevereDays) {
    probability -= staleSeverePenalty;
    drivers.push({
      code: 'STALE_TOUCH',
      label: touch != null ? `No touch in ${touch} days` : 'No recent activity',
      impact: -staleSeverePenalty,
    });
  } else if (touch >= staleModerateDays) {
    probability -= staleModeratePenalty;
    drivers.push({
      code: 'STALE_TOUCH',
      label: `No touch in ${touch} days`,
      impact: -staleModeratePenalty,
    });
  }

  // C) Stage age
  const stageDays = input.daysInStage;
  if (stageDays == null || stageDays >= stageAgeSevereDays) {
    probability -= stageAgeSeverePenalty;
    drivers.push({
      code: 'STAGE_AGE',
      label:
        stageDays != null
          ? `In stage ${stageDays} days`
          : 'Stage tenure unknown',
      impact: -stageAgeSeverePenalty,
    });
  } else if (stageDays >= stageAgeModerateDays) {
    probability -= stageAgeModeratePenalty;
    drivers.push({
      code: 'STAGE_AGE',
      label: `In stage ${stageDays} days`,
      impact: -stageAgeModeratePenalty,
    });
  }

  // D) Overdue next step
  if (
    input.nextFollowUpAt != null &&
    input.nextFollowUpAt < now
  ) {
    probability -= overdueNextStepPenalty;
    drivers.push({
      code: 'OVERDUE_NEXT_STEP',
      label: 'Next follow-up overdue',
      impact: -overdueNextStepPenalty,
    });
  }

  // E) Positive momentum
  if (
    touch != null &&
    touch <= momentumTouchDays &&
    input.healthStatus !== 'critical'
  ) {
    probability += momentumBonus;
    drivers.push({
      code: 'MOMENTUM',
      label: 'Recent activity, healthy',
      impact: momentumBonus,
    });
  }

  const winProbability = clampProbability(probability);

  // Category
  let forecastCategory: ForecastCategory = 'pipeline';
  if (winProbability >= commitMinProbability && input.healthStatus !== 'critical') {
    forecastCategory = 'commit';
  } else if (winProbability >= bestCaseMinProbability) {
    forecastCategory = 'best_case';
  }

  const expectedRevenue =
    input.amount != null
      ? input.amount * (winProbability / 100)
      : null;

  return {
    winProbability,
    forecastCategory,
    expectedRevenue,
    drivers,
  };
}
