import crypto from 'node:crypto';
import { Router } from 'express';
import { adminDb } from '../firebase.ts';
import { hashPassword, requireTeacher, type AuthedRequest } from '../auth.ts';
import { ensureSeeded } from '../seed.ts';
import { DEFAULT_AVATAR, DEFAULT_GAME_RULES, validateTeamMembers } from '../../shared/gameLogic.ts';
import type {
  AcademicTerm,
  AvatarConfig,
  CatalogItem,
  Creature,
  GameRulesConfig,
  Quiz,
  QuizQuestion,
  QuizResultEntry,
  TermRankingEntry,
} from '../../shared/types.ts';
import {
  awardCoins,
  evaluateTeamAchievements,
  getGameRules,
  recalculateTeamIslandPower,
} from '../services/economy.ts';
import {
  buildSessionStateForUser,
  createQuizSession,
  startOrAdvanceSession,
} from '../services/quizEngine.ts';

export const teacherRouter = Router();
teacherRouter.use(requireTeacher);

teacherRouter.get('/overview', async (req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser!.uid;

    const [classesSnap, teamsSnap, quizzesSnap, sessionsSnap] = await Promise.all([
      adminDb.collection('classes').where('teacherId', '==', teacherId).get(),
      adminDb.collection('teams').where('teacherId', '==', teacherId).get(),
      adminDb.collection('quizzes').where('teacherId', '==', teacherId).get(),
      adminDb.collection('quiz_sessions').where('teacherId', '==', teacherId).get(),
    ]);

    const classes = classesSnap.docs.map((d) => d.data());
    const activeClass = classes[0] || null;
    const quizzes = quizzesSnap.docs.map((d) => d.data() as Quiz);
    const quizzesThisTerm = activeClass
      ? quizzes.filter((q) => q.classId === activeClass.id && q.termNumber === activeClass.activeTermNumber).length
      : quizzes.length;

    const recentSessions = sessionsSnap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 6);

    res.json({
      stats: {
        totalClasses: classes.length,
        totalTeams: teamsSnap.size,
        totalQuizzes: quizzes.length,
        quizzesThisTerm,
        activeTermNumber: activeClass?.activeTermNumber ?? 1,
        academicYearLabel: activeClass?.academicYearLabel ?? '2026-2027',
      },
      classes,
      recentSessions,
    });
  } catch (err) {
    console.error('Teacher overview failed:', err);
    res.status(500).json({ error: 'Unable to load teacher overview.' });
  }
});

// ==================== CLASSES & TERMS ====================

teacherRouter.get('/classes', async (req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser!.uid;
    const [classesSnap, teamsSnap, termsSnap] = await Promise.all([
      adminDb.collection('classes').where('teacherId', '==', teacherId).get(),
      adminDb.collection('teams').where('teacherId', '==', teacherId).get(),
      adminDb.collection('academic_terms').get(),
    ]);

    const teamCounts: Record<string, number> = {};
    for (const d of teamsSnap.docs) {
      const cid = d.data().classId as string;
      teamCounts[cid] = (teamCounts[cid] || 0) + 1;
    }

    const termsByClass = new Map<string, AcademicTerm[]>();
    for (const d of termsSnap.docs) {
      const term = d.data() as AcademicTerm;
      if (!termsByClass.has(term.classId)) termsByClass.set(term.classId, []);
      termsByClass.get(term.classId)!.push(term);
    }

    const classes = classesSnap.docs.map((d) => {
      const c = d.data();
      const terms = (termsByClass.get(c.id) || []).sort((a, b) => a.termNumber - b.termNumber);
      return {
        ...c,
        teamCount: teamCounts[c.id] || 0,
        terms,
      };
    });

    res.json({ classes });
  } catch (err) {
    console.error('Get classes failed:', err);
    res.status(500).json({ error: 'Unable to load classes.' });
  }
});

teacherRouter.post('/classes', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const name = String(req.body?.name || '').trim();
    const gradeLevel = String(req.body?.gradeLevel || '').trim();
    const academicYearLabel = String(req.body?.academicYearLabel || '2026-2027').trim();

    if (!name || !gradeLevel || !academicYearLabel) {
      res.status(400).json({ error: 'Class name, grade level, and academic year are required.' });
      return;
    }

    const classId = `class_${crypto.randomUUID().slice(0, 10)}`;
    const nowIso = new Date().toISOString();

    await adminDb.collection('classes').doc(classId).set({
      id: classId,
      teacherId,
      name,
      gradeLevel,
      academicYearLabel,
      activeTermNumber: 1,
      createdAt: nowIso,
    });

    for (const termNum of [1, 2, 3] as const) {
      const termId = `${classId}_term_${termNum}`;
      await adminDb.collection('academic_terms').doc(termId).set({
        id: termId,
        classId,
        academicYearLabel,
        termNumber: termNum,
        name: `Term ${termNum}`,
        status: termNum === 1 ? 'active' : 'upcoming',
      });
    }

    res.status(201).json({ id: classId });
  } catch (err) {
    console.error('Create class failed:', err);
    res.status(500).json({ error: 'Unable to create class.' });
  }
});

