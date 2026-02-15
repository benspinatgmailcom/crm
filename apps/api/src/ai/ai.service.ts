import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Activity } from '@crm/db';
import { ActivityService } from '../activity/activity.service';
import { AiAdapter } from './adapter/ai-adapter.interface';
import { AiContextService } from './ai-context.service';
import type { DraftEmailDto } from './dto/draft-email.dto';
import type { GenerateSummaryDto } from './dto/summary.dto';
import type { NextActionsDto } from './dto/next-actions.dto';

export interface DraftEmailResult {
  activityId: string;
  subject: string;
  body: string;
  suggestedRecipients?: { name?: string; email: string }[];
}

export interface AiSummaryPayload {
  text: string;
  scope?: string;
  summaryBullets?: string[];
  risks?: string[];
  nextActions?: string[];
  emailDraft?: { subject?: string; body?: string };
}

export interface NextAction {
  priority: number;
  title: string;
  why: string;
  suggestedDueAt?: string;
  type: 'call' | 'email' | 'task' | 'meeting' | 'research';
  details?: string;
}

export interface NextActionsResponse {
  activityId: string;
  actions: NextAction[];
}

const VALID_ACTION_TYPES = ['call', 'email', 'task', 'meeting', 'research'];

@Injectable()
export class AiService {
  constructor(
    private readonly contextService: AiContextService,
    private readonly activityService: ActivityService,
    private readonly aiAdapter: AiAdapter,
  ) {}

  async generateSummary(dto: GenerateSummaryDto): Promise<Activity> {
    const { entityType, entityId, days = 30 } = dto;
    const context = await this.contextService.buildContextPack(
      entityType,
      entityId,
      days,
      50,
    );

    const systemPrompt = `You are a CRM assistant. Given entity data and recent activities, generate a concise AI summary.

Respond with STRICT JSON only. Schema:
{
  "text": "2-3 sentence executive summary",
  "scope": "e.g. Last 30 days",
  "summaryBullets": ["key point 1", "key point 2", "key point 3"],
  "risks": ["any risks or concerns"],
  "nextActions": ["recommended next action 1", "recommended next action 2"],
  "emailDraft": { "subject": "optional suggested email subject", "body": "optional brief body" }
}

All fields except "text" are optional. Keep it concise and actionable.`;

    let raw: string;
    try {
      raw = await this.aiAdapter.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      throw new ServiceUnavailableException(`AI summary failed: ${msg}`);
    }

    const payload = this.parseSummaryResponse(raw, days);
    return this.activityService.createRaw({
      entityType,
      entityId,
      type: 'ai_summary',
      payload: {
        ...payload,
        scope: payload.scope ?? `Last ${days} days`,
        generatedAt: new Date().toISOString(),
      },
    });
  }

  async generateNextActions(dto: NextActionsDto): Promise<NextActionsResponse> {
    const { entityType, entityId, count = 5 } = dto;
    const context = await this.contextService.buildContextPack(
      entityType,
      entityId,
      30,
      50,
    );

    const systemPrompt = `You are a CRM assistant. Given entity data and recent activities, suggest the next best actions.

Respond with STRICT JSON only. Schema:
{
  "actions": [
    {
      "priority": 1-5 (1 = highest),
      "title": "short action title",
      "why": "brief rationale",
      "suggestedDueAt": "ISO date string (optional)",
      "type": "call"|"email"|"task"|"meeting"|"research",
      "details": "optional extra context"
    }
  ]
}

Return up to ${count} actions, ordered by priority (1 first).`;

    let raw: string;
    try {
      raw = await this.aiAdapter.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      throw new ServiceUnavailableException(`Next actions failed: ${msg}`);
    }

    const parsed = this.parseNextActionsResponse(raw);
    const activity = await this.activityService.createRaw({
      entityType,
      entityId,
      type: 'ai_recommendation',
      payload: {
        actions: parsed.actions,
        generatedAt: new Date().toISOString(),
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        inputs: { activityCount: 50, attachmentCount: 0 },
      },
    });

    return { activityId: activity.id, actions: parsed.actions };
  }

