import React, { useEffect, useState } from 'react';
import { Award, Crown, Medal, Trophy } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { AvatarConfig, QuizResultEntry, TermRankingEntry } from '../../../shared/types.ts';
import { TeamAvatarArt } from '../../components/FantasyArt.tsx';

interface LeaderboardData {
  activeTermNumber: number;
  academicYearLabel: string;
  currentTermStandings: {
    rank: number;
    teamId: string;
    teamName: string;
    avatar: AvatarConfig;
    termPower: number;
    lifetimePower: number;
  }[];
  academicYearStandings: {
    rank: number;
    teamId: string;
    teamName: string;
    avatar: AvatarConfig;
    termPower: number;
    lifetimePower: number;
  }[];
  previousTerms: TermRankingEntry[];
  latestQuizTitle: string | null;
  latestQuizStandings: QuizResultEntry[];
}

export function LeaderboardView({ currentTeamId }: { currentTeamId: string }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [tab, setTab] = useState<'term' | 'year' | 'archive' | 'quiz'>('term');

  useEffect(() => {
    apiFetch<LeaderboardData>('/api/team/leaderboards').then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading classroom leaderboards...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-indigo-950">Classroom Leaderboards</h1>
        <p className="text-sm text-slate-600">
          Academic Year {data.academicYearLabel} · Term {data.activeTermNumber} Active Season
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-violet-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('term')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap ${
            tab === 'term' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900'
          }`}
        >
          Term {data.activeTermNumber} Island Power
        </button>
        <button
          type="button"
          onClick={() => setTab('year')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap ${
            tab === 'year' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900'
          }`}
        >
          Academic Year Standings
        </button>
        <button
          type="button"
          onClick={() => setTab('quiz')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap ${
            tab === 'quiz' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900'
          }`}
        >
          Latest Quiz
        </button>
        <button
          type="button"
          onClick={() => setTab('archive')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap ${
            tab === 'archive' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900'
          }`}
        >
          Previous Terms
        </button>
      </div>

      {tab === 'term' && (
        <StandingsCard
          title={`Term ${data.activeTermNumber} Competitive Island Power`}
          icon={<Crown className="w-5 h-5 text-amber-500" />}
          rows={data.currentTermStandings.map((r) => ({
            rank: r.rank,
            teamId: r.teamId,
            teamName: r.teamName,
            avatar: r.avatar,
            valueLabel: `${r.termPower.toLocaleString()} PWR`,
          }))}
          currentTeamId={currentTeamId}
        />
      )}

      {tab === 'year' && (
        <StandingsCard
          title={`Academic Year Champion Race (${data.academicYearLabel})`}
          icon={<Trophy className="w-5 h-5 text-violet-700" />}
          rows={data.academicYearStandings.map((r) => ({
            rank: r.rank,
            teamId: r.teamId,
            teamName: r.teamName,
            avatar: r.avatar,
            valueLabel: `${r.lifetimePower.toLocaleString()} Lifetime PWR`,
          }))}
          currentTeamId={currentTeamId}
        />
      )}

      {tab === 'quiz' && (
        data.latestQuizStandings.length === 0 ? (
          <div className="p-10 bg-white rounded-3xl border border-violet-200 text-center text-slate-500">
            No classroom quizzes have finished yet this season.
          </div>
        ) : (
          <StandingsCard
            title={data.latestQuizTitle || 'Latest Quiz Standings'}
            icon={<Medal className="w-5 h-5 text-sky-600" />}
            rows={data.latestQuizStandings.map((r) => ({
              rank: r.rank,
              teamId: r.teamId,
              teamName: r.teamName,
              avatar: r.avatar,
              valueLabel: `${r.totalScore} pts`,
            }))}
            currentTeamId={currentTeamId}
          />
        )
      )}

      {tab === 'archive' && (
        data.previousTerms.length === 0 ? (
          <div className="p-10 bg-white rounded-3xl border border-violet-200 text-center text-slate-500">
            Term 1 is still underway! Completed term champions and archives will appear here when a term closes.
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-violet-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-violet-100 flex items-center gap-2 font-bold text-indigo-950">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Archived Term Champions &amp; Standings</span>
            </div>
            <div className="divide-y divide-violet-100">
              {data.previousTerms.map((entry) => (
                <div
                  key={entry.id}
                  className={`px-6 py-3.5 flex items-center justify-between gap-4 ${
                    entry.teamId === currentTeamId ? 'bg-amber-50/70' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-violet-700 shrink-0">
                      Term {entry.termNumber}
                    </span>
                    <span className="font-mono-num font-bold text-sm text-indigo-950 shrink-0">
                      #{entry.finalRank}
                    </span>
                    <TeamAvatarArt avatar={entry.avatar} size={36} />
                    <span className="font-bold text-sm text-indigo-950 truncate">{entry.teamName}</span>
                    {entry.isChampion && (
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1 shrink-0">
                        <Crown className="w-3.5 h-3.5" /> Champion
                      </span>
                    )}
                  </div>
                  <span className="font-mono-num font-extrabold text-sm text-violet-800 shrink-0">
                    {entry.finalIslandPower.toLocaleString()} PWR
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function StandingsCard({
  title,
  icon,
  rows,
  currentTeamId,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { rank: number; teamId: string; teamName: string; avatar: AvatarConfig; valueLabel: string }[];
  currentTeamId: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-violet-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-violet-50/70 border-b border-violet-100 flex items-center gap-2.5 font-bold text-indigo-950">
        {icon}
        <span>{title}</span>
      </div>
      <div className="divide-y divide-violet-100">
        {rows.map((r) => (
          <div
            key={r.teamId}
            className={`px-6 py-4 flex items-center justify-between gap-4 ${
              r.teamId === currentTeamId ? 'bg-amber-50/80' : ''
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 text-center font-mono-num font-extrabold text-base text-indigo-950 shrink-0">
                {r.rank === 1 ? <Crown className="w-5 h-5 text-amber-500 mx-auto" /> : `#${r.rank}`}
              </div>
              <TeamAvatarArt avatar={r.avatar} size={42} />
              <div className="min-w-0">
                <p className="font-bold text-indigo-950 truncate">
                  {r.teamName} {r.teamId === currentTeamId ? '(Your Team)' : ''}
                </p>
              </div>
            </div>
            <span className="font-mono-num font-extrabold text-sm sm:text-base text-violet-800 shrink-0">
              {r.valueLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
