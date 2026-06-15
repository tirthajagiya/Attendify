import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'brand' | 'emerald' | 'amber' | 'rose';
}

const accentMap: Record<NonNullable<StatCardProps['accent']>, string> = {
  brand: 'text-brand-600 bg-brand-50',
  emerald: 'text-emerald-600 bg-emerald-50',
  amber: 'text-amber-600 bg-amber-50',
  rose: 'text-rose-600 bg-rose-50',
};

export function StatCard({ label, value, hint, accent = 'brand' }: StatCardProps) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`rounded-md px-2 py-1 text-2xl font-bold ${accentMap[accent]}`}>{value}</span>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
    </div>
  );
}
