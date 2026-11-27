import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Loader2, RotateCcw, Send } from 'lucide-react';
import { HeroOverview } from './components/HeroOverview.tsx';
import { HrPinModal } from './components/HrPinModal.tsx';
import { HrReviewView } from './components/HrReviewView.tsx';
import { ReviewAndSubmit } from './components/ReviewAndSubmit.tsx';
import { StatusTrackerView } from './components/StatusTrackerView.tsx';
import { StepDocuments } from './components/StepDocuments.tsx';
import { StepEmergencyContact } from './components/StepEmergencyContact.tsx';
import { StepPersonalInfo } from './components/StepPersonalInfo.tsx';
import { TopBar, type ActivePage } from './components/TopBar.tsx';
import type {
  ApplicationFormData,
  SubmittedApplicationRecord,
  ValidationErrors,
} from './types/application.ts';
import {
  clearStoredHrPin,
  getStoredHrPin,
  submitApplicationApi,
} from './utils/apiClient.ts';
import {
  createInitialApplicationData,
  DRAFT_STORAGE_KEY,
  validateAllSteps,
} from './utils/applicationHelpers.ts';
import {
  clearDraftDocumentsFromIdb,
  loadDraftDocumentsFromIdb,
  saveDraftDocumentsToIdb,
} from './utils/draftStorage.ts';

const HR_UNLOCK_STORAGE_KEY = 'mpv_hr_unlocked_until_v1';
const ACTIVE_PAGE_STORAGE_KEY = 'mpv_active_page_v1';
const HR_UNLOCK_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours (cleared immediately on logout)
const VALID_PAGES: ReadonlySet<ActivePage> = new Set(['overview', 'apply', 'track', 'hr']);

function readPersistedHrUnlocked(): boolean {
  try {
    const raw = localStorage.getItem(HR_UNLOCK_STORAGE_KEY);
    if (!raw) return false;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      localStorage.removeItem(HR_UNLOCK_STORAGE_KEY);
      clearStoredHrPin();
      return false;
    }
    return Boolean(getStoredHrPin());
  } catch {
    return false;
  }
}

function writePersistedHrUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      localStorage.setItem(HR_UNLOCK_STORAGE_KEY, String(Date.now() + HR_UNLOCK_TTL_MS));
    } else {
      localStorage.removeItem(HR_UNLOCK_STORAGE_KEY);
      clearStoredHrPin();
    }
  } catch {
    // Ignore storage error
  }
}

