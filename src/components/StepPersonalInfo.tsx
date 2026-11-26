import type { PersonalInformation, TitlePrefix, ValidationErrors } from '../types/application.ts';
import { calculateAgeFromDob } from '../utils/applicationHelpers.ts';

interface StepPersonalInfoProps {
  personalInfo: PersonalInformation;
  errors: ValidationErrors;
  onChange: (updated: PersonalInformation) => void;
}

const TITLE_OPTIONS: TitlePrefix[] = ['นาย (Mr.)', 'นาง (Mrs.)', 'นางสาว (Ms.)'];

export function StepPersonalInfo({
  personalInfo,
  errors,
  onChange,
}: StepPersonalInfoProps) {
  const updateField = <K extends keyof PersonalInformation>(
    key: K,
    value: PersonalInformation[K]
  ) => {
    const next: PersonalInformation = {
      ...personalInfo,
      [key]: value,
    };

    if (key === 'dateOfBirth' && typeof value === 'string') {
      const computedAge = calculateAgeFromDob(value);
      if (computedAge) {
        next.age = computedAge;
      }
    }

    if (next.sameAsPermanent) {
      if (key === 'permanentAddress') {
        next.presentAddress = value as string;
      }
      if (key === 'permanentLandLine') {
        next.presentLandLine = value as string;
      }
    }

    onChange(next);
  };

  const handleToggleSameAddress = (checked: boolean) => {
    onChange({
      ...personalInfo,
      sameAsPermanent: checked,
      presentAddress: checked ? personalInfo.permanentAddress : personalInfo.presentAddress,
      presentLandLine: checked ? personalInfo.permanentLandLine : personalInfo.presentLandLine,
    });
  };

  const renderError = (key: string) => {
    if (!errors[key]) return null;
    return <p className="mt-1.5 text-xs font-medium text-rose-700">{errors[key]}</p>;
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-teal-900/10 pb-4">
        <h2 className="font-display text-xl font-semibold text-teal-950 sm:text-2xl">
          1. ข้อมูลส่วนตัว (Personal Information)
        </h2>
        <p className="mt-1 text-sm text-teal-900/75">
          กรุณากรอกข้อมูลส่วนตัวให้ตรงตามบัตรประจำตัวประชาชนและเอกสารราชการ ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก
        </p>
      </div>

      {/* คำนำหน้า (Title) */}
      <div>
        <label className="block text-sm font-semibold text-teal-950">
          คำนำหน้า (Title) <span className="text-rose-600">*</span>
        </label>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {TITLE_OPTIONS.map((option) => {
            const selected = personalInfo.title === option;
            return (
              <label
                key={option}
                className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                  selected
                    ? 'border-teal-700 bg-teal-800/10 text-teal-950 shadow-sm'
                    : 'border-teal-900/15 bg-white/75 text-teal-900 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="titlePrefix"
                  value={option}
                  checked={selected}
                  onChange={() => updateField('title', option)}
                  className="h-4 w-4 accent-teal-800"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
        {renderError('personalInfo.title')}
      </div>

      {/* Thai Name & Nickname */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <div className="sm:col-span-8">
          <label htmlFor="fullNameTh" className="block text-sm font-semibold text-teal-950">
            ชื่อ - นามสกุลภาษาไทย <span className="text-rose-600">*</span>
          </label>
          <input
            id="fullNameTh"
            type="text"
            value={personalInfo.fullNameTh}
            onChange={(e) => updateField('fullNameTh', e.target.value)}
            placeholder="เช่น สุภาพร ใจดี"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
          {renderError('personalInfo.fullNameTh')}
        </div>

        <div className="sm:col-span-4">
          <label htmlFor="nicknameTh" className="block text-sm font-semibold text-teal-950">
            ชื่อเล่น
          </label>
          <input
            id="nicknameTh"
            type="text"
            value={personalInfo.nicknameTh}
            onChange={(e) => updateField('nicknameTh', e.target.value)}
            placeholder="เช่น น้ำ"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
        </div>
      </div>

      {/* English Name */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <div className="sm:col-span-12">
          <label htmlFor="fullNameEn" className="block text-sm font-semibold text-teal-950">
            ชื่อ - นามสกุลภาษาอังกฤษ (Name-Surname) <span className="text-rose-600">*</span>
          </label>
          <input
            id="fullNameEn"
            type="text"
            value={personalInfo.fullNameEn}
            onChange={(e) => updateField('fullNameEn', e.target.value)}
            placeholder="e.g., Supaporn Jaidee"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
          {renderError('personalInfo.fullNameEn')}
        </div>
      </div>

      {/* DOB, Age, Place of Birth, Nationality */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <div className="sm:col-span-4">
          <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-teal-950">
            วัน/เดือน/ปีเกิด (Date of Birth) <span className="text-rose-600">*</span>
          </label>
          <input
            id="dateOfBirth"
            type="date"
            value={personalInfo.dateOfBirth}
            onChange={(e) => updateField('dateOfBirth', e.target.value)}
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 tabular-nums"
          />
          {renderError('personalInfo.dateOfBirth')}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="age" className="block text-sm font-semibold text-teal-950">
            อายุ (Age) <span className="text-rose-600">*</span>
          </label>
          <input
            id="age"
            type="number"
            min={18}
            max={75}
            value={personalInfo.age}
            onChange={(e) => updateField('age', e.target.value)}
            placeholder="ปี"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 tabular-nums"
          />
          {renderError('personalInfo.age')}
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="placeOfBirth" className="block text-sm font-semibold text-teal-950">
            ภูมิลำเนา (Place of Birth) <span className="text-rose-600">*</span>
          </label>
          <input
            id="placeOfBirth"
            type="text"
            value={personalInfo.placeOfBirth}
            onChange={(e) => updateField('placeOfBirth', e.target.value)}
            placeholder="เช่น ขอนแก่น"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
          {renderError('personalInfo.placeOfBirth')}
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="nationality" className="block text-sm font-semibold text-teal-950">
            สัญชาติ (Nationality) <span className="text-rose-600">*</span>
          </label>
          <input
            id="nationality"
            type="text"
            value={personalInfo.nationality}
            onChange={(e) => updateField('nationality', e.target.value)}
            placeholder="เช่น ไทย"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
          {renderError('personalInfo.nationality')}
        </div>
      </div>

      {/* Mobile, Email, ID Card, Line ID */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mobileNumber" className="block text-sm font-semibold text-teal-950">
            เบอร์มือถือ (Mobile Number) <span className="text-rose-600">*</span>
          </label>
          <input
            id="mobileNumber"
            type="tel"
            value={personalInfo.mobileNumber}
            onChange={(e) => updateField('mobileNumber', e.target.value)}
            placeholder="0812345678"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/40"
          />
          {renderError('personalInfo.mobileNumber')}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-teal-950">
            อีเมล์ (E-Mail) <span className="text-rose-600">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={personalInfo.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="name@example.com"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
          {renderError('personalInfo.email')}
        </div>

        <div>
          <label htmlFor="idCardOrPassport" className="block text-sm font-semibold text-teal-950">
            เลขที่บัตรประชาชน (ID Card No. / Passport) <span className="text-rose-600">*</span>
          </label>
          <input
            id="idCardOrPassport"
            type="text"
            value={personalInfo.idCardOrPassport}
            onChange={(e) => updateField('idCardOrPassport', e.target.value)}
            placeholder="เลขประจำตัวประชาชน 13 หลัก หรือ Passport"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/40"
          />
          {renderError('personalInfo.idCardOrPassport')}
        </div>

        <div>
          <label htmlFor="lineId" className="block text-sm font-semibold text-teal-950">
            Line ID
          </label>
          <input
            id="lineId"
            type="text"
            value={personalInfo.lineId}
            onChange={(e) => updateField('lineId', e.target.value)}
            placeholder="ระบุ Line ID สำหรับติดต่อเพิ่มเติม"
            className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
          />
        </div>
      </div>

      {/* Permanent Address */}
      <div className="space-y-4 border-t border-teal-900/10 pt-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-8">
            <label htmlFor="permanentAddress" className="block text-sm font-semibold text-teal-950">
              ที่อยู่ตามทะเบียนบ้าน (Permanent Address) <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="permanentAddress"
              rows={2}
              value={personalInfo.permanentAddress}
              onChange={(e) => updateField('permanentAddress', e.target.value)}
              placeholder="บ้านเลขที่ หมู่ ซอย ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์"
              className="glass-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40"
            />
            {renderError('personalInfo.permanentAddress')}
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="permanentLandLine" className="block text-sm font-semibold text-teal-950">
              โทรศัพท์ (Telephone)
            </label>
            <input
              id="permanentLandLine"
              type="tel"
              value={personalInfo.permanentLandLine}
              onChange={(e) => updateField('permanentLandLine', e.target.value)}
              placeholder="เบอร์โทรศัพท์บ้าน (ถ้ามี)"
              className="glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/40"
            />
          </div>
        </div>

        {/* Present Address + Same as permanent checkbox */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="presentAddress" className="block text-sm font-semibold text-teal-950">
              ที่อยู่ปัจจุบัน (Present Address) <span className="text-rose-600">*</span>
            </label>

            <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-teal-900 hover:bg-teal-900/5">
              <input
                type="checkbox"
                checked={personalInfo.sameAsPermanent}
                onChange={(e) => handleToggleSameAddress(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-800"
              />
              <span>เหมือนที่อยู่ตามทะเบียนบ้าน (Same as permanent address)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
            <div className="sm:col-span-8">
              <textarea
                id="presentAddress"
                rows={2}
                value={personalInfo.presentAddress}
                disabled={personalInfo.sameAsPermanent}
                onChange={(e) => updateField('presentAddress', e.target.value)}
                placeholder="บ้านเลขที่ หมู่ ซอย ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์"
                className={`glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-teal-950 placeholder:text-teal-900/40 ${
                  personalInfo.sameAsPermanent ? 'opacity-70 bg-teal-50/70' : ''
                }`}
              />
              {renderError('personalInfo.presentAddress')}
            </div>

            <div className="sm:col-span-4">
              <label htmlFor="presentLandLine" className="block text-sm font-semibold text-teal-950">
                โทรศัพท์ (Telephone)
              </label>
              <input
                id="presentLandLine"
                type="tel"
                value={personalInfo.presentLandLine}
                disabled={personalInfo.sameAsPermanent}
                onChange={(e) => updateField('presentLandLine', e.target.value)}
                placeholder="เบอร์โทรศัพท์บ้าน (ถ้ามี)"
                className={`glass-input mt-1.5 w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/40 ${
                  personalInfo.sameAsPermanent ? 'opacity-70 bg-teal-50/70' : ''
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
