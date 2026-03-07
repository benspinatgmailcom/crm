import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AiAdapter } from './adapter/ai-adapter.interface';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';

export interface DealBriefResponse {
  opportunityId: string;
  briefMarkdown: string;
  activityId: string;
  generatedAt: string;
}

export interface GenerateDealBriefOptions {
  forceRefresh?: boolean;
  lookbackDays?: number;
}

const DEAL_BRIEF_ACTIVITY_TYPE = 'ai_deal_brief';
const CACHE_WINDOW_HOURS = 6;
const MAX_ACTIVITIES = 30;
const MAX_CHARS_PER_ATTACHMENT = 2000;

/** Context bundle built from DB for the LLM */
interface DealBriefContextBundle {
  opportunitySnapshot: string;
  accountSnapshot: string;
  dealTeamList: string;
  contactsList: string;
  recentActivities: string;
  attachmentSummaries: string;
  inputTruncationStats: {
    activitiesIncluded: number;
    activitiesTotalAvailable: number;
    attachmentSnippetsIncluded: number;
    maxCharsPerAttachment: number;
  };
}

@Injectable()
export class AiDealBriefService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly aiAdapter: AiAdapter,
  ) {}

  async generateDealBrief(
    opportunityId: string,
    userId: string,
    tenantId: string,
    options: { forceRefresh?: boolean; lookbackDays?: number },
  ): Promise<DealBriefResponse> {
    const forceRefresh = options?.forceRefresh ?? false;
    const lookbackDays = options?.lookbackDays ?? 30;

    if (!forceRefresh) {
      const cached = await this.findCachedDealBrief(opportunityId, tenantId);
      if (cached) return cached;
    }

    const bundle = await this.buildContextBundle(opportunityId, tenantId, lookbackDays);
    const promptContext = this.formatContextForPrompt(bundle);

    const systemPrompt = this.getDealBriefSystemPrompt();

    let rawMarkdown: string;
    try {
      rawMarkdown = await this.aiAdapter.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptContext },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      throw new ServiceUnavailableException(`Deal brief generation failed: ${msg}`);
    }

    const briefMarkdown = this.normalizeMarkdown(rawMarkdown);
    const confidence = this.parseConfidence(briefMarkdown);

    const generatedAt = new Date().toISOString();
    const activity = await this.activityService.createRaw({
      tenantId,
      entityType: 'opportunity',
      entityId: opportunityId,
      type: DEAL_BRIEF_ACTIVITY_TYPE,
      payload: {
        briefMarkdown,
        generatedAt,
        createdBy: userId,
        lookbackDays,
        model: env.OPENAI_MODEL,
        inputTruncationStats: bundle.inputTruncationStats,
        confidence,
      },
    });

    return {
      opportunityId,
      briefMarkdown,
      activityId: activity.id,
      generatedAt,
    };
  }

  /** Return cached brief only if created within the last 6 hours */
  private async findCachedDealBrief(
    opportunityId: string,
    tenantId: string,
  ): Promise<DealBriefResponse | null> {
    const since = new Date();
    since.setHours(since.getHours() - CACHE_WINDOW_HOURS);

    const activity = await this.prisma.activity.findFirst({
      where: {
        tenantId,
        entityType: 'opportunity',
        entityId: opportunityId,
        type: DEAL_BRIEF_ACTIVITY_TYPE,
        deletedAt: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activity) return null;

    const payload = (activity.payload as Record<string, unknown>) ?? {};
    const briefMarkdown =
      typeof payload.briefMarkdown === 'string' ? payload.briefMarkdown : '';
    const generatedAt =
      typeof payload.generatedAt === 'string'
        ? payload.generatedAt
        : activity.createdAt.toISOString();

    if (!briefMarkdown) return null;

    return {
      opportunityId,
      briefMarkdown,
      activityId: activity.id,
      generatedAt,
    };
  }

  private async buildContextBundle(
    opportunityId: string,
    tenantId: string,
    lookbackDays: number,
  ): Promise<DealBriefContextBundle> {
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    const sinceDate = since;
    const [opportunity, activities, activitiesTotal, attachments] = await Promise.all([
      this.prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        include: {
          account: { include: { contacts: true } },
          opportunityContacts: {
            include: {
              contact: {
                select: { id: true, firstName: true, lastName: true, email: true, phone: true },
              },
            },
          },
        },
      }),
      this.prisma.activity.findMany({
        where: {
          tenantId,
          entityType: 'opportunity',
          entityId: opportunityId,
          createdAt: { gte: sinceDate },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_ACTIVITIES,
      }),
      this.prisma.activity.count({
        where: {
          tenantId,
          entityType: 'opportunity',
          entityId: opportunityId,
          createdAt: { gte: sinceDate },
          deletedAt: null,
        },
      }),
      this.prisma.attachment.findMany({
        where: { tenantId, entityType: 'opportunity', entityId: opportunityId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!opportunity) {
      throw new NotFoundException(`Opportunity ${opportunityId} not found`);
    }

    const account = opportunity.account;
    const contacts = account?.contacts ?? [];
    const dealTeam = (opportunity as { opportunityContacts?: Array<{ role: string; contact: { firstName: string; lastName: string; email: string; phone?: string | null } }> }).opportunityContacts ?? [];

    const opportunitySnapshot = this.formatOpportunitySnapshot(opportunity, account);
    const accountSnapshot = this.formatAccountSnapshot(account);
    const dealTeamList = this.formatDealTeamList(dealTeam);
    const contactsList = this.formatContactsList(contacts);
    const recentActivities = this.formatActivities(activities);
    const { summaries: attachmentSummaries, included } = this.formatAttachmentSummaries(attachments);

    return {
      opportunitySnapshot,
      accountSnapshot,
      dealTeamList,
      contactsList,
      recentActivities,
      attachmentSummaries,
      inputTruncationStats: {
        activitiesIncluded: activities.length,
        activitiesTotalAvailable: activitiesTotal,
        attachmentSnippetsIncluded: included,
        maxCharsPerAttachment: MAX_CHARS_PER_ATTACHMENT,
      },
    };
  }

  private formatOpportunitySnapshot(
    o: { name: string; stage?: string | null; amount?: unknown; closeDate?: Date | null; updatedAt: Date; lastActivityAt?: Date | null; winProbability?: number | null; forecastCategory?: string | null },
    account: { name: string },
  ): string {
    const amount = o.amount != null ? Number(o.amount) : null;
    const lines = [
      `Name: ${o.name}`,
      `Account: ${account.name}`,
      `Stage: ${o.stage ?? 'Unknown'}`,
      `Amount: ${amount != null ? '$' + amount.toLocaleString() : 'Unknown'}`,
      `Close date: ${o.closeDate ? o.closeDate.toISOString().slice(0, 10) : 'Unknown'}`,
      `Updated at: ${o.updatedAt.toISOString()}`,
      `Last activity at: ${o.lastActivityAt ? o.lastActivityAt.toISOString() : 'Unknown'}`,
      `Win probability: ${o.winProbability != null ? o.winProbability + '%' : 'Unknown'}`,
      `Forecast category: ${o.forecastCategory ?? 'Unknown'}`,
    ];
    return lines.join('\n');
  }

  private formatAccountSnapshot(a: { name: string; industry?: string | null; website?: string | null }): string {
    return [
      `Name: ${a.name}`,
      `Industry: ${a.industry ?? 'Unknown'}`,
      `Website: ${a.website ?? 'Unknown'}`,
    ].join('\n');
  }

  private formatDealTeamList(
    dealTeam: Array<{ role: string; contact: { firstName: string; lastName: string; email: string; phone?: string | null } }>,
  ): string {
    if (dealTeam.length === 0) return 'No deal team assigned (buying team not yet defined).';
    return dealTeam
      .map(
        (dt) =>
          `- ${dt.role}: ${dt.contact.firstName} ${dt.contact.lastName} | ${dt.contact.email}${dt.contact.phone ? ` | ${dt.contact.phone}` : ''}`,
      )
      .join('\n');
  }

  private formatContactsList(
    contacts: { firstName: string; lastName: string; email: string; phone?: string | null }[],
  ): string {
    if (contacts.length === 0) return 'No contacts on file.';
    return contacts
      .map(
        (c) =>
          `- ${c.firstName} ${c.lastName} | ${c.email}${c.phone ? ` | ${c.phone}` : ''}`,
      )
      .join('\n');
  }

  private formatActivities(
    activities: { type: string; createdAt: Date; payload: unknown }[],
  ): string {
    if (activities.length === 0) return 'No activities in this period.';
    return activities
      .map((a) => {
        const p = (a.payload as Record<string, unknown>) ?? {};
        const author =
          typeof p.createdBy === 'string' || typeof p.userId === 'string' || typeof p.author === 'string'
            ? String(p.createdBy ?? p.userId ?? p.author)
            : 'Unknown';
        const body = this.getActivityBody(a.type, p);
        return `- [${a.createdAt.toISOString()}] type=${a.type} author=${author}\n  ${body}`;
      })
      .join('\n\n');
  }

  private getActivityBody(type: string, p: Record<string, unknown>): string {
    if (type === 'note' && p.text) return String(p.text).slice(0, 500);
    if ((type === 'call' || type === 'meeting') && p.summary) return String(p.summary).slice(0, 500);
    if (type === 'email') return `Subject: ${p.subject ?? '—'}`;
    if (type === 'task') return `Task: ${p.title ?? '—'} ${p.details ?? ''}`.trim().slice(0, 300);
    if (type === 'stage_change') return `From ${p.fromStage ?? '—'} to ${p.toStage ?? '—'}`;
    return Object.keys(p).length ? JSON.stringify(p).slice(0, 300) : '—';
  }

  private formatAttachmentSummaries(
    attachments: { fileName: string; createdAt: Date; extractedText?: string | null }[],
  ): { summaries: string; included: number } {
    const lines: string[] = [];
    let included = 0;
    for (const a of attachments) {
      const snippet = a.extractedText
        ? a.extractedText.slice(0, MAX_CHARS_PER_ATTACHMENT)
        : '(no extracted text)';
      if (a.extractedText) included++;
      lines.push(`- ${a.fileName} (${a.createdAt.toISOString().slice(0, 10)})\n  ${snippet}`);
    }
    const summaries = lines.length === 0 ? 'No attachments.' : lines.join('\n\n');
    return { summaries, included };
  }

  private formatContextForPrompt(bundle: DealBriefContextBundle): string {
    return [
      '## Opportunity snapshot',
      bundle.opportunitySnapshot,
      '',
      '## Account snapshot',
      bundle.accountSnapshot,
      '',
      '## Deal team (buying team with roles)',
      bundle.dealTeamList,
      '',
      '## Account contacts (if deal team not fully assigned)',
      bundle.contactsList,
      '',
      '## Recent activities (type, createdAt, author, body/metadata)',
      bundle.recentActivities,
      '',
      '## Attachment summaries (name, createdAt, extractedTextSnippet)',
      bundle.attachmentSummaries,
      '',
      `(Input limits: up to ${MAX_ACTIVITIES} activities; up to ${MAX_CHARS_PER_ATTACHMENT} chars per attachment excerpt.)`,
    ].join('\n');
  }

  private getDealBriefSystemPrompt(): string {
    return `You are a CRM assistant writing a structured Deal Brief in Markdown for a sales team.

Output rules:
- Respond with ONLY the markdown content. No JSON wrapper, no code fences.
- Keep it concise: ideally 300–800 words. Use bullets heavily.
- If something is unknown, explicitly write "Unknown" rather than guessing.
- Include a final line on its own: "AI Confidence: Low" or "AI Confidence: Medium" or "AI Confidence: High", based on completeness of buying team info, recent activity, and evidence for next steps.

Required sections (use these exact headings):

## Deal Summary
2–3 sentence executive summary of the deal.

## Buying Team
Subsections: Champion, Economic Buyer, Technical Stakeholders, Other. List names/roles where known; use "Unknown" when not evident from context.

## Deal Stage Insight
What the current stage means and what is missing to progress to the next stage.

## Momentum Signals
Positive signals and recent events that indicate forward progress.

## Risk Factors
Clear bullet list of risks or blockers (or "None identified" if appropriate).

## Recommended Next Steps
Ranked 1–5 with specific, actionable steps.

End with exactly one line: AI Confidence: Low | Medium | High`;
  }

  private normalizeMarkdown(raw: string): string {
    let s = raw.trim();
    const fenceMatch = s.match(/^```(?:markdown|md)?\s*\n?([\s\S]*?)```$/m);
    if (fenceMatch) s = fenceMatch[1].trim();
    return s || 'Deal brief generated.';
  }

  private parseConfidence(briefMarkdown: string): 'Low' | 'Medium' | 'High' {
    const match = briefMarkdown.match(/AI Confidence:\s*(Low|Medium|High)/i);
    if (match) {
      const v = match[1].toLowerCase();
      if (v === 'low') return 'Low';
      if (v === 'medium') return 'Medium';
      if (v === 'high') return 'High';
    }
    return 'Medium';
  }
}