teacherRouter.put('/classes/:id', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const classId = String(req.params.id);
    const ref = adminDb.collection('classes').doc(classId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Class not found.' });
      return;
    }

    const name = String(req.body?.name || snap.data()!.name).trim();
    const gradeLevel = String(req.body?.gradeLevel || snap.data()!.gradeLevel).trim();
    const academicYearLabel = String(req.body?.academicYearLabel || snap.data()!.academicYearLabel).trim();

    await ref.update({ name, gradeLevel, academicYearLabel });
    res.json({ ok: true });
  } catch (err) {
    console.error('Update class failed:', err);
    res.status(500).json({ error: 'Unable to update class.' });
  }
});

teacherRouter.post('/classes/:id/terms/activate', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const classId = String(req.params.id);
    const termNumber = Number(req.body?.termNumber) as 1 | 2 | 3;
    if (![1, 2, 3].includes(termNumber)) {
      res.status(400).json({ error: 'Term number must be 1, 2, or 3.' });
      return;
    }

    const classRef = adminDb.collection('classes').doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists || classSnap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Class not found.' });
      return;
    }

    await classRef.update({ activeTermNumber: termNumber });
    for (const n of [1, 2, 3] as const) {
      const termId = `${classId}_term_${n}`;
      const termRef = adminDb.collection('academic_terms').doc(termId);
      const tSnap = await termRef.get();
      const prevStatus = tSnap.exists ? tSnap.data()!.status : 'upcoming';
      const nextStatus = n === termNumber ? 'active' : prevStatus === 'closed' ? 'closed' : 'upcoming';
      await termRef.set(
        {
          id: termId,
          classId,
          academicYearLabel: classSnap.data()!.academicYearLabel,
          termNumber: n,
          name: `Term ${n}`,
          status: nextStatus,
        },
        { merge: true }
      );
    }

    res.json({ activeTermNumber: termNumber });
  } catch (err) {
    console.error('Activate term failed:', err);
    res.status(500).json({ error: 'Unable to activate term.' });
  }
});

teacherRouter.post('/classes/:id/terms/close-and-advance', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const classId = String(req.params.id);
    const classRef = adminDb.collection('classes').doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists || classSnap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Class not found.' });
      return;
    }

    const cls = classSnap.data()!;
    const currentTermNum = Number(cls.activeTermNumber) as 1 | 2 | 3;
    const currentTermId = `${classId}_term_${currentTermNum}`;

    // 1. Snapshot all teams in class and finalize rankings for this term
    const teamsSnap = await adminDb.collection('teams').where('classId', '==', classId).get();
    const standings = await Promise.all(
      teamsSnap.docs.map(async (d) => {
        const [islandSnap, avatarSnap] = await Promise.all([
          adminDb.collection('team_islands').doc(d.id).get(),
          adminDb.collection('team_avatars').doc(d.id).get(),
        ]);
        const island = islandSnap.exists ? islandSnap.data()! : {};
        return {
          teamId: d.id,
          teamName: d.data().name as string,
          avatar: (avatarSnap.exists ? avatarSnap.data() : DEFAULT_AVATAR) as AvatarConfig,
          termPower: Number(island.termPower ?? 0),
          lifetimePower: Number(island.lifetimePower ?? 0),
        };
      })
    );

    standings.sort((a, b) => b.termPower - a.termPower);
    const nowIso = new Date().toISOString();

    let rank = 1;
    const archivedEntries: TermRankingEntry[] = [];
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].termPower < standings[i - 1].termPower) {
        rank = i + 1;
      }
      const s = standings[i];
      const rankDocId = `${currentTermId}_${s.teamId}`;
      const entry: TermRankingEntry = {
        id: rankDocId,
        termId: currentTermId,
        classId,
        academicYearLabel: cls.academicYearLabel,
        termNumber: currentTermNum,
        teamId: s.teamId,
        teamName: s.teamName,
        avatar: s.avatar,
        finalIslandPower: s.termPower,
        finalRank: rank,
        isChampion: rank === 1,
        archivedAt: nowIso,
      };
      archivedEntries.push(entry);
      await adminDb.collection('term_rankings').doc(rankDocId).set(entry, { merge: true });

      // Reset term-competitive island power while preserving lifetimePower, creatures, buildings, achievements!
      await adminDb.collection('team_islands').doc(s.teamId).set(
        {
          termPower: 0,
          seasonBaselinePower: s.lifetimePower,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }

    await adminDb.collection('academic_terms').doc(currentTermId).set(
      {
        id: currentTermId,
        classId,
        academicYearLabel: cls.academicYearLabel,
        termNumber: currentTermNum,
        name: `Term ${currentTermNum}`,
        status: 'closed',
        closedAt: nowIso,
      },
      { merge: true }
    );

    const nextTermNum = currentTermNum < 3 ? ((currentTermNum + 1) as 1 | 2 | 3) : 3;
    if (currentTermNum < 3) {
      const nextTermId = `${classId}_term_${nextTermNum}`;
      await adminDb.collection('academic_terms').doc(nextTermId).set(
        {
          id: nextTermId,
          classId,
          academicYearLabel: cls.academicYearLabel,
          termNumber: nextTermNum,
          name: `Term ${nextTermNum}`,
          status: 'active',
        },
        { merge: true }
      );
      await classRef.update({ activeTermNumber: nextTermNum });
    }

    res.json({
      closedTermNumber: currentTermNum,
      nextTermNumber: currentTermNum < 3 ? nextTermNum : null,
      archivedEntries,
    });
  } catch (err) {
    console.error('Close & advance term failed:', err);
    res.status(500).json({ error: 'Unable to finalize and close term.' });
  }
});

