/**
 * Activity metadata shapes for follow-up and task activities (stored in Activity.metadata).
 */

export interface FollowupSuggestionMetadata {
  ruleCode: string;
  title: string;
  description: string;
  suggestedDueAt: string; // ISO
  severity: 'warning' | 'critical';
  dedupeKey: string;
  cooldownDays: number;
  reasonCodes: string[];
  status: 'SUGGESTED';
}

export interface TaskCreatedMetadata {
  ruleCode: string;
  title: string;
  description: string;
  dueAt: string; // ISO
  priority: 'low' | 'medium' | 'high';
  status: 'OPEN';
  dedupeKey: string;
  createdFromSuggestionActivityId?: string;
}

export interface TaskStateChangeMetadata {
  taskActivityId: string;
  status: 'COMPLETED' | 'DISMISSED' | 'SNOOZED';
  snoozedUntil?: string; // ISO, for SNOOZED
}
