import React, { useState } from 'react';
import { Check, Palette, Save } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { AvatarConfig, TeamSummary } from '../../../shared/types.ts';
import { TeamAvatarArt } from '../../components/FantasyArt.tsx';

const CHARACTER_TYPES: { id: AvatarConfig['characterType']; label: string }[] = [
  { id: 'wizard', label: 'Star Wizard' },
  { id: 'explorer', label: 'Sky Explorer' },
  { id: 'knight', label: 'Island Knight' },
  { id: 'scholar', label: 'Crystal Scholar' },
];

const HAIR_STYLES: { id: AvatarConfig['hairStyle']; label: string }[] = [
  { id: 'braids', label: 'Braids' },
  { id: 'short', label: 'Classic Short' },
  { id: 'curly', label: 'Curly' },
  { id: 'spiky', label: 'Spiky' },
];

const FACE_STYLES: { id: AvatarConfig['faceStyle']; label: string }[] = [
  { id: 'happy', label: 'Cheerful Smile' },
  { id: 'sparkle', label: 'Starry Sparkle' },
  { id: 'curious', label: 'Curious Wonder' },
  { id: 'determined', label: 'Brave Hero' },
];

const CLOTHING_STYLES: { id: AvatarConfig['clothingStyle']; label: string }[] = [
  { id: 'robe', label: 'Wizard Robe' },
  { id: 'cape', label: 'Adventure Cape' },
  { id: 'tunic', label: 'Guardian Tunic' },
  { id: 'vest', label: 'Scholar Vest' },
];

const ACCESSORIES: { id: AvatarConfig['accessory']; label: string }[] = [
  { id: 'wizard_hat', label: 'Wizard Hat' },
  { id: 'crown', label: 'Golden Crown' },
  { id: 'glasses', label: 'Star Glasses' },
  { id: 'star_pin', label: 'Star Emblem' },
  { id: 'none', label: 'None' },
];

const PRIMARY_COLORS = ['#6D28D9', '#2563EB', '#059669', '#EA580C', '#DB2777', '#4F46E5'];
const ACCENT_COLORS = ['#F59E0B', '#38BDF8', '#22C55E', '#F43F5E', '#FACC15', '#A78BFA'];

export function AvatarCreator({
  team,
  onSaved,
}: {
  team: TeamSummary;
  onSaved: (avatar: AvatarConfig) => void;
}) {
  const [draft, setDraft] = useState<AvatarConfig>(team.avatar);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await apiFetch<{ avatar: AvatarConfig }>('/api/team/avatar', {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      onSaved(res.avatar);
      setMessage('Shared team avatar saved!');
    } catch (err: any) {
      setMessage(err?.message || 'Could not save avatar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-indigo-950">Shared Team Avatar Studio</h1>
          <p className="text-sm text-slate-600">
            Customize the single avatar that represents <strong>{team.name}</strong> ({team.members.map((m) => m.nickname).join(' · ')}) across quizzes, islands, and leaderboards.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Team Avatar'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Preview Card */}
        <div className="lg:col-span-4 bg-gradient-to-br from-indigo-900 via-violet-800 to-indigo-950 text-white rounded-3xl p-8 flex flex-col items-center text-center shadow-lg border border-violet-400/30 space-y-4">
          <TeamAvatarArt avatar={draft} size={172} />
          <div>
            <h2 className="text-2xl font-extrabold">{team.name}</h2>
            <p className="text-sm text-violet-200 mt-1">
              {team.members.map((m) => m.nickname).join(' • ')}
            </p>
          </div>
          <p className="text-xs text-violet-200/90 max-w-xs">
            One shared hero represents your entire team! Agree on a style together before saving.
          </p>
        </div>

        {/* Modular Controls */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-6">
          <OptionGroup
            title="Character Class"
            options={CHARACTER_TYPES}
            value={draft.characterType}
            onChange={(v) => setDraft({ ...draft, characterType: v })}
          />
          <OptionGroup
            title="Hair Style"
            options={HAIR_STYLES}
            value={draft.hairStyle}
            onChange={(v) => setDraft({ ...draft, hairStyle: v })}
          />
          <OptionGroup
            title="Expression"
            options={FACE_STYLES}
            value={draft.faceStyle}
            onChange={(v) => setDraft({ ...draft, faceStyle: v })}
          />
          <OptionGroup
            title="Outfit"
            options={CLOTHING_STYLES}
            value={draft.clothingStyle}
            onChange={(v) => setDraft({ ...draft, clothingStyle: v })}
          />
          <OptionGroup
            title="Accessory"
            options={ACCESSORIES}
            value={draft.accessory}
            onChange={(v) => setDraft({ ...draft, accessory: v })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-violet-100">
            <div>
              <p className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-violet-600" />
                <span>Primary Color</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {PRIMARY_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Primary color ${hex}`}
                    onClick={() => setDraft({ ...draft, primaryColor: hex })}
                    style={{ backgroundColor: hex }}
                    className={`w-9 h-9 rounded-full border-2 transition-transform ${
                      draft.primaryColor === hex ? 'border-indigo-950 scale-110 ring-2 ring-amber-400' : 'border-white shadow'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-500" />
                <span>Accent Color</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {ACCENT_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Accent color ${hex}`}
                    onClick={() => setDraft({ ...draft, accentColor: hex })}
                    style={{ backgroundColor: hex }}
                    className={`w-9 h-9 rounded-full border-2 transition-transform ${
                      draft.accentColor === hex ? 'border-indigo-950 scale-110 ring-2 ring-violet-400' : 'border-white shadow'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-600">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              value === opt.id
                ? 'bg-violet-700 text-white shadow-sm'
                : 'bg-violet-50 text-indigo-950 hover:bg-violet-100 border border-violet-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
