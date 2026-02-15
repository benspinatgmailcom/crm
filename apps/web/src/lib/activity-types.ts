/** Human-createable activity types (POST /activities) */
export const CREATABLE_ACTIVITY_TYPES = [
  "note",
  "call",
  "meeting",
  "email",
  "task",
] as const;
export type CreatableActivityType = (typeof CREATABLE_ACTIVITY_TYPES)[number];

/** All activity types shown in timeline filter (including system-generated) */
export const ALL_ACTIVITY_TYPES = [
  "note",
  "call",
  "meeting",
  "email",
  "task",
  "ai_summary",
  "ai_recommendation",
  "file_uploaded",
  "file_deleted",
  "stage_change",
] as const;
export type ActivityType = (typeof ALL_ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  call: "Call",
  meeting: "Meeting",
  email: "Email",
  task: "Task",
  ai_summary: "AI Summary",
  ai_recommendation: "AI Recommendation",
  file_uploaded: "File Uploaded",
  file_deleted: "File Deleted",
  stage_change: "Stage Change",
};
