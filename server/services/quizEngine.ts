import crypto from 'node:crypto';
import type { WebSocket, WebSocketServer } from 'ws';
import { adminDb } from '../firebase.ts';
import { calculateQuestionScore, calculateQuizCoins } from '../../shared/gameLogic.ts';
import type {
  AuthSessionUser,
  AvatarConfig,
  Quiz,
  QuizResultEntry,
  QuizSessionParticipant,
  QuizSessionPublicState,
} from '../../shared/types.ts';
import { awardCoins, evaluateTeamAchievements, getGameRules } from './economy.ts';

interface ConnectedClient {
  ws: WebSocket;
  user: AuthSessionUser;
  sessionId: string;
}

const roomClients = new Map<string, Set<ConnectedClient>>();
const questionTimers = new Map<string, NodeJS.Timeout>();

export function registerQuizClient(sessionId: string, ws: WebSocket, user: AuthSessionUser): void {
  const entry: ConnectedClient = { ws, user, sessionId };
  if (!roomClients.has(sessionId)) {
    roomClients.set(sessionId, new Set());
  }
  roomClients.get(sessionId)!.add(entry);

  ws.on('close', () => {
    roomClients.get(sessionId)?.delete(entry);
  });

  // Immediately push authoritative current state upon connect/reconnect
  buildSessionStateForUser(sessionId, user)
    .then((state) => {
      if (state && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'quiz:state', payload: state }));
      }
    })
    .catch((err) => {
      console.error('Failed to send initial quiz state:', err);
    });
}

export async function broadcastSessionState(sessionId: string): Promise<void> {
  const clients = roomClients.get(sessionId);
  if (!clients || clients.size === 0) return;

  for (const client of clients) {
    if (client.ws.readyState !== client.ws.OPEN) continue;
    try {
      const state = await buildSessionStateForUser(sessionId, client.user);
      if (state) {
        client.ws.send(JSON.stringify({ type: 'quiz:state', payload: state }));
      }
    } catch (err) {
      console.error('Failed to broadcast quiz state:', err);
    }
  }
}

export function attachQuizWebSocketServer(wss: WebSocketServer): void {
  // Periodically ping clients to keep classroom tablet connections alive
  setInterval(() => {
    for (const clients of roomClients.values()) {
      for (const client of clients) {
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.ping();
        }
      }
    }
  }, 25000);
}

function scheduleQuestionTimer(sessionId: string, endsAt: number): void {
  const existing = questionTimers.get(sessionId);
  if (existing) clearTimeout(existing);

  const delay = Math.max(0, endsAt - Date.now() + 250);
  const timer = setTimeout(async () => {
    questionTimers.delete(sessionId);
    try {
      const snap = await adminDb.collection('quiz_sessions').doc(sessionId).get();
      if (!snap.exists) return;
      const data = snap.data()!;
      if (data.status === 'active' && !data.questionRevealed && data.questionEndsAt <= Date.now()) {
        await adminDb.collection('quiz_sessions').doc(sessionId).update({
          questionRevealed: true,
        });
        await broadcastSessionState(sessionId);
      }
    } catch (err) {
      console.error('Auto-reveal timer error:', err);
    }
  }, delay);

  questionTimers.set(sessionId, timer);
}

