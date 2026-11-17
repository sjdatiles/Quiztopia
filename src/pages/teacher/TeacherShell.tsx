import React, { useState } from 'react';
import {
  BarChart3,
  Crown,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Radio,
  Sliders,
  X,
} from 'lucide-react';
import type { AuthSessionUser } from '../../../shared/types.ts';
import { TeacherDashboard } from './TeacherDashboard.tsx';
import { TeacherClassesTeams } from './TeacherClassesTeams.tsx';
import { TeacherQuizzes } from './TeacherQuizzes.tsx';
import { TeacherLiveHost } from './TeacherLiveHost.tsx';
import { TeacherShopRules } from './TeacherShopRules.tsx';
import { TeacherReports } from './TeacherReports.tsx';

export type TeacherTab = 'dashboard' | 'classes' | 'quizzes' | 'live' | 'shop' | 'reports';

const TEACHER_NAV: { id: TeacherTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'classes', label: 'Classes & Teams', icon: GraduationCap },
  { id: 'quizzes', label: 'Quizzes', icon: FileText },
  { id: 'live', label: 'Live Host', icon: Radio },
  { id: 'shop', label: 'Shop & Rules', icon: Sliders },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export function TeacherShell({
  user,
  onLogout,
}: {
  user: AuthSessionUser;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<TeacherTab>('dashboard');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openLiveSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setTab('live');
  };

  return (
    <div className="min-h-screen flex bg-violet-50">
      {/* Desktop Deep Purple Teacher Sidebar matching Screen 7 */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-gradient-to-b from-indigo-950 via-violet-950 to-indigo-900 text-white border-r border-violet-800/60">
        <div className="p-6 flex items-center gap-2.5 border-b border-white/10">
          <Crown className="w-7 h-7 text-amber-300 shrink-0" />
          <span className="text-2xl font-extrabold tracking-tight text-amber-300 quiztopia-wordmark">
            Quiztopia
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {TEACHER_NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white/15 text-white border border-amber-300/35 shadow-sm'
                    : 'text-violet-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-300' : 'text-violet-300'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-3 py-2 rounded-xl bg-white/10">
            <p className="text-xs text-violet-200">Educator Portal</p>
            <p className="font-bold text-sm text-white truncate">{user.displayName}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-indigo-950/65 backdrop-blur-sm">
          <div className="w-72 h-full bg-gradient-to-b from-indigo-950 via-violet-950 to-indigo-900 text-white p-5 flex flex-col justify-between shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Crown className="w-6 h-6 text-amber-300" />
                  <span className="text-xl font-extrabold text-amber-300 quiztopia-wordmark">Quiztopia</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1.5 rounded-lg text-violet-200 hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-1">
                {TEACHER_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                        active ? 'bg-white/15 text-white' : 'text-violet-200 hover:bg-white/10'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-amber-300' : 'text-violet-300'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-violet-200/80 px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-xl bg-violet-100 text-violet-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-violet-900">
              {TEACHER_NAV.find((n) => n.id === tab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-violet-50 border border-violet-200">
              <div className="w-7 h-7 rounded-full bg-violet-700 text-white flex items-center justify-center text-xs font-extrabold">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-indigo-950">{user.displayName}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
          {tab === 'dashboard' && (
            <TeacherDashboard
              teacherName={user.displayName}
              onNavigate={(nextTab) => setTab(nextTab)}
              onOpenSession={openLiveSession}
              onLogout={onLogout}
            />
          )}
          {tab === 'classes' && <TeacherClassesTeams />}
          {tab === 'quizzes' && <TeacherQuizzes onHostedSession={openLiveSession} />}
          {tab === 'live' && (
            <TeacherLiveHost
              initialSessionId={activeSessionId}
              onGoToQuizzes={() => setTab('quizzes')}
            />
          )}
          {tab === 'shop' && <TeacherShopRules />}
          {tab === 'reports' && <TeacherReports />}
        </main>
      </div>
    </div>
  );
}
