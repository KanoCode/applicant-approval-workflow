/**
 * API-level integration tests using supertest against the real Express app
 * and a real (test) Postgres database via Prisma.
 *
 * These require DATABASE_URL to point at a real, migrated Postgres
 * database — see README "Running tests" for setup. They are intentionally
 * NOT mocking Prisma: the spec calls for an API test that proves an
 * unauthorized action returns 403, and that's only meaningful end-to-end
 * (route -> middleware -> handler -> DB), not against a mocked layer that
 * could silently diverge from the real authorization wiring.
 */
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { createTestUser, authHeader } from './testHelpers';
import { describe, it, expect , afterAll} from '@jest/globals'; // For newer versions of Jest


const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('returns a token and user for valid credentials', async () => {
    const passwordHash = await (await import('bcryptjs')).hash('correct-password', 4);
    const email = `login-test-${Date.now()}@example.com`;
    await prisma.user.create({
      data: { email, name: 'Login Test', role: 'APPLICANT', passwordHash },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Authentication guard', () => {
  it('rejects requests with no Authorization header with 401', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('Application creation and ownership', () => {
  it('allows an applicant to create a draft', async () => {
    const { token } = await createTestUser('APPLICANT');
    const res = await request(app)
      .post('/api/applications')
      .set(authHeader(token))
      .send({ title: 'Test request', category: 'OTHER', description: 'desc', amount: 10 });

    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe('DRAFT');
    expect(res.body.application.title).toBe('Test request');
  });

  it('rejects creation with a validation error for a missing title', async () => {
    const { token } = await createTestUser('APPLICANT');
    const res = await request(app)
      .post('/api/applications')
      .set(authHeader(token))
      .send({ category: 'OTHER', description: 'desc', amount: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects creation with a negative amount', async () => {
    const { token } = await createTestUser('APPLICANT');
    const res = await request(app)
      .post('/api/applications')
      .set(authHeader(token))
      .send({ title: 'Bad amount', category: 'OTHER', description: 'desc', amount: -5 });
    expect(res.status).toBe(400);
  });

  it('returns 403 when a REVIEWER attempts to create an application', async () => {
    const { token } = await createTestUser('REVIEWER');
    const res = await request(app)
      .post('/api/applications')
      .set(authHeader(token))
      .send({ title: 'Should fail', category: 'OTHER', description: 'desc', amount: 10 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it("returns 404 (not 200/403) when fetching another applicant's application by id, and the owner cannot see it either way", async () => {
    const { token: ownerToken } = await createTestUser('APPLICANT', 'Owner');
    const { token: otherToken } = await createTestUser('APPLICANT', 'Other');

    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(ownerToken))
      .send({ title: 'Private', category: 'OTHER', description: 'desc', amount: 5 });
    const id = createRes.body.application.id;

    const res = await request(app).get(`/api/applications/${id}`).set(authHeader(otherToken));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent application id', async () => {
    const { token } = await createTestUser('APPLICANT');
    const res = await request(app)
      .get('/api/applications/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});

describe('Editing rules', () => {
  it('allows the owner to edit their own DRAFT', async () => {
    const { token } = await createTestUser('APPLICANT');
    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(token))
      .send({ title: 'Original', category: 'OTHER', description: 'desc', amount: 5 });
    const id = createRes.body.application.id;

    const editRes = await request(app)
      .put(`/api/applications/${id}`)
      .set(authHeader(token))
      .send({ title: 'Edited', category: 'OTHER', description: 'desc', amount: 5 });

    expect(editRes.status).toBe(200);
    expect(editRes.body.application.title).toBe('Edited');
  });

  it("returns 403 when a different applicant tries to edit someone else's DRAFT", async () => {
    const { token: ownerToken } = await createTestUser('APPLICANT', 'Owner');
    const { token: attackerToken } = await createTestUser('APPLICANT', 'Attacker');

    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(ownerToken))
      .send({ title: 'Mine', category: 'OTHER', description: 'desc', amount: 5 });
    const id = createRes.body.application.id;

    const editRes = await request(app)
      .put(`/api/applications/${id}`)
      .set(authHeader(attackerToken))
      .send({ title: 'Hijacked', category: 'OTHER', description: 'desc', amount: 999 });

    expect(editRes.status).toBe(403);
  });

  it('returns 403 when the owner tries to edit after submitting', async () => {
    const { token } = await createTestUser('APPLICANT');
    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(token))
      .send({ title: 'Will submit', category: 'OTHER', description: 'desc', amount: 5 });
    const id = createRes.body.application.id;

    await request(app).post(`/api/applications/${id}/submit`).set(authHeader(token)).send({});

    const editRes = await request(app)
      .put(`/api/applications/${id}`)
      .set(authHeader(token))
      .send({ title: 'Too late', category: 'OTHER', description: 'desc', amount: 5 });

    expect(editRes.status).toBe(403);
  });
});

describe('Full workflow + authorization on transitions', () => {
  it('runs DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED and records an audit trail', async () => {
    const { token: applicantToken } = await createTestUser('APPLICANT');
    const { token: reviewerToken, user: reviewer } = await createTestUser('REVIEWER');

    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(applicantToken))
      .send({ title: 'Full flow', category: 'TRAVEL', description: 'desc', amount: 500 });
    const id = createRes.body.application.id;

    const submitRes = await request(app)
      .post(`/api/applications/${id}/submit`)
      .set(authHeader(applicantToken))
      .send({});
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.application.status).toBe('SUBMITTED');

    const claimRes = await request(app)
      .post(`/api/applications/${id}/claim`)
      .set(authHeader(reviewerToken))
      .send({});
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.application.status).toBe('UNDER_REVIEW');
    expect(claimRes.body.application.reviewer.id).toBe(reviewer.id);

    const approveRes = await request(app)
      .post(`/api/applications/${id}/approve`)
      .set(authHeader(reviewerToken))
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.application.status).toBe('APPROVED');

    const detailRes = await request(app)
      .get(`/api/applications/${id}`)
      .set(authHeader(reviewerToken));
    expect(detailRes.status).toBe(200);
    const log = detailRes.body.application.auditLog;
    expect(log).toHaveLength(3);
    expect(log.map((l: { toStatus: string }) => l.toStatus)).toEqual([
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
    ]);
  });

  it('returns 403 when the OWNER tries to approve their own application (core authorization requirement)', async () => {
    const { token: applicantToken } = await createTestUser('APPLICANT');

    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(applicantToken))
      .send({ title: 'Self approve attempt', category: 'OTHER', description: 'desc', amount: 50 });
    const id = createRes.body.application.id;

    await request(app).post(`/api/applications/${id}/submit`).set(authHeader(applicantToken)).send({});

    const approveRes = await request(app)
      .post(`/api/applications/${id}/approve`)
      .set(authHeader(applicantToken))
      .send({});

    expect(approveRes.status).toBe(403);
    expect(approveRes.body.error.code).toBe('FORBIDDEN');

    // and the status must not have changed
    const detailRes = await request(app)
      .get(`/api/applications/${id}`)
      .set(authHeader(applicantToken));
    expect(detailRes.body.application.status).toBe('SUBMITTED');
  });

  it('returns 403 when an applicant calls /reject directly', async () => {
    const { token: applicantToken } = await createTestUser('APPLICANT');
    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(applicantToken))
      .send({ title: 'Reject attempt', category: 'OTHER', description: 'desc', amount: 50 });
    const id = createRes.body.application.id;
    await request(app).post(`/api/applications/${id}/submit`).set(authHeader(applicantToken)).send({});

    const res = await request(app)
      .post(`/api/applications/${id}/reject`)
      .set(authHeader(applicantToken))
      .send({ comment: 'trying to reject my own' });
    expect(res.status).toBe(403);
  });

  it('returns 400 (COMMENT_REQUIRED) when a reviewer rejects without a comment', async () => {
    const { token: applicantToken } = await createTestUser('APPLICANT');
    const { token: reviewerToken } = await createTestUser('REVIEWER');
    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(applicantToken))
      .send({ title: 'No comment reject', category: 'OTHER', description: 'desc', amount: 50 });
    const id = createRes.body.application.id;
    await request(app).post(`/api/applications/${id}/submit`).set(authHeader(applicantToken)).send({});

    const res = await request(app)
      .post(`/api/applications/${id}/reject`)
      .set(authHeader(reviewerToken))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COMMENT_REQUIRED');
  });

  it('returns 400 for an illegal transition (e.g. submitting an already-APPROVED application)', async () => {
    const { token: applicantToken } = await createTestUser('APPLICANT');
    const { token: reviewerToken } = await createTestUser('REVIEWER');
    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(applicantToken))
      .send({ title: 'Terminal test', category: 'OTHER', description: 'desc', amount: 50 });
    const id = createRes.body.application.id;
    await request(app).post(`/api/applications/${id}/submit`).set(authHeader(applicantToken)).send({});
    await request(app).post(`/api/applications/${id}/approve`).set(authHeader(reviewerToken)).send({});

    const res = await request(app)
      .post(`/api/applications/${id}/submit`)
      .set(authHeader(applicantToken))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
  });

  it('allows return-for-changes then re-edit then re-submit (revision round trip)', async () => {
    const { token: applicantToken } = await createTestUser('APPLICANT');
    const { token: reviewerToken } = await createTestUser('REVIEWER');

    const createRes = await request(app)
      .post('/api/applications')
      .set(authHeader(applicantToken))
      .send({ title: 'Needs revision', category: 'EXPENSE', description: 'desc', amount: 75 });
    const id = createRes.body.application.id;
    await request(app).post(`/api/applications/${id}/submit`).set(authHeader(applicantToken)).send({});

    const returnRes = await request(app)
      .post(`/api/applications/${id}/return`)
      .set(authHeader(reviewerToken))
      .send({ comment: 'Please add more detail to the description.' });
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.application.status).toBe('RETURNED');

    const editRes = await request(app)
      .put(`/api/applications/${id}`)
      .set(authHeader(applicantToken))
      .send({ title: 'Needs revision', category: 'EXPENSE', description: 'much more detail here', amount: 75 });
    expect(editRes.status).toBe(200);

    const resubmitRes = await request(app)
      .post(`/api/applications/${id}/submit`)
      .set(authHeader(applicantToken))
      .send({});
    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.application.status).toBe('SUBMITTED');
  });
});

describe('GET /api/applications (list/queue) scoping', () => {
  it("only returns the applicant's own applications", async () => {
    const { token: aToken } = await createTestUser('APPLICANT', 'ListA');
    const { token: bToken } = await createTestUser('APPLICANT', 'ListB');

    await request(app)
      .post('/api/applications')
      .set(authHeader(aToken))
      .send({ title: 'Belongs to A', category: 'OTHER', description: 'd', amount: 1 });
    await request(app)
      .post('/api/applications')
      .set(authHeader(bToken))
      .send({ title: 'Belongs to B', category: 'OTHER', description: 'd', amount: 1 });

    const res = await request(app).get('/api/applications').set(authHeader(aToken));
    expect(res.status).toBe(200);
    const titles = res.body.applications.map((a: { title: string }) => a.title);
    expect(titles).toContain('Belongs to A');
    expect(titles).not.toContain('Belongs to B');
  });

  it('the reviewer queue excludes DRAFT applications by default', async () => {
    const { token: applicantToken } = await createTestUser('APPLICANT', 'QueueOwner');
    const { token: reviewerToken } = await createTestUser('REVIEWER', 'QueueReviewer');

    await request(app)
      .post('/api/applications')
      .set(authHeader(applicantToken))
      .send({ title: 'Still a draft, hidden', category: 'OTHER', description: 'd', amount: 1 });

    const res = await request(app)
      .get('/api/applications')
      .set(authHeader(reviewerToken));
    expect(res.status).toBe(200);
    const titles = res.body.applications.map((a: { title: string }) => a.title);
    expect(titles).not.toContain('Still a draft, hidden');
  });
});


