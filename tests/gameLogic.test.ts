import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GAME_RULES,
  calculateIslandPower,
  calculateQuestionScore,
  calculateQuizCoins,
  validateTeamMembers,
} from '../shared/gameLogic.ts';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
} from '../server/auth.ts';

describe('Quiztopia Auth & Security Primitives', () => {
  it('hashes and verifies passwords with scrypt timingSafeEqual', () => {
    const hash = hashPassword('QuiztopiaRocks!');
    expect(hash).toContain(':');
    expect(verifyPassword('QuiztopiaRocks!', hash)).toBe(true);
    expect(verifyPassword('WrongPass', hash)).toBe(false);
  });

  it('signs and verifies HMAC session tokens and rejects tampering', () => {
    const token = signSessionToken({
      role: 'team',
      uid: 'team_1',
      teamId: 'team_1',
      classId: 'class_1',
      displayName: 'Star Guardians',
    });
    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.role).toBe('team');
    expect(verified?.teamId).toBe('team_1');

    const tampered = token.slice(0, -2) + 'xx';
    expect(verifySessionToken(tampered)).toBeNull();
  });
});

describe('Team Composition Rules (2-4 Members)', () => {
  it('rejects teams with fewer than 2 or more than 4 members', () => {
    expect(validateTeamMembers(['Alex']).valid).toBe(false);
    expect(validateTeamMembers(['', '   ', 'Mia']).valid).toBe(false);
    expect(validateTeamMembers(['A', 'B', 'C', 'D', 'E']).valid).toBe(false);
  });

  it('accepts 2 to 4 cleaned first names/nicknames', () => {
    const res = validateTeamMembers(['  Alex ', 'Mia', ' Kai  ']);
    expect(res.valid).toBe(true);
    expect(res.cleaned).toEqual(['Alex', 'Mia', 'Kai']);
  });
});

describe('Island Power & Quiz Scoring Formulas', () => {
  it('computes Island Power from creatures, buildings, achievements, and teacher bonus', () => {
    const breakdown = calculateIslandPower({
      creaturePowerSum: 400,
      buildingPowerSum: 250,
      achievementPowerSum: 100,
      teacherBonusPower: 50,
      rules: {
        ...DEFAULT_GAME_RULES,
        creaturePowerMultiplier: 1.5,
        buildingPowerMultiplier: 1.0,
        achievementPowerMultiplier: 2.0,
      },
    });
    expect(breakdown.creaturePower).toBe(600);
    expect(breakdown.buildingPower).toBe(250);
    expect(breakdown.achievementPower).toBe(200);
    expect(breakdown.teacherBonusPower).toBe(50);
    expect(breakdown.totalPower).toBe(1100);
  });

  it('awards 0 for wrong answers and bounds speed bonus to +25%', () => {
    expect(
      calculateQuestionScore({
        isCorrect: false,
        basePoints: 100,
        speedBonusEnabled: true,
        questionStartedAt: 1000,
        questionEndsAt: 21000,
        submittedAt: 1500,
      })
    ).toBe(0);

    const instant = calculateQuestionScore({
      isCorrect: true,
      basePoints: 100,
      speedBonusEnabled: true,
      questionStartedAt: 1000,
      questionEndsAt: 21000,
      submittedAt: 1000,
    });
    expect(instant).toBe(125);

    const lastSecond = calculateQuestionScore({
      isCorrect: true,
      basePoints: 100,
      speedBonusEnabled: true,
      questionStartedAt: 1000,
      questionEndsAt: 21000,
      submittedAt: 21000,
    });
    expect(lastSecond).toBe(100);
  });

  it('computes classroom coin rewards from participation, rank bonus, and correct count', () => {
    const firstPlaceCoins = calculateQuizCoins({
      rank: 1,
      correctCount: 4,
      rules: DEFAULT_GAME_RULES,
    });
    // 50 participation + 100 1st place + (4 * 25) = 250
    expect(firstPlaceCoins).toBe(250);
  });
});
