import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { AiAdapter } from './adapter/ai-adapter.interface';
import type { GenerateSummaryDto } from './dto/generate-summary.dto';

const ENTITY_TYPES = ['account', 'contact', 'lead', 'opportunity'] as const;

interface SummaryResult {
  summaryBullets: string[];
  risks: string[];
  nextActions: string[];
  emailDraft?: { subject: string; body: string };
}

export interface AiSummaryResponse {
  activityId: string;
  summaryBullets: string[];
  risks: string[];
  nextActions: string[];
  emailDraft?: { subject: string; body: string };
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly attachmentsService: AttachmentsService,
    private readonly aiAdapter: AiAdapter,
  ) {}

  async generateSummary(dto: GenerateSummaryDto): Promise<AiSummaryResponse> {
    const { entityType, entityId, days = 30, limit = 50 } = dto;

    const [entityText, activitiesText, attachmentText] = await Promise.all([
      this.loadEntitySnapshot(entityType, entityId),
      this.loadActivitiesText(entityType, entityId, days, limit),
      this.attachmentsService.getExtractedTextForEntity(
        entityType,
        entityId,
        2,
        8000,
      ),
    ]);

    const context = `## Entity snapshot\n${entityText}\n\n## Recent activities\n${activitiesText}${attachmentText}`;

    const systemPrompt = `You are a CRM assistant. Given a CRM entity and its recent activities, produce a concise summary.

Respond with STRICT JSON only, no markdown or extra text. Schema:
{
  "summaryBullets": ["bullet 1", "bullet 2", ...],
  "risks": ["risk 1", "risk 2", ...],
  "nextActions": ["action 1", "action 2", ...],
  "emailDraft": { "subject": "...", "body": "..." }  // optional, suggested follow-up email
}

Keep bullets, risks, and nextActions short and actionable. Include emailDraft only if it makes sense.`;

    let rawResponse: string;
    try {
      rawResponse = await this.aiAdapter.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      throw new ServiceUnavailableException(`AI summary failed: ${msg}`);
    }

    const parsed = this.parseSummaryResponse(rawResponse);
    const scope = `Last ${days} days, up to ${limit} activities`;
    const generatedAt = new Date().toISOString();

    const activity = await this.activityService.createRaw({
      entityType,
      entityId,
      type: 'ai_summary',
      payload: {
        summaryBullets: parsed.summaryBullets,
        risks: parsed.risks,
        nextActions: parsed.nextActions,
        emailDraft: parsed.emailDraft,
        scope,
        generatedAt,
        text: parsed.summaryBullets.join(' • ') || 'AI summary',
      },
    });

    return {
      activityId: activity.id,
      summaryBullets: parsed.summaryBullets,
      risks: parsed.risks,
      nextActions: parsed.nextActions,
      emailDraft: parsed.emailDraft,
    };
  }

  private async loadEntitySnapshot(
    entityType: (typeof ENTITY_TYPES)[number],
    entityId: string,
  ): Promise<string> {
    switch (entityType) {
      case 'account': {
        const a = await this.prisma.account.findUnique({
          where: { id: entityId },
        });
        if (!a) throw new NotFoundException(`Account ${entityId} not found`);
        return `Account: ${a.name}\nIndustry: ${a.industry ?? '—'}\nWebsite: ${a.website ?? '—'}\nCreated: ${a.createdAt.toISOString()}`;
      }
      case 'contact': {
        const c = await this.prisma.contact.findUnique({
          where: { id: entityId },
          include: { account: true },
        });
        if (!c) throw new NotFoundException(`Contact ${entityId} not found`);
        return `Contact: ${c.firstName} ${c.lastName}\nEmail: ${c.email}\nPhone: ${c.phone ?? '—'}\nAccount: ${c.account.name}\nCreated: ${c.createdAt.toISOString()}`;
      }
      case 'lead': {
        const l = await this.prisma.lead.findUnique({
          where: { id: entityId },
        });
        if (!l) throw new NotFoundException(`Lead ${entityId} not found`);
        return `Lead: ${l.name}\nEmail: ${l.email}\nCompany: ${l.company ?? '—'}\nStatus: ${l.status ?? '—'}\nSource: ${l.source ?? '—'}\nCreated: ${l.createdAt.toISOString()}`;
      }
      case 'opportunity': {
        const o = await this.prisma.opportunity.findUnique({
          where: { id: entityId },
          include: { account: true },
        });
        if (!o) throw new NotFoundException(`Opportunity ${entityId} not found`);
        const amount = o.amount != null ? Number(o.amount) : null;
        return `Opportunity: ${o.name}\nAccount: ${o.account.name}\nAmount: ${amount != null ? '$' + amount.toLocaleString() : '—'}\nStage: ${o.stage ?? '—'}\nProbability: ${o.probability ?? '—'}%\nClose: ${o.closeDate?.toISOString() ?? '—'}\nCreated: ${o.createdAt.toISOString()}`;
      }
      default:
        throw new BadRequestException(`Unknown entityType: ${entityType}`);
    }
  }

  private async loadActivitiesText(
    entityType: string,
    entityId: string,
    days: number,
    limit: number,
  ): Promise<string> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const activities = await this.prisma.activity.findMany({
      where: {
        entityType,
        entityId,
        deletedAt: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (activities.length === 0) {
      return '(No activities in this period)';
    }

    return activities
      .map((a) => {
        const p = (a.payload as Record<string, unknown>) ?? {};
        const date = a.createdAt.toISOString();
        const type = a.type;
        const parts: string[] = [];
        if (type === 'note' && p.text) parts.push(String(p.text));
        if ((type === 'call' || type === 'meeting') && p.summary) parts.push(String(p.summary));
        if (type === 'email') parts.push(`Subject: ${p.subject ?? '—'}`);
        if (type === 'task') parts.push(`Task: ${p.title ?? '—'} (${p.status ?? '—'})`);
        if (type === 'ai_summary') {
          const bullets = p.summaryBullets as string[] | undefined;
          parts.push(bullets?.length ? bullets.join('; ') : String(p.text ?? ''));
        }
        if (type === 'file_uploaded') parts.push(`File: ${p.fileName ?? '—'}`);
        if (type === 'file_deleted') parts.push(`Deleted: ${p.fileName ?? '—'}`);
        return `[${date}] ${type}: ${parts.join(' ').trim() || JSON.stringify(p)}`;
      })
      .join('\n');
  }

  private parseSummaryResponse(raw: string): SummaryResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('AI returned invalid JSON');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('AI response must be an object');
    }

    const o = parsed as Record<string, unknown>;
    const summaryBullets = Array.isArray(o.summaryBullets)
      ? o.summaryBullets.filter((x) => typeof x === 'string').map(String)
      : [];
    const risks = Array.isArray(o.risks)
      ? o.risks.filter((x) => typeof x === 'string').map(String)
      : [];
    const nextActions = Array.isArray(o.nextActions)
      ? o.nextActions.filter((x) => typeof x === 'string').map(String)
      : [];

    let emailDraft: { subject: string; body: string } | undefined;
    if (o.emailDraft && typeof o.emailDraft === 'object') {
      const ed = o.emailDraft as Record<string, unknown>;
      if (typeof ed.subject === 'string' && typeof ed.body === 'string') {
        emailDraft = { subject: ed.subject, body: ed.body };
      }
    }

    return { summaryBullets, risks, nextActions, emailDraft };
  }
}
