/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

console.log("🌱 SEED SCRIPT EXECUTING");

const prisma = new PrismaClient();

async function main() {
  // Delete in FK-safe order: Lead references Opportunity, Contact, Account; Attachment references User (we keep users)
  await prisma.activity.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@crm.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const adminRole = process.env.SEED_ADMIN_ROLE ?? 'ADMIN';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      role: adminRole,
      isActive: true,
      passwordHash,
    },
    update: {
      role: adminRole,
      isActive: true,
      passwordHash,
    },
  });
  console.log('Admin user upserted:', adminEmail);

  const account1 = await prisma.account.create({
    data: {
      name: 'Acme Corp',
      industry: 'Technology',
      website: 'https://acme.com',
    },
  });

  const account2 = await prisma.account.create({
    data: {
      name: 'Globex Inc',
      industry: 'Manufacturing',
      website: 'https://globex.com',
    },
  });

  await Promise.all([
    prisma.contact.create({
      data: {
        accountId: account1.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@acme.com',
        phone: '+1234567890',
      },
    }),
    prisma.contact.create({
      data: {
        accountId: account1.id,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@acme.com',
      },
    }),
  ]);

  await Promise.all([
    prisma.lead.create({
      data: {
        name: 'Alice Johnson',
        email: 'alice@prospect.com',
        company: 'StartupXYZ',
        status: 'new',
        source: 'website',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Bob Wilson',
        email: 'bob@another.com',
        company: 'AnotherCo',
        status: 'qualified',
        source: 'referral',
      },
    }),
  ]);

  const [opp1] = await Promise.all([
    prisma.opportunity.create({
      data: {
        accountId: account1.id,
        name: 'Enterprise License',
        amount: 50000,
        stage: 'proposal',
        probability: 75,
        closeDate: new Date('2025-03-31'),
      },
    }),
    prisma.opportunity.create({
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

  await prisma.activity.create({
    data: {
      entityType: 'account',
      entityId: account1.id,
      type: 'call',
      payload: { subject: 'Intro call', duration: 30 },
    },
  });

  await prisma.activity.create({
    data: {
      entityType: 'opportunity',
      entityId: opp1.id,
      type: 'meeting',
      payload: { subject: 'Demo', attendees: 3 },
    },
  });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
