import React, { useEffect, useState } from 'react';
import { Check, Coins, ShieldCheck, ShoppingBag, Sparkles, Star, X } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { CatalogItem, Creature } from '../../../shared/types.ts';
import { BuildingIllustration, CreatureIllustration } from '../../components/FantasyArt.tsx';

interface ShopData {
  coins: number;
  creatures: Creature[];
  items: CatalogItem[];
  ownedCreatureCounts: Record<string, number>;
  ownedItemCounts: Record<string, number>;
}

export function PetShopView({
  onPurchaseComplete,
}: {
  onPurchaseComplete: () => void;
}) {
  const [data, setData] = useState<ShopData | null>(null);
  const [tab, setTab] = useState<'creatures' | 'items'>('creatures');
  const [elementFilter, setElementFilter] = useState<string>('All');
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: 'creature'; data: Creature }
    | { kind: 'item'; data: CatalogItem }
    | null
  >(null);
  const [purchasing, setPurchasing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadShop = async () => {
    const res = await apiFetch<ShopData>('/api/team/shop');
    setData(res);
  };

  useEffect(() => {
    void loadShop();
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading Pet &amp; Island Shop...
      </div>
    );
  }

  const elements = ['All', 'Fire', 'Water', 'Earth', 'Wind', 'Light', 'Darkness', 'Cosmic'];
  const filteredCreatures =
    elementFilter === 'All'
      ? data.creatures
      : data.creatures.filter((c) => c.element === elementFilter);

  const featuredCreature = data.creatures[data.creatures.length - 1] || data.creatures[0];

  const handleConfirmPurchase = async () => {
    if (!confirmTarget) return;
    setPurchasing(true);
    setFeedback(null);
    const idempotencyKey = `shop_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    try {
      if (confirmTarget.kind === 'creature') {
        await apiFetch('/api/team/shop/buy-creature', {
          method: 'POST',
          body: JSON.stringify({ creatureId: confirmTarget.data.id, idempotencyKey }),
        });
        setFeedback({
          type: 'success',
          text: `${confirmTarget.data.name} joined your team collection! Island Power increased!`,
        });
      } else {
        await apiFetch('/api/team/shop/buy-item', {
          method: 'POST',
          body: JSON.stringify({ itemId: confirmTarget.data.id, idempotencyKey }),
        });
        setFeedback({
          type: 'success',
          text: `${confirmTarget.data.name} added to your island inventory!`,
        });
      }
      setConfirmTarget(null);
      await loadShop();
      onPurchaseComplete();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Purchase could not be completed.' });
      setConfirmTarget(null);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Featured Mascot Banner matching Screen 8 */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-sky-600 via-violet-700 to-indigo-900 text-white p-6 sm:p-8 shadow-lg border border-violet-300/40">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 text-amber-300 text-xs font-bold">
              <ShoppingBag className="w-4 h-4" />
              <span>Fantasy Pet &amp; Island Shop</span>
            </div>
            <h1 className="text-3xl font-extrabold">Show your team spirit!</h1>
            <p className="text-sm text-violet-100">
              Spend your team&apos;s earned coins on original fantasy creatures and enchanted island buildings. Every purchase boosts your Island Power!
            </p>
            <div className="pt-2 inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-indigo-950/75 border border-amber-300/40 font-mono-num">
              <Coins className="w-5 h-5 text-amber-300" />
              <span className="text-lg font-extrabold text-amber-300">{data.coins.toLocaleString()}</span>
              <span className="text-xs text-violet-200">Team Coins Available</span>
            </div>
          </div>

          {featuredCreature && (
            <div className="flex items-center gap-4 bg-white/15 backdrop-blur-md rounded-3xl p-4 border border-white/25">
              <CreatureIllustration artKey={featuredCreature.artKey} size={96} />
              <div>
                <p className="text-xs font-semibold text-amber-300">{featuredCreature.rarity} Spotlight</p>
                <p className="text-lg font-extrabold">{featuredCreature.name}</p>
                <p className="text-xs text-violet-100">
                  {featuredCreature.element} · +{featuredCreature.powerValue} Power
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Shop Category Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-violet-100 rounded-xl">
          <button
            type="button"
            onClick={() => setTab('creatures')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'creatures' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900 hover:bg-violet-200/60'
            }`}
          >
            Fantasy Creatures ({data.creatures.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('items')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'items' ? 'bg-white text-indigo-950 shadow-sm' : 'text-violet-900 hover:bg-violet-200/60'
            }`}
          >
            Island Buildings &amp; Decor ({data.items.length})
          </button>
        </div>

        {tab === 'creatures' && (
          <div className="flex flex-wrap gap-1.5">
            {elements.map((el) => (
              <button
                key={el}
                type="button"
                onClick={() => setElementFilter(el)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  elementFilter === el
                    ? 'bg-violet-700 text-white'
                    : 'bg-white border border-violet-200 text-slate-700 hover:bg-violet-50'
                }`}
              >
                {el}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Shop Cards Grid */}
      {tab === 'creatures' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCreatures.map((creature) => {
            const ownedCount = data.ownedCreatureCounts[creature.id] || 0;
            const canAfford = data.coins >= creature.price;
            return (
              <div
                key={creature.id}
                className="bg-white rounded-3xl border border-violet-200 shadow-sm p-5 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {creature.element} · {creature.rarity}
                    </span>
                    {ownedCount > 0 && (
                      <span className="font-bold text-emerald-700">Owned ×{ownedCount}</span>
                    )}
                  </div>

                  <div className="flex justify-center py-2">
                    <CreatureIllustration artKey={creature.artKey} size={108} />
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-indigo-950">{creature.name}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{creature.description}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-violet-100 flex items-center justify-between gap-3">
                  <div className="font-mono-num">
                    <p className="text-sm font-extrabold text-amber-600 flex items-center gap-1">
                      <Coins className="w-4 h-4" />
                      <span>{creature.price.toLocaleString()}</span>
                    </p>
                    <p className="text-xs font-semibold text-violet-700 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" />
                      <span>+{creature.powerValue} Power</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => setConfirmTarget({ kind: 'creature', data: creature })}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                      canAfford
                        ? 'bg-amber-400 hover:bg-amber-300 text-indigo-950 shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? 'Buy' : 'Need Coins'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.items.map((item) => {
            const ownedCount = data.ownedItemCounts[item.id] || 0;
            const canAfford = data.coins >= item.price;
            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-violet-200 shadow-sm p-5 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="capitalize">{item.category}</span>
                    {ownedCount > 0 && (
                      <span className="font-bold text-emerald-700">Owned ×{ownedCount}</span>
                    )}
                  </div>

                  <div className="flex justify-center py-2">
                    <BuildingIllustration artKey={item.artKey} size={96} />
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-indigo-950">{item.name}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-violet-100 flex items-center justify-between gap-3">
                  <div className="font-mono-num">
                    <p className="text-sm font-extrabold text-amber-600 flex items-center gap-1">
                      <Coins className="w-4 h-4" />
                      <span>{item.price.toLocaleString()}</span>
                    </p>
                    <p className="text-xs font-semibold text-violet-700 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" />
                      <span>+{item.powerValue} Power</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => setConfirmTarget({ kind: 'item', data: item })}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                      canAfford
                        ? 'bg-amber-400 hover:bg-amber-300 text-indigo-950 shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? 'Buy' : 'Need Coins'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Purchase Confirmation Dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/65 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-violet-200 p-6 space-y-5 text-center">
            <div className="flex justify-center">
              {confirmTarget.kind === 'creature' ? (
                <CreatureIllustration artKey={confirmTarget.data.artKey} size={108} />
              ) : (
                <BuildingIllustration artKey={confirmTarget.data.artKey} size={100} />
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-indigo-950">
                Confirm Team Purchase
              </h2>
              <p className="text-sm text-slate-600">
                Spend <strong className="text-amber-600">{confirmTarget.data.price.toLocaleString()} coins</strong> to add{' '}
                <strong>{confirmTarget.data.name}</strong> (+{confirmTarget.data.powerValue} Island Power) to your team?
              </p>
            </div>

            <div className="p-3 rounded-xl bg-violet-50 text-xs font-semibold text-violet-900 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-violet-700" />
              <span>Remaining Balance: {(data.coins - confirmTarget.data.price).toLocaleString()} coins</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={purchasing}
                onClick={() => setConfirmTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purchasing}
                onClick={handleConfirmPurchase}
                className="flex-1 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>{purchasing ? 'Processing...' : 'Confirm Buy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
