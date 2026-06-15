import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/api';
import type { StudentSubjectHistory } from '../../lib/types';
import { Spinner } from '../../components/Spinner';
import { StatCard } from '../../components/StatCard';

export default function StudentSubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StudentSubjectHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .get<StudentSubjectHistory & { success: true }>(`/analytics/me/subjects/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    );
  }

  const color =
    data.percentage >= 75 ? 'emerald' : data.percentage >= 50 ? 'amber' : 'rose';

  return (
    <div className="space-y-6">
      <header>
        <Link to="/student" className="text-xs text-slate-500 hover:text-slate-700">
          ← Dashboard
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <span className="badge bg-brand-50 text-brand-700">{data.subject.code}</span>
          <h1 className="text-2xl font-bold text-slate-900">{data.subject.name}</h1>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Attendance %" value={`${data.percentage}%`} accent={color} />
        <StatCard label="Present" value={data.presentCount} accent="emerald" />
        <StatCard label="Total sessions" value={data.totalSessions} accent="brand" />
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Session history</h3>
        {data.history.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
            No sessions held yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Topic</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.history.map((h) => (
                  <tr key={h.sessionId}>
                    <td className="px-4 py-2 text-slate-700">
                      {new Date(h.date).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{h.topic ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`badge ${
                          h.present
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {h.present ? 'Present' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
