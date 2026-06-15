import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../lib/api';
import { Spinner } from '../components/Spinner';
import { AuthShell } from './Login';
import type { UserRole } from '../lib/types';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<UserRole>('student');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    rollNumber: '',
    department: '',
  });

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        rollNumber: role === 'student' ? form.rollNumber.trim() : undefined,
        department: form.department.trim() || undefined,
      });
      toast.success(`Welcome to Attendify, ${user.name}!`);
      navigate(user.role === 'faculty' ? '/faculty' : '/student', { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Registration failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Attendify in seconds"
      footer={
        <p className="text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <span className="label">I am a</span>
          <div className="grid grid-cols-2 gap-2">
            {(['student', 'faculty'] as UserRole[]).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                  role === r
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" required value={form.name} onChange={update('name')} className="input" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={update('email')}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={update('password')}
              className="input"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {role === 'student' ? (
            <div>
              <label className="label" htmlFor="rollNumber">Roll number</label>
              <input
                id="rollNumber"
                required
                value={form.rollNumber}
                onChange={update('rollNumber')}
                className="input"
                placeholder="CS2101"
              />
            </div>
          ) : null}
          <div className={role === 'student' ? '' : 'sm:col-span-2'}>
            <label className="label" htmlFor="department">Department</label>
            <input
              id="department"
              value={form.department}
              onChange={update('department')}
              className="input"
              placeholder="Computer Science"
            />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? <Spinner /> : null}
          Create account
        </button>
      </form>
    </AuthShell>
  );
}
