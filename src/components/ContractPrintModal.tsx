import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, RotateCcw, X } from 'lucide-react';
import type { DocumentSlotKey, SubmittedApplicationRecord } from '../types/application.ts';
import { resolveApplicationFileApi } from '../utils/apiClient.ts';
import { renderPdfBlobToImageUrls } from '../utils/pdfRenderHelper.ts';

const CONTRACT_ATTACHMENT_SLOTS: Array<{
  slotKey: DocumentSlotKey;
  label: string;
}> = [
  { slotKey: 'idCard', label: 'สำเนาบัตรประจำตัวประชาชน' },
  { slotKey: 'houseReg', label: 'สำเนาทะเบียนบ้าน' },
  { slotKey: 'nursingLicense', label: 'สำเนาใบอนุญาตประกอบวิชาชีพการพยาบาลฯ' },
  { slotKey: 'bankBook', label: 'สำเนาสมุดบัญชีธนาคาร' },
];

interface ResolvedContractAttachment {
  slotKey: DocumentSlotKey;
  label: string;
  fileName?: string;
  status: 'loading' | 'ready' | 'missing' | 'unavailable';
  imageUrls: string[];
}

export interface ContractFields {
  location: string;
  contractDate: string;
  companyName: string;
  authorizedPerson: string;
  authorizedPosition: string;
  contractorName: string;
  contractorIdCard: string;
  contractorAddress: string;
  workplaceAddress: string;
  startDate: string;
  endDate: string;
  morningTime: string;
  morningRate: string;
  morningRateText: string;
  afternoonTime: string;
  afternoonRate: string;
  afternoonRateText: string;
  nightTime: string;
  nightRate: string;
  nightRateText: string;
  payDay: string;
  witness1: string;
  witness2: string;
}

function buildInitialContractFields(app: SubmittedApplicationRecord): ContractFields {
  const cleanTitle = app.personalInfo.title.replace(/\s*\([^)]*\)/g, '').trim();
  const fullName = `${cleanTitle}${app.personalInfo.fullNameTh}`.trim();
  const rawAddress = (app.personalInfo.permanentAddress || app.personalInfo.presentAddress || '').trim();
  const formattedAddress =
    rawAddress && !rawAddress.startsWith('บ้านเลขที่') && !rawAddress.startsWith('ที่อยู่')
      ? `บ้านเลขที่ ${rawAddress}`
      : rawAddress;

  return {
    location: 'บริษัท รวมเกษตรกรอุตสาหกรรม จำกัด สาขามิตรภูเวียง',
    contractDate: '1 มกราคม 2570',
    companyName: 'บริษัท รวมเกษตรกรอุตสาหกรรม จำกัด สาขามิตรภูเวียง',
    authorizedPerson: 'นายภิมะ วิจิตรเฉลิมพงษ์',
    authorizedPosition: 'ผู้อำนวยการด้านโรงงานน้ำตาลมิตรภูเวียง',
    contractorName: fullName || '-',
    contractorIdCard: app.personalInfo.idCardOrPassport || '-',
    contractorAddress: formattedAddress || '-',
    workplaceAddress:
      'ห้องพยาบาล โรงงานน้ำตาลมิตรภูเวียง ซึ่งตั้งอยู่เลขที่ 365 หมู่ที่ 1 ตำบลหนองเรือ อำเภอหนองเรือ จังหวัดขอนแก่น',
    startDate: '1 มกราคม 2570',
    endDate: '31 ธันวาคม 2570',
    morningTime: '08.30 - 16.30 น.',
    morningRate: '900',
    morningRateText: 'เก้าร้อยบาทถ้วน',
    afternoonTime: '16.30 - 24.30 น.',
    afternoonRate: '950',
    afternoonRateText: 'เก้าร้อยห้าสิบบาทถ้วน',
    nightTime: '24.30 - 08.30 น.',
    nightRate: '1,000',
    nightRateText: 'หนึ่งพันบาทถ้วน',
    payDay: '25',
    witness1: 'นางสาวพิรุณพร พุ่มไสว',
    witness2: 'นางสาวสุพัตรา ติยะภา',
  };
}

interface ContractDocumentSetProps {
  label: 'ต้นฉบับ' | 'สำเนา';
  fields: ContractFields;
}

