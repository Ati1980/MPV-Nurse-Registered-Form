import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ExternalLink, FileText, LogOut, Printer, RefreshCw, ScrollText } from 'lucide-react';
import { auth, signInHrWithGoogle, signOutHrGoogle } from '../firebase.ts';
import type {
  ApplicationStatus,
  SubmittedApplicationRecord,
} from '../types/application.ts';
import {
  isVerifiedBootstrappedAdmin,
  listApplicationsApi,
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
    if (applications.length > 0 && !selectedId) {
      setSelectedId(applications[0].applicationId);
      setNoteDraft(applications[0].hrNote || '');
    }
  }, [applications, selectedId]);

  const selectedApp =
    applications.find((a) => a.applicationId === selectedId) ?? applications[0] ?? null;

  const handleSelectApp = (app: SubmittedApplicationRecord) => {
    setSelectedId(app.applicationId);
    setNoteDraft(app.hrNote || '');
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
                  <button
                    key={app.applicationId}
                    type="button"
                    onClick={() => handleSelectApp(app)}
                    className={`interactive-card w-full rounded-2xl border p-4 text-left cursor-pointer ${
                      active
                        ? 'border-teal-700 bg-white shadow-sm'
                        : 'border-teal-900/10 bg-white/60 hover:bg-white/90'
                    }`}
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
                      {selectedApp.documents.map((doc) => {
                        const href = doc.fileUrl || doc.dataUrl;
                        return href ? (
                          <a
                            key={doc.id}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-2 rounded-xl border border-teal-900/10 bg-white px-3 py-2 text-xs hover:border-teal-700/40"
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
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                          </a>
                        ) : (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-teal-900/10 bg-white/70 px-3 py-2 text-xs"
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
                          </div>
                        );
                      })}
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
    </div>
  );
}
