/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type { AuthSessionUser } from '../shared/types.ts';
import { apiFetch, clearAuthToken } from './lib/api.ts';
import { testConnection } from './lib/firebase.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { WelcomePage } from './pages/WelcomePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { TeamShell } from './pages/team/TeamShell.tsx';
import { TeacherShell } from './pages/teacher/TeacherShell.tsx';

export default function App() {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    void testConnection();
    apiFetch<{ user: AuthSessionUser | null }>('/api/auth/me')
      .then((res) => {
        if (!res.user) clearAuthToken();
        setUser(res.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session state regardless of network hiccup
    }
    clearAuthToken();
    setUser(null);
    setShowLogin(false);
  };

  return (
    <ErrorBoundary>
      {checkingAuth ? (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-950 via-violet-900 to-indigo-900 text-white">
          <div className="text-center space-y-2">
            <p className="text-3xl font-extrabold text-amber-300 quiztopia-wordmark">Quiztopia</p>
            <p className="text-sm text-violet-200">Preparing your classroom island...</p>
          </div>
        </div>
      ) : user ? (
        user.role === 'teacher' ? (
          <TeacherShell user={user} onLogout={handleLogout} />
        ) : (
          <TeamShell onLogout={handleLogout} />
        )
      ) : showLogin ? (
        <LoginPage
          onBack={() => setShowLogin(false)}
          onSuccess={(authedUser) => {
            setUser(authedUser);
            setShowLogin(false);
          }}
        />
      ) : (
        <WelcomePage onGetStarted={() => setShowLogin(true)} />
      )}
    </ErrorBoundary>
  );
}
