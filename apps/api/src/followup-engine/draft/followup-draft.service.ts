import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@crm/db';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { AiAdapter } from '../../ai/adapter/ai-adapter.interface';
import { DraftContextBuilder } from './draft-context.builder';
import type { CreateDraftOptions, DraftChannel, DraftContextBrief, DraftModelOutput } from './draft-dto';

const ENTITY_OPPORTUNITY = 'opportunity';
const TYPE_DRAFT = 'followup_draft_created';
const TYPE_SENT = 'followup_sent';

function defaultCtaFromRuleCode(ruleCode: string): 'schedule' | 'confirm_next_steps' | 'get_update' | 'share_feedback' {
  if (ruleCode === 'OVERDUE_NEXT_STEP') return 'confirm_next_steps';
  if (ruleCode === 'STAGE_STUCK_CHECKPOINT') return 'get_update';
  if (ruleCode === 'CRITICAL_HEALTH_RECOVERY') return 'share_feedback';
  return 'schedule';
}

function extractJson(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}') + 1;
  if (start === -1 || end <= start) return raw;
  return raw.slice(start, end);
}

function parseDraftOutput(raw: string): DraftModelOutput | null {
  const jsonStr = extractJson(raw);
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const subject = typeof parsed.subject === 'string' ? parsed.subject : '';
    const body = typeof parsed.body === 'string' ? parsed.body : '';
    const assumptions = Array.isArray(parsed.assumptions) ? (parsed.assumptions as string[]) : [];
    const questionsToConfirm = Array.isArray(parsed.questionsToConfirm) ? (parsed.questionsToConfirm as string[]) : [];
    const bullets = Array.isArray(parsed.bullets) ? (parsed.bullets as string[]) : undefined;
    const callScript = Array.isArray(parsed.callScript) ? (parsed.callScript as string[]) : undefined;
    return { subject, body, assumptions, questionsToConfirm, bullets, callScript };
  } catch {
    return null;
  }
}

