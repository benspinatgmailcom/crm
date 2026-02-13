import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevService {
  constructor(private readonly prisma: PrismaService) {}

  async seed(): Promise<{ message: string; counts: Record<string, number> }> {
    // Clear existing data (order matters for FK)
    await this.prisma.refreshToken.deleteMany();
    await this.prisma.activity.deleteMany();
    await this.prisma.opportunity.deleteMany();
    await this.prisma.contact.deleteMany();
    await this.prisma.lead.deleteMany();
    await this.prisma.account.deleteMany();
    await this.prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('Admin123!', 12);
    await this.prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash,
        role: 'ADMIN',
      },
    });

    const account1 = await this.prisma.account.create({
      data: {
        name: 'Acme Corp',
        industry: 'Technology',
        website: 'https://acme.com',
      },
    });

    const account2 = await this.prisma.account.create({
      data: {
        name: 'Globex Inc',
        industry: 'Manufacturing',
        website: 'https://globex.com',
      },
    });

    const [contact1, contact2] = await Promise.all([
      this.prisma.contact.create({
        data: {
          accountId: account1.id,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@acme.com',
          phone: '+1234567890',
        },
      }),
      this.prisma.contact.create({
        data: {
          accountId: account1.id,
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@acme.com',
        },
      }),
    ]);

    const [lead1, lead2] = await Promise.all([
      this.prisma.lead.create({
        data: {
          name: 'Alice Johnson',
          email: 'alice@prospect.com',
          company: 'StartupXYZ',
          status: 'new',
          source: 'website',
        },
      }),
      this.prisma.lead.create({
        data: {
          name: 'Bob Wilson',
          email: 'bob@another.com',
          company: 'AnotherCo',
          status: 'qualified',
          source: 'referral',
        },
      }),
    ]);

    const [opp1, opp2] = await Promise.all([
      this.prisma.opportunity.create({
        data: {
          accountId: account1.id,
          name: 'Enterprise License',
          amount: 50000,
          stage: 'proposal',
          probability: 75,
          closeDate: new Date('2025-03-31'),
        },
      }),
      this.prisma.opportunity.create({
        data: {
          accountId: account2.id,
          name: 'Consulting Engagement',
          amount: 25000,
          stage: 'discovery',
          probability: 50,
          closeDate: new Date('2025-04-15'),
        },
      }),
    ]);

    await Promise.all([
      this.prisma.activity.create({
        data: {
          entityType: 'account',
          entityId: account1.id,
          type: 'call',
          payload: { subject: 'Intro call', duration: 30 },
        },
      }),
      this.prisma.activity.create({
        data: {
          entityType: 'contact',
          entityId: contact1.id,
          type: 'email',
          payload: { subject: 'Follow-up', body: 'Thanks for the meeting' },
        },
      }),
      this.prisma.activity.create({
        data: {
          entityType: 'opportunity',
          entityId: opp1.id,
          type: 'meeting',
          payload: { subject: 'Demo', attendees: 3 },
        },
      }),
    ]);

    const counts = {
      users: 1,
      accounts: 2,
      contacts: 2,
      leads: 2,
      opportunities: 2,
      activities: 3,
    };

    return {
      message: 'Seed data created successfully',
      counts,
    };
  }
}
