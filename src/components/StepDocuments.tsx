import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';
import { Eye, FileText, Loader2, Trash2, UploadCloud, X } from 'lucide-react';
import type {
  DocumentSlotKey,
  UploadedDocumentItem,
  ValidationErrors,
} from '../types/application.ts';
import { DOCUMENT_SLOTS, formatBytes } from '../utils/applicationHelpers.ts';
import { renderPdfBlobToImageUrls } from '../utils/pdfRenderHelper.ts';

interface StepDocumentsProps {
  documents: UploadedDocumentItem[];
  truthfulnessAccepted: boolean;
  pdpaAccepted: boolean;
  errors: ValidationErrors;
  onChangeDocuments: (docs: UploadedDocumentItem[]) => void;
  onChangeConsent: (field: 'truthfulnessAccepted' | 'pdpaAccepted', value: boolean) => void;
}

export function StepDocuments({
  documents,
  truthfulnessAccepted,
  pdpaAccepted,
  errors,
  onChangeDocuments,
  onChangeConsent,
}: StepDocumentsProps) {
  const [uploadAlert, setUploadAlert] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<DocumentSlotKey | null>(null);
  const [previewDoc, setPreviewDoc] = useState<UploadedDocumentItem | null>(null);
  const [previewPdfPages, setPreviewPdfPages] = useState<string[]>([]);
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);

  useEffect(() => {
    if (!previewDoc || previewDoc.mimeType.startsWith('image/')) {
      setPreviewPdfPages([]);
      setPreviewPdfLoading(false);
      return;
    }
    const src = previewDoc.dataUrl || previewDoc.fileUrl;
    if (!src) {
      setPreviewPdfPages([]);
      setPreviewPdfLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewPdfLoading(true);
    setPreviewPdfPages([]);
    void renderPdfBlobToImageUrls(src)
      .then((pages) => {
        if (!cancelled) {
          setPreviewPdfPages(pages);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewPdfPages([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewPdfLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewDoc]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
      reader.readAsDataURL(file);
    });

  const compressImageIfNeeded = async (
    file: File,
    rawDataUrl: string
  ): Promise<{ dataUrl: string; mimeType: string; sizeBytes: number }> => {
    if (!file.type.startsWith('image/') || rawDataUrl.length <= 340_000) {
      return { dataUrl: rawDataUrl, mimeType: file.type, sizeBytes: file.size };
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: rawDataUrl, mimeType: file.type, sizeBytes: file.size });
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let compressed = canvas.toDataURL('image/jpeg', 0.8);
        if (compressed.length > 750_000) {
          compressed = canvas.toDataURL('image/jpeg', 0.62);
        }
        const approxBytes = Math.round((compressed.length * 3) / 4);
        resolve({
          dataUrl: compressed,
          mimeType: 'image/jpeg',
          sizeBytes: Math.min(file.size, approxBytes),
        });
      };
      img.onerror = () => {
        resolve({ dataUrl: rawDataUrl, mimeType: file.type, sizeBytes: file.size });
      };
      img.src = rawDataUrl;
    });
  };

  const handleFilesForSlot = async (slotKey: DocumentSlotKey, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadAlert(null);

    const spec = DOCUMENT_SLOTS.find((s) => s.key === slotKey);
    if (!spec) return;

    const acceptedTypes = spec.accept.split(',');
    const maxBytes = spec.maxSizeMb * 1024 * 1024;
    const filesArray = spec.allowMultiple ? Array.from(fileList) : [fileList[0]];

    const newDocs: UploadedDocumentItem[] = [];

    for (const file of filesArray) {
      if (!acceptedTypes.includes(file.type)) {
        setUploadAlert(
          `ไฟล์ "${file.name}" ไม่รองรับรูปแบบนี้ กรุณาอัปโหลดเฉพาะ ${
            slotKey === 'photo' ? 'รูปภาพ JPG หรือ PNG' : 'ไฟล์ PDF, JPG หรือ PNG'
          }`
        );
        continue;
      }
      if (file.size > maxBytes) {
        setUploadAlert(
          `ไฟล์ "${file.name}" มีขนาดใหญ่เกิน ${spec.maxSizeMb} MB กรุณาย่อขนาดไฟล์ก่อนอัปโหลด`
        );
        continue;
      }

      try {
        const rawDataUrl = await readFileAsDataUrl(file);
        const processed = await compressImageIfNeeded(file, rawDataUrl);
        newDocs.push({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          slotKey,
          slotLabel: spec.title,
          fileName: file.name,
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          dataUrl: processed.dataUrl,
          uploadedAt: new Date().toISOString(),
        });
      } catch {
        setUploadAlert(`เกิดข้อผิดพลาดในการอ่านไฟล์ "${file.name}"`);
      }
    }

    if (newDocs.length === 0) return;

    if (spec.allowMultiple) {
      onChangeDocuments([...documents, ...newDocs]);
    } else {
      const remaining = documents.filter((d) => d.slotKey !== slotKey);
      onChangeDocuments([...remaining, ...newDocs]);
    }
  };

  const handleFileInput = (slotKey: DocumentSlotKey, e: ChangeEvent<HTMLInputElement>) => {
    void handleFilesForSlot(slotKey, e.target.files);
    e.target.value = '';
  };

  const handleDrop = (slotKey: DocumentSlotKey, e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOverSlot(null);
    void handleFilesForSlot(slotKey, e.dataTransfer.files);
  };

  const handleRemoveDoc = (docId: string) => {
    onChangeDocuments(documents.filter((d) => d.id !== docId));
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-teal-900/10 pb-4">
        <h2 className="font-display text-xl font-semibold text-teal-950 sm:text-2xl">
          3. แนบเอกสารประกอบการสมัครออนไลน์ (Document Attachments)
        </h2>
        <p className="mt-1 text-sm text-teal-900/75">
          กรุณาอัปโหลดไฟล์เอกสารที่ชัดเจนและครบถ้วน รองรับการลากไฟล์มาวางหรือเลือกไฟล์จากมือถือ/คอมพิวเตอร์
        </p>
      </div>

      {uploadAlert && (
        <div
          role="alert"
          className="animate-error-shake flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          <span>{uploadAlert}</span>
          <button
            type="button"
            onClick={() => setUploadAlert(null)}
            className="min-h-[32px] min-w-[32px] rounded-lg p-1 hover:bg-rose-100 cursor-pointer"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DOCUMENT_SLOTS.map((slot) => {
          const slotDocs = documents.filter((d) => d.slotKey === slot.key);
          const slotError = errors[`doc.${slot.key}`];
          const isDragOver = dragOverSlot === slot.key;

          return (
            <div
              key={slot.key}
              className={`interactive-card flex flex-col justify-between rounded-2xl border p-4 sm:p-5 ${
                slotError
                  ? 'border-rose-300 bg-rose-50/50'
                  : slotDocs.length > 0
                  ? 'border-teal-700/30 bg-white/80'
                  : 'border-teal-900/12 bg-white/65'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-teal-950">
                      {slot.title}
                      {slot.required && <span className="ml-1 text-rose-600">*</span>}
                    </h3>
                    <p className="mt-1 text-xs text-teal-900/75 leading-relaxed">
                      {slot.subtitle}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-teal-800 shrink-0">
                    {slotDocs.length > 0
                      ? `แนบแล้ว ${slotDocs.length} ไฟล์`
                      : slot.required
                      ? 'จำเป็น'
                      : 'เพิ่มเติม'}
                  </span>
                </div>

                {/* Attached Files List */}
                {slotDocs.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {slotDocs.map((doc) => {
                      const isImage = doc.mimeType.startsWith('image/');
                      const previewSrc = doc.dataUrl || doc.fileUrl;
                      return (
                        <li
                          key={doc.id}
                          className="animate-fade-scale flex items-center justify-between gap-2.5 rounded-xl border border-teal-900/10 bg-white px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {isImage && previewSrc ? (
                              <img
                                src={previewSrc}
                                alt={doc.fileName}
                                referrerPolicy="no-referrer"
                                className="h-10 w-10 shrink-0 rounded-lg object-cover border border-teal-900/10"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-900/5 text-teal-800">
                                <FileText className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-teal-950">
                                {doc.fileName}
                              </p>
                              <p className="text-[11px] text-teal-900/65 tabular-nums">
                                {formatBytes(doc.sizeBytes)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              aria-label={`ดูตัวอย่าง ${doc.fileName}`}
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-teal-800 hover:bg-teal-900/5 cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDoc(doc.id)}
                              aria-label={`ลบ ${doc.fileName}`}
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-rose-700 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverSlot(slot.key);
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(e) => handleDrop(slot.key, e)}
                  className={`flex min-h-[64px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-3 py-3 text-center transition-all duration-200 ${
                    isDragOver
                      ? 'scale-[1.015] border-teal-700 bg-teal-100/70 shadow-sm'
                      : 'border-teal-800/30 bg-white/60 hover:border-teal-700/60 hover:bg-white'
                  }`}
                >
                  <UploadCloud
                    className={`h-5 w-5 text-teal-700 transition-transform duration-200 ${
                      isDragOver ? 'animate-bounce text-teal-800' : ''
                    }`}
                  />
                  <span className="mt-1 text-xs font-medium text-teal-950">
                    {slotDocs.length > 0 && !slot.allowMultiple
                      ? 'คลิกหรือลากไฟล์มาวางเพื่อเปลี่ยนไฟล์'
                      : slot.allowMultiple
                      ? 'คลิกหรือลากไฟล์มาวาง (เลือกได้หลายไฟล์)'
                      : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่'}
                  </span>
                  <span className="mt-0.5 text-[11px] text-teal-900/65">
                    สูงสุด {slot.maxSizeMb} MB ·{' '}
                    {slot.key === 'photo' ? 'JPG, PNG' : 'PDF, JPG, PNG'}
                  </span>
                  <input
                    type="file"
                    accept={slot.accept}
                    multiple={slot.allowMultiple}
                    onChange={(e) => handleFileInput(slot.key, e)}
                    className="sr-only"
                  />
                </label>

                {slotError && (
                  <p className="mt-1.5 text-xs font-medium text-rose-700">{slotError}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Consent & Truthfulness Declaration */}
      <div className="space-y-3 rounded-2xl border border-teal-900/12 bg-white/75 p-5">
        <h3 className="font-display text-base font-semibold text-teal-950">
          การรับรองความถูกต้องและความยินยอม (Declaration & PDPA Consent)
        </h3>

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-teal-950">
          <input
            type="checkbox"
            checked={truthfulnessAccepted}
            onChange={(e) => onChangeConsent('truthfulnessAccepted', e.target.checked)}
            className="mt-1 h-4 w-4 rounded accent-teal-800 shrink-0"
          />
          <span>
            ข้าพเจ้าขอรับรองว่าข้อมูลและเอกสารทั้งหมดที่ระบุและแนบในใบสมัครนี้เป็นความจริงทุกประการ
            หากบริษัทฯ ตรวจพบว่ามีข้อความอันเป็นเท็จ ยินยอมให้บริษัทฯ พิจารณาเพิกถอนสิทธิการสมัครหรือเลิกจ้างได้ทันที
          </span>
        </label>
        {errors['truthfulnessAccepted'] && (
          <p className="text-xs font-medium text-rose-700">{errors['truthfulnessAccepted']}</p>
        )}

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-teal-950">
          <input
            type="checkbox"
            checked={pdpaAccepted}
            onChange={(e) => onChangeConsent('pdpaAccepted', e.target.checked)}
            className="mt-1 h-4 w-4 rounded accent-teal-800 shrink-0"
          />
          <span>
            ข้าพเจ้ายินยอมให้โรงงานน้ำตาลมิตรภูเวียงและกลุ่มมิตรผล เก็บรวบรวม ใช้
            และตรวจสอบข้อมูลส่วนบุคคล รวมถึงเอกสารประกอบการสมัครงานเพื่อประโยชน์ในการสรรหาและคัดเลือกบุคลากร
            ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
          </span>
        </label>
        {errors['pdpaAccepted'] && (
          <p className="text-xs font-medium text-rose-700">{errors['pdpaAccepted']}</p>
        )}
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`ตัวอย่างเอกสาร ${previewDoc.fileName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-teal-950/60 p-4 backdrop-blur-sm"
        >
          <div className="animate-fade-scale flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-teal-900/10 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-teal-950">{previewDoc.fileName}</p>
                <p className="text-xs text-teal-900/65">{previewDoc.slotLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label="ปิดหน้าต่างตัวอย่าง"
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-teal-900 hover:bg-teal-900/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col items-center overflow-auto bg-slate-100 p-4">
              {previewDoc.mimeType.startsWith('image/') ? (
                <img
                  src={previewDoc.dataUrl || previewDoc.fileUrl}
                  alt={previewDoc.fileName}
                  referrerPolicy="no-referrer"
                  className="my-auto max-h-[72vh] w-auto rounded-lg object-contain shadow"
                />
              ) : previewPdfLoading ? (
                <div className="my-auto flex flex-col items-center gap-2 py-12 text-sm text-teal-900/75">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
                  <span>กำลังเปิดไฟล์ PDF...</span>
                </div>
              ) : previewPdfPages.length > 0 ? (
                <div className="flex w-full flex-col items-center gap-4">
                  {previewPdfPages.map((pageUrl, pageIdx) => (
                    <div key={pageIdx} className="w-full max-w-2xl">
                      {previewPdfPages.length > 1 && (
                        <p className="mb-1 text-center text-xs font-medium text-teal-900/70">
                          หน้า {pageIdx + 1} / {previewPdfPages.length}
                        </p>
                      )}
                      <img
                        src={pageUrl}
                        alt={`${previewDoc.fileName} หน้า ${pageIdx + 1}`}
                        className="mx-auto w-full rounded-lg border border-slate-200 bg-white shadow"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <iframe
                  src={previewDoc.dataUrl || previewDoc.fileUrl}
                  title={previewDoc.fileName}
                  className="h-[72vh] w-full rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
