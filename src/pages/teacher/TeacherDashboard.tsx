import React, { useEffect, useState } from 'react';
import { BarChart3, Calendar, FileText, GraduationCap, Play, PlusCircle, Trophy, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';

interface OverviewResponse {
  stats: {
    totalClasses: number;
    totalTeams: number;
    totalQuizzes: number;
    quizzesThisTerm: number;
    activeTermNumber: number;
    academicYearLabel: string;
  };
  classes: { id: string; name: string; gradeLevel: string; activeTermNumber: number }[];
  recentSessions: {
    id: string;
    quizTitle: string;
    subject: string;
    pinCode: string;
    status: string;
    createdAt: string;
  }[];
}

export function TeacherDashboard({
  teacherName,
  onNavigate,
  onOpenSession,
}: {
  teacherName: string;
  onNavigate: (tab: 'dashboard' | 'classes' | 'quizzes' | 'live' | 'shop' | 'reports') => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const [data, setData] = useState<OverviewResponse | null>(null);

  useEffect(() => {
    apiFetch<OverviewResponse>('/api/teacher/overview').then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading Teacher Dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header matching Screen 7 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-indigo-950">Teacher Dashboard</h1>
          <p className="text-sm text-slate-600">
            Manage your classes, teams, and live quizzes · Welcome, <strong>{teacherName}</strong>
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-violet-100 text-violet-900 text-xs font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-700" />
          <span>
            {data.stats.academicYearLabel} · Term {data.stats.activeTermNumber} Active
          </span>
        </div>
      </div>

      {/* 3 KPI Cards + Quick Actions matching Screen 7 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 flex flex-col items-center text-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-600">My Classes</p>
          <p className="text-4xl font-extrabold font-mono-num text-indigo-950">{data.stats.totalClasses}</p>
        </div>

        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 flex flex-col items-center text-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Total Teams</p>
          <p className="text-4xl font-extrabold font-mono-num text-indigo-950">{data.stats.totalTeams}</p>
        </div>

        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 flex flex-col items-center text-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Quizzes This Term</p>
          <p className="text-4xl font-extrabold font-mono-num text-indigo-950">{data.stats.quizzesThisTerm}</p>
        </div>

        {/* Quick Actions Card matching Screen 7 */}
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-5 space-y-2.5">
          <p className="text-sm font-bold text-indigo-950">Quick Actions</p>
          <button
            type="button"
            onClick={() => onNavigate('quizzes')}
            className="w-full py-2.5 px-3.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-violet-700" />
            <span>Create Quiz</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="w-full py-2.5 px-3.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <BarChart3 className="w-4 h-4 text-sky-600" />
            <span>View Reports</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('classes')}
            className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Manage Teams &amp; Terms</span>
          </button>
        </div>
      </div>

      {/* Recent Quiz Activity */}
      <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-indigo-950 flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-700" />
            <span>Recent Live Quiz Sessions</span>
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('quizzes')}
            className="text-xs font-bold text-violet-700 hover:underline"
          >
            Host a Quiz →
          </button>
        </div>

        {data.recentSessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 bg-violet-50/50 rounded-2xl">
            No live quiz sessions hosted yet. Open Quizzes to launch your first classroom competition!
          </div>
        ) : (
          <div className="divide-y divide-violet-100">
            {data.recentSessions.map((s) => (
              <div key={s.id} className="py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-indigo-950">{s.quizTitle}</p>
                  <p className="text-xs text-slate-500">
                    {s.subject} · PIN <span className="font-mono-num font-bold">{s.pinCode}</span> · Status:{' '}
                    <span className="capitalize font-semibold">{s.status}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenSession(s.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{s.status === 'finished' ? 'View Results' : 'Open Control Room'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
