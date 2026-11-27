import { isSupabaseConfigured, supabase } from '../supabase.ts';
import type {
  ApplicationFormData,
  ApplicationStatus,
  EducationItem,
  SubmittedApplicationRecord,
  UploadedDocumentItem,
  WorkExperienceItem,
} from '../types/application.ts';
import { createDefaultEducationRows } from './applicationHelpers.ts';
import {
  deleteSubmittedFilesFromIdb,
  loadSubmittedFileFromIdb,
  saveSingleSubmittedFileToIdb,
  saveSubmittedFilesToIdb,
} from './draftStorage.ts';

const FALLBACK_STORAGE_KEY = 'mpv_nurse_2570_submitted_records_v1';
const HR_PIN_SESSION_KEY = 'mpv_hr_pin_session_v1';
const HR_PIN_TTL_MS = 12 * 60 * 60 * 1000;

export interface StatusOnlyApplicationRecord {
  applicationId: string;
  status: ApplicationStatus;
  submittedAt: string;
  hrNote?: string;
  statusOnly: true;
}

export type TrackedApplicationResult =
  | (SubmittedApplicationRecord & { statusOnly?: false })
  | StatusOnlyApplicationRecord;

export function getStoredHrPin(): string | null {
  try {
    const raw = localStorage.getItem(HR_PIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { pin?: string; expiresAt?: number };
    if (
      !parsed?.pin ||
      !/^\d{4}$/.test(parsed.pin) ||
      !parsed.expiresAt ||
      parsed.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(HR_PIN_SESSION_KEY);
      return null;
    }
    return parsed.pin;
  } catch {
    return null;
  }
}

export function setStoredHrPin(pin: string): void {
  try {
    localStorage.setItem(
      HR_PIN_SESSION_KEY,
      JSON.stringify({ pin, expiresAt: Date.now() + HR_PIN_TTL_MS })
    );
  } catch {
    // Ignore storage error
  }
}

export function clearStoredHrPin(): void {
  try {
    localStorage.removeItem(HR_PIN_SESSION_KEY);
  } catch {
    // Ignore storage error
  }
}

function readLocalRecords(): SubmittedApplicationRecord[] {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SubmittedApplicationRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRecords(records: SubmittedApplicationRecord[]): void {
  try {
    const lite = records.map((rec) => ({
      ...rec,
      documents: rec.documents.map((d) =>
        d.dataUrl && d.dataUrl.length > 150_000 ? { ...d, dataUrl: undefined } : d
      ),
    }));
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(lite));
  } catch {
    // Ignore storage quota issues on fallback
  }
}

function clampStr(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function buildSanitizedCloudPayload(record: SubmittedApplicationRecord) {
  const p = record.personalInfo;
  const n = record.nursingQualification;
  const e = record.emergencyContact;

  const workExperiences: WorkExperienceItem[] = (record.workExperiences || [])
    .slice(0, 15)
    .map((item, idx) => ({
      id: clampStr(item.id, 80) || `work-${idx + 1}`,
      fromMonthYear: clampStr(item.fromMonthYear, 40),
      toMonthYear: clampStr(item.toMonthYear, 40),
      company: clampStr(item.company, 150),
      position: clampStr(item.position, 120),
      scopeOfResponsibility: clampStr(item.scopeOfResponsibility, 1000),
      salary: clampStr(item.salary, 40),
      otherIncome: clampStr(item.otherIncome, 40),
      reasonForLeaving: clampStr(item.reasonForLeaving, 300),
    }));

  const rawEdu =
    Array.isArray(record.educationBackground) && record.educationBackground.length > 0
      ? record.educationBackground
      : createDefaultEducationRows();

  const educationBackground: EducationItem[] = rawEdu.slice(0, 8).map((edu) => ({
    levelKey: edu.levelKey,
    levelLabel: clampStr(edu.levelLabel, 80) || edu.levelKey,
    institute: clampStr(edu.institute, 150),
    degree: clampStr(edu.degree, 120),
    major: clampStr(edu.major, 120),
    gpa: clampStr(edu.gpa, 20),
    fromYear: clampStr(edu.fromYear, 20),
    toYear: clampStr(edu.toYear, 20),
  }));

  // Strip raw dataUrl from metadata payload; files live in nurse_application_files
  const documents = (record.documents || []).slice(0, 10).map((d, idx) => {
    const cleanDoc: Omit<UploadedDocumentItem, 'dataUrl'> = {
      id: clampStr(d.id, 100) || `doc-${idx + 1}`,
      slotKey: d.slotKey,
      slotLabel: clampStr(d.slotLabel, 150) || d.slotKey,
      fileName: clampStr(d.fileName, 255) || 'document',
      mimeType: clampStr(d.mimeType, 100) || 'application/octet-stream',
      sizeBytes: Math.max(0, Math.min(15_000_000, Number(d.sizeBytes) || 0)),
      uploadedAt: clampStr(d.uploadedAt, 64) || new Date().toISOString(),
    };
    const fileUrl = clampStr(d.fileUrl, 500);
    if (fileUrl) {
      cleanDoc.fileUrl = fileUrl;
    }
    return cleanDoc;
  });

  return {
    applicationId: clampStr(record.applicationId, 64),
    status: (record.status || 'ได้รับใบสมัครแล้ว') as ApplicationStatus,
    submittedAt: clampStr(record.submittedAt, 64),
    hrNote: clampStr(record.hrNote || '', 1000),
    hasNoWorkExperience: Boolean(record.hasNoWorkExperience),
    pdpaAccepted: Boolean(record.pdpaAccepted),
    truthfulnessAccepted: Boolean(record.truthfulnessAccepted),
    personalInfo: {
      title: clampStr(p.title, 30),
      fullNameTh: clampStr(p.fullNameTh, 120),
      nicknameTh: clampStr(p.nicknameTh, 60),
      fullNameEn: clampStr(p.fullNameEn, 120),
      nicknameEn: clampStr(p.nicknameEn, 60),
      dateOfBirth: clampStr(p.dateOfBirth, 30),
      age: clampStr(p.age, 10),
      placeOfBirth: clampStr(p.placeOfBirth, 120),
      nationality: clampStr(p.nationality, 60),
      mobileNumber: clampStr(p.mobileNumber.replace(/[\s-]/g, ''), 20),
      email: clampStr(p.email, 150),
      idCardOrPassport: clampStr(p.idCardOrPassport, 30),
      lineId: clampStr(p.lineId, 80),
      permanentAddress: clampStr(p.permanentAddress, 500),
      permanentLandLine: clampStr(p.permanentLandLine, 30),
      presentAddress: clampStr(p.presentAddress || p.permanentAddress, 500),
      presentLandLine: clampStr(p.presentLandLine, 30),
      sameAsPermanent: Boolean(p.sameAsPermanent),
    },
    workExperiences,
    educationBackground,
    nursingQualification: {
      licenseNumber: clampStr(n.licenseNumber, 60),
      licenseIssueDate: clampStr(n.licenseIssueDate, 30),
      licenseExpiryDate: clampStr(n.licenseExpiryDate, 30),
      occupationalHealthTrained: Boolean(n.occupationalHealthTrained),
      occupationalHealthHours: clampStr(n.occupationalHealthHours, 30),
      blsAclsCertified: Boolean(n.blsAclsCertified),
      shiftWorkReady: Boolean(n.shiftWorkReady),
      availableStartDate: clampStr(n.availableStartDate, 30),
      expectedSalary: clampStr(n.expectedSalary, 30),
      clinicalSkillsNote: clampStr(n.clinicalSkillsNote, 1500),
    },
    emergencyContact: {
      fullName: clampStr(e.fullName, 120),
      relationship: clampStr(e.relationship, 60),
      address: clampStr(e.address, 500),
      mobilePhone: clampStr(e.mobilePhone.replace(/[\s-]/g, ''), 20),
      landLine: clampStr(e.landLine, 30),
    },
    documents,
  };
}

async function resolveFileDataUrlsForSync(
  record: SubmittedApplicationRecord,
  sourceDocsById: Map<string, UploadedDocumentItem>
) {
  const files: Array<{
    id: string;
    slotKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
  }> = [];

  for (const origDoc of record.documents || []) {
    const sourceDoc = sourceDocsById.get(origDoc.id) ?? origDoc;
    let dataUrl = sourceDoc.dataUrl;

    if (!dataUrl || !dataUrl.startsWith('data:')) {
      const idbFile = await loadSubmittedFileFromIdb(record.applicationId, origDoc.id);
      if (idbFile?.dataUrl) {
        dataUrl = idbFile.dataUrl;
      }
    }

    if ((!dataUrl || !dataUrl.startsWith('data:')) && origDoc.fileUrl) {
      try {
        const res = await fetch(origDoc.fileUrl);
        const contentType = res.headers.get('content-type') || '';
        if (
          res.ok &&
          !contentType.includes('text/html') &&
          !contentType.includes('application/json')
        ) {
          const blob = await res.blob();
          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        // Ignore unavailable Express URL
      }
    }

    if (dataUrl && dataUrl.startsWith('data:')) {
      files.push({
        id: origDoc.id,
        slotKey: origDoc.slotKey,
        fileName: origDoc.fileName,
        mimeType: origDoc.mimeType,
        sizeBytes: Number(origDoc.sizeBytes) || 0,
        dataUrl,
      });
    }
  }

  return files;
}

export async function submitApplicationApi(
  formData: ApplicationFormData
): Promise<SubmittedApplicationRecord> {
  let serverRecord: SubmittedApplicationRecord | null = null;

  try {
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (response.status !== 404 && response.status !== 405) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const result = (await response.json()) as {
          application?: SubmittedApplicationRecord;
          error?: string;
        };
        if (response.ok && result.application) {
          serverRecord = result.application;
        } else if (!isSupabaseConfigured) {
          throw new Error(result.error || 'เกิดข้อผิดพลาดในการบันทึกใบสมัคร');
        }
      }
    }
  } catch (err) {
    if (
      !isSupabaseConfigured &&
      err instanceof Error &&
      !err.message.includes('Failed to fetch') &&
      !err.message.includes('NetworkError')
    ) {
      throw err;
    }
  }

  const existing = readLocalRecords();
  const applicationId =
    serverRecord?.applicationId ||
    `MPV-2570-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 5)
      .toUpperCase()}`;
  const submittedAt = serverRecord?.submittedAt || new Date().toISOString();

  const record: SubmittedApplicationRecord = serverRecord ?? {
    ...formData,
    applicationId,
    submittedAt,
    status: 'ได้รับใบสมัครแล้ว',
  };

  const sourceDocsById = new Map((formData.documents || []).map((d) => [d.id, d]));

  if (supabase) {
    const cleanPayload = buildSanitizedCloudPayload(record);
    const filesPayload = await resolveFileDataUrlsForSync(record, sourceDocsById);

    const { error } = await supabase.rpc('submit_nurse_application', {
      p_application_id: cleanPayload.applicationId,
      p_mobile_number: cleanPayload.personalInfo.mobileNumber,
      p_status: cleanPayload.status,
      p_submitted_at: cleanPayload.submittedAt,
      p_payload: cleanPayload,
      p_files: filesPayload,
    });

    if (error) {
      throw new Error(`ไม่สามารถบันทึกใบสมัครไปยัง Supabase ได้: ${error.message}`);
    }
  }

  const recordWithLocalData: SubmittedApplicationRecord = {
    ...record,
    documents: record.documents.map((d) => {
      const original = sourceDocsById.get(d.id);
      return original?.dataUrl && !d.dataUrl ? { ...d, dataUrl: original.dataUrl } : d;
    }),
  };

  await saveSubmittedFilesToIdb(record.applicationId, recordWithLocalData.documents);

  const deduped = existing.filter((r) => r.applicationId !== record.applicationId);
  writeLocalRecords([recordWithLocalData, ...deduped]);
  return record;
}

export async function syncLocalApplicationToCloudApi(
  record: SubmittedApplicationRecord
): Promise<void> {
  if (!supabase) {
    throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล Supabase');
  }

  const sourceDocsById = new Map((record.documents || []).map((d) => [d.id, d]));
  const cleanPayload = buildSanitizedCloudPayload(record);
  const filesPayload = await resolveFileDataUrlsForSync(record, sourceDocsById);

  const { error } = await supabase.rpc('submit_nurse_application', {
    p_application_id: cleanPayload.applicationId,
    p_mobile_number: cleanPayload.personalInfo.mobileNumber,
    p_status: cleanPayload.status,
    p_submitted_at: cleanPayload.submittedAt,
    p_payload: cleanPayload,
    p_files: filesPayload,
  });

  if (error) {
    throw new Error(error.message || 'ไม่สามารถซิงค์ข้อมูลขึ้น Supabase ได้');
  }
}

export async function attachMissingApplicationFileApi(
  applicationId: string,
  fileDoc: UploadedDocumentItem,
  dataUrl: string,
  mimeType: string,
  sizeBytes: number
): Promise<void> {
  if (!fileDoc.id || !dataUrl.startsWith('data:')) {
    throw new Error('ไฟล์ไม่ถูกต้อง');
  }

  await saveSingleSubmittedFileToIdb(
    applicationId,
    fileDoc.id,
    dataUrl,
    mimeType || fileDoc.mimeType
  );

  const hrPin = getStoredHrPin();
  if (!supabase || !hrPin) {
    return;
  }

  const { error } = await supabase.rpc('hr_attach_application_file', {
    p_pin: hrPin,
    p_application_id: applicationId,
    p_doc_id: fileDoc.id,
    p_slot_key: clampStr(fileDoc.slotKey, 60) || 'other',
    p_file_name: clampStr(fileDoc.fileName, 255) || 'document',
    p_mime_type: clampStr(mimeType || fileDoc.mimeType, 120) || 'application/octet-stream',
    p_size_bytes: Math.max(0, Math.min(15_000_000, sizeBytes || fileDoc.sizeBytes || 0)),
    p_data_url: dataUrl,
  });

  if (error) {
    throw new Error(error.message || 'ไม่สามารถอัปโหลดไฟล์ขึ้น Supabase ได้');
  }
}

export async function trackApplicationApi(
  code: string,
  phone: string
): Promise<TrackedApplicationResult> {
  const cleanCode = code.trim().toUpperCase();
  const cleanPhone = phone.replace(/[\s-]/g, '');

  let cloudMatch: SubmittedApplicationRecord | null = null;
  if (supabase) {
    const { data, error } = await supabase.rpc('track_nurse_application', {
      p_code: cleanCode,
      p_phone: cleanPhone,
    });
    if (error) {
      throw new Error('ไม่สามารถตรวจสอบสถานะจากฐานข้อมูล Supabase ได้ในขณะนี้');
    }
    if (data && typeof data === 'object') {
      cloudMatch = data as SubmittedApplicationRecord;
    }
  }

  try {
    const params = new URLSearchParams({ code: cleanCode, phone: cleanPhone });
    const res = await fetch(`/api/applications/track?${params.toString()}`);

    if (res.status !== 405) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = (await res.json()) as {
          application?: SubmittedApplicationRecord;
          error?: string;
        };
        if (res.ok && data.application) {
          return cloudMatch
            ? {
                ...data.application,
                status: cloudMatch.status,
                hrNote: cloudMatch.hrNote ?? data.application.hrNote,
              }
            : data.application;
        }
        if (!cloudMatch && res.status !== 404) {
          throw new Error(data.error || 'ไม่พบข้อมูลใบสมัครที่ตรงกัน');
        }
      }
    }
  } catch (err) {
    if (
      err instanceof Error &&
      !err.message.includes('Failed to fetch') &&
      !err.message.includes('NetworkError')
    ) {
      throw err;
    }
  }

  if (cloudMatch) {
    return cloudMatch;
  }

  const local = readLocalRecords();
  const localMatch = local.find(
    (item) =>
      item.applicationId.toUpperCase() === cleanCode &&
      item.personalInfo.mobileNumber.replace(/[\s-]/g, '') === cleanPhone
  );

  if (localMatch) {
    return localMatch;
  }

  throw new Error('ไม่พบข้อมูลใบสมัครที่ตรงกับเลขที่ใบสมัครและเบอร์โทรศัพท์นี้');
}