// ==================== TEAMS ====================

teacherRouter.get('/teams', async (req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser!.uid;
    const teamsSnap = await adminDb.collection('teams').where('teacherId', '==', teacherId).get();

    const teams = await Promise.all(
      teamsSnap.docs.map(async (d) => {
        const t = d.data();
        const [avatarSnap, walletSnap, islandSnap, creaturesSnap, achSnap] = await Promise.all([
          adminDb.collection('team_avatars').doc(d.id).get(),
          adminDb.collection('team_wallets').doc(d.id).get(),
          adminDb.collection('team_islands').doc(d.id).get(),
          adminDb.collection('team_creatures').where('teamId', '==', d.id).get(),
          adminDb.collection('team_achievements').where('teamId', '==', d.id).get(),
        ]);

        return {
          id: t.id,
          classId: t.classId,
          name: t.name,
          username: t.username,
          members: t.members || [],
          captainMemberId: t.captainMemberId,
          captainName: t.captainName,
          avatar: (avatarSnap.exists ? avatarSnap.data() : DEFAULT_AVATAR) as AvatarConfig,
          coins: walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0,
          termPower: islandSnap.exists ? Number(islandSnap.data()?.termPower ?? 0) : 0,
          lifetimePower: islandSnap.exists ? Number(islandSnap.data()?.lifetimePower ?? 0) : 0,
          creatureCount: creaturesSnap.size,
          achievementCount: achSnap.size,
          createdAt: t.createdAt,
        };
      })
    );

    res.json({ teams });
  } catch (err) {
    console.error('Get teams failed:', err);
    res.status(500).json({ error: 'Unable to load teams.' });
  }
});

