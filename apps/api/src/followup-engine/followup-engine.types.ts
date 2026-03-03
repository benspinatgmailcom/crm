/**
 * Types for the follow-up engine (suggestions and tasks).
 */

export interface SuggestionSpec {
  ruleCode: string;
  title: string;
  description: string;
  suggestedDueAt: Date;
  severity: 'warning' | 'critical';
  cooldownDays: number;
  dedupeKey: string;
  reasonCodes: string[];
}

export interface FollowUpEngineInput {
  opportunityId: string;
  stage: string | null;
  nextFollowUpAt: Date | null;
  daysSinceLastTouch: number | null;
  daysInStage: number | null;
  healthStatus: 'healthy' | 'warning' | 'critical' | null;
  healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
}
