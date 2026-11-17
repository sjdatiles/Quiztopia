import crypto from 'node:crypto';
import { Router } from 'express';
import { adminDb } from '../firebase.ts';
import { requireTeam, type AuthedRequest } from '../auth.ts';
import { ensureSeeded } from '../seed.ts';
import { DEFAULT_AVATAR } from '../../shared/gameLogic.ts';
import type {
  Achievement,
  AvatarConfig,
  CatalogItem,
  CoinTransaction,
  Creature,
  IslandPlacement,
  QuizResultEntry,
  TeamSummary,
  TermRankingEntry,
} from '../../shared/types.ts';
import {
  getGameRules,
  purchaseCatalogItem,
  purchaseCreature,
  recalculateTeamIslandPower,
} from '../services/economy.ts';
import {
  buildSessionStateForUser,
  joinSessionById,
  joinSessionByPin,
  submitTeamAnswer,
} from '../services/quizEngine.ts';

export const teamRouter = Router();
teamRouter.use(requireTeam);

async function loadTeamSummary(teamId: string): Promise<TeamSummary | null> {
  const [teamSnap, avatarSnap, walletSnap, islandSnap] = await Promise.all([
    adminDb.collection('teams').doc(teamId).get(),
    adminDb.collection('team_avatars').doc(teamId).get(),
    adminDb.collection('team_wallets').doc(teamId).get(),
    adminDb.collection('team_islands').doc(teamId).get(),
  ]);

  if (!teamSnap.exists) return null;
  const t = teamSnap.data()!;
  const avatar = (avatarSnap.exists ? avatarSnap.data() : DEFAULT_AVATAR) as AvatarConfig;
  const coins = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;
  const islandData = islandSnap.exists ? islandSnap.data()! : {};

  return {
    id: t.id,
    classId: t.classId,
    teacherId: t.teacherId,
    name: t.name,
    username: t.username,
    members: t.members || [],
    captainMemberId: t.captainMemberId,
    captainName: t.captainName,
    avatar,
    coins,
    island: {
      theme: islandData.theme || 'emerald_isle',
      termPower: Number(islandData.termPower ?? 0),
      lifetimePower: Number(islandData.lifetimePower ?? 0),
      teacherBonusPower: Number(islandData.teacherBonusPower ?? 0),
      placements: Array.isArray(islandData.placements) ? islandData.placements : [],
    },
    createdAt: t.createdAt,
  };
}

teamRouter.get('/dashboard', async (req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    const teamId = req.sessionUser!.teamId!;
    const classId = req.sessionUser!.classId!;

    const [team, classSnap, classTeamsSnap, resultsSnap, teamAchSnap, achSnap, activeSessionsSnap] =
      await Promise.all([
        loadTeamSummary(teamId),
        adminDb.collection('classes').doc(classId).get(),
        adminDb.collection('teams').where('classId', '==', classId).get(),
        adminDb.collection('quiz_results').where('teamId', '==', teamId).get(),
        adminDb.collection('team_achievements').where('teamId', '==', teamId).get(),
        adminDb.collection('achievements').get(),
        adminDb
          .collection('quiz_sessions')
          .where('classId', '==', classId)
          .where('status', 'in', ['lobby', 'active'])
          .get(),
      ]);

    if (!team) {
      res.status(404).json({ error: 'Team account not found.' });
      return;
    }

    // Compute current season rank across teams in same class
    const islandDocs = await Promise.all(
      classTeamsSnap.docs.map((d) => adminDb.collection('team_islands').doc(d.id).get())
    );
    const powers = islandDocs
      .map((snap) => ({
        teamId: snap.id,
        power: snap.exists ? Number(snap.data()?.termPower ?? 0) : 0,
      }))
      .sort((a, b) => b.power - a.power);

    const rankIndex = powers.findIndex((p) => p.teamId === teamId);
    const currentRank = rankIndex >= 0 ? rankIndex + 1 : 1;

    const recentResults = resultsSnap.docs
      .map((d) => d.data() as QuizResultEntry & { finishedAt?: string; quizTitle?: string })
      .sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')))
      .slice(0, 5);

    const achMap = new Map<string, Achievement>();
    for (const d of achSnap.docs) achMap.set(d.id, d.data() as Achievement);

    const recentAchievements = teamAchSnap.docs
      .map((d) => ({
        id: d.id,
        unlockedAt: d.data().unlockedAt as string,
        achievement: achMap.get(d.data().achievementId as string),
      }))
      .filter((a) => Boolean(a.achievement))
      .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))
      .slice(0, 4);

    const activeSessions = activeSessionsSnap.docs.map((d) => {
      const s = d.data();
      return {
        id: s.id,
        quizTitle: s.quizTitle,
        subject: s.subject,
        pinCode: s.pinCode,
        status: s.status,
      };
    });

    const cls = classSnap.exists ? classSnap.data() : null;

    res.json({
      team,
      classroom: cls
        ? {
            id: cls.id,
            name: cls.name,
            gradeLevel: cls.gradeLevel,
            academicYearLabel: cls.academicYearLabel,
            activeTermNumber: cls.activeTermNumber,
          }
        : null,
      currentRank,
      totalTeamsInClass: classTeamsSnap.size,
      recentResults,
      recentAchievements,
      activeSessions,
    });
  } catch (err) {
    console.error('Team dashboard failed:', err);
    res.status(500).json({ error: 'Unable to load team dashboard.' });
  }
});

