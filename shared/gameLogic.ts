import type { AvatarConfig, GameRulesConfig } from './types.ts';

export const DEFAULT_AVATAR: AvatarConfig = {
  characterType: 'wizard',
  hairStyle: 'braids',
  faceStyle: 'happy',
  clothingStyle: 'robe',
  accessory: 'wizard_hat',
  primaryColor: '#6D28D9',
  accentColor: '#F59E0B',
};

export const DEFAULT_GAME_RULES: GameRulesConfig = {
  creaturePowerMultiplier: 1,
  buildingPowerMultiplier: 1,
  achievementPowerMultiplier: 1,
  participationCoins: 50,
  firstPlaceBonusCoins: 100,
  secondPlaceBonusCoins: 70,
  thirdPlaceBonusCoins: 50,
  coinsPerCorrectAnswer: 25,
};

export function validateTeamMembers(nicknames: string[]): { valid: boolean; cleaned: string[]; error?: string } {
  const cleaned = nicknames
    .map((n) => n.trim().replace(/\s+/g, ' '))
    .filter((n) => n.length > 0);

  if (cleaned.length < 2) {
    return { valid: false, cleaned, error: 'Each team must have between 2 and 4 members.' };
  }
  if (cleaned.length > 4) {
    return { valid: false, cleaned, error: 'Each team can have at most 4 members.' };
  }
  for (const name of cleaned) {
    if (name.length > 30) {
      return { valid: false, cleaned, error: 'Member first names or nicknames must be 30 characters or fewer.' };
    }
  }
  return { valid: true, cleaned };
}

export function calculateIslandPower(params: {
  creaturePowerSum: number;
  buildingPowerSum: number;
  achievementPowerSum: number;
  teacherBonusPower: number;
  rules: GameRulesConfig;
}): {
  creaturePower: number;
  buildingPower: number;
  achievementPower: number;
  teacherBonusPower: number;
  totalPower: number;
} {
  const creaturePower = Math.round(params.creaturePowerSum * params.rules.creaturePowerMultiplier);
  const buildingPower = Math.round(params.buildingPowerSum * params.rules.buildingPowerMultiplier);
  const achievementPower = Math.round(params.achievementPowerSum * params.rules.achievementPowerMultiplier);
  const teacherBonusPower = Math.max(0, Math.round(params.teacherBonusPower));

  return {
    creaturePower,
    buildingPower,
    achievementPower,
    teacherBonusPower,
    totalPower: creaturePower + buildingPower + achievementPower + teacherBonusPower,
  };
}

export function calculateQuestionScore(params: {
  isCorrect: boolean;
  basePoints: number;
  speedBonusEnabled: boolean;
  questionStartedAt: number;
  questionEndsAt: number;
  submittedAt: number;
}): number {
  if (!params.isCorrect) return 0;
  const base = Math.max(10, params.basePoints);
  if (!params.speedBonusEnabled) return base;

  const duration = Math.max(1000, params.questionEndsAt - params.questionStartedAt);
  const remaining = Math.max(0, params.questionEndsAt - params.submittedAt);
  const ratio = Math.min(1, remaining / duration);
  // Bounded speed bonus: at most +25% so team discussion remains worthwhile
  const speedBonus = Math.round(base * 0.25 * ratio);
  return base + speedBonus;
}

export function calculateQuizCoins(params: {
  rank: number;
  correctCount: number;
  rules: GameRulesConfig;
}): number {
  let rankBonus = 0;
  if (params.rank === 1) rankBonus = params.rules.firstPlaceBonusCoins;
  else if (params.rank === 2) rankBonus = params.rules.secondPlaceBonusCoins;
  else if (params.rank === 3) rankBonus = params.rules.thirdPlaceBonusCoins;

  const answerCoins = Math.max(0, params.correctCount) * params.rules.coinsPerCorrectAnswer;
  return params.rules.participationCoins + rankBonus + answerCoins;
}