teacherRouter.post('/teams', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const classId = String(req.body?.classId || '');
    const name = String(req.body?.name || '').trim();
    const rawMembers = Array.isArray(req.body?.members) ? req.body.members.map(String) : [];
    const captainIndex = Number(req.body?.captainIndex ?? 0);
    const usernameInput = String(req.body?.username || '').trim().toLowerCase();
    const passwordInput = String(req.body?.password || '').trim();

    if (!classId || !name) {
      res.status(400).json({ error: 'Classroom and team name are required.' });
      return;
    }

    const classSnap = await adminDb.collection('classes').doc(classId).get();
    if (!classSnap.exists || classSnap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Classroom not found.' });
      return;
    }

    const memberValidation = validateTeamMembers(rawMembers);
    if (!memberValidation.valid) {
      res.status(400).json({ error: memberValidation.error });
      return;
    }

    const cleanUsername =
      usernameInput ||
      `${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${Math.floor(10 + Math.random() * 89)}`;

    const dupUser = await adminDb.collection('teams').where('username', '==', cleanUsername).limit(1).get();
    if (!dupUser.empty) {
      res.status(409).json({ error: `Username "${cleanUsername}" is already in use.` });
      return;
    }

    const generatedPassword = passwordInput || `quiz${Math.floor(1000 + Math.random() * 9000)}`;
    if (generatedPassword.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    const teamId = `team_${crypto.randomUUID().slice(0, 10)}`;
    const memberObjects = memberValidation.cleaned.map((nickname, idx) => ({
      id: `${teamId}_m${idx + 1}`,
      nickname,
    }));

    const safeCaptainIdx =
      Number.isInteger(captainIndex) && captainIndex >= 0 && captainIndex < memberObjects.length
        ? captainIndex
        : 0;
    const captain = memberObjects[safeCaptainIdx];
    const nowIso = new Date().toISOString();

    await adminDb.collection('teams').doc(teamId).set({
      id: teamId,
      classId,
      teacherId,
      name,
      username: cleanUsername,
      passwordHash: hashPassword(generatedPassword),
      members: memberObjects,
      captainMemberId: captain.id,
      captainName: captain.nickname,
      createdAt: nowIso,
    });

    await adminDb.collection('team_avatars').doc(teamId).set(DEFAULT_AVATAR);
    await adminDb.collection('team_wallets').doc(teamId).set({
      teamId,
      balance: 200,
      updatedAt: nowIso,
    });
    await adminDb.collection('coin_transactions').doc(`welcome_${teamId}`).set({
      id: `welcome_${teamId}`,
      teamId,
      amount: 200,
      txType: 'teacher_bonus',
      reason: 'Welcome Island Starter Grant',
      referenceId: classId,
      createdAt: nowIso,
    });

    // Starter Central Castle
    const starterInvId = `starter_inv_${teamId}`;
    await adminDb.collection('team_inventory_items').doc(starterInvId).set({
      id: starterInvId,
      teamId,
      itemId: 'item_central_castle',
      purchasedAt: nowIso,
    });

    await adminDb.collection('team_islands').doc(teamId).set({
      teamId,
      theme: 'emerald_isle',
      termPower: 300,
      lifetimePower: 300,
      teacherBonusPower: 0,
      seasonBaselinePower: 0,
      placements: [
        {
          id: `place_${teamId}_castle`,
          inventoryItemId: starterInvId,
          itemId: 'item_central_castle',
          name: 'Starlight Keep',
          category: 'building',
          artKey: 'central_castle',
          slotIndex: 2,
        },
      ],
      updatedAt: nowIso,
    });

    res.status(201).json({
      team: {
        id: teamId,
        classId,
        name,
        username: cleanUsername,
        generatedPassword,
        members: memberObjects,
        captainName: captain.nickname,
      },
    });
  } catch (err) {
    console.error('Create team failed:', err);
    res.status(500).json({ error: 'Unable to create team.' });
  }
});

teacherRouter.put('/teams/:id', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const teamId = String(req.params.id);
    const ref = adminDb.collection('teams').doc(teamId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Team not found.' });
      return;
    }

    const name = String(req.body?.name || snap.data()!.name).trim();
    const rawMembers = Array.isArray(req.body?.members)
      ? req.body.members.map(String)
      : (snap.data()!.members || []).map((m: { nickname: string }) => m.nickname);

    const validation = validateTeamMembers(rawMembers);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const captainIndex = Number(req.body?.captainIndex ?? 0);
    const memberObjects = validation.cleaned.map((nickname, idx) => ({
      id: `${teamId}_m${idx + 1}`,
      nickname,
    }));
    const safeIdx =
      Number.isInteger(captainIndex) && captainIndex >= 0 && captainIndex < memberObjects.length
        ? captainIndex
        : 0;
    const captain = memberObjects[safeIdx];

    await ref.update({
      name,
      members: memberObjects,
      captainMemberId: captain.id,
      captainName: captain.nickname,
    });

    res.json({ ok: true, members: memberObjects, captainName: captain.nickname });
  } catch (err) {
    console.error('Update team failed:', err);
    res.status(500).json({ error: 'Unable to update team.' });
  }
});

teacherRouter.post('/teams/:id/reset-password', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const teamId = String(req.params.id);
    const ref = adminDb.collection('teams').doc(teamId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Team not found.' });
      return;
    }

    const nextPassword = String(req.body?.password || '').trim() || `quiz${Math.floor(1000 + Math.random() * 9000)}`;
    if (nextPassword.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    await ref.update({ passwordHash: hashPassword(nextPassword) });
    res.json({ username: snap.data()!.username, newPassword: nextPassword });
  } catch (err) {
    console.error('Reset team password failed:', err);
    res.status(500).json({ error: 'Unable to reset team password.' });
  }
});

