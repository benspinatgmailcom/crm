import { ForbiddenException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { UPLOADS_DIR } from '../attachments/uploads.constants';
import type { SeedStoryDto } from './dto/seed-story.dto';
import { env } from '../config/env';

const STORY_ACCOUNT_NAMES = {
  APEX: 'Apex Data Centers',
  NORTHWIND: 'Northwind Telecom',
  GLOBEX: 'Globex Manufacturing',
} as const;

export interface SeedStoryResult {
  accountsCreated: number;
  contactsCreated: number;
  opportunitiesCreated: number;
  activitiesCreated: number;
  attachmentsCreated: number;
  storyAccountIds: { apexId: string; northwindId: string; globexId: string };
}

/** Seeded multer-like file for AttachmentsService.create */
function fakeFile(
  fileName: string,
  content: string,
  mimeType: string = 'text/plain',
): Express.Multer.File {
  const buffer = Buffer.from(content, 'utf-8');
  return {
    fieldname: 'file',
    originalname: fileName,
    encoding: '7bit',
    mimetype: mimeType,
    size: buffer.length,
    buffer,
    stream: Readable.from(buffer) as Express.Multer.File['stream'],
    destination: '',
    filename: '',
    path: '',
  };
}

/** Add days to a date; returns new Date. Safe for positive or negative days. */
function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** Deterministic pseudo-random (seeded) for filler data */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

@Injectable()
export class SeedStoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async wipeCrmData(): Promise<void> {
    await this.prisma.activity.deleteMany();
    await this.prisma.opportunity.deleteMany();
    await this.prisma.contact.deleteMany();
    await this.prisma.lead.deleteMany();
    await this.prisma.attachment.deleteMany();
    await this.prisma.account.deleteMany();
  }

  async wipeUploads(): Promise<void> {
    const dir = UPLOADS_DIR;
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        fs.rmSync(full, { recursive: true });
      } else {
        fs.unlinkSync(full);
      }
    }
  }

  private async getAdminUser(): Promise<{ id: string; email: string; role: string }> {
    const user = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!user) throw new ForbiddenException('No ADMIN user found; create one first');
    return user as { id: string; email: string; role: string };
  }

  private async createActivityWithDate(
    entityType: string,
    entityId: string,
    type: string,
    payload: Record<string, unknown>,
    createdAt: Date,
  ): Promise<void> {
    await this.prisma.activity.create({
      data: {
        entityType,
        entityId,
        type,
        payload: payload as object,
        createdAt,
      },
    });
  }

  async seedStory(dto: SeedStoryDto): Promise<SeedStoryResult> {
    if (env.NODE_ENV === 'production') {
      throw new ForbiddenException('Story seed is disabled in production');
    }

    const reset = dto.reset ?? false;
    const includeFiller = dto.includeFiller ?? false;
    const fillerCount = Math.max(0, Math.min(20, dto.fillerAccounts ?? 2));

    const admin = await this.getAdminUser();
    const user = admin as any;

    let accountsCreated = 0;
    let contactsCreated = 0;
    let opportunitiesCreated = 0;
    let activitiesCreated = 0;
    let attachmentsCreated = 0;

    if (reset) {
      await this.wipeCrmData();
      await this.wipeUploads();
    }

    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    // --- Apex Data Centers ---
    let apexAccount = await this.prisma.account.findFirst({
      where: { name: STORY_ACCOUNT_NAMES.APEX },
    });
    if (!apexAccount) {
      apexAccount = await this.prisma.account.create({
        data: {
          name: STORY_ACCOUNT_NAMES.APEX,
          industry: 'Data Centers / Colocation',
          website: 'https://apexdatacenters.com',
        },
      });
      accountsCreated++;
    }

    const apexId = apexAccount.id;
    const apexContacts = await this.ensureContacts(apexId, [
      { firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@apexdatacenters.com', title: 'VP Infrastructure (Champion)' },
      { firstName: 'Michael', lastName: 'Torres', email: 'michael.torres@apexdatacenters.com', title: 'CFO (Economic buyer)' },
      { firstName: 'James', lastName: 'Park', email: 'james.park@apexdatacenters.com', title: 'Director of Network' },
      { firstName: 'Lisa', lastName: 'Nguyen', email: 'lisa.nguyen@apexdatacenters.com', title: 'Procurement Manager' },
      { firstName: 'David', lastName: 'Kim', email: 'david.kim@apexdatacenters.com', title: 'Solutions Architect' },
      { firstName: 'Rachel', lastName: 'Foster', email: 'rachel.foster@apexdatacenters.com', title: 'Facilities Ops Lead' },
    ], reset, (n) => { contactsCreated += n; });

    const apexOpps = await this.ensureOpportunities(apexId, [
      { name: 'Apex Renewal FY26', stage: 'negotiation', amount: 1_200_000, closeDaysOut: 21 },
      { name: 'Edge Expansion Phase 1', stage: 'proposal', amount: 450_000, closeDaysOut: 45 },
      { name: 'Disaster Recovery Add-on', stage: 'qualification', amount: 180_000, closeDaysOut: 60 },
    ], reset, (n) => { opportunitiesCreated += n; });

    await this.seedApexActivities(apexId, apexContacts, apexOpps, reset, (n) => { activitiesCreated += n; });
    const apexAttachmentCount = await this.seedApexAttachments(apexId, user, reset);
    attachmentsCreated += apexAttachmentCount;

    // --- Northwind Telecom ---
    let northwindAccount = await this.prisma.account.findFirst({
      where: { name: STORY_ACCOUNT_NAMES.NORTHWIND },
    });
    if (!northwindAccount) {
      northwindAccount = await this.prisma.account.create({
        data: {
          name: STORY_ACCOUNT_NAMES.NORTHWIND,
          industry: 'Telecommunications',
          website: 'https://northwindtelecom.com',
        },
      });
      accountsCreated++;
    }

    const northwindId = northwindAccount.id;
    const northwindContacts = await this.ensureContacts(northwindId, [
      { firstName: 'Tom', lastName: 'Bradley', email: 'tom.bradley@northwindtelecom.com', title: 'CTO (Champion)' },
      { firstName: 'Nancy', lastName: 'Hill', email: 'nancy.hill@northwindtelecom.com', title: 'VP Ops' },
      { firstName: 'Chris', lastName: 'Wright', email: 'chris.wright@northwindtelecom.com', title: 'Network Architect' },
      { firstName: 'Pat', lastName: 'Morgan', email: 'pat.morgan@northwindtelecom.com', title: 'Procurement' },
    ], reset, (n) => { contactsCreated += n; });

    await this.ensureOpportunities(northwindId, [
      { name: 'Core Network Modernization', stage: 'proposal', amount: 650_000, closeDaysOut: 30 },
      { name: 'Long-haul Fiber Connectivity', stage: 'qualification', amount: 300_000, closeDaysOut: 75 },
    ], reset, (n) => { opportunitiesCreated += n; });

    await this.seedNorthwindActivities(northwindId, northwindContacts, reset, (n) => { activitiesCreated += n; });
    const northwindAttachmentCount = await this.seedNorthwindAttachments(northwindId, user, reset);
    attachmentsCreated += northwindAttachmentCount;

    // --- Globex Manufacturing ---
    let globexAccount = await this.prisma.account.findFirst({
      where: { name: STORY_ACCOUNT_NAMES.GLOBEX },
    });
    if (!globexAccount) {
      globexAccount = await this.prisma.account.create({
        data: {
          name: STORY_ACCOUNT_NAMES.GLOBEX,
          industry: 'Manufacturing',
          website: 'https://globexmfg.com',
        },
      });
      accountsCreated++;
    }

    const globexId = globexAccount.id;
    const globexContacts = await this.ensureContacts(globexId, [
      { firstName: 'Frank', lastName: 'Miller', email: 'frank.miller@globexmfg.com', title: 'IT Director' },
      { firstName: 'Susan', lastName: 'Clark', email: 'susan.clark@globexmfg.com', title: 'Operations Lead' },
      { firstName: 'Robert', lastName: 'Lewis', email: 'robert.lewis@globexmfg.com', title: 'Finance Analyst' },
    ], reset, (n) => { contactsCreated += n; });

    await this.ensureOpportunities(globexId, [
      { name: 'ERP Integration Modernization', stage: 'qualification', amount: 250_000, closeDaysOut: 90 },
    ], reset, (n) => { opportunitiesCreated += n; });

    await this.seedGlobexActivities(globexId, globexContacts, reset, (n) => { activitiesCreated += n; });
    const globexAttachmentCount = await this.seedGlobexAttachments(globexId, user, reset);
    attachmentsCreated += globexAttachmentCount;

    // --- Filler ---
    if (includeFiller && fillerCount > 0) {
      const fillerResult = await this.seedFillerAccounts(fillerCount, user);
      accountsCreated += fillerResult.accountsCreated;
      contactsCreated += fillerResult.contactsCreated;
      opportunitiesCreated += fillerResult.opportunitiesCreated;
      activitiesCreated += fillerResult.activitiesCreated;
      attachmentsCreated += fillerResult.attachmentsCreated;
    }

    return {
      accountsCreated,
      contactsCreated,
      opportunitiesCreated,
      activitiesCreated,
      attachmentsCreated,
      storyAccountIds: { apexId, northwindId, globexId },
    };
  }

  private async ensureContacts(
    accountId: string,
    list: Array<{ firstName: string; lastName: string; email: string; title?: string }>,
    reset: boolean,
    onCreated: (n: number) => void,
  ): Promise<Array<{ id: string; firstName: string; lastName: string; email: string }>> {
    const existing = await this.prisma.contact.findMany({ where: { accountId } });
    if (reset || existing.length === 0) {
      if (existing.length) await this.prisma.contact.deleteMany({ where: { accountId } });
      const created = await Promise.all(
        list.map((c) =>
          this.prisma.contact.create({
            data: {
              accountId,
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email,
              phone: null,
            },
          }),
        ),
      );
      onCreated(created.length);
      return created;
    }
    return existing;
  }

  private async ensureOpportunities(
    accountId: string,
    spec: Array<{ name: string; stage: string; amount: number; closeDaysOut: number }>,
    reset: boolean,
    onCreated: (n: number) => void,
  ): Promise<Array<{ id: string; name: string }>> {
    let existing = await this.prisma.opportunity.findMany({ where: { accountId } });
    if (reset || existing.length === 0) {
      if (existing.length) await this.prisma.opportunity.deleteMany({ where: { accountId } });
      const today = new Date();
      for (const o of spec) {
        const closeDate = addDays(today, o.closeDaysOut);
        await this.prisma.opportunity.create({
          data: {
            accountId,
            name: o.name,
            stage: o.stage,
            amount: o.amount,
            closeDate,
          },
        });
      }
      onCreated(spec.length);
    }
    const opps = await this.prisma.opportunity.findMany({ where: { accountId }, select: { id: true, name: true } });
    return opps;
  }

  private async seedApexActivities(
    accountId: string,
    _contacts: Array<{ id: string }>,
    opps: Array<{ id: string; name: string }>,
    reset: boolean,
    onCreated: (n: number) => void,
  ): Promise<void> {
    if (!reset) {
      const count = await this.prisma.activity.count({
        where: { entityType: 'account', entityId: accountId },
      });
      if (count >= 40) return;
    }

    const oppId = opps[0]?.id ?? accountId;
    const daysAgo = (d: number) => {
      const dte = new Date();
      dte.setDate(dte.getDate() - d);
      return dte;
    };

    const activities: Array<{ type: string; payload: Record<string, unknown>; daysAgo: number }> = [
      { type: 'note', payload: { text: 'Pricing pressure from competitor; Sarah asked for 15% discount on renewal.' }, daysAgo: 88 },
      { type: 'note', payload: { text: 'Competitor mention: they are evaluating Equinix as well.' }, daysAgo: 85 },
      { type: 'call', payload: { summary: 'Renewal discussion', outcome: 'Positive', nextStep: 'Send revised proposal by Friday' }, daysAgo: 82 },
      { type: 'meeting', payload: { summary: 'QBR with Sarah and Michael', outcome: 'Aligned on scope', nextStep: 'Legal to review MSA' }, daysAgo: 75 },
      { type: 'email', payload: { subject: 'Renewal proposal attached', body: 'Please find the renewal pricing model attached.', direction: 'outbound' }, daysAgo: 72 },
      { type: 'task', payload: { title: 'Send revised pricing', status: 'done', dueAt: daysAgo(70).toISOString() }, daysAgo: 70 },
      { type: 'note', payload: { text: 'Renewal concerns: Michael asked about multi-year commitment discount.' }, daysAgo: 65 },
      { type: 'call', payload: { summary: 'Edge expansion scope', outcome: 'Needs internal alignment', nextStep: 'Schedule with Facilities' }, daysAgo: 60 },
      { type: 'meeting', payload: { summary: 'Edge Expansion Phase 1 kickoff', outcome: 'Kickoff completed', nextStep: 'Site survey in 2 weeks' }, daysAgo: 55 },
      { type: 'email', payload: { subject: 'Re: Infrastructure Assessment', body: 'Thanks for sharing the assessment doc.', direction: 'inbound' }, daysAgo: 50 },
      { type: 'task', payload: { title: 'Follow up on DR add-on', status: 'open', dueAt: daysAgo(5).toISOString() }, daysAgo: 45 },
      { type: 'note', payload: { text: 'Competitor comparison requested by Procurement.' }, daysAgo: 42 },
      { type: 'call', payload: { summary: 'Negotiation call with Michael', outcome: 'Terms agreed', nextStep: 'Send final contract' }, daysAgo: 38 },
      { type: 'meeting', payload: { summary: 'Contract review', outcome: 'Minor edits', nextStep: 'Legal sign-off' }, daysAgo: 30 },
      { type: 'email', payload: { subject: 'Contract draft', body: 'Attached the redlined MSA for your review.', direction: 'outbound' }, daysAgo: 28 },
      { type: 'task', payload: { title: 'Get legal sign-off', status: 'done', dueAt: daysAgo(25).toISOString() }, daysAgo: 25 },
      { type: 'note', payload: { text: 'Renewal timeline at risk if we do not close by month end.' }, daysAgo: 22 },
      { type: 'call', payload: { summary: 'Final pricing confirmation', outcome: 'Approved', nextStep: 'Execute agreement' }, daysAgo: 18 },
      { type: 'meeting', payload: { summary: 'Executive sign-off', outcome: 'Approved', nextStep: 'Countersign' }, daysAgo: 12 },
      { type: 'email', payload: { subject: 'Re: Contract', body: 'We have signed. Please countersign.', direction: 'inbound' }, daysAgo: 8 },
      { type: 'task', payload: { title: 'Countersign and file', status: 'open', dueAt: daysAgo(3).toISOString() }, daysAgo: 5 },
    ];

    for (const a of activities) {
      const createdAt = daysAgo(a.daysAgo);
      await this.createActivityWithDate('account', accountId, a.type, a.payload, createdAt);
      if (opps.length && a.daysAgo <= 60) {
        await this.createActivityWithDate('opportunity', oppId, a.type, a.payload, createdAt);
      }
    }
    onCreated(activities.length * 2);
  }

  private async seedApexAttachments(accountId: string, user: any, reset: boolean): Promise<number> {
    const files = [
      { name: 'Renewal Pricing Model Q3.txt', content: 'Apex Data Centers - Renewal Pricing Model Q3\n\nTier 1: Colocation base - $X per kW\nTier 2: Edge expansion - $Y per cabinet\nMulti-year discount: 12% for 3-year, 15% for 5-year.\n\nValid through end of quarter.' },
      { name: 'Apex Infrastructure Assessment.md', content: '# Apex Infrastructure Assessment\n\n## Current state\n- 3 data centers in primary region\n- Edge expansion planned for Phase 1\n\n## Recommendations\n- DR add-on to align with compliance requirements\n- Network modernization in DC2.' },
      { name: 'Competitor Comparison.txt', content: 'Competitor comparison for Apex renewal.\n\nUs: Strong on edge, competitive pricing.\nEquinix: Strong brand, higher cost.\nDigital Realty: Good footprint, longer lead times.\n\nRecommend positioning on edge and support.' },
      { name: 'Edge Expansion Proposal Draft.txt', content: 'Edge Expansion Phase 1 - Proposal Draft\n\nScope: 50 cabinets across 2 sites\nTimeline: 6 months from signature\nPricing: As per Renewal Pricing Model Q3\n\nNext: Site survey and final SOW.' },
    ];
    return this.ensureAttachments(accountId, 'account', files, user, reset);
  }

  private async seedNorthwindActivities(
    accountId: string,
    _contacts: Array<{ id: string }>,
    reset: boolean,
    onCreated: (n: number) => void,
  ): Promise<void> {
    if (!reset) {
      const count = await this.prisma.activity.count({
        where: { entityType: 'account', entityId: accountId },
      });
      if (count >= 25) return;
    }

    const daysAgo = (d: number) => {
      const dte = new Date();
      dte.setDate(dte.getDate() - d);
      return dte;
    };

    const activities: Array<{ type: string; payload: Record<string, unknown>; daysAgo: number }> = [
      { type: 'note', payload: { text: 'Strong momentum with Tom on network modernization.' }, daysAgo: 58 },
      { type: 'call', payload: { summary: 'Intro call with CTO', outcome: 'Very interested', nextStep: 'Send requirements doc' }, daysAgo: 55 },
      { type: 'meeting', payload: { summary: 'Requirements workshop', outcome: 'Scope defined', nextStep: 'Proposal in 2 weeks' }, daysAgo: 50 },
      { type: 'email', payload: { subject: 'Northwind Requirements Doc', body: 'Attached per our discussion.', direction: 'outbound' }, daysAgo: 48 },
      { type: 'task', payload: { title: 'Draft proposal', status: 'done', dueAt: daysAgo(45).toISOString() }, daysAgo: 45 },
      { type: 'note', payload: { text: 'Positive feedback on implementation timeline.' }, daysAgo: 40 },
      { type: 'call', payload: { summary: 'Proposal review', outcome: 'Approved with minor edits', nextStep: 'Legal review' }, daysAgo: 35 },
      { type: 'meeting', payload: { summary: 'Technical deep-dive with Chris', outcome: 'Architecture aligned', nextStep: 'Fiber topology review' }, daysAgo: 28 },
      { type: 'email', payload: { subject: 'Re: Implementation Timeline', body: 'Looks good. We can start in Q2.', direction: 'inbound' }, daysAgo: 22 },
      { type: 'task', payload: { title: 'Send fiber topology', status: 'done', dueAt: daysAgo(18).toISOString() }, daysAgo: 18 },
      { type: 'note', payload: { text: 'Core network deal moving to proposal stage.' }, daysAgo: 14 },
      { type: 'call', payload: { summary: 'Procurement discussion', outcome: 'Budget confirmed', nextStep: 'Final pricing' }, daysAgo: 10 },
      { type: 'meeting', payload: { summary: 'Executive summary', outcome: 'Green light', nextStep: 'Contract draft' }, daysAgo: 5 },
    ];

    for (const a of activities) {
      await this.createActivityWithDate('account', accountId, a.type, a.payload, daysAgo(a.daysAgo));
    }
    onCreated(activities.length);
  }

  private async seedNorthwindAttachments(accountId: string, user: any, reset: boolean): Promise<number> {
    const files = [
      { name: 'Northwind Requirements Doc.txt', content: 'Northwind Telecom - Core Network Modernization\n\nRequirements:\n- 100G backbone upgrade\n- Redundant paths\n- NOC integration\n\nTimeline: 6 months preferred.' },
      { name: 'Implementation Timeline Draft.md', content: '# Implementation Timeline\n\nPhase 1: Design (4 weeks)\nPhase 2: Build (12 weeks)\nPhase 3: Cutover (2 weeks)\n\nGo-live target: Q2.' },
      { name: 'Fiber Topology Overview.txt', content: 'Fiber topology for Northwind long-haul.\n\nSites: 5 primary, 3 edge\nCurrent: 10G, Target: 100G\n\nMap and specs attached in follow-up.' },
    ];
    return this.ensureAttachments(accountId, 'account', files, user, reset);
  }

  private async seedGlobexActivities(
    accountId: string,
    _contacts: Array<{ id: string }>,
    reset: boolean,
    onCreated: (n: number) => void,
  ): Promise<void> {
    if (!reset) {
      const count = await this.prisma.activity.count({
        where: { entityType: 'account', entityId: accountId },
      });
      if (count >= 20) return;
    }

    const daysAgo = (d: number) => {
      const dte = new Date();
      dte.setDate(dte.getDate() - d);
      return dte;
    };

    const activities: Array<{ type: string; payload: Record<string, unknown>; daysAgo: number }> = [
      { type: 'note', payload: { text: 'ERP integration project discussed; Frank interested but needs budget.' }, daysAgo: 115 },
      { type: 'call', payload: { summary: 'Initial discovery', outcome: 'Needs internal buy-in', nextStep: 'Send scope doc' }, daysAgo: 110 },
      { type: 'meeting', payload: { summary: 'Scope workshop', outcome: 'Scope defined', nextStep: 'Proposal' }, daysAgo: 100 },
      { type: 'email', payload: { subject: 'ERP Integration Scope', body: 'Attached the scope document.', direction: 'outbound' }, daysAgo: 95 },
      { type: 'task', payload: { title: 'Send proposal', status: 'done', dueAt: daysAgo(90).toISOString() }, daysAgo: 90 },
      { type: 'note', payload: { text: 'Frank said budget cycle delayed to Q3.' }, daysAgo: 85 },
      { type: 'call', payload: { summary: 'Check-in', outcome: 'No update', nextStep: 'Follow up in 2 weeks' }, daysAgo: 75 },
      { type: 'email', payload: { subject: 'Re: Proposal', body: 'Still in review. Will revert.', direction: 'inbound' }, daysAgo: 65 },
      { type: 'task', payload: { title: 'Follow up with Frank', status: 'open', dueAt: daysAgo(40).toISOString() }, daysAgo: 55 },
      { type: 'note', payload: { text: 'No response to last two emails. Going dark?' }, daysAgo: 45 },
      { type: 'email', payload: { subject: 'Following up', body: 'Wanted to check in on the ERP project.', direction: 'outbound' }, daysAgo: 35 },
      { type: 'email', payload: { subject: 'Re: Following up', body: '(No reply)', direction: 'inbound' }, daysAgo: 32 },
      { type: 'task', payload: { title: 'Re-engage Globex', status: 'open', dueAt: daysAgo(5).toISOString() }, daysAgo: 20 },
    ];

    for (const a of activities) {
      await this.createActivityWithDate('account', accountId, a.type, a.payload, daysAgo(a.daysAgo));
    }
    onCreated(activities.length);
  }

  private async seedGlobexAttachments(accountId: string, user: any, reset: boolean): Promise<number> {
    const files = [
      { name: 'ERP Integration Scope.txt', content: 'Globex Manufacturing - ERP Integration Scope\n\nObjectives:\n- Replace legacy ERP modules\n- Integrate with shop floor systems\n- Reporting and analytics\n\nEstimated timeline: 9 months.' },
      { name: 'Manufacturing Workflow Notes.md', content: '# Manufacturing Workflow Notes\n\nCurrent: Manual handoffs between ERP and MES.\nTarget: Real-time sync, single source of truth.\n\nKey stakeholders: Frank (IT), Susan (Ops).' },
    ];
    return this.ensureAttachments(accountId, 'account', files, user, reset);
  }

  private async ensureAttachments(
    entityId: string,
    entityType: string,
    files: Array<{ name: string; content: string }>,
    user: any,
    reset: boolean,
  ): Promise<number> {
    const existing = await this.prisma.attachment.count({ where: { entityType, entityId } });
    if (!reset && existing >= files.length) return 0;

    let created = 0;
    for (const f of files) {
      const ext = path.extname(f.name).toLowerCase();
      const mime = ext === '.md' ? 'text/markdown' : 'text/plain';
      const file = fakeFile(f.name, f.content, mime);
      await this.attachmentsService.create(entityType, entityId, file, user);
      created++;
    }
    return created;
  }

  private async seedFillerAccounts(
    count: number,
    user: any,
  ): Promise<{
    accountsCreated: number;
    contactsCreated: number;
    opportunitiesCreated: number;
    activitiesCreated: number;
    attachmentsCreated: number;
  }> {
    const rand = seededRandom(42);
    const companies = ['Summit Labs', 'Delta Logistics', 'Omega Services', 'Prime Consulting', 'Nova Tech', 'Apex Solutions', 'Vertex Systems', 'Pinnacle Group', 'Horizon Inc', 'Catalyst Corp'];
    const industries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'];
    let accountsCreated = 0;
    let contactsCreated = 0;
    let opportunitiesCreated = 0;
    let activitiesCreated = 0;
    let attachmentsCreated = 0;

    for (let i = 0; i < count; i++) {
      const name = companies[i % companies.length] + ` ${i}`;
      const existing = await this.prisma.account.findFirst({ where: { name } });
      if (existing) continue;

      const account = await this.prisma.account.create({
        data: {
          name,
          industry: industries[Math.floor(rand() * industries.length)],
          website: `https://${name.toLowerCase().replace(/\s/g, '')}.com`,
        },
      });
      accountsCreated++;

      const numContacts = 1 + Math.floor(rand() * 3);
      for (let c = 0; c < numContacts; c++) {
        await this.prisma.contact.create({
          data: {
            accountId: account.id,
            firstName: `First${c}`,
            lastName: `Last${i}-${c}`,
            email: `contact${c}@${name.toLowerCase().replace(/\s/g, '')}.com`,
          },
        });
        contactsCreated++;
      }

      const fillerStages: Array<{ stage: string; daysMin: number; daysMax: number }> = [
        { stage: 'qualification', daysMin: 60, daysMax: 120 },
        { stage: 'discovery', daysMin: 60, daysMax: 120 },
        { stage: 'proposal', daysMin: 30, daysMax: 75 },
        { stage: 'negotiation', daysMin: 7, daysMax: 30 },
        { stage: 'closed-won', daysMin: -60, daysMax: -1 },
        { stage: 'closed-lost', daysMin: -60, daysMax: -1 },
      ];
      const numOpps = Math.max(1, Math.floor(rand() * 3));
      const today = new Date();
      for (let o = 0; o < numOpps; o++) {
        const stageSpec = fillerStages[Math.floor(rand() * fillerStages.length)];
        const range = stageSpec.daysMax - stageSpec.daysMin + 1;
        const days = stageSpec.daysMin + Math.floor(rand() * range);
        const closeDate = addDays(today, days);
        await this.prisma.opportunity.create({
          data: {
            accountId: account.id,
            name: `Opportunity ${o + 1}`,
            stage: stageSpec.stage,
            amount: 50000 + Math.floor(rand() * 100000),
            closeDate,
          },
        });
        opportunitiesCreated++;
      }

      const numActivities = 5 + Math.floor(rand() * 6);
      const types = ['note', 'call', 'email', 'task'];
      for (let a = 0; a < numActivities; a++) {
        const daysAgo = Math.floor(rand() * 60);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);
        const type = types[Math.floor(rand() * types.length)];
        const payloads: Record<string, Record<string, unknown>> = {
          note: { text: `Filler note ${a}` },
          call: { summary: `Call ${a}`, outcome: 'Good', nextStep: 'Follow up' },
          email: { subject: `Email ${a}`, body: 'Body', direction: 'outbound' },
          task: { title: `Task ${a}`, status: 'open' },
        };
        await this.createActivityWithDate('account', account.id, type, payloads[type], createdAt);
        activitiesCreated++;
      }

      const file = fakeFile(`Filler Doc ${i}.txt`, `Filler content for ${name}.\n\nSome details.`);
      await this.attachmentsService.create('account', account.id, file, user);
      attachmentsCreated++;
    }

    return {
      accountsCreated,
      contactsCreated,
      opportunitiesCreated,
      activitiesCreated,
      attachmentsCreated,
    };
  }
}
