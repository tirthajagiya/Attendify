import { FormEvent, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';
import { api, apiErrorMessage } from '../../lib/api';
import { Spinner } from '../../components/Spinner';

type Mode = 'code' | 'scan';

export default function MarkAttendance() {
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (rawCode: string) => {
    // Short codes are 6 uppercase alphanumerics; QR tokens contain dots and
    // are sent through unchanged.
    const trimmed = rawCode.trim();
    const value = trimmed.includes('.') ? trimmed : trimmed.toUpperCase().replace(/\s+/g, '');
    if (!value) return;
    setSubmitting(true);
    try {
      const res = await api.post<{
        success: true;
        alreadyMarked?: boolean;
        subjects?: Array<{ id: string; name: string; code: string }>;
      }>('/sessions/mark', { code: value });
      if (res.data.alreadyMarked) {
        toast('Attendance already marked for this session', { icon: '✅' });
      } else if (res.data.subjects && res.data.subjects.length > 0) {
        const names = res.data.subjects.map((s) => s.code).join(', ');
        toast.success(`Marked present in ${names}`);
      } else {
        toast.success('Attendance marked');
      }
      setCode('');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not mark attendance'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManual = (e: FormEvent) => {
    e.preventDefault();
    void submit(code);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Mark attendance</h1>
        <p className="text-sm text-slate-500">
          Scan the QR shown by your faculty, or enter the code manually.
        </p>
      </header>

      <div className="card p-1">
        <div className="grid grid-cols-2 gap-1 p-1">
          {(['code', 'scan'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                mode === m ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {m === 'code' ? 'Enter code' : 'Scan QR'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'code' ? (
        <div className="card p-6">
          <form onSubmit={handleManual} className="space-y-3">
            <label className="label" htmlFor="code">Attendance code</label>
            <input
              id="code"
              required
              autoFocus
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="input text-center font-mono text-2xl tracking-[0.4em] uppercase"
              placeholder="ABC123"
            />
            <p className="text-xs text-slate-500">
              The code on the projector rotates every 30 seconds. If yours stops working, just type
              the new one.
            </p>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner /> : null}
              Mark me present
            </button>
          </form>
        </div>
      ) : (
        <QrScanner onDetected={(c) => void submit(c)} disabled={submitting} />
      )}
    </div>
  );
}

function QrScanner({
  onDetected,
  disabled,
}: {
  onDetected: (code: string) => void;
  disabled: boolean;
}) {
  const containerId = 'qr-scanner';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      // Best-effort cleanup; swallow if scanner was already stopped.
      const s = scannerRef.current;
      if (!s) return;
      s.stop()
        .catch(() => undefined)
        .finally(() => {
          try {
            s.clear();
          } catch {
            // ignore
          }
        });
    };
  }, []);

  const start = async () => {
    setError(null);
    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          // Stop the camera as soon as we have a code; the caller decides what to do.
          scanner
            .stop()
            .catch(() => undefined)
            .finally(() => {
              setRunning(false);
              onDetected(decoded);
            });
        },
        () => undefined
      );
      setRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not access camera');
    }
  };

  const stop = async () => {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      // ignore
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card p-5">
      <div id={containerId} className="mx-auto h-72 w-full max-w-md overflow-hidden rounded-lg bg-slate-900" />
      <div className="mt-4 flex justify-center gap-2">
        {running ? (
          <button onClick={stop} className="btn-secondary" disabled={disabled}>
            Stop camera
          </button>
        ) : (
          <button onClick={start} className="btn-primary" disabled={disabled}>
            Start camera
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-3 text-center text-sm text-rose-600">
          {error}. Try the "Enter code" tab instead.
        </p>
      ) : null}
    </div>
  );
}
