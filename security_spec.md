# Quiztopia Security Specification (Firestore & Server Rules)

## 1. Architecture Trust Boundary
Quiztopia operates with a **Server-Authoritative Express + WebSocket Backend** (`firebase-admin`) paired with **Firestore Security Rules** (`firestore.rules`) as a defense-in-depth perimeter:
- Students/Teams authenticate via teacher-issued credentials into `HttpOnly` signed server sessions; they **never** receive direct write access to Firestore wallets, quiz answers, scores, islands, or collections.
- Teachers authenticate via verified teacher sessions or Firebase Google Sign-In.
- Direct client Firestore reads are limited to the connectivity probe (`test/connection`) and verified teacher-owned classroom reads; all student-facing and economy/quiz writes are rejected by Firestore rules and processed exclusively through validated Express transactions.

## 2. Data Invariants
1. **No Client Wallet Mutation**: No client SDK request can create or modify `/team_wallets/{teamId}` or `/coin_transactions/{txId}`.
2. **No Client Answer Tampering**: No client SDK request can read `/quizzes/{quizId}` answer keys or write `/team_answers/{answerId}`.
3. **Strict PII Isolation**: Teacher credential hashes and private emails are unreadable by non-owners; teams store only first names/nicknames (never surnames).
4. **Path ID Hardening**: Every single-document rule validates `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
5. **Default-Deny Catch-All**: Every unspecified path defaults to `allow read, write: if false;`.

## 3. Dirty Dozen Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. Unauthenticated write to `/team_wallets/team-1` with `{ balance: 999999 }`.
2. Unauthenticated read of `/teachers/teacher-1` (credential/PII leak).
3. Signed-in non-admin user trying to write `/admins/{uid}` (privilege escalation).
4. Signed-in user trying to create `/classes/cls-1` with `teacherId: "other-uid"` (identity spoofing).
5. Signed-in user trying to inject shadow field `isAdmin: true` on `/teachers/{uid}`.
6. Signed-in user trying to write `/team_answers/ans-1` directly to change a submitted answer.
7. Signed-in user trying to delete `/coin_transactions/tx-1` to erase spend history.
8. Signed-in user trying to read `/quizzes/quiz-1` directly without being the owning teacher (answer key leak).
9. Unauthenticated list query on `/teams` (roster scraping).
10. Signed-in user sending a 2000-character ID string to `/classes/{classId}` (resource poisoning).
11. Signed-in user updating a finished `/quiz_sessions/sess-1` (`status: 'finished'`) to reopen it.
12. Signed-in user creating `/classes/cls-1` with a forged past `createdAt` instead of `request.time`.