export async function createQuizSession(params: {
  quizId: string;
  teacherId: string;
}): Promise<{ sessionId: string; pinCode: string }> {
  const quizSnap = await adminDb.collection('quizzes').doc(params.quizId).get();
  if (!quizSnap.exists) {
    throw new Error('NOT_FOUND: Quiz not found.');
  }
  const quiz = quizSnap.data() as Quiz;
  if (quiz.teacherId !== params.teacherId) {
    throw new Error('FORBIDDEN: You do not own this quiz.');
  }
  if (quiz.status !== 'published') {
    throw new Error('BAD_REQUEST: Publish the quiz before hosting a live competition.');
  }
  if (!quiz.questions || quiz.questions.length === 0) {
    throw new Error('BAD_REQUEST: Add at least one question before hosting.');
  }

  // Generate unique 6-digit PIN
  let pinCode = '';
  for (let i = 0; i < 6; i++) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    const existingPin = await adminDb
      .collection('quiz_sessions')
      .where('pinCode', '==', candidate)
      .where('status', 'in', ['lobby', 'active'])
      .get();
    if (existingPin.empty) {
      pinCode = candidate;
      break;
    }
  }
  if (!pinCode) pinCode = String(Math.floor(100000 + Math.random() * 900000));

  const sessionId = `sess_${crypto.randomUUID().slice(0, 12)}`;
  const nowIso = new Date().toISOString();

  await adminDb.collection('quiz_sessions').doc(sessionId).set({
    id: sessionId,
    quizId: quiz.id,
    quizTitle: quiz.title,
    subject: quiz.subject,
    classId: quiz.classId,
    teacherId: params.teacherId,
    termNumber: quiz.termNumber,
    speedBonusEnabled: Boolean(quiz.speedBonusEnabled),
    pinCode,
    status: 'lobby',
    currentQuestionIndex: -1,
    totalQuestions: quiz.questions.length,
    questionStartedAt: null,
    questionEndsAt: null,
    questionRevealed: false,
    createdAt: nowIso,
  });

  return { sessionId, pinCode };
}

export async function joinSessionByPin(params: {
  pinCode: string;
  teamId: string;
  classId: string;
}): Promise<{ sessionId: string; alreadyJoined: boolean }> {
  const cleanPin = params.pinCode.trim();
  const snap = await adminDb
    .collection('quiz_sessions')
    .where('pinCode', '==', cleanPin)
    .where('status', 'in', ['lobby', 'active'])
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error('NOT_FOUND: No active quiz lobby found with that PIN.');
  }

  const sessionDoc = snap.docs[0];
  const session = sessionDoc.data();

  if (session.classId !== params.classId) {
    throw new Error('FORBIDDEN: This quiz belongs to a different classroom.');
  }

  return joinSessionById({ sessionId: sessionDoc.id, teamId: params.teamId, classId: params.classId });
}

export async function joinSessionById(params: {
  sessionId: string;
  teamId: string;
  classId: string;
}): Promise<{ sessionId: string; alreadyJoined: boolean }> {
  const sessionRef = adminDb.collection('quiz_sessions').doc(params.sessionId);
  const participantId = `${params.sessionId}_${params.teamId}`;
  const participantRef = adminDb.collection('quiz_participants').doc(participantId);
  const teamRef = adminDb.collection('teams').doc(params.teamId);
  const avatarRef = adminDb.collection('team_avatars').doc(params.teamId);

  const outcome = await adminDb.runTransaction(async (tx) => {
    const [sessionSnap, partSnap, teamSnap, avatarSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(participantRef),
      tx.get(teamRef),
      tx.get(avatarRef),
    ]);

    if (!sessionSnap.exists) {
      throw new Error('NOT_FOUND: Quiz session not found.');
    }
    const session = sessionSnap.data()!;
    if (session.status === 'finished') {
      throw new Error('BAD_REQUEST: This quiz has already ended.');
    }
    if (session.classId !== params.classId) {
      throw new Error('FORBIDDEN: This quiz belongs to a different classroom.');
    }
    if (!teamSnap.exists) {
      throw new Error('NOT_FOUND: Team not found.');
    }

    if (partSnap.exists) {
      return { alreadyJoined: true };
    }

    const teamData = teamSnap.data()!;
    const avatarData = (avatarSnap.exists ? avatarSnap.data() : {}) as AvatarConfig;

    tx.set(participantRef, {
      id: participantId,
      sessionId: params.sessionId,
      teamId: params.teamId,
      teamName: teamData.name,
      avatar: avatarData,
      score: 0,
      correctCount: 0,
      joinedAt: new Date().toISOString(),
    });

    return { alreadyJoined: false };
  });

  await broadcastSessionState(params.sessionId);
  return { sessionId: params.sessionId, alreadyJoined: outcome.alreadyJoined };
}

