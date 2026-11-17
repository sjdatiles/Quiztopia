export type UserRole = 'teacher' | 'team';

export type ElementType = 'Fire' | 'Water' | 'Earth' | 'Wind' | 'Light' | 'Darkness' | 'Cosmic';
export type RarityType = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythical';

export interface AvatarConfig {
  characterType: 'wizard' | 'explorer' | 'knight' | 'scholar';
  hairStyle: 'short' | 'braids' | 'spiky' | 'curly';
  faceStyle: 'happy' | 'curious' | 'determined' | 'sparkle';
  clothingStyle: 'robe' | 'tunic' | 'cape' | 'vest';
  accessory: 'wizard_hat' | 'crown' | 'glasses' | 'star_pin' | 'none';
  primaryColor: string;
  accentColor: string;
}

export interface TeamMember {
  id: string;
  nickname: string;
}

export interface TeamSummary {
  id: string;
  classId: string;
  teacherId: string;
  name: string;
  username: string;
  members: TeamMember[];
  captainMemberId: string;
  captainName: string;
  avatar: AvatarConfig;
  coins: number;
  island: {
    theme: string;
    termPower: number;
    lifetimePower: number;
    teacherBonusPower: number;
    placements: IslandPlacement[];
  };
  createdAt: string;
}

export interface IslandPlacement {
  id: string;
  inventoryItemId: string;
  itemId: string;
  name: string;
  category: 'building' | 'decoration' | 'creature';
  artKey: string;
  slotIndex: number;
}

export interface Classroom {
  id: string;
  teacherId: string;
  name: string;
  gradeLevel: string;
  academicYearLabel: string;
  activeTermNumber: 1 | 2 | 3;
  createdAt: string;
}

export interface AcademicTerm {
  id: string;
  classId: string;
  academicYearLabel: string;
  termNumber: 1 | 2 | 3;
  name: string;
  status: 'upcoming' | 'active' | 'closed';
  closedAt?: string;
}

export interface TermRankingEntry {
  id: string;
  termId: string;
  classId: string;
  academicYearLabel: string;
  termNumber: 1 | 2 | 3;
  teamId: string;
  teamName: string;
  avatar: AvatarConfig;
  finalIslandPower: number;
  finalRank: number;
  isChampion: boolean;
  archivedAt: string;
}

export interface Creature {
  id: string;
  name: string;
  element: ElementType;
  rarity: RarityType;
  description: string;
  artKey: string;
  price: number;
  powerValue: number;
  isActive: boolean;
}

export interface TeamCreature {
  id: string;
  teamId: string;
  creatureId: string;
  acquiredAt: string;
  creature?: Creature;
}

export interface CatalogItem {
  id: string;
  category: 'building' | 'decoration';
  name: string;
  description: string;
  artKey: string;
  price: number;
  powerValue: number;
  isActive: boolean;
}

export interface TeamInventoryItem {
  id: string;
  teamId: string;
  itemId: string;
  purchasedAt: string;
  item?: CatalogItem;
}

export interface CoinTransaction {
  id: string;
  teamId: string;
  amount: number;
  txType: 'quiz_reward' | 'teacher_bonus' | 'achievement_reward' | 'creature_purchase' | 'item_purchase';
  reason: string;
  referenceId?: string;
  createdAt: string;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  powerValue: number;
  coinReward: number;
  ruleType: 'quizzes_completed' | 'first_place_wins' | 'perfect_quiz' | 'creatures_owned' | 'items_owned' | 'island_power';
  threshold: number;
}

export interface TeamAchievement {
  id: string;
  teamId: string;
  achievementId: string;
  unlockedAt: string;
  achievement?: Achievement;
}

export interface GameRulesConfig {
  creaturePowerMultiplier: number;
  buildingPowerMultiplier: number;
  achievementPowerMultiplier: number;
  participationCoins: number;
  firstPlaceBonusCoins: number;
  secondPlaceBonusCoins: number;
  thirdPlaceBonusCoins: number;
  coinsPerCorrectAnswer: number;
}

export interface QuizOption {
  id: string;
  label: string;
  isCorrect?: boolean; // Stripped for teams during active questions
}

export interface QuizQuestion {
  id: string;
  orderIndex: number;
  questionType: 'multiple_choice';
  prompt: string;
  points: number;
  timeLimitSec: number;
  options: QuizOption[];
}

export interface Quiz {
  id: string;
  teacherId: string;
  classId: string;
  termNumber: 1 | 2 | 3;
  title: string;
  subject: string;
  description: string;
  status: 'draft' | 'published';
  speedBonusEnabled: boolean;
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface QuizSessionParticipant {
  teamId: string;
  teamName: string;
  avatar: AvatarConfig;
  score: number;
  correctCount: number;
  joinedAt: string;
  hasAnsweredCurrent?: boolean;
}

export interface QuizResultEntry {
  sessionId?: string;
  quizTitle?: string;
  finishedAt?: string;
  teamId: string;
  teamName: string;
  avatar: AvatarConfig;
  rank: number;
  correctCount: number;
  totalQuestions: number;
  totalScore: number;
  coinsAwarded: number;
}

export interface QuizSessionPublicState {
  id: string;
  quizId: string;
  quizTitle: string;
  subject: string;
  classId: string;
  termNumber: 1 | 2 | 3;
  pinCode: string;
  status: 'lobby' | 'active' | 'finished';
  currentQuestionIndex: number;
  totalQuestions: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  questionRevealed: boolean;
  speedBonusEnabled: boolean;
  serverNow: number;
  currentQuestion: {
    id: string;
    prompt: string;
    points: number;
    timeLimitSec: number;
    options: { id: string; label: string; isCorrect?: boolean }[];
  } | null;
  participants: QuizSessionParticipant[];
  mySubmission?: {
    questionId: string;
    optionId: string;
    submittedAt: number;
    isCorrect?: boolean;
    pointsAwarded?: number;
  } | null;
  results?: QuizResultEntry[];
}

export interface AuthSessionUser {
  role: UserRole;
  uid: string;
  displayName: string;
  email?: string;
  teamId?: string;
  classId?: string;
  teacherId?: string;
}
