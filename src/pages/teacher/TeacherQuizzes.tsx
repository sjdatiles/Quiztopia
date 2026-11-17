import React, { useEffect, useState } from 'react';
import { Check, Eye, Play, Plus, Save, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type { Quiz, QuizQuestion } from '../../../shared/types.ts';

interface TeacherClassLite {
  id: string;
  name: string;
  activeTermNumber: 1 | 2 | 3;
}

export function TeacherQuizzes({
  onHostedSession,
}: {
  onHostedSession: (sessionId: string) => void;
}) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<TeacherClassLite[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Partial<Quiz> | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadAll = async () => {
    const [qRes, cRes] = await Promise.all([
      apiFetch<{ quizzes: Quiz[] }>('/api/teacher/quizzes'),
      apiFetch<{ classes: TeacherClassLite[] }>('/api/teacher/classes'),
    ]);
    setQuizzes(qRes.quizzes);
    setClasses(cRes.classes);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const startNewQuiz = () => {
    const firstClass = classes[0];
    setEditingQuiz({
      title: '',
      subject: 'Science',
      description: '',
      classId: firstClass?.id || '',
      termNumber: firstClass?.activeTermNumber || 1,
      status: 'draft',
      speedBonusEnabled: true,
      questions: [
        {
          id: `new_q_${Date.now()}`,
          orderIndex: 0,
          questionType: 'multiple_choice',
          prompt: '',
          points: 100,
          timeLimitSec: 25,
          options: [
            { id: 'opt_1', label: '', isCorrect: true },
            { id: 'opt_2', label: '', isCorrect: false },
            { id: 'opt_3', label: '', isCorrect: false },
            { id: 'opt_4', label: '', isCorrect: false },
          ],
        },
      ],
    });
    setMessage('');
    setError('');
  };

  const addQuestion = () => {
    if (!editingQuiz) return;
    const prev = editingQuiz.questions || [];
    const nextQ: QuizQuestion = {
      id: `new_q_${Date.now()}_${prev.length}`,
      orderIndex: prev.length,
      questionType: 'multiple_choice',
      prompt: '',
      points: 100,
      timeLimitSec: 25,
      options: [
        { id: `opt_${Date.now()}_1`, label: '', isCorrect: true },
        { id: `opt_${Date.now()}_2`, label: '', isCorrect: false },
        { id: `opt_${Date.now()}_3`, label: '', isCorrect: false },
        { id: `opt_${Date.now()}_4`, label: '', isCorrect: false },
      ],
    };
    setEditingQuiz({ ...editingQuiz, questions: [...prev, nextQ] });
  };

  const handleSaveQuiz = async (targetStatus: 'draft' | 'published') => {
    if (!editingQuiz) return;
    setError('');
    setMessage('');
    try {
      const payload = { ...editingQuiz, status: targetStatus };
      if (editingQuiz.id) {
        await apiFetch(`/api/teacher/quizzes/${editingQuiz.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/teacher/quizzes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingQuiz(null);
      setMessage(targetStatus === 'published' ? 'Quiz published and ready to host!' : 'Quiz draft saved.');
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to save quiz.');
    }
  };

  const handleHostQuiz = async (quizId: string) => {
    setError('');
    try {
      const res = await apiFetch<{ sessionId: string }>('/api/teacher/sessions', {
        method: 'POST',
        body: JSON.stringify({ quizId }),
      });
      onHostedSession(res.sessionId);
    } catch (err: any) {
      setError(err?.message || 'Unable to start quiz session.');
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    await apiFetch(`/api/teacher/quizzes/${quizId}`, { method: 'DELETE' });
    await loadAll();
  };

  if (editingQuiz) {
    const questions = editingQuiz.questions || [];
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold text-indigo-950">
            {editingQuiz.id ? 'Edit Quiz' : 'Quiz Builder'}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingQuiz(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveQuiz('draft')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-violet-300 text-violet-900 text-xs font-bold"
            >
              <Save className="w-4 h-4" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              onClick={() => handleSaveQuiz('published')}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Publish Quiz</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-violet-200 p-6 space-y-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Quiz Title</label>
              <input
                type="text"
                value={editingQuiz.title || ''}
                onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                placeholder="e.g. Solar System Expedition"
                className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
              <input
                type="text"
                value={editingQuiz.subject || ''}
                onChange={(e) => setEditingQuiz({ ...editingQuiz, subject: e.target.value })}
                placeholder="Science, Math, Reading..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Classroom</label>
              <select
                value={editingQuiz.classId || ''}
                onChange={(e) => setEditingQuiz({ ...editingQuiz, classId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm bg-white"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Term</label>
              <select
                value={editingQuiz.termNumber || 1}
                onChange={(e) => setEditingQuiz({ ...editingQuiz, termNumber: Number(e.target.value) as 1 | 2 | 3 })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm bg-white"
              >
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-indigo-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editingQuiz.speedBonusEnabled)}
                  onChange={(e) => setEditingQuiz({ ...editingQuiz, speedBonusEnabled: e.target.checked })}
                />
                <span>Include gentle speed bonus (up to +25%)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
            <input
              type="text"
              value={editingQuiz.description || ''}
              onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })}
              placeholder="Short description for students"
              className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm"
            />
          </div>
        </div>

        {/* Questions Builder */}
        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div key={q.id} className="bg-white rounded-3xl border border-violet-200 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-violet-800">Question {qIdx + 1}</span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingQuiz({
                        ...editingQuiz,
                        questions: questions.filter((_, idx) => idx !== qIdx),
                      })
                    }
                    className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Question Prompt</label>
                  <input
                    type="text"
                    value={q.prompt}
                    onChange={(e) => {
                      const next = [...questions];
                      next[qIdx] = { ...q, prompt: e.target.value };
                      setEditingQuiz({ ...editingQuiz, questions: next });
                    }}
                    placeholder="Enter your question..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-violet-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Points</label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={q.points}
                    onChange={(e) => {
                      const next = [...questions];
                      next[qIdx] = { ...q, points: Number(e.target.value) };
                      setEditingQuiz({ ...editingQuiz, questions: next });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-violet-200 text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Timer (sec)</label>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={q.timeLimitSec}
                    onChange={(e) => {
                      const next = [...questions];
                      next[qIdx] = { ...q, timeLimitSec: Number(e.target.value) };
                      setEditingQuiz({ ...editingQuiz, questions: next });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-violet-200 text-sm font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, oIdx) => (
                  <div
                    key={opt.id}
                    className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                      opt.isCorrect ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`correct_${q.id}`}
                      checked={Boolean(opt.isCorrect)}
                      onChange={() => {
                        const next = [...questions];
                        next[qIdx] = {
                          ...q,
                          options: q.options.map((o, i) => ({ ...o, isCorrect: i === oIdx })),
                        };
                        setEditingQuiz({ ...editingQuiz, questions: next });
                      }}
                      title="Mark as correct answer"
                    />
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...questions];
                        const nextOpts = [...q.options];
                        nextOpts[oIdx] = { ...opt, label: e.target.value };
                        next[qIdx] = { ...q, options: nextOpts };
                        setEditingQuiz({ ...editingQuiz, questions: next });
                      }}
                      placeholder={`Answer Option ${String.fromCharCode(65 + oIdx)}`}
                      className="flex-1 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addQuestion}
            className="w-full py-3.5 rounded-2xl border-2 border-dashed border-violet-300 text-violet-800 font-bold text-sm hover:bg-violet-50 transition-colors"
          >
            + Add Multiple-Choice Question
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-indigo-950">Quiz Management</h1>
          <p className="text-sm text-slate-600">Build, preview, publish, and host live classroom quiz competitions.</p>
        </div>
        <button
          type="button"
          onClick={startNewQuiz}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create Quiz</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="bg-white rounded-3xl border border-violet-200 shadow-sm p-6 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {quiz.subject} · Term {quiz.termNumber} · {quiz.questions.length} questions
                </span>
                <span className={`font-bold capitalize ${quiz.status === 'published' ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {quiz.status}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-indigo-950">{quiz.title}</h3>
              <p className="text-xs text-slate-600">{quiz.description || 'Classroom team competition'}</p>
            </div>

            <div className="pt-3 border-t border-violet-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewQuiz(quiz)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingQuiz(quiz)}
                  className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 text-xs font-bold"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuiz(quiz.id)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-600"
                  title="Delete quiz"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {quiz.status === 'published' && (
                <button
                  type="button"
                  onClick={() => handleHostQuiz(quiz.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Host Live Quiz</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4">
          <div className="max-w-xl w-full max-h-[85vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-violet-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-indigo-950">{previewQuiz.title} (Preview)</h2>
              <button
                type="button"
                onClick={() => setPreviewQuiz(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {previewQuiz.questions.map((q, idx) => (
                <div key={q.id} className="p-4 rounded-2xl bg-violet-50/70 border border-violet-100 space-y-2">
                  <p className="font-bold text-sm text-indigo-950">
                    Q{idx + 1}. {q.prompt} <span className="text-xs text-violet-700">({q.points} pts · {q.timeLimitSec}s)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((o, i) => (
                      <div
                        key={o.id}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                          o.isCorrect ? 'bg-emerald-100 text-emerald-900' : 'bg-white text-slate-700'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}. {o.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
