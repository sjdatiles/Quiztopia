import { adminDb } from './firebase.ts';
import { hashPassword } from './auth.ts';
import { DEFAULT_AVATAR, DEFAULT_GAME_RULES } from '../shared/gameLogic.ts';
import type { Achievement, AvatarConfig, CatalogItem, Creature } from '../shared/types.ts';

let seedPromise: Promise<void> | null = null;

const SEED_CREATURES: Omit<Creature, 'id'>[] = [
  {
    name: 'Lumibun',
    element: 'Light',
    rarity: 'Common',
    description: 'A glowing cloud-eared bunny spirit that lights up study lanterns on misty islands.',
    artKey: 'lumibun',
    price: 250,
    powerValue: 120,
    isActive: true,
  },
  {
    name: 'Sproutling',
    element: 'Earth',
    rarity: 'Common',
    description: 'A playful leaf-crowned guardian that helps magical gardens bloom across floating terraces.',
    artKey: 'sproutling',
    price: 300,
    powerValue: 150,
    isActive: true,
  },
  {
    name: 'Crystal Wisp',
    element: 'Cosmic',
    rarity: 'Uncommon',
    description: 'A floating prism sprite humming with stardust energy from ancient sky observatories.',
    artKey: 'crystal_wisp',
    price: 450,
    powerValue: 220,
    isActive: true,
  },
  {
    name: 'Emberling',
    element: 'Fire',
    rarity: 'Uncommon',
    description: 'A cheerful flame-tail drakelet whose warm sparks inspire bold team brainstorming.',
    artKey: 'emberling',
    price: 550,
    powerValue: 270,
    isActive: true,
  },
  {
    name: 'Moonfox',
    element: 'Darkness',
    rarity: 'Rare',
    description: 'A velvet-indigo twilight fox wearing crescent chimes that shimmer under starry skies.',
    artKey: 'moonfox',
    price: 700,
    powerValue: 360,
    isActive: true,
  },
  {
    name: 'Cloud Drake',
    element: 'Wind',
    rarity: 'Rare',
    description: 'A friendly sky-winged dragonet that glides beside airships carrying quiz scrolls.',
    artKey: 'cloud_drake',
    price: 800,
    powerValue: 420,
    isActive: true,
  },
  {
    name: 'Star Unicorn',
    element: 'Light',
    rarity: 'Epic',
    description: 'A radiant pastel-maned unicorn whose crystal horn weaves rainbow bridges between islands.',
    artKey: 'star_unicorn',
    price: 1000,
    powerValue: 550,
    isActive: true,
  },
  {
    name: 'Celestial Phoenix',
    element: 'Fire',
    rarity: 'Legendary',
    description: 'A golden sun-feather phoenix that turns every classroom challenge into a soaring triumph.',
    artKey: 'celestial_phoenix',
    price: 1200,
    powerValue: 700,
    isActive: true,
  },
  {
    name: 'Astral Dragon',
    element: 'Cosmic',
    rarity: 'Mythical',
    description: 'The royal amethyst guardian of Quiztopia, shimmering with constellation wings.',
    artKey: 'astral_dragon',
    price: 1500,
    powerValue: 920,
    isActive: true,
  },
];

