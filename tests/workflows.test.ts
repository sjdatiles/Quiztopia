import http from 'node:http';
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServerApp } from '../server.ts';
import { adminDb } from '../server/firebase.ts';

let server: http.Server;
let baseUrl = '';

const cleanupClassIds: string[] = [];
const cleanupTeamIds: string[] = [];
const cleanupQuizIds: string[] = [];
const cleanupSessionIds: string[] = [];

async function requestJson(
  path: string,
  options: RequestInit & { cookie?: string } = {}
): Promise<{ status: number; data: any; setCookie?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.cookie) headers.Cookie = options.cookie;

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const rawSetCookie = res.headers.get('set-cookie') || undefined;
  const cookiePair = rawSetCookie ? rawSetCookie.split(';')[0] : undefined;
  return { status: res.status, data, setCookie: cookiePair };
}

beforeAll(async () => {
  const created = await createServerApp({ skipFrontend: true });
  server = created.server;
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;

  // Ensure initial seed data exists
  await requestJson('/api/health');
}, 30000);

afterAll(async () => {
  // Clean up test-created documents in Firestore so seeded data stays tidy
  const batch = adminDb.batch();
  for (const cid of cleanupClassIds) {
    batch.delete(adminDb.collection('classes').doc(cid));
    for (const n of [1, 2, 3]) {
      batch.delete(adminDb.collection('academic_terms').doc(`${cid}_term_${n}`));
    }
    const ranksSnap = await adminDb.collection('term_rankings').where('classId', '==', cid).get();
    ranksSnap.docs.forEach((d) => batch.delete(d.ref));
  }
  for (const tid of cleanupTeamIds) {
    batch.delete(adminDb.collection('teams').doc(tid));
    batch.delete(adminDb.collection('team_avatars').doc(tid));
    batch.delete(adminDb.collection('team_wallets').doc(tid));
    batch.delete(adminDb.collection('team_islands').doc(tid));
    const subCollections = [
      'team_creatures',
      'team_inventory_items',
      'team_achievements',
      'coin_transactions',
      'quiz_results',
    ];
    for (const col of subCollections) {
      const snap = await adminDb.collection(col).where('teamId', '==', tid).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
  }
  for (const qid of cleanupQuizIds) {
    batch.delete(adminDb.collection('quizzes').doc(qid));
  }
  for (const sid of cleanupSessionIds) {
    batch.delete(adminDb.collection('quiz_sessions').doc(sid));
    for (const col of ['quiz_participants', 'team_answers', 'quiz_results']) {
      const snap = await adminDb.collection(col).where('sessionId', '==', sid).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
  }
  await batch.commit();

  await new Promise<void>((resolve) => server.close(() => resolve()));
}, 30000);

describe('Quiztopia End-to-End Server Workflows', () => {
  let teacherCookie = '';
  let testClassId = '';
  let testTeamId = '';
  let testTeamUsername = '';
  let testTeamPassword = '';
  let testTeamCookie = '';

  it('rejects invalid credentials and enforces strict role-based access control', async () => {
    const badLogin = await requestJson('/api/auth/team/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'star', password: 'wrongpassword' }),
    });
    expect(badLogin.status).toBe(401);

    const unauthedTeacher = await requestJson('/api/teacher/overview');
    expect(unauthedTeacher.status).toBe(401);

    const starLogin = await requestJson('/api/auth/team/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'star', password: 'star123' }),
    });
    expect(starLogin.status).toBe(200);
    expect(starLogin.setCookie).toBeTruthy();

    // Team cannot access teacher routes
    const teamHitsTeacher = await requestJson('/api/teacher/overview', {
      cookie: starLogin.setCookie,
    });
    expect(teamHitsTeacher.status).toBe(403);

    // Teacher login works and cannot hit team routes
    const teacherLogin = await requestJson('/api/auth/teacher/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'teacher@quiztopia.edu', password: 'Quiztopia2026!' }),
    });
    expect(teacherLogin.status).toBe(200);
    expect(teacherLogin.setCookie).toBeTruthy();
    teacherCookie = teacherLogin.setCookie!;

    const teacherHitsTeam = await requestJson('/api/team/dashboard', {
      cookie: teacherCookie,
    });
    expect(teacherHitsTeam.status).toBe(403);
  }, 20000);

  it('enforces 2-4 member validation when creating teams and provisions shared team account', async () => {
    const clsRes = await requestJson('/api/teacher/classes', {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({
        name: `Test Class ${Date.now()}`,
        gradeLevel: 'Grade 4',
        academicYearLabel: '2026-2027',
      }),
    });
    expect(clsRes.status).toBe(201);
    testClassId = clsRes.data.id;
    cleanupClassIds.push(testClassId);

    // 1 member must be rejected
    const tooSmall = await requestJson('/api/teacher/teams', {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({
        classId: testClassId,
        name: 'Solo Squad',
        members: ['OnlyOne'],
      }),
    });
    expect(tooSmall.status).toBe(400);

    // 5 members must be rejected
    const tooLarge = await requestJson('/api/teacher/teams', {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({
        classId: testClassId,
        name: 'Crowd Squad',
        members: ['A', 'B', 'C', 'D', 'E'],
      }),
    });
    expect(tooLarge.status).toBe(400);

    // 3 members succeeds
    const suffix = crypto.randomBytes(3).toString('hex');
    const validTeam = await requestJson('/api/teacher/teams', {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({
        classId: testClassId,
        name: `Test Voyagers ${suffix}`,
        members: ['Aria', 'Bram', 'Cora'],
        captainIndex: 1,
        username: `voyager_${suffix}`,
        password: 'pass1234',
      }),
    });
    expect(validTeam.status).toBe(201);
    testTeamId = validTeam.data.team.id;
    testTeamUsername = validTeam.data.team.username;
    testTeamPassword = validTeam.data.team.generatedPassword;
    cleanupTeamIds.push(testTeamId);

    // Log in as the newly created team
    const tLogin = await requestJson('/api/auth/team/login', {
      method: 'POST',
      body: JSON.stringify({ username: testTeamUsername, password: testTeamPassword }),
    });
    expect(tLogin.status).toBe(200);
    testTeamCookie = tLogin.setCookie!;
  }, 20000);

  it('runs server-authoritative live quiz, blocks duplicate/expired submissions, and awards coins', async () => {
    const qRes = await requestJson('/api/teacher/quizzes', {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({
        classId: testClassId,
        termNumber: 1,
        title: 'Test Science Sprint',
        subject: 'Science',
        description: 'Automated test quiz',
        status: 'published',
        speedBonusEnabled: true,
        questions: [
          {
            id: 'q1',
            orderIndex: 0,
            questionType: 'multiple_choice',
            prompt: 'Which star is at the center of our solar system?',
            points: 100,
            timeLimitSec: 30,
            options: [
              { id: 'opt_sun', label: 'The Sun', isCorrect: true },
              { id: 'opt_mars', label: 'Mars', isCorrect: false },
            ],
          },
        ],
      }),
    });
    expect(qRes.status).toBe(201);
    const quizId = qRes.data.quiz.id;
    cleanupQuizIds.push(quizId);

    const hostRes = await requestJson('/api/teacher/sessions', {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({ quizId }),
    });
    expect(hostRes.status).toBe(201);
    const { sessionId, pinCode } = hostRes.data;
    cleanupSessionIds.push(sessionId);

    // Team joins by PIN
    const joinRes = await requestJson('/api/team/quiz/join', {
      method: 'POST',
      cookie: testTeamCookie,
      body: JSON.stringify({ pinCode }),
    });
    expect(joinRes.status).toBe(200);
    expect(joinRes.data.alreadyJoined).toBe(false);

    // Duplicate join is idempotent
    const joinAgain = await requestJson('/api/team/quiz/join', {
      method: 'POST',
      cookie: testTeamCookie,
      body: JSON.stringify({ pinCode }),
    });
    expect(joinAgain.status).toBe(200);
    expect(joinAgain.data.alreadyJoined).toBe(true);

    // Teacher starts quiz
    const startRes = await requestJson(`/api/teacher/sessions/${sessionId}/control`, {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({ action: 'start' }),
    });
    expect(startRes.status).toBe(200);

    // Verify team does NOT receive isCorrect during active question
    const teamStateRes = await requestJson(`/api/team/quiz/sessions/${sessionId}`, {
      cookie: testTeamCookie,
    });
    expect(teamStateRes.status).toBe(200);
    expect(teamStateRes.data.state.currentQuestion.options[0].isCorrect).toBeUndefined();

    // Team submits correct answer
    const sub1 = await requestJson(`/api/team/quiz/sessions/${sessionId}/submit`, {
      method: 'POST',
      cookie: testTeamCookie,
      body: JSON.stringify({ questionId: 'q1', optionId: 'opt_sun' }),
    });
    expect(sub1.status).toBe(200);
    expect(sub1.data.accepted).toBe(true);

    // Duplicate submission for same question must fail with 409
    const subDup = await requestJson(`/api/team/quiz/sessions/${sessionId}/submit`, {
      method: 'POST',
      cookie: testTeamCookie,
      body: JSON.stringify({ questionId: 'q1', optionId: 'opt_mars' }),
    });
    expect(subDup.status).toBe(409);

    // Force question deadline into past & verify late submission is rejected
    await adminDb.collection('quiz_sessions').doc(sessionId).update({
      questionEndsAt: Date.now() - 5000,
    });
    const subLate = await requestJson(`/api/team/quiz/sessions/${sessionId}/submit`, {
      method: 'POST',
      cookie: testTeamCookie,
      body: JSON.stringify({ questionId: 'q1', optionId: 'opt_sun' }),
    });
    expect(subLate.status).toBe(400);

    // Finish session & verify coins credited
    const finishRes = await requestJson(`/api/teacher/sessions/${sessionId}/control`, {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({ action: 'end' }),
    });
    expect(finishRes.status).toBe(200);
    expect(finishRes.data.state.status).toBe('finished');
    expect(finishRes.data.state.results[0].coinsAwarded).toBeGreaterThan(0);
  }, 25000);

  it('prevents insufficient-funds & duplicate-idempotency creature purchases, and preserves lifetime assets on term reset', async () => {
    // Award 300 coins so team has 300 coins
    const awardRes = await requestJson(`/api/teacher/teams/${testTeamId}/award-coins`, {
      method: 'POST',
      cookie: teacherCookie,
      body: JSON.stringify({ amount: 300, reason: 'Test coin grant' }),
    });
    expect(awardRes.status).toBe(200);

    // Try purchasing Astral Dragon (1500 coins) -> must fail with 400
    const tooExpensive = await requestJson('/api/team/shop/buy-creature', {
      method: 'POST',
      cookie: testTeamCookie,
      body: JSON.stringify({
        creatureId: 'creature_astral_dragon',
        idempotencyKey: `tx_fail_${Date.now()}`,
      }),
    });
    expect(tooExpensive.status).toBe(400);

    // Purchase Lumibun (200 coins) with idempotency key
    const idemKey = `tx_ok_${Date.now()}`;
    const buyOk = await requestJson('/api/team/shop/buy-creature', {
      method: 'POST',
      cookie: testTeamCookie,
      body: JSON.stringify({
        creatureId: 'creature_lumibun',
        idempotencyKey: idemKey,
      }),
    });
    expect(buyOk.status).toBe(200);
    const balanceAfterBuy = buyOk.data.newBalance;
    expect(buyOk.data.islandPower).toBeGreaterThan(0);

    // Replay same idempotencyKey -> must be rejected with 409
    const buyReplay = await requestJson('/api/team/shop/buy-creature', {
      method: 'POST',
      cookie: testTeamCookie,
      body: JSON.stringify({
        creatureId: 'creature_lumibun',
        idempotencyKey: idemKey,
      }),
    });
    expect(buyReplay.status).toBe(409);

    // Close Term 1 & advance to Term 2
    const closeRes = await requestJson(`/api/teacher/classes/${testClassId}/terms/close-and-advance`, {
      method: 'POST',
      cookie: teacherCookie,
    });
    expect(closeRes.status).toBe(200);
    expect(closeRes.data.closedTermNumber).toBe(1);
    expect(closeRes.data.nextTermNumber).toBe(2);

    // Verify Term 2 resets termPower to 0 while preserving lifetimePower, coins, creatures, and achievements
    const dashAfterReset = await requestJson('/api/team/dashboard', {
      cookie: testTeamCookie,
    });
    expect(dashAfterReset.status).toBe(200);
    expect(dashAfterReset.data.classroom.activeTermNumber).toBe(2);
    expect(dashAfterReset.data.team.coins).toBe(balanceAfterBuy);
    expect(dashAfterReset.data.team.island.termPower).toBe(0);
    expect(dashAfterReset.data.team.island.lifetimePower).toBeGreaterThan(0);

    const colAfterReset = await requestJson('/api/team/collection', {
      cookie: testTeamCookie,
    });
    expect(colAfterReset.status).toBe(200);
    expect(colAfterReset.data.creatures.length).toBeGreaterThan(0);
    expect(colAfterReset.data.transactions.length).toBeGreaterThan(0);

    const lbAfterReset = await requestJson('/api/team/leaderboards', {
      cookie: testTeamCookie,
    });
    expect(lbAfterReset.status).toBe(200);
    expect(lbAfterReset.data.previousTerms.length).toBeGreaterThan(0);
    expect(lbAfterReset.data.previousTerms[0].isChampion).toBe(true);
  }, 25000);
});
