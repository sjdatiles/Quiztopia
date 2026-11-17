import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Castle, Coins, History, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { CatalogItem, CoinTransaction, Creature } from '../../../shared/types.ts';
import { BuildingIllustration, CreatureIllustration } from '../../components/FantasyArt.tsx';

interface CollectionData {
  coins: number;
  creatures: { id: string; creatureId: string; acquiredAt: string; creature: Creature }[];
  items: { id: string; itemId: string; purchasedAt: string; item: CatalogItem }[];
  transactions: CoinTransaction[];
  catalogTotalCreatures: number;
}

export function CollectionView({ onGoToShop }: { onGoToShop: () => void }) {
  const [data, setData] = useState<CollectionData | null>(null);
  const [subTab, setSubTab] = useState<'creatures' | 'items' | 'ledger'>('creatures');

  useEffect(() => {
    apiFetch<CollectionData>('/api/team/collection').then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading team collection...
      </div>
    );
  }

  const uniqueCreatures = new Set(data.creatures.map((c) => c.creatureId)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-indigo-950">Team Collection &amp; Wallet Ledger</h1>
          <p className="text-sm text-slate-600">
            {uniqueCreatures} of {data.catalogTotalCreatures} unique fantasy species collected · Preserved across all academic terms
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToShop}
          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-bold text-sm"
        >
          Visit Pet Shop
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 bg-violet-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setSubTab('creatures')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 ${
            subTab === 'creatures' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Creatures ({data.creatures.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('items')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 ${
            subTab === 'items' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900'
          }`}
        >
          <Castle className="w-4 h-4" />
          <span>Buildings &amp; Decor ({data.items.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('ledger')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 ${
            subTab === 'ledger' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Coin History ({data.transactions.length})</span>
        </button>
      </div>

      {subTab === 'creatures' && (
        data.creatures.length === 0 ? (
          <div className="p-10 bg-white rounded-3xl border border-violet-200 text-center text-slate-500">
            No fantasy creatures adopted yet. Earn coins in quizzes and visit the Pet Shop!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.creatures.map((tc) => (
              <div key={tc.id} className="bg-white rounded-2xl border border-violet-200 p-5 flex items-center gap-4 shadow-sm">
                <CreatureIllustration artKey={tc.creature.artKey} size={76} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {tc.creature.element} · {tc.creature.rarity}
                  </p>
                  <h3 className="font-extrabold text-indigo-950 truncate">{tc.creature.name}</h3>
                  <p className="text-xs font-mono-num font-bold text-violet-700 mt-1">
                    +{tc.creature.powerValue} Lifetime Power
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {subTab === 'items' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((ti) => (
            <div key={ti.id} className="bg-white rounded-2xl border border-violet-200 p-5 flex items-center gap-4 shadow-sm">
              <BuildingIllustration artKey={ti.item.artKey} size={72} />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 capitalize">{ti.item.category}</p>
                <h3 className="font-extrabold text-indigo-950 truncate">{ti.item.name}</h3>
                <p className="text-xs font-mono-num font-bold text-violet-700 mt-1">
                  +{ti.item.powerValue} Power
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'ledger' && (
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-violet-100 flex items-center justify-between">
            <span className="font-bold text-indigo-950">Shared Coin Transaction Ledger</span>
            <span className="text-sm font-mono-num font-bold text-amber-600 flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              Balance: {data.coins.toLocaleString()}
            </span>
          </div>
          <div className="divide-y divide-violet-100">
            {data.transactions.map((tx) => (
              <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      tx.amount >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {tx.amount >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-950">{tx.reason}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono-num font-extrabold text-sm ${
                    tx.amount >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
