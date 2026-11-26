import { CheckCircle2, Edit3, Printer, RotateCcw } from 'lucide-react';
import type { ApplicationFormData, SubmittedApplicationRecord } from '../types/application.ts';
import { formatThaiDateTime } from '../utils/applicationHelpers.ts';
import { PrintableApplicationSheet } from './PrintableApplicationSheet.tsx';

interface ReviewAndSubmitProps {
  formData: ApplicationFormData;
  submittedRecord: SubmittedApplicationRecord | null;
  isSubmitting: boolean;
  submitError: string | null;
  onJumpToStep: (stepIndex: number) => void;
  onSubmitApplication: () => void;
  onStartNewApplication: () => void;
  onGoTrackStatus: (applicationId: string) => void;
}

export function ReviewAndSubmit({
  formData,
  submittedRecord,
  isSubmitting,
  submitError,
  onJumpToStep,
  onSubmitApplication,
  onStartNewApplication,
  onGoTrackStatus,
}: ReviewAndSubmitProps) {
  if (submittedRecord) {
    return (
      <div className="space-y-6">
        <div className="no-print rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-700" />
              <div>
                <h2 className="font-display text-xl font-bold text-emerald-950">
                  ส่งใบสมัครพยาบาลวิชาชีพสำเร็จเรียบร้อยแล้ว
                </h2>
                <p className="mt-1 text-sm text-emerald-900">
                  ฝ่ายทรัพยากรบุคคล โรงงานน้ำตาลมิตรภูเวียง ได้รับข้อมูลประวัติและเอกสารของท่านเข้าสู่ระบบแล้ว
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-emerald-950">
                  <div>
                    เลขที่ใบสมัครอ้างอิง:{' '}
                    <span className="font-mono text-base font-bold text-teal-900 tabular-nums">
                      {submittedRecord.applicationId}
                    </span>
                  </div>
                  <div>
                    เวลาที่ยื่นสมัคร:{' '}
                    <span className="font-medium tabular-nums">
                      {formatThaiDateTime(submittedRecord.submittedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-900 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>พิมพ์ใบสมัคร / บันทึกเป็น PDF</span>
            </button>

            <button
              type="button"
              onClick={() => onGoTrackStatus(submittedRecord.applicationId)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-teal-900/20 bg-white px-4 py-2.5 text-sm font-medium text-teal-950 hover:bg-teal-50 cursor-pointer"
            >
              ตรวจสอบสถานะใบสมัคร
            </button>

            <button
              type="button"
              onClick={onStartNewApplication}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-teal-900 hover:bg-white/70 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>กรอกใบสมัครใหม่</span>
            </button>
          </div>
        </div>

        <PrintableApplicationSheet
          data={submittedRecord}
          applicationId={submittedRecord.applicationId}
          submittedAt={submittedRecord.submittedAt}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-teal-900/10 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-teal-950 sm:text-2xl">
            6. ตรวจสอบข้อมูลก่อนส่งใบสมัคร (Review &amp; Submit)
          </h2>
          <p className="mt-1 text-sm text-teal-900/75">
            กรุณาตรวจสอบความถูกต้องของประวัติส่วนตัว ประวัติการทำงาน การศึกษา และเอกสารแนบก่อนกดยืนยันส่งใบสมัคร
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { idx: 0, label: 'แก้ข้อมูลส่วนตัว' },
            { idx: 1, label: 'แก้ประวัติงาน/ศึกษา' },
            { idx: 2, label: 'แก้ใบประกอบฯ/ฉุกเฉิน' },
            { idx: 3, label: 'แก้เอกสารแนบ' },
          ].map((btn) => (
            <button
              key={btn.idx}
              type="button"
              onClick={() => onJumpToStep(btn.idx)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-teal-900/15 bg-white/80 px-3 py-1.5 text-xs font-medium text-teal-950 hover:bg-white cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {submitError}
        </div>
      )}

      <PrintableApplicationSheet data={formData} />

      <div className="flex flex-col-reverse gap-3 border-t border-teal-900/10 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-teal-900/15 bg-white/85 px-4 py-2.5 text-sm font-medium text-teal-950 hover:bg-white cursor-pointer sm:w-auto"
        >
          <Printer className="h-4 w-4" />
          <span>พิมพ์ตัวอย่างเอกสาร</span>
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onSubmitApplication}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-teal-800 px-7 py-3 text-base font-semibold text-white shadow-md shadow-teal-950/15 transition-all hover:bg-teal-900 disabled:opacity-60 cursor-pointer sm:w-auto"
        >
          {isSubmitting ? 'กำลังบันทึกและส่งใบสมัคร...' : 'ยืนยันส่งใบสมัครออนไลน์'}
        </button>
      </div>
    </div>
  );
}
