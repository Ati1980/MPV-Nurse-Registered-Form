import type {
  ApplicationFormData,
  DocumentSlotKey,
  EducationItem,
  ValidationErrors,
  WorkExperienceItem,
} from '../types/application.ts';

export const DRAFT_STORAGE_KEY = 'mpv_nurse_2570_application_draft_v1';

export interface DocumentSlotSpec {
  key: DocumentSlotKey;
  title: string;
  subtitle: string;
  required: boolean;
  accept: string;
  allowMultiple: boolean;
  maxSizeMb: number;
}

export const DOCUMENT_SLOTS: DocumentSlotSpec[] = [
  {
    key: 'idCard',
    title: '1. สำเนาบัตรประจำตัวประชาชน',
    subtitle: 'รับรองสำเนาถูกต้องและขีดคร่อมเพื่อใช้สมัครงานเท่านั้น (PDF, JPG, PNG)',
    required: true,
    accept: 'application/pdf,image/jpeg,image/png',
    allowMultiple: false,
    maxSizeMb: 10,
  },
  {
    key: 'houseReg',
    title: '2. สำเนาทะเบียนบ้าน',
    subtitle: 'หน้าที่มีชื่อผู้สมัครพร้อมรับรองสำเนาถูกต้อง (PDF, JPG, PNG)',
    required: true,
    accept: 'application/pdf,image/jpeg,image/png',
    allowMultiple: false,
    maxSizeMb: 10,
  },
  {
    key: 'photo',
    title: '3. รูปถ่ายหน้าตรง (1 หรือ 2 นิ้ว)',
    subtitle: 'รูปถ่ายสุภาพ หน้าตรง ไม่สวมหมวกหรือแว่นตาดำ (ไฟล์ JPG หรือ PNG)',
    required: true,
    accept: 'image/jpeg,image/png,image/webp',
    allowMultiple: false,
    maxSizeMb: 5,
  },
  {
    key: 'nursingLicense',
    title: '4. สำเนาใบอนุญาตประกอบวิชาชีพการพยาบาลฯ',
    subtitle: 'ใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ ชั้นหนึ่ง ที่ยังไม่หมดอายุ',
    required: true,
    accept: 'application/pdf,image/jpeg,image/png',
    allowMultiple: false,
    maxSizeMb: 10,
  },
  {
    key: 'bankBook',
    title: '5. สำเนาสมุดบัญชีธนาคาร',
    subtitle: 'หน้าแรกที่แสดงชื่อบัญชีและเลขที่บัญชีชัดเจน (PDF, JPG, PNG)',
    required: true,
    accept: 'application/pdf,image/jpeg,image/png',
    allowMultiple: false,
    maxSizeMb: 10,
  },
];

