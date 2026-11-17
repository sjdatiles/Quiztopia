import React, { useState } from 'react';
import { ArrowRight, Award, Calendar, Coins, Crown, Gamepad2, Sparkles, Star, Trophy } from 'lucide-react';
import type { Achievement, QuizResultEntry, TeamSummary } from '../../../shared/types.ts';
import { ISLAND_SCENE_IMG, TeamAvatarArt } from '../../components/FantasyArt.tsx';

export interface TeamDashboardData {
  team: TeamSummary;
  classroom: {
    id: string;
    name: string;
    gradeLevel: string;
    academicYearLabel: string;
    activeTermNumber: 1 | 2 | 3;
  } | null;
  currentRank: number;
  totalTeamsInClass: number;
  recentResults: (QuizResultEntry & { quizTitle?: string; finishedAt?: string })[];
  recentAchievements: { id: string; unlockedAt: string; achievement?: Achievement }[];
  activeSessions: { id: string; quizTitle: string; subject: string; pinCode: string; status: string }[];
}

export function TeamDashboard({
  data,
  onNavigate,
  onJoinActiveQuiz,
}: {
  data: TeamDashboardData;
  onNavigate: (tab: 'dashboard' | 'island' | 'quiz' | 'shop' | 'collection' | 'leaderboard' | 'achievements' | 'avatar') => void;
  onJoinActiveQuiz: (sessionId: string) => void;
}) {
  const [islandFailed, setIslandFailed] = useState(false);
  const { team, classroom, currentRank, totalTeamsInClass, recentResults, recentAchievements, activeSessions } = data;

  return (
    <div className="space-y-6">
      {/* Hero Banner matching Screen 3 */}
      <div className="relative rounded-3xl overflow-hidden shadow-lg border border-violet-300/60 bg-gradient-to-br from-indigo-900 via-violet-800 to-sky-700 text-white">
        {!islandFailed && (
          <img
            src={ISLAND_SCENE_IMG}
            alt="Floating fantasy island hero"
            referrerPolicy="no-referrer"
            onError={() => setIslandFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/90 via-indigo-950/45 to-indigo-950/65" />

        <div className="relative z-10 p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                <Star className="w-4 h-4 fill-amber-300" />
                <span>
                  {classroom ? `${classroom.name} · Term ${classroom.activeTermNumber} (${classroom.academicYearLabel})` : 'Adventure Season'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Your Team&apos;s Journey
              </h1>
              <p className="text-violet-100 text-sm sm:text-base">
                Keep learning, keep shining! Captain today: <strong className="text-amber-300">{team.captainName}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('avatar')}
              className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-sm transition-colors"
            >
              <TeamAvatarArt avatar={team.avatar} size={44} />
              <div className="text-left">
                <p className="text-xs text-violet-200 font-medium">Shared Avatar</p>
                <p className="text-sm font-bold text-white">Customize Together</p>
              </div>
            </button>
          </div>

          {/* 3 Primary Stat Cards + Active Quiz Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/95 text-indigo-950 rounded-2xl p-4 shadow-md flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Season Rank</p>
                <p className="text-2xl font-extrabold font-mono-num text-indigo-950">
                  #{currentRank} <span className="text-xs font-semibold text-slate-400">/ {totalTeamsInClass}</span>
                </p>
              </div>
            </div>

            <div className="bg-white/95 text-indigo-950 rounded-2xl p-4 shadow-md flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Star className="w-6 h-6 text-violet-700 fill-violet-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Island Power</p>
                <p className="text-2xl font-extrabold font-mono-num text-indigo-950">
                  {team.island.termPower.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white/95 text-indigo-950 rounded-2xl p-4 shadow-md flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
                <Coins className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Team Coins</p>
                <p className="text-2xl font-extrabold font-mono-num text-indigo-950">
                  {team.coins.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Next / Live Quiz Card */}
            <div className="bg-white/95 text-indigo-950 rounded-2xl p-4 shadow-md flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-violet-700" />
                  <span className="text-xs font-bold text-violet-800">
                    {activeSessions.length > 0 ? 'Live Quiz Open' : 'Quiz Arena'}
                  </span>
                </div>
                {activeSessions.length > 0 && (
                  <span className="text-xs font-mono-num font-bold text-emerald-700">
                    PIN {activeSessions[0].pinCode}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-indigo-950 truncate">
                {activeSessions.length > 0 ? activeSessions[0].quizTitle : 'Join with Classroom PIN'}
              </p>
              <button
                type="button"
                onClick={() =>
                  activeSessions.length > 0
                    ? onJoinActiveQuiz(activeSessions[0].id)
                    : onNavigate('quiz')
                }
                className="w-full py-2 px-3 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>{activeSessions.length > 0 ? 'Join Live Quiz' : 'Open Quiz Arena'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('island')}
          className="text-left p-5 rounded-2xl bg-white border border-violet-200 hover:border-violet-400 shadow-sm transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-semibold text-violet-700">2D Floating World</p>
            <h3 className="text-lg font-bold text-indigo-950">Explore &amp; Build Our Island</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {team.members.map((m) => m.nickname).join(' · ')}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-violet-700 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('shop')}
          className="text-left p-5 rounded-2xl bg-white border border-violet-200 hover:border-amber-400 shadow-sm transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-semibold text-amber-600">Fantasy Economy</p>
            <h3 className="text-lg font-bold text-indigo-950">Visit Pet &amp; Island Shop</h3>
            <p className="text-xs text-slate-600 mt-0.5">Adopt original creatures &amp; buildings</p>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-600 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('leaderboard')}
          className="text-left p-5 rounded-2xl bg-white border border-violet-200 hover:border-sky-400 shadow-sm transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-semibold text-sky-600">Term Standings</p>
            <h3 className="text-lg font-bold text-indigo-950">Classroom Leaderboard</h3>
            <p className="text-xs text-slate-600 mt-0.5">Term races &amp; Year Champions</p>
          </div>
          <ArrowRight className="w-5 h-5 text-sky-600 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Recent Quiz Results + Recent Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-violet-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-indigo-950 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>Recent Quiz Results</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('quiz')}
              className="text-xs font-semibold text-violet-700 hover:underline"
            >
              Go to Quiz Arena
            </button>
          </div>

          {recentResults.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 bg-violet-50/50 rounded-xl">
              No quizzes completed yet. Join a live classroom quiz to earn your first coins!
            </div>
          ) : (
            <div className="divide-y divide-violet-100">
              {recentResults.map((r) => (
                <div key={`${r.teamId}-${r.totalScore}-${r.finishedAt}`} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm text-indigo-950">{r.quizTitle || 'Classroom Quiz'}</p>
                    <p className="text-xs text-slate-500">
                      Rank #{r.rank} · {r.correctCount}/{r.totalQuestions} correct
                    </p>
                  </div>
                  <div className="text-right font-mono-num">
                    <p className="text-sm font-bold text-violet-700">{r.totalScore} pts</p>
                    <p className="text-xs font-semibold text-amber-600">+{r.coinsAwarded} coins</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-violet-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-indigo-950 flex items-center gap-2">
              <Award className="w-5 h-5 text-violet-700" />
              <span>Recent Team Achievements</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('achievements')}
              className="text-xs font-semibold text-violet-700 hover:underline"
            >
              View All
            </button>
          </div>

          {recentAchievements.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 bg-violet-50/50 rounded-xl">
              Complete quizzes and adopt creatures together to unlock permanent team achievements!
            </div>
          ) : (
            <div className="space-y-3">
              {recentAchievements.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-violet-50/70 border border-violet-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-indigo-950">{item.achievement?.title}</p>
                      <p className="text-xs text-slate-600">{item.achievement?.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono-num text-violet-700 shrink-0">
                    +{item.achievement?.powerValue} PWR
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
