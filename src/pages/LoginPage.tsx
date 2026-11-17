import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowLeft, Crown, Eye, EyeOff, Lock, Mail, Sparkles, User } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { auth, googleProvider } from '../lib/firebase.ts';
import type { AuthSessionUser } from '../../shared/types.ts';
import { HERO_ISLAND_IMG } from '../components/FantasyArt.tsx';

export function LoginPage({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (user: AuthSessionUser) => void;
}) {
  const [mode, setMode] = useState<'team' | 'teacher'>('team');
  const [teacherRegister, setTeacherRegister] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bgFailed, setBgFailed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'team') {
        const res = await apiFetch<{ user: AuthSessionUser }>('/api/auth/team/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        onSuccess(res.user);
      } else if (teacherRegister) {
        const res = await apiFetch<{ user: AuthSessionUser }>('/api/auth/teacher/register', {
          method: 'POST',
          body: JSON.stringify({ email, displayName, password }),
        });
        onSuccess(res.user);
      } else {
        const res = await apiFetch<{ user: AuthSessionUser }>('/api/auth/teacher/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleTeacherLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();
      const res = await apiFetch<{ user: AuthSessionUser }>('/api/auth/teacher/firebase', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      onSuccess(res.user);
    } catch (err: any) {
      const code = err?.code || '';
      const msg = String(err?.message || '');
      if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setError(
          `Google Sign-In is not yet authorized for "${host}". Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains, or sign in / create an account with Teacher Email & Password above.`
        );
      } else if (code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked by your browser. Please allow popups or use Teacher Email & Password.');
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Google Sign-In window was closed before completing.');
      } else {
        setError(err?.message || 'Google Sign-In did not complete.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoTeam = (u: string, p: string) => {
    setMode('team');
    setUsername(u);
    setPassword(p);
    setError('');
  };

  const fillDemoTeacher = () => {
    setMode('teacher');
    setTeacherRegister(false);
    setEmail('teacher@quiztopia.edu');
    setPassword('Quiztopia2026!');
    setError('');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-sky-500 via-violet-700 to-indigo-950 overflow-hidden">
      {!bgFailed && (
        <img
          src={HERO_ISLAND_IMG}
          alt="Quiztopia castle background"
          referrerPolicy="no-referrer"
          onError={() => setBgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
      )}
      <div className="absolute inset-0 bg-indigo-950/45 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium backdrop-blur-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-300" />
            <span className="text-2xl font-extrabold text-amber-300 quiztopia-wordmark">Quiztopia</span>
          </div>
          <div className="w-16" />
        </div>

        {/* Frosted Login Card matching screen 2 */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-violet-200 p-6 sm:p-8 text-indigo-950 space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-indigo-950">Welcome Back!</h1>
            <p className="text-sm text-slate-600">Log in to continue your adventure</p>
          </div>

          {/* Segmented Toggle */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-violet-100">
            <button
              type="button"
              onClick={() => {
                setMode('team');
                setTeacherRegister(false);
                setError('');
              }}
              className={`py-2.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${
                mode === 'team'
                  ? 'bg-violet-700 text-white shadow-sm'
                  : 'text-violet-900 hover:bg-violet-200/60'
              }`}
            >
              Team Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('teacher');
                setError('');
              }}
              className={`py-2.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${
                mode === 'teacher'
                  ? 'bg-violet-700 text-white shadow-sm'
                  : 'text-violet-900 hover:bg-violet-200/60'
              }`}
            >
              Teacher Login
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'team' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Team Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-violet-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. star"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-violet-200 bg-violet-50/40 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
              </div>
            ) : (
              <>
                {teacherRegister && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Teacher Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-violet-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ms. Rivera"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-violet-200 bg-violet-50/40 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Teacher Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-violet-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teacher@quiztopia.edu"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-violet-200 bg-violet-50/40 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-violet-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-violet-200 bg-violet-50/40 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-900"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-800 hover:to-indigo-800 text-white font-bold text-sm shadow-md transition-all disabled:opacity-60"
            >
              {loading
                ? 'Signing in...'
                : mode === 'team'
                  ? 'Login to Team Island'
                  : teacherRegister
                    ? 'Create Teacher Account'
                    : 'Login as Teacher'}
            </button>
          </form>

          {mode === 'teacher' && (
            <div className="space-y-3 pt-1">
              <div className="relative flex items-center justify-center">
                <span className="border-t border-slate-200 w-full" />
                <span className="px-3 text-xs text-slate-400 bg-white shrink-0">or</span>
                <span className="border-t border-slate-200 w-full" />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleTeacherLogin}
                className="w-full py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-colors"
              >
                Continue with Google
              </button>

              <p className="text-center text-xs text-slate-600">
                {teacherRegister ? 'Already registered?' : 'New teacher?'}{' '}
                <button
                  type="button"
                  onClick={() => setTeacherRegister(!teacherRegister)}
                  className="text-violet-700 font-semibold hover:underline"
                >
                  {teacherRegister ? 'Back to Teacher Login' : 'Create Teacher Account'}
                </button>
              </p>
            </div>
          )}

          {mode === 'team' && (
            <p className="text-center text-xs text-slate-500">
              Don&apos;t have an account? <span className="text-violet-700 font-semibold">Contact your teacher</span>
            </p>
          )}

          {/* Classroom quick-fill helpers for easy verification */}
          <div className="pt-3 border-t border-violet-100 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Classroom Starter Accounts</span>
            </div>
            {mode === 'team' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoTeam('star', 'star123')}
                  className="px-2.5 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200 text-xs font-semibold text-violet-900"
                >
                  Star Guardians (star)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoTeam('moon', 'moon123')}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs font-semibold text-sky-900"
                >
                  Moonlight Crew (moon)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoTeam('crystal', 'crystal123')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-900"
                >
                  Crystal Keepers (crystal)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={fillDemoTeacher}
                className="px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200 text-xs font-semibold text-violet-900"
              >
                Use Starter Teacher (Ms. Rivera · teacher@quiztopia.edu)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