export function createEmptyWorkRow(): WorkExperienceItem {
  return {
    id: `work-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fromMonthYear: '',
    toMonthYear: '',
    company: '',
    position: '',
    scopeOfResponsibility: '',
    salary: '',
    otherIncome: '',
    reasonForLeaving: '',
  };
}

export function createDefaultEducationRows(): EducationItem[] {
  return [
    {
      levelKey: 'phd',
      levelLabel: 'ปริญญาเอก (Ph.D.)',
      institute: '',
      degree: '',
      major: '',
      gpa: '',
      fromYear: '',
      toYear: '',
    },
    {
      levelKey: 'master',
      levelLabel: 'ปริญญาโท (Master Degree)',
      institute: '',
      degree: '',
      major: '',
      gpa: '',
      fromYear: '',
      toYear: '',
    },
    {
      levelKey: 'bachelor',
      levelLabel: 'ปริญญาตรี (Bachelor Degree)',
      institute: '',
      degree: '',
      major: '',
      gpa: '',
      fromYear: '',
      toYear: '',
    },
    {
      levelKey: 'vocational',
      levelLabel: 'ปวช. / ปวส. (Vocational School)',
      institute: '',
      degree: '',
      major: '',
      gpa: '',
      fromYear: '',
      toYear: '',
    },
    {
      levelKey: 'highSchool',
      levelLabel: 'มัธยมศึกษา (High School)',
      institute: '',
      degree: '',
      major: '',
      gpa: '',
      fromYear: '',
      toYear: '',
    },
  ];
}

export function createInitialApplicationData(): ApplicationFormData {
  return {
    personalInfo: {
      title: '',
      fullNameTh: '',
      nicknameTh: '',
      fullNameEn: '',
      nicknameEn: '',
      dateOfBirth: '',
      age: '',
      placeOfBirth: '',
      nationality: 'ไทย',
      mobileNumber: '',
      email: '',
      idCardOrPassport: '',
      lineId: '',
      permanentAddress: '',
      permanentLandLine: '',
      presentAddress: '',
      presentLandLine: '',
      sameAsPermanent: false,
    },
    hasNoWorkExperience: false,
    workExperiences: [createEmptyWorkRow()],
    educationBackground: createDefaultEducationRows(),
    nursingQualification: {
      licenseNumber: '',
      licenseIssueDate: '',
      licenseExpiryDate: '',
      occupationalHealthTrained: false,
      occupationalHealthHours: '',
      blsAclsCertified: false,
      shiftWorkReady: true,
      availableStartDate: '',
      expectedSalary: '',
      clinicalSkillsNote: '',
    },
    emergencyContact: {
      fullName: '',
      relationship: '',
      address: '',
      mobilePhone: '',
      landLine: '',
    },
    documents: [],
    pdpaAccepted: false,
    truthfulnessAccepted: false,
  };
}

export function calculateAgeFromDob(dobString: string): string {
  if (!dobString) return '';
  const birth = new Date(dobString);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  if (age < 15 || age > 90) return '';
  return String(age);
}

export function validateStep1Personal(data: ApplicationFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  const p = data.personalInfo;

  if (!p.title) errors['personalInfo.title'] = 'กรุณาเลือกคำนำหน้าชื่อ';
  if (!p.fullNameTh.trim()) errors['personalInfo.fullNameTh'] = 'กรุณากรอกชื่อ-นามสกุลภาษาไทย';
  if (!p.fullNameEn.trim()) errors['personalInfo.fullNameEn'] = 'กรุณากรอกชื่อ-นามสกุลภาษาอังกฤษ';
  if (!p.dateOfBirth) errors['personalInfo.dateOfBirth'] = 'กรุณาระบุวัน/เดือน/ปีเกิด';
  if (!p.age.trim()) errors['personalInfo.age'] = 'กรุณาระบุอายุ';
  if (!p.placeOfBirth.trim()) errors['personalInfo.placeOfBirth'] = 'กรุณาระบุภูมิลำเนา';
  if (!p.nationality.trim()) errors['personalInfo.nationality'] = 'กรุณาระบุสัญชาติ';

  const cleanMobile = p.mobileNumber.replace(/[\s-]/g, '');
  if (!cleanMobile) {
    errors['personalInfo.mobileNumber'] = 'กรุณากรอกเบอร์มือถือ';
  } else if (!/^0\d{8,9}$/.test(cleanMobile)) {
    errors['personalInfo.mobileNumber'] = 'รูปแบบเบอร์มือถือไม่ถูกต้อง (เช่น 0812345678)';
  }

  if (!p.email.trim()) {
    errors['personalInfo.email'] = 'กรุณากรอกอีเมล';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
    errors['personalInfo.email'] = 'รูปแบบอีเมลไม่ถูกต้อง';
  }

  const cleanId = p.idCardOrPassport.replace(/[\s-]/g, '');
  if (!cleanId) {
    errors['personalInfo.idCardOrPassport'] = 'กรุณากรอกเลขที่บัตรประชาชนหรือหนังสือเดินทาง';
  } else if (cleanId.length < 6) {
    errors['personalInfo.idCardOrPassport'] = 'เลขที่บัตรประชาชนหรือหนังสือเดินทางไม่สมบูรณ์';
  }

  if (!p.permanentAddress.trim()) {
    errors['personalInfo.permanentAddress'] = 'กรุณากรอกที่อยู่ตามทะเบียนบ้าน';
  }
  if (!p.presentAddress.trim()) {
    errors['personalInfo.presentAddress'] = 'กรุณากรอกที่อยู่ปัจจุบัน';
  }

  return errors;
}

export function validateStep2WorkEducation(data: ApplicationFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.hasNoWorkExperience) {
    const filledRows = data.workExperiences.filter(
      (row) => row.company.trim() || row.position.trim() || row.fromMonthYear.trim()
    );
    if (filledRows.length === 0) {
      errors['workExperiences'] =
        'กรุณากรอกประวัติการทำงานอย่างน้อย 1 รายการ หรือเลือก "ไม่มีประสบการณ์ทำงาน"';
    } else {
      filledRows.forEach((row) => {
        if (!row.company.trim() || !row.position.trim()) {
          errors[`work.${row.id}`] = 'กรุณาระบุชื่อบริษัท/หน่วยงาน และตำแหน่งงานให้ครบถ้วน';
        }
      });
    }
  }

  const bachelorRow = data.educationBackground.find((e) => e.levelKey === 'bachelor');
  if (
    !bachelorRow ||
    !bachelorRow.institute.trim() ||
    !bachelorRow.degree.trim() ||
    !bachelorRow.major.trim()
  ) {
    errors['education.bachelor'] =
      'กรุณากรอกข้อมูลการศึกษาระดับปริญญาตรี (สถาบัน, วุฒิการศึกษา และสาขาวิชาเอก) เพื่อประกอบการพิจารณาตำแหน่งพยาบาลวิชาชีพ';
  }

  return errors;
}

export function validateStep3NursingEmergency(data: ApplicationFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  const n = data.nursingQualification;
  const e = data.emergencyContact;

  if (!n.licenseNumber.trim()) {
    errors['nursingQualification.licenseNumber'] = 'กรุณาระบุเลขที่ใบอนุญาตประกอบวิชาชีพการพยาบาลฯ';
  }
  if (!n.licenseExpiryDate) {
    errors['nursingQualification.licenseExpiryDate'] = 'กรุณาระบุวันหมดอายุใบประกอบวิชาชีพ';
  }
  if (!n.availableStartDate) {
    errors['nursingQualification.availableStartDate'] = 'กรุณาระบุวันที่สะดวกเริ่มปฏิบัติงาน';
  }

  if (!e.fullName.trim()) {
    errors['emergencyContact.fullName'] = 'กรุณากรอกชื่อ-นามสกุลผู้ติดต่อฉุกเฉิน';
  }
  if (!e.relationship.trim()) {
    errors['emergencyContact.relationship'] = 'กรุณาระบุความสัมพันธ์';
  }
  if (!e.address.trim()) {
    errors['emergencyContact.address'] = 'กรุณากรอกที่อยู่ผู้ติดต่อฉุกเฉิน';
  }
  const cleanEmergencyMobile = e.mobilePhone.replace(/[\s-]/g, '');
  if (!cleanEmergencyMobile) {
    errors['emergencyContact.mobilePhone'] = 'กรุณากรอกเบอร์โทรศัพท์มือถือผู้ติดต่อฉุกเฉิน';
  } else if (!/^0\d{8,9}$/.test(cleanEmergencyMobile)) {
    errors['emergencyContact.mobilePhone'] = 'รูปแบบเบอร์โทรศัพท์มือถือไม่ถูกต้อง';
  }

  return errors;
}

export function validateStep4Documents(data: ApplicationFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  for (const slot of DOCUMENT_SLOTS) {
    if (slot.required) {
      const hasFile = data.documents.some((doc) => doc.slotKey === slot.key);
      if (!hasFile) {
        errors[`doc.${slot.key}`] = `กรุณาแนบเอกสาร: ${slot.title}`;
      }
    }
  }

  if (!data.truthfulnessAccepted) {
    errors['truthfulnessAccepted'] = 'กรุณายืนยันความถูกต้องของข้อมูลผู้สมัคร';
  }
  if (!data.pdpaAccepted) {
    errors['pdpaAccepted'] = 'กรุณายินยอมให้ประมวลผลข้อมูลส่วนบุคคล (PDPA) เพื่อการพิจารณาสมัครงาน';
  }

  return errors;
}

export function validateAllSteps(data: ApplicationFormData): ValidationErrors {
  return {
    ...validateStep1Personal(data),
    ...validateStep2WorkEducation(data),
    ...validateStep3NursingEmergency(data),
    ...validateStep4Documents(data),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatThaiDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