const SEED_ITEMS: (Omit<CatalogItem, 'id'> & { slug: string })[] = [
  {
    slug: 'central_castle',
    category: 'building',
    name: 'Starlight Keep',
    description: 'A royal lavender turret castle at the heart of your team island.',
    artKey: 'central_castle',
    price: 0,
    powerValue: 300,
    isActive: true,
  },
  {
    slug: 'crystal_tower',
    category: 'building',
    name: 'Crystal Observatory',
    description: 'A glowing amethyst spire that amplifies cosmic island energy.',
    artKey: 'crystal_tower',
    price: 350,
    powerValue: 200,
    isActive: true,
  },
  {
    slug: 'wisdom_library',
    category: 'building',
    name: 'Hall of Wisdom',
    description: 'An enchanted domed library overflowing with floating storybooks.',
    artKey: 'wisdom_library',
    price: 450,
    powerValue: 260,
    isActive: true,
  },
  {
    slug: 'airship_dock',
    category: 'building',
    name: 'Sky Airship Dock',
    description: 'A wooden cloud-pier welcoming magical explorers and supply balloons.',
    artKey: 'airship_dock',
    price: 500,
    powerValue: 300,
    isActive: true,
  },
  {
    slug: 'emerald_grove',
    category: 'decoration',
    name: 'Whispering Grove',
    description: 'Luminous emerald trees that shelter Earth and Wind creatures.',
    artKey: 'emerald_grove',
    price: 150,
    powerValue: 90,
    isActive: true,
  },
  {
    slug: 'star_fountain',
    category: 'decoration',
    name: 'Starlight Fountain',
    description: 'A shimmering turquoise cascade fed by sky-springs.',
    artKey: 'star_fountain',
    price: 220,
    powerValue: 130,
    isActive: true,
  },
  {
    slug: 'lantern_arch',
    category: 'decoration',
    name: 'Golden Lantern Arch',
    description: 'Warm floating festival lanterns celebrating great teamwork.',
    artKey: 'lantern_arch',
    price: 180,
    powerValue: 110,
    isActive: true,
  },
  {
    slug: 'rainbow_bridge',
    category: 'decoration',
    name: 'Rainbow Crystal Bridge',
    description: 'A prism arch connecting outer floating islets to your castle.',
    artKey: 'rainbow_bridge',
    price: 320,
    powerValue: 190,
    isActive: true,
  },
];

const SEED_ACHIEVEMENTS: (Omit<Achievement, 'id'> & { slug: string })[] = [
  {
    slug: 'quiz_explorer',
    code: 'QUIZ_EXPLORER',
    title: 'Quiz Explorer',
    description: 'Complete your first live classroom quiz together as a team.',
    powerValue: 100,
    coinReward: 50,
    ruleType: 'quizzes_completed',
    threshold: 1,
  },
  {
    slug: 'first_victory',
    code: 'FIRST_VICTORY',
    title: 'First Victory',
    description: 'Earn Rank #1 in a live classroom quiz competition.',
    powerValue: 200,
    coinReward: 100,
    ruleType: 'first_place_wins',
    threshold: 1,
  },
  {
    slug: 'perfect_score',
    code: 'PERFECT_SCORE',
    title: 'Perfect Score',
    description: 'Answer every single question right in a classroom quiz!',
    powerValue: 250,
    coinReward: 150,
    ruleType: 'perfect_quiz',
    threshold: 1,
  },
  {
    slug: 'teamwork_champion',
    code: 'TEAMWORK_CHAMPION',
    title: 'Teamwork Champion',
    description: 'Complete 3 classroom quizzes with your teammates.',
    powerValue: 180,
    coinReward: 100,
    ruleType: 'quizzes_completed',
    threshold: 3,
  },
  {
    slug: 'consistent_learners',
    code: 'CONSISTENT_LEARNERS',
    title: 'Consistent Learners',
    description: 'Complete 5 classroom quizzes across the academic year.',
    powerValue: 300,
    coinReward: 150,
    ruleType: 'quizzes_completed',
    threshold: 5,
  },
  {
    slug: 'creature_collector',
    code: 'CREATURE_COLLECTOR',
    title: 'Creature Collector',
    description: 'Adopt 3 original fantasy creatures into your team collection.',
    powerValue: 200,
    coinReward: 100,
    ruleType: 'creatures_owned',
    threshold: 3,
  },
  {
    slug: 'island_builder',
    code: 'ISLAND_BUILDER',
    title: 'Island Builder',
    description: 'Acquire 3 buildings or decorations for your floating island.',
    powerValue: 160,
    coinReward: 80,
    ruleType: 'items_owned',
    threshold: 3,
  },
  {
    slug: 'challenge_conquerors',
    code: 'CHALLENGE_CONQUERORS',
    title: 'Challenge Conquerors',
    description: 'Grow your island to 1,500 lifetime Island Power.',
    powerValue: 250,
    coinReward: 120,
    ruleType: 'island_power',
    threshold: 1500,
  },
];

