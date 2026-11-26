import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { HeroOverview } from './components/HeroOverview.tsx';
import { HrPinModal } from './components/HrPinModal.tsx';
import { HrReviewView } from './components/HrReviewView.tsx';
import { ReviewAndSubmit } from './components/ReviewAndSubmit.tsx';
import { StatusTrackerView } from './components/StatusTrackerView.tsx';
import { StepDocuments } from './components/StepDocuments.tsx';
import { StepNursingAndEmergency } from './components/StepNursingAndEmergency.tsx';
import { StepPersonalInfo } from './components/StepPersonalInfo.tsx';
import { StepWorkAndEducation } from './components/StepWorkAndEducation.tsx';
import { TopBar, type ActivePage } from './components/TopBar.tsx';
import type {
  ApplicationFormData,
  SubmittedApplicationRecord,
  ValidationErrors,
} from './types/application.ts';
import { submitApplicationApi } from './utils/apiClient.ts';
import {
  createInitialApplicationData,
  DRAFT_STORAGE_KEY,
  validateAllSteps,
  validateStep1Personal,
  validateStep2WorkEducation,
  validateStep3NursingEmergency,
  validateStep4Documents,
} from './utils/applicationHelpers.ts';

const FORM_STEPS = [
  { index: 0, code: '01', label: 'ข้อมูลส่วนตัว' },
  { index: 1, code: '02', label: 'ประวัติงานและการศึกษา' },
  { index: 2, code: '03', label: 'ใบประกอบฯ และฉุกเฉิน' },
  { index: 3, code: '04', label: 'แนบเอกสารออนไลน์' },
  { index: 4, code: '05', label: 'ตรวจทานและส่งใบสมัคร' },
];

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('overview');
  const [currentStep, setCurrentStep] = useState<number>(0);
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
  const [hrUnlocked, setHrUnlocked] = useState(false);
  const [hrPinModalOpen, setHrPinModalOpen] = useState(false);

  useEffect(() => {
    if (submittedRecord) return;
    try {
      const liteDraft: ApplicationFormData = {
        ...formData,
        // Keep small thumbnails (<150KB) in draft, skip oversized base64 blobs to prevent quota errors
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
  }, [formData, submittedRecord]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartApply = () => {
    setActivePage('apply');
    scrollToTop();
  };

  const validateForStep = (stepIndex: number): ValidationErrors => {
    if (stepIndex === 0) return validateStep1Personal(formData);
    if (stepIndex === 1) return validateStep2WorkEducation(formData);
    if (stepIndex === 2) return validateStep3NursingEmergency(formData);
    if (stepIndex === 3) return validateStep4Documents(formData);
    return validateAllSteps(formData);
  };

  const handleNextStep = () => {
    const stepErrors = validateForStep(currentStep);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setStepBannerError('กรุณากรอกข้อมูลและแนบเอกสารในช่องที่จำเป็นให้ครบถ้วนก่อนดำเนินการต่อ');
      scrollToTop();
      return;
    }

    setErrors({});
    setStepBannerError(null);
    setCurrentStep((prev) => Math.min(prev + 1, FORM_STEPS.length - 1));
    scrollToTop();
  };

  const handlePrevStep = () => {
    setErrors({});
    setStepBannerError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    scrollToTop();
  };

  const handleTabJump = (targetStep: number) => {
    if (submittedRecord) return;
    setErrors({});
    setStepBannerError(null);
    setCurrentStep(targetStep);
    scrollToTop();
  };

  const handleResetDraft = () => {
    const fresh = createInitialApplicationData();
    setFormData(fresh);
    setErrors({});
    setStepBannerError(null);
    setSubmitError(null);
    setSubmittedRecord(null);
    setCurrentStep(0);
    setConfirmResetOpen(false);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setHasSavedDraft(false);
    } catch {
      // Ignore storage error
    }
  };

  const handleSubmitApplication = async () => {
    setSubmitError(null);
    const allErrors = validateAllSteps(formData);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const firstErrorKey = Object.keys(allErrors)[0];
      let targetStep = 0;
      if (firstErrorKey.startsWith('work') || firstErrorKey.startsWith('education')) {
        targetStep = 1;
      } else if (
        firstErrorKey.startsWith('nursing') ||
        firstErrorKey.startsWith('emergency')
      ) {
        targetStep = 2;
      } else if (
        firstErrorKey.startsWith('doc.') ||
        firstErrorKey === 'truthfulnessAccepted' ||
        firstErrorKey === 'pdpaAccepted'
      ) {
        targetStep = 3;
      }
      setCurrentStep(targetStep);
      setStepBannerError(
        `พบข้อมูลที่ยังกรอกไม่ครบถ้วน (${Object.keys(allErrors).length} รายการ) ระบบพาท่านกลับมาที่ส่วนที่ต้องแก้ไข`
      );
      scrollToTop();
      return;
    }

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
      scrollToTop();
    } catch (err) {
      let friendly = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อส่งใบสมัครได้';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          if (parsed?.error) {
            friendly = 'ไม่สามารถบันทึกใบสมัครไปยังฐานข้อมูล Firebase ได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง';
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
        <div key={activePage} className="animate-page-enter">
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
                <div className="no-print glass-panel mb-5 rounded-3xl p-4 sm:mb-6 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs font-medium text-teal-800">
                        โรงงานน้ำตาลมิตรภูเวียง <span aria-hidden="true">·</span> ประจำปี 2570
                      </p>
                      <h1 className="font-display mt-1 text-base font-bold text-teal-950 sm:text-2xl">
                        ฟอร์มรับสมัครพยาบาลวิชาชีพ โรงงานน้ำตาลมิตรภูเวียง ประจำปี 2570
                      </h1>
                    </div>

                    {!confirmResetOpen ? (
                      <button
                        type="button"
                        onClick={() => setConfirmResetOpen(true)}
                        className="btn-lift inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-teal-900/15 bg-white/75 px-3 py-1.5 text-xs font-medium text-teal-900 hover:bg-white cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>ล้างแบบฟอร์ม</span>
                      </button>
                    ) : (
                      <div className="animate-fade-scale flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs">
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
                      </div>
                    )}
                  </div>

                  {/* Interactive Step Tabs */}
                  <div
                    role="tablist"
                    aria-label="ขั้นตอนการกรอกใบสมัคร"
                    className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:mt-5 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0"
                  >
                    {FORM_STEPS.map((step) => {
                      const isActive = currentStep === step.index;
                      const isCompleted = step.index < currentStep;
                      return (
                        <button
                          key={step.index}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => handleTabJump(step.index)}
                          className={`btn-lift flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-left text-xs font-medium whitespace-nowrap cursor-pointer sm:shrink sm:px-3 ${
                            isActive
                              ? 'bg-teal-800 text-white shadow-sm'
                              : isCompleted
                              ? 'border border-teal-700/25 bg-teal-50/85 text-teal-950 hover:bg-white'
                              : 'border border-teal-900/10 bg-white/70 text-teal-950 hover:bg-white'
                          }`}
                        >
                          <span
                            className={`font-mono tabular-nums text-[11px] font-semibold ${
                              isActive ? 'text-teal-100' : 'text-teal-700'
                            }`}
                          >
                            {step.code}
                          </span>
                          <span className="sm:truncate">{step.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Smooth Progress Bar */}
                  <div
                    aria-hidden="true"
                    className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-teal-900/10"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 transition-all duration-300 ease-out"
                      style={{ width: `${((currentStep + 1) / FORM_STEPS.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Main Form Glass Container */}
              <div className="glass-panel rounded-3xl p-4 sm:p-8">
                {stepBannerError && !submittedRecord && (
                  <div
                    role="alert"
                    className="no-print animate-error-shake mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
                  >
                    {stepBannerError}
                  </div>
                )}

                <div key={currentStep} className="animate-step-enter">

              {currentStep === 0 && (
                <StepPersonalInfo
                  personalInfo={formData.personalInfo}
                  errors={errors}
                  onChange={(personalInfo) =>
                    setFormData((prev) => ({ ...prev, personalInfo }))
                  }
                />
              )}

              {currentStep === 1 && (
                <StepWorkAndEducation
                  hasNoWorkExperience={formData.hasNoWorkExperience}
                  workExperiences={formData.workExperiences}
                  educationBackground={formData.educationBackground}
                  errors={errors}
                  onChangeWorkToggle={(hasNoWorkExperience) =>
                    setFormData((prev) => ({ ...prev, hasNoWorkExperience }))
                  }
                  onChangeWorkRows={(workExperiences) =>
                    setFormData((prev) => ({ ...prev, workExperiences }))
                  }
                  onChangeEducationRows={(educationBackground) =>
                    setFormData((prev) => ({ ...prev, educationBackground }))
                  }
                />
              )}

              {currentStep === 2 && (
                <StepNursingAndEmergency
                  nursingQualification={formData.nursingQualification}
                  emergencyContact={formData.emergencyContact}
                  errors={errors}
                  onChangeNursing={(nursingQualification) =>
                    setFormData((prev) => ({ ...prev, nursingQualification }))
                  }
                  onChangeEmergency={(emergencyContact) =>
                    setFormData((prev) => ({ ...prev, emergencyContact }))
                  }
                />
              )}

              {currentStep === 3 && (
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
              )}

              {currentStep === 4 && (
                <ReviewAndSubmit
                  formData={formData}
                  submittedRecord={submittedRecord}
                  isSubmitting={isSubmitting}
                  submitError={submitError}
                  onJumpToStep={handleTabJump}
                  onSubmitApplication={() => void handleSubmitApplication()}
                  onStartNewApplication={handleResetDraft}
                  onGoTrackStatus={(appId) => {
                    setTrackInitialCode(appId);
                    setActivePage('track');
                    scrollToTop();
                  }}
                />
              )}

                </div>

                {/* Stepper Footer Navigation */}
                {!submittedRecord && currentStep < 4 && (
                  <div className="no-print mt-8 border-t border-teal-900/10 pt-5">
                    <div className="mb-3 text-center text-xs text-teal-900/70 tabular-nums sm:hidden">
                      ขั้นตอนที่ {currentStep + 1} จาก {FORM_STEPS.length}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        disabled={currentStep === 0}
                        className="btn-lift group inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-teal-900/15 bg-white/80 px-4 py-2.5 text-sm font-medium text-teal-950 hover:bg-white disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
                        <span>ย้อนกลับ</span>
                      </button>

                      <div className="hidden text-xs text-teal-900/70 tabular-nums sm:block">
                        ขั้นตอนที่ {currentStep + 1} จาก {FORM_STEPS.length}
                      </div>

                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="btn-lift group inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-900 cursor-pointer"
                      >
                        <span>บันทึกและถัดไป</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
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
                setHrUnlocked(false);
                setActivePage('overview');
                scrollToTop();
              }}
            />
          )}
        </div>
      </main>

      {/* HR 4-Digit Phone Keypad PIN Modal */}
      <HrPinModal
        open={hrPinModalOpen}
        onClose={() => setHrPinModalOpen(false)}
        onSuccess={() => {
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
  );
}