export async function listApplicationsApi(): Promise<SubmittedApplicationRecord[]> {
  try {
    const res = await fetch('/api/applications');
    const contentType = res.headers.get('content-type') || '';
    if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
      return readLocalRecords();
    }
    const data = (await res.json()) as { applications?: SubmittedApplicationRecord[] };
    if (!res.ok) {
      throw new Error('ไม่สามารถโหลดรายการใบสมัครได้');
    }
    return data.applications ?? [];
  } catch {
    return readLocalRecords();
  }
}

export async function fetchCloudApplicationsApi(
  hrPin?: string | null
): Promise<SubmittedApplicationRecord[]> {
  const pin = hrPin ?? getStoredHrPin();
  if (!supabase || !pin) return [];

  const { data, error } = await supabase.rpc('hr_list_applications', {
    p_pin: pin,
  });

  if (error) {
    if (error.message.includes('INVALID_HR_PIN')) {
      throw new Error('INVALID_HR_PIN');
    }
    throw new Error(error.message || 'ไม่สามารถดึงข้อมูลใบสมัครจาก Supabase ได้');
  }

  return Array.isArray(data) ? (data as SubmittedApplicationRecord[]) : [];
}

export async function updateApplicationStatusApi(
  applicationId: string,
  status: ApplicationStatus,
  hrNote: string
): Promise<SubmittedApplicationRecord | null> {
  const cleanNote = clampStr(hrNote, 1000);
  let serverUpdated: SubmittedApplicationRecord | null = null;

  try {
    const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, hrNote: cleanNote }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = (await res.json()) as { application?: SubmittedApplicationRecord };
      serverUpdated = data.application ?? null;
    }
  } catch {
    // Ignore local Express miss on static host
  }

  const hrPin = getStoredHrPin();
  if (supabase && hrPin) {
    const { data, error } = await supabase.rpc('hr_update_application_status', {
      p_pin: hrPin,
      p_application_id: applicationId,
      p_status: status,
      p_hr_note: cleanNote,
    });
    if (error) {
      if (error.message.includes('INVALID_HR_PIN')) {
        throw new Error('INVALID_HR_PIN');
      }
      throw new Error(error.message || 'ไม่สามารถอัปเดตสถานะใน Supabase ได้');
    }
    if (data && typeof data === 'object') {
      serverUpdated = data as SubmittedApplicationRecord;
    }
  }

  const records = readLocalRecords();
  const idx = records.findIndex((r) => r.applicationId === applicationId);
  if (idx !== -1) {
    records[idx] = { ...records[idx], status, hrNote: cleanNote };
    writeLocalRecords(records);
    return serverUpdated ?? records[idx];
  }

  return serverUpdated;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const header = dataUrl.slice(5, commaIdx);
  const base64Part = dataUrl.slice(commaIdx + 1).replace(/\s/g, '');
  if (!header.includes(';base64') || !base64Part) return null;
  const mimeType = header.split(';')[0] || 'application/octet-stream';
  try {
    const binaryStr = atob(base64Part);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

export async function resolveApplicationFileApi(
  applicationId: string,
  fileDoc: UploadedDocumentItem
): Promise<{ objectUrl: string; mimeType: string } | null> {
  // 1. In-memory / local dataUrl
  if (fileDoc.dataUrl && fileDoc.dataUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(fileDoc.dataUrl);
    if (blob) {
      return {
        objectUrl: URL.createObjectURL(blob),
        mimeType: blob.type || fileDoc.mimeType,
      };
    }
  }

  // 2. Express uploaded file endpoint (verify it is not an HTML SPA fallback or JSON 404)
  if (fileDoc.fileUrl) {
    try {
      const res = await fetch(fileDoc.fileUrl);
      const contentType = res.headers.get('content-type') || '';
      if (
        res.ok &&
        !contentType.includes('text/html') &&
        !contentType.includes('application/json')
      ) {
        const blob = await res.blob();
        return {
          objectUrl: URL.createObjectURL(blob),
          mimeType: blob.type || fileDoc.mimeType,
        };
      }
    } catch {
      // Fall through to IndexedDB / Supabase lookup
    }
  }

  // 3. Local IndexedDB cache
  const idbFile = await loadSubmittedFileFromIdb(applicationId, fileDoc.id);
  if (idbFile?.dataUrl) {
    const blob = dataUrlToBlob(idbFile.dataUrl);
    if (blob) {
      return {
        objectUrl: URL.createObjectURL(blob),
        mimeType: idbFile.mimeType || blob.type || fileDoc.mimeType,
      };
    }
  }

  // 4. Supabase `nurse_application_files` via PIN-gated RPC
  const hrPin = getStoredHrPin();
  if (supabase && hrPin) {
    const { data, error } = await supabase.rpc('hr_get_application_file', {
      p_pin: hrPin,
      p_application_id: applicationId,
      p_doc_id: fileDoc.id,
    });

    if (!error && data && typeof data === 'object') {
      const stored = data as { dataUrl?: string; mimeType?: string };
      if (stored.dataUrl && stored.dataUrl.startsWith('data:')) {
        const blob = dataUrlToBlob(stored.dataUrl);
        if (blob) {
          void saveSingleSubmittedFileToIdb(
            applicationId,
            fileDoc.id,
            stored.dataUrl,
            stored.mimeType || blob.type || fileDoc.mimeType
          );
          return {
            objectUrl: URL.createObjectURL(blob),
            mimeType: stored.mimeType || blob.type || fileDoc.mimeType,
          };
        }
      }
    }
  }

  // 5. LocalStorage fallback
  const localRecords = readLocalRecords();
  const matchedApp = localRecords.find((r) => r.applicationId === applicationId);
  const matchedDoc = matchedApp?.documents.find((d) => d.id === fileDoc.id);
  if (matchedDoc?.dataUrl && matchedDoc.dataUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(matchedDoc.dataUrl);
    if (blob) {
      return {
        objectUrl: URL.createObjectURL(blob),
        mimeType: blob.type || fileDoc.mimeType,
      };
    }
  }

  return null;
}

export async function deleteApplicationApi(
  applicationId: string,
  docIds: string[] = []
): Promise<void> {
  try {
    await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Ignore Express miss on static host
  }

  const hrPin = getStoredHrPin();
  if (supabase && hrPin) {
    const { error } = await supabase.rpc('hr_delete_application', {
      p_pin: hrPin,
      p_application_id: applicationId,
    });
    if (error) {
      if (error.message.includes('INVALID_HR_PIN')) {
        throw new Error('INVALID_HR_PIN');
      }
      throw new Error(error.message || 'ไม่สามารถลบใบสมัครจาก Supabase ได้');
    }
  }

  await deleteSubmittedFilesFromIdb(applicationId, docIds);
  const records = readLocalRecords();
  writeLocalRecords(records.filter((r) => r.applicationId !== applicationId));
}

export async function verifyHrPinApi(pin: string): Promise<boolean> {
  if (supabase) {
    const { data, error } = await supabase.rpc('hr_verify_pin', { p_pin: pin });
    if (!error) {
      const ok = Boolean(data);
      if (ok) {
        setStoredHrPin(pin);
      }
      return ok;
    }
  }

  try {
    const res = await fetch('/api/hr/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
      throw new Error('STATIC_HOST_FALLBACK');
    }

    const data = (await res.json()) as { ok?: boolean };
    const ok = Boolean(res.ok && data.ok);
    if (ok) {
      setStoredHrPin(pin);
    }
    return ok;
  } catch (err) {
    if (
      err instanceof Error &&
      err.message !== 'STATIC_HOST_FALLBACK' &&
      !err.message.includes('Failed to fetch')
    ) {
      return false;
    }
    const fallbackPin = (import.meta.env.VITE_HR_PIN as string | undefined) || '2910';
    const ok = pin === fallbackPin;
    if (ok) {
      setStoredHrPin(pin);
    }
    return ok;
  }
}
