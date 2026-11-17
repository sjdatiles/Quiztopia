import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Coins,
  Crown,
  Edit3,
  KeyRound,
  Plus,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { AcademicTerm, AvatarConfig, TeamMember } from '../../../shared/types.ts';
import { TeamAvatarArt } from '../../components/FantasyArt.tsx';

interface TeacherClass {
  id: string;
  name: string;
  gradeLevel: string;
  academicYearLabel: string;
  activeTermNumber: 1 | 2 | 3;
  teamCount: number;
  terms: AcademicTerm[];
}

interface TeacherTeamRow {
  id: string;
  classId: string;
  name: string;
  username: string;
  members: TeamMember[];
  captainMemberId: string;
  captainName: string;
  avatar: AvatarConfig;
  coins: number;
  termPower: number;
  lifetimePower: number;
  creatureCount: number;
  achievementCount: number;
}

export function TeacherClassesTeams() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [teams, setTeams] = useState<TeacherTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Create class form
  const [showNewClass, setShowNewClass] = useState(false);
  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Grade 4');
  const [yearLabel, setYearLabel] = useState('2026-2027');

  // Create team form (enforces 2-4 members)
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [teamClassId, setTeamClassId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [memberInputs, setMemberInputs] = useState<string[]>(['', '', '']);
  const [captainIndex, setCaptainIndex] = useState(0);
  const [teamUsername, setTeamUsername] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{
    teamName: string;
    username: string;
    password: string;
  } | null>(null);

  // Edit team modal
  const [editingTeam, setEditingTeam] = useState<TeacherTeamRow | null>(null);
  const [editMembers, setEditMembers] = useState<string[]>([]);
  const [editCaptainIdx, setEditCaptainIdx] = useState(0);

  // Award coins/power modal
  const [rewardTeam, setRewardTeam] = useState<TeacherTeamRow | null>(null);
  const [rewardCoins, setRewardCoins] = useState(50);
  const [rewardPower, setRewardPower] = useState(0);
  const [rewardReason, setRewardReason] = useState('Great Classroom Teamwork');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [clsRes, teamRes] = await Promise.all([
        apiFetch<{ classes: TeacherClass[] }>('/api/teacher/classes'),
        apiFetch<{ teams: TeacherTeamRow[] }>('/api/teacher/teams'),
      ]);
      setClasses(clsRes.classes);
      setTeams(teamRes.teams);
      if (clsRes.classes.length > 0 && !teamClassId) {
        setTeamClassId(clsRes.classes[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/teacher/classes', {
        method: 'POST',
        body: JSON.stringify({ name: className, gradeLevel, academicYearLabel: yearLabel }),
      });
      setClassName('');
      setShowNewClass(false);
      setMessage('Classroom created with Terms 1, 2, and 3 configured!');
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to create class.');
    }
  };

  const handleActivateTerm = async (classId: string, termNumber: 1 | 2 | 3) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/teacher/classes/${classId}/terms/activate`, {
        method: 'POST',
        body: JSON.stringify({ termNumber }),
      });
      setMessage(`Switched active season to Term ${termNumber}.`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to switch active term.');
    }
  };

  const handleCloseAndAdvanceTerm = async (cls: TeacherClass) => {
    setError('');
    setMessage('');
    try {
      const res = await apiFetch<{ closedTermNumber: number; nextTermNumber: number | null }>(
        `/api/teacher/classes/${cls.id}/terms/close-and-advance`,
        { method: 'POST' }
      );
      setMessage(
        res.nextTermNumber
          ? `Term ${res.closedTermNumber} archived & champions recorded! Term ${res.nextTermNumber} has begun with a fresh seasonal race (creatures & achievements preserved).`
          : `Term ${res.closedTermNumber} finalized & archived! Academic Year complete.`
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to close term.');
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await apiFetch<{
        team: { name: string; username: string; generatedPassword: string };
      }>('/api/teacher/teams', {
        method: 'POST',
        body: JSON.stringify({
          classId: teamClassId,
          name: teamName,
          members: memberInputs,
          captainIndex,
          username: teamUsername,
          password: teamPassword,
        }),
      });
      setCreatedCredentials({
        teamName: res.team.name,
        username: res.team.username,
        password: res.team.generatedPassword,
      });
      setTeamName('');
      setMemberInputs(['', '', '']);
      setTeamUsername('');
      setTeamPassword('');
      setShowNewTeam(false);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to create team.');
    }
  };

  const handleResetPassword = async (team: TeacherTeamRow) => {
    setError('');
    try {
      const res = await apiFetch<{ username: string; newPassword: string }>(
        `/api/teacher/teams/${team.id}/reset-password`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      setCreatedCredentials({
        teamName: team.name,
        username: res.username,
        password: res.newPassword,
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to reset password.');
    }
  };

  const openEditTeam = (team: TeacherTeamRow) => {
    setEditingTeam(team);
    setEditMembers(team.members.map((m) => m.nickname));
    const idx = team.members.findIndex((m) => m.id === team.captainMemberId);
    setEditCaptainIdx(idx >= 0 ? idx : 0);
  };

  const handleSaveTeamEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setError('');
    try {
      await apiFetch(`/api/teacher/teams/${editingTeam.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingTeam.name,
          members: editMembers,
          captainIndex: editCaptainIdx,
        }),
      });
      setEditingTeam(null);
      setMessage('Team roster and captain updated!');
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to update team.');
    }
  };

  const handleSendReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTeam) return;
    setError('');
    try {
      if (rewardCoins > 0) {
        await apiFetch(`/api/teacher/teams/${rewardTeam.id}/award-coins`, {
          method: 'POST',
          body: JSON.stringify({ amount: rewardCoins, reason: rewardReason }),
        });
      }
      if (rewardPower > 0) {
        await apiFetch(`/api/teacher/teams/${rewardTeam.id}/award-power`, {
          method: 'POST',
          body: JSON.stringify({ amount: rewardPower }),
        });
      }
      setMessage(`Awarded classroom rewards to ${rewardTeam.name}!`);
      setRewardTeam(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to award team.');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-violet-200 text-slate-600">
        Loading classes, academic terms, and teams...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-indigo-950">Classes, Academic Terms &amp; Teams</h1>
          <p className="text-sm text-slate-600">
            Organize students into 2–4 member teams (first names/nicknames only) and manage Term 1–3 seasons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowNewClass(!showNewClass)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-violet-300 text-violet-900 font-bold text-xs hover:bg-violet-50"
          >
            <Plus className="w-4 h-4" />
            <span>New Class</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewTeam(!showNewTeam)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
          {error}
        </div>
      )}

      {createdCredentials && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-indigo-950 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-700">Team Login Credentials Ready</p>
            <p className="font-extrabold text-base">{createdCredentials.teamName}</p>
            <p className="text-sm font-mono-num">
              Username: <strong>{createdCredentials.username}</strong> · Password:{' '}
              <strong>{createdCredentials.password}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreatedCredentials(null)}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New Class Form */}
      {showNewClass && (
        <form onSubmit={handleCreateClass} className="bg-white rounded-3xl border border-violet-200 p-6 space-y-4 shadow-sm">
          <h2 className="font-bold text-indigo-950">Create Classroom</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="text"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Class Name (e.g. Grade 5 Wizards)"
              className="px-4 py-2.5 rounded-xl border border-violet-200 text-sm"
            />
            <input
              type="text"
              required
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="Grade Level"
              className="px-4 py-2.5 rounded-xl border border-violet-200 text-sm"
            />
            <input
              type="text"
              required
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
              placeholder="Academic Year (e.g. 2026-2027)"
              className="px-4 py-2.5 rounded-xl border border-violet-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNewClass(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-violet-700 text-white text-sm font-bold">
              Create Class
            </button>
          </div>
        </form>
      )}

      {/* Create Team Form (2-4 Members) */}
      {showNewTeam && (
        <form onSubmit={handleCreateTeam} className="bg-white rounded-3xl border border-violet-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-indigo-950">Create Shared Team Account (2–4 Members)</h2>
            <span className="text-xs text-slate-500">First names or nicknames only</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Classroom</label>
              <select
                value={teamClassId}
                onChange={(e) => setTeamClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm bg-white"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.gradeLevel})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Team Name</label>
              <input
                type="text"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Phoenix Voyagers"
                className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">Team Members (2–4 first names)</label>
              {memberInputs.length < 4 && (
                <button
                  type="button"
                  onClick={() => setMemberInputs([...memberInputs, ''])}
                  className="text-xs font-bold text-violet-700 hover:underline"
                >
                  + Add Member
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {memberInputs.map((val, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const copy = [...memberInputs];
                        copy[idx] = e.target.value;
                        setMemberInputs(copy);
                      }}
                      placeholder={`Member ${idx + 1} nickname`}
                      className="w-full px-3 py-2 rounded-xl border border-violet-200 text-sm"
                    />
                    {memberInputs.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = memberInputs.filter((_, i) => i !== idx);
                          setMemberInputs(next);
                          if (captainIndex >= next.length) setCaptainIndex(0);
                        }}
                        className="text-xs text-red-500 font-bold px-1.5"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="newCaptain"
                      checked={captainIndex === idx}
                      onChange={() => setCaptainIndex(idx)}
                    />
                    <span>Team Captain</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Team Username (optional auto)</label>
              <input
                type="text"
                value={teamUsername}
                onChange={(e) => setTeamUsername(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Team Password (optional auto)</label>
              <input
                type="text"
                value={teamPassword}
                onChange={(e) => setTeamPassword(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNewTeam(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-violet-700 text-white text-sm font-bold">
              Create Team &amp; Generate Login
            </button>
          </div>
        </form>
      )}

      {/* Classes & Three-Term Season Cards */}
      <div className="space-y-4">
        {classes.map((cls) => (
          <div key={cls.id} className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-indigo-950">{cls.name}</h2>
                <p className="text-xs text-slate-500">
                  {cls.gradeLevel} · Academic Year {cls.academicYearLabel} · {cls.teamCount} Teams Enrolled
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCloseAndAdvanceTerm(cls)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-bold text-xs shadow-sm"
              >
                <Crown className="w-4 h-4" />
                <span>Close Term {cls.activeTermNumber} &amp; Archive Rankings</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([1, 2, 3] as const).map((n) => {
                const term = cls.terms.find((t) => t.termNumber === n);
                const isActive = cls.activeTermNumber === n;
                const isClosed = term?.status === 'closed';
                return (
                  <div
                    key={n}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-violet-50 border-violet-400'
                        : isClosed
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-white border-violet-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-violet-700" />
                        <span>Term {n}</span>
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {isActive ? 'Active Season' : term?.status || 'upcoming'}
                      </p>
                    </div>
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => handleActivateTerm(cls.id, n)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-violet-200 hover:bg-violet-100 text-xs font-bold text-violet-900"
                      >
                        Set Active
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Team Roster Cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-extrabold text-indigo-950 flex items-center gap-2">
          <Users className="w-5 h-5 text-violet-700" />
          <span>Classroom Teams ({teams.length})</span>
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {teams.map((t) => (
            <div key={t.id} className="bg-white rounded-3xl border border-violet-200 shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <TeamAvatarArt avatar={t.avatar} size={52} />
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-lg text-indigo-950 truncate">{t.name}</h3>
                    <p className="text-xs text-slate-600">
                      Members: <strong>{t.members.map((m) => m.nickname).join(' · ')}</strong>
                    </p>
                    <p className="text-xs text-violet-700 font-semibold">
                      Captain: {t.captainName} · Username: <span className="font-mono-num">{t.username}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono-num shrink-0">
                  <p className="text-sm font-extrabold text-amber-600">{t.coins.toLocaleString()} coins</p>
                  <p className="text-xs font-bold text-violet-700">{t.termPower.toLocaleString()} term PWR</p>
                </div>
              </div>

              <div className="pt-3 border-t border-violet-100 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditTeam(t)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 text-xs font-bold"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Members / Captain</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleResetPassword(t)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Reset Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRewardTeam(t);
                    setRewardCoins(50);
                    setRewardPower(0);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Award Coins / Power</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Team Modal */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveTeamEdit}
            className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-violet-200 p-6 space-y-4"
          >
            <h2 className="text-lg font-extrabold text-indigo-950">Edit {editingTeam.name}</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Team Name</label>
              <input
                type="text"
                required
                value={editingTeam.name}
                onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-violet-200 text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Members (2–4)</label>
                {editMembers.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setEditMembers([...editMembers, ''])}
                    className="text-xs font-bold text-violet-700"
                  >
                    + Add
                  </button>
                )}
              </div>
              {editMembers.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={m}
                    onChange={(e) => {
                      const next = [...editMembers];
                      next[idx] = e.target.value;
                      setEditMembers(next);
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-violet-200 text-sm"
                  />
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="editCap"
                      checked={editCaptainIdx === idx}
                      onChange={() => setEditCaptainIdx(idx)}
                    />
                    <span>Captain</span>
                  </label>
                  {editMembers.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = editMembers.filter((_, i) => i !== idx);
                        setEditMembers(next);
                        if (editCaptainIdx >= next.length) setEditCaptainIdx(0);
                      }}
                      className="text-red-500 font-bold px-1.5"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingTeam(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-violet-700 text-white text-sm font-bold">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Award Coins / Power Modal */}
      {rewardTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSendReward}
            className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-violet-200 p-6 space-y-4"
          >
            <h2 className="text-lg font-extrabold text-indigo-950">
              Reward {rewardTeam.name}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-500" /> Bonus Coins
                </label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={rewardCoins}
                  onChange={(e) => setRewardCoins(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-violet-200 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-violet-600" /> Bonus Island Power
                </label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={rewardPower}
                  onChange={(e) => setRewardPower(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-violet-200 text-sm font-mono-num"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Classroom Activity Reason</label>
              <input
                type="text"
                required
                value={rewardReason}
                onChange={(e) => setRewardReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-violet-200 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setRewardTeam(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 text-sm font-bold">
                Send Reward
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
