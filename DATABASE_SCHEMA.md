# Quiztopia Database Schema (Cloud Firestore)

Full schema blueprint is also mirrored in `/firebase-blueprint.json` and enforced by `/firestore.rules`.

## Collections
- **`teachers/{teacherId}`**: Educator profile (`email`, `displayName`, `passwordHash`, `authProvider`, `createdAt`).
- **`classes/{classId}`**: Classroom owned by a teacher (`teacherId`, `name`, `gradeLevel`, `academicYearLabel`, `activeTermNumber: 1|2|3`).
- **`academic_terms/{classId}_term_{1|2|3}`**: Term status tracking (`classId`, `termNumber`, `name`, `status: upcoming|active|closed`, `closedAt`).
- **`term_rankings/{termId}_{teamId}`**: Immutable seasonal archive snapshots (`termId`, `classId`, `termNumber`, `teamId`, `teamName`, `avatar`, `finalIslandPower`, `finalRank`, `isChampion`, `archivedAt`).
- **`teams/{teamId}`**: Shared classroom team account (`classId`, `teacherId`, `name`, `username`, `passwordHash`, `members: [{id, nickname}]` [2–4 first names], `captainMemberId`, `createdAt`).
- **`team_avatars/{teamId}`**: Shared team avatar appearance (`characterType`, `hairStyle`, `faceStyle`, `clothingStyle`, `accessory`, `primaryColor`, `accentColor`).
- **`team_wallets/{teamId}`**: Authoritative shared coin balance (`teamId`, `balance`, `updatedAt`).
- **`coin_transactions/{txId}`**: Append-only idempotent ledger (`id`, `teamId`, `amount`, `txType`, `reason`, `referenceId`, `createdAt`).
- **`team_islands/{teamId}`**: Shared 2D island state (`teamId`, `theme`, `termPower`, `lifetimePower`, `teacherBonusPower`, `seasonBaselinePower`, `placements`, `updatedAt`).
- **`creatures/{creatureId}`**: Fantasy creature catalog (`name`, `element`, `rarity`, `description`, `artKey`, `price`, `powerValue`, `isActive`).
- **`team_creatures/{id}`**: Team-owned fantasy creatures (`teamId`, `creatureId`, `acquiredAt`).
- **`catalog_items/{itemId}`**: Island buildings and decorations (`category`, `name`, `description`, `artKey`, `price`, `powerValue`, `isActive`).
- **`team_inventory_items/{id}`**: Team-owned island items (`teamId`, `itemId`, `purchasedAt`).
- **`achievements/{achievementId}`**: Milestone definitions (`code`, `title`, `description`, `powerValue`, `coinReward`, `ruleType`, `threshold`).
- **`team_achievements/{teamId}_{achievementId}`**: Unlocked milestones per team (`teamId`, `achievementId`, `unlockedAt`).
- **`quizzes/{quizId}`**: Teacher-authored quizzes (`teacherId`, `classId`, `termNumber`, `title`, `subject`, `status`, `speedBonusEnabled`, `questions`).
- **`quiz_sessions/{sessionId}`**: Live hosted competition state (`quizId`, `pinCode`, `status`, `currentQuestionIndex`, `questionStartedAt`, `questionEndsAt`, `questionRevealed`).
- **`quiz_participants/{sessionId}_{teamId}`**: Teams joined into a live session (`sessionId`, `teamId`, `teamName`, `avatar`, `score`, `correctCount`).
- **`team_answers/{sessionId}_{questionId}_{teamId}`**: Single locked team submission per question (`optionId`, `isCorrect`, `pointsAwarded`, `submittedAt`).
- **`quiz_results/{sessionId}_{teamId}`**: Final competition standings and coins awarded.
- **`config/game_rules`**: Teacher-configurable Island Power multipliers and quiz coin reward parameters.
