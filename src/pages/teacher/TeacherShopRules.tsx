import React, { useEffect, useState } from 'react';
import { Check, Plus, Save, Sliders, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { CatalogItem, Creature, GameRulesConfig } from '../../../shared/types.ts';
import { BuildingIllustration, CreatureIllustration } from '../../components/FantasyArt.tsx';

interface CatalogResponse {
  creatures: Creature[];
  items: CatalogItem[];
  rules: GameRulesConfig;
}

export function TeacherShopRules() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [rules, setRules] = useState<GameRulesConfig | null>(null);
  const [message, setMessage] = useState('');

  // Add new creature
  const [showNewCreature, setShowNewCreature] = useState(false);
  const [newCreature, setNewCreature] = useState({
    name: '',
    element: 'Cosmic' as Creature['element'],
    rarity: 'Rare' as Creature['rarity'],
    description: '',
    artKey: 'crystal_wisp',
    price: 500,
    powerValue: 280,
  });

  const loadCatalog = async () => {
    const res = await apiFetch<CatalogResponse>('/api/teacher/catalog');
    setData(res);
    setRules(res.rules);
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  if (!data || !rules) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading fantasy shop and scoring rules...
      </div>
    );
  }

  const saveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    await apiFetch('/api/teacher/rules', {
      method: 'PUT',
      body: JSON.stringify(rules),
    });
    setMessage('Game reward and Island Power rules updated across all teams!');
    await loadCatalog();
  };

  const updateCreatureField = async (c: Creature, price: number, powerValue: number, isActive: boolean) => {
    await apiFetch(`/api/teacher/creatures/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({ price, powerValue, isActive }),
    });
    setMessage(`Updated ${c.name}!`);
    await loadCatalog();
  };

  const handleAddCreature = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/teacher/creatures', {
      method: 'POST',
      body: JSON.stringify(newCreature),
    });
    setShowNewCreature(false);
    setNewCreature({
      name: '',
      element: 'Cosmic',
      rarity: 'Rare',
      description: '',
      artKey: 'crystal_wisp',
      price: 500,
      powerValue: 280,
    });
    setMessage('Added new fantasy creature to Pet Shop!');
    await loadCatalog();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-indigo-950">Fantasy Shop &amp; Scoring Rules</h1>
          <p className="text-sm text-slate-600">
            Configure fantasy creature prices, Island Power multipliers, and classroom coin rewards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewCreature(!showNewCreature)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Fantasy Creature</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      {showNewCreature && (
        <form onSubmit={handleAddCreature} className="bg-white rounded-3xl border border-violet-200 p-6 space-y-4 shadow-sm">
          <h2 className="font-bold text-indigo-950">Add New Original Fantasy Creature</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Creature Name"
              value={newCreature.name}
              onChange={(e) => setNewCreature({ ...newCreature, name: e.target.value })}
              className="px-3.5 py-2 rounded-xl border border-violet-200 text-sm"
            />
            <select
              value={newCreature.element}
              onChange={(e) => setNewCreature({ ...newCreature, element: e.target.value as Creature['element'] })}
              className="px-3.5 py-2 rounded-xl border border-violet-200 text-sm bg-white"
            >
              {['Fire', 'Water', 'Earth', 'Wind', 'Light', 'Darkness', 'Cosmic'].map((el) => (
                <option key={el}>{el}</option>
              ))}
            </select>
            <select
              value={newCreature.rarity}
              onChange={(e) => setNewCreature({ ...newCreature, rarity: e.target.value as Creature['rarity'] })}
              className="px-3.5 py-2 rounded-xl border border-violet-200 text-sm bg-white"
            >
              {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={newCreature.artKey}
              onChange={(e) => setNewCreature({ ...newCreature, artKey: e.target.value })}
              className="px-3.5 py-2 rounded-xl border border-violet-200 text-sm bg-white"
            >
              <option value="lumibun">Illustration: Lumibun</option>
              <option value="sproutling">Illustration: Sproutling</option>
              <option value="crystal_wisp">Illustration: Crystal Wisp</option>
              <option value="emberling">Illustration: Emberling</option>
              <option value="moonfox">Illustration: Moonfox</option>
              <option value="cloud_drake">Illustration: Cloud Drake</option>
              <option value="star_unicorn">Illustration: Star Unicorn</option>
              <option value="celestial_phoenix">Illustration: Celestial Phoenix</option>
              <option value="astral_dragon">Illustration: Astral Dragon</option>
            </select>
            <input
              type="number"
              min={50}
              value={newCreature.price}
              onChange={(e) => setNewCreature({ ...newCreature, price: Number(e.target.value) })}
              placeholder="Price (coins)"
              className="px-3.5 py-2 rounded-xl border border-violet-200 text-sm font-mono-num"
            />
            <input
              type="number"
              min={20}
              value={newCreature.powerValue}
              onChange={(e) => setNewCreature({ ...newCreature, powerValue: Number(e.target.value) })}
              placeholder="Island Power"
              className="px-3.5 py-2 rounded-xl border border-violet-200 text-sm font-mono-num"
            />
          </div>
          <input
            type="text"
            required
            placeholder="Short fantasy description"
            value={newCreature.description}
            onChange={(e) => setNewCreature({ ...newCreature, description: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl border border-violet-200 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNewCreature(false)} className="px-4 py-2 text-xs font-semibold text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-violet-700 text-white text-xs font-bold">
              Save Creature
            </button>
          </div>
        </form>
      )}

      {/* Configurable Economy & Power Rules */}
      <form onSubmit={saveRules} className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-indigo-950 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-violet-700" />
            <span>Coin Rewards &amp; Island Power Formula</span>
          </h2>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs"
          >
            <Save className="w-4 h-4" />
            <span>Save Rules</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <RuleInput
            label="Participation Coins"
            value={rules.participationCoins}
            onChange={(v) => setRules({ ...rules, participationCoins: v })}
          />
          <RuleInput
            label="Coins / Correct Answer"
            value={rules.coinsPerCorrectAnswer}
            onChange={(v) => setRules({ ...rules, coinsPerCorrectAnswer: v })}
          />
          <RuleInput
            label="1st Place Bonus Coins"
            value={rules.firstPlaceBonusCoins}
            onChange={(v) => setRules({ ...rules, firstPlaceBonusCoins: v })}
          />
          <RuleInput
            label="2nd Place Bonus Coins"
            value={rules.secondPlaceBonusCoins}
            onChange={(v) => setRules({ ...rules, secondPlaceBonusCoins: v })}
          />
          <RuleInput
            label="3rd Place Bonus Coins"
            value={rules.thirdPlaceBonusCoins}
            onChange={(v) => setRules({ ...rules, thirdPlaceBonusCoins: v })}
          />
          <RuleInput
            label="Creature Power Multiplier"
            step="0.1"
            value={rules.creaturePowerMultiplier}
            onChange={(v) => setRules({ ...rules, creaturePowerMultiplier: v })}
          />
          <RuleInput
            label="Building Power Multiplier"
            step="0.1"
            value={rules.buildingPowerMultiplier}
            onChange={(v) => setRules({ ...rules, buildingPowerMultiplier: v })}
          />
          <RuleInput
            label="Achievement Multiplier"
            step="0.1"
            value={rules.achievementPowerMultiplier}
            onChange={(v) => setRules({ ...rules, achievementPowerMultiplier: v })}
          />
        </div>
      </form>

      {/* Creature Price & Power Editor */}
      <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-indigo-950 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span>Fantasy Creature Catalog</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.creatures.map((c) => (
            <CreatureEditorRow key={c.id} creature={c} onSave={updateCreatureField} />
          ))}
        </div>
      </div>

      {/* Island Items Overview */}
      <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-indigo-950">Island Buildings &amp; Decorations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.items.map((item) => (
            <div key={item.id} className="p-3.5 rounded-2xl border border-violet-100 bg-violet-50/40 flex items-center gap-3">
              <BuildingIllustration artKey={item.artKey} size={52} />
              <div className="min-w-0">
                <p className="font-bold text-xs text-indigo-950 truncate">{item.name}</p>
                <p className="text-[11px] font-mono-num text-slate-600">
                  {item.price} coins · +{item.powerValue} PWR
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RuleInput({
  label,
  value,
  step = '1',
  onChange,
}: {
  label: string;
  value: number;
  step?: string;
  onChange: (val: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-xl border border-violet-200 text-sm font-mono-num"
      />
    </div>
  );
}

function CreatureEditorRow({
  creature,
  onSave,
}: {
  creature: Creature;
  onSave: (c: Creature, price: number, powerValue: number, isActive: boolean) => void;
}) {
  const [price, setPrice] = useState(creature.price);
  const [power, setPower] = useState(creature.powerValue);
  const [active, setActive] = useState(creature.isActive);

  return (
    <div className="p-4 rounded-2xl border border-violet-100 bg-violet-50/30 space-y-3">
      <div className="flex items-center gap-3">
        <CreatureIllustration artKey={creature.artKey} size={54} />
        <div className="min-w-0">
          <p className="font-extrabold text-sm text-indigo-950 truncate">{creature.name}</p>
          <p className="text-xs text-slate-500">
            {creature.element} · {creature.rarity}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-slate-500">Price</label>
          <input
            type="number"
            min={10}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-xs font-mono-num bg-white"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500">Power</label>
          <input
            type="number"
            min={10}
            value={power}
            onChange={(e) => setPower(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-xs font-mono-num bg-white"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>In Shop</span>
        </label>
        <button
          type="button"
          onClick={() => onSave(creature, price, power, active)}
          className="px-3 py-1 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold"
        >
          Update
        </button>
      </div>
    </div>
  );
}
