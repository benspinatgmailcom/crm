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
import type { NextActionsDto } from './dto/next-actions.dto';

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
}
