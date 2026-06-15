import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../../lib/api';
import type { Subject } from '../../lib/types';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { Spinner } from '../../components/Spinner';
import toast from 'react-hot-toast';

export default function FacultyDashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ subjects: Subject[] }>('/subjects')
      .then((res) => setSubjects(res.data.subjects))
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const totalStudents = subjects.reduce(
    (sum, s) => sum + (Array.isArray(s.students) ? s.students.length : 0),
    0
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of your subjects and attendance activity.</p>
        </div>
        <Link to="/faculty/subjects" className="btn-primary">
          Manage subjects
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Subjects" value={subjects.length} accent="brand" />
        <StatCard label="Enrolled students" value={totalStudents} accent="emerald" />
        <StatCard
          label="Active sessions"
          value="Start one"
          hint="from a subject's page"
          accent="amber"
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Your subjects</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : subjects.length === 0 ? (
          <EmptyState
            title="No subjects yet"
            description="Create your first subject to begin tracking attendance."
            action={
              <Link to="/faculty/subjects" className="btn-primary">
                Create subject
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <Link
                key={s._id}
                to={`/faculty/subjects/${s._id}`}
                className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <span className="badge bg-brand-50 text-brand-700">{s.code}</span>
                  <span className="text-xs text-slate-400">
                    {Array.isArray(s.students) ? s.students.length : 0} students
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-brand-700">
                  {s.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {s.department ?? '—'}
                  {s.semester ? ` · Sem ${s.semester}` : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
