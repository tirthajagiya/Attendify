import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/api';
import type { Subject } from '../../lib/types';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';

export default function FacultySubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', department: '', semester: '' });

  const load = () => {
    setLoading(true);
    api
      .get<{ subjects: Subject[] }>('/subjects')
      .then((res) => setSubjects(res.data.subjects))
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/subjects', {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        department: form.department.trim() || undefined,
        semester: form.semester ? Number(form.semester) : undefined,
      });
      toast.success('Subject created');
      setOpen(false);
      setForm({ name: '', code: '', department: '', semester: '' });
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subjects</h1>
          <p className="text-sm text-slate-500">Create subjects, enroll students, and run sessions.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          + New subject
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : subjects.length === 0 ? (
        <EmptyState
          title="No subjects yet"
          description="Click 'New subject' to create one."
          action={
            <button onClick={() => setOpen(true)} className="btn-primary">
              Create subject
            </button>
          }
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {subjects.map((s) => (
            <div
              key={s._id}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
            >
              <Link to={`/faculty/subjects/${s._id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="badge bg-brand-50 text-brand-700">{s.code}</span>
                  <h3 className="truncate text-base font-semibold text-slate-900">{s.name}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {s.department ?? '—'}
                  {s.semester ? ` · Semester ${s.semester}` : ''} · {' '}
                  {Array.isArray(s.students) ? s.students.length : 0} students
                </p>
              </Link>
              <Link to={`/faculty/subjects/${s._id}`} className="text-slate-300 hover:text-slate-500">
                →
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create new subject"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button form="create-subject" type="submit" className="btn-primary" disabled={creating}>
              {creating ? <Spinner /> : null}
              Create
            </button>
          </>
        }
      >
        <form id="create-subject" onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Database Management Systems"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Code</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="input uppercase"
                placeholder="CS301"
              />
            </div>
            <div>
              <label className="label">Semester</label>
              <input
                type="number"
                min={1}
                max={12}
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
                className="input"
                placeholder="5"
              />
            </div>
          </div>
          <div>
            <label className="label">Department</label>
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="input"
              placeholder="Computer Science"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
