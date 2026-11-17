import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  Flag,
  Play,
  Trophy,
  Users,
} from 'lucide-react';
import { apiFetch, useQuizSocket } from '../../lib/api.ts';
import type { QuizSessionPublicState } from '../../../shared/types.ts';
import { TeamAvatarArt } from '../../components/FantasyArt.tsx';

export function TeacherLiveHost({
  initialSessionId,
  onGoToQuizzes,
}: {
  initialSessionId: string | null;
  onGoToQuizzes: () => void;
}) {
  const [activeSessions, setActiveSessions] = useState<
    { id: string; quizTitle: string; subject: string; pinCode: string; status: string }[]
  >([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const { liveState, setLiveState, connected } = useQuizSocket(
    sessionId,
    sessionId ? `/api/teacher/sessions/${sessionId}` : undefined
  );
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialSessionId) setSessionId(initialSessionId);
  }, [initialSessionId]);

  useEffect(() => {
    apiFetch<{ sessions: typeof activeSessions }>('/api/teacher/sessions/active').then((r) => {
      setActiveSessions(r.sessions);
      if (!sessionId && r.sessions.length > 0) {
        setSessionId(r.sessions[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    apiFetch<{ state: QuizSessionPublicState }>(`/api/teacher/sessions/${sessionId}`).then((r) => {
      setLiveState(r.state);
      setClockOffsetMs(r.state.serverNow - Date.now());
    });
  }, [sessionId]);

  useEffect(() => {
    if (liveState?.serverNow) setClockOffsetMs(liveState.serverNow - Date.now());
  }, [liveState?.serverNow]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!liveState?.questionEndsAt || liveState.questionRevealed) return 0;
    return Math.max(0, Math.ceil((liveState.questionEndsAt - (nowMs + clockOffsetMs)) / 1000));
  }, [liveState?.questionEndsAt, liveState?.questionRevealed, nowMs, clockOffsetMs]);

  const sendAction = async (action: 'start' | 'reveal' | 'next' | 'end') => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ state: QuizSessionPublicState }>(`/api/teacher/sessions/${sessionId}/control`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setLiveState(res.state);
    } finally {
      setBusy(false);
    }
  };

  if (!sessionId || !liveState) {
    return (
      <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-10 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-indigo-950">Live Quiz Control Room</h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          No live quiz session is currently selected. Choose a published quiz to generate a classroom PIN and launch a competition!
        </p>
        <button
          type="button"
          onClick={onGoToQuizzes}
          className="px-6 py-3 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-sm"
        >
          Go to Quizzes
        </button>
      </div>
    );
  }

  const submittedCount = liveState.participants.filter((p) => p.hasAnsweredCurrent).length;

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-violet-900 to-indigo-900 text-white rounded-3xl p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-amber-300">
            {liveState.subject} · Term {liveState.termNumber} · {connected ? 'Real-Time Sync Active' : 'Connecting...'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-0.5">{liveState.quizTitle}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-5 py-2.5 rounded-2xl bg-white/15 border border-amber-300/40 text-center">
            <p className="text-[11px] text-violet-200 font-semibold">CLASSROOM PIN</p>
            <p className="text-2xl font-mono-num font-extrabold tracking-widest text-amber-300">
              {liveState.pinCode}
            </p>
          </div>
        </div>
      </div>

      {/* Lobby View */}
      {liveState.status === 'lobby' && (
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-indigo-950 flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-700" />
                <span>Teams in Lobby ({liveState.participants.length})</span>
              </h2>
              <p className="text-xs text-slate-600">
                Have each team log into Quiztopia on their device and enter PIN <strong>{liveState.pinCode}</strong>.
              </p>
            </div>

            <button
              type="button"
              disabled={busy || liveState.participants.length === 0}
              onClick={() => sendAction('start')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>Start Quiz ({liveState.totalQuestions} Questions)</span>
            </button>
          </div>

          {liveState.participants.length === 0 ? (
            <div className="py-10 text-center rounded-2xl bg-violet-50/70 text-slate-500 text-sm">
              Waiting for teams to join the lobby...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {liveState.participants.map((p) => (
                <div key={p.teamId} className="p-4 rounded-2xl bg-violet-50 border border-violet-200 flex items-center gap-3">
                  <TeamAvatarArt avatar={p.avatar} size={42} />
                  <span className="font-bold text-indigo-950 truncate">{p.teamName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Question Monitor */}
      {liveState.status === 'active' && liveState.currentQuestion && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1.5 rounded-xl bg-violet-100 text-violet-900 font-mono-num font-bold text-sm">
                  Question {liveState.currentQuestionIndex + 1} / {liveState.totalQuestions}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-mono-num font-bold text-amber-600">
                  <Clock className="w-4 h-4" />
                  {liveState.questionRevealed ? 'Revealed' : `${secondsLeft}s remaining`}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Submissions: {submittedCount} / {liveState.participants.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!liveState.questionRevealed && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => sendAction('reveal')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-bold text-xs"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Reveal Answer</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => sendAction('next')}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs shadow-sm"
                >
                  <span>
                    {liveState.currentQuestionIndex + 1 >= liveState.totalQuestions
                      ? 'Finish & Award Coins'
                      : 'Next Question'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => sendAction('end')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>End Early</span>
                </button>
              </div>
            </div>

            <h2 className="text-xl font-extrabold text-indigo-950">{liveState.currentQuestion.prompt}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {liveState.currentQuestion.options.map((opt, idx) => (
                <div
                  key={opt.id}
                  className={`p-3.5 rounded-2xl border text-sm font-bold flex items-center justify-between ${
                    opt.isCorrect
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span>
                    {String.fromCharCode(65 + idx)}. {opt.label}
                  </span>
                  {opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
              ))}
            </div>
          </div>

          {/* Live Participating Teams & Submission Status */}
          <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-3">
            <h3 className="font-bold text-indigo-950">Team Participation &amp; Live Scores</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {liveState.participants.map((p) => (
                <div
                  key={p.teamId}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${
                    p.hasAnsweredCurrent ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TeamAvatarArt avatar={p.avatar} size={36} />
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-indigo-950 truncate">{p.teamName}</p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {p.hasAnsweredCurrent ? 'Submitted' : 'Thinking...'}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-num font-extrabold text-sm text-violet-800">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Finished Results View */}
      {liveState.status === 'finished' && (
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-7 h-7 text-amber-500" />
              <div>
                <h2 className="text-xl font-extrabold text-indigo-950">Final Quiz Standings &amp; Coins Credited</h2>
                <p className="text-xs text-slate-500">All team coins, quiz histories, and achievements have been updated.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onGoToQuizzes}
              className="px-4 py-2 rounded-xl bg-violet-700 text-white text-xs font-bold"
            >
              Back to Quizzes
            </button>
          </div>

          <div className="divide-y divide-violet-100">
            {(liveState.results || []).map((r) => (
              <div key={r.teamId} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 font-mono-num font-extrabold text-indigo-950 flex items-center gap-1">
                    {r.rank === 1 && <Crown className="w-4 h-4 text-amber-500" />}#{r.rank}
                  </span>
                  <TeamAvatarArt avatar={r.avatar} size={38} />
                  <div>
                    <p className="font-bold text-sm text-indigo-950">{r.teamName}</p>
                    <p className="text-xs text-slate-500">
                      {r.correctCount}/{r.totalQuestions} correct
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono-num">
                  <p className="font-extrabold text-sm text-violet-800">{r.totalScore} pts</p>
                  <p className="text-xs font-bold text-amber-600">+{r.coinsAwarded} coins</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