export async function startOrAdvanceSession(params: {
  sessionId: string;
  teacherId: string;
  action: 'start' | 'next' | 'reveal' | 'end';
}): Promise<QuizSessionPublicState | null> {
  const sessionRef = adminDb.collection('quiz_sessions').doc(params.sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error('NOT_FOUND: Session not found.');
  const session = sessionSnap.data()!;
  if (session.teacherId !== params.teacherId) throw new Error('FORBIDDEN: Not session host.');

  const quizSnap = await adminDb.collection('quizzes').doc(session.quizId).get();
  if (!quizSnap.exists) throw new Error('NOT_FOUND: Quiz not found.');
  const quiz = quizSnap.data() as Quiz;
  const sortedQuestions = [...quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);

  if (params.action === 'start') {
    if (session.status !== 'lobby') {
      throw new Error('BAD_REQUEST: Quiz has already started.');
    }
    const q0 = sortedQuestions[0];
    const startedAt = Date.now();
    const endsAt = startedAt + q0.timeLimitSec * 1000;
    await sessionRef.update({
      status: 'active',
      currentQuestionIndex: 0,
      questionStartedAt: startedAt,
      questionEndsAt: endsAt,
      questionRevealed: false,
    });
    scheduleQuestionTimer(params.sessionId, endsAt);
  } else if (params.action === 'reveal') {
    if (session.status !== 'active') throw new Error('BAD_REQUEST: Quiz is not active.');
    const timer = questionTimers.get(params.sessionId);
    if (timer) {
      clearTimeout(timer);
      questionTimers.delete(params.sessionId);
    }
    await sessionRef.update({ questionRevealed: true });
  } else if (params.action === 'next') {
    if (session.status !== 'active') throw new Error('BAD_REQUEST: Quiz is not active.');
    const nextIdx = Number(session.currentQuestionIndex) + 1;
    if (nextIdx >= sortedQuestions.length) {
      return finishQuizSession(params.sessionId);
    }
    const nextQ = sortedQuestions[nextIdx];
    const startedAt = Date.now();
    const endsAt = startedAt + nextQ.timeLimitSec * 1000;
    await sessionRef.update({
      currentQuestionIndex: nextIdx,
      questionStartedAt: startedAt,
      questionEndsAt: endsAt,
      questionRevealed: false,
    });
    scheduleQuestionTimer(params.sessionId, endsAt);
  } else if (params.action === 'end') {
    return finishQuizSession(params.sessionId);
  }

  await broadcastSessionState(params.sessionId);
  return buildSessionStateForUser(params.sessionId, {
    role: 'teacher',
    uid: params.teacherId,
    displayName: 'Teacher',
  });
}

export async function finishQuizSession(sessionId: string): Promise<QuizSessionPublicState | null> {
  const timer = questionTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    questionTimers.delete(sessionId);
  }

  const sessionRef = adminDb.collection('quiz_sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error('NOT_FOUND: Session not found.');
  const session = sessionSnap.data()!;

  const participantsSnap = await adminDb
    .collection('quiz_participants')
    .where('sessionId', '==', sessionId)
    .get();

  const rules = await getGameRules();
  const participants = participantsSnap.docs.map((d) => d.data() as QuizSessionParticipant);
  participants.sort((a, b) => b.score - a.score || b.correctCount - a.correctCount);

  const nowIso = new Date().toISOString();
  const totalQuestions = Number(session.totalQuestions || 0);

  // Assign ranks (handling ties fairly)
  let currentRank = 1;
  for (let i = 0; i < participants.length; i++) {
    if (i > 0 && participants[i].score < participants[i - 1].score) {
      currentRank = i + 1;
    }
    const p = participants[i];
    const coinsAwarded = calculateQuizCoins({
      rank: currentRank,
      correctCount: p.correctCount,
      rules,
    });

    const resultId = `${sessionId}_${p.teamId}`;
    await adminDb.collection('quiz_results').doc(resultId).set(
      {
        id: resultId,
        sessionId,
        quizId: session.quizId,
        quizTitle: session.quizTitle,
        subject: session.subject,
        classId: session.classId,
        termNumber: session.termNumber,
        teamId: p.teamId,
        teamName: p.teamName,
        avatar: p.avatar,
        rank: currentRank,
        correctCount: p.correctCount,
        totalQuestions,
        totalScore: p.score,
        coinsAwarded,
        finishedAt: nowIso,
      },
      { merge: true }
    );

    if (coinsAwarded > 0) {
      await awardCoins({
        teamId: p.teamId,
        amount: coinsAwarded,
        txType: 'quiz_reward',
        reason: `Quiz Reward: ${session.quizTitle} (Rank #${currentRank})`,
        referenceId: sessionId,
        idempotencyKey: `quiz_reward_${sessionId}_${p.teamId}`,
      });
    }

    await evaluateTeamAchievements(p.teamId);
  }

  await sessionRef.update({
    status: 'finished',
    questionRevealed: true,
    finishedAt: nowIso,
  });

  await broadcastSessionState(sessionId);
  return buildSessionStateForUser(sessionId, {
    role: 'teacher',
    uid: session.teacherId,
    displayName: 'Teacher',
  });
}

export async function submitTeamAnswer(params: {
  sessionId: string;
  teamId: string;
  questionId: string;
  optionId: string;
}): Promise<{
  accepted: boolean;
  submittedAt: number;
  message: string;
}> {
  const submittedAt = Date.now();
  const sessionRef = adminDb.collection('quiz_sessions').doc(params.sessionId);
  const participantRef = adminDb.collection('quiz_participants').doc(`${params.sessionId}_${params.teamId}`);
  const answerDocId = `${params.sessionId}_${params.questionId}_${params.teamId}`;
  const answerRef = adminDb.collection('team_answers').doc(answerDocId);

  const sessionPreSnap = await sessionRef.get();
  if (!sessionPreSnap.exists) {
    throw new Error('NOT_FOUND: Quiz session not found.');
  }
  const quizSnap = await adminDb.collection('quizzes').doc(sessionPreSnap.data()!.quizId).get();
  if (!quizSnap.exists) {
    throw new Error('NOT_FOUND: Quiz definition missing.');
  }
  const quiz = quizSnap.data() as Quiz;
  const sortedQuestions = [...quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);

  await adminDb.runTransaction(async (tx) => {
    const [sessionSnap, partSnap, existingAnswerSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(participantRef),
      tx.get(answerRef),
    ]);

    if (!sessionSnap.exists) {
      throw new Error('NOT_FOUND: Quiz session not found.');
    }
    if (!partSnap.exists) {
      throw new Error('FORBIDDEN: Your team has not joined this quiz session.');
    }

    const session = sessionSnap.data()!;
    if (session.status !== 'active') {
      throw new Error('BAD_REQUEST: Quiz is not currently active.');
    }
    if (session.questionRevealed) {
      throw new Error('BAD_REQUEST: Submissions are closed for this question.');
    }

    const activeQ = sortedQuestions[Number(session.currentQuestionIndex)];
    if (!activeQ || activeQ.id !== params.questionId) {
      throw new Error('BAD_REQUEST: That question is not currently active.');
    }

    if (!session.questionEndsAt || submittedAt > Number(session.questionEndsAt)) {
      throw new Error('BAD_REQUEST: Time has expired for this question.');
    }

    if (existingAnswerSnap.exists) {
      throw new Error('CONFLICT: Your team has already locked in an answer for this question.');
    }

    const chosenOption = activeQ.options.find((o) => o.id === params.optionId);
    if (!chosenOption) {
      throw new Error('BAD_REQUEST: Selected option does not belong to this question.');
    }

    const isCorrect = Boolean(chosenOption.isCorrect);
    const pointsAwarded = calculateQuestionScore({
      isCorrect,
      basePoints: activeQ.points,
      speedBonusEnabled: Boolean(session.speedBonusEnabled),
      questionStartedAt: Number(session.questionStartedAt),
      questionEndsAt: Number(session.questionEndsAt),
      submittedAt,
    });

    tx.set(answerRef, {
      id: answerDocId,
      sessionId: params.sessionId,
      questionId: params.questionId,
      teamId: params.teamId,
      optionId: params.optionId,
      isCorrect,
      pointsAwarded,
      submittedAt,
    });

    const pData = partSnap.data()!;
    tx.update(participantRef, {
      score: Number(pData.score || 0) + pointsAwarded,
      correctCount: Number(pData.correctCount || 0) + (isCorrect ? 1 : 0),
    });
  });

  await broadcastSessionState(params.sessionId);
  return {
    accepted: true,
    submittedAt,
    message: 'Answer locked in!',
  };
}

