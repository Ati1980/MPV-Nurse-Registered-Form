import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase.ts';
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
export const NURSE_REGISTER_COLLECTION = 'nurse_register';
export const NURSE_REGISTER_STATUS_COLLECTION = 'nurse_register_status';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'kku.tum@gmail.com';

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

// Pure-JS SHA-256 fallback for environments without crypto.subtle
function sha256Fallback(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const w = new Uint32Array(64);
  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map((n) => n.toString(16).padStart(8, '0')).join('');
}

async function computeMobileHash(applicationId: string, mobileNumber: string): Promise<string> {
  const cleanPhone = mobileNumber.replace(/[\s-]/g, '');
  const input = `${applicationId.toUpperCase()}:${cleanPhone}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256Fallback(input);
}

function buildSanitizedFirestoreRecord(record: SubmittedApplicationRecord) {
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

  // Strip raw base64 dataUrl blobs to stay strictly below Firestore's 1MB limit
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
    status: 'ได้รับใบสมัครแล้ว' as ApplicationStatus,
    submittedAt: clampStr(record.submittedAt, 64),
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
      presentAddress: clampStr(p.presentAddress, 500),
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
        if (!response.ok || !result.application) {
          throw new Error(result.error || 'เกิดข้อผิดพลาดในการบันทึกใบสมัคร');
        }
        serverRecord = result.application;
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

  // Persist Forms 1-5 to Firebase Firestore (`nurse_register` + atomic `nurse_register_status` + `files` subcollection)
  const sourceDocsById = new Map((formData.documents || []).map((d) => [d.id, d]));

  if (db) {
    const firestoreData = buildSanitizedFirestoreRecord(record);
    const mobileHash = await computeMobileHash(
      firestoreData.applicationId,
      firestoreData.personalInfo.mobileNumber
    );

    const registerPath = `${NURSE_REGISTER_COLLECTION}/${firestoreData.applicationId}`;
    const statusPath = `${NURSE_REGISTER_STATUS_COLLECTION}/${firestoreData.applicationId}`;

    try {
      const mainBatch = writeBatch(db);
      mainBatch.set(doc(db, NURSE_REGISTER_COLLECTION, firestoreData.applicationId), {
        ...firestoreData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      mainBatch.set(doc(db, NURSE_REGISTER_STATUS_COLLECTION, firestoreData.applicationId), {
        applicationId: firestoreData.applicationId,
        status: firestoreData.status,
        submittedAt: firestoreData.submittedAt,
        mobileHash,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await mainBatch.commit();

      const CHUNK_SIZE = 700_000;
      const MAX_BATCH_CHARS = 1_500_000;
      const fileWrites: Array<{
        docId: string;
        payload: {
          id: string;
          applicationId: string;
          slotKey: string;
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          dataUrl: string;
          chunkIndex: number;
          chunkCount: number;
          createdAt: ReturnType<typeof serverTimestamp>;
        };
      }> = [];

      for (const cleanDoc of firestoreData.documents) {
        const safeDocId = cleanDoc.id.replace(/[^a-zA-Z0-9_-]/g, '-');
        const originalDoc = sourceDocsById.get(cleanDoc.id);
        const dataUrl = originalDoc?.dataUrl;
        if (dataUrl && dataUrl.startsWith('data:') && safeDocId) {
          const chunkCount = Math.max(1, Math.ceil(dataUrl.length / CHUNK_SIZE));
          for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
            const slice = dataUrl.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
            const chunkDocId = chunkIndex === 0 ? safeDocId : `${safeDocId}__c${chunkIndex}`;
            fileWrites.push({
              docId: chunkDocId,
              payload: {
                id: chunkDocId,
                applicationId: firestoreData.applicationId,
                slotKey: cleanDoc.slotKey,
                fileName: cleanDoc.fileName,
                mimeType: cleanDoc.mimeType,
                sizeBytes: cleanDoc.sizeBytes,
                dataUrl: slice,
                chunkIndex,
                chunkCount,
                createdAt: serverTimestamp(),
              },
            });
          }
        }
      }

      if (fileWrites.length > 0) {
        let currentBatch = writeBatch(db);
        let currentBatchChars = 0;
        let currentBatchCount = 0;

        for (const item of fileWrites) {
          const itemChars = item.payload.dataUrl.length;
          if (
            currentBatchCount > 0 &&
            (currentBatchChars + itemChars > MAX_BATCH_CHARS || currentBatchCount >= 2)
          ) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            currentBatchChars = 0;
            currentBatchCount = 0;
          }
          currentBatch.set(
            doc(db, NURSE_REGISTER_COLLECTION, firestoreData.applicationId, 'files', item.docId),
            item.payload
          );
          currentBatchChars += itemChars;
          currentBatchCount += 1;
        }

        if (currentBatchCount > 0) {
          await currentBatch.commit();
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${registerPath} & ${statusPath}`);
    }
  }

  const recordWithLocalData: SubmittedApplicationRecord = {
    ...record,
    documents: record.documents.map((d) => {
      const original = sourceDocsById.get(d.id);
      return original?.dataUrl && !d.dataUrl ? { ...d, dataUrl: original.dataUrl } : d;
    }),
  };

  // Persist full PDF/PNG payloads locally in IndexedDB so large attachments remain readable
  await saveSubmittedFilesToIdb(record.applicationId, recordWithLocalData.documents);

  const deduped = existing.filter((r) => r.applicationId !== record.applicationId);
  writeLocalRecords([recordWithLocalData, ...deduped]);
  return record;
}