teacherRouter.post('/teams/:id/award-coins', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const teamId = String(req.params.id);
    const teamSnap = await adminDb.collection('teams').doc(teamId).get();
    if (!teamSnap.exists || teamSnap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Team not found.' });
      return;
    }

    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || 'Classroom Teamwork Reward').trim();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
      res.status(400).json({ error: 'Coin reward must be between 1 and 5,000.' });
      return;
    }

    const result = await awardCoins({
      teamId,
      amount,
      txType: 'teacher_bonus',
      reason,
      referenceId: teacherId,
    });
    res.json(result);
  } catch (err) {
    console.error('Award coins failed:', err);
    res.status(500).json({ error: 'Unable to award coins.' });
  }
});

teacherRouter.post('/teams/:id/award-power', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const teamId = String(req.params.id);
    const teamSnap = await adminDb.collection('teams').doc(teamId).get();
    if (!teamSnap.exists || teamSnap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Team not found.' });
      return;
    }

    const bonusPower = Number(req.body?.amount);
    if (!Number.isFinite(bonusPower) || bonusPower <= 0 || bonusPower > 5000) {
      res.status(400).json({ error: 'Bonus power must be between 1 and 5,000.' });
      return;
    }

    const islandRef = adminDb.collection('team_islands').doc(teamId);
    const islandSnap = await islandRef.get();
    const prevBonus = islandSnap.exists ? Number(islandSnap.data()?.teacherBonusPower ?? 0) : 0;
    await islandRef.set({ teacherBonusPower: prevBonus + Math.round(bonusPower) }, { merge: true });

    const recalculated = await recalculateTeamIslandPower(teamId);
    await evaluateTeamAchievements(teamId);
    res.json(recalculated);
  } catch (err) {
    console.error('Award power failed:', err);
    res.status(500).json({ error: 'Unable to award bonus island power.' });
  }
});

// ==================== QUIZZES ====================

function sanitizeQuestions(rawQuestions: unknown[]): QuizQuestion[] {
  return rawQuestions.map((q: any, idx: number) => {
    const optionsRaw = Array.isArray(q?.options) ? q.options : [];
    const options = optionsRaw.slice(0, 4).map((o: any, oIdx: number) => ({
      id: String(o?.id || `opt_${crypto.randomUUID().slice(0, 8)}_${oIdx}`),
      label: String(o?.label || `Option ${oIdx + 1}`).trim(),
      isCorrect: Boolean(o?.isCorrect),
    }));
    if (options.length >= 2 && !options.some((o: any) => o.isCorrect)) {
      options[0].isCorrect = true;
    }

    return {
      id: String(q?.id || `q_${crypto.randomUUID().slice(0, 8)}_${idx}`),
      orderIndex: idx,
      questionType: 'multiple_choice',
      prompt: String(q?.prompt || 'Untitled Question').trim(),
      points: Math.max(10, Math.min(1000, Number(q?.points || 100))),
      timeLimitSec: Math.max(10, Math.min(180, Number(q?.timeLimitSec || 25))),
      options,
    };
  });
}

teacherRouter.get('/quizzes', async (req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser!.uid;
    const snap = await adminDb.collection('quizzes').where('teacherId', '==', teacherId).get();
    const quizzes = snap.docs
      .map((d) => d.data() as Quiz)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    res.json({ quizzes });
  } catch (err) {
    console.error('Get quizzes failed:', err);
    res.status(500).json({ error: 'Unable to load quizzes.' });
  }
});

teacherRouter.post('/quizzes', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const title = String(req.body?.title || '').trim();
    const subject = String(req.body?.subject || 'General').trim();
    const description = String(req.body?.description || '').trim();
    const classId = String(req.body?.classId || '');
    const termNumber = Number(req.body?.termNumber || 1) as 1 | 2 | 3;
    const speedBonusEnabled = Boolean(req.body?.speedBonusEnabled);
    const status = req.body?.status === 'published' ? 'published' : 'draft';
    const rawQuestions = Array.isArray(req.body?.questions) ? req.body.questions : [];

    if (!title || !classId) {
      res.status(400).json({ error: 'Quiz title and class are required.' });
      return;
    }

    const questions = sanitizeQuestions(rawQuestions);
    if (status === 'published' && questions.length === 0) {
      res.status(400).json({ error: 'Add at least one question before publishing.' });
      return;
    }

    const quizId = `quiz_${crypto.randomUUID().slice(0, 10)}`;
    const nowIso = new Date().toISOString();
    const quiz: Quiz = {
      id: quizId,
      teacherId,
      classId,
      termNumber: [1, 2, 3].includes(termNumber) ? termNumber : 1,
      title,
      subject,
      description,
      status,
      speedBonusEnabled,
      questions,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await adminDb.collection('quizzes').doc(quizId).set(quiz);
    res.status(201).json({ quiz });
  } catch (err) {
    console.error('Create quiz failed:', err);
    res.status(500).json({ error: 'Unable to save quiz.' });
  }
});

