import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlertTriangle,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  Printer,
  RefreshCw,
  ScrollText,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { auth, isFirebaseConfigured, signInHrWithGoogle, signOutHrGoogle } from '../firebase.ts';
import type {
  ApplicationStatus,
  SubmittedApplicationRecord,
  UploadedDocumentItem,
} from '../types/application.ts';
import {
  addAuthorizedHrEmailApi,
  attachMissingApplicationFileApi,
  BOOTSTRAPPED_ADMIN_EMAIL,
  checkFirestoreHrAdmin,
  deleteApplicationApi,
  fetchCloudApplicationsApi,
  type HrAllowlistEntry,
  isVerifiedBootstrappedAdmin,
  listApplicationsApi,
  listAuthorizedHrEmailsApi,
  removeAuthorizedHrEmailApi,
  resolveApplicationFileApi,
  subscribeNurseRegistrations,
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

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isCloudAdmin, setIsCloudAdmin] = useState(false);
  const [checkingCloudAdmin, setCheckingCloudAdmin] = useState(false);
  const [signingInCloud, setSigningInCloud] = useState(false);
  const [syncingLocal, setSyncingLocal] = useState(false);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [cloudSyncedOnce, setCloudSyncedOnce] = useState(false);

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [hrTeamList, setHrTeamList] = useState<HrAllowlistEntry[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [newHrEmail, setNewHrEmail] = useState('');
  const [newHrLabel, setNewHrLabel] = useState('');
  const [savingTeamMember, setSavingTeamMember] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const isOwnerAdmin = Boolean(
    authReady &&
      firebaseUser &&
      isVerifiedBootstrappedAdmin(firebaseUser.email, firebaseUser.emailVerified)
  );

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      setIsCloudAdmin(false);
      return;
    }
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setIsCloudAdmin(false);
        setCheckingCloudAdmin(false);
        setAuthWarning(null);
        return;
      }

      if (isVerifiedBootstrappedAdmin(user.email, user.emailVerified)) {
        setIsCloudAdmin(true);
        setCheckingCloudAdmin(false);
        setAuthWarning(null);
        return;
      }

      setCheckingCloudAdmin(true);
      void checkFirestoreHrAdmin(user.uid, user.email, user.emailVerified)
        .then((allowed) => {
          if (cancelled) return;
          setIsCloudAdmin(allowed);
          if (!allowed) {
            setAuthWarning(
              `บัญชี ${user.email || ''} ยังไม่ได้รับสิทธิ์ผู้ดูแล HR กรุณาแจ้ง ${BOOTSTRAPPED_ADMIN_EMAIL} เพิ่มอีเมลนี้ในเมนู "จัดการสิทธิ์ทีม HR" หรือสลับบัญชี Google`
            );
          } else {
            setAuthWarning(null);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setIsCloudAdmin(false);
          setAuthWarning(
            `ไม่สามารถตรวจสอบสิทธิ์ของบัญชี ${user.email || ''} ได้ กรุณาลองใหม่อีกครั้ง`
          );
        })
        .finally(() => {
          if (!cancelled) {
            setCheckingCloudAdmin(false);
          }
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const loadHrTeamList = useCallback(async () => {
    if (!isOwnerAdmin) return;
    setLoadingTeam(true);
    setTeamError(null);
    try {
      const list = await listAuthorizedHrEmailsApi();
      setHrTeamList(list);
    } catch {
      setTeamError('ไม่สามารถโหลดรายชื่ออีเมลทีม HR ได้');
    } finally {
      setLoadingTeam(false);
    }
  }, [isOwnerAdmin]);

  useEffect(() => {
    if (teamModalOpen && isOwnerAdmin) {
      void loadHrTeamList();
    }
  }, [teamModalOpen, isOwnerAdmin, loadHrTeamList]);

  const handleAddHrEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError(null);
    setSavingTeamMember(true);
    try {
      const created = await addAuthorizedHrEmailApi(newHrEmail, newHrLabel);
      setHrTeamList((prev) => [
        created,
        ...prev.filter((item) => item.emailHash !== created.emailHash),
      ]);
      setNewHrEmail('');
      setNewHrLabel('');
    } catch (err) {
      setTeamError(
        err instanceof Error && err.message ? err.message : 'ไม่สามารถเพิ่มอีเมลทีม HR ได้'
      );
    } finally {
      setSavingTeamMember(false);
    }
  };

  const handleRemoveHrEmail = async (emailHash: string) => {
    setTeamError(null);
    try {
      await removeAuthorizedHrEmailApi(emailHash);
      setHrTeamList((prev) => prev.filter((item) => item.emailHash !== emailHash));
    } catch {
      setTeamError('ไม่สามารถลบสิทธิ์อีเมลนี้ได้');
    }
  };

  const handleSignInCloud = useCallback(async () => {
    if (!auth) return;
    setSigningInCloud(true);
    setAuthWarning(null);
    setError(null);
    try {
      await signInHrWithGoogle();
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-blocked') {
        setAuthWarning('เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ Google กรุณาอนุญาตป๊อปอัปแล้วลองอีกครั้ง');
      } else if (code === 'auth/unauthorized-domain') {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthWarning(
          `โดเมน "${currentHost}" ยังไม่ได้รับอนุญาตใน Firebase Authentication กรุณาไปที่ Firebase Console → Authentication → Settings → Authorized domains แล้วเพิ่มโดเมน "${currentHost}"`
        );
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthWarning('ไม่สามารถเข้าสู่ระบบ Google ได้ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setSigningInCloud(false);
    }
  }, []);

  useEffect(() => {
    if (!isCloudAdmin) {
      setCloudApplications([]);
      setCloudSyncedOnce(false);
      return;
    }
    const unsubscribe = subscribeNurseRegistrations(
      (records) => {
        setCloudApplications(records);
        setCloudSyncedOnce(true);
        setLoading(false);
      },
      () => {
        setError('ไม่สามารถดึงข้อมูลจากฐานข้อมูลคลาวด์ Firebase ได้ กรุณาลองกดรีเฟรชรายการ');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [isCloudAdmin]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [localList, cloudList] = await Promise.all([
        listApplicationsApi(),
        isCloudAdmin ? fetchCloudApplicationsApi() : Promise.resolve(null),
      ]);
      setLocalApplications(localList);
      if (cloudList !== null) {
        setCloudApplications(cloudList);
        setCloudSyncedOnce(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, [isCloudAdmin]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  const cloudIdSet = useMemo(
    () => new Set(cloudApplications.map((c) => c.applicationId)),
    [cloudApplications]
  );

  const localOnlyApplications = useMemo(
    () =>
      isCloudAdmin && cloudSyncedOnce
        ? localApplications.filter((local) => !cloudIdSet.has(local.applicationId))
        : [],
    [isCloudAdmin, cloudSyncedOnce, localApplications, cloudIdSet]
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
      setError('ไม่สามารถซิงค์ข้อมูลบางรายการขึ้นคลาวด์ได้ กรุณาลองใหม่อีกครั้ง');
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
      setNoteDraft('');
      return;
    }
    const existingSelected = selectedId
      ? applications.find((a) => a.applicationId === selectedId)
      : null;
    if (existingSelected) {
      setNoteDraft((prev) => (prev === '' && existingSelected.hrNote ? existingSelected.hrNote : prev));
      return;
    }
    const first = applications[0];
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
            'ไม่พบไฟล์เอกสารต้นฉบับในระบบ (อาจเป็นใบสมัครที่ส่งก่อนอัปเดตการจัดเก็บไฟล์บนคลาวด์ หรือไฟล์ถูกล้างจากเซิร์ฟเวอร์ชั่วคราว)',
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
            : 'ไม่สามารถอัปโหลดไฟล์เข้าระบบคลาวด์ได้ กรุณาลองใหม่อีกครั้ง',
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
            {isOwnerAdmin && (
              <button
                type="button"
                onClick={() => setTeamModalOpen(true)}
                className="btn-lift inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-teal-700/25 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 cursor-pointer"
              >
                <Users className="h-4 w-4 text-teal-800" />
                <span>จัดการสิทธิ์ทีม HR</span>
              </button>
            )}

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
                    ? 'กำลังซิงค์ขึ้นคลาวด์...'
                    : `ซิงค์ข้อมูลขึ้นคลาวด์ (${localOnlyApplications.length} รายการ)`}
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
              onClick={() => void handleLogoutClick()}
              className="btn-lift inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>

        {!isFirebaseConfigured && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-950">
            <p className="font-bold">ยังไม่ได้เชื่อมต่อค่ากำหนด Firebase คลาวด์ในบิลด์นี้</p>
            <p className="mt-1 text-xs text-amber-900/85">
              กรุณาตรวจสอบว่าได้อัปโหลดไฟล์ firebase-applet-config.json ขึ้น GitHub แล้ว หรือตั้งค่า Environment Variables (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_DATABASE_ID) บน Vercel จากนั้น Redeploy อีกครั้ง
            </p>
          </div>
        )}

        {isFirebaseConfigured && authReady && !checkingCloudAdmin && !isCloudAdmin && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-sky-300/80 bg-sky-50/90 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600/15 text-sky-800">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-sky-950">
                  เชื่อมต่อฐานข้อมูลคลาวด์เพื่อดูข้อมูลใบสมัครจากทุกเบราว์เซอร์และทุกเครื่อง
                </p>
                <p className="mt-0.5 text-xs text-sky-900/80">
                  {firebaseUser
                    ? `ขณะนี้ลงชื่อเข้าใช้ด้วย ${firebaseUser.email || 'บัญชีอื่น'} (ยังไม่ได้รับสิทธิ์ HR) กรุณาแจ้ง ${BOOTSTRAPPED_ADMIN_EMAIL} เพิ่มอีเมลนี้ใน "จัดการสิทธิ์ทีม HR" หรือสลับบัญชี Google`
                    : `เข้าสู่ระบบด้วยบัญชี Google ที่ได้รับสิทธิ์ HR (บัญชีหลัก ${BOOTSTRAPPED_ADMIN_EMAIL} หรืออีเมลทีม HR ที่ได้รับอนุมัติแล้ว) เพื่อดึงข้อมูลและเอกสารแนบจากคลาวด์แบบเรียลไทม์`}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={signingInCloud}
              onClick={() => void handleSignInCloud()}
              className="btn-lift inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-900 disabled:opacity-60 cursor-pointer"
            >
              {signingInCloud ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              <span>
                {signingInCloud
                  ? 'กำลังเชื่อมต่อ...'
                  : firebaseUser
                  ? 'สลับบัญชี Google HR'
                  : 'เข้าสู่ระบบ Google (HR)'}
              </span>
            </button>
          </div>
        )}

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

        {!loading &&
          !error &&
          applications.length === 0 &&
          (!isFirebaseConfigured || isCloudAdmin) && (
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

      {/* HR Team Email Allowlist Management Modal (Owner Only) */}
      {createPortal(
        <AnimatePresence>
          {teamModalOpen && isOwnerAdmin && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="hr-team-modal-title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setTeamModalOpen(false);
                }
              }}
              className="no-print fixed inset-0 z-50 flex items-center justify-center bg-teal-950/60 p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-lg rounded-3xl border border-teal-900/15 bg-white p-6 shadow-2xl"
              >
              <div className="flex items-start justify-between gap-3 border-b border-teal-900/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-800">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3
                      id="hr-team-modal-title"
                      className="font-display text-lg font-bold text-teal-950"
                    >
                      จัดการสิทธิ์ทีม HR (อีเมล Google)
                    </h3>
                    <p className="text-xs text-teal-900/70">
                      เพิ่มอีเมล Google ของเจ้าหน้าที่ HR ท่านอื่น เพื่อให้เข้าดู/พิมพ์/ส่งออกข้อมูลได้จากทุกเครื่อง
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamModalOpen(false)}
                  aria-label="ปิดหน้าต่างจัดการสิทธิ์ทีม HR"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-teal-900/15 text-teal-900 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={(e) => void handleAddHrEmail(e)} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="newHrEmailInput" className="block text-xs font-semibold text-teal-950">
                    อีเมล Google ของเจ้าหน้าที่ HR ที่ต้องการเพิ่ม
                  </label>
                  <input
                    id="newHrEmailInput"
                    type="email"
                    required
                    value={newHrEmail}
                    onChange={(e) => setNewHrEmail(e.target.value)}
                    placeholder="เช่น hr.staff@gmail.com"
                    className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={newHrLabel}
                    onChange={(e) => setNewHrLabel(e.target.value)}
                    placeholder="ชื่อหรือตำแหน่ง (ไม่บังคับ)"
                    className="glass-input flex-1 min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950"
                  />
                  <button
                    type="submit"
                    disabled={savingTeamMember}
                    className="btn-lift inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60 cursor-pointer"
                  >
                    {savingTeamMember ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    <span>{savingTeamMember ? 'กำลังบันทึก...' : 'เพิ่มสิทธิ์ HR'}</span>
                  </button>
                </div>
              </form>

              {teamError && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                  {teamError}
                </div>
              )}

              <div className="mt-5 max-h-60 space-y-2 overflow-y-auto border-t border-teal-900/10 pt-4">
                <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2.5 text-xs">
                  <div>
                    <p className="font-semibold text-teal-950">{BOOTSTRAPPED_ADMIN_EMAIL}</p>
                    <p className="text-[11px] text-teal-800">ผู้ดูแลหลัก (ถาวร)</p>
                  </div>
                </div>

                {loadingTeam ? (
                  <p className="py-4 text-center text-xs text-teal-900/60">กำลังโหลดรายชื่อ...</p>
                ) : hrTeamList.length === 0 ? (
                  <p className="py-4 text-center text-xs text-teal-900/60">
                    ยังไม่ได้เพิ่มอีเมลเจ้าหน้าที่ HR ท่านอื่น
                  </p>
                ) : (
                  hrTeamList.map((member) => (
                    <div
                      key={member.emailHash}
                      className="flex items-center justify-between gap-2 rounded-xl border border-teal-900/10 bg-white px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-teal-950">{member.email}</p>
                        {member.label && (
                          <p className="truncate text-[11px] text-teal-900/65">{member.label}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveHrEmail(member.emailHash)}
                        title="ถอนสิทธิ์อีเมลนี้"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
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
