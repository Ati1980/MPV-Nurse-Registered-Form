import { useState, type FormEvent } from 'react';
import { Printer, Search } from 'lucide-react';
import type { SubmittedApplicationRecord } from '../types/application.ts';
import { trackApplicationApi } from '../utils/apiClient.ts';
import { formatThaiDateTime } from '../utils/applicationHelpers.ts';
import { PrintableApplicationSheet } from './PrintableApplicationSheet.tsx';

interface StatusTrackerViewProps {
  initialCode?: string;
}

export function StatusTrackerView({ initialCode = '' }: StatusTrackerViewProps) {
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmittedApplicationRecord | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!code.trim() || !phone.trim()) {
      setError('กรุณากรอกเลขที่ใบสมัครอ้างอิงและเบอร์โทรศัพท์มือถือที่ใช้สมัคร');
      return;
    }

    setLoading(true);
    try {
      const found = await trackApplicationApi(code, phone);
      setResult(found);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อระบบตรวจสอบสถานะได้ในขณะนี้'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-3.5 py-5 sm:px-6 sm:py-10">
      <section className="no-print glass-panel rounded-3xl p-5 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-teal-950">
          ติดตามสถานะใบสมัครพยาบาลวิชาชีพ ประจำปี 2570
        </h1>
        <p className="mt-1.5 text-sm text-teal-900/75">
          กรอกเลขที่ใบสมัครอ้างอิง (เช่น MPV-2570-0001-XXX) และเบอร์โทรศัพท์มือถือที่ใช้ลงทะเบียนเพื่อตรวจสอบสถานะและพิมพ์ใบสมัครซ้ำ
        </p>

        <form onSubmit={handleSearch} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label htmlFor="trackCode" className="block text-sm font-semibold text-teal-950">
              เลขที่ใบสมัครอ้างอิง
            </label>
            <input
              id="trackCode"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MPV-2570-0001-XXX"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm font-mono text-teal-950 uppercase placeholder:normal-case placeholder:font-sans"
            />
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="trackPhone" className="block text-sm font-semibold text-teal-950">
              เบอร์โทรศัพท์มือถือ
            </label>
            <input
              id="trackPhone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812345678"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-teal-950 placeholder:font-sans"
            />
          </div>

          <div className="flex items-end sm:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-lift inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60 cursor-pointer"
            >
              <Search className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
              <span>{loading ? 'กำลังค้นหา...' : 'ตรวจสอบสถานะ'}</span>
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="animate-error-shake mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
          >
            {error}
          </div>
        )}
      </section>

      {result && (
        <div className="animate-fade-scale mt-6 space-y-6">
          <div className="no-print glass-panel rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-teal-800">สถานะปัจจุบันของใบสมัคร {result.applicationId}</p>
                <p className="font-display mt-1 text-xl font-bold text-teal-950">{result.status}</p>
                <p className="mt-1 text-xs text-teal-900/75 tabular-nums">
                  ยื่นสมัครเมื่อ {formatThaiDateTime(result.submittedAt)}
                </p>
                {result.hrNote && (
                  <p className="mt-2 rounded-xl bg-teal-900/5 px-3 py-2 text-sm text-teal-950">
                    หมายเหตุจากเจ้าหน้าที่ HR: {result.hrNote}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="btn-lift inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-900 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>พิมพ์ใบสมัคร</span>
              </button>
            </div>
          </div>

          <PrintableApplicationSheet
            data={result}
            applicationId={result.applicationId}
            submittedAt={result.submittedAt}
          />
        </div>
      )}
    </div>
  );
}