teacherRouter.put('/quizzes/:id', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const quizId = String(req.params.id);
    const ref = adminDb.collection('quizzes').doc(quizId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const prev = snap.data() as Quiz;
    const title = String(req.body?.title ?? prev.title).trim();
    const subject = String(req.body?.subject ?? prev.subject).trim();
    const description = String(req.body?.description ?? prev.description).trim();
    const termNumber = Number(req.body?.termNumber ?? prev.termNumber) as 1 | 2 | 3;
    const speedBonusEnabled = req.body?.speedBonusEnabled !== undefined ? Boolean(req.body.speedBonusEnabled) : prev.speedBonusEnabled;
    const status = req.body?.status === 'published' ? 'published' : req.body?.status === 'draft' ? 'draft' : prev.status;
    const questions = Array.isArray(req.body?.questions) ? sanitizeQuestions(req.body.questions) : prev.questions;

    if (status === 'published' && questions.length === 0) {
      res.status(400).json({ error: 'A published quiz must have at least one question.' });
      return;
    }

    const updated: Quiz = {
      ...prev,
      title,
      subject,
      description,
      termNumber,
      speedBonusEnabled,
      status,
      questions,
      updatedAt: new Date().toISOString(),
    };

    await ref.set(updated);
    res.json({ quiz: updated });
  } catch (err) {
    console.error('Update quiz failed:', err);
    res.status(500).json({ error: 'Unable to update quiz.' });
  }
});

teacherRouter.delete('/quizzes/:id', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const quizId = String(req.params.id);
    const ref = adminDb.collection('quizzes').doc(quizId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.teacherId !== teacherId) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }
    await ref.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete quiz failed:', err);
    res.status(500).json({ error: 'Unable to delete quiz.' });
  }
});

// ==================== LIVE QUIZ HOSTING ====================

teacherRouter.post('/sessions', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const quizId = String(req.body?.quizId || '');
    const created = await createQuizSession({ quizId, teacherId });
    const state = await buildSessionStateForUser(created.sessionId, req.sessionUser!);
    res.status(201).json({ ...created, state });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('NOT_FOUND:')) res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
    else if (msg.startsWith('FORBIDDEN:')) res.status(403).json({ error: msg.replace('FORBIDDEN: ', '') });
    else if (msg.startsWith('BAD_REQUEST:')) res.status(400).json({ error: msg.replace('BAD_REQUEST: ', '') });
    else {
      console.error('Create live session failed:', err);
      res.status(500).json({ error: 'Unable to host quiz session.' });
    }
  }
});

teacherRouter.get('/sessions/active', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const snap = await adminDb
      .collection('quiz_sessions')
      .where('teacherId', '==', teacherId)
      .where('status', 'in', ['lobby', 'active'])
      .get();

    const sessions = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ sessions });
  } catch (err) {
    console.error('Get active sessions failed:', err);
    res.status(500).json({ error: 'Unable to load active sessions.' });
  }
});

teacherRouter.get('/sessions/:id', async (req: AuthedRequest, res) => {
  try {
    const state = await buildSessionStateForUser(String(req.params.id), req.sessionUser!);
    if (!state) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }
    res.json({ state });
  } catch (err) {
    console.error('Get session state failed:', err);
    res.status(500).json({ error: 'Unable to load session.' });
  }
});

teacherRouter.post('/sessions/:id/control', async (req: AuthedRequest, res) => {
  try {
    const teacherId = req.sessionUser!.uid;
    const sessionId = String(req.params.id);
    const action = req.body?.action as 'start' | 'next' | 'reveal' | 'end';
    if (!['start', 'next', 'reveal', 'end'].includes(action)) {
      res.status(400).json({ error: 'Invalid session action.' });
      return;
    }

    const state = await startOrAdvanceSession({ sessionId, teacherId, action });
    res.json({ state });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('NOT_FOUND:')) res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
    else if (msg.startsWith('FORBIDDEN:')) res.status(403).json({ error: msg.replace('FORBIDDEN: ', '') });
    else if (msg.startsWith('BAD_REQUEST:')) res.status(400).json({ error: msg.replace('BAD_REQUEST: ', '') });
    else {
      console.error('Control session failed:', err);
      res.status(500).json({ error: 'Unable to update live quiz session.' });
    }
  }
});

// ==================== SHOP CATALOG & GAME RULES ====================

