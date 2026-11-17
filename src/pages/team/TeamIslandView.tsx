import React, { useEffect, useState } from 'react';
import { Check, Coins, Crown, MapPin, Plus, Save, Sparkles, Star, Trash2, Wand2 } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { CatalogItem, Creature, IslandPlacement, TeamSummary } from '../../../shared/types.ts';
import {
  BuildingIllustration,
  CreatureIllustration,
  ISLAND_SCENE_IMG,
  TeamAvatarArt,
} from '../../components/FantasyArt.tsx';

interface IslandResponse {
  team: TeamSummary;
  ownedCreatures: { id: string; creatureId: string; creature: Creature }[];
  ownedItems: { id: string; itemId: string; item: CatalogItem }[];
  powerBreakdown: {
    creaturePower: number;
    buildingPower: number;
    achievementPower: number;
    teacherBonusPower: number;
    termPower: number;
    lifetimePower: number;
  };
}

const SLOT_POSITIONS = [
  { index: 0, label: 'Sky West', top: '18%', left: '14%' },
  { index: 1, label: 'North Ridge', top: '16%', left: '38%' },
  { index: 2, label: 'Castle Peak', top: '20%', left: '53%' },
  { index: 3, label: 'Crystal Cliff', top: '20%', left: '76%' },
  { index: 4, label: 'West Meadow', top: '44%', left: '18%' },
  { index: 5, label: 'Central Plaza', top: '46%', left: '42%' },
  { index: 6, label: 'Waterfall Terrace', top: '45%', left: '66%' },
  { index: 7, label: 'East Spire', top: '44%', left: '84%' },
  { index: 8, label: 'Harbor Pier', top: '70%', left: '22%' },
  { index: 9, label: 'Garden Path', top: '72%', left: '44%' },
  { index: 10, label: 'Lagoon Edge', top: '70%', left: '65%' },
  { index: 11, label: 'South Isle', top: '68%', left: '83%' },
];

