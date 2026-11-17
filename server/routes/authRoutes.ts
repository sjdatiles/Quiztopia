import crypto from 'node:crypto';
import { Router } from 'express';
import { adminAuth, adminDb } from '../firebase.ts';
import {
  clearSessionCookie,
  hashPassword,
  setSessionCookie,
  verifyPassword,
  type AuthedRequest,
} from '../auth.ts';
import { ensureSeeded } from '../seed.ts';
import type { AuthSessionUser } from '../../shared/types.ts';

export const authRouter = Router();

authRouter.get('/me', async (req: AuthedRequest, res) => {
  try {
    await ensureSeeded();
    if (!req.sessionUser) {
      res.json({ user: null });
      return;
    }
    res.json({ user: req.sessionUser });
  } catch (err) {
    console.error('GET /api/auth/me failed:', err);
    res.status(500).json({ error: 'Unable to check authentication status.' });
  }
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post('/team/login', async (req, res) => {
  try {
    await ensureSeeded();
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      res.status(400).json({ error: 'Please enter both Team Username and Password.' });
      return;
    }

    const snap = await adminDb.collection('teams').where('username', '==', username).limit(1).get();
    if (snap.empty) {
      res.status(401).json({ error: 'Invalid team username or password.' });
      return;
    }

    const teamDoc = snap.docs[0];
    const team = teamDoc.data();
    if (!team.passwordHash || !verifyPassword(password, String(team.passwordHash))) {
      res.status(401).json({ error: 'Invalid team username or password.' });
      return;
    }

    const sessionUser: AuthSessionUser = {
      role: 'team',
      uid: team.id,
      teamId: team.id,
      classId: team.classId,
      teacherId: team.teacherId,
      displayName: team.name,
    };

    const token = setSessionCookie(res, sessionUser);
    res.json({ user: sessionUser, token });
  } catch (err) {
    console.error('Team login error:', err);
    res.status(500).json({ error: 'Team login failed. Please try again.' });
  }
});

authRouter.post('/teacher/login', async (req, res) => {
  try {
    await ensureSeeded();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Please enter both email and password.' });
      return;
    }

    const snap = await adminDb.collection('teachers').where('email', '==', email).limit(1).get();
    if (snap.empty) {
      res.status(401).json({ error: 'Invalid teacher email or password.' });
      return;
    }

    const teacher = snap.docs[0].data();
    if (!teacher.passwordHash || !verifyPassword(password, String(teacher.passwordHash))) {
      res.status(401).json({ error: 'Invalid teacher email or password.' });
      return;
    }

    const sessionUser: AuthSessionUser = {
      role: 'teacher',
      uid: teacher.uid,
      displayName: teacher.displayName,
      email: teacher.email,
    };

    const token = setSessionCookie(res, sessionUser);
    res.json({ user: sessionUser, token });
  } catch (err) {
    console.error('Teacher login error:', err);
    res.status(500).json({ error: 'Teacher login failed. Please try again.' });
  }
});

authRouter.post('/teacher/register', async (req, res) => {
  try {
    await ensureSeeded();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const displayName = String(req.body?.displayName || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !displayName || password.length < 6) {
      res.status(400).json({ error: 'Provide a valid name, email, and a password of at least 6 characters.' });
      return;
    }

    const existing = await adminDb.collection('teachers').where('email', '==', email).limit(1).get();
    if (!existing.empty) {
      res.status(409).json({ error: 'A teacher account with that email already exists.' });
      return;
    }

    const uid = `teacher_${crypto.randomUUID().slice(0, 12)}`;
    const nowIso = new Date().toISOString();
    await adminDb.collection('teachers').doc(uid).set({
      uid,
      email,
      displayName,
      role: 'teacher',
      passwordHash: hashPassword(password),
      createdAt: nowIso,
    });

    const sessionUser: AuthSessionUser = {
      role: 'teacher',
      uid,
      displayName,
      email,
    };

    const token = setSessionCookie(res, sessionUser);
    res.status(201).json({ user: sessionUser, token });
  } catch (err) {
    console.error('Teacher register error:', err);
    res.status(500).json({ error: 'Could not register teacher account.' });
  }
});

authRouter.post('/teacher/firebase', async (req, res) => {
  try {
    await ensureSeeded();
    const idToken = String(req.body?.idToken || '');
    if (!idToken) {
      res.status(400).json({ error: 'Missing Firebase ID token.' });
      return;
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();
    const displayName = decoded.name || email.split('@')[0] || 'Teacher';

    await adminDb.collection('teachers').doc(uid).set(
      {
        uid,
        email,
        displayName,
        role: 'teacher',
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const sessionUser: AuthSessionUser = {
      role: 'teacher',
      uid,
      displayName,
      email,
    };

    const token = setSessionCookie(res, sessionUser);
    res.json({ user: sessionUser, token });
  } catch (err) {
    console.error('Firebase teacher auth failed:', err);
    res.status(401).json({ error: 'Invalid or expired Google Sign-In token.' });
  }
});