teacherRouter.get('/catalog', async (_req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    const [creaturesSnap, itemsSnap, rules] = await Promise.all([
      adminDb.collection('creatures').get(),
      adminDb.collection('catalog_items').get(),
      getGameRules(),
    ]);

    const creatures = creaturesSnap.docs
      .map((d) => d.data() as Creature)
      .sort((a, b) => a.price - b.price);
    const items = itemsSnap.docs
      .map((d) => d.data() as CatalogItem)
      .sort((a, b) => a.price - b.price);

    res.json({ creatures, items, rules });
  } catch (err) {
    console.error('Get teacher catalog failed:', err);
    res.status(500).json({ error: 'Unable to load shop catalog.' });
  }
});

teacherRouter.post('/creatures', async (req: AuthedRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const element = String(req.body?.element || 'Cosmic') as Creature['element'];
    const rarity = String(req.body?.rarity || 'Rare') as Creature['rarity'];
    const description = String(req.body?.description || '').trim();
    const artKey = String(req.body?.artKey || 'crystal_wisp');
    const price = Math.max(50, Number(req.body?.price || 400));
    const powerValue = Math.max(20, Number(req.body?.powerValue || 200));

    if (!name || !description) {
      res.status(400).json({ error: 'Creature name and description are required.' });
      return;
    }

    const id = `creature_${crypto.randomUUID().slice(0, 8)}`;
    const creature: Creature = {
      id,
      name,
      element,
      rarity,
      description,
      artKey,
      price,
      powerValue,
      isActive: true,
    };

    await adminDb.collection('creatures').doc(id).set(creature);
    res.status(201).json({ creature });
  } catch (err) {
    console.error('Create creature failed:', err);
    res.status(500).json({ error: 'Unable to add creature.' });
  }
});

teacherRouter.put('/creatures/:id', async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const ref = adminDb.collection('creatures').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Creature not found.' });
      return;
    }

    const prev = snap.data() as Creature;
    await ref.update({
      name: String(req.body?.name ?? prev.name).trim(),
      price: Math.max(10, Number(req.body?.price ?? prev.price)),
      powerValue: Math.max(10, Number(req.body?.powerValue ?? prev.powerValue)),
      isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : prev.isActive,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Update creature failed:', err);
    res.status(500).json({ error: 'Unable to update creature.' });
  }
});

teacherRouter.put('/items/:id', async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const ref = adminDb.collection('catalog_items').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }
    const prev = snap.data() as CatalogItem;
    await ref.update({
      name: String(req.body?.name ?? prev.name).trim(),
      price: Math.max(0, Number(req.body?.price ?? prev.price)),
      powerValue: Math.max(0, Number(req.body?.powerValue ?? prev.powerValue)),
      isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : prev.isActive,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Update item failed:', err);
    res.status(500).json({ error: 'Unable to update catalog item.' });
  }
});

teacherRouter.put('/rules', async (req: AuthedRequest, res) => {
  try {
    const prev = await getGameRules();
    const next: GameRulesConfig = {
      creaturePowerMultiplier: Math.max(0.1, Number(req.body?.creaturePowerMultiplier ?? prev.creaturePowerMultiplier)),
      buildingPowerMultiplier: Math.max(0.1, Number(req.body?.buildingPowerMultiplier ?? prev.buildingPowerMultiplier)),
      achievementPowerMultiplier: Math.max(0.1, Number(req.body?.achievementPowerMultiplier ?? prev.achievementPowerMultiplier)),
      participationCoins: Math.max(0, Number(req.body?.participationCoins ?? prev.participationCoins)),
      firstPlaceBonusCoins: Math.max(0, Number(req.body?.firstPlaceBonusCoins ?? prev.firstPlaceBonusCoins)),
      secondPlaceBonusCoins: Math.max(0, Number(req.body?.secondPlaceBonusCoins ?? prev.secondPlaceBonusCoins)),
      thirdPlaceBonusCoins: Math.max(0, Number(req.body?.thirdPlaceBonusCoins ?? prev.thirdPlaceBonusCoins)),
      coinsPerCorrectAnswer: Math.max(0, Number(req.body?.coinsPerCorrectAnswer ?? prev.coinsPerCorrectAnswer)),
    };

    await adminDb.collection('config').doc('game_rules').set(next);

    // Recalculate power for teacher's teams when rules change
    const teamsSnap = await adminDb.collection('teams').where('teacherId', '==', req.sessionUser!.uid).get();
    await Promise.all(teamsSnap.docs.map((d) => recalculateTeamIslandPower(d.id)));

    res.json({ rules: next });
  } catch (err) {
    console.error('Update rules failed:', err);
    res.status(500).json({ error: 'Unable to update game rules.' });
  }
});

