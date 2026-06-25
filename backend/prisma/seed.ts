import 'dotenv/config';
import { PrismaClient } from './generated/client';
import bcrypt from 'bcryptjs';

import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({adapter});

const SEED_PASSWORD = 'password123';

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const applicant = await prisma.user.upsert({
    where: { email: 'applicant@example.com' },
    update: {},
    create: {
      email: 'applicant@example.com',
      name: 'Amara Chen',
      role: 'APPLICANT',
      passwordHash,
    },
  });

  const secondApplicant = await prisma.user.upsert({
    where: { email: 'applicant2@example.com' },
    update: {},
    create: {
      email: 'applicant2@example.com',
      name: 'Priya Nair',
      role: 'APPLICANT',
      passwordHash,
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@example.com' },
    update: {},
    create: {
      email: 'reviewer@example.com',
      name: 'Jordan Blake',
      role: 'REVIEWER',
      passwordHash,
    },
  });

  // Clear previously seeded sample applications/audit rows so the seed is
  // re-runnable without duplicate-key errors on repeated `npm run seed`.
  await prisma.auditLog.deleteMany({ where: { application: { ownerId: applicant.id } } });
  await prisma.application.deleteMany({ where: { ownerId: applicant.id } });

  const draft = await prisma.application.create({
    data: {
      title: 'Laptop replacement',
      category: 'EQUIPMENT',
      description: 'My laptop battery no longer holds a charge through a workday.',
      amount: 1450.0,
      status: 'DRAFT',
      ownerId: applicant.id,
    },
  });

  const submitted = await prisma.application.create({
    data: {
      title: 'Conference travel — PyCon',
      category: 'TRAVEL',
      description: 'Requesting travel and ticket costs to attend PyCon as a speaker.',
      amount: 2200.0,
      status: 'SUBMITTED',
      ownerId: applicant.id,
    },
  });
  await prisma.auditLog.create({
    data: {
      applicationId: submitted.id,
      actorId: applicant.id,
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
      comment: null,
    },
  });

  const returned = await prisma.application.create({
    data: {
      title: 'Annual leave — December',
      category: 'LEAVE',
      description: 'Two weeks of leave from Dec 15 to Dec 29.',
      amount: 0,
      status: 'RETURNED',
      ownerId: applicant.id,
      reviewerId: reviewer.id,
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        applicationId: returned.id,
        actorId: applicant.id,
        fromStatus: 'DRAFT',
        toStatus: 'SUBMITTED',
        comment: null,
      },
      {
        applicationId: returned.id,
        actorId: reviewer.id,
        fromStatus: 'SUBMITTED',
        toStatus: 'RETURNED',
        comment: 'Please confirm coverage for your on-call shifts during this window.',
      },
    ],
  });

  const approved = await prisma.application.create({
    data: {
      title: 'Client dinner reimbursement',
      category: 'EXPENSE',
      description: 'Dinner with the Acme Corp account team after the renewal signing.',
      amount: 186.4,
      status: 'APPROVED',
      ownerId: secondApplicant.id,
      reviewerId: reviewer.id,
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        applicationId: approved.id,
        actorId: secondApplicant.id,
        fromStatus: 'DRAFT',
        toStatus: 'SUBMITTED',
        comment: null,
      },
      {
        applicationId: approved.id,
        actorId: reviewer.id,
        fromStatus: 'SUBMITTED',
        toStatus: 'APPROVED',
        comment: null,
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  // eslint-disable-next-line no-console
  console.log({
    draftId: draft.id,
    applicants: [applicant.email, secondApplicant.email],
    reviewer: reviewer.email,
    password: SEED_PASSWORD,
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