async function runSeed(): Promise<void> {
  const markerRef = adminDb.collection('config').doc('seed_v1');
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return;

  const nowIso = new Date().toISOString();
  const batch = adminDb.batch();

  // 1. Connectivity doc for client boot probe
  batch.set(adminDb.collection('test').doc('connection'), { ok: true, updatedAt: nowIso }, { merge: true });

  // 2. Game rules
  batch.set(adminDb.collection('config').doc('game_rules'), DEFAULT_GAME_RULES, { merge: true });

  // 3. Creatures
  const creatureIds: string[] = [];
  for (const c of SEED_CREATURES) {
    const id = `creature_${c.artKey}`;
    creatureIds.push(id);
    batch.set(adminDb.collection('creatures').doc(id), { id, ...c }, { merge: true });
  }

  // 4. Catalog items (buildings & decorations)
  for (const item of SEED_ITEMS) {
    const id = `item_${item.slug}`;
    batch.set(
      adminDb.collection('catalog_items').doc(id),
      {
        id,
        category: item.category,
        name: item.name,
        description: item.description,
        artKey: item.artKey,
        price: item.price,
        powerValue: item.powerValue,
        isActive: item.isActive,
      },
      { merge: true }
    );
  }

  // 5. Achievements
  for (const ach of SEED_ACHIEVEMENTS) {
    const id = `ach_${ach.slug}`;
    batch.set(
      adminDb.collection('achievements').doc(id),
      {
        id,
        code: ach.code,
        title: ach.title,
        description: ach.description,
        powerValue: ach.powerValue,
        coinReward: ach.coinReward,
        ruleType: ach.ruleType,
        threshold: ach.threshold,
      },
      { merge: true }
    );
  }

  // 6. Default Classroom Teacher & Classroom
  const teacherId = 'teacher_rivera';
  batch.set(
    adminDb.collection('teachers').doc(teacherId),
    {
      uid: teacherId,
      email: 'teacher@quiztopia.edu',
      displayName: 'Ms. Rivera',
      role: 'teacher',
      passwordHash: hashPassword('Quiztopia2026!'),
      createdAt: nowIso,
    },
    { merge: true }
  );

  const classId = 'class_grade4_explorers';
  batch.set(
    adminDb.collection('classes').doc(classId),
    {
      id: classId,
      teacherId,
      name: 'Grade 4 Explorers',
      gradeLevel: 'Grade 4',
      academicYearLabel: '2026-2027',
      activeTermNumber: 1,
      createdAt: nowIso,
    },
    { merge: true }
  );

  // 7. Three Academic Terms for the Classroom
  for (const termNum of [1, 2, 3] as const) {
    const termId = `${classId}_term_${termNum}`;
    batch.set(
      adminDb.collection('academic_terms').doc(termId),
      {
        id: termId,
        classId,
        academicYearLabel: '2026-2027',
        termNumber: termNum,
        name: `Term ${termNum}`,
        status: termNum === 1 ? 'active' : 'upcoming',
      },
      { merge: true }
    );
  }

  // 8. Sample Classroom Teams (2-4 members each, first names only)
  const sampleTeams: {
    id: string;
    name: string;
    username: string;
    password: string;
    members: string[];
    coins: number;
    avatar: AvatarConfig;
    starterCreatures: string[];
  }[] = [
    {
      id: 'team_star_guardians',
      name: 'Star Guardians',
      username: 'star',
      password: 'star123',
      members: ['Alex', 'Mia', 'Kai'],
      coins: 650,
      avatar: { ...DEFAULT_AVATAR, primaryColor: '#6D28D9', accentColor: '#F59E0B', accessory: 'wizard_hat' },
      starterCreatures: ['creature_lumibun', 'creature_crystal_wisp'],
    },
    {
      id: 'team_moonlight_crew',
      name: 'Moonlight Crew',
      username: 'moon',
      password: 'moon123',
      members: ['Luna', 'Noah', 'Zoe', 'Leo'],
      coins: 520,
      avatar: {
        characterType: 'explorer',
        hairStyle: 'curly',
        faceStyle: 'curious',
        clothingStyle: 'cape',
        accessory: 'crown',
        primaryColor: '#2563EB',
        accentColor: '#38BDF8',
      },
      starterCreatures: ['creature_moonfox'],
    },
    {
      id: 'team_crystal_keepers',
      name: 'Crystal Keepers',
      username: 'crystal',
      password: 'crystal123',
      members: ['Maya', 'Owen', 'Aria'],
      coins: 480,
      avatar: {
        characterType: 'scholar',
        hairStyle: 'short',
        faceStyle: 'sparkle',
        clothingStyle: 'vest',
        accessory: 'glasses',
        primaryColor: '#059669',
        accentColor: '#FBBF24',
      },
      starterCreatures: ['creature_sproutling'],
    },
    {
      id: 'team_sky_explorers',
      name: 'Sky Explorers',
      username: 'sky',
      password: 'sky123',
      members: ['Eli', 'Nora'],
      coins: 440,
      avatar: {
        characterType: 'knight',
        hairStyle: 'spiky',
        faceStyle: 'determined',
        clothingStyle: 'tunic',
        accessory: 'star_pin',
        primaryColor: '#EA580C',
        accentColor: '#FACC15',
      },
      starterCreatures: ['creature_emberling'],
    },
  ];

  for (const t of sampleTeams) {
    const memberObjects = t.members.map((nickname, idx) => ({
      id: `${t.id}_m${idx + 1}`,
      nickname,
    }));
    const captain = memberObjects[0];

    batch.set(
      adminDb.collection('teams').doc(t.id),
      {
        id: t.id,
        classId,
        teacherId,
        name: t.name,
        username: t.username,
        passwordHash: hashPassword(t.password),
        members: memberObjects,
        captainMemberId: captain.id,
        captainName: captain.nickname,
        createdAt: nowIso,
      },
      { merge: true }
    );

    batch.set(adminDb.collection('team_avatars').doc(t.id), t.avatar, { merge: true });

    batch.set(
      adminDb.collection('team_wallets').doc(t.id),
      {
        teamId: t.id,
        balance: t.coins,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    batch.set(
      adminDb.collection('coin_transactions').doc(`seed_tx_${t.id}`),
      {
        id: `seed_tx_${t.id}`,
        teamId: t.id,
        amount: t.coins,
        txType: 'teacher_bonus',
        reason: 'Welcome Adventure Grant',
        referenceId: classId,
        createdAt: nowIso,
      },
      { merge: true }
    );

    // Starter Central Castle
    const starterInvId = `seed_inv_${t.id}_castle`;
    batch.set(
      adminDb.collection('team_inventory_items').doc(starterInvId),
      {
        id: starterInvId,
        teamId: t.id,
        itemId: 'item_central_castle',
        purchasedAt: nowIso,
      },
      { merge: true }
    );

    let creaturePower = 0;
    for (const cid of t.starterCreatures) {
      const tcId = `seed_tc_${t.id}_${cid}`;
      batch.set(
        adminDb.collection('team_creatures').doc(tcId),
        {
          id: tcId,
          teamId: t.id,
          creatureId: cid,
          acquiredAt: nowIso,
        },
        { merge: true }
      );
      const found = SEED_CREATURES.find((c) => `creature_${c.artKey}` === cid);
      creaturePower += found?.powerValue ?? 0;
    }

    const totalPower = 300 + creaturePower;
    batch.set(
      adminDb.collection('team_islands').doc(t.id),
      {
        teamId: t.id,
        theme: 'emerald_isle',
        termPower: totalPower,
        lifetimePower: totalPower,
        teacherBonusPower: 0,
        seasonBaselinePower: 0,
        placements: [
          {
            id: `place_${t.id}_castle`,
            inventoryItemId: starterInvId,
            itemId: 'item_central_castle',
            name: 'Starlight Keep',
            category: 'building',
            artKey: 'central_castle',
            slotIndex: 2,
          },
        ],
        updatedAt: nowIso,
      },
      { merge: true }
    );
  }

  // 9. Starter Published Quizzes
  batch.set(
    adminDb.collection('quizzes').doc('quiz_solar_system'),
    {
      id: 'quiz_solar_system',
      teacherId,
      classId,
      termNumber: 1,
      title: 'Solar System Expedition',
      subject: 'Science',
      description: 'Journey across the planets with your team and unlock cosmic rewards!',
      status: 'published',
      speedBonusEnabled: true,
      questions: [
        {
          id: 'q_ss_1',
          orderIndex: 0,
          questionType: 'multiple_choice',
          prompt: 'Which planet is known as the Red Planet?',
          points: 100,
          timeLimitSec: 25,
          options: [
            { id: 'q_ss_1_a', label: 'Earth', isCorrect: false },
            { id: 'q_ss_1_b', label: 'Mars', isCorrect: true },
            { id: 'q_ss_1_c', label: 'Jupiter', isCorrect: false },
            { id: 'q_ss_1_d', label: 'Venus', isCorrect: false },
          ],
        },
        {
          id: 'q_ss_2',
          orderIndex: 1,
          questionType: 'multiple_choice',
          prompt: 'Which is the largest planet in our Solar System?',
          points: 100,
          timeLimitSec: 25,
          options: [
            { id: 'q_ss_2_a', label: 'Saturn', isCorrect: false },
            { id: 'q_ss_2_b', label: 'Neptune', isCorrect: false },
            { id: 'q_ss_2_c', label: 'Jupiter', isCorrect: true },
            { id: 'q_ss_2_d', label: 'Mercury', isCorrect: false },
          ],
        },
        {
          id: 'q_ss_3',
          orderIndex: 2,
          questionType: 'multiple_choice',
          prompt: 'What star sits at the center of our Solar System?',
          points: 100,
          timeLimitSec: 20,
          options: [
            { id: 'q_ss_3_a', label: 'The Sun', isCorrect: true },
            { id: 'q_ss_3_b', label: 'Polaris', isCorrect: false },
            { id: 'q_ss_3_c', label: 'Sirius', isCorrect: false },
            { id: 'q_ss_3_d', label: 'The Moon', isCorrect: false },
          ],
        },
        {
          id: 'q_ss_4',
          orderIndex: 3,
          questionType: 'multiple_choice',
          prompt: 'Which planet is famous for its bright icy rings?',
          points: 120,
          timeLimitSec: 25,
          options: [
            { id: 'q_ss_4_a', label: 'Mars', isCorrect: false },
            { id: 'q_ss_4_b', label: 'Venus', isCorrect: false },
            { id: 'q_ss_4_c', label: 'Saturn', isCorrect: true },
            { id: 'q_ss_4_d', label: 'Mercury', isCorrect: false },
          ],
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  batch.set(
    adminDb.collection('quizzes').doc('quiz_fractions_quest'),
    {
      id: 'quiz_fractions_quest',
      teacherId,
      classId,
      termNumber: 1,
      title: 'Fraction Island Quest',
      subject: 'Mathematics',
      description: 'Work together to solve enchanted fraction puzzles!',
      status: 'published',
      speedBonusEnabled: false,
      questions: [
        {
          id: 'q_fq_1',
          orderIndex: 0,
          questionType: 'multiple_choice',
          prompt: 'If you cut a magical pie into 4 equal slices and eat 1 slice, what fraction is left?',
          points: 100,
          timeLimitSec: 30,
          options: [
            { id: 'q_fq_1_a', label: '1/4', isCorrect: false },
            { id: 'q_fq_1_b', label: '3/4', isCorrect: true },
            { id: 'q_fq_1_c', label: '2/4', isCorrect: false },
            { id: 'q_fq_1_d', label: '4/3', isCorrect: false },
          ],
        },
        {
          id: 'q_fq_2',
          orderIndex: 1,
          questionType: 'multiple_choice',
          prompt: 'Which fraction is equivalent to 1/2?',
          points: 100,
          timeLimitSec: 30,
          options: [
            { id: 'q_fq_2_a', label: '2/6', isCorrect: false },
            { id: 'q_fq_2_b', label: '3/5', isCorrect: false },
            { id: 'q_fq_2_c', label: '4/8', isCorrect: true },
            { id: 'q_fq_2_d', label: '1/3', isCorrect: false },
          ],
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  batch.set(markerRef, { seededAt: nowIso, version: 1 });
  await batch.commit();
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}