// ==================== ANALYTICS & REPORTS ====================

teacherRouter.get('/reports', async (req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser!.uid;
    const [teamsSnap, sessionsSnap, resultsSnap, achSnap, teamAchSnap, rankingsSnap] = await Promise.all([
      adminDb.collection('teams').where('teacherId', '==', teacherId).get(),
      adminDb.collection('quiz_sessions').where('teacherId', '==', teacherId).get(),
      adminDb.collection('quiz_results').get(),
      adminDb.collection('achievements').get(),
      adminDb.collection('team_achievements').get(),
      adminDb.collection('term_rankings').get(),
    ]);

    const teamIds = new Set(teamsSnap.docs.map((d) => d.id));
    const finishedSessions = sessionsSnap.docs.filter((d) => d.data().status === 'finished');

    const resultsByTeam = new Map<string, (QuizResultEntry & { quizTitle?: string; finishedAt?: string })[]>();
    for (const d of resultsSnap.docs) {
      const r = d.data() as QuizResultEntry & { quizTitle?: string; finishedAt?: string };
      if (!teamIds.has(r.teamId)) continue;
      if (!resultsByTeam.has(r.teamId)) resultsByTeam.set(r.teamId, []);
      resultsByTeam.get(r.teamId)!.push(r);
    }

    const teamAnalytics = await Promise.all(
      teamsSnap.docs.map(async (d) => {
        const t = d.data();
        const [walletSnap, islandSnap, tcSnap] = await Promise.all([
          adminDb.collection('team_wallets').doc(d.id).get(),
          adminDb.collection('team_islands').doc(d.id).get(),
          adminDb.collection('team_creatures').where('teamId', '==', d.id).get(),
        ]);

        const teamResults = resultsByTeam.get(d.id) || [];
        const totalQuestionsAnswered = teamResults.reduce((s, r) => s + Number(r.totalQuestions || 0), 0);
        const totalCorrect = teamResults.reduce((s, r) => s + Number(r.correctCount || 0), 0);
        const accuracyPct = totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 0;
        const avgScore =
          teamResults.length > 0
            ? Math.round(teamResults.reduce((s, r) => s + Number(r.totalScore || 0), 0) / teamResults.length)
            : 0;

        return {
          teamId: d.id,
          teamName: t.name as string,
          quizzesPlayed: teamResults.length,
          accuracyPct,
          avgScore,
          coins: walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0,
          termPower: islandSnap.exists ? Number(islandSnap.data()?.termPower ?? 0) : 0,
          lifetimePower: islandSnap.exists ? Number(islandSnap.data()?.lifetimePower ?? 0) : 0,
          creaturesOwned: tcSnap.size,
        };
      })
    );

    const achUnlockCounts = new Map<string, number>();
    for (const d of teamAchSnap.docs) {
      const tid = d.data().teamId as string;
      if (!teamIds.has(tid)) continue;
      const aid = d.data().achievementId as string;
      achUnlockCounts.set(aid, (achUnlockCounts.get(aid) || 0) + 1);
    }

    const achievementDistribution = achSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title as string,
      unlockedByTeams: achUnlockCounts.get(d.id) || 0,
    }));

    const quizHistory = finishedSessions
      .map((d) => {
        const s = d.data();
        const sessResults = Array.from(resultsByTeam.values())
          .flat()
          .filter((r) => r.sessionId === s.id);
        const avgSessionScore =
          sessResults.length > 0
            ? Math.round(sessResults.reduce((sum, r) => sum + r.totalScore, 0) / sessResults.length)
            : 0;
        return {
          sessionId: s.id,
          quizTitle: s.quizTitle,
          subject: s.subject,
          termNumber: s.termNumber,
          participantsCount: sessResults.length,
          avgScore: avgSessionScore,
          finishedAt: s.finishedAt || s.createdAt,
        };
      })
      .sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')));

    const archivedTerms = rankingsSnap.docs
      .map((d) => d.data() as TermRankingEntry)
      .filter((r) => teamIds.has(r.teamId))
      .sort((a, b) => b.termNumber - a.termNumber || a.finalRank - b.finalRank);

    res.json({
      teamAnalytics,
      achievementDistribution,
      quizHistory,
      archivedTerms,
      defaultRules: DEFAULT_GAME_RULES,
    });
  } catch (err) {
    console.error('Teacher reports failed:', err);
    res.status(500).json({ error: 'Unable to generate classroom analytics.' });
  }
});
