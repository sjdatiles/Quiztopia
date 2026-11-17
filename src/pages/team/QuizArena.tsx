import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Gamepad2,
  Lock,
  Sparkles,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { apiFetch, useQuizSocket } from '../../lib/api.ts';
import type { QuizSessionPublicState, TeamSummary } from '../../../shared/types.ts';
import { QUIZ_SKY_IMG, TeamAvatarArt } from '../../components/FantasyArt.tsx';

const ACTIVE_QUIZ_STORAGE_KEY = 'quiztopia_active_session_id';

const OPTION_STYLES = [
  { letter: 'A', bg: 'from-sky-500 to-blue-600', hover: 'hover:brightness-110', ring: 'ring-sky-300' },
  { letter: 'B', bg: 'from-emerald-500 to-green-600', hover: 'hover:brightness-110', ring: 'ring-emerald-300' },
  { letter: 'C', bg: 'from-violet-500 to-purple-700', hover: 'hover:brightness-110', ring: 'ring-violet-300' },
  { letter: 'D', bg: 'from-orange-400 to-amber-600', hover: 'hover:brightness-110', ring: 'ring-amber-300' },
];

export function QuizArena({
  team,
  activeSessions,
  initialSessionId,
  onQuizFinished,
}: {
  team: TeamSummary;
  activeSessions: { id: string; quizTitle: string; subject: string; pinCode: string; status: string }[];
  initialSessionId: string | null;
  onQuizFinished: () => void;
}) {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return initialSessionId || localStorage.getItem(ACTIVE_QUIZ_STORAGE_KEY);
  });
  const [pinInput, setPinInput] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [skyFailed, setSkyFailed] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  const { liveState, setLiveState, connected } = useQuizSocket(sessionId);

  // Sync initialSessionId prop if changed from Dashboard
  useEffect(() => {
    if (initialSessionId && initialSessionId !== sessionId) {
      void joinById(initialSessionId);
    }
  }, [initialSessionId]);

  // Recover session on refresh
  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem(ACTIVE_QUIZ_STORAGE_KEY, sessionId);
    apiFetch<{ state: QuizSessionPublicState }>(`/api/team/quiz/sessions/${sessionId}`)
      .then((res) => {
        setLiveState(res.state);
        setClockOffsetMs(res.state.serverNow - Date.now());
      })
      .catch(() => {
        localStorage.removeItem(ACTIVE_QUIZ_STORAGE_KEY);
        setSessionId(null);
      });
  }, [sessionId]);

  // Update clock offset whenever WebSocket pushes new state
  useEffect(() => {
    if (liveState?.serverNow) {
      setClockOffsetMs(liveState.serverNow - Date.now());
    }
    if (liveState?.status === 'finished') {
      onQuizFinished();
    }
  }, [liveState?.serverNow, liveState?.status, liveState?.currentQuestion?.id]);

  // Reset selected option when advancing to a new question
  useEffect(() => {
    setSelectedOptionId(null);
    setError('');
  }, [liveState?.currentQuestion?.id]);

  // Tick local display timer against server offset
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!liveState?.questionEndsAt || liveState.questionRevealed) return 0;
    const serverNowEstimate = nowMs + clockOffsetMs;
    return Math.max(0, Math.ceil((liveState.questionEndsAt - serverNowEstimate) / 1000));
  }, [liveState?.questionEndsAt, liveState?.questionRevealed, nowMs, clockOffsetMs]);

  const joinByPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setJoining(true);
    try {
      const res = await apiFetch<{ sessionId: string; state: QuizSessionPublicState }>('/api/team/quiz/join', {
        method: 'POST',
        body: JSON.stringify({ pinCode: pinInput }),
      });
      localStorage.setItem(ACTIVE_QUIZ_STORAGE_KEY, res.sessionId);
      setSessionId(res.sessionId);
      setLiveState(res.state);
    } catch (err: any) {
      setError(err?.message || 'Unable to join with that PIN.');
    } finally {
      setJoining(false);
    }
  };

  const joinById = async (targetSessionId: string) => {
    setError('');
    setJoining(true);
    try {
      const res = await apiFetch<{ sessionId: string; state: QuizSessionPublicState }>('/api/team/quiz/join', {
        method: 'POST',
        body: JSON.stringify({ sessionId: targetSessionId }),
      });
      localStorage.setItem(ACTIVE_QUIZ_STORAGE_KEY, res.sessionId);
      setSessionId(res.sessionId);
      setLiveState(res.state);
    } catch (err: any) {
      setError(err?.message || 'Unable to join quiz session.');
    } finally {
      setJoining(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!liveState?.currentQuestion || !selectedOptionId || !sessionId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch<{ state: QuizSessionPublicState }>(`/api/team/quiz/sessions/${sessionId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          questionId: liveState.currentQuestion.id,
          optionId: selectedOptionId,
        }),
      });
      setLiveState(res.state);
    } catch (err: any) {
      setError(err?.message || 'Could not submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const leaveFinishedQuiz = () => {
    localStorage.removeItem(ACTIVE_QUIZ_STORAGE_KEY);
    setSessionId(null);
    setLiveState(null);
    onQuizFinished();
  };

  // 1. Join Screen (when not inside a session)
  if (!sessionId || !liveState) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Gamepad2 className="w-6 h-6 text-violet-700" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-indigo-950">Quiz Arena</h1>
              <p className="text-sm text-slate-600">
                Discuss every question together, then Captain <strong>{team.captainName}</strong> locks your answer!
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={joinByPin} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter 6-digit Quiz PIN"
              className="flex-1 px-4 py-3 rounded-xl border border-violet-300 bg-violet-50/40 font-mono-num text-lg font-bold tracking-widest text-indigo-950 focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
            <button
              type="submit"
              disabled={joining}
              className="px-6 py-3 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              {joining ? 'Joining...' : 'Join with PIN'}
            </button>
          </form>

          {activeSessions.length > 0 && (
            <div className="pt-4 border-t border-violet-100 space-y-3">
              <p className="text-xs font-bold text-slate-600">Open Classroom Competitions</p>
              <div className="space-y-2.5">
                {activeSessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-2xl bg-violet-50 border border-violet-200 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-indigo-950">{s.quizTitle}</p>
                      <p className="text-xs text-slate-600">
                        {s.subject} · PIN <span className="font-mono-num font-bold text-violet-800">{s.pinCode}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={joining}
                      onClick={() => joinById(s.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                    >
                      Join Lobby
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Quiz Lobby (Waiting for Teacher to Start)
  if (liveState.status === 'lobby') {
    return (
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-violet-400/40 bg-indigo-950 text-white p-6 sm:p-10 space-y-8">
        {!skyFailed && (
          <img
            src={QUIZ_SKY_IMG}
            alt="Twilight cosmic quiz lobby"
            referrerPolicy="no-referrer"
            onError={() => setSkyFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        )}
        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-300">
                {liveState.subject} · PIN {liveState.pinCode} · {connected ? 'Live Sync Connected' : 'Reconnecting...'}
              </p>
              <h1 className="text-3xl font-extrabold mt-1">{liveState.quizTitle}</h1>
              <p className="text-sm text-violet-200 mt-1">
                Waiting for your teacher to launch Question 1 ({liveState.totalQuestions} questions total).
              </p>
            </div>
            <button
              type="button"
              onClick={leaveFinishedQuiz}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold"
            >
              Exit Lobby
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
              <Users className="w-4 h-4" />
              <span>Joined Teams ({liveState.participants.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {liveState.participants.map((p) => (
                <div
                  key={p.teamId}
                  className={`p-3 rounded-xl flex items-center gap-3 border ${
                    p.teamId === team.id
                      ? 'bg-violet-700/80 border-amber-300'
                      : 'bg-indigo-900/70 border-white/15'
                  }`}
                >
                  <TeamAvatarArt avatar={p.avatar} size={40} />
                  <span className="font-bold text-sm truncate">{p.teamName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Quiz Finished Results Screen matching Screen 6
  if (liveState.status === 'finished') {
    const results = liveState.results || [];
    const myResult = results.find((r) => r.teamId === team.id);

    return (
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-violet-400/40 bg-indigo-950 text-white p-6 sm:p-10">
        {!skyFailed && (
          <img
            src={QUIZ_SKY_IMG}
            alt="Starry celebration backdrop"
            referrerPolicy="no-referrer"
            onError={() => setSkyFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        )}
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-400/20 border-2 border-amber-300 flex items-center justify-center mx-auto">
            <Trophy className="w-10 h-10 text-amber-300" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-amber-300 quiztopia-wordmark">
              Quiz Complete!
            </h1>
            <p className="text-violet-100 mt-1">
              Great teamwork! {myResult ? `You earned +${myResult.coinsAwarded} coins!` : ''}
            </p>
          </div>

          <div className="bg-white/95 text-indigo-950 rounded-3xl shadow-xl overflow-hidden border border-violet-200">
            <div className="grid grid-cols-12 px-5 py-3 bg-violet-100 text-xs font-bold text-violet-900">
              <div className="col-span-2 text-left">Rank</div>
              <div className="col-span-6 text-left">Team</div>
              <div className="col-span-2 text-right">Correct</div>
              <div className="col-span-2 text-right">Score</div>
            </div>
            <div className="divide-y divide-violet-100">
              {results.map((r) => (
                <div
                  key={r.teamId}
                  className={`grid grid-cols-12 items-center px-5 py-3.5 text-sm ${
                    r.teamId === team.id ? 'bg-amber-50 font-bold' : ''
                  }`}
                >
                  <div className="col-span-2 flex items-center gap-1.5 font-mono-num font-bold">
                    {r.rank === 1 && <Crown className="w-4 h-4 text-amber-500" />}
                    <span>#{r.rank}</span>
                  </div>
                  <div className="col-span-6 flex items-center gap-2.5 text-left min-w-0">
                    <TeamAvatarArt avatar={r.avatar} size={34} />
                    <span className="truncate">{r.teamName}</span>
                  </div>
                  <div className="col-span-2 text-right font-mono-num text-slate-600">
                    {r.correctCount}/{r.totalQuestions}
                  </div>
                  <div className="col-span-2 text-right font-mono-num font-extrabold text-violet-800">
                    {r.totalScore}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={leaveFinishedQuiz}
            className="px-8 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-base shadow-lg transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // 4. Live Question Screen matching Screen 5
  const q = liveState.currentQuestion;
  const myParticipant = liveState.participants.find((p) => p.teamId === team.id);
  const mySubmission = liveState.mySubmission;
  const isLocked = Boolean(mySubmission);
  const timeExpired = !liveState.questionRevealed && secondsLeft <= 0 && Boolean(liveState.questionEndsAt);

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-violet-400/40 bg-indigo-950 text-white p-5 sm:p-8 space-y-6">
      {!skyFailed && (
        <img
          src={QUIZ_SKY_IMG}
          alt="Cosmic live quiz background"
          referrerPolicy="no-referrer"
          onError={() => setSkyFailed(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
      )}
      <div className="relative z-10 space-y-6">
        {/* Top Live Quiz HUD */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TeamAvatarArt avatar={team.avatar} size={46} />
            <div>
              <p className="font-bold text-sm sm:text-base">{team.name}</p>
              <p className="text-xs text-amber-300 font-mono-num font-bold">
                Score: {myParticipant?.score ?? 0}
              </p>
            </div>
          </div>

          {/* Center Countdown Ring */}
          <div
            className={`w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center font-mono-num shadow-lg ${
              secondsLeft <= 5 && !liveState.questionRevealed
                ? 'border-red-400 bg-red-950/70 text-red-200'
                : 'border-amber-400 bg-indigo-950/85 text-amber-300'
            }`}
          >
            <span className="text-xl font-extrabold leading-none">
              {liveState.questionRevealed ? '—' : secondsLeft}
            </span>
            <span className="text-[10px] uppercase tracking-wider">sec</span>
          </div>

          <div className="text-right">
            <p className="px-3.5 py-1.5 rounded-xl bg-white/15 font-mono-num font-bold text-sm">
              Q {liveState.currentQuestionIndex + 1} / {liveState.totalQuestions}
            </p>
            <p className="text-[11px] text-violet-200 mt-1">
              {connected ? 'Live Sync' : 'Reconnecting'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-300/40 text-red-100 text-sm font-semibold text-center">
            {error}
          </div>
        )}

        {q ? (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Question Card */}
            <div className="bg-white text-indigo-950 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-2">
              <p className="text-xs font-bold text-violet-700">
                {q.points} Points · {liveState.speedBonusEnabled ? 'Discussion + Speed Bonus' : 'Accuracy Scoring'}
              </p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-indigo-950 text-balance">
                {q.prompt}
              </h2>
            </div>

            {/* 2x2 Color-Coded Answer Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {q.options.map((opt, idx) => {
                const style = OPTION_STYLES[idx % OPTION_STYLES.length];
                const isSelected = isLocked
                  ? mySubmission?.optionId === opt.id
                  : selectedOptionId === opt.id;
                const isRevealed = liveState.questionRevealed;
                const isCorrectOpt = Boolean(opt.isCorrect);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isLocked || isRevealed || timeExpired}
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`relative p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${style.bg} text-white text-left font-bold shadow-lg transition-all flex items-center justify-between gap-3 ${
                      !isLocked && !isRevealed && !timeExpired ? `${style.hover} cursor-pointer` : 'cursor-default'
                    } ${isSelected ? 'ring-4 ring-white scale-[1.01]' : 'opacity-95'} ${
                      isRevealed && !isCorrectOpt ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center font-extrabold shrink-0">
                        {style.letter}
                      </span>
                      <span className="text-base sm:text-lg leading-snug">{opt.label}</span>
                    </div>

                    {isSelected && !isRevealed && <Check className="w-6 h-6 shrink-0" />}
                    {isRevealed && isCorrectOpt && <CheckCircle2 className="w-6 h-6 shrink-0 text-white" />}
                    {isRevealed && isSelected && !isCorrectOpt && <XCircle className="w-6 h-6 shrink-0 text-red-100" />}
                  </button>
                );
              })}
            </div>

            {/* Captain Lock-in Button / Status */}
            <div className="flex flex-col items-center gap-2 pt-1">
              {!isLocked && !liveState.questionRevealed && !timeExpired && (
                <button
                  type="button"
                  disabled={!selectedOptionId || submitting}
                  onClick={handleSubmitAnswer}
                  className="px-10 py-3.5 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white font-extrabold text-lg shadow-xl transition-all disabled:opacity-50"
                >
                  {submitting ? 'Locking Answer...' : 'Submit Answer'}
                </button>
              )}

              {isLocked && !liveState.questionRevealed && (
                <div className="px-6 py-3 rounded-2xl bg-emerald-500/25 border border-emerald-300/50 text-emerald-100 font-bold text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Answer locked in! Waiting for teacher to reveal results...</span>
                </div>
              )}

              {!isLocked && timeExpired && !liveState.questionRevealed && (
                <div className="px-6 py-3 rounded-2xl bg-amber-500/25 border border-amber-300/50 text-amber-100 font-bold text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Time&apos;s up! Waiting for teacher to reveal the answer...</span>
                </div>
              )}

              {liveState.questionRevealed && (
                <div className="px-6 py-3 rounded-2xl bg-white/15 border border-white/25 text-white font-bold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {mySubmission
                      ? mySubmission.isCorrect
                        ? `Correct! +${mySubmission.pointsAwarded} points earned`
                        : 'Not quite! Discuss and get ready for the next question'
                      : 'No answer submitted for this question. Ready for the next one!'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-violet-200">Loading active question...</div>
        )}
      </div>
    </div>
  );
}