teamRouter.put('/avatar', async (req: AuthedRequest, res) => {
  try {
    const teamId = req.sessionUser!.teamId!;
    const body = req.body as Partial<AvatarConfig>;
    const validCharacters = ['wizard', 'explorer', 'knight', 'scholar'];
    const validHair = ['short', 'braids', 'spiky', 'curly'];
    const validFaces = ['happy', 'curious', 'determined', 'sparkle'];
    const validClothes = ['robe', 'tunic', 'cape', 'vest'];
    const validAccessories = ['wizard_hat', 'crown', 'glasses', 'star_pin', 'none'];

    const avatar: AvatarConfig = {
      characterType: validCharacters.includes(String(body.characterType))
        ? (body.characterType as AvatarConfig['characterType'])
        : DEFAULT_AVATAR.characterType,
      hairStyle: validHair.includes(String(body.hairStyle))
        ? (body.hairStyle as AvatarConfig['hairStyle'])
        : DEFAULT_AVATAR.hairStyle,
      faceStyle: validFaces.includes(String(body.faceStyle))
        ? (body.faceStyle as AvatarConfig['faceStyle'])
        : DEFAULT_AVATAR.faceStyle,
      clothingStyle: validClothes.includes(String(body.clothingStyle))
        ? (body.clothingStyle as AvatarConfig['clothingStyle'])
        : DEFAULT_AVATAR.clothingStyle,
      accessory: validAccessories.includes(String(body.accessory))
        ? (body.accessory as AvatarConfig['accessory'])
        : DEFAULT_AVATAR.accessory,
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(String(body.primaryColor || ''))
        ? String(body.primaryColor)
        : DEFAULT_AVATAR.primaryColor,
      accentColor: /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || ''))
        ? String(body.accentColor)
        : DEFAULT_AVATAR.accentColor,
    };

    await adminDb.collection('team_avatars').doc(teamId).set(avatar);
    res.json({ avatar });
  } catch (err) {
    console.error('Update avatar failed:', err);
    res.status(500).json({ error: 'Unable to save team avatar.' });
  }
});

