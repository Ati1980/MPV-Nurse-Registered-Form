import type { ApplicationFormData } from '../types/application.ts';
import { formatBytes, formatThaiDateTime } from '../utils/applicationHelpers.ts';

interface PrintableApplicationSheetProps {
  data: ApplicationFormData;
  applicationId?: string;
  submittedAt?: string;
}

export function PrintableApplicationSheet({
  data,
  applicationId,
  submittedAt,
}: PrintableApplicationSheetProps) {
  const { personalInfo, workExperiences, educationBackground, nursingQualification, emergencyContact } =
    data;

  const photoDoc = data.documents.find((d) => d.slotKey === 'photo');
  const photoSrc = photoDoc?.dataUrl || photoDoc?.fileUrl;

  const filledWorkRows = workExperiences.filter(
    (w) => w.company.trim() || w.position.trim() || w.fromMonthYear.trim()
  );
  const hasEduDetails = educationBackground.some(
    (e) => e.institute.trim() || e.degree.trim() || e.major.trim() || e.gpa.trim()
  );
  const hasWorkSection = data.hasNoWorkExperience || filledWorkRows.length > 0;
  const hasNursingDetails = Boolean(
    nursingQualification.licenseNumber.trim() ||
      nursingQualification.licenseIssueDate.trim() ||
      nursingQualification.licenseExpiryDate.trim() ||
      nursingQualification.availableStartDate.trim() ||
      nursingQualification.expectedSalary.trim() ||
      nursingQualification.clinicalSkillsNote.trim()
  );
  const hasEmergencyDetails = Boolean(
    emergencyContact.fullName.trim() ||
      emergencyContact.relationship.trim() ||
      emergencyContact.address.trim() ||
      emergencyContact.mobilePhone.trim()
  );
  const isLegacyFull = hasWorkSection || hasEduDetails || hasNursingDetails;

  return (
    <div className="print-container max-w-full overflow-hidden rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 shadow-sm sm:p-8 break-words">
      {/* Official Header */}
      <div className="flex flex-col justify-between gap-4 border-b-2 border-teal-800 pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold tracking-wide text-teal-800">
            โรงงานน้ำตาลมิตรภูเวียง · กลุ่มมิตรผล
          </p>
          <h2 className="font-display mt-1 text-lg font-bold text-slate-950 sm:text-xl">
            ใบสมัครงานตำแหน่ง พยาบาลวิชาชีพ ประจำปี 2570
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {applicationId ? (
              <>
                เลขที่ใบสมัครอ้างอิง:{' '}
                <span className="font-mono font-semibold text-slate-900">{applicationId}</span>
                {submittedAt && (
                  <>
                    {' '}
                    · ยื่นสมัครเมื่อ {formatThaiDateTime(submittedAt)}
                  </>
                )}
              </>
            ) : (
              'เอกสารสรุปข้อมูลประกอบการยื่นสมัครงานออนไลน์'
            )}
          </p>
        </div>

        {/* Photo Box */}
        <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt="รูปถ่ายผู้สมัคร"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-[11px] text-slate-500">รูปถ่ายผู้สมัคร</span>
          )}
        </div>
      </div>

      {/* Section 1: Personal Information */}
      <div className="mt-5">
        <div className="bg-sky-100/90 px-3 py-1.5 text-sm font-bold text-slate-900 border border-sky-200">
          1. ข้อมูลส่วนตัว (Personal Information)
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 border-x border-b border-slate-200 p-3 text-xs sm:grid-cols-2">
          <div>
            <span className="font-semibold text-slate-600">คำนำหน้า (Title):</span>{' '}
            <span>{personalInfo.title || '-'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">เลขที่บัตรประชาชน / Passport:</span>{' '}
            <span className="font-mono tabular-nums">{personalInfo.idCardOrPassport || '-'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">ชื่อ - นามสกุลภาษาไทย:</span>{' '}
            <span>
              {personalInfo.fullNameTh || '-'}{' '}
              {personalInfo.nicknameTh ? `(ชื่อเล่น: ${personalInfo.nicknameTh})` : ''}
            </span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">Name-Surname (EN):</span>{' '}
            <span>
              {personalInfo.fullNameEn || '-'}{' '}
              {personalInfo.nicknameEn ? `(Nickname: ${personalInfo.nicknameEn})` : ''}
            </span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">วัน/เดือน/ปีเกิด (Date of Birth):</span>{' '}
            <span className="tabular-nums">{personalInfo.dateOfBirth || '-'}</span>{' '}
            <span className="ml-2 font-semibold text-slate-600">อายุ:</span>{' '}
            <span className="tabular-nums">{personalInfo.age || '-'} ปี</span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">ภูมิลำเนา / สัญชาติ:</span>{' '}
            <span>
              {personalInfo.placeOfBirth || '-'} / {personalInfo.nationality || '-'}
            </span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">เบอร์มือถือ (Mobile):</span>{' '}
            <span className="font-mono tabular-nums">{personalInfo.mobileNumber || '-'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">อีเมล / Line ID:</span>{' '}
            <span>
              {personalInfo.email || '-'} {personalInfo.lineId ? `· Line: ${personalInfo.lineId}` : ''}
            </span>
          </div>
          <div className="sm:col-span-2">
            <span className="font-semibold text-slate-600">ที่อยู่ตามทะเบียนบ้าน (Permanent Address):</span>{' '}
            <span>{personalInfo.permanentAddress || '-'}</span>
            {personalInfo.permanentLandLine && (
              <span className="ml-2 text-slate-600">
                (โทรศัพท์: <span className="font-mono">{personalInfo.permanentLandLine}</span>)
              </span>
            )}
          </div>
          <div className="sm:col-span-2">
            <span className="font-semibold text-slate-600">ที่อยู่ปัจจุบัน (Present Address):</span>{' '}
            <span>{personalInfo.presentAddress || '-'}</span>
            {personalInfo.presentLandLine && (
              <span className="ml-2 text-slate-600">
                (โทรศัพท์: <span className="font-mono">{personalInfo.presentLandLine}</span>)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Legacy Sections (Work, Education, Nursing Qualification) rendered only for legacy records */}
      {isLegacyFull && (
        <>
          {/* Section 2: Work Experience */}
          <div className="mt-5">
            <div className="bg-sky-100/90 px-3 py-1.5 text-sm font-bold text-slate-900 border border-sky-200">
              ประวัติการทำงานที่ผ่านมา (Work Experience)
            </div>
            {data.hasNoWorkExperience || filledWorkRows.length === 0 ? (
              <div className="border-x border-b border-slate-200 p-3 text-xs text-slate-600">
                ไม่มีประสบการณ์ทำงาน
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="divide-y divide-slate-200 border-x border-b border-slate-200 sm:hidden print:hidden">
                  {filledWorkRows.map((row) => (
                    <div key={row.id} className="space-y-1.5 p-3 text-xs">
                      <div className="font-semibold text-slate-900">
                        {row.position || '-'} · {row.company || '-'}
                      </div>
                      <div className="font-mono text-slate-600 tabular-nums">
                        ระยะเวลา: {row.fromMonthYear || '-'} – {row.toMonthYear || '-'}
                      </div>
                      {row.scopeOfResponsibility && (
                        <div className="text-slate-700">หน้าที่: {row.scopeOfResponsibility}</div>
                      )}
                      <div className="text-slate-600 tabular-nums">
                        เงินเดือน: {row.salary || '-'}
                        {row.otherIncome ? ` · รายได้อื่น: ${row.otherIncome}` : ''}
                      </div>
                      {row.reasonForLeaving && (
                        <div className="text-slate-600">สาเหตุที่ออก: {row.reasonForLeaving}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop & Print Table */}
                <div className="hidden overflow-x-auto border-x border-b border-slate-200 sm:block print:block">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                        <th className="p-2 border-r border-slate-200">ระยะเวลาทำงาน</th>
                        <th className="p-2 border-r border-slate-200">บริษัท / สถานพยาบาล</th>
                        <th className="p-2 border-r border-slate-200">ตำแหน่ง</th>
                        <th className="p-2 border-r border-slate-200">ลักษณะงานที่รับผิดชอบ</th>
                        <th className="p-2 border-r border-slate-200">เงินเดือน / รายได้อื่น</th>
                        <th className="p-2">สาเหตุที่ออก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filledWorkRows.map((row) => (
                        <tr key={row.id}>
                          <td className="p-2 border-r border-slate-200 font-mono tabular-nums whitespace-nowrap">
                            {row.fromMonthYear || '-'} – {row.toMonthYear || '-'}
                          </td>
                          <td className="p-2 border-r border-slate-200">{row.company || '-'}</td>
                          <td className="p-2 border-r border-slate-200">{row.position || '-'}</td>
                          <td className="p-2 border-r border-slate-200">{row.scopeOfResponsibility || '-'}</td>
                          <td className="p-2 border-r border-slate-200 tabular-nums">
                            {row.salary || '-'}
                            {row.otherIncome ? ` / ${row.otherIncome}` : ''}
                          </td>
                          <td className="p-2">{row.reasonForLeaving || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Section 3: Education Background */}
          <div className="mt-5">
            <div className="bg-sky-100/90 px-3 py-1.5 text-sm font-bold text-slate-900 border border-sky-200">
              ประวัติการศึกษา (Education Background)
            </div>
            {/* Mobile Card View */}
            <div className="divide-y divide-slate-200 border-x border-b border-slate-200 sm:hidden print:hidden">
              {educationBackground.map((edu) => (
                <div key={edu.levelKey} className="space-y-1 p-3 text-xs">
                  <div className="font-semibold text-slate-900">{edu.levelLabel}</div>
                  <div className="text-slate-700">
                    สถาบัน: {edu.institute || '-'} · วุฒิ: {edu.degree || '-'}
                  </div>
                  <div className="text-slate-600 tabular-nums">
                    สาขา: {edu.major || '-'} · G.P.A.: {edu.gpa || '-'} · ปี:{' '}
                    {edu.fromYear || edu.toYear ? `${edu.fromYear || '-'} – ${edu.toYear || '-'}` : '-'}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop & Print Table */}
            <div className="hidden overflow-x-auto border-x border-b border-slate-200 sm:block print:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                    <th className="p-2 border-r border-slate-200">ระดับ (Level)</th>
                    <th className="p-2 border-r border-slate-200">ชื่อสถาบันการศึกษา</th>
                    <th className="p-2 border-r border-slate-200">วุฒิการศึกษา</th>
                    <th className="p-2 border-r border-slate-200">สาขาวิชาเอก</th>
                    <th className="p-2 border-r border-slate-200">G.P.A.</th>
                    <th className="p-2">ระยะเวลา (จากปี - ถึงปี)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {educationBackground.map((edu) => (
                    <tr key={edu.levelKey}>
                      <td className="p-2 border-r border-slate-200 font-medium">{edu.levelLabel}</td>
                      <td className="p-2 border-r border-slate-200">{edu.institute || '-'}</td>
                      <td className="p-2 border-r border-slate-200">{edu.degree || '-'}</td>
                      <td className="p-2 border-r border-slate-200">{edu.major || '-'}</td>
                      <td className="p-2 border-r border-slate-200 font-mono tabular-nums">
                        {edu.gpa || '-'}
                      </td>
                      <td className="p-2 font-mono tabular-nums">
                        {edu.fromYear || edu.toYear ? `${edu.fromYear || '-'} – ${edu.toYear || '-'}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Nursing Qualification */}
          <div className="mt-5">
            <div className="bg-sky-100/90 px-3 py-1.5 text-sm font-bold text-slate-900 border border-sky-200">
              ข้อมูลใบประกอบวิชาชีพพยาบาลและความพร้อมปฏิบัติงาน
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 border-x border-b border-slate-200 p-3 text-xs sm:grid-cols-2">
              <div>
                <span className="font-semibold text-slate-600">เลขที่ใบประกอบวิชาชีพฯ (ชั้นหนึ่ง):</span>{' '}
                <span className="font-mono tabular-nums">{nursingQualification.licenseNumber || '-'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">วันออกบัตร / วันหมดอายุ:</span>{' '}
                <span className="tabular-nums">
                  {nursingQualification.licenseIssueDate || '-'} ถึง{' '}
                  {nursingQualification.licenseExpiryDate || '-'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">การอบรมอาชีวอนามัย 60 ชม.:</span>{' '}
                <span>
                  {nursingQualification.occupationalHealthTrained
                    ? `ผ่านการอบรม (${nursingQualification.occupationalHealthHours || 'ระบุแล้ว'})`
                    : 'ยังไม่ได้อบรม'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">BLS / ACLS & การทำงานเป็นกะ:</span>{' '}
                <span>
                  {nursingQualification.blsAclsCertified ? 'มีใบรับรอง BLS/ACLS' : 'ไม่มี BLS/ACLS'} ·{' '}
                  {nursingQualification.shiftWorkReady ? 'พร้อมปฏิบัติงานเป็นกะ' : 'ไม่สะดวกงานกะ'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">วันที่สะดวกเริ่มงาน:</span>{' '}
                <span className="tabular-nums">{nursingQualification.availableStartDate || '-'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">เงินเดือนที่คาดหวัง:</span>{' '}
                <span className="tabular-nums">{nursingQualification.expectedSalary || '-'}</span>
              </div>
              {nursingQualification.clinicalSkillsNote && (
                <div className="sm:col-span-2">
                  <span className="font-semibold text-slate-600">ทักษะและความสามารถเพิ่มเติม:</span>{' '}
                  <span>{nursingQualification.clinicalSkillsNote}</span>
                </div>
              )}
            </div>
          </div>

        </>
      )}

      {/* Emergency Contact (Section 2 in streamlined form, or shown when present) */}
      {(hasEmergencyDetails || !isLegacyFull) && (
        <div className="mt-5">
          <div className="bg-sky-100/90 px-3 py-1.5 text-sm font-bold text-slate-900 border border-sky-200">
            2. บุคคลที่สามารถติดต่อได้ในกรณีฉุกเฉิน (Contact person in case of emergency)
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 border-x border-b border-slate-200 p-3 text-xs sm:grid-cols-2">
            <div>
              <span className="font-semibold text-slate-600">ชื่อ-นามสกุล (Name-Lastname):</span>{' '}
              <span>{emergencyContact.fullName || '-'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-600">ความสัมพันธ์ (Relationship):</span>{' '}
              <span>{emergencyContact.relationship || '-'}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="font-semibold text-slate-600">ที่อยู่ (Address):</span>{' '}
              <span>{emergencyContact.address || '-'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-600">เบอร์โทรศัพท์มือถือ (Mobile Phone):</span>{' '}
              <span className="font-mono tabular-nums">{emergencyContact.mobilePhone || '-'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-600">เบอร์ติดต่อ (Telephone):</span>{' '}
              <span className="font-mono tabular-nums">{emergencyContact.landLine || '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Attached Documents Summary */}
      <div className="mt-5">
        <div className="bg-sky-100/90 px-3 py-1.5 text-sm font-bold text-slate-900 border border-sky-200">
          3. เอกสารประกอบการสมัครที่แนบออนไลน์ ({data.documents.length} รายการ)
        </div>
        <div className="border-x border-b border-slate-200 p-3 text-xs">
          {data.documents.length === 0 ? (
            <p className="text-slate-500">ยังไม่มีเอกสารแนบ</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {data.documents.map((doc) => (
                <li key={doc.id} className="text-slate-800">
                  • <span className="font-semibold">{doc.slotLabel}:</span> {doc.fileName} (
                  <span className="tabular-nums">{formatBytes(doc.sizeBytes)}</span>)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Declaration Signature Footer */}
      <div className="mt-6 flex flex-col justify-between gap-6 border-t border-slate-200 pt-5 text-xs text-slate-700 sm:flex-row sm:items-end">
        <p className="max-w-md leading-relaxed">
          ข้าพเจ้าขอรับรองว่าข้อความและเอกสารหลักฐานที่ยื่นสมัครงานตำแหน่งพยาบาลวิชาชีพ ประจำปี 2570
          ต่อโรงงานน้ำตาลมิตรภูเวียง เป็นความจริงทุกประการ
        </p>
        <div className="text-center shrink-0">
          <div className="border-b border-slate-400 px-10 pb-1 font-medium text-slate-900">
            {personalInfo.fullNameTh || '........................................'}
          </div>
          <p className="mt-1 text-[11px] text-slate-600">ลงชื่อผู้สมัคร (ยืนยันทางอิเล็กทรอนิกส์)</p>
        </div>
      </div>
    </div>
  );
}
