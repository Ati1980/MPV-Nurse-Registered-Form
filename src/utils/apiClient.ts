import type {
  ApplicationFormData,
  ApplicationStatus,
  SubmittedApplicationRecord,
} from '../types/application.ts';

const FALLBACK_STORAGE_KEY = 'mpv_nurse_2570_submitted_records_v1';

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
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota issues on fallback
  }
}

export async function submitApplicationApi(
  formData: ApplicationFormData
): Promise<SubmittedApplicationRecord> {
  try {
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (response.status === 404 || response.status === 405) {
      throw new Error('STATIC_HOST_FALLBACK');
    }

    const result = (await response.json()) as {
      application?: SubmittedApplicationRecord;
      error?: string;
    };

    if (!response.ok || !result.application) {
      throw new Error(result.error || 'เกิดข้อผิดพลาดในการบันทึกใบสมัคร');
    }

    return result.application;
  } catch (err) {
    if (err instanceof Error && err.message !== 'STATIC_HOST_FALLBACK') {
      // If it was a real validation error from the backend, rethrow it
      if (!err.message.includes('Failed to fetch')) {
        throw err;
      }
    }

    // Static hosting fallback (e.g., static Vercel deployment without Node backend)
    const existing = readLocalRecords();
    const seq = String(existing.length + 1).padStart(4, '0');
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    const record: SubmittedApplicationRecord = {
      ...formData,
      applicationId: `MPV-2570-${seq}-${rand}`,
      submittedAt: new Date().toISOString(),
      status: 'ได้รับใบสมัครแล้ว',
    };
    writeLocalRecords([record, ...existing]);
    return record;
  }
}

export async function trackApplicationApi(
  code: string,
  phone: string
): Promise<SubmittedApplicationRecord> {
  const cleanCode = code.trim().toUpperCase();
  const cleanPhone = phone.replace(/[\s-]/g, '');

  try {
    const params = new URLSearchParams({ code: cleanCode, phone: cleanPhone });
    const res = await fetch(`/api/applications/track?${params.toString()}`);

    if (res.status === 404) {
      // Distinguish Express JSON 404 ("ไม่พบข้อมูลใบสมัคร...") vs static host HTML 404
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('STATIC_HOST_FALLBACK');
      }
    } else if (res.status === 405) {
      throw new Error('STATIC_HOST_FALLBACK');
    }

    const data = (await res.json()) as {
      application?: SubmittedApplicationRecord;
      error?: string;
    };

    if (!res.ok || !data.application) {
      throw new Error(data.error || 'ไม่พบข้อมูลใบสมัครที่ตรงกัน');
    }

    return data.application;
  } catch (err) {
    if (err instanceof Error && err.message !== 'STATIC_HOST_FALLBACK') {
      if (!err.message.includes('Failed to fetch')) {
        throw err;
      }
    }

    const local = readLocalRecords();
    const found = local.find(
      (item) =>
        item.applicationId.toUpperCase() === cleanCode &&
        item.personalInfo.mobileNumber.replace(/[\s-]/g, '') === cleanPhone
    );
    if (!found) {
      throw new Error('ไม่พบข้อมูลใบสมัครที่ตรงกับเลขที่ใบสมัครและเบอร์โทรศัพท์นี้');
    }
    return found;
  }
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

export async function updateApplicationStatusApi(
  applicationId: string,
  status: ApplicationStatus,
  hrNote: string
): Promise<SubmittedApplicationRecord | null> {
  try {
    const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, hrNote }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
      throw new Error('STATIC_HOST_FALLBACK');
    }
    const data = (await res.json()) as { application?: SubmittedApplicationRecord };
    return res.ok ? data.application ?? null : null;
  } catch {
    const records = readLocalRecords();
    const idx = records.findIndex((r) => r.applicationId === applicationId);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], status, hrNote };
    writeLocalRecords(records);
    return records[idx];
  }
}
