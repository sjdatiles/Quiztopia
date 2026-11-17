import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Firestore Security Rules Invariants (Static Verification)', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');

  it('enforces default-deny catch-all and server-only economy/quiz writes', () => {
    const content = fs.readFileSync(rulesPath, 'utf-8');
    expect(content).toContain("rules_version = '2';");
    expect(content).toContain('match /{document=**}');
    expect(content).toContain('allow read, write: if false;');
    expect(content).toContain('match /team_wallets/{teamId}');
    expect(content).toContain('match /coin_transactions/{txId}');
    expect(content).toContain('match /team_answers/{answerId}');
    expect(content).toContain('email_verified == true');
  });
});
