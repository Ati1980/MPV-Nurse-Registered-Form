import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  LogOut,
  Printer,
  RefreshCw,
  ScrollText,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { isSupabaseConfigured } from '../supabase.ts';
import type {
  ApplicationStatus,
  SubmittedApplicationRecord,
  UploadedDocumentItem,
} from '../types/application.ts';
import {
  attachMissingApplicationFileApi,
  deleteApplicationApi,
  fetchCloudApplicationsApi,
  getStoredHrPin,
  listApplicationsApi,
  resolveApplicationFileApi,
  syncLocalApplicationToCloudApi,
  updateApplicationStatusApi,
} from '../utils/apiClient.ts';
import {
  formatBytes,
  formatThaiDateTime,
  getApplicationStatusStyle,
} from '../utils/applicationHelpers.ts';
import { renderPdfBlobToImageUrls } from '../utils/pdfRenderHelper.ts';
import { ContractPrintModal } from './ContractPrintModal.tsx';
import { PrintableApplicationSheet } from './PrintableApplicationSheet.tsx';

const HR_SELECTED_ID_STORAGE_KEY = 'mpv_hr_selected_id_v1';

const STATUS_OPTIONS: ApplicationStatus[] = [
  'ได้รับใบสมัครแล้ว',
  'อยู่ระหว่างตรวจสอบเอกสาร',
  'ผ่านการคัดกรองเบื้องต้น',
  'นัดหมายสัมภาษณ์',
];

interface HrReviewViewProps {
  onLogout: () => void;
}