export function TeamIslandView({
  onGoToShop,
  onIslandUpdated,
}: {
  onGoToShop: () => void;
  onIslandUpdated: () => void;
}) {
  const [data, setData] = useState<IslandResponse | null>(null);
  const [placements, setPlacements] = useState<IslandPlacement[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [bgFailed, setBgFailed] = useState(false);

  const loadIsland = async () => {
    const res = await apiFetch<IslandResponse>('/api/team/island');
    setData(res);
    setPlacements(res.team.island.placements || []);
  };

  useEffect(() => {
    void loadIsland();
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading your fantasy island...
      </div>
    );
  }

  const { team, ownedCreatures, ownedItems, powerBreakdown } = data;
  const placedEntityIds = new Set(placements.map((p) => p.inventoryItemId));

  const placeOnSlot = (entity: {
    inventoryItemId: string;
    itemId: string;
    name: string;
    category: 'building' | 'decoration' | 'creature';
    artKey: string;
  }) => {
    if (selectedSlot === null) return;
    const filtered = placements.filter(
      (p) => p.slotIndex !== selectedSlot && p.inventoryItemId !== entity.inventoryItemId
    );
    const next: IslandPlacement[] = [
      ...filtered,
      {
        id: `place_${selectedSlot}_${entity.inventoryItemId}`,
        inventoryItemId: entity.inventoryItemId,
        itemId: entity.itemId,
        name: entity.name,
        category: entity.category,
        artKey: entity.artKey,
        slotIndex: selectedSlot,
      },
    ];
    setPlacements(next);
    setSelectedSlot(null);
  };

  const removeSlot = (slotIndex: number) => {
    setPlacements(placements.filter((p) => p.slotIndex !== slotIndex));
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice('');
    try {
      await apiFetch('/api/team/island/placements', {
        method: 'PUT',
        body: JSON.stringify({ theme: team.island.theme, placements }),
      });
      setCustomizing(false);
      setSelectedSlot(null);
      setNotice('Island layout saved!');
      onIslandUpdated();
      await loadIsland();
    } catch (err: any) {
      setNotice(err?.message || 'Unable to save island layout.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar matching Screen 4 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <TeamAvatarArt avatar={team.avatar} size={52} />
          <div>
            <h1 className="text-2xl font-extrabold text-indigo-950">{team.name}&apos;s Island</h1>
            <p className="text-sm font-medium text-violet-700">
              {team.members.map((m) => m.nickname).join(' • ')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 font-mono-num font-bold text-indigo-950 text-sm">
            <Coins className="w-4 h-4 text-amber-500" />
            <span>{team.coins.toLocaleString()}</span>
          </div>

          {!customizing ? (
            <button
              type="button"
              onClick={() => {
                setCustomizing(true);
                setNotice('');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-bold text-sm shadow-sm transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              <span>Customize Island</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCustomizing(false);
                  setSelectedSlot(null);
                  setPlacements(team.island.placements || []);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Layout'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* 2D Interactive Floating Island Stage */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl border-2 border-violet-300 bg-gradient-to-b from-sky-400 to-indigo-900 min-h-[460px] sm:min-h-[540px]">
        {!bgFailed && (
          <img
            src={ISLAND_SCENE_IMG}
            alt="2D floating fantasy island"
            referrerPolicy="no-referrer"
            onError={() => setBgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/60 via-transparent to-indigo-950/20" />

        {/* Placed Entities & Interactive Placement Slots */}
        <div className="relative z-10 w-full h-[460px] sm:h-[540px]">
          {SLOT_POSITIONS.map((slot) => {
            const placed = placements.find((p) => p.slotIndex === slot.index);
            const isSelected = selectedSlot === slot.index;

            if (!placed && !customizing) return null;

            return (
              <div
                key={slot.index}
                style={{ top: slot.top, left: slot.left }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                {placed ? (
                  <div className="group relative flex flex-col items-center">
                    <div
                      onClick={() => customizing && setSelectedSlot(slot.index)}
                      className={`p-1.5 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg border-2 transition-transform ${
                        customizing ? 'cursor-pointer hover:scale-105' : ''
                      } ${isSelected ? 'border-amber-400 ring-4 ring-amber-300/60' : 'border-white'}`}
                    >
                      {placed.category === 'creature' ? (
                        <CreatureIllustration artKey={placed.artKey} size={58} />
                      ) : (
                        <BuildingIllustration artKey={placed.artKey} size={58} />
                      )}
                    </div>
                    <span className="mt-1 px-2 py-0.5 rounded-md bg-indigo-950/85 text-white text-[11px] font-bold whitespace-nowrap shadow">
                      {placed.name}
                    </span>
                    {customizing && (
                      <button
                        type="button"
                        onClick={() => removeSlot(slot.index)}
                        title="Remove from island"
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(slot.index)}
                    className={`w-12 h-12 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center shadow-md backdrop-blur-sm transition-all ${
                      isSelected
                        ? 'bg-amber-400 border-indigo-950 text-indigo-950 scale-110'
                        : 'bg-white/75 border-violet-600 text-violet-900 hover:bg-white'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[9px] font-bold leading-none">Place</span>
                  </button>
                )}
              </div>
            );
          })}

          {/* Bottom Left Island Power Card matching Screen 4 */}
          <div className="absolute bottom-4 left-4 bg-indigo-950/90 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl border border-amber-300/40 shadow-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-violet-200 font-medium">Term Island Power</p>
              <p className="text-2xl font-extrabold font-mono-num text-amber-300">
                {powerBreakdown.termPower.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Bottom Right Team Banner */}
          <div className="hidden sm:flex absolute bottom-4 right-4 bg-white/95 text-indigo-950 px-4 py-2.5 rounded-2xl shadow-lg items-center gap-2.5 border border-violet-200">
            <Sparkles className="w-4 h-4 text-violet-700" />
            <span className="text-xs font-bold">
              {placements.length} placed · {ownedCreatures.length} creatures · {ownedItems.length} buildings
            </span>
          </div>
        </div>
      </div>

      {/* Customization Picker Drawer when editing */}
      {customizing && (
        <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-indigo-950 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-violet-700" />
                <span>
                  {selectedSlot !== null
                    ? `Select an owned item or creature for ${SLOT_POSITIONS[selectedSlot].label}`
                    : 'Click any dashed "+ Place" slot on your island above'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                All items and creatures in your team collection can be placed freely on your island.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToShop}
              className="text-xs font-bold text-violet-700 hover:underline"
            >
              Get more in Pet &amp; Island Shop →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {ownedItems.map((inv) => {
              const isPlaced = placedEntityIds.has(inv.id);
              return (
                <button
                  key={inv.id}
                  type="button"
                  disabled={selectedSlot === null}
                  onClick={() =>
                    placeOnSlot({
                      inventoryItemId: inv.id,
                      itemId: inv.itemId,
                      name: inv.item.name,
                      category: inv.item.category,
                      artKey: inv.item.artKey,
                    })
                  }
                  className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-2 transition-all ${
                    selectedSlot !== null
                      ? 'hover:border-violet-600 hover:bg-violet-50 cursor-pointer'
                      : 'opacity-70 cursor-not-allowed'
                  } ${isPlaced ? 'border-emerald-300 bg-emerald-50/50' : 'border-violet-200 bg-white'}`}
                >
                  <BuildingIllustration artKey={inv.item.artKey} size={52} />
                  <p className="text-xs font-bold text-indigo-950 truncate w-full">{inv.item.name}</p>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isPlaced ? 'Placed' : 'Ready'}
                  </span>
                </button>
              );
            })}

            {ownedCreatures.map((tc) => {
              const isPlaced = placedEntityIds.has(tc.id);
              return (
                <button
                  key={tc.id}
                  type="button"
                  disabled={selectedSlot === null}
                  onClick={() =>
                    placeOnSlot({
                      inventoryItemId: tc.id,
                      itemId: tc.creatureId,
                      name: tc.creature.name,
                      category: 'creature',
                      artKey: tc.creature.artKey,
                    })
                  }
                  className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-2 transition-all ${
                    selectedSlot !== null
                      ? 'hover:border-violet-600 hover:bg-violet-50 cursor-pointer'
                      : 'opacity-70 cursor-not-allowed'
                  } ${isPlaced ? 'border-emerald-300 bg-emerald-50/50' : 'border-violet-200 bg-white'}`}
                >
                  <CreatureIllustration artKey={tc.creature.artKey} size={52} />
                  <p className="text-xs font-bold text-indigo-950 truncate w-full">{tc.creature.name}</p>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isPlaced ? 'Placed' : 'Creature'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Island Power Breakdown */}
      <div className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-indigo-950 flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
          <span>Island Power Breakdown</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <PowerMetric label="Creature Power" value={powerBreakdown.creaturePower} />
          <PowerMetric label="Building Power" value={powerBreakdown.buildingPower} />
          <PowerMetric label="Achievement Power" value={powerBreakdown.achievementPower} />
          <PowerMetric label="Teacher Bonus" value={powerBreakdown.teacherBonusPower} />
          <PowerMetric label="Lifetime Power" value={powerBreakdown.lifetimePower} highlight />
        </div>
      </div>
    </div>
  );
}

function PowerMetric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`p-4 rounded-2xl border ${
        highlight ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className="text-xl font-extrabold font-mono-num text-indigo-950 mt-1">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
