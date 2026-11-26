import type {
  EmergencyContact,
  NursingQualification,
  ValidationErrors,
} from '../types/application.ts';

interface StepNursingAndEmergencyProps {
  nursingQualification: NursingQualification;
  emergencyContact: EmergencyContact;
  errors: ValidationErrors;
  onChangeNursing: (updated: NursingQualification) => void;
  onChangeEmergency: (updated: EmergencyContact) => void;
}

export function StepNursingAndEmergency({
  nursingQualification,
  emergencyContact,
  errors,
  onChangeNursing,
  onChangeEmergency,
}: StepNursingAndEmergencyProps) {
  const updateNursing = <K extends keyof NursingQualification>(
    key: K,
    value: NursingQualification[K]
  ) => {
    onChangeNursing({ ...nursingQualification, [key]: value });
  };

  const updateEmergency = <K extends keyof EmergencyContact>(
    key: K,
    value: EmergencyContact[K]
  ) => {
    onChangeEmergency({ ...emergencyContact, [key]: value });
  };

  const renderError = (key: string) => {
    if (!errors[key]) return null;
    return <p className="mt-1.5 text-xs font-medium text-rose-700">{errors[key]}</p>;
  };

  return (
    <div className="space-y-10">
      {/* Nursing License & Occupational Health Readiness */}
      <section className="space-y-5">
        <div className="border-b border-teal-900/10 pb-4">
          <h2 className="font-display text-xl font-semibold text-teal-950 sm:text-2xl">
            4. ข้อมูลใบประกอบวิชาชีพพยาบาลและความพร้อมปฏิบัติงาน
          </h2>
          <p className="mt-1 text-sm text-teal-900/75">
            ข้อมูลใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ และประสบการณ์ด้านอาชีวอนามัยในโรงงาน
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label htmlFor="licenseNumber" className="block text-sm font-semibold text-teal-950">
              เลขที่ใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ (ชั้นหนึ่ง){' '}
              <span className="text-rose-600">*</span>
            </label>
            <input
              id="licenseNumber"
              type="text"
              value={nursingQualification.licenseNumber}
              onChange={(e) => updateNursing('licenseNumber', e.target.value)}
              placeholder="เช่น 6511123456"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/40"
            />
            {renderError('nursingQualification.licenseNumber')}
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="licenseIssueDate" className="block text-sm font-semibold text-teal-950">
              วันออกใบอนุญาต
            </label>
            <input
              id="licenseIssueDate"
              type="date"
              value={nursingQualification.licenseIssueDate}
              onChange={(e) => updateNursing('licenseIssueDate', e.target.value)}
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 tabular-nums"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="licenseExpiryDate" className="block text-sm font-semibold text-teal-950">
              วันหมดอายุใบอนุญาต <span className="text-rose-600">*</span>
            </label>
            <input
              id="licenseExpiryDate"
              type="date"
              value={nursingQualification.licenseExpiryDate}
              onChange={(e) => updateNursing('licenseExpiryDate', e.target.value)}
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 tabular-nums"
            />
            {renderError('nursingQualification.licenseExpiryDate')}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-teal-900/15 bg-white/75 px-4 py-3 text-sm font-medium text-teal-950 hover:bg-white">
            <input
              type="checkbox"
              checked={nursingQualification.occupationalHealthTrained}
              onChange={(e) => updateNursing('occupationalHealthTrained', e.target.checked)}
              className="h-4 w-4 rounded accent-teal-800"
            />
            <span>ผ่านการอบรมพยาบาลอาชีวอนามัย (60 ชม.)</span>
          </label>

          <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-teal-900/15 bg-white/75 px-4 py-3 text-sm font-medium text-teal-950 hover:bg-white">
            <input
              type="checkbox"
              checked={nursingQualification.blsAclsCertified}
              onChange={(e) => updateNursing('blsAclsCertified', e.target.checked)}
              className="h-4 w-4 rounded accent-teal-800"
            />
            <span>มีใบรับรอง BLS / ACLS</span>
          </label>

          <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-teal-900/15 bg-white/75 px-4 py-3 text-sm font-medium text-teal-950 hover:bg-white">
            <input
              type="checkbox"
              checked={nursingQualification.shiftWorkReady}
              onChange={(e) => updateNursing('shiftWorkReady', e.target.checked)}
              className="h-4 w-4 rounded accent-teal-800"
            />
            <span>สามารถปฏิบัติงานเป็นกะได้</span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {nursingQualification.occupationalHealthTrained && (
            <div className="sm:col-span-4">
              <label
                htmlFor="occupationalHealthHours"
                className="block text-sm font-semibold text-teal-950"
              >
                สถาบันที่จัดอบรมอาชีวอนามัย / ปีที่อบรม
              </label>
              <input
                id="occupationalHealthHours"
                type="text"
                value={nursingQualification.occupationalHealthHours}
                onChange={(e) => updateNursing('occupationalHealthHours', e.target.value)}
                placeholder="เช่น สภาการพยาบาล ปี 2568"
                className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950"
              />
            </div>
          )}

          <div className={nursingQualification.occupationalHealthTrained ? 'sm:col-span-4' : 'sm:col-span-6'}>
            <label htmlFor="availableStartDate" className="block text-sm font-semibold text-teal-950">
              วันที่สะดวกเริ่มปฏิบัติงาน <span className="text-rose-600">*</span>
            </label>
            <input
              id="availableStartDate"
              type="date"
              value={nursingQualification.availableStartDate}
              onChange={(e) => updateNursing('availableStartDate', e.target.value)}
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 tabular-nums"
            />
            {renderError('nursingQualification.availableStartDate')}
          </div>

          <div className={nursingQualification.occupationalHealthTrained ? 'sm:col-span-4' : 'sm:col-span-6'}>
            <label htmlFor="expectedSalary" className="block text-sm font-semibold text-teal-950">
              เงินเดือนที่คาดหวัง (บาท/เดือน)
            </label>
            <input
              id="expectedSalary"
              type="text"
              value={nursingQualification.expectedSalary}
              onChange={(e) => updateNursing('expectedSalary', e.target.value)}
              placeholder="เช่น 28,000 หรือ ตามโครงสร้างบริษัท"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 tabular-nums placeholder:text-teal-900/40"
            />
          </div>
        </div>

        <div>
          <label htmlFor="clinicalSkillsNote" className="block text-sm font-semibold text-teal-950">
            ทักษะทางการพยาบาล ความสามารถพิเศษ และประสบการณ์เพิ่มเติม
          </label>
          <textarea
            id="clinicalSkillsNote"
            rows={3}
            value={nursingQualification.clinicalSkillsNote}
            onChange={(e) => updateNursing('clinicalSkillsNote', e.target.value)}
            placeholder="เช่น การตรวจสมรรถภาพการได้ยิน/สายตาอาชีวอนามัย, การใช้คอมพิวเตอร์โปรแกรมเวชระเบียน, การประสานงานส่งต่อผู้ป่วยฉุกเฉิน"
            className="glass-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
        </div>
      </section>

      {/* Section 8 (from official form): Emergency Contact */}
      <section className="space-y-5 border-t border-teal-900/12 pt-8">
        <div>
          <h2 className="font-display text-xl font-semibold text-teal-950 sm:text-2xl">
            5. บุคคลที่สามารถติดต่อได้ในกรณีฉุกเฉิน (Contact person in case of emergency)
          </h2>
          <p className="mt-1 text-sm text-teal-900/75">
            ระบุข้อมูลบุคคลใกล้ชิดที่โรงงานสามารถติดต่อได้ทันทีในกรณีเกิดเหตุฉุกเฉิน (อ้างอิงหัวข้อ 8 ตามแบบฟอร์มรับสมัคร)
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-7">
            <label htmlFor="emergencyFullName" className="block text-sm font-semibold text-teal-950">
              ชื่อ-นามสกุล (Name-Lastname) <span className="text-rose-600">*</span>
            </label>
            <input
              id="emergencyFullName"
              type="text"
              value={emergencyContact.fullName}
              onChange={(e) => updateEmergency('fullName', e.target.value)}
              placeholder="เช่น นายสมชาย ใจดี"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
            />
            {renderError('emergencyContact.fullName')}
          </div>

          <div className="sm:col-span-5">
            <label
              htmlFor="emergencyRelationship"
              className="block text-sm font-semibold text-teal-950"
            >
              ความสัมพันธ์ (Relationship) <span className="text-rose-600">*</span>
            </label>
            <input
              id="emergencyRelationship"
              type="text"
              value={emergencyContact.relationship}
              onChange={(e) => updateEmergency('relationship', e.target.value)}
              placeholder="เช่น มารดา / คู่สมรส / พี่สาว"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
            />
            {renderError('emergencyContact.relationship')}
          </div>
        </div>

        <div>
          <label htmlFor="emergencyAddress" className="block text-sm font-semibold text-teal-950">
            ที่อยู่ (Address) <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="emergencyAddress"
            rows={2}
            value={emergencyContact.address}
            onChange={(e) => updateEmergency('address', e.target.value)}
            placeholder="ระบุที่อยู่สำหรับติดต่อบุคคลในกรณีฉุกเฉิน"
            className="glass-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
          {renderError('emergencyContact.address')}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="emergencyMobilePhone"
              className="block text-sm font-semibold text-teal-950"
            >
              เบอร์โทรศัพท์มือถือ (Mobile Phone) <span className="text-rose-600">*</span>
            </label>
            <input
              id="emergencyMobilePhone"
              type="tel"
              value={emergencyContact.mobilePhone}
              onChange={(e) => updateEmergency('mobilePhone', e.target.value)}
              placeholder="0898765432"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/40"
            />
            {renderError('emergencyContact.mobilePhone')}
          </div>

          <div>
            <label
              htmlFor="emergencyLandLine"
              className="block text-sm font-semibold text-teal-950"
            >
              เบอร์ติดต่อ (Land Line)
            </label>
            <input
              id="emergencyLandLine"
              type="tel"
              value={emergencyContact.landLine}
              onChange={(e) => updateEmergency('landLine', e.target.value)}
              placeholder="เบอร์โทรศัพท์บ้านหรือที่ทำงาน (ถ้ามี)"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/40"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
