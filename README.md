# Quiztopia — Learn. Compete. Build Your Island.

Quiztopia is a full-stack classroom game combining real-time team quiz competitions with a 2D fantasy island-building and creature-collecting progression system designed for elementary school classrooms.

## Core Design Principles
- **Shared Team Accounts Only (2–4 Students)**: Every classroom team shares one account, one shared team avatar, one shared 2D island, one shared coin wallet, and shared creature/building/achievement collections.
- **Kid-Safe Privacy**: Only student first names/nicknames are stored or displayed. There are no individual student accounts, no surnames, no direct messaging, no social feeds, and no daily login streak pressure.
- **Server-Authoritative Live Quiz Engine**: Real-time WebSocket synchronization (`ws`) with server-controlled question timers, single locked submission per team per question, and atomic coin rewards.
- **Three-Term Academic Seasons**: Classrooms run across Term 1, Term 2, and Term 3. Closing a term archives season rankings and champions while resetting seasonal `termPower` and preserving lifetime creatures, achievements, and `lifetimePower`.

## Starter Classroom Credentials
The backend seeds an initial classroom (`Grade 4 Explorers`) automatically on first startup:
- **Teacher**: `teacher@quiztopia.edu` / `Quiztopia2026!`
- **Teams**:
  - `star` / `star123` (Star Guardians)
  - `moon` / `moon123` (Moonlight Crew)
  - `crystal` / `crystal123` (Crystal Keepers)
  - `sky` / `sky123` (Sky Explorers)

## Running Locally
```bash
npm install
npm run dev      # Starts Express + WebSocket + Vite dev server on port 3000
npm test         # Runs Vitest unit, workflow, and Firestore rules tests
npm run lint     # Runs TypeScript type checking (tsc --noEmit)
npm run build    # Builds Vite frontend + bundled Express server into dist/
```