teamRouter.get('/island', async (req: AuthedRequest, res) => {
  try {
    const teamId = req.sessionUser!.teamId!;
    const [team, tcSnap, tiSnap, creaturesSnap, itemsSnap, teamAchSnap, achSnap, rules] =
      await Promise.all([
        loadTeamSummary(teamId),
        adminDb.collection('team_creatures').where('teamId', '==', teamId).get(),
        adminDb.collection('team_inventory_items').where('teamId', '==', teamId).get(),
        adminDb.collection('creatures').get(),
        adminDb.collection('catalog_items').get(),
        adminDb.collection('team_achievements').where('teamId', '==', teamId).get(),
        adminDb.collection('achievements').get(),
        getGameRules(),
      ]);

    if (!team) {
      res.status(404).json({ error: 'Team not found.' });
      return;
    }

    const creatureMap = new Map<string, Creature>();
    for (const d of creaturesSnap.docs) creatureMap.set(d.id, d.data() as Creature);

    const itemMap = new Map<string, CatalogItem>();
    for (const d of itemsSnap.docs) itemMap.set(d.id, d.data() as CatalogItem);

    const achMap = new Map<string, Achievement>();
    for (const d of achSnap.docs) achMap.set(d.id, d.data() as Achievement);

    const ownedCreatures = tcSnap.docs
      .map((d) => ({
        id: d.id,
        creatureId: d.data().creatureId as string,
        acquiredAt: d.data().acquiredAt as string,
        creature: creatureMap.get(d.data().creatureId as string),
      }))
      .filter((c) => Boolean(c.creature));

    const ownedItems = tiSnap.docs
      .map((d) => ({
        id: d.id,
        itemId: d.data().itemId as string,
        purchasedAt: d.data().purchasedAt as string,
        item: itemMap.get(d.data().itemId as string),
      }))
      .filter((i) => Boolean(i.item));

    const creaturePower = ownedCreatures.reduce(
      (sum, c) => sum + Math.round((c.creature?.powerValue || 0) * rules.creaturePowerMultiplier),
      0
    );
    const buildingPower = ownedItems.reduce(
      (sum, i) => sum + Math.round((i.item?.powerValue || 0) * rules.buildingPowerMultiplier),
      0
    );
    const achievementPower = teamAchSnap.docs.reduce(
      (sum, d) =>
        sum +
        Math.round((achMap.get(d.data().achievementId as string)?.powerValue || 0) * rules.achievementPowerMultiplier),
      0
    );

    res.json({
      team,
      ownedCreatures,
      ownedItems,
      powerBreakdown: {
        creaturePower,
        buildingPower,
        achievementPower,
        teacherBonusPower: team.island.teacherBonusPower,
        termPower: team.island.termPower,
        lifetimePower: team.island.lifetimePower,
      },
    });
  } catch (err) {
    console.error('Get island failed:', err);
    res.status(500).json({ error: 'Unable to load team island.' });
  }
});

teamRouter.put('/island/placements', async (req: AuthedRequest, res) => {
  try {
    const teamId = req.sessionUser!.teamId!;
    const rawPlacements = Array.isArray(req.body?.placements) ? req.body.placements : [];
    const theme = String(req.body?.theme || 'emerald_isle');

    const [tcSnap, tiSnap, creaturesSnap, itemsSnap] = await Promise.all([
      adminDb.collection('team_creatures').where('teamId', '==', teamId).get(),
      adminDb.collection('team_inventory_items').where('teamId', '==', teamId).get(),
      adminDb.collection('creatures').get(),
      adminDb.collection('catalog_items').get(),
    ]);

    const ownedInvIds = new Map<string, string>();
    for (const d of tiSnap.docs) ownedInvIds.set(d.id, d.data().itemId as string);

    const ownedTcIds = new Map<string, string>();
    for (const d of tcSnap.docs) ownedTcIds.set(d.id, d.data().creatureId as string);

    const creatureMap = new Map<string, Creature>();
    for (const d of creaturesSnap.docs) creatureMap.set(d.id, d.data() as Creature);

    const itemMap = new Map<string, CatalogItem>();
    for (const d of itemsSnap.docs) itemMap.set(d.id, d.data() as CatalogItem);

    const validatedPlacements: IslandPlacement[] = [];
    const usedSlots = new Set<number>();
    const usedEntities = new Set<string>();

    for (const p of rawPlacements) {
      const slotIndex = Number(p?.slotIndex);
      const inventoryItemId = String(p?.inventoryItemId || '');
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 11) continue;
      if (usedSlots.has(slotIndex) || usedEntities.has(inventoryItemId)) continue;

      if (ownedInvIds.has(inventoryItemId)) {
        const itemId = ownedInvIds.get(inventoryItemId)!;
        const item = itemMap.get(itemId);
        if (!item) continue;
        usedSlots.add(slotIndex);
        usedEntities.add(inventoryItemId);
        validatedPlacements.push({
          id: `place_${slotIndex}_${inventoryItemId.slice(0, 8)}`,
          inventoryItemId,
          itemId,
          name: item.name,
          category: item.category,
          artKey: item.artKey,
          slotIndex,
        });
      } else if (ownedTcIds.has(inventoryItemId)) {
        const creatureId = ownedTcIds.get(inventoryItemId)!;
        const creature = creatureMap.get(creatureId);
        if (!creature) continue;
        usedSlots.add(slotIndex);
        usedEntities.add(inventoryItemId);
        validatedPlacements.push({
          id: `place_${slotIndex}_${inventoryItemId.slice(0, 8)}`,
          inventoryItemId,
          itemId: creatureId,
          name: creature.name,
          category: 'creature',
          artKey: creature.artKey,
          slotIndex,
        });
      }
    }

    await adminDb.collection('team_islands').doc(teamId).set(
      {
        theme,
        placements: validatedPlacements,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({ placements: validatedPlacements, theme });
  } catch (err) {
    console.error('Update island placements failed:', err);
    res.status(500).json({ error: 'Unable to save island layout.' });
  }
});

teamRouter.get('/shop', async (req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    const teamId = req.sessionUser!.teamId!;
    const [creaturesSnap, itemsSnap, walletSnap, tcSnap, tiSnap] = await Promise.all([
      adminDb.collection('creatures').where('isActive', '==', true).get(),
      adminDb.collection('catalog_items').where('isActive', '==', true).get(),
      adminDb.collection('team_wallets').doc(teamId).get(),
      adminDb.collection('team_creatures').where('teamId', '==', teamId).get(),
      adminDb.collection('team_inventory_items').where('teamId', '==', teamId).get(),
    ]);

    const creatures = creaturesSnap.docs
      .map((d) => d.data() as Creature)
      .sort((a, b) => a.price - b.price);

    const items = itemsSnap.docs
      .map((d) => d.data() as CatalogItem)
      .filter((i) => i.price > 0)
      .sort((a, b) => a.price - b.price);

    const ownedCreatureCounts: Record<string, number> = {};
    for (const d of tcSnap.docs) {
      const cid = d.data().creatureId as string;
      ownedCreatureCounts[cid] = (ownedCreatureCounts[cid] || 0) + 1;
    }

    const ownedItemCounts: Record<string, number> = {};
    for (const d of tiSnap.docs) {
      const iid = d.data().itemId as string;
      ownedItemCounts[iid] = (ownedItemCounts[iid] || 0) + 1;
    }

    res.json({
      coins: walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0,
      creatures,
      items,
      ownedCreatureCounts,
      ownedItemCounts,
    });
  } catch (err) {
    console.error('Shop load failed:', err);
    res.status(500).json({ error: 'Unable to load Pet & Island Shop.' });
  }
});

