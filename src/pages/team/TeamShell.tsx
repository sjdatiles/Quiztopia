import React, { useEffect, useState } from 'react';
import {
  Award,
  Coins,
  Crown,
  Gamepad2,
  Home,
  LogOut,
  Map as MapIcon,
  Menu,
  Package,
  ShoppingBag,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { AvatarConfig } from '../../../shared/types.ts';
import { TeamAvatarArt } from '../../components/FantasyArt.tsx';
import { TeamDashboard, type TeamDashboardData } from './TeamDashboard.tsx';
import { TeamIslandView } from './TeamIslandView.tsx';
import { AvatarCreator } from './AvatarCreator.tsx';
import { QuizArena } from './QuizArena.tsx';
import { PetShopView } from './PetShopView.tsx';
import { CollectionView } from './CollectionView.tsx';
import { LeaderboardView } from './LeaderboardView.tsx';
import { AchievementsView } from './AchievementsView.tsx';

type TeamTab =
  | 'dashboard'
  | 'island'
  | 'quiz'
  | 'shop'
  | 'collection'
  | 'leaderboard'
  | 'achievements'
  | 'avatar';

const NAV_ITEMS: { id: TeamTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'island', label: 'Our Island', icon: MapIcon },
  { id: 'quiz', label: 'Quiz Arena', icon: Gamepad2 },
  { id: 'shop', label: 'Pet Shop', icon: ShoppingBag },
  { id: 'collection', label: 'Collection', icon: Package },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'avatar', label: 'Avatar Studio', icon: Sparkles },
];

export function TeamShell({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<TeamTab>('dashboard');
  const [dashData, setDashData] = useState<TeamDashboardData | null>(null);
  const [joinSessionId, setJoinSessionId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshDashboard = async () => {
    const res = await apiFetch<TeamDashboardData>('/api/team/dashboard');
    setDashData(res);
  };

  useEffect(() => {
    void refreshDashboard();
  }, []);

  if (!dashData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-violet-50 text-indigo-950 font-semibold">
        Loading your team island...
      </div>
    );
  }

  const { team } = dashData;

  const handleAvatarSaved = (avatar: AvatarConfig) => {
    setDashData((prev) => (prev ? { ...prev, team: { ...prev.team, avatar } } : prev));
  };

  return (
    <div className="min-h-screen flex flex-col bg-violet-50">
      {/* Top Royal Purple Team Bar matching Screen 3 */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-950 via-violet-900 to-indigo-900 text-white shadow-md border-b border-violet-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              className="lg:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <TeamAvatarArt avatar={team.avatar} size={42} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg truncate">{team.name}</span>
                <Crown className="w-4 h-4 text-amber-300 shrink-0 hidden sm:inline" />
              </div>
              <p className="text-xs text-violet-200 truncate">
                {team.members.map((m) => m.nickname).join(' • ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3.5 py-1.5 rounded-xl bg-indigo-950/80 border border-amber-300/40 flex items-center gap-2 font-mono-num">
              <Coins className="w-4 h-4 text-amber-300" />
              <span className="text-sm font-extrabold text-amber-300">{team.coins.toLocaleString()}</span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex gap-6">
        {/* Desktop Sidebar matching Screen 3 */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0">
          <nav className="bg-white rounded-3xl border border-violet-200 shadow-sm p-3 space-y-1 sticky top-24">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-violet-700 to-indigo-700 text-white shadow-sm'
                      : 'text-indigo-950 hover:bg-violet-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-300' : 'text-violet-700'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden bg-indigo-950/60 backdrop-blur-sm">
            <div className="w-72 h-full bg-white p-4 space-y-2 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-violet-100">
                <span className="font-extrabold text-indigo-950">Quiztopia Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-violet-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {NAV_ITEMS.map((item) => {
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
                      active ? 'bg-violet-700 text-white' : 'text-indigo-950 hover:bg-violet-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active View */}
        <main className="flex-1 min-w-0">
          {tab === 'dashboard' && (
            <TeamDashboard
              data={dashData}
              onNavigate={(nextTab) => setTab(nextTab)}
              onJoinActiveQuiz={(sid) => {
                setJoinSessionId(sid);
                setTab('quiz');
              }}
            />
          )}
          {tab === 'island' && (
            <TeamIslandView
              onGoToShop={() => setTab('shop')}
              onIslandUpdated={() => void refreshDashboard()}
            />
          )}
          {tab === 'avatar' && <AvatarCreator team={team} onSaved={handleAvatarSaved} />}
          {tab === 'quiz' && (
            <QuizArena
              team={team}
              activeSessions={dashData.activeSessions}
              initialSessionId={joinSessionId}
              onQuizFinished={() => {
                setJoinSessionId(null);
                void refreshDashboard();
              }}
            />
          )}
          {tab === 'shop' && <PetShopView onPurchaseComplete={() => void refreshDashboard()} />}
          {tab === 'collection' && <CollectionView onGoToShop={() => setTab('shop')} />}
          {tab === 'leaderboard' && <LeaderboardView currentTeamId={team.id} />}
          {tab === 'achievements' && <AchievementsView />}
        </main>
      </div>
    </div>
  );
}