@Injectable()
export class FollowUpDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly contextBuilder: DraftContextBuilder,
    private readonly aiAdapter: AiAdapter,
  ) {}

  async generateDraftFromSuggestion(
    suggestionId: string,
    options: CreateDraftOptions = {},
    tenantId: string,
  ): Promise<{ id: string; subject: string; body: string; metadata: Record<string, unknown> }> {
    const brief = await this.contextBuilder.buildFromSuggestion(suggestionId, tenantId);
    const suggestion = await this.prisma.activity.findFirst({
      where: { id: suggestionId, tenantId, type: 'followup_suggested', deletedAt: null },
      select: { entityId: true },
    });
    if (!suggestion) throw new NotFoundException(`Suggestion ${suggestionId} not found`);
    return this.generateAndPersist(brief, suggestion.entityId, {
      suggestionActivityId: suggestionId,
      ...options,
    }, tenantId);
  }

  async generateDraftFromTask(
    taskId: string,
    options: CreateDraftOptions = {},
    tenantId: string,
  ): Promise<{ id: string; subject: string; body: string; metadata: Record<string, unknown> }> {
    const brief = await this.contextBuilder.buildFromTask(taskId, tenantId);
    const task = await this.prisma.activity.findFirst({
      where: { id: taskId, tenantId, type: 'task_created', deletedAt: null },
      select: { entityId: true },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return this.generateAndPersist(brief, task.entityId, {
      taskActivityId: taskId,
      ...options,
    }, tenantId);
  }

  private async generateAndPersist(
    brief: DraftContextBrief,
    opportunityId: string,
    source: CreateDraftOptions & { suggestionActivityId?: string; taskActivityId?: string },
    tenantId: string,
  ): Promise<{ id: string; subject: string; body: string; metadata: Record<string, unknown> }> {
    const channel = source.channel ?? 'email';
    const tone = source.tone ?? 'friendly';
    const length = source.length ?? 'short';
    const cta = source.cta ?? defaultCtaFromRuleCode(brief.trigger.ruleCode);

    const systemPrompt = `You are a CRM assistant that drafts follow-up messages. You must ONLY use information provided in the context. Do NOT invent specific meetings, dates, promises, or attachments unless they appear in the recent activities. If something is unknown, use neutral language or a placeholder and add a short question to questionsToConfirm.

Respond with STRICT JSON only. No markdown. Schema:
{
  "subject": "string (email subject; for call/linkedin use a one-line summary)",
  "body": "string (main message text)",
  "bullets": ["optional", "bullet points"],
  "callScript": ["optional for channel=call", "numbered or bullet lines"],
  "assumptions": ["list of assumptions you made from the data"],
  "questionsToConfirm": ["things to verify with the customer if unclear"]
}
Always include "assumptions" and "questionsToConfirm" arrays (empty array if none).`;

    const userContent = [
      '## Opportunity',
      JSON.stringify(brief.opportunity, null, 0),
      '## Trigger (why we are following up)',
      JSON.stringify(brief.trigger, null, 0),
      '## Recent activity summary',
      JSON.stringify(brief.recentActivitySummary, null, 0),
      '## Constraints',
      brief.constraints.groundingRules.join('. '),
      '',
      `Generate a ${channel} follow-up. Tone: ${tone}. Length: ${length}. CTA: ${cta}.`,
    ].join('\n');

    let raw: string;
    try {
      raw = await this.aiAdapter.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      throw new ServiceUnavailableException(`Draft generation failed: ${msg}`);
    }

    let output = parseDraftOutput(raw);
    if (!output) {
      try {
        raw = await this.aiAdapter.chat([
          { role: 'system', content: 'Fix the previous response: output valid JSON only, no markdown.' },
          { role: 'user', content: raw },
        ]);
        output = parseDraftOutput(raw);
      } catch {
        // ignore retry
      }
    }
    if (!output || !output.subject?.trim() || !output.body?.trim()) {
      throw new ServiceUnavailableException('Draft generation did not return valid subject and body.');
    }
    if (!Array.isArray(output.assumptions)) output.assumptions = [];
    if (!Array.isArray(output.questionsToConfirm)) output.questionsToConfirm = [];

    const activityIds = brief.recentActivitySummary.map((a) => a.id);
    const metadata = {
      suggestionActivityId: source.suggestionActivityId ?? null,
      taskActivityId: source.taskActivityId ?? null,
      channel,
      tone,
      length,
      cta,
      subject: output.subject,
      body: output.body,
      bullets: output.bullets ?? null,
      callScript: output.callScript ?? null,
      questionsToConfirm: output.questionsToConfirm,
      assumptions: output.assumptions,
      inputsUsed: {
        opportunityId,
        activityIds,
        stage: brief.opportunity.stage,
        lastActivityAt: brief.opportunity.lastActivityAt ?? undefined,
        lastStageChangedAt: brief.opportunity.lastStageChangedAt ?? undefined,
        nextFollowUpAt: brief.opportunity.nextFollowUpAt ?? undefined,
      },
      status: 'DRAFT',
    };

    const activity = await this.prisma.activity.create({
      data: {
        tenantId,
        entityType: ENTITY_OPPORTUNITY,
        entityId: opportunityId,
        type: TYPE_DRAFT,
        payload: {},
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return {
      id: activity.id,
      subject: output.subject,
      body: output.body,
      metadata: activity.metadata as Record<string, unknown>,
    };
  }

  async markDraftSent(
    draftActivityId: string,
    body: { channel: DraftChannel; notes?: string },
    tenantId: string,
  ): Promise<void> {
    const draft = await this.prisma.activity.findFirst({
      where: { id: draftActivityId, tenantId, type: TYPE_DRAFT, deletedAt: null },
      select: { id: true, entityId: true, metadata: true },
    });
    if (!draft) throw new NotFoundException(`Draft ${draftActivityId} not found`);
    const meta = (draft.metadata ?? {}) as Record<string, unknown>;
    if ((meta.status as string) !== 'DRAFT') {
      throw new BadRequestException('Draft is not in DRAFT status');
    }

    await this.prisma.activity.create({
      data: {
        tenantId,
        entityType: ENTITY_OPPORTUNITY,
        entityId: draft.entityId,
        type: TYPE_SENT,
        payload: {},
        metadata: {
          draftActivityId,
          channel: body.channel,
          status: 'SENT',
          notes: body.notes ?? undefined,
        } as Prisma.InputJsonValue,
      },
    });

    await this.workflow.updateLastActivityAt(draft.entityId, new Date(), tenantId);
  }
}
