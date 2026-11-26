import type { EmergencyContact, ValidationErrors } from '../types/application.ts';

interface StepEmergencyContactProps {
  emergencyContact: EmergencyContact;
  errors: ValidationErrors;
  onChange: (updated: EmergencyContact) => void;
}

export function StepEmergencyContact({
  emergencyContact,
  errors,
  onChange,
}: StepEmergencyContactProps) {
  const updateEmergency = <K extends keyof EmergencyContact>(
    key: K,
    value: EmergencyContact[K]
  ) => {
    onChange({ ...emergencyContact, [key]: value });
  };

  const renderError = (key: string) => {
    if (!errors[key]) return null;
    return (
      <p className="animate-fade-slide-down mt-1.5 text-xs font-medium text-rose-700">
        {errors[key]}
      </p>
    );
  };

  return (
    <section className="space-y-5">
      <div className="border-b border-teal-900/10 pb-4">
        <h2 className="font-display text-xl font-semibold text-teal-950 sm:text-2xl">
          2. บุคคลที่สามารถติดต่อได้ในกรณีฉุกเฉิน (Contact person in case of emergency)
        </h2>
        <p className="mt-1 text-sm text-teal-900/75">
          ระบุข้อมูลบุคคลใกล้ชิดที่โรงงานสามารถติดต่อได้ทันทีในกรณีเกิดเหตุฉุกเฉิน
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
            เบอร์ติดต่อ (Telephone)
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
  );
}
