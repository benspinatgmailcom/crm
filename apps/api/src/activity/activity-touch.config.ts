/**
 * Activity types that count as a "customer touch" and update Opportunity.lastActivityAt.
 * All other activity types (e.g. followup_suggested, followup_draft_created, task_created)
 * do NOT update lastActivityAt.
 * Adjust this list to change which activities refresh deal aging.
 */
export const TOUCH_ACTIVITY_TYPES = [
  'note',
  'call',
  'meeting',
  'email',
  'task',
  'stage_change',
  'file_uploaded',
  'file_deleted',
  'followup_sent',
  'task_completed',
  'ai_summary',
  'ai_recommendation',
  'ai_email_draft',
  'lead_converted',
] as const;

export type TouchActivityType = (typeof TOUCH_ACTIVITY_TYPES)[number];

export function isTouchActivityType(type: string): boolean {
  return (TOUCH_ACTIVITY_TYPES as readonly string[]).includes(type);
}