export async function attachMissingApplicationFileApi(
  applicationId: string,
  fileDoc: UploadedDocumentItem,
  dataUrl: string,
  mimeType: string,
  sizeBytes: number
): Promise<void> {
  const safeDocId = fileDoc.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!safeDocId || !dataUrl.startsWith('data:')) {
    throw new Error('ไฟล์ไม่ถูกต้อง');
  }

  // Always persist in IndexedDB so preview/print works immediately in this browser
  await saveSingleSubmittedFileToIdb(
    applicationId,
    fileDoc.id,
    dataUrl,
    mimeType || fileDoc.mimeType
  );

  // Also persist chunked file to Firestore when HR admin is signed into Firebase
  if (!db || !auth?.currentUser || !auth.currentUser.emailVerified) {
    return;
  }
  const firestoreDb = db;

  const CHUNK_SIZE = 700_000;
  const MAX_BATCH_CHARS = 1_500_000;
  const chunkCount = Math.max(1, Math.ceil(dataUrl.length / CHUNK_SIZE));
  const filePath = `${NURSE_REGISTER_COLLECTION}/${applicationId}/files/${safeDocId}`;

  try {
    let currentBatch = writeBatch(firestoreDb);
    let currentBatchChars = 0;
    let currentBatchCount = 0;

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const slice = dataUrl.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
      const chunkDocId = chunkIndex === 0 ? safeDocId : `${safeDocId}__c${chunkIndex}`;
      if (
        currentBatchCount > 0 &&
        (currentBatchChars + slice.length > MAX_BATCH_CHARS || currentBatchCount >= 2)
      ) {
        await currentBatch.commit();
        currentBatch = writeBatch(firestoreDb);
        currentBatchChars = 0;
        currentBatchCount = 0;
      }
      currentBatch.set(
        doc(firestoreDb, NURSE_REGISTER_COLLECTION, applicationId, 'files', chunkDocId),
        {
          id: chunkDocId,
          applicationId,
          slotKey: clampStr(fileDoc.slotKey, 40) || 'other',
          fileName: clampStr(fileDoc.fileName, 255) || 'document',
          mimeType: clampStr(mimeType || fileDoc.mimeType, 100) || 'application/octet-stream',
          sizeBytes: Math.max(0, Math.min(15_000_000, sizeBytes || fileDoc.sizeBytes || 0)),
          dataUrl: slice,
          chunkIndex,
          chunkCount,
          createdAt: serverTimestamp(),
        }
      );
      currentBatchChars += slice.length;
      currentBatchCount += 1;
    }

    if (currentBatchCount > 0) {
      await currentBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, filePath);
  }
}

