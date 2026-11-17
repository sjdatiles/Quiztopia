import React, { useEffect, useState } from 'react';
import { Award, BarChart3, Coins, Crown, Trophy } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { TermRankingEntry } from '../../../shared/types.ts';

interface ReportsResponse {
  teamAnalytics: {
    teamId: string;
    teamName: string;
    quizzesPlayed: number;
    accuracyPct: number;
    avgScore: number;
    coins: number;
    termPower: number;
    lifetimePower: number;
    creaturesOwned: number;
  }[];
  achievementDistribution: {
    id: string;
    title: string;
    unlockedByTeams: number;
  }[];
  quizHistory: {
    sessionId: string;
    quizTitle: string;
    subject: string;
    termNumber: number;
    participantsCount: number;
    avgScore: number;
    finishedAt: string;
  }[];
  archivedTerms: TermRankingEntry[];
}

export function TeacherReports() {
  const [data, setData] = useState<ReportsResponse | null>(null);

  useEffect(() => {
    apiFetch<ReportsResponse>('/api/teacher/reports').then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading classroom reports &amp; analytics...
      </div>
    );
  }

  const maxPower = Math.max(100, ...data.teamAnalytics.map((t) => t.lifetimePower));
  const maxCoins = Math.max(100, ...data.teamAnalytics.map((t) => t.coins));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-indigo-950">Reports &amp; Classroom Analytics</h1>
        <p className="text-sm text-slate-600">
          Track team quiz accuracy, participation, coin distribution, island power progression, and season archives.
        </p>
      </div>

      {/* Visual Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-indigo-950 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-700" />
            <span>Island Power Progression by Team</span>
          </h2>
          <div className="space-y-3">
            {data.teamAnalytics.map((t) => (
              <div key={t.teamId} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-indigo-950">{t.teamName}</span>
                  <span className="font-mono-num text-violet-700">
                    {t.termPower.toLocaleString()} term · {t.lifetimePower.toLocaleString()} lifetime
                  </span>
                </div>
                <div className="h-3 rounded-full bg-violet-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-sky-500"
                    style={{ width: `${Math.max(4, Math.round((t.lifetimePower / maxPower) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-indigo-950 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <span>Coin Wallet Distribution</span>
          </h2>
          <div className="space-y-3">
            {data.teamAnalytics.map((t) => (
              <div key={t.teamId} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-indigo-950">{t.teamName}</span>
                  <span className="font-mono-num text-amber-600">{t.coins.toLocaleString()} coins</span>
                </div>
                <div className="h-3 rounded-full bg-amber-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                    style={{ width: `${Math.max(4, Math.round((t.coins / maxCoins) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Quiz Performance Table */}
      <div className="bg-white rounded-3xl border border-violet-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-violet-100 font-bold text-indigo-950 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-violet-700" />
          <span>Team Performance &amp; Participation</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-violet-50/70 text-xs font-bold text-violet-900">
              <tr>
                <th className="px-6 py-3">Team</th>
                <th className="px-4 py-3 text-right">Quizzes</th>
                <th className="px-4 py-3 text-right">Accuracy</th>
                <th className="px-4 py-3 text-right">Avg Score</th>
                <th className="px-4 py-3 text-right">Creatures</th>
                <th className="px-6 py-3 text-right">Term Power</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-100">
              {data.teamAnalytics.map((t) => (
                <tr key={t.teamId} className="hover:bg-violet-50/40">
                  <td className="px-6 py-3.5 font-bold text-indigo-950">{t.teamName}</td>
                  <td className="px-4 py-3.5 text-right font-mono-num">{t.quizzesPlayed}</td>
                  <td className="px-4 py-3.5 text-right font-mono-num font-bold text-emerald-700">
                    {t.accuracyPct}%
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono-num">{t.avgScore}</td>
                  <td className="px-4 py-3.5 text-right font-mono-num">{t.creaturesOwned}</td>
                  <td className="px-6 py-3.5 text-right font-mono-num font-bold text-violet-800">
                    {t.termPower.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Achievement Distribution & Quiz History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-3">
          <h2 className="font-bold text-indigo-950 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Achievement Distribution</span>
          </h2>
          <div className="divide-y divide-violet-100">
            {data.achievementDistribution.map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-indigo-950">{a.title}</span>
                <span className="font-mono-num font-bold text-violet-700">
                  {a.unlockedByTeams} team{a.unlockedByTeams === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-3">
          <h2 className="font-bold text-indigo-950 flex items-center gap-2">
            <Crown className="w-5 h-5 text-violet-700" />
            <span>Completed Quiz History &amp; Archived Terms</span>
          </h2>
          {data.quizHistory.length === 0 && data.archivedTerms.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Completed quizzes and archived term standings will appear here.
            </p>
          ) : (
            <div className="divide-y divide-violet-100">
              {data.quizHistory.map((q) => (
                <div key={q.sessionId} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold text-indigo-950">{q.quizTitle}</p>
                    <p className="text-xs text-slate-500">
                      {q.subject} · Term {q.termNumber} · {q.participantsCount} teams
                    </p>
                  </div>
                  <span className="font-mono-num font-bold text-violet-700">Avg {q.avgScore} pts</span>
                </div>
              ))}
              {data.archivedTerms.filter((r) => r.isChampion).map((champ) => (
                <div key={champ.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold text-amber-700">Term {champ.termNumber} Champion</p>
                    <p className="text-xs text-slate-500">{champ.teamName}</p>
                  </div>
                  <span className="font-mono-num font-bold text-indigo-950">
                    {champ.finalIslandPower.toLocaleString()} PWR
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