  async generateDraftEmail(dto: DraftEmailDto): Promise<DraftEmailResult> {
    const {
      entityType,
      entityId,
      recipientEmail,
      intent = 'follow_up',
      tone = 'professional',
      length = 'medium',
      additionalContext,
    } = dto;

    const context = await this.contextService.buildEmailContextPack(
      entityType,
      entityId,
      recipientEmail,
      additionalContext,
    );

    const systemPrompt = `You are a CRM assistant. Draft an email based on the entity data, recent activities, and context below.

Respond with STRICT JSON only. Schema:
{
  "subject": "email subject line",
  "body": "email body (plain text, use \\n for line breaks)",
  "suggestedRecipients": [{"name": "optional", "email": "required"}],
  "followUpTasks": [{"title": "string", "dueAt": "ISO date optional"}]
}

Intent: ${intent}. Tone: ${tone}. Length: ${length}.
All fields except subject and body are optional. Keep the email concise and professional.`;

    let raw: string;
    try {
      raw = await this.aiAdapter.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      throw new ServiceUnavailableException(`Draft email failed: ${msg}`);
    }

    let parsed = this.parseDraftEmailResponse(raw);
    if (!parsed) {
      try {
        raw = await this.aiAdapter.chat([
          { role: 'system', content: 'Respond with valid JSON only.' },
          { role: 'user', content: `Fix this to valid JSON: ${raw}` },
        ]);
        parsed = this.parseDraftEmailResponse(raw);
      } catch {
        throw new BadRequestException('AI returned invalid JSON for draft email');
      }
    }
    if (!parsed) throw new BadRequestException('AI returned invalid JSON for draft email');

    const activity = await this.activityService.createRaw({
      entityType,
      entityId,
      type: 'ai_email_draft',
      payload: {
        subject: parsed.subject,
        body: parsed.body,
        intent,
        tone,
        length,
        recipientEmail: recipientEmail ?? undefined,
        suggestedRecipients: parsed.suggestedRecipients,
        generatedAt: new Date().toISOString(),
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      },
    });

    return {
      activityId: activity.id,
      subject: parsed.subject,
      body: parsed.body,
      suggestedRecipients: parsed.suggestedRecipients,
    };
  }

  async logDraftEmailAsOutbound(
    activityId: string,
    toEmail?: string,
  ): Promise<Activity> {
    const draft = await this.activityService.findOne(activityId);
    if (draft.type !== 'ai_email_draft') {
      throw new BadRequestException('Activity is not an AI email draft');
    }
    const p = (draft.payload as Record<string, unknown>) ?? {};
    const subject = typeof p.subject === 'string' ? p.subject : '(No subject)';
    const body = typeof p.body === 'string' ? p.body : '';
    let recipient = toEmail ?? (typeof p.recipientEmail === 'string' ? p.recipientEmail : null);
    if (!recipient && Array.isArray(p.suggestedRecipients) && p.suggestedRecipients.length > 0) {
      const first = p.suggestedRecipients[0] as Record<string, unknown>;
      recipient = typeof first.email === 'string' ? first.email : null;
    }
    if (!recipient) recipient = '(recipient not specified)';

    return this.activityService.createRaw({
      entityType: draft.entityType,
      entityId: draft.entityId,
      type: 'email',
      payload: {
        direction: 'outbound',
        subject,
        body,
        to: recipient,
        source: { aiDraftActivityId: activityId },
      },
    });
  }