export async function trackApplicationApi(
  code: string,
  phone: string
): Promise<TrackedApplicationResult> {
  const cleanCode = code.trim().toUpperCase();
  const cleanPhone = phone.replace(/[\s-]/g, '');

  // Check Firestore non-PII status projection first so HR cloud updates reflect immediately
  let firestoreStatus: {
    applicationId: string;
    status: ApplicationStatus;
    submittedAt: string;
    mobileHash: string;
    hrNote?: string;
  } | null = null;

  const statusPath = `${NURSE_REGISTER_STATUS_COLLECTION}/${cleanCode}`;
  if (db) {
    try {
      const snap = await getDoc(doc(db, NURSE_REGISTER_STATUS_COLLECTION, cleanCode));
      if (snap.exists()) {
        const data = snap.data() as {
          applicationId: string;
          status: ApplicationStatus;
          submittedAt: string;
          mobileHash: string;
          hrNote?: string;
        };
        const expectedHash = await computeMobileHash(cleanCode, cleanPhone);
        if (data.mobileHash === expectedHash) {
          firestoreStatus = data;
        } else {
          throw new Error('ไม่พบข้อมูลใบสมัครที่ตรงกับเลขที่ใบสมัครและเบอร์โทรศัพท์นี้');
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'ไม่พบข้อมูลใบสมัครที่ตรงกับเลขที่ใบสมัครและเบอร์โทรศัพท์นี้'
      ) {
        throw error;
      }
      handleFirestoreError(error, OperationType.GET, statusPath);
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
          return firestoreStatus
            ? {
                ...data.application,
                status: firestoreStatus.status,
                hrNote: firestoreStatus.hrNote ?? data.application.hrNote,
              }
            : data.application;
        }
        if (!firestoreStatus && res.status !== 404) {
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

  const local = readLocalRecords();
  const localMatch = local.find(
    (item) =>
      item.applicationId.toUpperCase() === cleanCode &&
      item.personalInfo.mobileNumber.replace(/[\s-]/g, '') === cleanPhone
  );

  if (localMatch) {
    return firestoreStatus
      ? {
          ...localMatch,
          status: firestoreStatus.status,
          hrNote: firestoreStatus.hrNote ?? localMatch.hrNote,
        }
      : localMatch;
  }

  if (firestoreStatus) {
    return {
      applicationId: firestoreStatus.applicationId,
      status: firestoreStatus.status,
      submittedAt: firestoreStatus.submittedAt,
      hrNote: firestoreStatus.hrNote,
      statusOnly: true,
    };
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

export function isVerifiedBootstrappedAdmin(
  email: string | null | undefined,
  emailVerified: boolean | undefined
): boolean {
  return Boolean(
    emailVerified && email && email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  );
}

export async function checkFirestoreHrAdmin(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean | undefined
): Promise<boolean> {
  if (!emailVerified) return false;
  if (isVerifiedBootstrappedAdmin(email, emailVerified)) return true;
  if (!db) return false;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    return adminSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `admins/${uid}`);
  }
}

export function subscribeNurseRegistrations(
  onData: (records: SubmittedApplicationRecord[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, NURSE_REGISTER_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const records: SubmittedApplicationRecord[] = snapshot.docs.map((d) => {
        const raw = d.data() as SubmittedApplicationRecord;
        return {
          ...raw,
          applicationId: raw.applicationId || d.id,
        };
      });
      onData(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, NURSE_REGISTER_COLLECTION);
    }
  );
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
    // Ignore local Express miss when operating purely on Firestore
  }

  // Also persist status + hrNote to Firestore if HR admin is signed into Firebase Auth
  if (db && auth?.currentUser && auth.currentUser.emailVerified) {
    const path = `${NURSE_REGISTER_COLLECTION}/${applicationId}`;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, NURSE_REGISTER_COLLECTION, applicationId), {
        status,
        hrNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, NURSE_REGISTER_STATUS_COLLECTION, applicationId), {
        status,
        hrNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
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
      // Fall through to IndexedDB / Firestore lookup
    }
  }

  // 3. Local IndexedDB cache (full-size PDF/PNG payloads preserved even without Firestore)
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

  // 4. Firestore `/nurse_register/{applicationId}/files/{docId}` subcollection (supports chunked files)
  if (db && auth?.currentUser && auth.currentUser.emailVerified) {
    const firestoreDb = db;
    const safeDocId = fileDoc.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filePath = `${NURSE_REGISTER_COLLECTION}/${applicationId}/files/${safeDocId}`;
    try {
      const snap = await getDoc(
        doc(firestoreDb, NURSE_REGISTER_COLLECTION, applicationId, 'files', safeDocId)
      );
      if (snap.exists()) {
        const stored = snap.data() as {
          dataUrl?: string;
          mimeType?: string;
          chunkCount?: number;
        };
        if (stored.dataUrl) {
          let fullDataUrl = stored.dataUrl;
          const totalChunks = typeof stored.chunkCount === 'number' ? stored.chunkCount : 1;
          if (totalChunks > 1) {
            const chunkSnaps = await Promise.all(
              Array.from({ length: totalChunks - 1 }, (_, idx) =>
                getDoc(
                  doc(
                    firestoreDb,
                    NURSE_REGISTER_COLLECTION,
                    applicationId,
                    'files',
                    `${safeDocId}__c${idx + 1}`
                  )
                )
              )
            );
            let missingChunk = false;
            for (const cSnap of chunkSnaps) {
              if (!cSnap.exists()) {
                missingChunk = true;
                break;
              }
              const cData = cSnap.data() as { dataUrl?: string };
              if (!cData.dataUrl) {
                missingChunk = true;
                break;
              }
              fullDataUrl += cData.dataUrl;
            }
            if (missingChunk) {
              fullDataUrl = '';
            }
          }

          if (fullDataUrl) {
            const blob = dataUrlToBlob(fullDataUrl);
            if (blob) {
              void saveSingleSubmittedFileToIdb(
                applicationId,
                fileDoc.id,
                fullDataUrl,
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
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, filePath);
    }
  }

  // 4. LocalStorage fallback by applicationId + docId
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
  // 1. Delete from Express backend when available
  try {
    await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Ignore local Express miss on static hosting
  }

  // 2. Delete from Firestore (`files` subcollection + `nurse_register` + `nurse_register_status`)
  if (db && auth?.currentUser && auth.currentUser.emailVerified) {
    const fileIds = new Set(
      docIds.map((id) => id.replace(/[^a-zA-Z0-9_-]/g, '-')).filter(Boolean)
    );

    if (isVerifiedBootstrappedAdmin(auth.currentUser.email, auth.currentUser.emailVerified)) {
      try {
        const filesSnap = await getDocs(
          collection(db, NURSE_REGISTER_COLLECTION, applicationId, 'files')
        );
        filesSnap.forEach((fileDoc) => {
          fileIds.add(fileDoc.id);
        });
      } catch {
        // Fallback to deleting known docIds if subcollection list fails
      }
    }

    const deletePath = `${NURSE_REGISTER_COLLECTION}/${applicationId}`;
    try {
      const batch = writeBatch(db);
      for (const fileId of fileIds) {
        batch.delete(doc(db, NURSE_REGISTER_COLLECTION, applicationId, 'files', fileId));
      }
      batch.delete(doc(db, NURSE_REGISTER_COLLECTION, applicationId));
      batch.delete(doc(db, NURSE_REGISTER_STATUS_COLLECTION, applicationId));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, deletePath);
    }
  }

  // 3. Remove from localStorage & IndexedDB cache
  await deleteSubmittedFilesFromIdb(applicationId, docIds);
  const records = readLocalRecords();
  writeLocalRecords(records.filter((r) => r.applicationId !== applicationId));
}

export async function verifyHrPinApi(pin: string): Promise<boolean> {
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
    return Boolean(res.ok && data.ok);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message !== 'STATIC_HOST_FALLBACK' &&
      !err.message.includes('Failed to fetch')
    ) {
      return false;
    }
    const fallbackPin = (import.meta.env.VITE_HR_PIN as string | undefined) || '2910';
    return pin === fallbackPin;
  }
}
