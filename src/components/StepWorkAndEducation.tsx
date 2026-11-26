import { Plus, Trash2 } from 'lucide-react';
import type {
  EducationItem,
  ValidationErrors,
  WorkExperienceItem,
} from '../types/application.ts';
import { createEmptyWorkRow } from '../utils/applicationHelpers.ts';

interface StepWorkAndEducationProps {
  hasNoWorkExperience: boolean;
  workExperiences: WorkExperienceItem[];
  educationBackground: EducationItem[];
  errors: ValidationErrors;
  onChangeWorkToggle: (noExperience: boolean) => void;
  onChangeWorkRows: (rows: WorkExperienceItem[]) => void;
  onChangeEducationRows: (rows: EducationItem[]) => void;
}

export function StepWorkAndEducation({
  hasNoWorkExperience,
  workExperiences,
  educationBackground,
  errors,
  onChangeWorkToggle,
  onChangeWorkRows,
  onChangeEducationRows,
}: StepWorkAndEducationProps) {
  const updateWorkField = <K extends keyof WorkExperienceItem>(
    id: string,
    key: K,
    value: WorkExperienceItem[K]
  ) => {
    onChangeWorkRows(
      workExperiences.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const handleAddWorkRow = () => {
    onChangeWorkRows([...workExperiences, createEmptyWorkRow()]);
  };

  const handleRemoveWorkRow = (id: string) => {
    if (workExperiences.length <= 1) return;
    onChangeWorkRows(workExperiences.filter((row) => row.id !== id));
  };

  const updateEduField = (
    levelKey: EducationItem['levelKey'],
    key: keyof EducationItem,
    value: string
  ) => {
    onChangeEducationRows(
      educationBackground.map((row) =>
        row.levelKey === levelKey ? { ...row, [key]: value } : row
      )
    );
  };

  return (
    <div className="space-y-10">
      {/* Section 2: Work Experience */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-teal-900/10 pb-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-teal-950 sm:text-2xl">
              2. ประวัติการทำงานที่ผ่านมา (Work Experience)
            </h2>
            <p className="mt-1 text-sm text-teal-900/75">
              เรียงลำดับจากประสบการณ์ทำงานปัจจุบัน (Starting with the current or most recent employment first)
            </p>
          </div>

          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-teal-900/15 bg-white/75 px-3.5 py-2 text-sm font-medium text-teal-950 hover:bg-white">
            <input
              type="checkbox"
              checked={hasNoWorkExperience}
              onChange={(e) => onChangeWorkToggle(e.target.checked)}
              className="h-4 w-4 rounded accent-teal-800"
            />
            <span>ไม่มีประสบการณ์ทำงาน</span>
          </label>
        </div>

        {errors['workExperiences'] && (
          <p className="rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-2.5 text-sm font-medium text-rose-800">
            {errors['workExperiences']}
          </p>
        )}

        {!hasNoWorkExperience && (
          <div className="space-y-4">
            {workExperiences.map((row, index) => (
              <div
                key={row.id}
                className="rounded-2xl border border-teal-900/12 bg-white/65 p-4 sm:p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-teal-900/10 pb-2.5">
                  <span className="font-display text-sm font-semibold text-teal-950">
                    ประสบการณ์ทำงานลำดับที่ {index + 1}
                    {index === 0 ? ' (ล่าสุด / ปัจจุบัน)' : ''}
                  </span>
                  {workExperiences.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveWorkRow(row.id)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>ลบรายการ</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  {/* Working Period */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-teal-950">
                      ระยะเวลาทำงาน: จาก เดือน/ปี
                    </label>
                    <input
                      type="text"
                      value={row.fromMonthYear}
                      onChange={(e) => updateWorkField(row.id, 'fromMonthYear', e.target.value)}
                      placeholder="เช่น 05/2566"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/40"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-teal-950">
                      ถึง เดือน/ปี (To Month/Year)
                    </label>
                    <input
                      type="text"
                      value={row.toMonthYear}
                      onChange={(e) => updateWorkField(row.id, 'toMonthYear', e.target.value)}
                      placeholder="เช่น ปัจจุบัน หรือ 10/2569"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950 placeholder:text-teal-900/40"
                    />
                  </div>

                  {/* Company */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-teal-950">
                      บริษัท / สถานพยาบาล (Company)
                    </label>
                    <input
                      type="text"
                      value={row.company}
                      onChange={(e) => updateWorkField(row.id, 'company', e.target.value)}
                      placeholder="ชื่อโรงพยาบาล / บริษัท"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950 placeholder:text-teal-900/40"
                    />
                  </div>

                  {/* Position */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-teal-950">
                      ตำแหน่ง (Position)
                    </label>
                    <input
                      type="text"
                      value={row.position}
                      onChange={(e) => updateWorkField(row.id, 'position', e.target.value)}
                      placeholder="เช่น พยาบาลวิชาชีพ (ER/OPD)"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950 placeholder:text-teal-900/40"
                    />
                  </div>

                  {/* Scope of responsibility */}
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-semibold text-teal-950">
                      ลักษณะงานที่รับผิดชอบ (Scope of responsibility)
                    </label>
                    <input
                      type="text"
                      value={row.scopeOfResponsibility}
                      onChange={(e) =>
                        updateWorkField(row.id, 'scopeOfResponsibility', e.target.value)
                      }
                      placeholder="เช่น คัดกรองผู้ป่วย ปฐมพยาบาล ดูแลเวชระเบียน และอาชีวอนามัย"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950 placeholder:text-teal-900/40"
                    />
                  </div>

                  {/* Salary & Other Income */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-teal-950">
                      เงินเดือน (Salary)
                    </label>
                    <input
                      type="text"
                      value={row.salary}
                      onChange={(e) => updateWorkField(row.id, 'salary', e.target.value)}
                      placeholder="เช่น 25,000 บาท"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950 tabular-nums placeholder:text-teal-900/40"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-teal-950">
                      รายได้อื่น ๆ (Other Income)
                    </label>
                    <input
                      type="text"
                      value={row.otherIncome}
                      onChange={(e) => updateWorkField(row.id, 'otherIncome', e.target.value)}
                      placeholder="เช่น ค่าเวร / ค่าใบประกอบฯ"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950 tabular-nums placeholder:text-teal-900/40"
                    />
                  </div>

                  {/* Reason for leaving */}
                  <div className="sm:col-span-12">
                    <label className="block text-xs font-semibold text-teal-950">
                      สาเหตุที่ออก (Reason for leaving)
                    </label>
                    <input
                      type="text"
                      value={row.reasonForLeaving}
                      onChange={(e) => updateWorkField(row.id, 'reasonForLeaving', e.target.value)}
                      placeholder="ระบุสาเหตุ หรือระบุ 'ยังปฏิบัติงานอยู่' หากเป็นงานปัจจุบัน"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950 placeholder:text-teal-900/40"
                    />
                  </div>
                </div>

                {errors[`work.${row.id}`] && (
                  <p className="mt-2.5 text-xs font-medium text-rose-700">
                    {errors[`work.${row.id}`]}
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddWorkRow}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-dashed border-teal-700/40 bg-white/60 px-4 py-2 text-sm font-medium text-teal-900 transition-colors hover:bg-white cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>เพิ่มประวัติการทำงาน</span>
            </button>
          </div>
        )}
      </section>

      {/* Section 3: Education Background */}
      <section className="space-y-4 border-t border-teal-900/12 pt-8">
        <div>
          <h2 className="font-display text-xl font-semibold text-teal-950 sm:text-2xl">
            3. ประวัติการศึกษา (Education Background)
          </h2>
          <p className="mt-1 text-sm text-teal-900/75">
            กรุณากรอกข้อมูลระดับการศึกษาที่สำเร็จแล้ว (จำเป็นต้องกรอกระดับปริญญาตรีสำหรับตำแหน่งพยาบาลวิชาชีพ)
          </p>
        </div>

        {errors['education.bachelor'] && (
          <p className="rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-2.5 text-sm font-medium text-rose-800">
            {errors['education.bachelor']}
          </p>
        )}

        {/* Desktop Table */}
        <div className="hidden overflow-x-auto rounded-2xl border border-teal-900/15 bg-white/75 lg:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-teal-900/15 bg-teal-900/5 text-xs font-semibold text-teal-950">
                <th className="px-3.5 py-3 w-[18%]">ระดับ (Level)</th>
                <th className="px-2.5 py-3 w-[22%]">ชื่อสถาบันการศึกษา (Institute)</th>
                <th className="px-2.5 py-3 w-[16%]">วุฒิการศึกษา (Degree)</th>
                <th className="px-2.5 py-3 w-[18%]">สาขาวิชาเอก (Major)</th>
                <th className="px-2.5 py-3 w-[10%]">เกรดเฉลี่ย (G.P.A.)</th>
                <th className="px-2.5 py-3 w-[8%]">จากปี (From)</th>
                <th className="px-2.5 py-3 w-[8%]">ถึงปี (To)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-900/10">
              {educationBackground.map((edu) => {
                const isBachelor = edu.levelKey === 'bachelor';
                return (
                  <tr
                    key={edu.levelKey}
                    className={isBachelor ? 'bg-teal-50/55' : 'bg-transparent'}
                  >
                    <td className="px-3.5 py-3 font-medium text-teal-950 align-middle">
                      {edu.levelLabel}
                      {isBachelor && <span className="ml-1 text-rose-600">*</span>}
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        value={edu.institute}
                        onChange={(e) => updateEduField(edu.levelKey, 'institute', e.target.value)}
                        placeholder={isBachelor ? 'เช่น มหาวิทยาลัยขอนแก่น' : 'ระบุสถาบัน'}
                        className="glass-input w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-sm text-teal-950 placeholder:text-teal-900/35"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => updateEduField(edu.levelKey, 'degree', e.target.value)}
                        placeholder={isBachelor ? 'พย.บ. / B.N.S.' : 'วุฒิ'}
                        className="glass-input w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-sm text-teal-950 placeholder:text-teal-900/35"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        value={edu.major}
                        onChange={(e) => updateEduField(edu.levelKey, 'major', e.target.value)}
                        placeholder={isBachelor ? 'พยาบาลศาสตร์' : 'สาขา'}
                        className="glass-input w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-sm text-teal-950 placeholder:text-teal-900/35"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        value={edu.gpa}
                        onChange={(e) => updateEduField(edu.levelKey, 'gpa', e.target.value)}
                        placeholder="3.25"
                        className="glass-input w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/35"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        value={edu.fromYear}
                        onChange={(e) => updateEduField(edu.levelKey, 'fromYear', e.target.value)}
                        placeholder="2562"
                        className="glass-input w-full min-h-[40px] rounded-lg px-2 py-1.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/35"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        value={edu.toYear}
                        onChange={(e) => updateEduField(edu.levelKey, 'toYear', e.target.value)}
                        placeholder="2566"
                        className="glass-input w-full min-h-[40px] rounded-lg px-2 py-1.5 text-sm text-teal-950 font-mono tabular-nums placeholder:font-sans placeholder:text-teal-900/35"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile / Tablet Card Layout */}
        <div className="space-y-3 lg:hidden">
          {educationBackground.map((edu) => {
            const isBachelor = edu.levelKey === 'bachelor';
            return (
              <div
                key={edu.levelKey}
                className={`rounded-2xl border p-4 ${
                  isBachelor
                    ? 'border-teal-700/35 bg-teal-50/75'
                    : 'border-teal-900/12 bg-white/65'
                }`}
              >
                <div className="mb-3 font-display text-sm font-semibold text-teal-950">
                  {edu.levelLabel}
                  {isBachelor && <span className="ml-1 text-rose-600">* (จำเป็น)</span>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-teal-900">
                      ชื่อสถาบันการศึกษา (Institute)
                    </label>
                    <input
                      type="text"
                      value={edu.institute}
                      onChange={(e) => updateEduField(edu.levelKey, 'institute', e.target.value)}
                      placeholder="ระบุชื่อสถาบัน"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-900">
                      วุฒิการศึกษา (Degree)
                    </label>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => updateEduField(edu.levelKey, 'degree', e.target.value)}
                      placeholder="เช่น พย.บ."
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-900">
                      สาขาวิชาเอก (Major)
                    </label>
                    <input
                      type="text"
                      value={edu.major}
                      onChange={(e) => updateEduField(edu.levelKey, 'major', e.target.value)}
                      placeholder="เช่น พยาบาลศาสตร์"
                      className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-3 py-2 text-sm text-teal-950"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-teal-900">G.P.A.</label>
                      <input
                        type="text"
                        value={edu.gpa}
                        onChange={(e) => updateEduField(edu.levelKey, 'gpa', e.target.value)}
                        placeholder="3.25"
                        className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-2.5 py-2 text-sm text-teal-950 font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-900">จากปี</label>
                      <input
                        type="text"
                        value={edu.fromYear}
                        onChange={(e) => updateEduField(edu.levelKey, 'fromYear', e.target.value)}
                        placeholder="2562"
                        className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-2.5 py-2 text-sm text-teal-950 font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-900">ถึงปี</label>
                      <input
                        type="text"
                        value={edu.toYear}
                        onChange={(e) => updateEduField(edu.levelKey, 'toYear', e.target.value)}
                        placeholder="2566"
                        className="glass-input mt-1 w-full min-h-[42px] rounded-xl px-2.5 py-2 text-sm text-teal-950 font-mono tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
