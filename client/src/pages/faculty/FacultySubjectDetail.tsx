import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api, apiBaseUrl, apiErrorMessage, tokenStore } from '../../lib/api';
import type {
  ClassSession,
  SessionRoster,
  SessionSubjectRef,
  SessionTokens,
  Subject,
  SubjectAnalytics,
} from '../../lib/types';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { StatCard } from '../../components/StatCard';

type Tab = 'overview' | 'students' | 'sessions' | 'analytics';

export default function FacultySubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [analytics, setAnalytics] = useState<SubjectAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
  const [presentCount, setPresentCount] = useState(0);

  const [startOpen, setStartOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollInput, setEnrollInput] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const [rosterSessionId, setRosterSessionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, sess, an, all, active] = await Promise.all([
        api.get<{ subject: Subject }>(`/subjects/${id}`),
        api.get<{ sessions: ClassSession[] }>(`/sessions/subject/${id}`),
        api.get<SubjectAnalytics & { success: true }>(`/analytics/subjects/${id}`),
        api.get<{ subjects: Subject[] }>('/subjects'),
        api.get<{ session: ClassSession | null }>(`/sessions/active/subject/${id}`),
      ]);
      setSubject(s.data.subject);
      setSessions(sess.data.sessions);
      setAnalytics(an.data);
      setAllSubjects(all.data.subjects);
      setActiveSession(active.data.session ?? null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // While a session is live, poll attendance count every few seconds so
  // faculty sees students appear without manual refresh.
  useEffect(() => {
    if (!activeSession || !id) return;
    const sid = activeSession._id;
    const poll = async () => {
      try {
        const res = await api.get<{ records: Array<{ subject: { _id: string } | string }> }>(
          `/sessions/${sid}/attendance`
        );
        const count = res.data.records.filter((r) => {
          const subj = r.subject;
          const subjId = typeof subj === 'string' ? subj : subj._id;
          return subjId === id;
        }).length;
        setPresentCount(count);
      } catch {
        // ignore polling errors
      }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [activeSession, id]);

  const handleStart = async (selectedSubjectIds: string[]) => {
    if (selectedSubjectIds.length === 0) return;
    try {
      const res = await api.post<{
        session: ClassSession;
        reused?: boolean;
      }>('/sessions', { subjectIds: selectedSubjectIds });
      setActiveSession(res.data.session);
      setPresentCount(0);
      if (res.data.reused) toast('Reusing the existing active session', { icon: 'ℹ️' });
      else toast.success('Session started');
      setStartOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleClose = async () => {
    if (!activeSession) return;
    try {
      await api.post(`/sessions/${activeSession._id}/close`);
      toast.success('Session ended');
      setActiveSession(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleEnroll = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const items = enrollInput
      .split(/[\s,;\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (items.length === 0) return;

    const emails = items.filter((x) => x.includes('@'));
    const rollNumbers = items.filter((x) => !x.includes('@'));

    setEnrolling(true);
    try {
      const res = await api.post<{ addedCount: number }>(`/subjects/${id}/students`, {
        emails,
        rollNumbers,
      });
      toast.success(`Added ${res.data.addedCount} student(s)`);
      setEnrollInput('');
      setEnrollOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setEnrolling(false);
    }
  };

  const handleExportCsv = async () => {
    if (!id) return;
    try {
      // Use raw fetch (not axios) so we can stream a Blob response, but route
      // through the same base URL that axios uses so dev proxy + prod URL both work.
      const res = await fetch(`${apiBaseUrl}/analytics/subjects/${id}/export`, {
        headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${subject?.code ?? 'export'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not export CSV'));
    }
  };

  const handleSaveEdit = async (updates: {
    name: string;
    code: string;
    department?: string;
    semester?: number;
  }) => {
    if (!id) return;
    try {
      const res = await api.patch<{ subject: Subject }>(`/subjects/${id}`, updates);
      setSubject(res.data.subject);
      setEditOpen(false);
      toast.success('Subject updated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await api.delete(`/subjects/${id}`);
      toast.success('Subject deleted');
      navigate('/faculty/subjects', { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const studentCount = useMemo(
    () => (subject && Array.isArray(subject.students) ? subject.students.length : 0),
    [subject]
  );

  if (loading || !subject) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/faculty/subjects" className="text-xs text-slate-500 hover:text-slate-700">
            ← Subjects
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <span className="badge bg-brand-50 text-brand-700">{subject.code}</span>
            <h1 className="text-2xl font-bold text-slate-900">{subject.name}</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {subject.department ?? '—'}
            {subject.semester ? ` · Semester ${subject.semester}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditOpen(true)} className="btn-secondary">
            Edit
          </button>
          <button onClick={() => setDeleteOpen(true)} className="btn-danger">
            Delete
          </button>
          {activeSession ? (
            <button onClick={handleClose} className="btn-danger">
              End session
            </button>
          ) : (
            <button onClick={() => setStartOpen(true)} className="btn-primary">
              Start attendance session
            </button>
          )}
        </div>
      </header>

      {activeSession ? (
        <LiveSessionCard
          session={activeSession}
          presentCount={presentCount}
          totalStudents={studentCount}
        />
      ) : null}

      <div className="card">
        <nav className="flex gap-1 border-b border-slate-100 px-2">
          {(['overview', 'students', 'sessions', 'analytics'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize ${
                tab === t
                  ? 'border-b-2 border-brand-600 text-brand-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="p-5">
          {tab === 'overview' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Students" value={studentCount} accent="brand" />
              <StatCard label="Sessions held" value={sessions.length} accent="emerald" />
              <StatCard
                label="Average attendance"
                value={`${analytics?.averagePercentage ?? 0}%`}
                accent="amber"
              />
            </div>
          )}

          {tab === 'students' && (
            <StudentsTab
              subject={subject}
              onEnrollClick={() => setEnrollOpen(true)}
              onRemoved={load}
            />
          )}

          {tab === 'sessions' && (
            <SessionsTab
              sessions={sessions}
              thisSubjectId={subject._id}
              onPickSession={setRosterSessionId}
            />
          )}

          {tab === 'analytics' && (
            <AnalyticsTab analytics={analytics} onExport={handleExportCsv} />
          )}
        </div>
      </div>

      <StartSessionModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        currentSubject={subject}
        allSubjects={allSubjects}
        onStart={handleStart}
      />

      <EditSubjectModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        subject={subject}
        onSave={handleSaveEdit}
      />

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this subject?"
        footer={
          <>
            <button onClick={() => setDeleteOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} className="btn-danger">
              Yes, delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This will permanently delete <strong>{subject.name}</strong> ({subject.code}) and all its
          attendance records. Multi-subject sessions that also cover this subject will lose this
          entry. This action cannot be undone.
        </p>
      </Modal>

      <Modal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title="Enroll students"
        footer={
          <>
            <button onClick={() => setEnrollOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button form="enroll" type="submit" className="btn-primary" disabled={enrolling}>
              {enrolling ? <Spinner /> : null}
              Enroll
            </button>
          </>
        }
      >
        <form id="enroll" onSubmit={handleEnroll} className="space-y-2">
          <p className="text-sm text-slate-600">
            Paste a list of student emails or roll numbers separated by commas, spaces or new lines.
            Students must already be registered.
          </p>
          <textarea
            rows={5}
            value={enrollInput}
            onChange={(e) => setEnrollInput(e.target.value)}
            className="input"
            placeholder={'rahul@college.edu\nCS2102\npriya@college.edu'}
          />
        </form>
      </Modal>

      <SessionRosterModal
        sessionId={rosterSessionId}
        onClose={() => setRosterSessionId(null)}
      />
    </div>
  );
}

function subjectRefsFromSession(session: ClassSession): SessionSubjectRef[] {
  const subjects = session.subjects;
  if (!Array.isArray(subjects)) return [];
  return subjects
    .filter((x): x is SessionSubjectRef => typeof x === 'object' && x !== null && 'code' in x)
    .map((x) => ({ _id: x._id, name: x.name, code: x.code }));
}

/* ----- Live session card with rotating tokens & visibility toggles -------- */

function useCountdown(targetIso: string | undefined): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!targetIso) {
      setSeconds(0);
      return;
    }
    const tick = () => {
      const ms = new Date(targetIso).getTime() - Date.now();
      setSeconds(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [targetIso]);
  return seconds;
}

function LiveSessionCard({
  session,
  presentCount,
  totalStudents,
}: {
  session: ClassSession;
  presentCount: number;
  totalStudents: number;
}) {
  const [showQr, setShowQr] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [tokens, setTokens] = useState<SessionTokens | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTokens = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get<SessionTokens & { success: true }>(
        `/sessions/${session._id}/tokens`
      );
      setTokens({ qr: res.data.qr, code: res.data.code });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [session._id]);

  // Fetch tokens when either toggle is first enabled (or session changes).
  useEffect(() => {
    if (!showQr && !showCode) {
      setTokens(null);
      return;
    }
    fetchTokens();
  }, [showQr, showCode, fetchTokens]);

  // Auto-refresh whichever token rotates next, plus a small buffer for clock skew.
  useEffect(() => {
    if (!tokens || (!showQr && !showCode)) return;
    const candidates: number[] = [];
    if (showQr) candidates.push(new Date(tokens.qr.rotatesAt).getTime());
    if (showCode) candidates.push(new Date(tokens.code.rotatesAt).getTime());
    const nextRotate = Math.min(...candidates);
    const delay = Math.max(500, nextRotate - Date.now() + 300);
    const t = setTimeout(fetchTokens, delay);
    return () => clearTimeout(t);
  }, [tokens, showQr, showCode, fetchTokens]);

  const qrSecondsLeft = useCountdown(tokens?.qr.rotatesAt);
  const codeSecondsLeft = useCountdown(tokens?.code.rotatesAt);

  const coveredSubjects = subjectRefsFromSession(session);
  const nothingShown = !showQr && !showCode;

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-emerald-50 text-emerald-700">Live</span>
          {coveredSubjects.length > 1 ? (
            <span className="badge bg-brand-50 text-brand-700">
              Multi-subject · {coveredSubjects.length}
            </span>
          ) : null}
          <span className="text-sm text-slate-500">
            Started {new Date(session.startedAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <span className="text-slate-500">Present: </span>
          <span className="font-semibold text-slate-900">
            {presentCount}
            <span className="ml-1 text-xs font-normal text-slate-500">/ {totalStudents}</span>
          </span>
        </div>
      </div>

      {coveredSubjects.length > 1 ? (
        <p className="mt-2 text-xs text-slate-500">
          Covers: {coveredSubjects.map((s) => s.code).join(' · ')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-4">
        <ToggleSwitch
          label="Show QR code"
          checked={showQr}
          onChange={setShowQr}
          hint="Rotates every 15s"
        />
        <ToggleSwitch
          label="Show short code"
          checked={showCode}
          onChange={setShowCode}
          hint="Rotates every 30s"
        />
        {(showQr || showCode) && refreshing ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Spinner className="h-3 w-3" /> refreshing
          </span>
        ) : null}
      </div>

      {nothingShown ? (
        <p className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Toggle one of the options above to share with students. Both codes rotate automatically
          so a screenshot becomes useless within seconds.
        </p>
      ) : null}

      {tokens && (showQr || showCode) ? (
        <div className="mt-5 grid items-center gap-6 sm:grid-cols-2">
          {showQr ? (
            <div className="flex flex-col items-center text-center">
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <img src={tokens.qr.qrDataUrl} alt="Attendance QR" className="h-48 w-48" />
              </div>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">QR rotates in</p>
              <p className="font-mono text-lg font-semibold text-slate-900">
                {qrSecondsLeft}s
              </p>
            </div>
          ) : null}

          {showCode ? (
            <div className="flex flex-col items-center text-center">
              <code className="rounded-xl bg-slate-900 px-6 py-4 font-mono text-3xl tracking-[0.4em] text-white">
                {tokens.code.value}
              </code>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => {
                    if (tokens) {
                      navigator.clipboard.writeText(tokens.code.value);
                      toast.success('Code copied');
                    }
                  }}
                  className="btn-ghost text-xs"
                >
                  Copy
                </button>
                <span className="text-xs text-slate-500">
                  Rotates in <span className="font-mono font-semibold text-slate-900">{codeSecondsLeft}s</span>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <span className="relative inline-block h-5 w-9">
        <input
          type="checkbox"
          className="peer absolute h-0 w-0 opacity-0"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-brand-600" />
        <span className="absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {hint ? <span className="text-xs text-slate-400">· {hint}</span> : null}
    </label>
  );
}

/* ----- Start / Edit modals ------------------------------------------------ */

function StartSessionModal({
  open,
  onClose,
  currentSubject,
  allSubjects,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  currentSubject: Subject;
  allSubjects: Subject[];
  onStart: (subjectIds: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set([currentSubject._id]));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setSelected(new Set([currentSubject._id]));
  }, [open, currentSubject._id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await onStart(Array.from(selected));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start attendance session"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={submit} className="btn-primary" disabled={selected.size === 0 || submitting}>
            {submitting ? <Spinner /> : null}
            Start session for {selected.size} subject{selected.size === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        Tick any additional subjects to include in this session. Students will be marked present in
        every subject they're enrolled in. The session stays open until you end it manually.
      </p>
      <ul className="mt-3 max-h-72 space-y-1 overflow-auto pr-1">
        {allSubjects.map((s) => {
          const checked = selected.has(s._id);
          const isCurrent = s._id === currentSubject._id;
          return (
            <li key={s._id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                  checked
                    ? 'border-brand-300 bg-brand-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s._id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="flex-1">
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{s.code}</span>
                </span>
                {isCurrent ? (
                  <span className="badge bg-slate-100 text-slate-600">This subject</span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function EditSubjectModal({
  open,
  onClose,
  subject,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  subject: Subject;
  onSave: (updates: {
    name: string;
    code: string;
    department?: string;
    semester?: number;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: subject.name,
    code: subject.code,
    department: subject.department ?? '',
    semester: subject.semester ? String(subject.semester) : '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: subject.name,
        code: subject.code,
        department: subject.department ?? '',
        semester: subject.semester ? String(subject.semester) : '',
      });
    }
  }, [open, subject]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        department: form.department.trim() || undefined,
        semester: form.semester ? Number(form.semester) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit subject"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button form="edit-subject" type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner /> : null}
            Save changes
          </button>
        </>
      }
    >
      <form id="edit-subject" onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
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
            />
          </div>
        </div>
        <div>
          <label className="label">Department</label>
          <input
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className="input"
          />
        </div>
      </form>
    </Modal>
  );
}

/* ----- Roster modal (per-session present/absent list) -------------------- */

function SessionRosterModal({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<SessionRoster | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      return;
    }
    setLoading(true);
    api
      .get<SessionRoster & { success: true }>(`/sessions/${sessionId}/roster`)
      .then((res) => {
        setData(res.data);
        setActiveSubjectId(res.data.perSubject[0]?.subject.id ?? null);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const activeSubject = data?.perSubject.find((p) => p.subject.id === activeSubjectId);

  return (
    <Modal
      open={Boolean(sessionId)}
      onClose={onClose}
      title="Session attendance"
      footer={
        <button onClick={onClose} className="btn-secondary">
          Close
        </button>
      }
    >
      {loading || !data ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-5 w-5 text-slate-400" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <span className="text-slate-500">Started </span>
              <span className="font-medium text-slate-900">
                {new Date(data.session.startedAt).toLocaleString()}
              </span>
            </div>
            <span
              className={`badge ${
                data.session.isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {data.session.isActive ? 'Active' : 'Closed'}
            </span>
          </div>

          {data.perSubject.length > 1 ? (
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
              {data.perSubject.map((p) => (
                <button
                  key={p.subject.id}
                  onClick={() => setActiveSubjectId(p.subject.id)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    p.subject.id === activeSubjectId
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.subject.code}
                  <span className="ml-1 text-slate-400">
                    {p.presentCount}/{p.totalStudents}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {activeSubject ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <p className="font-semibold">{activeSubject.presentCount}</p>
                  <p className="uppercase tracking-wide">Present</p>
                </div>
                <div className="rounded-lg bg-rose-50 p-2 text-rose-700">
                  <p className="font-semibold">{activeSubject.absentCount}</p>
                  <p className="uppercase tracking-wide">Absent</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-slate-700">
                  <p className="font-semibold">{activeSubject.totalStudents}</p>
                  <p className="uppercase tracking-wide">Total</p>
                </div>
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Roll</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSubject.students.map((s) => (
                      <tr key={s.studentId}>
                        <td className="px-3 py-1.5 font-mono text-xs text-slate-600">
                          {s.rollNumber ?? '—'}
                        </td>
                        <td className="px-3 py-1.5 text-slate-900">{s.name}</td>
                        <td className="px-3 py-1.5 text-right">
                          {s.present ? (
                            <span className="badge bg-emerald-50 text-emerald-700">
                              Present
                              {s.markedAt
                                ? ` · ${new Date(s.markedAt).toLocaleTimeString()}`
                                : ''}
                            </span>
                          ) : (
                            <span className="badge bg-rose-50 text-rose-700">Absent</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/* ----- Existing tabs (unchanged shape) ------------------------------------ */

type EnrolledStudent = { _id: string; name: string; email: string; rollNumber?: string };

function isEnrolledStudentArray(value: unknown): value is EnrolledStudent[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'object' && v !== null && '_id' in v);
}

function StudentsTab({
  subject,
  onEnrollClick,
  onRemoved,
}: {
  subject: Subject;
  onEnrollClick: () => void;
  onRemoved: () => void;
}) {
  const students: EnrolledStudent[] = isEnrolledStudentArray(subject.students)
    ? subject.students
    : [];

  const remove = async (studentId: string) => {
    if (!confirm('Remove this student from the subject?')) return;
    try {
      await api.delete(`/subjects/${subject._id}/students/${studentId}`);
      toast.success('Student removed');
      onRemoved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{students.length} students enrolled</p>
        <button onClick={onEnrollClick} className="btn-primary">
          + Enroll students
        </button>
      </div>

      {students.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
          No students enrolled yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Roll No.</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => (
                <tr key={s._id}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">
                    {s.rollNumber ?? '—'}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-2 text-slate-500">{s.email}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => remove(s._id)}
                      className="text-xs font-medium text-rose-600 hover:text-rose-800"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SessionsTab({
  sessions,
  thisSubjectId,
  onPickSession,
}: {
  sessions: ClassSession[];
  thisSubjectId: string;
  onPickSession: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
        No sessions yet. Start one from the top of this page.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Subjects</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-right">Present</th>
            <th className="px-4 py-2 text-right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sessions.map((s) => {
            const closed = !!s.closedAt;
            const refs = subjectRefsFromSession(s);
            const others = refs.filter((r) => r._id !== thisSubjectId);
            return (
              <tr key={s._id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  {new Date(s.startedAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {refs.length <= 1 ? (
                    s.topic ?? '—'
                  ) : (
                    <span>
                      This subject
                      <span className="text-slate-400"> + </span>
                      <span className="font-mono text-xs">
                        {others.map((o) => o.code).join(', ')}
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`badge ${
                      closed ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {closed ? 'Closed' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">
                  {s.presentCount ?? 0}
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    / {s.totalStudents ?? 0}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => onPickSession(s._id)}
                    className="text-xs font-medium text-brand-600 hover:text-brand-800"
                  >
                    View roster
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsTab({
  analytics,
  onExport,
}: {
  analytics: SubjectAnalytics | null;
  onExport: () => void;
}) {
  if (!analytics) return null;

  const colorFor = (pct: number) =>
    pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sessions" value={analytics.totalSessions} accent="brand" />
        <StatCard label="Students" value={analytics.totalStudents} accent="emerald" />
        <StatCard
          label="Class average"
          value={`${analytics.averagePercentage}%`}
          accent={analytics.averagePercentage >= 75 ? 'emerald' : 'amber'}
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Per-student attendance %</h4>
          <button onClick={onExport} className="btn-secondary">
            Export CSV
          </button>
        </div>
        {analytics.students.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No students to display.</p>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.students.map((s) => ({
                  name: s.rollNumber ?? s.name,
                  pct: s.percentage,
                }))}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                  {analytics.students.map((s) => (
                    <Cell key={s.studentId} fill={colorFor(s.percentage)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Roll</th>
              <th className="px-4 py-2 text-left">Student</th>
              <th className="px-4 py-2 text-right">Present</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {analytics.students.map((s) => (
              <tr key={s.studentId}>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{s.rollNumber ?? '—'}</td>
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </td>
                <td className="px-4 py-2 text-right">{s.presentCount}</td>
                <td className="px-4 py-2 text-right">{s.totalSessions}</td>
                <td className="px-4 py-2 text-right font-semibold" style={{ color: colorFor(s.percentage) }}>
                  {s.percentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
