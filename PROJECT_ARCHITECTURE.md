# Quiztopia System Architecture

## Technology Stack
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons (`src/`).
- **Backend**: Node.js + Express + `ws` WebSocket Server (`server.ts`, `server/`).
- **Database & Auth**: Google Cloud Firestore (`firebase-admin` when `GOOGLE_APPLICATION_CREDENTIALS` is configured, with automatic ACID SQLite `node:sqlite` Firestore-compatible persistence in `server/localDb.ts` for preview/local environments without GCP service-account keys) and Firebase Authentication (for teacher Google Sign-In alongside scrypt password login and HMAC-SHA256 `HttpOnly` signed session cookies).
- **Shared Domain Logic**: `shared/types.ts` and `shared/gameLogic.ts` shared across client and server.

## Server-Authoritative Architecture
All competitive, financial, and progression mutations happen exclusively on the Express backend using Firestore transactions:
1. **Authentication & RBAC (`server/auth.ts`, `server/routes/authRoutes.ts`)**:
   - Passwords hashed with `crypto.scryptSync` + per-record random salt and verified with `crypto.timingSafeEqual`.
   - Sessions stored in `HttpOnly`, `SameSite` signed cookies (`quiztopia_session`).
   - Middleware (`requireTeacher`, `requireTeam`) strictly isolates teacher management routes (`/api/teacher/*`) from team gameplay routes (`/api/team/*`).
   - `firestore.rules` enforces default-deny client access on all game, wallet, quiz answer, and session collections.
2. **Real-Time Quiz Engine (`server/services/quizEngine.ts`, `/ws/quiz`)**:
   - Authenticates WebSocket upgrades via session cookie verification before registering room clients.
   - Server sets `questionStartedAt` and `questionEndsAt` timestamps; client countdowns synchronize via `serverNow`.
   - `submitTeamAnswer` runs inside a Firestore transaction checking `status === 'active'`, `!questionRevealed`, `submittedAt <= questionEndsAt`, and uniqueness of `team_answers/{sessionId}_{questionId}_{teamId}`.
   - Answer correctness (`isCorrect`) is stripped from `QuizSessionPublicState` for team clients until the question timer expires or the teacher clicks Reveal.
3. **Island Economy & Power Engine (`server/services/economy.ts`)**:
   - `purchaseCreature` and `purchaseCatalogItem` use atomic Firestore transactions keyed by client `idempotencyKey` (`coin_transactions/{idempotencyKey}`) to prevent negative balances or double-spending.
   - `recalculateTeamIslandPower` computes `lifetimePower` from creature, building, achievement, and teacher-bonus weights (`config/game_rules`), and derives `termPower = Math.max(0, lifetimePower - seasonBaselinePower)`.
4. **Academic Term Lifecycle (`server/routes/teacherRoutes.ts`)**:
   - Closing a term snapshots team rankings into `term_rankings`, sets `seasonBaselinePower = lifetimePower`, zeroes `termPower` for the new term, and preserves all lifetime creatures, buildings, coins, and achievements.
