import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { api, apiErrorMessage } from '../../lib/api';
import type { StudentOverview } from '../../lib/types';
import { Spinner } from '../../components/Spinner';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';

export default function StudentDashboard() {
  const [data, setData] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<StudentOverview & { success: true }>('/analytics/me/overview')
      .then((res) => setData(res.data))
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    );
  }

  if (!data || data.subjects.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Your attendance</h1>
          <p className="text-sm text-slate-500">Track your attendance across all subjects.</p>
        </header>
        <EmptyState
          title="You aren't enrolled in any subjects yet"
          description="Ask your faculty to add you using your email or roll number."
          action={
            <Link to="/student/mark" className="btn-secondary">
              Mark attendance with a code
            </Link>
          }
        />
      </div>
    );
  }

  const colorFor = (pct: number) =>
    pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your attendance</h1>
          <p className="text-sm text-slate-500">Subject-wise summary across all enrolled subjects.</p>
        </div>
        <Link to="/student/mark" className="btn-primary">
          Mark attendance
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Overall %"
          value={`${data.overallPercentage}%`}
          accent={data.overallPercentage >= 75 ? 'emerald' : 'amber'}
        />
        <StatCard label="Subjects" value={data.subjects.length} accent="brand" />
        <StatCard
          label="At risk (<75%)"
          value={data.subjects.filter((s) => s.percentage < 75).length}
          accent="rose"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Subjects</h3>
          <ul className="space-y-3">
            {data.subjects.map((s) => (
              <li key={s.subjectId}>
                <Link
                  to={`/student/subjects/${s.subjectId}`}
                  className="block rounded-lg border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="badge bg-slate-100 text-slate-700">{s.code}</span>
                        <span className="font-medium text-slate-900">{s.name}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">By {s.faculty}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {s.presentCount} / {s.totalSessions}
                      </span>
                      <span
                        className="font-semibold"
                        style={{ color: colorFor(s.percentage) }}
                      >
                        {s.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, s.percentage)}%`,
                        background: colorFor(s.percentage),
                      }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.subjects.map((s) => ({ name: s.code, value: s.percentage }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {data.subjects.map((s) => (
                    <Cell key={s.subjectId} fill={colorFor(s.percentage)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            Slice = attendance % per subject
          </p>
        </div>
      </div>
    </div>
  );
}