export async function buildSessionStateForUser(
  sessionId: string,
  user: AuthSessionUser
): Promise<QuizSessionPublicState | null> {
  const sessionSnap = await adminDb.collection('quiz_sessions').doc(sessionId).get();
  if (!sessionSnap.exists) return null;
  const session = sessionSnap.data()!;

  const [quizSnap, partsSnap] = await Promise.all([
    adminDb.collection('quizzes').doc(session.quizId).get(),
    adminDb.collection('quiz_participants').where('sessionId', '==', sessionId).get(),
  ]);

  if (!quizSnap.exists) return null;
  const quiz = quizSnap.data() as Quiz;
  const sortedQuestions = [...quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentQ =
    session.status === 'active' && Number(session.currentQuestionIndex) >= 0
      ? sortedQuestions[Number(session.currentQuestionIndex)] ?? null
      : null;

  const isRevealed = Boolean(session.questionRevealed) || (session.questionEndsAt && Date.now() > Number(session.questionEndsAt));

  // Query answers for active question to mark submission status
  let answeredTeams = new Set<string>();
  let mySubmission: QuizSessionPublicState['mySubmission'] = null;

  if (currentQ) {
    const answersSnap = await adminDb
      .collection('team_answers')
      .where('sessionId', '==', sessionId)
      .where('questionId', '==', currentQ.id)
      .get();

    for (const doc of answersSnap.docs) {
      const ans = doc.data();
      answeredTeams.add(ans.teamId as string);
      if (user.role === 'team' && ans.teamId === user.teamId) {
        mySubmission = {
          questionId: currentQ.id,
          optionId: ans.optionId as string,
          submittedAt: Number(ans.submittedAt),
          ...(isRevealed
            ? {
                isCorrect: Boolean(ans.isCorrect),
                pointsAwarded: Number(ans.pointsAwarded),
              }
            : {}),
        };
      }
    }
  }

  const participants: QuizSessionParticipant[] = partsSnap.docs
    .map((d) => {
      const p = d.data() as QuizSessionParticipant;
      return {
        ...p,
        hasAnsweredCurrent: answeredTeams.has(p.teamId),
      };
    })
    .sort((a, b) => b.score - a.score);

  let results: QuizResultEntry[] | undefined;
  if (session.status === 'finished') {
    const resSnap = await adminDb.collection('quiz_results').where('sessionId', '==', sessionId).get();
    results = resSnap.docs
      .map((d) => d.data() as QuizResultEntry)
      .sort((a, b) => a.rank - b.rank);
  }

  const showCorrectToUser = user.role === 'teacher' || isRevealed;

  return {
    id: session.id,
    quizId: session.quizId,
    quizTitle: session.quizTitle,
    subject: session.subject,
    classId: session.classId,
    termNumber: session.termNumber,
    pinCode: session.pinCode,
    status: session.status,
    currentQuestionIndex: Number(session.currentQuestionIndex),
    totalQuestions: sortedQuestions.length,
    questionStartedAt: session.questionStartedAt ? Number(session.questionStartedAt) : null,
    questionEndsAt: session.questionEndsAt ? Number(session.questionEndsAt) : null,
    questionRevealed: Boolean(isRevealed),
    speedBonusEnabled: Boolean(session.speedBonusEnabled),
    serverNow: Date.now(),
    currentQuestion: currentQ
      ? {
          id: currentQ.id,
          prompt: currentQ.prompt,
          points: currentQ.points,
          timeLimitSec: currentQ.timeLimitSec,
          options: currentQ.options.map((o) => ({
            id: o.id,
            label: o.label,
            ...(showCorrectToUser ? { isCorrect: Boolean(o.isCorrect) } : {}),
          })),
        }
      : null,
    participants,
    mySubmission,
    results,
  };
}