  private parseDraftEmailResponse(
    raw: string,
  ): {
    subject: string;
    body: string;
    suggestedRecipients?: { name?: string; email: string }[];
  } | null {
    const jsonStr = this.extractJson(raw);
    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      const subject = typeof parsed.subject === 'string' ? parsed.subject : '';
      const body = typeof parsed.body === 'string' ? parsed.body : '';
      if (!subject && !body) return null;
      let suggestedRecipients: { name?: string; email: string }[] | undefined;
      if (Array.isArray(parsed.suggestedRecipients)) {
        suggestedRecipients = parsed.suggestedRecipients
          .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
          .map((r) => ({
            name: typeof r.name === 'string' ? r.name : undefined,
            email: typeof r.email === 'string' ? r.email : '',
          }))
          .filter((r) => r.email);
      }
      return { subject, body, suggestedRecipients };
    } catch {
      return null;
    }
  }

  async convertToTask(activityId: string, actionIndex: number): Promise<Activity> {
    const activity = await this.activityService.findOne(activityId);
    if (activity.type !== 'ai_recommendation') {
      throw new BadRequestException('Activity is not an AI recommendation');
    }
    const p = (activity.payload as Record<string, unknown>) ?? {};
    const actions = p.actions as NextAction[] | undefined;
    if (!Array.isArray(actions) || actionIndex >= actions.length) {
      throw new BadRequestException('Invalid action index');
    }
    const action = actions[actionIndex] as NextAction;

    return this.activityService.createRaw({
      entityType: activity.entityType,
      entityId: activity.entityId,
      type: 'task',
      payload: {
        title: action.title,
        status: 'open',
        dueAt: action.suggestedDueAt ?? undefined,
        source: { aiRecommendationActivityId: activityId, actionIndex },
        details: action.details,
      },
    });
  }

  private extractJson(raw: string): string {
    let s = raw.trim();
    const codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) s = codeBlockMatch[1].trim();
    const objMatch = s.match(/\{[\s\S]*\}/);
    if (objMatch) s = objMatch[0];
    return s;
  }

  private parseNextActionsResponse(raw: string): { actions: NextAction[] } {
    const jsonStr = this.extractJson(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new BadRequestException('AI returned invalid JSON');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('AI response must be an object');
    }
    const o = parsed as Record<string, unknown>;
    const actionsRaw = o.actions;
    if (!Array.isArray(actionsRaw)) {
      throw new BadRequestException('actions must be an array');
    }
    const actions: NextAction[] = [];
    for (const a of actionsRaw) {
      if (!a || typeof a !== 'object') continue;
      const x = a as Record<string, unknown>;
      const priority = typeof x.priority === 'number' ? Math.max(1, Math.min(5, x.priority)) : 1;
      const title = typeof x.title === 'string' ? x.title : String(x.title ?? '');
      const why = typeof x.why === 'string' ? x.why : '';
      const type = typeof x.type === 'string' && VALID_ACTION_TYPES.includes(x.type)
        ? x.type
        : 'task';
      actions.push({
        priority,
        title,
        why,
        suggestedDueAt: typeof x.suggestedDueAt === 'string' ? x.suggestedDueAt : undefined,
        type: type as NextAction['type'],
        details: typeof x.details === 'string' ? x.details : undefined,
      });
    }
    return { actions };
  }

  private parseSummaryResponse(raw: string, days: number): AiSummaryPayload {
    const jsonStr = this.extractJson(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new BadRequestException('AI returned invalid JSON for summary');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('AI summary response must be an object');
    }
    const o = parsed as Record<string, unknown>;
    return {
      text: typeof o.text === 'string' ? o.text : 'Summary generated.',
      scope: typeof o.scope === 'string' ? o.scope : `Last ${days} days`,
      summaryBullets: Array.isArray(o.summaryBullets)
        ? o.summaryBullets.filter((b): b is string => typeof b === 'string')
        : undefined,
      risks: Array.isArray(o.risks) ? o.risks.filter((r): r is string => typeof r === 'string') : undefined,
      nextActions: Array.isArray(o.nextActions)
        ? o.nextActions.filter((a): a is string => typeof a === 'string')
        : undefined,
      emailDraft:
        o.emailDraft && typeof o.emailDraft === 'object'
          ? {
              subject: typeof (o.emailDraft as Record<string, unknown>).subject === 'string'
                ? (o.emailDraft as Record<string, unknown>).subject as string
                : undefined,
              body: typeof (o.emailDraft as Record<string, unknown>).body === 'string'
                ? (o.emailDraft as Record<string, unknown>).body as string
                : undefined,
            }
          : undefined,
    };
  }
}
