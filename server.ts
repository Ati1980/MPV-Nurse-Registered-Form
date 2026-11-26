import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ApplicationFormData,
  ApplicationStatus,
  SubmittedApplicationRecord,
  UploadedDocumentItem,
} from './src/types/application.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'applications.json');

function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readApplications(): SubmittedApplicationRecord[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeApplications(records: SubmittedApplicationRecord[]): void {
  ensureStorage();
  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

function sanitizeSegment(input: string): string {
  return path.basename(input).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function saveBase64Document(
  applicationId: string,
  doc: UploadedDocumentItem
): UploadedDocumentItem {
  if (!doc.dataUrl || !doc.dataUrl.startsWith('data:')) {
    return doc;
  }

  const matches = /^data:([^;]+);base64,(.+)$/.exec(doc.dataUrl);
  if (!matches) {
    return doc;
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const appUploadDir = path.join(UPLOADS_DIR, sanitizeSegment(applicationId));
  if (!fs.existsSync(appUploadDir)) {
    fs.mkdirSync(appUploadDir, { recursive: true });
  }

  const extMap: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const fallbackExt = extMap[mimeType] || '';
  const safeName = sanitizeSegment(doc.fileName || `${doc.slotKey}${fallbackExt}`);
  const storedFileName = `${doc.slotKey}_${Date.now()}_${safeName}`;
  const fullPath = path.join(appUploadDir, storedFileName);

  fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));

  return {
    id: doc.id,
    slotKey: doc.slotKey,
    slotLabel: doc.slotLabel,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.uploadedAt,
    fileUrl: `/api/files/${encodeURIComponent(applicationId)}/${encodeURIComponent(storedFileName)}`,
  };
}

function generateApplicationId(existingCount: number): string {
  const sequence = String(existingCount + 1).padStart(4, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MPV-2570-${sequence}-${randomSuffix}`;
}

async function startServer(): Promise<void> {
  ensureStorage();
  const app = express();

  app.use(express.json({ limit: '35mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'mpv-nurse-recruitment-2570' });
  });

  app.post('/api/hr/verify-pin', (req, res) => {
    const { pin } = (req.body || {}) as { pin?: string };
    const expectedPin = process.env.HR_PIN || '2910';
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      res.status(400).json({ ok: false, error: 'กรุณากรอกรหัส PIN 4 หลัก' });
      return;
    }
    if (pin !== expectedPin) {
      res.status(401).json({ ok: false, error: 'รหัส PIN ไม่ถูกต้อง' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/files/:applicationId/:fileName', (req, res) => {
    const safeAppId = sanitizeSegment(req.params.applicationId);
    const safeFileName = sanitizeSegment(req.params.fileName);
    const targetPath = path.join(UPLOADS_DIR, safeAppId, safeFileName);

    if (!targetPath.startsWith(UPLOADS_DIR) || !fs.existsSync(targetPath)) {
      res.status(404).json({ error: 'ไม่พบไฟล์เอกสารที่ร้องขอ' });
      return;
    }

    res.sendFile(targetPath);
  });

  app.post('/api/applications', (req, res) => {
    const payload = req.body as Partial<ApplicationFormData>;
    if (!payload || !payload.personalInfo || !payload.emergencyContact) {
      res.status(400).json({ error: 'ข้อมูลใบสมัครไม่ครบถ้วน กรุณาตรวจสอบอีกครั้ง' });
      return;
    }

    if (
      !payload.personalInfo.fullNameTh?.trim() ||
      !payload.personalInfo.mobileNumber?.trim() ||
      !payload.personalInfo.email?.trim()
    ) {
      res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล เบอร์มือถือ และอีเมลให้ครบถ้วน' });
      return;
    }

    const existing = readApplications();
    const applicationId = generateApplicationId(existing.length);
    const submittedAt = new Date().toISOString();

    const storedDocuments: UploadedDocumentItem[] = Array.isArray(payload.documents)
      ? payload.documents.map((doc) => saveBase64Document(applicationId, doc))
      : [];

    const record: SubmittedApplicationRecord = {
      personalInfo: payload.personalInfo,
      hasNoWorkExperience: Boolean(payload.hasNoWorkExperience),
      workExperiences: Array.isArray(payload.workExperiences) ? payload.workExperiences : [],
      educationBackground: Array.isArray(payload.educationBackground)
        ? payload.educationBackground
        : [],
      nursingQualification: payload.nursingQualification ?? {
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
      emergencyContact: payload.emergencyContact,
      documents: storedDocuments,
      pdpaAccepted: Boolean(payload.pdpaAccepted),
      truthfulnessAccepted: Boolean(payload.truthfulnessAccepted),
      applicationId,
      submittedAt,
      status: 'ได้รับใบสมัครแล้ว',
    };

    existing.unshift(record);
    writeApplications(existing);

    res.status(201).json({
      success: true,
      applicationId,
      submittedAt,
      application: record,
    });
  });

  app.get('/api/applications/track', (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    const phone = String(req.query.phone || '').replace(/[\s-]/g, '');

    if (!code || !phone) {
      res.status(400).json({ error: 'กรุณาระบุเลขที่ใบสมัครและเบอร์โทรศัพท์มือถือ' });
      return;
    }

    const records = readApplications();
    const found = records.find((item) => {
      const itemPhone = item.personalInfo.mobileNumber.replace(/[\s-]/g, '');
      return item.applicationId.toUpperCase() === code && itemPhone === phone;
    });

    if (!found) {
      res.status(404).json({
        error: 'ไม่พบข้อมูลใบสมัครที่ตรงกับเลขที่ใบสมัครและเบอร์โทรศัพท์นี้',
      });
      return;
    }

    res.json({ application: found });
  });

  app.get('/api/applications', (_req, res) => {
    const records = readApplications();
    res.json({ applications: records });
  });

  app.patch('/api/applications/:id/status', (req, res) => {
    const targetId = req.params.id;
    const { status, hrNote } = req.body as {
      status?: ApplicationStatus;
      hrNote?: string;
    };

    const allowedStatuses: ApplicationStatus[] = [
      'ได้รับใบสมัครแล้ว',
      'อยู่ระหว่างตรวจสอบเอกสาร',
      'ผ่านการคัดกรองเบื้องต้น',
      'นัดหมายสัมภาษณ์',
    ];

    if (!status || !allowedStatuses.includes(status)) {
      res.status(400).json({ error: 'สถานะใบสมัครไม่ถูกต้อง' });
      return;
    }

    const records = readApplications();
    const index = records.findIndex((r) => r.applicationId === targetId);
    if (index === -1) {
      res.status(404).json({ error: 'ไม่พบใบสมัครที่ระบุ' });
      return;
    }

    records[index] = {
      ...records[index],
      status,
      hrNote: typeof hrNote === 'string' ? hrNote : records[index].hrNote,
    };

    writeApplications(records);
    res.json({ application: records[index] });
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve('dist'));
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mitr Phuviang Nurse Recruitment Server running on http://0.0.0.0:${PORT}`);
  });

  // Prevent reverse-proxy / pre-warmer keep-alive race ECONNRESET
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