function EditableSpan({ value }: { value: string }) {
  return (
    <span className="rounded bg-amber-100/80 px-1 py-0.5 font-semibold text-slate-950 print:bg-transparent print:px-0 print:py-0 print:font-normal">
      {value || '....................'}
    </span>
  );
}

function ContractDocumentSet({ label, fields }: ContractDocumentSetProps) {
  return (
    <article className="font-contract text-[19px] leading-[1.45] text-black">
      {/* Top-right stamp */}
      <div className="flex justify-end text-[21px] font-bold">{label}</div>

      {/* Title */}
      <h2 className="mt-1 text-center text-[22px] font-bold">
        หนังสือสัญญาว่าจ้างพยาบาลวิชาชีพ (Part-Time)
      </h2>

      {/* Location & Date */}
      <div className="mt-2 flex flex-col items-end text-[19px]">
        <p>
          ทำ ที่ <EditableSpan value={fields.location} />
        </p>
        <p>
          วันที่ <EditableSpan value={fields.contractDate} />
        </p>
      </div>

      {/* Preamble */}
      <p className="mt-3 text-justify indent-10">
        หนังสือสัญญาว่าจ้างนี้ทำขึ้นระหว่าง <EditableSpan value={fields.companyName} /> โดย{' '}
        <EditableSpan value={fields.authorizedPerson} /> ตำแหน่ง{' '}
        <EditableSpan value={fields.authorizedPosition} /> เป็นผู้รับมอบอำนาจกระทำการแทน บริษัทฯ
        ซึ่งต่อไปนี้เรียกว่า “บริษัทฯ” ฝ่ายหนึ่ง กับ <EditableSpan value={fields.contractorName} />{' '}
        เลขบัตรประชาชน <EditableSpan value={fields.contractorIdCard} />{' '}
        <EditableSpan value={fields.contractorAddress} /> ซึ่งต่อไปนี้เรียกว่า “ผู้รับจ้าง” อีกฝ่ายหนึ่ง
        ทั้งสองฝ่ายได้ทำสัญญาต่อกันตามรายละเอียดดังต่อไปนี้
      </p>

      {/* Clause 1 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 1. บริษัทฯ ตกลงว่าจ้างผู้รับจ้าง และ “ผู้รับจ้าง” ตกลงรับจ้างที่จะปฏิบัติงานด้านวิชาชีพพยาบาล
        โดยมาปฏิบัติงาน ณ <EditableSpan value={fields.workplaceAddress} />{' '}
        รวมทั้งให้คำแนะนำเกี่ยวกับเรื่องสุขภาพอนามัยและสาธารณสุขทั่วไปแก่พนักงานของ “บริษัทฯ” ตั้งแต่วันที่{' '}
        <EditableSpan value={fields.startDate} /> ถึงวันที่ <EditableSpan value={fields.endDate} />{' '}
        โดยจะได้รับค่าจ้างตามตารางเวลาที่ “บริษัทฯ” กำหนดดังต่อไปนี้
      </p>

      <div className="mt-0.5 space-y-0.5 pl-14">
        <p>
          1.1 เวรเช้า ปฏิบัติงาน เวลา <EditableSpan value={fields.morningTime} /> อัตราค่าบริการ{' '}
          <EditableSpan value={fields.morningRate} /> บาทต่อวัน (
          <EditableSpan value={fields.morningRateText} />)
        </p>
        <p>
          1.2 เวรบ่าย ปฏิบัติงาน เวลา <EditableSpan value={fields.afternoonTime} /> อัตราค่าบริการ{' '}
          <EditableSpan value={fields.afternoonRate} /> บาทต่อวัน (
          <EditableSpan value={fields.afternoonRateText} />)
        </p>
        <p>
          1.3 เวรดึก ปฏิบัติงาน เวลา <EditableSpan value={fields.nightTime} /> อัตราค่าบริการ{' '}
          <EditableSpan value={fields.nightRate} /> บาทต่อวัน (
          <EditableSpan value={fields.nightRateText} />)
        </p>
      </div>

      <p className="mt-0.5 text-justify indent-10">
        บริษัทฯ จะจ่ายเงินให้แก่ “ผู้รับจ้าง” เดือนละ 1 ครั้ง โดยค่าบริการตั้งแต่วันที่ 1 ถึง สิ้นเดือน
        จะจ่ายให้ในวันที่ <EditableSpan value={fields.payDay} /> ของเดือนถัดไป
      </p>

      {/* Clause 2 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 2. ในระหว่างสัญญา “ผู้รับจ้าง” ได้รับรองแล้วว่าตนเป็นผู้มีความรู้ความสามารถในวิชาชีพของตน
        ซึ่งได้รับรองกับบริษัทฯ แล้ว ตามเอกสารรับรองใบประกอบวิชาชีพพยาบาล ที่ได้ส่งให้กับบริษัทฯ
        เพื่อแนบไว้เป็นหลักฐานคู่กับสัญญาฉบับนี้
      </p>

      {/* Clause 3 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 3. “ผู้รับจ้าง” จะต้องปฏิบัติหน้าที่ ดูแลให้คำแนะนำการจัดสถานที่ห้องพยาบาลให้เป็นระเบียบเรียบร้อยถูกสุขลักษณะตามมาตรฐานของสถานพยาบาล
        พร้อมจัดทำบันทึกประวัติคนไข้และบันทึกในสมุดควบคุมเกี่ยวกับคุณภาพของอุปกรณ์, ตรวจสอบวันหมดอายุยา,
        การป้องกันการแพร่กระจายเชื้อและป้องกันการติดเชื้อ การนำขยะติดเชื้อที่เกิดจากการรักษาพยาบาลไปกำจัดที่โรงพยาบาล
        การจัดทำรายงานเกี่ยวกับสถิติการมาใช้บริการ ณ ห้องพยาบาลของพนักงานของบริษัทฯ ให้กับตัวแทนของบริษัทฯ
        ทราบทุกๆ เดือน โดยแยกเป็นการเจ็บป่วยอันเนื่องมาจากการทำงาน และการเจ็บป่วยอันไม่เนื่องมาจากการทำงาน
        รวมทั้งการวิเคราะห์สาเหตุและให้คำแนะนำแก่บริษัทฯ ประกอบการรายงานด้วย นอกจากนี้ บริษัทฯ
        อาจให้ผู้รับจ้างจัดอบรมให้ความรู้เกี่ยวกับการดูแลสุขภาพหรือการป้องกันโรคอันเกิดขึ้นเนื่องจากการทำงานหรือโรคที่เกิดขึ้นอันไม่เนื่องจากการทำงานให้กับพนักงานของบริษัทฯ
        ด้วย
      </p>

      {/* Clause 4 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 4. “ผู้รับจ้าง” ต้องแจ้งรายการคงเหลือของเวชภัณฑ์หรืออุปกรณ์ประจำห้องพยาบาลให้แก่ “บริษัทฯ”
        ทราบเป็นรายเดือน เพื่อให้บริษัทฯ จัดซื้ออุปกรณ์เวชภัณฑ์ให้เพียงพอแก่การใช้งาน
      </p>

      {/* Clause 5 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 5. ในระหว่างสัญญา หาก “ผู้รับจ้าง” ไม่ปฏิบัติไปตามรายละเอียดงานใน ข้อ 1. ถึงข้อ 4. หรือละเลยต่อหน้าที่ตาม ข้อ 1. ถึงข้อ 4.
        ซึ่ง “ผู้รับจ้าง” ยอมรับให้ถือว่าเป็นส่วนหนึ่งของเงื่อนไขการจ้าง และ “ผู้รับจ้าง” ได้อ่านและทำความเข้าใจแล้วก่อนเซ็นสัญญาจ้าง
        “บริษัทฯ” จะถือว่า “ผู้รับจ้าง” ขาดคุณสมบัติในการปฏิบัติหน้าที่และ “บริษัทฯ” สามารถให้สัญญาฉบับนี้สิ้นสุดลงได้โดยทันที
      </p>

      {/* Clause 6 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 6. ในกรณีที่ “ผู้รับจ้าง” ไม่สามารถมาปฏิบัติหน้าที่ตามสัญญานี้ได้ ไม่ว่ากรณีใดก็ตาม “ผู้รับจ้าง”
        ตกลงจะติดต่อกับพยาบาลในทีมที่มีสัญญากับ “บริษัทฯ” ให้มาปฏิบัติงานแทนพร้อมกับแจ้งให้บริษัทฯ ทราบก่อนล่วงหน้าอย่างน้อย 1 ชั่วโมง
      </p>

      {/* Clause 7 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 7. ในระหว่างปฏิบัติหน้าที่ “ผู้รับจ้าง” จะต้องเชื่อฟังคำสั่งและรายงานผลการทำงานต่อตัวแทนของบริษัทฯ
        ซึ่ง “บริษัทฯ” ได้กำหนดไว้แล้วว่าเป็นผู้กำกับ ควบคุม ดูแล การปฏิบัติงานของ “ผู้รับจ้าง”
      </p>

      {/* Clause 8 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 8. “ผู้รับจ้าง” จะต้องปฏิบัติตามกฎ ข้อบังคับ ระเบียบ หรือประกาศที่เกี่ยวกับการทำงาน
        ความปลอดภัยในการทำงานการเข้า-ออกพื้นที่ของบริษัทฯ และการรักษาความปลอดภัยที่ “บริษัทฯ”
        ได้กำหนดไว้แล้วและที่จะกำหนดต่อไปในภายหน้าอย่างเคร่งครัด
      </p>

      {/* Clause 9 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 9. “ผู้รับจ้าง” ตกลงยินยอมที่จะให้ “บริษัทฯ” เปลี่ยนแปลงเวลาทำงาน เวลาพักได้ตามความเหมาะสม
        โดยขึ้นอยู่กับนโยบายของ “บริษัทฯ” ซึ่งจะประกาศหรือแจ้งให้ทราบล่วงหน้า
      </p>

      {/* Clause 10 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 10. “ผู้รับจ้าง” ตกลงยินยอมในการรักษาข้อมูลอันเป็นความลับทางธุรกิจของบริษัทฯ ไม่เผยแพร่ข้อมูลใดๆ
        ทั้งด้วยวาจาหรือเอกสารให้กับบุคคลภายนอกหรือบุคคลอื่นที่ไม่เกี่ยวข้องทราบ เว้นแต่ได้รับอนุญาตจากบริษัทฯ เป็นหนังสือ
        ความลับทางธุรกิจให้หมายถึง ข้อมูลเกี่ยวกับสูตรหรือกระบวนการผลิต ข้อมูลทางการเงินและบัญชี,
        แผนการตลาด หรือการดำเนินธุรกิจ, ค่าจ้าง และปัญหาภายในองค์กรเป็นต้น ในกรณีที่ “ผู้รับจ้าง”
        ไม่แน่ใจว่าสิ่งใดเป็นข้อมูลอันเป็นความลับทางธุรกิจหรือไม่ ให้ “ผู้รับจ้าง” สอบถามและต้องได้รับอนุญาตจากบริษัทฯ ก่อน
        การรักษาความลับทางธุรกิจนี้ “ผู้รับจ้าง” สัญญาว่าจะรักษาไว้เป็นความลับไม่ว่า “ผู้รับจ้าง” จะพ้นสภาพการจ้างไปแล้วหรือไม่ก็ตาม
      </p>

      {/* Clause 11 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 11. “ผู้รับจ้าง” จะต้องไม่กระทำการใด ๆ หรือมีส่วนร่วมหรือรับรู้ในการนำสิ่งที่ขัดต่อกฎหมายอันเป็นการละเมิดลิขสิทธิ์ของผู้อื่นตามที่บัญญัติไว้ในพระราชบัญญัติลิขสิทธิ์เข้ามาใช้ในกิจการของบริษัทฯ
        หรือฝ่าฝืนพระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ หรือกฎหมายใดๆ ที่เกี่ยวข้อง
        หากผู้รับจ้างละเมิดสัญญานี้และก่อให้เกิดความเสียหายแก่บริษัทฯ ผู้รับจ้างจะต้องรับผิดชอบทั้งทางแพ่งและอาญา รวมทั้งชดใช้ความเสียหายนั้นๆ
      </p>

      {/* Clause 12 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 12. งานสร้างสรรค์ใด ๆ ซึ่ง “ผู้รับจ้าง” ได้กระทำขึ้นโดยใช้เวลา สถานที่ บุคลากร วัสดุอุปกรณ์ หรือสิ่งอื่นใดของบริษัทฯ
        ให้ถือเป็นกรรมสิทธิ์ของบริษัทฯ ที่บริษัทฯ จะนำไปเผยแพร่หรือดำเนินการอย่างใดก็ได้ ไม่ว่า “ผู้รับจ้าง” จะพ้นสภาพการจ้างไปแล้วหรือไม่ก็ตาม
      </p>

      {/* Clause 13 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 13. “ผู้รับจ้าง” ทราบและเข้าใจระเบียบข้อบังคับเกี่ยวกับการทำงานของบริษัทฯ รวมถึงข้อกำหนดจริยธรรมในการทำงาน
        การตรวจสอบภายในและประกาศเรื่องแนวปฏิบัติในกรณีพบเห็นการทุจริตหรือประพฤติตนเสื่อมเสีย ซึ่งเป็นส่วนหนึ่งของสัญญาจ้างฉบับนี้
        และ “ผู้รับจ้าง” ตกลงยินยอมปฏิบัติตามระเบียบข้อบังคับเกี่ยวกับการทำงานของบริษัทฯ หรือประกาศ
        หรือคำสั่งอันชอบด้วยกฎหมายที่ใช้บังคับอยู่ของบริษัทฯ รวมทั้งที่จะได้ประกาศเพิ่มเติมในโอกาสต่อไปอย่างเคร่งครัด
      </p>

      {/* Clause 14 */}
      <p className="mt-1 text-justify indent-10">
        ข้อ 14. ในกรณีที่ “ผู้รับจ้าง” ผิดสัญญาข้อหนึ่งข้อใดหรือไม่สามารถปฏิบัติงานได้ตามที่ “บริษัทฯ” กำหนด
        หรือได้มีการว่ากล่าวตักเตือนแล้วครบ 2 ครั้งโดยขึ้นอยู่กับดุลยพินิจของ “บริษัทฯ” “บริษัทฯ” มีสิทธิบอกเลิกสัญญานี้ได้ทันที
      </p>

      {/* Closing & Signatures */}
      <div className="contract-signature-block mt-3">
        <p className="text-justify indent-10">
          สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับ ข้อความถูกต้องตรงกัน โดยยึดถือไว้ฝ่ายละฉบับ
          ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความของสัญญาฉบับนี้เป็นอย่างดีแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐาน
        </p>

        <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-12 text-[19px]">
          <div className="text-center">
            <p>ลงชื่อ..........................................ผู้รับมอบอำนาจของบริษัทฯ</p>
            <p className="mt-1">
              (<EditableSpan value={fields.authorizedPerson} />)
            </p>
          </div>

          <div className="text-center">
            <p>ลงชื่อ.......................................... ผู้รับจ้าง</p>
            <p className="mt-1">
              (<EditableSpan value={fields.contractorName} />)
            </p>
          </div>

          <div className="text-center">
            <p>ลงชื่อ..........................................พยาน</p>
            <p className="mt-1">
              (<EditableSpan value={fields.witness1} />)
            </p>
          </div>

          <div className="text-center">
            <p>ลงชื่อ..........................................พยาน</p>
            <p className="mt-1">
              (<EditableSpan value={fields.witness2} />)
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

interface ContractPrintModalProps {
  open: boolean;
  applicant: SubmittedApplicationRecord;
  onClose: () => void;
}

export function ContractPrintModal({ open, applicant, onClose }: ContractPrintModalProps) {
  const [fields, setFields] = useState<ContractFields>(() => buildInitialContractFields(applicant));
  const [includeCopy, setIncludeCopy] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [attachments, setAttachments] = useState<ResolvedContractAttachment[]>(() =>
    CONTRACT_ATTACHMENT_SLOTS.map((slot) => ({
      slotKey: slot.slotKey,
      label: slot.label,
      status: 'loading',
      imageUrls: [],
    }))
  );
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (open) {
      setFields(buildInitialContractFields(applicant));
    }
  }, [open, applicant]);

  useEffect(() => {
    const revokeAll = () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current = [];
    };

    if (!open || !includeAttachments) {
      revokeAll();
      return;
    }

    let cancelled = false;
    revokeAll();

    setAttachments(
      CONTRACT_ATTACHMENT_SLOTS.map((slot) => ({
        slotKey: slot.slotKey,
        label: slot.label,
        status: 'loading',
        imageUrls: [],
      }))
    );

    const loadAll = async () => {
      const results = await Promise.all(
        CONTRACT_ATTACHMENT_SLOTS.map(async (slot): Promise<ResolvedContractAttachment> => {
          const docItem = applicant.documents.find((d) => d.slotKey === slot.slotKey);
          if (!docItem) {
            return {
              slotKey: slot.slotKey,
              label: slot.label,
              status: 'missing',
              imageUrls: [],
            };
          }

          try {
            const resolved = await resolveApplicationFileApi(applicant.applicationId, docItem);
            if (!resolved) {
              return {
                slotKey: slot.slotKey,
                label: slot.label,
                fileName: docItem.fileName,
                status: 'unavailable',
                imageUrls: [],
              };
            }

            if (cancelled) {
              URL.revokeObjectURL(resolved.objectUrl);
              return {
                slotKey: slot.slotKey,
                label: slot.label,
                fileName: docItem.fileName,
                status: 'unavailable',
                imageUrls: [],
              };
            }

            objectUrlsRef.current.push(resolved.objectUrl);

            const isPdf =
              resolved.mimeType.includes('pdf') ||
              docItem.fileName.toLowerCase().endsWith('.pdf');

            if (isPdf) {
              const pdfPageImages = await renderPdfBlobToImageUrls(resolved.objectUrl, 2);
              if (pdfPageImages.length === 0) {
                return {
                  slotKey: slot.slotKey,
                  label: slot.label,
                  fileName: docItem.fileName,
                  status: 'unavailable',
                  imageUrls: [],
                };
              }
              return {
                slotKey: slot.slotKey,
                label: slot.label,
                fileName: docItem.fileName,
                status: 'ready',
                imageUrls: pdfPageImages,
              };
            }

            return {
              slotKey: slot.slotKey,
              label: slot.label,
              fileName: docItem.fileName,
              status: 'ready',
              imageUrls: [resolved.objectUrl],
            };
          } catch {
            return {
              slotKey: slot.slotKey,
              label: slot.label,
              fileName: docItem.fileName,
              status: 'unavailable',
              imageUrls: [],
            };
          }
        })
      );

      if (!cancelled) {
        setAttachments(results);
      }
    };

    void loadAll();

    return () => {
      cancelled = true;
      revokeAll();
    };
  }, [open, includeAttachments, applicant]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const loadingAttachments =
    includeAttachments && attachments.some((item) => item.status === 'loading');

  const updateField = <K extends keyof ContractFields>(key: K, value: ContractFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-modal-title"
      className="fixed inset-0 z-50 flex flex-col bg-teal-950/60 backdrop-blur-sm print:static print:inset-auto print:block print:h-auto print:overflow-visible print:bg-white print:p-0 print:backdrop-blur-none"
    >
      {/* Top Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-white/20 bg-white/95 px-4 py-3 shadow-sm sm:px-6">
        <div>
          <h2 id="contract-modal-title" className="font-display text-base font-bold text-teal-950 sm:text-lg">
            หนังสือสัญญาว่าจ้างพยาบาลวิชาชีพ (Part-Time) — แก้ไขและพิมพ์สัญญา
          </h2>
          <p className="text-xs text-teal-900/75">
            แก้ไขข้อมูลในช่องด้านซ้ายได้ทันที ข้อความที่แก้ไขจะอัปเดตทั้งชุดต้นฉบับและสำเนาโดยอัตโนมัติ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFields(buildInitialContractFields(applicant))}
            className="btn-lift inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-teal-900/15 bg-white px-3.5 py-2 text-xs font-medium text-teal-950 hover:bg-teal-50 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รีเซ็ตค่าเริ่มต้น</span>
          </button>

          {loadingAttachments && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>กำลังเตรียมไฟล์แนบ 4 แผ่น...</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            disabled={loadingAttachments}
            className="btn-lift inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-900 disabled:opacity-60 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>พิมพ์สัญญา / บันทึก PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างพิมพ์สัญญา"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-teal-900/15 bg-white text-teal-950 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 print:overflow-visible print:p-0">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-12 print:block">
          {/* Left Editable Controls */}
          <aside className="no-print glass-panel h-fit rounded-2xl bg-white/95 p-4 sm:p-5 lg:col-span-4 lg:sticky lg:top-0">
            <h3 className="font-display text-sm font-bold text-teal-950">
              ตำแหน่งที่สามารถแก้ไขได้
            </h3>

            <div className="mt-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-teal-950">วันที่ทำสัญญา</label>
                  <input
                    type="text"
                    value={fields.contractDate}
                    onChange={(e) => updateField('contractDate', e.target.value)}
                    className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-teal-950">วันจ่ายเงิน (ของเดือนถัดไป)</label>
                  <input
                    type="text"
                    value={fields.payDay}
                    onChange={(e) => updateField('payDay', e.target.value)}
                    className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-teal-950">ทำที่ / ชื่อบริษัทฯ</label>
                <input
                  type="text"
                  value={fields.location}
                  onChange={(e) => {
                    updateField('location', e.target.value);
                    updateField('companyName', e.target.value);
                  }}
                  className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-teal-950">ผู้รับมอบอำนาจบริษัทฯ</label>
                  <input
                    type="text"
                    value={fields.authorizedPerson}
                    onChange={(e) => updateField('authorizedPerson', e.target.value)}
                    className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-teal-950">ตำแหน่งผู้รับมอบอำนาจ</label>
                  <input
                    type="text"
                    value={fields.authorizedPosition}
                    onChange={(e) => updateField('authorizedPosition', e.target.value)}
                    className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                  />
                </div>
              </div>

              <div className="border-t border-teal-900/10 pt-3">
                <label className="block font-semibold text-teal-950">ชื่อผู้รับจ้าง</label>
                <input
                  type="text"
                  value={fields.contractorName}
                  onChange={(e) => updateField('contractorName', e.target.value)}
                  className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                />
              </div>

              <div>
                <label className="block font-semibold text-teal-950">เลขบัตรประชาชนผู้รับจ้าง</label>
                <input
                  type="text"
                  value={fields.contractorIdCard}
                  onChange={(e) => updateField('contractorIdCard', e.target.value)}
                  className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 font-mono text-xs text-teal-950"
                />
              </div>

              <div>
                <label className="block font-semibold text-teal-950">ที่อยู่ผู้รับจ้าง</label>
                <textarea
                  rows={2}
                  value={fields.contractorAddress}
                  onChange={(e) => updateField('contractorAddress', e.target.value)}
                  className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 border-t border-teal-900/10 pt-3">
                <div>
                  <label className="block font-semibold text-teal-950">สัญญาเริ่มวันที่</label>
                  <input
                    type="text"
                    value={fields.startDate}
                    onChange={(e) => updateField('startDate', e.target.value)}
                    className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-teal-950">ถึงวันที่</label>
                  <input
                    type="text"
                    value={fields.endDate}
                    onChange={(e) => updateField('endDate', e.target.value)}
                    className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-teal-900/10 pt-3">
                <p className="font-semibold text-teal-950">อัตราค่าบริการ (บาท/วัน & คำอ่าน)</p>
                <div className="grid grid-cols-12 gap-1.5">
                  <input
                    type="text"
                    aria-label="เวลาเวรเช้า"
                    value={fields.morningTime}
                    onChange={(e) => updateField('morningTime', e.target.value)}
                    className="glass-input col-span-5 rounded-lg px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    aria-label="ค่าบริการเวรเช้า"
                    value={fields.morningRate}
                    onChange={(e) => updateField('morningRate', e.target.value)}
                    className="glass-input col-span-3 rounded-lg px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    aria-label="คำอ่านค่าบริการเวรเช้า"
                    value={fields.morningRateText}
                    onChange={(e) => updateField('morningRateText', e.target.value)}
                    className="glass-input col-span-4 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-12 gap-1.5">
                  <input
                    type="text"
                    aria-label="เวลาเวรบ่าย"
                    value={fields.afternoonTime}
                    onChange={(e) => updateField('afternoonTime', e.target.value)}
                    className="glass-input col-span-5 rounded-lg px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    aria-label="ค่าบริการเวรบ่าย"
                    value={fields.afternoonRate}
                    onChange={(e) => updateField('afternoonRate', e.target.value)}
                    className="glass-input col-span-3 rounded-lg px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    aria-label="คำอ่านค่าบริการเวรบ่าย"
                    value={fields.afternoonRateText}
                    onChange={(e) => updateField('afternoonRateText', e.target.value)}
                    className="glass-input col-span-4 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-12 gap-1.5">
                  <input
                    type="text"
                    aria-label="เวลาเวรดึก"
                    value={fields.nightTime}
                    onChange={(e) => updateField('nightTime', e.target.value)}
                    className="glass-input col-span-5 rounded-lg px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    aria-label="ค่าบริการเวรดึก"
                    value={fields.nightRate}
                    onChange={(e) => updateField('nightRate', e.target.value)}
                    className="glass-input col-span-3 rounded-lg px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    aria-label="คำอ่านค่าบริการเวรดึก"
                    value={fields.nightRateText}
                    onChange={(e) => updateField('nightRateText', e.target.value)}
                    className="glass-input col-span-4 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 border-t border-teal-900/10 pt-3">
                <div>
                  <label className="block font-semibold text-teal-950">พยานคนที่ 1</label>
                  <input
                    type="text"
                    value={fields.witness1}
                    onChange={(e) => updateField('witness1', e.target.value)}
                    className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-teal-950">พยานคนที่ 2</label>
                  <input
                    type="text"
                    value={fields.witness2}
                    onChange={(e) => updateField('witness2', e.target.value)}
                    className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs text-teal-950"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 border-t border-teal-900/10 pt-3 font-semibold text-teal-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCopy}
                  onChange={(e) => setIncludeCopy(e.target.checked)}
                  className="h-4 w-4 rounded border-teal-700 text-teal-800"
                />
                <span>พิมพ์ทั้งชุด “ต้นฉบับ” และ “สำเนา”</span>
              </label>

              <label className="flex items-center gap-2 font-semibold text-teal-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                  className="h-4 w-4 rounded border-teal-700 text-teal-800"
                />
                <span>ต่อท้ายเอกสารแนบ 4 แผ่น (A4 ต่อแผ่น)</span>
              </label>
            </div>
          </aside>

          {/* Right Live A4 Contract Preview */}
          <div className="lg:col-span-8 print:w-full">
            <div className="contract-sheet mx-auto max-w-[210mm] rounded-2xl bg-white p-6 shadow-xl sm:p-12 print:max-w-full print:rounded-none print:p-0 print:shadow-none">
              <ContractDocumentSet label="ต้นฉบับ" fields={fields} />

              {includeCopy && (
                <div className="contract-page-break mt-14 border-t-2 border-dashed border-slate-300 pt-10 print:mt-0 print:border-none print:pt-0">
                  <ContractDocumentSet label="สำเนา" fields={fields} />
                </div>
              )}

              {includeAttachments &&
                attachments.map((item, idx) => (
                  <section
                    key={item.slotKey}
                    className="contract-page-break contract-attachment-page mt-14 border-t-2 border-dashed border-slate-300 pt-10 print:mt-0 print:border-none print:pt-0"
                  >
                    <div className="font-contract flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-300 pb-1.5 text-black">
                      <h3 className="text-[20px] font-bold">
                        เอกสารแนบแผ่นที่ {idx + 1} : {item.label}
                      </h3>
                      <span className="text-[16px]">
                        ผู้รับจ้าง: {fields.contractorName} ({applicant.applicationId})
                      </span>
                    </div>

                    <div className="mt-4 flex h-[230mm] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-3 print:mt-3 print:h-[236mm] print:rounded-none print:border-none print:bg-transparent print:p-0">
                      {item.status === 'loading' ? (
                        <div className="no-print flex flex-col items-center gap-2 text-sm text-teal-900/70">
                          <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
                          <span>กำลังโหลดเอกสาร {item.label}...</span>
                        </div>
                      ) : item.status === 'ready' && item.imageUrls.length > 0 ? (
                        item.imageUrls.map((imgUrl, pageIdx) => (
                          <img
                            key={`${item.slotKey}-p${pageIdx}`}
                            src={imgUrl}
                            alt={`${item.label} หน้า ${pageIdx + 1}`}
                            className={
                              item.imageUrls.length === 1
                                ? 'max-h-full max-w-full object-contain'
                                : 'max-h-[114mm] w-auto max-w-full object-contain'
                            }
                          />
                        ))
                      ) : (
                        <div className="font-contract max-w-md rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-[18px] text-slate-700">
                          <p className="font-bold">{item.label}</p>
                          <p className="mt-1 text-[16px] text-slate-500">
                            {item.status === 'missing'
                              ? 'ผู้สมัครยังไม่ได้แนบเอกสารรายการนี้'
                              : `ไม่พบไฟล์เอกสารต้นฉบับในระบบ${item.fileName ? ` (${item.fileName})` : ''}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
