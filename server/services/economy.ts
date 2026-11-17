import crypto from 'node:crypto';
import { adminDb } from '../firebase.ts';
import { calculateIslandPower, DEFAULT_GAME_RULES } from '../../shared/gameLogic.ts';
import type {
  Achievement,
  CatalogItem,
  Creature,
  GameRulesConfig,
} from '../../shared/types.ts';

export async function getGameRules(): Promise<GameRulesConfig> {
  const snap = await adminDb.collection('config').doc('game_rules').get();
  if (!snap.exists) return DEFAULT_GAME_RULES;
  return { ...DEFAULT_GAME_RULES, ...(snap.data() as Partial<GameRulesConfig>) };
}

export async function recalculateTeamIslandPower(teamId: string): Promise<{
  creaturePower: number;
  buildingPower: number;
  achievementPower: number;
  teacherBonusPower: number;
  totalPower: number;
}> {
  const rules = await getGameRules();

  const [islandSnap, teamCreaturesSnap, teamItemsSnap, teamAchSnap, creaturesSnap, itemsSnap, achSnap] =
    await Promise.all([
      adminDb.collection('team_islands').doc(teamId).get(),
      adminDb.collection('team_creatures').where('teamId', '==', teamId).get(),
      adminDb.collection('team_inventory_items').where('teamId', '==', teamId).get(),
      adminDb.collection('team_achievements').where('teamId', '==', teamId).get(),
      adminDb.collection('creatures').get(),
      adminDb.collection('catalog_items').get(),
      adminDb.collection('achievements').get(),
    ]);

  const creaturePowerMap = new Map<string, number>();
  for (const doc of creaturesSnap.docs) {
    creaturePowerMap.set(doc.id, Number((doc.data() as Creature).powerValue || 0));
  }

  const itemPowerMap = new Map<string, number>();
  for (const doc of itemsSnap.docs) {
    itemPowerMap.set(doc.id, Number((doc.data() as CatalogItem).powerValue || 0));
  }

  const achPowerMap = new Map<string, number>();
  for (const doc of achSnap.docs) {
    achPowerMap.set(doc.id, Number((doc.data() as Achievement).powerValue || 0));
  }

  let creaturePowerSum = 0;
  for (const doc of teamCreaturesSnap.docs) {
    const cid = doc.data().creatureId as string;
    creaturePowerSum += creaturePowerMap.get(cid) ?? 0;
  }

  let buildingPowerSum = 0;
  for (const doc of teamItemsSnap.docs) {
    const iid = doc.data().itemId as string;
    buildingPowerSum += itemPowerMap.get(iid) ?? 0;
  }

  let achievementPowerSum = 0;
  for (const doc of teamAchSnap.docs) {
    const aid = doc.data().achievementId as string;
    achievementPowerSum += achPowerMap.get(aid) ?? 0;
  }

  const islandData = islandSnap.exists ? islandSnap.data() : {};
  const teacherBonusPower = Number(islandData?.teacherBonusPower ?? 0);
  const seasonBaselinePower = Number(islandData?.seasonBaselinePower ?? 0);

  const breakdown = calculateIslandPower({
    creaturePowerSum,
    buildingPowerSum,
    achievementPowerSum,
    teacherBonusPower,
    rules,
  });

  // Term competitive power = totalPower - seasonBaselinePower (never below 0),
  // while lifetimePower reflects the full lifetime sum across all terms.
  const termPower = Math.max(0, breakdown.totalPower - seasonBaselinePower);

  await adminDb
    .collection('team_islands')
    .doc(teamId)
    .set(
      {
        teamId,
        theme: islandData?.theme || 'emerald_isle',
        termPower,
        lifetimePower: breakdown.totalPower,
        teacherBonusPower,
        seasonBaselinePower,
        placements: Array.isArray(islandData?.placements) ? islandData.placements : [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  return {
    ...breakdown,
    totalPower: termPower,
  };
}

export async function awardCoins(params: {
  teamId: string;
  amount: number;
  txType: 'quiz_reward' | 'teacher_bonus' | 'achievement_reward';
  reason: string;
  referenceId?: string;
  idempotencyKey?: string;
}): Promise<{ newBalance: number; duplicate: boolean }> {
  const amount = Math.round(params.amount);
  if (amount <= 0) {
    throw new Error('Coin award amount must be positive.');
  }

  const txId = params.idempotencyKey || crypto.randomUUID();
  const txRef = adminDb.collection('coin_transactions').doc(txId);
  const walletRef = adminDb.collection('team_wallets').doc(params.teamId);

  const result = await adminDb.runTransaction(async (tx) => {
    const existingTx = await tx.get(txRef);
    const walletSnap = await tx.get(walletRef);
    const currentBalance = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;

    if (existingTx.exists) {
      return { newBalance: currentBalance, duplicate: true };
    }

    const nextBalance = currentBalance + amount;
    const nowIso = new Date().toISOString();

    tx.set(
      walletRef,
      {
        teamId: params.teamId,
        balance: nextBalance,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    tx.set(txRef, {
      id: txId,
      teamId: params.teamId,
      amount,
      txType: params.txType,
      reason: params.reason,
      referenceId: params.referenceId || null,
      createdAt: nowIso,
    });

    return { newBalance: nextBalance, duplicate: false };
  });

  return result;
}

export async function evaluateTeamAchievements(teamId: string): Promise<Achievement[]> {
  const [achSnap, unlockedSnap, resultsSnap, creaturesSnap, itemsSnap, islandSnap] = await Promise.all([
    adminDb.collection('achievements').get(),
    adminDb.collection('team_achievements').where('teamId', '==', teamId).get(),
    adminDb.collection('quiz_results').where('teamId', '==', teamId).get(),
    adminDb.collection('team_creatures').where('teamId', '==', teamId).get(),
    adminDb.collection('team_inventory_items').where('teamId', '==', teamId).get(),
    adminDb.collection('team_islands').doc(teamId).get(),
  ]);

  const alreadyUnlocked = new Set<string>();
  for (const doc of unlockedSnap.docs) {
    alreadyUnlocked.add(doc.data().achievementId as string);
  }

  const quizzesCompleted = resultsSnap.size;
  let firstPlaceWins = 0;
  let perfectQuizCount = 0;

  for (const doc of resultsSnap.docs) {
    const r = doc.data();
    if (Number(r.rank) === 1) firstPlaceWins += 1;
    if (Number(r.totalQuestions) > 0 && Number(r.correctCount) >= Number(r.totalQuestions)) {
      perfectQuizCount += 1;
    }
  }

  const creaturesOwned = creaturesSnap.size;
  const itemsOwned = itemsSnap.size;
  const lifetimePower = islandSnap.exists ? Number(islandSnap.data()?.lifetimePower ?? 0) : 0;

  const newlyUnlocked: Achievement[] = [];

  for (const doc of achSnap.docs) {
    const ach = { id: doc.id, ...(doc.data() as Omit<Achievement, 'id'>) };
    if (alreadyUnlocked.has(ach.id)) continue;

    let met = false;
    switch (ach.ruleType) {
      case 'quizzes_completed':
        met = quizzesCompleted >= ach.threshold;
        break;
      case 'first_place_wins':
        met = firstPlaceWins >= ach.threshold;
        break;
      case 'perfect_quiz':
        met = perfectQuizCount >= ach.threshold;
        break;
      case 'creatures_owned':
        met = creaturesOwned >= ach.threshold;
        break;
      case 'items_owned':
        met = itemsOwned >= ach.threshold;
        break;
      case 'island_power':
        met = lifetimePower >= ach.threshold;
        break;
    }

    if (met) {
      const unlockDocId = `${teamId}_${ach.id}`;
      const unlockRef = adminDb.collection('team_achievements').doc(unlockDocId);
      const inserted = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(unlockRef);
        if (snap.exists) return false;
        tx.set(unlockRef, {
          id: unlockDocId,
          teamId,
          achievementId: ach.id,
          unlockedAt: new Date().toISOString(),
        });
        return true;
      });

      if (inserted) {
        newlyUnlocked.push(ach);
        if (ach.coinReward > 0) {
          await awardCoins({
            teamId,
            amount: ach.coinReward,
            txType: 'achievement_reward',
            reason: `Achievement Unlocked: ${ach.title}`,
            referenceId: ach.id,
            idempotencyKey: `ach_reward_${teamId}_${ach.id}`,
          });
        }
      }
    }
  }

  if (newlyUnlocked.length > 0) {
    await recalculateTeamIslandPower(teamId);
  }

  return newlyUnlocked;
}

export async function purchaseCreature(params: {
  teamId: string;
  creatureId: string;
  idempotencyKey: string;
}): Promise<{ newBalance: number; teamCreatureId: string; creature: Creature; islandPower: number }> {
  const creatureSnap = await adminDb.collection('creatures').doc(params.creatureId).get();
  if (!creatureSnap.exists) {
    throw new Error('NOT_FOUND: Fantasy creature not found.');
  }

  const creature = { id: creatureSnap.id, ...(creatureSnap.data() as Omit<Creature, 'id'>) };
  if (!creature.isActive) {
    throw new Error('BAD_REQUEST: This creature is currently unavailable.');
  }

  const txRef = adminDb.collection('coin_transactions').doc(params.idempotencyKey);
  const walletRef = adminDb.collection('team_wallets').doc(params.teamId);
  const teamCreatureId = crypto.randomUUID();
  const tcRef = adminDb.collection('team_creatures').doc(teamCreatureId);

  const txResult = await adminDb.runTransaction(async (tx) => {
    const existingTx = await tx.get(txRef);
    if (existingTx.exists) {
      throw new Error('CONFLICT: Duplicate purchase transaction detected.');
    }

    const walletSnap = await tx.get(walletRef);
    const currentBalance = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;

    if (currentBalance < creature.price) {
      throw new Error('BAD_REQUEST: Insufficient team coins for this creature.');
    }

    const nextBalance = currentBalance - creature.price;
    const nowIso = new Date().toISOString();

    tx.set(
      walletRef,
      {
        teamId: params.teamId,
        balance: nextBalance,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    tx.set(txRef, {
      id: params.idempotencyKey,
      teamId: params.teamId,
      amount: -creature.price,
      txType: 'creature_purchase',
      reason: `Adopted ${creature.name}`,
      referenceId: creature.id,
      createdAt: nowIso,
    });

    tx.set(tcRef, {
      id: teamCreatureId,
      teamId: params.teamId,
      creatureId: creature.id,
      acquiredAt: nowIso,
    });

    return { newBalance: nextBalance };
  });

  const power = await recalculateTeamIslandPower(params.teamId);
  await evaluateTeamAchievements(params.teamId);
  const latestIsland = await adminDb.collection('team_islands').doc(params.teamId).get();

  return {
    newBalance: txResult.newBalance,
    teamCreatureId,
    creature,
    islandPower: latestIsland.exists ? Number(latestIsland.data()?.termPower ?? power.totalPower) : power.totalPower,
  };
}

export async function purchaseCatalogItem(params: {
  teamId: string;
  itemId: string;
  idempotencyKey: string;
}): Promise<{ newBalance: number; inventoryItemId: string; item: CatalogItem; islandPower: number }> {
  const itemSnap = await adminDb.collection('catalog_items').doc(params.itemId).get();
  if (!itemSnap.exists) {
    throw new Error('NOT_FOUND: Island item not found.');
  }

  const item = { id: itemSnap.id, ...(itemSnap.data() as Omit<CatalogItem, 'id'>) };
  if (!item.isActive) {
    throw new Error('BAD_REQUEST: This island item is currently unavailable.');
  }

  const txRef = adminDb.collection('coin_transactions').doc(params.idempotencyKey);
  const walletRef = adminDb.collection('team_wallets').doc(params.teamId);
  const inventoryItemId = crypto.randomUUID();
  const invRef = adminDb.collection('team_inventory_items').doc(inventoryItemId);

  const txResult = await adminDb.runTransaction(async (tx) => {
    const existingTx = await tx.get(txRef);
    if (existingTx.exists) {
      throw new Error('CONFLICT: Duplicate purchase transaction detected.');
    }

    const walletSnap = await tx.get(walletRef);
    const currentBalance = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;

    if (currentBalance < item.price) {
      throw new Error('BAD_REQUEST: Insufficient team coins for this island item.');
    }

    const nextBalance = currentBalance - item.price;
    const nowIso = new Date().toISOString();

    tx.set(
      walletRef,
      {
        teamId: params.teamId,
        balance: nextBalance,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    tx.set(txRef, {
      id: params.idempotencyKey,
      teamId: params.teamId,
      amount: -item.price,
      txType: 'item_purchase',
      reason: `Built ${item.name}`,
      referenceId: item.id,
      createdAt: nowIso,
    });

    tx.set(invRef, {
      id: inventoryItemId,
      teamId: params.teamId,
      itemId: item.id,
      purchasedAt: nowIso,
    });

    return { newBalance: nextBalance };
  });

  const power = await recalculateTeamIslandPower(params.teamId);
  await evaluateTeamAchievements(params.teamId);
  const latestIsland = await adminDb.collection('team_islands').doc(params.teamId).get();

  return {
    newBalance: txResult.newBalance,
    inventoryItemId,
    item,
    islandPower: latestIsland.exists ? Number(latestIsland.data()?.termPower ?? power.totalPower) : power.totalPower,
  };
}
