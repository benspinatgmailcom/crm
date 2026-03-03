/**
 * Pure evaluation: given opportunity metrics, produce SuggestionSpec[].
 * No DB access. Deterministic and unit-testable.
 */

import { FOLLOWUP_ENGINE_CONFIG } from './followup-engine.config';
import { getOverdueDueDate, getTomorrowAt9am, getWithinTwoDays9am } from './followup-engine.time';
import type { FollowUpEngineInput, SuggestionSpec } from './followup-engine.types';

function buildDedupeKey(opportunityId: string, ruleCode: string): string {
  return `${opportunityId}:${ruleCode}`;
}

/**
 * Evaluate a single opportunity and return all suggestion specs that match the rules.
 * Does not apply dedupe/cooldown (that is done by the service when persisting).
 */
export function evaluateOpportunityForFollowups(
  input: FollowUpEngineInput,
  now: Date = new Date(),
): SuggestionSpec[] {
  const specs: SuggestionSpec[] = [];
  const {
    opportunityId,
    stage,
    nextFollowUpAt,
    daysSinceLastTouch,
    daysInStage,
    healthStatus,
    healthSignals,
  } = input;

  const touch = daysSinceLastTouch;
  const stageDays = daysInStage;
  const hasNoNextStep = nextFollowUpAt == null;

  // Rule 1: STALE_TOUCH_NO_NEXT_STEP
  const touchStale = touch == null || touch >= FOLLOWUP_ENGINE_CONFIG.STALE_TOUCH_DAYS;
  if (touchStale && hasNoNextStep) {
    const severity: 'warning' | 'critical' =
      touch != null && touch >= FOLLOWUP_ENGINE_CONFIG.STALE_TOUCH_CRITICAL_DAYS ? 'critical' : 'warning';
    specs.push({
      ruleCode: 'STALE_TOUCH_NO_NEXT_STEP',
      title: 'Follow up with customer',
      description: 'No touch in a while and no next step scheduled.',
      suggestedDueAt: getTomorrowAt9am(now),
      severity,
      cooldownDays: FOLLOWUP_ENGINE_CONFIG.STALE_TOUCH_NO_NEXT_STEP_COOLDOWN_DAYS,
      dedupeKey: buildDedupeKey(opportunityId, 'STALE_TOUCH_NO_NEXT_STEP'),
      reasonCodes: ['STALE_TOUCH', 'NO_NEXT_STEP'],
    });
  }

  // Rule 2: OVERDUE_NEXT_STEP
  if (nextFollowUpAt != null && nextFollowUpAt < now) {
    specs.push({
      ruleCode: 'OVERDUE_NEXT_STEP',
      title: 'Complete overdue follow-up',
      description: 'Next step date is overdue.',
      suggestedDueAt: getOverdueDueDate(now),
      severity: 'critical',
      cooldownDays: FOLLOWUP_ENGINE_CONFIG.OVERDUE_NEXT_STEP_COOLDOWN_DAYS,
      dedupeKey: buildDedupeKey(opportunityId, 'OVERDUE_NEXT_STEP'),
      reasonCodes: ['OVERDUE_NEXT_STEP'],
    });
  }

  // Rule 3: STAGE_STUCK_CHECKPOINT
  const stageStuck = stageDays == null || stageDays >= FOLLOWUP_ENGINE_CONFIG.STAGE_STUCK_DAYS;
  if (stageStuck) {
    const severity: 'warning' | 'critical' =
      stageDays != null && stageDays >= FOLLOWUP_ENGINE_CONFIG.STAGE_STUCK_CRITICAL_DAYS ? 'critical' : 'warning';
    specs.push({
      ruleCode: 'STAGE_STUCK_CHECKPOINT',
      title: 'Schedule a stage checkpoint',
      description: 'Deal has been in this stage for a while—confirm blocker and next action.',
      suggestedDueAt: getWithinTwoDays9am(now),
      severity,
      cooldownDays: FOLLOWUP_ENGINE_CONFIG.STAGE_STUCK_COOLDOWN_DAYS,
      dedupeKey: buildDedupeKey(opportunityId, 'STAGE_STUCK_CHECKPOINT'),
      reasonCodes: ['STAGE_STUCK'],
    });
  }

  // Rule 4: CRITICAL_HEALTH_RECOVERY
  if (healthStatus === 'critical') {
    const topCodes = healthSignals
      .slice(0, FOLLOWUP_ENGINE_CONFIG.CRITICAL_HEALTH_TOP_SIGNALS)
      .map((s) => s.code);
    specs.push({
      ruleCode: 'CRITICAL_HEALTH_RECOVERY',
      title: 'Create recovery plan',
      description: 'Deal health is critical—review risks and define next steps.',
      suggestedDueAt: getTomorrowAt9am(now),
      severity: 'critical',
      cooldownDays: FOLLOWUP_ENGINE_CONFIG.CRITICAL_HEALTH_COOLDOWN_DAYS,
      dedupeKey: buildDedupeKey(opportunityId, 'CRITICAL_HEALTH_RECOVERY'),
      reasonCodes: topCodes.length > 0 ? topCodes : ['CRITICAL_HEALTH'],
    });
  }

  return specs;
}
