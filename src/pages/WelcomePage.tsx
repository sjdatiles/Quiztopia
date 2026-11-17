import React, { useState } from 'react';
import { ArrowRight, Crown, HelpCircle, Info, ShieldCheck, Sparkles, Trophy, Users, X } from 'lucide-react';
import { HERO_ISLAND_IMG, WIZARD_MASCOT_IMG } from '../components/FantasyArt.tsx';

export function WelcomePage({ onGetStarted }: { onGetStarted: () => void }) {
  const [modal, setModal] = useState<'how' | 'about' | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [mascotFailed, setMascotFailed] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col justify-between bg-gradient-to-b from-indigo-900 via-violet-800 to-sky-700 text-white">
      {/* Background Fantasy Island Illustration */}
      {!heroImgFailed && (
        <img
          src={HERO_ISLAND_IMG}
          alt="Quiztopia floating castle island"
          referrerPolicy="no-referrer"
          onError={() => setHeroImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/85 via-violet-950/60 to-indigo-950/35" />

      {/* Top clean header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <Crown className="w-7 h-7 text-amber-300 drop-shadow" />
          <span className="text-2xl font-extrabold tracking-tight text-amber-300 quiztopia-wordmark">
            Quiztopia
          </span>
        </div>

        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-violet-100">
          <button
            type="button"
            onClick={() => setModal('how')}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            How to Play
          </button>
          <button
            type="button"
            onClick={() => setModal('about')}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            About
          </button>
        </nav>

        <button
          type="button"
          onClick={onGetStarted}
          className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-bold text-sm shadow-md transition-colors whitespace-nowrap shrink-0"
        >
          Sign In
        </button>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-6 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-900/85 border border-amber-300/40 text-amber-200 text-sm font-semibold shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Learn · Play · Grow</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-amber-300 quiztopia-wordmark text-balance leading-[1.08]">
              Quiztopia
            </h1>
            <p className="text-2xl sm:text-3xl font-bold text-white text-balance leading-snug max-w-xl">
              Team up. Take quizzes. Build your dream island!
            </p>
            <p className="text-base text-violet-100/95 max-w-lg leading-relaxed">
              Collaborate with your classroom team on one shared device, answer live quiz quests together, earn golden coins, adopt magical fantasy creatures, and compete across three academic terms.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-indigo-950 font-extrabold text-lg shadow-lg transition-transform active:scale-[0.98] whitespace-nowrap"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setModal('how')}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-indigo-900/75 hover:bg-indigo-800/85 border border-violet-300/30 text-white font-semibold text-sm transition-colors whitespace-nowrap"
            >
              <HelpCircle className="w-4 h-4 text-sky-300" />
              <span>How to Play</span>
            </button>

            <button
              type="button"
              onClick={() => setModal('about')}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-indigo-900/75 hover:bg-indigo-800/85 border border-violet-300/30 text-white font-semibold text-sm transition-colors whitespace-nowrap"
            >
              <Info className="w-4 h-4 text-violet-200" />
              <span>About</span>
            </button>
          </div>
        </div>

        {/* Mascot Showcase */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-72 sm:w-88 aspect-square rounded-3xl overflow-hidden border-4 border-amber-300/70 shadow-2xl bg-gradient-to-br from-violet-700 to-indigo-900">
            {!mascotFailed ? (
              <img
                src={WIZARD_MASCOT_IMG}
                alt="Quiztopia apprentice wizard and Lumibun companion"
                referrerPolicy="no-referrer"
                onError={() => setMascotFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                <Crown className="w-16 h-16 text-amber-300 mb-3" />
                <p className="font-bold text-lg text-white">Teamwork Magic</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom quiet summary strip */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto px-6 py-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs text-violet-100/90">
        <span>Quiztopia Classroom Adventure · Safe Team-Only Play</span>
        <div className="flex items-center gap-6">
          <span>2–4 Students per Team</span>
          <span>1 Shared Avatar & Island</span>
          <span>3 Academic Term Seasons</span>
        </div>
      </footer>

      {/* Info Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/70 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full bg-white text-indigo-950 rounded-3xl shadow-2xl border border-violet-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-indigo-950">
                {modal === 'how' ? 'How to Play Quiztopia' : 'About Quiztopia'}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close modal"
                className="p-2 rounded-xl text-slate-500 hover:bg-violet-50 hover:text-indigo-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modal === 'how' ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-violet-50">
                  <Users className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-indigo-950">1. Gather Your Team</p>
                    <p>Log into your shared team account on one classroom device. Customize your team's shared avatar together.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-sky-50">
                  <Sparkles className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-indigo-950">2. Discuss & Lock Your Answer</p>
                    <p>Join your teacher's live quiz PIN. Talk over every question before your Team Captain locks in one team answer.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50">
                  <Trophy className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-indigo-950">3. Grow Your Fantasy Island</p>
                    <p>Earn coins for participation, teamwork, and quiz points. Adopt magical creatures and build up your Island Power each term!</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  <strong>Quiztopia</strong> is designed specifically for elementary classrooms where students learn through weekly collaborative team play.
                </p>
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-indigo-950">Kid-Safe by Design</p>
                    <p>No individual student signups, no surnames displayed, no direct messaging, and no daily login streak pressure.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModal(null);
                  onGetStarted();
                }}
                className="px-5 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-sm"
              >
                Continue to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
