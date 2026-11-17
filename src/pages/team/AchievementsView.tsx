import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Coins, Lock, Star } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { Achievement } from '../../../shared/types.ts';

interface AchievementRow extends Achievement {
  unlocked: boolean;
  unlockedAt: string | null;
}

export function AchievementsView() {
  const [list, setList] = useState<AchievementRow[] | null>(null);

  useEffect(() => {
    apiFetch<{ achievements: AchievementRow[] }>('/api/team/achievements').then((r) =>
      setList(r.achievements)
    );
  }, []);

  if (!list) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading achievements...
      </div>
    );
  }

  const unlockedCount = list.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-indigo-950">Team Achievements</h1>
          <p className="text-sm text-slate-600">
            {unlockedCount} of {list.length} permanent achievements unlocked · Persists across all academic terms
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((ach) => (
          <div
            key={ach.id}
            className={`rounded-3xl border p-5 flex items-start justify-between gap-4 transition-all ${
              ach.unlocked
                ? 'bg-white border-amber-300 shadow-sm'
                : 'bg-slate-50/80 border-slate-200 opacity-85'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  ach.unlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {ach.unlocked ? <Award className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-indigo-950">{ach.title}</h3>
                  {ach.unlocked && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{ach.description}</p>
                <div className="pt-1 flex items-center gap-4 text-xs font-mono-num font-bold">
                  <span className="text-violet-700 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" /> +{ach.powerValue} Power
                  </span>
                  <span className="text-amber-600 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> +{ach.coinReward} Coins
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