function readHashPage(): ActivePage | null {
  try {
    const raw = window.location.hash.replace(/^#\/?/, '').trim() as ActivePage;
    return VALID_PAGES.has(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readInitialActivePage(isHrUnlocked: boolean): ActivePage {
  const fromHash = readHashPage();
  let candidate: ActivePage | null = fromHash;
  if (!candidate) {
    try {
      const saved = sessionStorage.getItem(ACTIVE_PAGE_STORAGE_KEY) as ActivePage | null;
      if (saved && VALID_PAGES.has(saved)) {
        candidate = saved;
      }
    } catch {
      // Ignore storage error
    }
  }
  if (candidate === 'hr' && !isHrUnlocked) {
    return 'overview';
  }
  return candidate ?? 'overview';
}

export default function App() {
  const [hrUnlocked, setHrUnlocked] = useState<boolean>(() => readPersistedHrUnlocked());
  const [activePage, setActivePage] = useState<ActivePage>(() =>
    readInitialActivePage(readPersistedHrUnlocked())
  );
  const [formData, setFormData] = useState<ApplicationFormData>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ApplicationFormData>;
        const merged: ApplicationFormData = {
          ...createInitialApplicationData(),
          ...parsed,
        };
        if (
          Array.isArray(merged.workExperiences) &&
          merged.workExperiences.length > 1 &&
          merged.workExperiences.every(
            (r) =>
              !r.company?.trim() &&
              !r.position?.trim() &&
              !r.fromMonthYear?.trim() &&
              !r.toMonthYear?.trim() &&
              !r.scopeOfResponsibility?.trim() &&
              !r.salary?.trim() &&
              !r.otherIncome?.trim() &&
              !r.reasonForLeaving?.trim()
          )
        ) {
          merged.workExperiences = [merged.workExperiences[0]];
        }
        if (Array.isArray(merged.documents)) {
          merged.documents = merged.documents.filter((d) => Boolean(d.dataUrl));
        }
        return merged;
      }
    } catch {
      // Ignore invalid draft JSON
    }
    return createInitialApplicationData();
  });

  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(DRAFT_STORAGE_KEY));
    } catch {
      return false;
    }
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [stepBannerError, setStepBannerError] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<SubmittedApplicationRecord | null>(null);
  const [trackInitialCode, setTrackInitialCode] = useState('');
  const [hrPinModalOpen, setHrPinModalOpen] = useState<boolean>(() => {
    const hashPage = readHashPage();
    return hashPage === 'hr' && !readPersistedHrUnlocked();
  });
  const [idbHydrated, setIdbHydrated] = useState(false);

  // Sync activePage to URL hash & sessionStorage so page refresh keeps the current view (including HR)
  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage);
      const targetHash = `#${activePage}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    } catch {
      // Ignore history/storage error
    }
  }, [activePage]);

  useEffect(() => {
    const onHashChange = () => {
      const next = readHashPage();
      if (!next) return;
      if (next === 'hr' && !hrUnlocked) {
        setHrPinModalOpen(true);
        return;
      }
      setActivePage(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [hrUnlocked]);

  // Hydrate full draft documents (including large PDFs/images) from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    void loadDraftDocumentsFromIdb().then((idbDocs) => {
      if (cancelled) return;
      if (idbDocs && idbDocs.length > 0) {
        const validDocs = idbDocs.filter((d) => Boolean(d.dataUrl));
        if (validDocs.length > 0) {
          setFormData((prev) => {
            const byId = new Map(prev.documents.map((d) => [d.id, d]));
            for (const docItem of validDocs) {
              if (!byId.has(docItem.id) || !byId.get(docItem.id)?.dataUrl) {
                byId.set(docItem.id, docItem);
              }
            }
            return { ...prev, documents: Array.from(byId.values()) };
          });
        }
      }
      setIdbHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (submittedRecord || !idbHydrated) return;
    try {
      const liteDraft: ApplicationFormData = {
        ...formData,
        // Keep small thumbnails (<150KB) in localStorage, full files live in IndexedDB
        documents: formData.documents.map((doc) =>
          doc.dataUrl && doc.dataUrl.length > 150_000
            ? { ...doc, dataUrl: undefined }
            : doc
        ),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(liteDraft));
      setHasSavedDraft(true);
    } catch {
      // Gracefully ignore localStorage quota overflow
    }
    void saveDraftDocumentsToIdb(formData.documents);
  }, [formData, submittedRecord, idbHydrated]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartApply = () => {
    setActivePage('apply');
    scrollToTop();
  };

  const handleResetDraft = () => {
    const fresh = createInitialApplicationData();
    setFormData(fresh);
    setErrors({});
    setStepBannerError(null);
    setSubmitError(null);
    setSubmittedRecord(null);
    setConfirmResetOpen(false);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setHasSavedDraft(false);
    } catch {
      // Ignore storage error
    }
    void clearDraftDocumentsFromIdb();
  };

  const handleSubmitApplication = async () => {
    setSubmitError(null);
    const allErrors = validateAllSteps(formData);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setStepBannerError(
        `พบข้อมูลที่ยังกรอกไม่ครบถ้วนหรือเอกสารไม่ครบ (${Object.keys(allErrors).length} รายการ) กรุณาตรวจสอบและแก้ไขให้ครบถ้วน`
      );
      scrollToTop();
      return;
    }

    setErrors({});
    setStepBannerError(null);

    setIsSubmitting(true);
    try {
      const savedApplication = await submitApplicationApi(formData);
      setSubmittedRecord(savedApplication);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setHasSavedDraft(false);
      } catch {
        // Ignore storage error
      }
      void clearDraftDocumentsFromIdb();
      scrollToTop();
    } catch (err) {
      let friendly = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อส่งใบสมัครได้';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          if (parsed?.error) {
            friendly = 'ไม่สามารถบันทึกใบสมัครไปยังฐานข้อมูล Supabase ได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง';
          } else {
            friendly = err.message;
          }
        } catch {
          friendly = err.message;
        }
      }
      setSubmitError(friendly);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative isolate min-h-screen flex flex-col overflow-x-clip print:min-h-0 print:block print:overflow-visible">
      {/* Fixed Full-Bleed Background Image (nurse form bg.jpg) across all pages */}
      <div
        aria-hidden="true"
        className="no-print pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#a8dfd0]"
      >
        <img
          src="/assets/aistudio/nurse_form_bg_433e63e2.jpg"
          alt=""
          referrerPolicy="no-referrer"
          className="animate-bg-breath h-full w-full object-cover object-[18%_top] sm:object-left-top"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-teal-900/5" />
      </div>

      {/* Clean 3-Zone Top Bar */}
      <TopBar
        activePage={activePage}
        onNavigate={(page) => {
          if (page === 'hr' && !hrUnlocked) {
            setHrPinModalOpen(true);
            return;
          }
          setActivePage(page);
          scrollToTop();
        }}
        onStartApply={handleStartApply}
      />

      {/* Main Content */}
      <main className="relative z-10 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="print:!transform-none print:!opacity-100"
          >
            {activePage === 'overview' && (
              <HeroOverview
                hasSavedDraft={hasSavedDraft}
                onStartApply={handleStartApply}
                onTrackStatus={() => {
                  setActivePage('track');
                  scrollToTop();
                }}
              />
            )}

            {activePage === 'apply' && (
              <div className="mx-auto max-w-5xl px-3.5 py-4 sm:px-6 sm:py-10">
                {/* Form Header & Stepper */}
                {!submittedRecord && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="no-print glass-panel mb-5 rounded-3xl p-4 sm:mb-6 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                      <div>
                        <p className="text-xs font-medium text-teal-800">
                          โรงงานน้ำตาลมิตรภูเวียง <span aria-hidden="true">·</span> ประจำปี 2570
                        </p>
                        <h1 className="font-display mt-1 text-base font-bold text-teal-950 sm:text-2xl">
                          ฟอร์มรับสมัครพยาบาลวิชาชีพ โรงงานน้ำตาลมิตรภูเวียง ประจำปี 2570
                        </h1>
                      </div>

                      <AnimatePresence mode="wait">
                        {!confirmResetOpen ? (
                          <motion.button
                            key="reset-btn"
                            type="button"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.16 }}
                            onClick={() => setConfirmResetOpen(true)}
                            className="btn-lift inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-teal-900/15 bg-white/75 px-3 py-1.5 text-xs font-medium text-teal-900 hover:bg-white cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>ล้างแบบฟอร์ม</span>
                          </motion.button>
                        ) : (
                          <motion.div
                            key="reset-confirm"
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.94 }}
                            transition={{ duration: 0.16 }}
                            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs"
                          >
                            <span className="font-medium text-rose-900">ยืนยันล้างข้อมูลทั้งหมด?</span>
                            <button
                              type="button"
                              onClick={handleResetDraft}
                              className="btn-lift rounded-lg bg-rose-700 px-2.5 py-1 font-semibold text-white hover:bg-rose-800 cursor-pointer"
                            >
                              ยืนยัน
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmResetOpen(false)}
                              className="btn-lift rounded-lg bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {/* Main Single-Page Form Glass Container */}
                <div className="glass-panel rounded-3xl p-4 sm:p-8 print:!transform-none">
                  <AnimatePresence>
                    {stepBannerError && !submittedRecord && (
                      <motion.div
                        role="alert"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="no-print animate-error-shake mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
                      >
                        {stepBannerError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                {submittedRecord ? (
                  <ReviewAndSubmit
                    formData={formData}
                    submittedRecord={submittedRecord}
                    isSubmitting={isSubmitting}
                    submitError={submitError}
                    onJumpToStep={() => {}}
                    onSubmitApplication={() => void handleSubmitApplication()}
                    onStartNewApplication={handleResetDraft}
                    onGoTrackStatus={(appId) => {
                      setTrackInitialCode(appId);
                      setActivePage('track');
                      scrollToTop();
                    }}
                  />
                ) : (
                  <div className="space-y-10">
                    {/* Section 1: ข้อมูลส่วนตัว */}
                    <StepPersonalInfo
                      personalInfo={formData.personalInfo}
                      errors={errors}
                      onChange={(personalInfo) =>
                        setFormData((prev) => ({ ...prev, personalInfo }))
                      }
                    />

                    <div className="border-t border-teal-900/10" />

                    {/* Section 2: บุคคลที่สามารถติดต่อได้ในกรณีฉุกเฉิน */}
                    <StepEmergencyContact
                      emergencyContact={formData.emergencyContact}
                      errors={errors}
                      onChange={(emergencyContact) =>
                        setFormData((prev) => ({ ...prev, emergencyContact }))
                      }
                    />

                    <div className="border-t border-teal-900/10" />

                    {/* Section 3: แนบเอกสารประกอบการสมัครออนไลน์ */}
                    <StepDocuments
                      documents={formData.documents}
                      truthfulnessAccepted={formData.truthfulnessAccepted}
                      pdpaAccepted={formData.pdpaAccepted}
                      errors={errors}
                      onChangeDocuments={(documents) =>
                        setFormData((prev) => ({ ...prev, documents }))
                      }
                      onChangeConsent={(field, value) =>
                        setFormData((prev) => ({ ...prev, [field]: value }))
                      }
                    />

                    {submitError && (
                      <div
                        role="alert"
                        className="animate-error-shake rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
                      >
                        {submitError}
                      </div>
                    )}

                    {/* Single-Page Submit Footer */}
                    <div className="no-print flex flex-col gap-3 border-t border-teal-900/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-teal-900/75">
                        กรุณาตรวจสอบข้อมูลส่วนตัวและเอกสารแนบให้ครบถ้วนก่อนกดยืนยันส่งใบสมัคร
                      </p>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleSubmitApplication()}
                        className="btn-lift inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-7 py-3 text-base font-semibold text-white shadow-md shadow-teal-950/15 hover:bg-teal-900 disabled:opacity-60 cursor-pointer sm:w-auto shrink-0"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span>
                          {isSubmitting ? 'กำลังบันทึกและส่งใบสมัคร...' : 'ยืนยันส่งใบสมัครออนไลน์'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

            {activePage === 'track' && <StatusTrackerView initialCode={trackInitialCode} />}

            {activePage === 'hr' && hrUnlocked && (
              <HrReviewView
                onLogout={() => {
                  writePersistedHrUnlocked(false);
                  try {
                    sessionStorage.removeItem('mpv_hr_selected_id_v1');
                  } catch {
                    // Ignore storage error
                  }
                  setHrUnlocked(false);
                  setActivePage('overview');
                  scrollToTop();
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* HR 4-Digit Phone Keypad PIN Modal */}
      <HrPinModal
        open={hrPinModalOpen}
        onClose={() => setHrPinModalOpen(false)}
        onSuccess={() => {
          writePersistedHrUnlocked(true);
          setHrUnlocked(true);
          setHrPinModalOpen(false);
          setActivePage('hr');
          scrollToTop();
        }}
      />

      {/* Quiet Footer */}
      <footer className="no-print relative z-10 mt-10 border-t border-white/60 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-teal-950/75 sm:flex-row sm:px-6">
          <p>
            โรงงานน้ำตาลมิตรภูเวียง · กลุ่มมิตรผล · อำเภอหนองเรือ จังหวัดขอนแก่น
          </p>
          <p>ระบบเปิดรับสมัครพยาบาลวิชาชีพ ประจำปี 2570</p>
        </div>
      </footer>
      </div>
    </MotionConfig>
  );
}
