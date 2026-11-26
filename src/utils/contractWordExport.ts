import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ContractFields, FieldStylesMap } from '../components/ContractPrintModal.tsx';
import type { DocumentSlotKey } from '../types/application.ts';

export interface WordAttachmentItem {
  slotKey: DocumentSlotKey;
  label: string;
  fileName?: string;
  status: 'loading' | 'ready' | 'missing' | 'unavailable';
  imageUrls: string[];
}

const CONTRACT_FONT = {
  ascii: 'DilleniaUPC',
  hAnsi: 'DilleniaUPC',
  cs: 'DilleniaUPC',
  eastAsia: 'DilleniaUPC',
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function plainRun(text: string, opts?: { bold?: boolean; sizePt?: number }): TextRun {
  const sizeHalfPoints = (opts?.sizePt ?? 16) * 2;
  return new TextRun({
    text,
    font: CONTRACT_FONT,
    size: sizeHalfPoints,
    bold: opts?.bold ?? false,
    color: '000000',
  });
}

function fieldRun(
  key: keyof ContractFields,
  fields: ContractFields,
  fieldStyles: FieldStylesMap
): TextRun {
  const value = fields[key] || '....................';
  const style = fieldStyles[key];
  return plainRun(value, {
    bold: style?.bold ?? false,
    sizePt: style?.sizePt ?? 16,
  });
}

function bodyParagraph(
  children: TextRun[],
  opts?: { indentFirstLineMm?: number; spacingAfterPt?: number; leftIndentMm?: number }
): Paragraph {
  const indent: { firstLine?: number; left?: number } = {};
  if (opts?.indentFirstLineMm) {
    indent.firstLine = convertMillimetersToTwip(opts.indentFirstLineMm);
  }
  if (opts?.leftIndentMm) {
    indent.left = convertMillimetersToTwip(opts.leftIndentMm);
  }
  return new Paragraph({
    alignment: AlignmentType.THAI_DISTRIBUTE,
    indent: Object.keys(indent).length > 0 ? indent : undefined,
    spacing: {
      before: 0,
      after: (opts?.spacingAfterPt ?? 4) * 20,
      line: 276,
    },
    children,
  });
}

async function loadImageAsPngBytes(
  src: string,
  maxWidthPx: number,
  maxHeightPx: number
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const naturalW = img.naturalWidth || 800;
      const naturalH = img.naturalHeight || 1000;
      const scale = Math.min(maxWidthPx / naturalW, maxHeightPx / naturalH, 1);
      const displayW = Math.max(1, Math.round(naturalW * scale));
      const displayH = Math.max(1, Math.round(naturalH * scale));

      const canvas = document.createElement('canvas');
      // Render at high resolution while storing display width/height for Word
      const renderScale = Math.min(1600 / naturalW, 2000 / naturalH, 1);
      canvas.width = Math.max(1, Math.round(naturalW * renderScale));
      canvas.height = Math.max(1, Math.round(naturalH * renderScale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const buffer = await blob.arrayBuffer();
          resolve({
            data: new Uint8Array(buffer),
            width: displayW,
            height: displayH,
          });
        },
        'image/png',
        0.92
      );
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function buildContractSetChildren(
  label: 'ต้นฉบับ' | 'สำเนา',
  fields: ContractFields,
  fieldStyles: FieldStylesMap,
  pageBreakBefore: boolean
): Array<Paragraph | Table> {
  const items: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      pageBreakBefore,
      spacing: { after: 60 },
      children: [plainRun(label, { bold: true, sizePt: 16 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [plainRun('หนังสือสัญญาว่าจ้างพยาบาลวิชาชีพ (Part-Time)', { bold: true, sizePt: 16 })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      children: [plainRun('ทำ ที่ '), fieldRun('location', fields, fieldStyles)],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      children: [plainRun('วันที่ '), fieldRun('contractDate', fields, fieldStyles)],
    }),
    bodyParagraph(
      [
        plainRun('หนังสือสัญญาว่าจ้างนี้ทำขึ้นระหว่าง '),
        fieldRun('companyName', fields, fieldStyles),
        plainRun(' โดย '),
        fieldRun('authorizedPerson', fields, fieldStyles),
        plainRun(' ตำแหน่ง '),
        fieldRun('authorizedPosition', fields, fieldStyles),
        plainRun(' เป็นผู้รับมอบอำนาจกระทำการแทน บริษัทฯ ซึ่งต่อไปนี้เรียกว่า “บริษัทฯ” ฝ่ายหนึ่ง กับ '),
        fieldRun('contractorName', fields, fieldStyles),
        plainRun(' เลขบัตรประชาชน '),
        fieldRun('contractorIdCard', fields, fieldStyles),
        plainRun(' '),
        fieldRun('contractorAddress', fields, fieldStyles),
        plainRun(' ซึ่งต่อไปนี้เรียกว่า “ผู้รับจ้าง” อีกฝ่ายหนึ่ง ทั้งสองฝ่ายได้ทำสัญญาต่อกันตามรายละเอียดดังต่อไปนี้'),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun('ข้อ 1. บริษัทฯ ตกลงว่าจ้างผู้รับจ้าง และ “ผู้รับจ้าง” ตกลงรับจ้างที่จะปฏิบัติงานด้านวิชาชีพพยาบาล โดยมาปฏิบัติงาน ณ '),
        fieldRun('workplaceAddress', fields, fieldStyles),
        plainRun(' รวมทั้งให้คำแนะนำเกี่ยวกับเรื่องสุขภาพอนามัยและสาธารณสุขทั่วไปแก่พนักงานของ “บริษัทฯ” ตั้งแต่วันที่ '),
        fieldRun('startDate', fields, fieldStyles),
        plainRun(' ถึงวันที่ '),
        fieldRun('endDate', fields, fieldStyles),
        plainRun(' โดยจะได้รับค่าจ้างตามตารางเวลาที่ “บริษัทฯ” กำหนดดังต่อไปนี้'),
      ],
      { indentFirstLineMm: 12, spacingAfterPt: 2 }
    ),
    bodyParagraph(
      [
        plainRun('1.1 เวรเช้า ปฏิบัติงาน เวลา '),
        fieldRun('morningTime', fields, fieldStyles),
        plainRun(' อัตราค่าบริการ '),
        fieldRun('morningRate', fields, fieldStyles),
        plainRun(' บาทต่อวัน ('),
        fieldRun('morningRateText', fields, fieldStyles),
        plainRun(')'),
      ],
      { leftIndentMm: 18, spacingAfterPt: 1 }
    ),
    bodyParagraph(
      [
        plainRun('1.2 เวรบ่าย ปฏิบัติงาน เวลา '),
        fieldRun('afternoonTime', fields, fieldStyles),
        plainRun(' อัตราค่าบริการ '),
        fieldRun('afternoonRate', fields, fieldStyles),
        plainRun(' บาทต่อวัน ('),
        fieldRun('afternoonRateText', fields, fieldStyles),
        plainRun(')'),
      ],
      { leftIndentMm: 18, spacingAfterPt: 1 }
    ),
    bodyParagraph(
      [
        plainRun('1.3 เวรดึก ปฏิบัติงาน เวลา '),
        fieldRun('nightTime', fields, fieldStyles),
        plainRun(' อัตราค่าบริการ '),
        fieldRun('nightRate', fields, fieldStyles),
        plainRun(' บาทต่อวัน ('),
        fieldRun('nightRateText', fields, fieldStyles),
        plainRun(')'),
      ],
      { leftIndentMm: 18, spacingAfterPt: 2 }
    ),
    bodyParagraph(
      [
        plainRun('บริษัทฯ จะจ่ายเงินให้แก่ “ผู้รับจ้าง” เดือนละ 1 ครั้ง โดยค่าบริการตั้งแต่วันที่ 1 ถึง สิ้นเดือน จะจ่ายให้ในวันที่ '),
        fieldRun('payDay', fields, fieldStyles),
        plainRun(' ของเดือนถัดไป'),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 2. ในระหว่างสัญญา “ผู้รับจ้าง” ได้รับรองแล้วว่าตนเป็นผู้มีความรู้ความสามารถในวิชาชีพของตน ซึ่งได้รับรองกับบริษัทฯ แล้ว ตามเอกสารรับรองใบประกอบวิชาชีพพยาบาล ที่ได้ส่งให้กับบริษัทฯ เพื่อแนบไว้เป็นหลักฐานคู่กับสัญญาฉบับนี้'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 3. “ผู้รับจ้าง” จะต้องปฏิบัติหน้าที่ ดูแลให้คำแนะนำการจัดสถานที่ห้องพยาบาลให้เป็นระเบียบเรียบร้อยถูกสุขลักษณะตามมาตรฐานของสถานพยาบาล พร้อมจัดทำบันทึกประวัติคนไข้และบันทึกในสมุดควบคุมเกี่ยวกับคุณภาพของอุปกรณ์, ตรวจสอบวันหมดอายุยา, การป้องกันการแพร่กระจายเชื้อและป้องกันการติดเชื้อ การนำขยะติดเชื้อที่เกิดจากการรักษาพยาบาลไปกำจัดที่โรงพยาบาล การจัดทำรายงานเกี่ยวกับสถิติการมาใช้บริการ ณ ห้องพยาบาลของพนักงานของบริษัทฯ ให้กับตัวแทนของบริษัทฯ ทราบทุกๆ เดือน โดยแยกเป็นการเจ็บป่วยอันเนื่องมาจากการทำงาน และการเจ็บป่วยอันไม่เนื่องมาจากการทำงาน รวมทั้งการวิเคราะห์สาเหตุและให้คำแนะนำแก่บริษัทฯ ประกอบการรายงานด้วย นอกจากนี้ บริษัทฯ อาจให้ผู้รับจ้างจัดอบรมให้ความรู้เกี่ยวกับการดูแลสุขภาพหรือการป้องกันโรคอันเกิดขึ้นเนื่องจากการทำงานหรือโรคที่เกิดขึ้นอันไม่เนื่องจากการทำงานให้กับพนักงานของบริษัทฯ ด้วย'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 4. “ผู้รับจ้าง” ต้องแจ้งรายการคงเหลือของเวชภัณฑ์หรืออุปกรณ์ประจำห้องพยาบาลให้แก่ “บริษัทฯ” ทราบเป็นรายเดือน เพื่อให้บริษัทฯ จัดซื้ออุปกรณ์เวชภัณฑ์ให้เพียงพอแก่การใช้งาน'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 5. ในระหว่างสัญญา หาก “ผู้รับจ้าง” ไม่ปฏิบัติไปตามรายละเอียดงานใน ข้อ 1. ถึงข้อ 4. หรือละเลยต่อหน้าที่ตาม ข้อ 1. ถึงข้อ 4. ซึ่ง “ผู้รับจ้าง” ยอมรับให้ถือว่าเป็นส่วนหนึ่งของเงื่อนไขการจ้าง และ “ผู้รับจ้าง” ได้อ่านและทำความเข้าใจแล้วก่อนเซ็นสัญญาจ้าง “บริษัทฯ” จะถือว่า “ผู้รับจ้าง” ขาดคุณสมบัติในการปฏิบัติหน้าที่และ “บริษัทฯ” สามารถให้สัญญาฉบับนี้สิ้นสุดลงได้โดยทันที'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 6. ในกรณีที่ “ผู้รับจ้าง” ไม่สามารถมาปฏิบัติหน้าที่ตามสัญญานี้ได้ ไม่ว่ากรณีใดก็ตาม “ผู้รับจ้าง” ตกลงจะติดต่อกับพยาบาลในทีมที่มีสัญญากับ “บริษัทฯ” ให้มาปฏิบัติงานแทนพร้อมกับแจ้งให้บริษัทฯ ทราบก่อนล่วงหน้าอย่างน้อย 1 ชั่วโมง'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 7. ในระหว่างปฏิบัติหน้าที่ “ผู้รับจ้าง” จะต้องเชื่อฟังคำสั่งและรายงานผลการทำงานต่อตัวแทนของบริษัทฯ ซึ่ง “บริษัทฯ” ได้กำหนดไว้แล้วว่าเป็นผู้กำกับ ควบคุม ดูแล การปฏิบัติงานของ “ผู้รับจ้าง”'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 8. “ผู้รับจ้าง” จะต้องปฏิบัติตามกฎ ข้อบังคับ ระเบียบ หรือประกาศที่เกี่ยวกับการทำงาน ความปลอดภัยในการทำงานการเข้า-ออกพื้นที่ของบริษัทฯ และการรักษาความปลอดภัยที่ “บริษัทฯ” ได้กำหนดไว้แล้วและที่จะกำหนดต่อไปในภายหน้าอย่างเคร่งครัด'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 9. “ผู้รับจ้าง” ตกลงยินยอมที่จะให้ “บริษัทฯ” เปลี่ยนแปลงเวลาทำงาน เวลาพักได้ตามความเหมาะสม โดยขึ้นอยู่กับนโยบายของ “บริษัทฯ” ซึ่งจะประกาศหรือแจ้งให้ทราบล่วงหน้า'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 10. “ผู้รับจ้าง” ตกลงยินยอมในการรักษาข้อมูลอันเป็นความลับทางธุรกิจของบริษัทฯ ไม่เผยแพร่ข้อมูลใดๆ ทั้งด้วยวาจาหรือเอกสารให้กับบุคคลภายนอกหรือบุคคลอื่นที่ไม่เกี่ยวข้องทราบ เว้นแต่ได้รับอนุญาตจากบริษัทฯ เป็นหนังสือ ความลับทางธุรกิจให้หมายถึง ข้อมูลเกี่ยวกับสูตรหรือกระบวนการผลิต ข้อมูลทางการเงินและบัญชี, แผนการตลาด หรือการดำเนินธุรกิจ, ค่าจ้าง และปัญหาภายในองค์กรเป็นต้น ในกรณีที่ “ผู้รับจ้าง” ไม่แน่ใจว่าสิ่งใดเป็นข้อมูลอันเป็นความลับทางธุรกิจหรือไม่ ให้ “ผู้รับจ้าง” สอบถามและต้องได้รับอนุญาตจากบริษัทฯ ก่อน การรักษาความลับทางธุรกิจนี้ “ผู้รับจ้าง” สัญญาว่าจะรักษาไว้เป็นความลับไม่ว่า “ผู้รับจ้าง” จะพ้นสภาพการจ้างไปแล้วหรือไม่ก็ตาม'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 11. “ผู้รับจ้าง” จะต้องไม่กระทำการใด ๆ หรือมีส่วนร่วมหรือรับรู้ในการนำสิ่งที่ขัดต่อกฎหมายอันเป็นการละเมิดลิขสิทธิ์ของผู้อื่นตามที่บัญญัติไว้ในพระราชบัญญัติลิขสิทธิ์เข้ามาใช้ในกิจการของบริษัทฯ หรือฝ่าฝืนพระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ หรือกฎหมายใดๆ ที่เกี่ยวข้อง หากผู้รับจ้างละเมิดสัญญานี้และก่อให้เกิดความเสียหายแก่บริษัทฯ ผู้รับจ้างจะต้องรับผิดชอบทั้งทางแพ่งและอาญา รวมทั้งชดใช้ความเสียหายนั้นๆ'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 12. งานสร้างสรรค์ใด ๆ ซึ่ง “ผู้รับจ้าง” ได้กระทำขึ้นโดยใช้เวลา สถานที่ บุคลากร วัสดุอุปกรณ์ หรือสิ่งอื่นใดของบริษัทฯ ให้ถือเป็นกรรมสิทธิ์ของบริษัทฯ ที่บริษัทฯ จะนำไปเผยแพร่หรือดำเนินการอย่างใดก็ได้ ไม่ว่า “ผู้รับจ้าง” จะพ้นสภาพการจ้างไปแล้วหรือไม่ก็ตาม'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 13. “ผู้รับจ้าง” ทราบและเข้าใจระเบียบข้อบังคับเกี่ยวกับการทำงานของบริษัทฯ รวมถึงข้อกำหนดจริยธรรมในการทำงาน การตรวจสอบภายในและประกาศเรื่องแนวปฏิบัติในกรณีพบเห็นการทุจริตหรือประพฤติตนเสื่อมเสีย ซึ่งเป็นส่วนหนึ่งของสัญญาจ้างฉบับนี้ และ “ผู้รับจ้าง” ตกลงยินยอมปฏิบัติตามระเบียบข้อบังคับเกี่ยวกับการทำงานของบริษัทฯ หรือประกาศ หรือคำสั่งอันชอบด้วยกฎหมายที่ใช้บังคับอยู่ของบริษัทฯ รวมทั้งที่จะได้ประกาศเพิ่มเติมในโอกาสต่อไปอย่างเคร่งครัด'
        ),
      ],
      { indentFirstLineMm: 12 }
    ),
    bodyParagraph(
      [
        plainRun(
          'ข้อ 14. ในกรณีที่ “ผู้รับจ้าง” ผิดสัญญาข้อหนึ่งข้อใดหรือไม่สามารถปฏิบัติงานได้ตามที่ “บริษัทฯ” กำหนด หรือได้มีการว่ากล่าวตักเตือนแล้วครบ 2 ครั้งโดยขึ้นอยู่กับดุลยพินิจของ “บริษัทฯ” “บริษัทฯ” มีสิทธิบอกเลิกสัญญานี้ได้ทันที'
        ),
      ],
      { indentFirstLineMm: 12, spacingAfterPt: 8 }
    ),
    bodyParagraph(
      [
        plainRun(
          'สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับ ข้อความถูกต้องตรงกัน โดยยึดถือไว้ฝ่ายละฉบับ ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความของสัญญาฉบับนี้เป็นอย่างดีแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐาน'
        ),
      ],
      { indentFirstLineMm: 12, spacingAfterPt: 20 }
    ),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 60 },
                  children: [plainRun('ลงชื่อ..........................ผู้รับมอบอำนาจของบริษัทฯ')],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 360 },
                  children: [
                    plainRun('('),
                    fieldRun('authorizedPerson', fields, fieldStyles),
                    plainRun(')'),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 60 },
                  children: [plainRun('ลงชื่อ..............................ผู้รับจ้าง')],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 360 },
                  children: [
                    plainRun('('),
                    fieldRun('contractorName', fields, fieldStyles),
                    plainRun(')'),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 60 },
                  children: [plainRun('ลงชื่อ..............................พยาน')],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    plainRun('('),
                    fieldRun('witness1', fields, fieldStyles),
                    plainRun(')'),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 60 },
                  children: [plainRun('ลงชื่อ..............................พยาน')],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    plainRun('('),
                    fieldRun('witness2', fields, fieldStyles),
                    plainRun(')'),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  return items;
}

