import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlertTriangle,
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
  X,
} from 'lucide-react';
import { auth, signInHrWithGoogle, signOutHrGoogle } from '../firebase.ts';
import type {
  ApplicationStatus,
  SubmittedApplicationRecord,
  UploadedDocumentItem,
} from '../types/application.ts';
import {
  deleteApplicationApi,
  isVerifiedBootstrappedAdmin,
  listApplicationsApi,
  resolveApplicationFileApi,
  subscribeNurseRegistrations,
  updateApplicationStatusApi,
} from '../utils/apiClient.ts';
import {
  formatBytes,
  formatThaiDateTime,
  getApplicationStatusStyle,
} from '../utils/applicationHelpers.ts';
import { ContractPrintModal } from './ContractPrintModal.tsx';
import { PrintableApplicationSheet } from './PrintableApplicationSheet.tsx';

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    objectUrl: string | null;
    mimeType: string;
    error: string | null;
  } | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const autoAuthAttemptedRef = useRef(false);

  const isCloudAdmin = Boolean(
    authReady &&
      firebaseUser &&
      isVerifiedBootstrappedAdmin(firebaseUser.email, firebaseUser.emailVerified)
  );

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user && !isVerifiedBootstrappedAdmin(user.email, user.emailVerified)) {
        setAuthWarning('บัญชี Google นี้ไม่มีสิทธิ์ผู้ดูแล HR ในระบบฐานข้อมูลคลาวด์');
      } else {
        setAuthWarning(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!auth || !authReady || firebaseUser || autoAuthAttemptedRef.current) return;
    autoAuthAttemptedRef.current = true;
    void signInHrWithGoogle().catch((err: unknown) => {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-blocked') {
        setAuthWarning(
          'เบราว์เซอร์บล็อกหน้าต่างยืนยันบัญชี HR อัตโนมัติ กรุณากดปุ่ม "รีเฟรชรายการ" เพื่อซิงค์ข้อมูลจาก Firebase'
        );
      }
    });
  }, [authReady, firebaseUser]);

  useEffect(() => {
    if (!isCloudAdmin) {
      setCloudApplications([]);
      return;
    }
    const unsubscribe = subscribeNurseRegistrations((records) => {
      setCloudApplications(records);
    });
    return unsubscribe;
  }, [isCloudAdmin]);

  const fetchApplications = useCallback(async (allowAuthPrompt = false) => {
    setLoading(true);
    setError(null);
    try {
      if (allowAuthPrompt && auth && authReady && !auth.currentUser) {
        try {
          await signInHrWithGoogle();
        } catch {
          // Continue loading local records even if sign-in popup is dismissed
        }
      }
      const list = await listApplicationsApi();
      setLocalApplications(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, [authReady]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  const applications = useMemo(() => {
    const byId = new Map<string, SubmittedApplicationRecord>();
    for (const local of localApplications) {
      byId.set(local.applicationId, local);
    }
    for (const cloud of cloudApplications) {
      const existing = byId.get(cloud.applicationId);
      if (existing) {
        // Merge fileUrl/dataUrl from local Express storage when Firestore stores metadata
        const mergedDocs = cloud.documents.map((cd) => {
          const matched = existing.documents.find((ld) => ld.id === cd.id);
          return matched ? { ...cd, fileUrl: cd.fileUrl || matched.fileUrl, dataUrl: matched.dataUrl } : cd;
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

  useEffect(() => {
    if (applications.length === 0) {
      setSelectedId(null);
      setNoteDraft('');
      return;
    }
    if (!selectedId || !applications.some((a) => a.applicationId === selectedId)) {
      setSelectedId(applications[0].applicationId);
      setNoteDraft(applications[0].hrNote || '');
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
          mimeType: docItem.mimeType,
          error:
            'ไม่พบไฟล์เอกสารต้นฉบับในระบบ (อาจเป็นใบสมัครที่ส่งก่อนอัปเดตการจัดเก็บไฟล์บนคลาวด์ หรือไฟล์ถูกล้างจากเซิร์ฟเวอร์ชั่วคราว)',
        });
        return;
      }
      activeObjectUrlRef.current = resolved.objectUrl;
      setPreviewState({
        doc: docItem,
        loading: false,
        objectUrl: resolved.objectUrl,
        mimeType: resolved.mimeType,
        error: null,
      });
    } catch {
      setPreviewState({
        doc: docItem,
        loading: false,
        objectUrl: null,
        mimeType: docItem.mimeType,
        error: 'ไม่สามารถโหลดไฟล์เอกสารได้ กรุณาลองใหม่อีกครั้ง',
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
      let msg = 'ไม่สามารถลบใบสมัครได้ กรุณาลองใหม่อีกครั้ง';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          if (parsed?.error) {
            msg = 'บัญชีที่ใช้งานยังไม่มีสิทธิ์ลบใบสมัครในฐานข้อมูล Firebase';
          }
        } catch {
          msg = err.message;
        }
      }
      setError(msg);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      if (auth?.currentUser) {
        await signOutHrGoogle();
      }
    } catch {
      // Ignore sign-out errors on lock
    }
    onLogout();
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
      let msg = 'ไม่สามารถอัปเดตสถานะได้ กรุณาลองใหม่อีกครั้ง';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          if (parsed?.error) {
            msg = 'บัญชีที่ใช้งานยังไม่มีสิทธิ์อัปเดตสถานะในฐานข้อมูล Firebase';
          }
        } catch {
          msg = err.message;
        }
      }
      setError(msg);
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
            <button
              type="button"
              onClick={() => void fetchApplications(true)}
              className="btn-lift inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-teal-900/15 bg-white/80 px-4 py-2 text-sm font-medium text-teal-950 hover:bg-white cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>รีเฟรชรายการ</span>
            </button>

            <button
              type="button"
              onClick={() => void handleLogoutClick()}
              className="btn-lift inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>

        {authWarning && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {authWarning}
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
              {applications.map((app) => {
                const active = selectedApp?.applicationId === app.applicationId;
                const statusStyle = getApplicationStatusStyle(app.status);
                return (
                  <div
                    key={app.applicationId}
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
                  </div>
                );
              })}
            </div>

            {/* Selected Applicant Details & Status Controls */}
            {selectedApp && (
              <div key={selectedApp.applicationId} className="animate-step-enter space-y-6 lg:col-span-8">
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
              </div>
            )}
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
      {deleteTarget &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            className="no-print fixed inset-0 z-50 flex items-center justify-center bg-teal-950/60 p-4 backdrop-blur-sm"
          >
            <div className="animate-fade-scale w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl">
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
            </div>
          </div>,
          document.body
        )}

      {/* Attachment Preview Modal */}
      {previewState &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`เอกสารแนบ ${previewState.doc.fileName}`}
            className="no-print fixed inset-0 z-50 flex items-center justify-center bg-teal-950/65 p-3 sm:p-6 backdrop-blur-sm"
          >
            <div className="animate-fade-scale flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
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

              <div className="flex min-h-[340px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
                {previewState.loading ? (
                  <div className="flex flex-col items-center gap-2 text-sm text-teal-900/75">
                    <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
                    <span>กำลังเปิดไฟล์เอกสาร...</span>
                  </div>
                ) : previewState.error ? (
                  <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-900">
                    {previewState.error}
                  </div>
                ) : previewState.objectUrl && previewState.mimeType.startsWith('image/') ? (
                  <img
                    src={previewState.objectUrl}
                    alt={previewState.doc.fileName}
                    className="max-h-[74vh] w-auto rounded-xl object-contain shadow"
                  />
                ) : previewState.objectUrl ? (
                  <iframe
                    src={previewState.objectUrl}
                    title={previewState.doc.fileName}
                    className="h-[74vh] w-full rounded-xl border border-slate-200 bg-white"
                  />
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
