export type TitlePrefix = 'นาย (Mr.)' | 'นาง (Mrs.)' | 'นางสาว (Ms.)' | '';

export interface PersonalInformation {
  title: TitlePrefix;
  fullNameTh: string;
  nicknameTh: string;
  fullNameEn: string;
  nicknameEn: string;
  dateOfBirth: string;
  age: string;
  placeOfBirth: string;
  nationality: string;
  mobileNumber: string;
  email: string;
  idCardOrPassport: string;
  lineId: string;
  permanentAddress: string;
  permanentLandLine: string;
  presentAddress: string;
  presentLandLine: string;
  sameAsPermanent: boolean;
}

export interface WorkExperienceItem {
  id: string;
  fromMonthYear: string;
  toMonthYear: string;
  company: string;
  position: string;
  scopeOfResponsibility: string;
  salary: string;
  otherIncome: string;
  reasonForLeaving: string;
}

export type EducationLevelKey =
  | 'phd'
  | 'master'
  | 'bachelor'
  | 'vocational'
  | 'highSchool';

export interface EducationItem {
  levelKey: EducationLevelKey;
  levelLabel: string;
  institute: string;
  degree: string;
  major: string;
  gpa: string;
  fromYear: string;
  toYear: string;
}

export interface NursingQualification {
  licenseNumber: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  occupationalHealthTrained: boolean;
  occupationalHealthHours: string;
  blsAclsCertified: boolean;
  shiftWorkReady: boolean;
  availableStartDate: string;
  expectedSalary: string;
  clinicalSkillsNote: string;
}

export interface EmergencyContact {
  fullName: string;
  relationship: string;
  address: string;
  mobilePhone: string;
  landLine: string;
}

export type DocumentSlotKey =
  | 'idCard'
  | 'houseReg'
  | 'photo'
  | 'nursingLicense'
  | 'bankBook';

export interface UploadedDocumentItem {
  id: string;
  slotKey: DocumentSlotKey;
  slotLabel: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl?: string;
  fileUrl?: string;
  uploadedAt: string;
}

export interface ApplicationFormData {
  personalInfo: PersonalInformation;
  hasNoWorkExperience: boolean;
  workExperiences: WorkExperienceItem[];
  educationBackground: EducationItem[];
  nursingQualification: NursingQualification;
  emergencyContact: EmergencyContact;
  documents: UploadedDocumentItem[];
  pdpaAccepted: boolean;
  truthfulnessAccepted: boolean;
}

export type ApplicationStatus =
  | 'ได้รับใบสมัครแล้ว'
  | 'อยู่ระหว่างตรวจสอบเอกสาร'
  | 'ผ่านการคัดกรองเบื้องต้น'
  | 'นัดหมายสัมภาษณ์';

export interface SubmittedApplicationRecord extends ApplicationFormData {
  applicationId: string;
  submittedAt: string;
  status: ApplicationStatus;
  hrNote?: string;
}

export interface ValidationErrors {
  [fieldPath: string]: string;
}