teamRouter.post('/shop/buy-creature', async (req: AuthedRequest, res) => {
  try {
    const teamId = req.sessionUser!.teamId!;
    const creatureId = String(req.body?.creatureId || '');
    const idempotencyKey = String(req.body?.idempotencyKey || crypto.randomUUID());

    if (!creatureId) {
      res.status(400).json({ error: 'Missing creatureId.' });
      return;
    }

    const result = await purchaseCreature({ teamId, creatureId, idempotencyKey });
    res.json(result);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('NOT_FOUND:')) res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
    else if (msg.startsWith('CONFLICT:')) res.status(409).json({ error: msg.replace('CONFLICT: ', '') });
    else if (msg.startsWith('BAD_REQUEST:')) res.status(400).json({ error: msg.replace('BAD_REQUEST: ', '') });
    else {
      console.error('Buy creature failed:', err);
      res.status(500).json({ error: 'Purchase could not be completed.' });
    }
  }
});

teamRouter.post('/shop/buy-item', async (req: AuthedRequest, res) => {
  try {
    const teamId = req.sessionUser!.teamId!;
    const itemId = String(req.body?.itemId || '');
    const idempotencyKey = String(req.body?.idempotencyKey || crypto.randomUUID());

    if (!itemId) {
      res.status(400).json({ error: 'Missing itemId.' });
      return;
    }

    const result = await purchaseCatalogItem({ teamId, itemId, idempotencyKey });
    res.json(result);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('NOT_FOUND:')) res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
    else if (msg.startsWith('CONFLICT:')) res.status(409).json({ error: msg.replace('CONFLICT: ', '') });
    else if (msg.startsWith('BAD_REQUEST:')) res.status(400).json({ error: msg.replace('BAD_REQUEST: ', '') });
    else {
      console.error('Buy item failed:', err);
      res.status(500).json({ error: 'Purchase could not be completed.' });
    }
  }
});

