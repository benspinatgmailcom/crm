import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ENTITY_TYPES = ['account', 'contact', 'lead', 'opportunity'] as const;

@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildContextPack(
    entityType: (typeof ENTITY_TYPES)[number],
    entityId: string,
    days: number = 30,
    activityLimit: number = 50,
  ): Promise<string> {
    const [entityText, activitiesText, attachmentText] = await Promise.all([
      this.loadEntitySnapshot(entityType, entityId),
      this.loadActivitiesText(entityType, entityId, days, activityLimit),
      this.loadAttachmentText(entityType, entityId),
    ]);
    return `## Entity snapshot\n${entityText}\n\n## Recent activities\n${activitiesText}${attachmentText}`;
  }

  private async loadEntitySnapshot(
    entityType: (typeof ENTITY_TYPES)[number],
    entityId: string,
  ): Promise<string> {
    switch (entityType) {
      case 'account': {
        const a = await this.prisma.account.findUnique({ where: { id: entityId } });
        if (!a) throw new NotFoundException(`Account ${entityId} not found`);
        return `Account: ${a.name}\nIndustry: ${a.industry ?? '—'}\nWebsite: ${a.website ?? '—'}`;
      }
      case 'contact': {
        const c = await this.prisma.contact.findUnique({
          where: { id: entityId },
          include: { account: true },
        });
        if (!c) throw new NotFoundException(`Contact ${entityId} not found`);
        return `Contact: ${c.firstName} ${c.lastName}\nEmail: ${c.email}\nAccount: ${c.account.name}`;
      }
      case 'lead': {
        const l = await this.prisma.lead.findUnique({ where: { id: entityId } });
        if (!l) throw new NotFoundException(`Lead ${entityId} not found`);
        return `Lead: ${l.name}\nEmail: ${l.email}\nCompany: ${l.company ?? '—'}\nStatus: ${l.status ?? '—'}`;
      }
      case 'opportunity': {
        const o = await this.prisma.opportunity.findUnique({
          where: { id: entityId },
          include: { account: true },
        });
        if (!o) throw new NotFoundException(`Opportunity ${entityId} not found`);
        const amount = o.amount != null ? Number(o.amount) : null;
        return `Opportunity: ${o.name}\nAccount: ${o.account.name}\nAmount: ${amount != null ? '$' + amount.toLocaleString() : '—'}\nStage: ${o.stage ?? '—'}`;
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
      where: { entityType, entityId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    if (activities.length === 0) return '(No activities in this period)';
    return activities
      .map((a) => {
        const p = (a.payload as Record<string, unknown>) ?? {};
        const type = a.type;
        const parts: string[] = [];
        if (type === 'note' && p.text) parts.push(String(p.text));
        if ((type === 'call' || type === 'meeting') && p.summary) parts.push(String(p.summary));
        if (type === 'email') parts.push(`Subject: ${p.subject ?? '—'}`);
        if (type === 'task') parts.push(`Task: ${p.title ?? '—'}`);
        return `[${a.createdAt.toISOString()}] ${type}: ${parts.join(' ') || JSON.stringify(p)}`;
      })
      .join('\n');
  }

  private async loadAttachmentText(
    entityType: string,
    entityId: string,
    maxChars: number = 8000,
  ): Promise<string> {
    const attachments = await this.prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const snippets: string[] = [];
    let total = 0;
    for (const a of attachments) {
      if (!a.extractedText || total >= maxChars) break;
      const text = a.extractedText.slice(0, maxChars - total);
      snippets.push(`[${a.fileName}]: ${text}`);
      total += text.length + a.fileName.length + 4;
    }
    if (snippets.length === 0) return '';
    return `\n\n## Attachment excerpts\n${snippets.join('\n\n')}`;
  }

  async buildEmailContextPack(
    entityType: (typeof ENTITY_TYPES)[number],
    entityId: string,
    recipientEmail?: string,
    additionalContext?: string,
    maxTotalChars: number = 24000,
  ): Promise<string> {
    const [entityText, activitiesText, attachmentText] = await Promise.all([
      this.loadEntitySnapshot(entityType, entityId),
      this.loadActivitiesText(entityType, entityId, 30, 50),
      this.loadAttachmentText(entityType, entityId, 8000),
    ]);

    let recipientSection = '';
    if (recipientEmail) {
      const inferred = await this.inferRecipientInfo(entityType, entityId, recipientEmail);
      recipientSection = `\n\n## Recipient\nEmail: ${recipientEmail}${inferred ? `\nName: ${inferred}` : ''}`;
    } else {
      const suggested = await this.getSuggestedRecipients(entityType, entityId);
      if (suggested.length > 0) {
        recipientSection =
          '\n\n## Suggested recipients (from related contacts)\n' +
          suggested.map((r) => `${r.name ?? '—'}: ${r.email}`).join('\n');
      }
    }

    const base = `## Entity snapshot\n${entityText}\n\n## Recent activities\n${activitiesText}${attachmentText}${recipientSection}`;
    const withContext = additionalContext
      ? `${base}\n\n## Additional context\n${additionalContext}`
      : base;
    return withContext.slice(0, maxTotalChars);
  }

  private async inferRecipientInfo(
    entityType: string,
    entityId: string,
    email: string,
  ): Promise<string | null> {
    if (entityType === 'contact') {
      const c = await this.prisma.contact.findUnique({ where: { id: entityId } });
      if (c?.email === email) return `${c.firstName} ${c.lastName}`.trim();
    }
    if (entityType === 'lead') {
      const l = await this.prisma.lead.findUnique({ where: { id: entityId } });
      if (l?.email === email) return l.name;
    }
    return null;
  }

  private async getSuggestedRecipients(
    entityType: string,
    entityId: string,
  ): Promise<{ name?: string; email: string }[]> {
    let accountId: string | null = null;
    if (entityType === 'opportunity') {
      const o = await this.prisma.opportunity.findUnique({ where: { id: entityId } });
      accountId = o?.accountId ?? null;
    } else if (entityType === 'account') {
      accountId = entityId;
    }
    if (!accountId) return [];
    const contacts = await this.prisma.contact.findMany({
      where: { accountId },
      take: 10,
    });
    return contacts.map((c) => ({
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
    }));
  }
}
