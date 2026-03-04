export const DRAFT_CHANNELS = ['email', 'call', 'linkedin'] as const;
export const DRAFT_TONES = ['friendly', 'direct', 'executive'] as const;
export const DRAFT_LENGTHS = ['short', 'medium'] as const;
export const DRAFT_CTAS = ['schedule', 'confirm_next_steps', 'get_update', 'share_feedback'] as const;

export type DraftChannel = (typeof DRAFT_CHANNELS)[number];
export type DraftTone = (typeof DRAFT_TONES)[number];
export type DraftLength = (typeof DRAFT_LENGTHS)[number];
export type DraftCta = (typeof DRAFT_CTAS)[number];

export interface CreateDraftOptions {
  channel?: DraftChannel;
  tone?: DraftTone;
  length?: DraftLength;
  cta?: DraftCta;
}

export interface DraftContextBrief {
  opportunity: {
    id: string;
    name: string;
    stage: string | null;
    amount: string | null;
    closeDate: string | null;
    nextFollowUpAt: string | null;
    lastActivityAt: string | null;
    lastStageChangedAt: string | null;
    daysSinceLastTouch: number | null;
    daysInStage: number | null;
    healthStatus: string | null;
    healthSignals: Array<{ code: string; message: string }>;
  };
  trigger: {
    ruleCode: string;
    severity: string;
    reasonCodes: string[];
    title: string;
    description: string;
  };
  recentActivitySummary: Array<{
    id: string;
    type: string;
    createdAt: string;
    titleOrSummary?: string;
    notes?: string;
  }>;
  constraints: {
    groundingRules: string[];
  };
}

export interface DraftModelOutput {
  subject: string;
  body: string;
  bullets?: string[];
  callScript?: string[];
  assumptions: string[];
  questionsToConfirm: string[];
}