teamRouter.get('/collection', async (req: AuthedRequest, res) => {
  try {
    const teamId = req.sessionUser!.teamId!;
    const [tcSnap, tiSnap, txSnap, creaturesSnap, itemsSnap, walletSnap] = await Promise.all([
      adminDb.collection('team_creatures').where('teamId', '==', teamId).get(),
      adminDb.collection('team_inventory_items').where('teamId', '==', teamId).get(),
      adminDb.collection('coin_transactions').where('teamId', '==', teamId).get(),
      adminDb.collection('creatures').get(),
      adminDb.collection('catalog_items').get(),
      adminDb.collection('team_wallets').doc(teamId).get(),
    ]);

    const creatureMap = new Map<string, Creature>();
    for (const d of creaturesSnap.docs) creatureMap.set(d.id, d.data() as Creature);

    const itemMap = new Map<string, CatalogItem>();
    for (const d of itemsSnap.docs) itemMap.set(d.id, d.data() as CatalogItem);

    const creatures = tcSnap.docs
      .map((d) => ({
        id: d.id,
        teamId,
        creatureId: d.data().creatureId as string,
        acquiredAt: d.data().acquiredAt as string,
        creature: creatureMap.get(d.data().creatureId as string),
      }))
      .filter((c) => Boolean(c.creature));

    const items = tiSnap.docs
      .map((d) => ({
        id: d.id,
        teamId,
        itemId: d.data().itemId as string,
        purchasedAt: d.data().purchasedAt as string,
        item: itemMap.get(d.data().itemId as string),
      }))
      .filter((i) => Boolean(i.item));

    const transactions = txSnap.docs
      .map((d) => d.data() as CoinTransaction)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({
      coins: walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0,
      creatures,
      items,
      transactions,
      catalogTotalCreatures: creaturesSnap.size,
    });
  } catch (err) {
    console.error('Collection load failed:', err);
    res.status(500).json({ error: 'Unable to load collection.' });
  }
});

teamRouter.get('/achievements', async (req: AuthedRequest, res) => {
  try {
    const teamId = req.sessionUser!.teamId!;
    const [achSnap, unlockedSnap] = await Promise.all([
      adminDb.collection('achievements').get(),
      adminDb.collection('team_achievements').where('teamId', '==', teamId).get(),
    ]);

    const unlockedMap = new Map<string, string>();
    for (const d of unlockedSnap.docs) {
      unlockedMap.set(d.data().achievementId as string, d.data().unlockedAt as string);
    }

    const list = achSnap.docs.map((d) => {
      const a = d.data() as Achievement;
      return {
        ...a,
        unlocked: unlockedMap.has(a.id),
        unlockedAt: unlockedMap.get(a.id) || null,
      };
    });

    res.json({ achievements: list });
  } catch (err) {
    console.error('Achievements load failed:', err);
    res.status(500).json({ error: 'Unable to load achievements.' });
  }
});

teamRouter.get('/leaderboards', async (req: AuthedRequest, res) => {
  try {
    const classId = req.sessionUser!.classId!;
    const [classSnap, teamsSnap, rankingsSnap, resultsSnap] = await Promise.all([
      adminDb.collection('classes').doc(classId).get(),
      adminDb.collection('teams').where('classId', '==', classId).get(),
      adminDb.collection('term_rankings').where('classId', '==', classId).get(),
      adminDb.collection('quiz_results').where('classId', '==', classId).get(),
    ]);

    const cls = classSnap.exists ? classSnap.data()! : { activeTermNumber: 1, academicYearLabel: '2026-2027' };

    const teamEntries = await Promise.all(
      teamsSnap.docs.map(async (d) => {
        const [avatarSnap, islandSnap] = await Promise.all([
          adminDb.collection('team_avatars').doc(d.id).get(),
          adminDb.collection('team_islands').doc(d.id).get(),
        ]);
        const t = d.data();
        const island = islandSnap.exists ? islandSnap.data()! : {};
        return {
          teamId: d.id,
          teamName: t.name as string,
          avatar: (avatarSnap.exists ? avatarSnap.data() : DEFAULT_AVATAR) as AvatarConfig,
          termPower: Number(island.termPower ?? 0),
          lifetimePower: Number(island.lifetimePower ?? 0),
        };
      })
    );

    const currentTermStandings = [...teamEntries]
      .sort((a, b) => b.termPower - a.termPower)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    const academicYearStandings = [...teamEntries]
      .sort((a, b) => b.lifetimePower - a.lifetimePower)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    const previousTerms = rankingsSnap.docs
      .map((d) => d.data() as TermRankingEntry)
      .sort((a, b) => b.termNumber - a.termNumber || a.finalRank - b.finalRank);

    // Group latest quiz results
    const allResults = resultsSnap.docs.map((d) => d.data() as QuizResultEntry & { finishedAt?: string; quizTitle?: string });
    allResults.sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')));
    const latestSessionId = allResults[0]?.sessionId;
    const latestQuizTitle = allResults[0]?.quizTitle || null;
    const latestQuizStandings = latestSessionId
      ? allResults.filter((r) => r.sessionId === latestSessionId).sort((a, b) => a.rank - b.rank)
      : [];

    res.json({
      activeTermNumber: cls.activeTermNumber,
      academicYearLabel: cls.academicYearLabel,
      currentTermStandings,
      academicYearStandings,
      previousTerms,
      latestQuizTitle,
      latestQuizStandings,
    });
  } catch (err) {
    console.error('Leaderboards load failed:', err);
    res.status(500).json({ error: 'Unable to load leaderboards.' });
  }
});