export function HrReviewView({ onLogout }: HrReviewViewProps) {
  const [localApplications, setLocalApplications] = useState<SubmittedApplicationRecord[]>([]);
  const [cloudApplications, setCloudApplications] = useState<SubmittedApplicationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(HR_SELECTED_ID_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [contractModalOpen, setContractModalOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SubmittedApplicationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [previewState, setPreviewState] = useState<{
    doc: UploadedDocumentItem;
    loading: boolean;
    uploadingRecovery?: boolean;
    objectUrl: string | null;
    pdfPageUrls: string[];
    mimeType: string;
    error: string | null;
  } | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);

  const [syncingLocal, setSyncingLocal] = useState(false);
  const [cloudSyncedOnce, setCloudSyncedOnce] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    const hrPin = getStoredHrPin();
    try {
      const [localList, cloudList] = await Promise.all([
        listApplicationsApi(),
        isSupabaseConfigured && hrPin ? fetchCloudApplicationsApi(hrPin) : Promise.resolve(null),
      ]);
      setLocalApplications(localList);
      if (cloudList !== null) {
        setCloudApplications(cloudList);
        setCloudSyncedOnce(true);
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_HR_PIN') {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  // Periodically refresh Supabase cloud records so submissions from other devices appear automatically
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const intervalId = window.setInterval(() => {
      const hrPin = getStoredHrPin();
      if (!hrPin) return;
      void fetchCloudApplicationsApi(hrPin)
        .then((cloudList) => {
          setCloudApplications(cloudList);
          setCloudSyncedOnce(true);
        })
        .catch(() => {
          // Ignore background poll error
        });
    }, 20_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const cloudIdSet = useMemo(
    () => new Set(cloudApplications.map((c) => c.applicationId)),
    [cloudApplications]
  );

  const localOnlyApplications = useMemo(
    () =>
      isSupabaseConfigured && cloudSyncedOnce
        ? localApplications.filter((local) => !cloudIdSet.has(local.applicationId))
        : [],
    [cloudSyncedOnce, localApplications, cloudIdSet]
  );

  const handleSyncLocalToCloud = async () => {
    if (localOnlyApplications.length === 0) return;
    setSyncingLocal(true);
    setError(null);
    try {
      for (const rec of localOnlyApplications) {
        await syncLocalApplicationToCloudApi(rec);
      }
      const freshCloud = await fetchCloudApplicationsApi();
      setCloudApplications(freshCloud);
    } catch {
      setError('ไม่สามารถซิงค์ข้อมูลบางรายการขึ้น Supabase ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSyncingLocal(false);
    }
  };

  const applications = useMemo(() => {
    const byId = new Map<string, SubmittedApplicationRecord>();
    for (const local of localApplications) {
      byId.set(local.applicationId, local);
    }
    for (const cloud of cloudApplications) {
      const existing = byId.get(cloud.applicationId);
      if (existing) {
        const mergedDocs = cloud.documents.map((cd) => {
          const matched = existing.documents.find((ld) => ld.id === cd.id);
          return matched
            ? { ...cd, fileUrl: cd.fileUrl || matched.fileUrl, dataUrl: matched.dataUrl }
            : cd;
        });
        byId.set(cloud.applicationId, { ...cloud, documents: mergedDocs });
      } else {
        byId.set(cloud.applicationId, cloud);
      }
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }, [localApplications, cloudApplications]);

  const lastSyncedNoteAppIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (applications.length === 0) {
      lastSyncedNoteAppIdRef.current = null;
      setNoteDraft('');
      return;
    }
    const existingSelected = selectedId
      ? applications.find((a) => a.applicationId === selectedId)
      : null;
    if (existingSelected) {
      if (lastSyncedNoteAppIdRef.current !== existingSelected.applicationId) {
        lastSyncedNoteAppIdRef.current = existingSelected.applicationId;
        setNoteDraft(existingSelected.hrNote || '');
      }
      return;
    }
    const first = applications[0];
    lastSyncedNoteAppIdRef.current = first.applicationId;
    setSelectedId(first.applicationId);
    setNoteDraft(first.hrNote || '');
    try {
      sessionStorage.setItem(HR_SELECTED_ID_STORAGE_KEY, first.applicationId);
    } catch {
      // Ignore storage error
    }
  }, [applications, selectedId]);

  useEffect(() => {
    return () => {
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
        activeObjectUrlRef.current = null;
      }
    };
  }, []);

  const selectedApp =
    applications.find((a) => a.applicationId === selectedId) ?? applications[0] ?? null;

  const handleSelectApp = (app: SubmittedApplicationRecord) => {
    setSelectedId(app.applicationId);
    setNoteDraft(app.hrNote || '');
    try {
      sessionStorage.setItem(HR_SELECTED_ID_STORAGE_KEY, app.applicationId);
    } catch {
      // Ignore storage error
    }
  };

  const closePreviewModal = () => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
    setPreviewState(null);
  };

  const handleOpenAttachment = async (appId: string, docItem: UploadedDocumentItem) => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
    setPreviewState({
      doc: docItem,
      loading: true,
      objectUrl: null,
      pdfPageUrls: [],
      mimeType: docItem.mimeType,
      error: null,
    });

    try {
      const resolved = await resolveApplicationFileApi(appId, docItem);
      if (!resolved) {
        setPreviewState({
          doc: docItem,
          loading: false,
          objectUrl: null,
          pdfPageUrls: [],
          mimeType: docItem.mimeType,
          error:
            'ไม่พบไฟล์เอกสารต้นฉบับในระบบ (อาจเป็นใบสมัครที่ส่งก่อนเชื่อมต่อคลาวด์ หรือไฟล์ถูกล้างจากเซิร์ฟเวอร์ชั่วคราว)',
        });
        return;
      }
      activeObjectUrlRef.current = resolved.objectUrl;
      const isPdf =
        resolved.mimeType.includes('pdf') || docItem.fileName.toLowerCase().endsWith('.pdf');
      let pdfPageUrls: string[] = [];
      if (isPdf) {
        try {
          pdfPageUrls = await renderPdfBlobToImageUrls(resolved.objectUrl);
        } catch {
          pdfPageUrls = [];
        }
      }
      setPreviewState({
        doc: docItem,
        loading: false,
        objectUrl: resolved.objectUrl,
        pdfPageUrls,
        mimeType: resolved.mimeType,
        error: null,
      });
    } catch {
      setPreviewState({
        doc: docItem,
        loading: false,
        objectUrl: null,
        pdfPageUrls: [],
        mimeType: docItem.mimeType,
        error: 'ไม่สามารถโหลดไฟล์เอกสารได้ กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  const handleRecoverMissingFile = async (
    appId: string,
    docItem: UploadedDocumentItem,
    file: File | undefined
  ) => {
    if (!file) return;
    setPreviewState((prev) =>
      prev ? { ...prev, uploadingRecovery: true, error: null } : prev
    );
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
        reader.readAsDataURL(file);
      });
      await attachMissingApplicationFileApi(
        appId,
        docItem,
        dataUrl,
        file.type || docItem.mimeType,
        file.size
      );
      await handleOpenAttachment(appId, docItem);
    } catch (err) {
      setPreviewState({
        doc: docItem,
        loading: false,
        uploadingRecovery: false,
        objectUrl: null,
        pdfPageUrls: [],
        mimeType: docItem.mimeType,
        error:
          err instanceof Error && err.message
            ? err.message
            : 'ไม่สามารถอัปโหลดไฟล์เข้า Supabase ได้ กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    const targetId = deleteTarget.applicationId;
    try {
      await deleteApplicationApi(
        targetId,
        deleteTarget.documents.map((d) => d.id)
      );
      setLocalApplications((prev) => prev.filter((item) => item.applicationId !== targetId));
      setCloudApplications((prev) => prev.filter((item) => item.applicationId !== targetId));
      if (selectedId === targetId) {
        setSelectedId(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_HR_PIN') {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'ไม่สามารถลบใบสมัครได้ กรุณาลองใหม่อีกครั้ง');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateStatus = async (status: ApplicationStatus) => {
    if (!selectedApp) return;
    setSavingStatus(true);
    setError(null);
    try {
      const updated = await updateApplicationStatusApi(
        selectedApp.applicationId,
        status,
        noteDraft
      );
      const nextNote = noteDraft.trim();
      setLocalApplications((prev) =>
        prev.map((item) =>
          item.applicationId === selectedApp.applicationId
            ? updated ?? { ...item, status, hrNote: nextNote }
            : item
        )
      );
      setCloudApplications((prev) =>
        prev.map((item) =>
          item.applicationId === selectedApp.applicationId
            ? { ...item, status, hrNote: nextNote }
            : item
        )
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_HR_PIN') {
        onLogout();
        return;
      }
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถอัปเดตสถานะได้ กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-3.5 py-5 sm:px-6 sm:py-10">
      <div className="no-print glass-panel rounded-3xl p-4 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-teal-900/10 pb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-teal-950">
              ระบบตรวจสอบใบสมัครสำหรับเจ้าหน้าที่ HR
            </h1>
            <p className="mt-1 text-sm text-teal-900/75">
              ตำแหน่งพยาบาลวิชาชีพ โรงงานน้ำตาลมิตรภูเวียง ประจำปี 2570 · จำนวนผู้สมัครทั้งหมด{' '}
              <span className="font-mono font-semibold tabular-nums">{applications.length}</span> ราย
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {localOnlyApplications.length > 0 && (
              <button
                type="button"
                disabled={syncingLocal}
                onClick={() => void handleSyncLocalToCloud()}
                className="btn-lift inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-sky-700/25 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-100 disabled:opacity-60 cursor-pointer"
              >
                {syncingLocal ? (
                  <Loader2 className="h-4 w-4 animate-spin text-sky-800" />
                ) : (
                  <Cloud className="h-4 w-4 text-sky-800" />
                )}
                <span>
                  {syncingLocal
                    ? 'กำลังซิงค์ขึ้น Supabase...'
                    : `ซิงค์ข้อมูลขึ้น Supabase (${localOnlyApplications.length} รายการ)`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void fetchApplications()}
              className="btn-lift inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-teal-900/15 bg-white/80 px-4 py-2 text-sm font-medium text-teal-950 hover:bg-white cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>รีเฟรชรายการ</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="btn-lift inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-950">
            <p className="font-bold">ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase คลาวด์</p>
            <p className="mt-1 text-xs text-amber-900/85">
              เพื่อดึงข้อมูลผู้สมัครข้ามเครื่องและข้ามเบราว์เซอร์โดยไม่ต้องล็อกอิน Gmail กรุณารันสคริปต์{' '}
              <span className="font-mono font-semibold">supabase/schema.sql</span> ใน Supabase SQL Editor แล้วตั้งค่า{' '}
              <span className="font-mono font-semibold">VITE_SUPABASE_URL</span> และ{' '}
              <span className="font-mono font-semibold">VITE_SUPABASE_ANON_KEY</span> ใน Environment Variables ของระบบ/Vercel จากนั้น Redeploy
            </p>
          </div>
        )}

        {loading && applications.length === 0 && (
          <p className="py-12 text-center text-sm text-teal-900/75">กำลังโหลดข้อมูลใบสมัคร...</p>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {!loading && !error && applications.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-base font-medium text-teal-950">ยังไม่มีใบสมัครที่ส่งเข้ามาในระบบ</p>
            <p className="mt-1 text-sm text-teal-900/70">
              เมื่อผู้สมัครยื่นใบสมัครออนไลน์ ข้อมูลและไฟล์เอกสารแนบจะแสดงที่นี่โดยอัตโนมัติ
            </p>
          </div>
        )}

        {applications.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Applicant List */}
            <div className="space-y-2.5 lg:col-span-4">
              <AnimatePresence initial={false}>
                {applications.map((app, idx) => {
                  const active = selectedApp?.applicationId === app.applicationId;
                  const statusStyle = getApplicationStatusStyle(app.status);
                  return (
                    <motion.div
                      key={app.applicationId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{
                        duration: 0.24,
                        delay: Math.min(idx * 0.04, 0.24),
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={`interactive-card relative rounded-2xl border ${
                        active
                          ? 'border-teal-700 bg-white shadow-sm'
                          : 'border-teal-900/10 bg-white/60 hover:bg-white/90'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(app)}
                        title="ลบใบสมัครนี้"
                        aria-label={`ลบใบสมัคร ${app.applicationId}`}
                        className="absolute top-3.5 left-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/95 text-rose-600 transition-colors hover:border-rose-500 hover:bg-rose-600 hover:text-white cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectApp(app)}
                        className="w-full rounded-2xl p-4 pl-11 text-left cursor-pointer"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-teal-800 tabular-nums">
                            {app.applicationId}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                            <span>{app.status}</span>
                          </span>
                        </div>
                        <p className="font-display mt-1.5 text-base font-semibold text-teal-950">
                          {app.personalInfo.title} {app.personalInfo.fullNameTh}
                        </p>
                        <p className="mt-1 text-xs text-teal-900/75 tabular-nums">
                          โทร {app.personalInfo.mobileNumber} · ใบประกอบฯ{' '}
                          {app.nursingQualification.licenseNumber || '-'}
                        </p>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Selected Applicant Details & Status Controls */}
            <AnimatePresence mode="wait">
              {selectedApp && (
                <motion.div
                  key={selectedApp.applicationId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6 lg:col-span-8"
                >
                  <div className="rounded-2xl border border-teal-900/12 bg-white/80 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-teal-800">อัปเดตผลการพิจารณาใบสมัคร</p>
                        <h2 className="font-display text-lg font-semibold text-teal-950">
                          {selectedApp.personalInfo.title} {selectedApp.personalInfo.fullNameTh}
                        </h2>
                        <p className="text-xs text-teal-900/70 tabular-nums">
                          ยื่นเมื่อ {formatThaiDateTime(selectedApp.submittedAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setContractModalOpen(true)}
                          className="btn-lift inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-teal-700/25 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100 cursor-pointer"
                        >
                          <ScrollText className="h-4 w-4 text-teal-800" />
                          <span>พิมพ์สัญญา</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="btn-lift inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-teal-900/15 bg-white px-4 py-2 text-xs font-semibold text-teal-950 hover:bg-teal-50 cursor-pointer"
                        >
                          <Printer className="h-4 w-4" />
                          <span>พิมพ์ใบสมัคร</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label htmlFor="hrNoteInput" className="block text-xs font-semibold text-teal-950">
                        หมายเหตุสำหรับผู้สมัคร / บันทึกนัดสัมภาษณ์
                      </label>
                      <input
                        id="hrNoteInput"
                        type="text"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="เช่น นัดสัมภาษณ์วันที่ 15 ม.ค. 2570 เวลา 09.30 น. ณ อาคารอำนวยการ"
                        className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((statusOption) => {
                        const isCurrent = selectedApp.status === statusOption;
                        const optionStyle = getApplicationStatusStyle(statusOption);
                        return (
                          <button
                            key={statusOption}
                            type="button"
                            disabled={savingStatus}
                            onClick={() => void handleUpdateStatus(statusOption)}
                            className={`btn-lift inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
                              isCurrent ? optionStyle.activeBtn : optionStyle.inactiveBtn
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isCurrent ? 'bg-white' : optionStyle.dot
                              }`}
                            />
                            <span>{statusOption}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Uploaded Document Files */}
                    <div className="mt-5 border-t border-teal-900/10 pt-4">
                      <h3 className="text-xs font-semibold text-teal-950">
                        เอกสารแนบที่อัปโหลดเข้าระบบ ({selectedApp.documents.length} ไฟล์)
                      </h3>
                      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {selectedApp.documents.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => void handleOpenAttachment(selectedApp.applicationId, doc)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl border border-teal-900/10 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-teal-700/40 hover:bg-teal-50/40 cursor-pointer"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-teal-700" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-teal-950">{doc.fileName}</p>
                                <p className="truncate text-[11px] text-teal-900/65">
                                  {doc.slotLabel} · {formatBytes(doc.sizeBytes)}
                                </p>
                              </div>
                            </div>
                            <Eye className="h-4 w-4 shrink-0 text-teal-700" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Printable Preview when HR clicks Print */}
      {selectedApp && (
        <div className={contractModalOpen ? 'no-print mt-6' : 'mt-6'}>
          <PrintableApplicationSheet
            data={selectedApp}
            applicationId={selectedApp.applicationId}
            submittedAt={selectedApp.submittedAt}
          />
        </div>
      )}

      {selectedApp && (
        <ContractPrintModal
          open={contractModalOpen}
          applicant={selectedApp}
          onClose={() => setContractModalOpen(false)}
        />
      )}

      {/* Confirm Delete Application Modal */}
      {createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-confirm-title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => {
                if (e.target === e.currentTarget && !deleting) {
                  setDeleteTarget(null);
                }
              }}
              className="no-print fixed inset-0 z-50 flex items-center justify-center bg-teal-950/60 p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 id="delete-confirm-title" className="font-display text-lg font-bold text-teal-950">
                      ยืนยันการลบใบสมัคร
                    </h3>
                    <p className="mt-1 text-sm text-teal-900/80">
                      ต้องการลบข้อมูลใบสมัครของ{' '}
                      <span className="font-semibold text-teal-950">
                        {deleteTarget.personalInfo.title} {deleteTarget.personalInfo.fullNameTh}
                      </span>{' '}
                      (<span className="font-mono font-semibold">{deleteTarget.applicationId}</span>) ใช่หรือไม่?
                    </p>
                    <p className="mt-2 text-xs text-rose-700">
                      การลบจะนำข้อมูลใบสมัครและไฟล์เอกสารแนบทั้งหมดออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setDeleteTarget(null)}
                    className="btn-lift inline-flex min-h-[42px] items-center justify-center rounded-xl border border-teal-900/15 bg-white px-4 py-2 text-sm font-medium text-teal-950 hover:bg-teal-50 disabled:opacity-50 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleConfirmDelete()}
                    className="btn-lift inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span>{deleting ? 'กำลังลบ...' : 'ยืนยันลบใบสมัคร'}</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Attachment Preview Modal */}
      {createPortal(
        <AnimatePresence>
          {previewState && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`เอกสารแนบ ${previewState.doc.fileName}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closePreviewModal();
                }
              }}
              className="no-print fixed inset-0 z-50 flex items-center justify-center bg-teal-950/65 p-3 sm:p-6 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-900/10 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-teal-950">
                      {previewState.doc.fileName}
                    </p>
                    <p className="text-xs text-teal-900/65">
                      {previewState.doc.slotLabel} · {formatBytes(previewState.doc.sizeBytes)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {previewState.objectUrl && (
                      <>
                        <a
                          href={previewState.objectUrl}
                          download={previewState.doc.fileName}
                          className="btn-lift inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-teal-900/15 bg-white px-3 py-1.5 text-xs font-semibold text-teal-950 hover:bg-teal-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>ดาวน์โหลด</span>
                        </a>
                        <a
                          href={previewState.objectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-lift inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>เปิดในแท็บใหม่</span>
                        </a>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={closePreviewModal}
                      aria-label="ปิดหน้าต่างเอกสาร"
                      className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-teal-900/15 bg-white text-teal-900 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex min-h-[340px] flex-1 flex-col items-center overflow-auto bg-slate-100 p-4">
                  {previewState.loading ? (
                    <div className="my-auto flex flex-col items-center gap-2 text-sm text-teal-900/75">
                      <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
                      <span>กำลังเปิดไฟล์เอกสาร...</span>
                    </div>
                  ) : previewState.error ? (
                    <div className="my-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-900">
                      <p>{previewState.error}</p>
                      {selectedApp && (
                        <label className="btn-lift mt-4 inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-900">
                          {previewState.uploadingRecovery ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UploadCloud className="h-4 w-4" />
                          )}
                          <span>
                            {previewState.uploadingRecovery
                              ? 'กำลังอัปโหลดไฟล์เข้าระบบ...'
                              : 'เลือกไฟล์นี้เพื่ออัปโหลดเข้าใบสมัคร'}
                          </span>
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            disabled={previewState.uploadingRecovery}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              void handleRecoverMissingFile(
                                selectedApp.applicationId,
                                previewState.doc,
                                f
                              );
                            }}
                            className="sr-only"
                          />
                        </label>
                      )}
                    </div>
                  ) : previewState.objectUrl && previewState.mimeType.startsWith('image/') ? (
                    <img
                      src={previewState.objectUrl}
                      alt={previewState.doc.fileName}
                      className="my-auto max-h-[74vh] w-auto rounded-xl object-contain shadow"
                    />
                  ) : previewState.pdfPageUrls.length > 0 ? (
                    <div className="flex w-full flex-col items-center gap-4">
                      {previewState.pdfPageUrls.map((pageUrl, pageIdx) => (
                        <div key={pageIdx} className="w-full max-w-3xl">
                          {previewState.pdfPageUrls.length > 1 && (
                            <p className="mb-1 text-center text-xs font-medium text-teal-900/70">
                              หน้า {pageIdx + 1} / {previewState.pdfPageUrls.length}
                            </p>
                          )}
                          <img
                            src={pageUrl}
                            alt={`${previewState.doc.fileName} หน้า ${pageIdx + 1}`}
                            className="mx-auto w-full rounded-xl border border-slate-200 bg-white shadow"
                          />
                        </div>
                      ))}
                    </div>
                  ) : previewState.objectUrl ? (
                    <iframe
                      src={previewState.objectUrl}
                      title={previewState.doc.fileName}
                      className="h-[74vh] w-full rounded-xl border border-slate-200 bg-white"
                    />
                  ) : null}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
