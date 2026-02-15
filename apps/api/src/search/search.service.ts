import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
}

export interface SearchResponse {
  q: string;
  results: {
    accounts: SearchResultItem[];
    contacts: SearchResultItem[];
    leads: SearchResultItem[];
    opportunities: SearchResultItem[];
  };
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, limit = 5): Promise<SearchResponse> {
    const term = q.trim();
    if (term.length < 2) {
      return {
        q: term,
        results: {
          accounts: [],
          contacts: [],
          leads: [],
          opportunities: [],
        },
      };
    }

    const contains = { contains: term, mode: 'insensitive' as const };
    const take = Math.min(Math.max(limit, 1), 10);

    const [accounts, contacts, leads, opportunities] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          OR: [
            { name: contains },
            { industry: contains },
            { website: contains },
          ],
        },
        select: { id: true, name: true, industry: true, website: true },
        take,
      }),
      this.prisma.contact.findMany({
        where: {
          OR: [
            { firstName: contains },
            { lastName: contains },
            { email: contains },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          account: { select: { name: true } },
        },
        take,
      }),
      this.prisma.lead.findMany({
        where: {
          OR: [
            { name: contains },
            { email: contains },
            { company: contains },
          ],
        },
        select: { id: true, name: true, email: true, company: true },
        take,
      }),
      this.prisma.opportunity.findMany({
        where: {
          OR: [
            { name: contains },
            { stage: contains },
            { account: { name: contains } },
          ],
        },
        select: {
          id: true,
          name: true,
          stage: true,
          account: { select: { name: true } },
        },
        take,
      }),
    ]);

    return {
      q: term,
      results: {
        accounts: accounts.map((a) => ({
          id: a.id,
          title: a.name,
          subtitle: [a.industry, a.website].filter(Boolean).join(' · ') || undefined,
        })),
        contacts: contacts.map((c) => ({
          id: c.id,
          title: `${c.firstName} ${c.lastName}`.trim(),
          subtitle: c.account?.name ?? c.email,
        })),
        leads: leads.map((l) => ({
          id: l.id,
          title: l.name,
          subtitle: [l.company, l.email].filter(Boolean).join(' · ') || undefined,
        })),
        opportunities: opportunities.map((o) => ({
          id: o.id,
          title: o.name,
          subtitle: [o.account?.name, o.stage].filter(Boolean).join(' · ') || undefined,
        })),
      },
    };
  }
}