export async function exportContractToWordDocx(params: {
  fields: ContractFields;
  fieldStyles: FieldStylesMap;
  applicationId: string;
  includeCopy: boolean;
  includeAttachments: boolean;
  attachments: WordAttachmentItem[];
}): Promise<void> {
  const { fields, fieldStyles, applicationId, includeCopy, includeAttachments, attachments } =
    params;

  const children: Array<Paragraph | Table> = [
    ...buildContractSetChildren('ต้นฉบับ', fields, fieldStyles, false),
  ];

  if (includeCopy) {
    children.push(...buildContractSetChildren('สำเนา', fields, fieldStyles, true));
  }

  if (includeAttachments) {
    for (let idx = 0; idx < attachments.length; idx++) {
      const item = attachments[idx];
      if (item.status === 'ready' && item.imageUrls.length > 0) {
        for (let pageIdx = 0; pageIdx < item.imageUrls.length; pageIdx++) {
          const url = item.imageUrls[pageIdx];
          const pageSuffix =
            item.imageUrls.length > 1 ? ` (หน้า ${pageIdx + 1}/${item.imageUrls.length})` : '';
          children.push(
            new Paragraph({
              pageBreakBefore: true,
              spacing: { after: 120 },
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
              },
              children: [
                plainRun(`เอกสารแนบแผ่นที่ ${idx + 1} : ${item.label}${pageSuffix}`, {
                  bold: true,
                  sizePt: 16,
                }),
                plainRun(`   (ผู้รับจ้าง: ${fields.contractorName} · ${applicationId})`, {
                  sizePt: 14,
                }),
              ],
            })
          );

          const loaded = await loadImageAsPngBytes(url, 620, 840);
          if (loaded) {
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [
                  new ImageRun({
                    type: 'png',
                    data: loaded.data,
                    transformation: {
                      width: loaded.width,
                      height: loaded.height,
                    },
                  }),
                ],
              })
            );
          }
        }
      } else {
        children.push(
          new Paragraph({
            pageBreakBefore: true,
            spacing: { after: 120 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
            },
            children: [
              plainRun(`เอกสารแนบแผ่นที่ ${idx + 1} : ${item.label}`, { bold: true, sizePt: 16 }),
              plainRun(`   (ผู้รับจ้าง: ${fields.contractorName} · ${applicationId})`, {
                sizePt: 14,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
            children: [
              plainRun(
                item.status === 'missing'
                  ? 'ผู้สมัครยังไม่ได้แนบเอกสารรายการนี้'
                  : `ไม่พบไฟล์เอกสารต้นฉบับในระบบ${item.fileName ? ` (${item.fileName})` : ''}`,
                { sizePt: 16 }
              ),
            ],
          })
        );
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: CONTRACT_FONT,
            size: 32,
            color: '000000',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(18),
              bottom: convertMillimetersToTwip(18),
              left: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const safeName = (fields.contractorName || applicationId).replace(/[\\/:*?"<>|]/g, '_').trim();
  const link = document.createElement('a');
  link.href = url;
  link.download = `หนังสือสัญญาว่าจ้าง_${safeName}_${applicationId}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