teamRouter.post('/quiz/join', async (req: AuthedRequest, res) => {
  try {
    const teamId = req.sessionUser!.teamId!;
    const classId = req.sessionUser!.classId!;
    const pinCode = req.body?.pinCode ? String(req.body.pinCode) : '';
    const sessionId = req.body?.sessionId ? String(req.body.sessionId) : '';

    if (!pinCode && !sessionId) {
      res.status(400).json({ error: 'Enter a quiz PIN or select an active classroom quiz.' });
      return;
    }

    const joined = pinCode
      ? await joinSessionByPin({ pinCode, teamId, classId })
      : await joinSessionById({ sessionId, teamId, classId });

    const state = await buildSessionStateForUser(joined.sessionId, req.sessionUser!);
    res.json({ ...joined, state });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('NOT_FOUND:')) res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
    else if (msg.startsWith('FORBIDDEN:')) res.status(403).json({ error: msg.replace('FORBIDDEN: ', '') });
    else if (msg.startsWith('BAD_REQUEST:')) res.status(400).json({ error: msg.replace('BAD_REQUEST: ', '') });
    else {
      console.error('Join quiz failed:', err);
      res.status(500).json({ error: 'Unable to join quiz session.' });
    }
  }
});

teamRouter.get('/quiz/sessions/:id', async (req: AuthedRequest, res) => {
  try {
    const sessionId = String(req.params.id);
    const state = await buildSessionStateForUser(sessionId, req.sessionUser!);
    if (!state) {
      res.status(404).json({ error: 'Quiz session not found.' });
      return;
    }
    if (state.classId !== req.sessionUser!.classId) {
      res.status(403).json({ error: 'This quiz session belongs to another classroom.' });
      return;
    }
    res.json({ state });
  } catch (err) {
    console.error('Get quiz session failed:', err);
    res.status(500).json({ error: 'Unable to load quiz session.' });
  }
});

teamRouter.post('/quiz/sessions/:id/submit', async (req: AuthedRequest, res) => {
  try {
    const sessionId = String(req.params.id);
    const teamId = req.sessionUser!.teamId!;
    const questionId = String(req.body?.questionId || '');
    const optionId = String(req.body?.optionId || '');

    if (!questionId || !optionId) {
      res.status(400).json({ error: 'Please select an answer before submitting.' });
      return;
    }

    const result = await submitTeamAnswer({ sessionId, teamId, questionId, optionId });
    const state = await buildSessionStateForUser(sessionId, req.sessionUser!);
    res.json({ ...result, state });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('NOT_FOUND:')) res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
    else if (msg.startsWith('FORBIDDEN:')) res.status(403).json({ error: msg.replace('FORBIDDEN: ', '') });
    else if (msg.startsWith('CONFLICT:')) res.status(409).json({ error: msg.replace('CONFLICT: ', '') });
    else if (msg.startsWith('BAD_REQUEST:')) res.status(400).json({ error: msg.replace('BAD_REQUEST: ', '') });
    else {
      console.error('Submit answer failed:', err);
      res.status(500).json({ error: 'Answer submission failed.' });
    }
  }
});

// Keep recalculateTeamIslandPower accessible if needed internally
export { recalculateTeamIslandPower };
