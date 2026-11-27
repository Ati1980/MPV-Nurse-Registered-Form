import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, FileText, ShieldCheck, Stethoscope } from 'lucide-react';

interface HeroOverviewProps {
  hasSavedDraft: boolean;
  onStartApply: () => void;
  onTrackStatus: () => void;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function HeroOverview({
  hasSavedDraft,
  onStartApply,
  onTrackStatus,
}: HeroOverviewProps) {
  const qualifications = [
    'สำเร็จการศึกษาระดับปริญญาตรี สาขาพยาบาลศาสตร์ และได้รับใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ ชั้นหนึ่ง (ยังไม่หมดอายุ)',
    'มีใจรักงานบริการ สามารถปฏิบัติงานประจำห้องพยาบาลโรงงาน และดูแลงานด้านอาชีวอนามัยเบื้องต้นได้',
    'หากผ่านการอบรมหลักสูตรพยาบาลอาชีวอนามัย (60 ชั่วโมง) หรือมีประสบการณ์พยาบาลโรงงาน/ฉุกเฉิน จะได้รับการพิจารณาเป็นพิเศษ',
    'สามารถปฏิบัติงานเป็นกะได้ และพร้อมประจำการ ณ โรงงานน้ำตาลมิตรภูเวียง อำเภอหนองเรือ จังหวัดขอนแก่น',
  ];

  const requiredDocs = [
    'สำเนาบัตรประจำตัวประชาชน',
    'สำเนาทะเบียนบ้าน',
    'สำเนาใบอนุญาตประกอบวิชาชีพการพยาบาลฯ',
    'สำเนาสมุดบัญชีธนาคาร',
    'รูปถ่ายหน้าตรง (1 หรือ 2 นิ้ว)',
  ];

  const keyPositions = [
    { label: 'ตำแหน่งที่เปิดรับ', value: 'พยาบาลวิชาชีพ (RN)', tabular: false },
    { label: 'หน่วยงาน', value: 'ห้องพยาบาล · อาชีวอนามัย', tabular: false },
    { label: 'สถานที่ปฏิบัติงาน', value: 'อ.หนองเรือ จ.ขอนแก่น', tabular: false },
    { label: 'รอบการรับสมัคร', value: 'ประจำปี 2570', tabular: true },
  ];

  const recruitmentSteps = [
    {
      step: '01',
      title: 'กรอกข้อมูลส่วนตัว (Personal Information)',
      desc: 'คำนำหน้า ชื่อไทย-อังกฤษ วันเกิด ที่อยู่ และช่องทางติดต่อ',
    },
    {
      step: '02',
      title: 'บุคคลที่สามารถติดต่อได้ในกรณีฉุกเฉิน',
      desc: 'ชื่อ-นามสกุล ความสัมพันธ์ ที่อยู่ และเบอร์โทรศัพท์ติดต่อฉุกเฉิน',
    },
    {
      step: '03',
      title: 'แนบเอกสารประกอบการสมัครออนไลน์',
      desc: 'อัปโหลดเอกสารครบทั้ง 5 รายการและยืนยันความยินยอม',
    },
    {
      step: '04',
      title: 'ส่งใบสมัครและรับรหัสอ้างอิง',
      desc: 'ส่งใบสมัครออนไลน์ รับรหัสอ้างอิง และพิมพ์ใบสมัครได้ทันที',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-3.5 py-5 sm:px-6 sm:py-12">
      {/* Main Hero Glass Surface */}
      <section className="glass-panel rounded-3xl p-5 sm:p-10 lg:p-12">
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Left Content Column */}
          <div className="flex flex-col justify-between lg:col-span-7">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                className="text-xs font-medium tracking-wide text-teal-800 sm:text-sm"
              >
                กลุ่มมิตรผล <span aria-hidden="true">·</span> ฝ่ายทรัพยากรบุคคล{' '}
                <span aria-hidden="true">·</span> ประจำปี 2570
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36, delay: 0.05, ease: EASE_OUT_EXPO }}
                className="font-display mt-3 font-bold tracking-normal text-teal-950 leading-[1.38] sm:leading-[1.32]"
                style={{
                  fontSize: 'clamp(1.25rem, 2.75vw, 2.45rem)',
                }}
              >
                <span className="inline-block">
                  ฟอร์มรับสมัคร<span className="whitespace-nowrap">พยาบาลวิชาชีพ</span>
                </span>{' '}
                <span className="inline-block whitespace-nowrap">โรงงานน้ำตาลมิตรภูเวียง</span>{' '}
                <span className="inline-block whitespace-nowrap">ประจำปี 2570</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36, delay: 0.11, ease: EASE_OUT_EXPO }}
                className="mt-3.5 max-w-2xl text-sm leading-relaxed text-teal-900/85 sm:mt-4 sm:text-base"
              >
                เปิดรับสมัครบุคลากรทางการพยาบาลผู้มีใบอนุญาตประกอบวิชาชีพ เพื่อร่วมดูแลสุขภาพพนักงาน
                งานปฐมพยาบาลฉุกเฉิน และการส่งเสริมอาชีวอนามัยและความปลอดภัยภายในโรงงานน้ำตาลมิตรภูเวียง
                กรอกประวัติส่วนตัวและแนบเอกสารประกอบการสมัครผ่านระบบออนไลน์ได้ครบจบในขั้นตอนเดียว
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: 0.16, ease: EASE_OUT_EXPO }}
              className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.16 }}
                onClick={onStartApply}
                className="group inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-teal-800 px-6 py-3 text-base font-semibold text-white shadow-md shadow-teal-950/15 transition-colors hover:bg-teal-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto"
              >
                <span>{hasSavedDraft ? 'ดำเนินการกรอกใบสมัครต่อ' : 'เริ่มกรอกใบสมัครออนไลน์'}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.16 }}
                onClick={onTrackStatus}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-teal-900/15 bg-white/75 px-5 py-3 text-sm font-medium text-teal-950 transition-colors hover:bg-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto"
              >
                ติดตามสถานะใบสมัคร
              </motion.button>
            </motion.div>
          </div>

          {/* Right Structured Checklist Panel */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.38, delay: 0.1, ease: EASE_OUT_EXPO }}
            className="flex flex-col justify-between rounded-2xl border border-teal-900/10 bg-white/70 p-4 sm:p-6 lg:col-span-5"
          >
            <div>
              <div className="flex items-center gap-2.5 text-teal-950">
                <Stethoscope className="animate-float-gentle h-5 w-5 text-teal-700 shrink-0" />
                <h2 className="font-display text-base font-semibold sm:text-lg">
                  เอกสารที่ต้องเตรียมสำหรับแนบออนไลน์
                </h2>
              </div>
              <p className="mt-1.5 text-xs text-teal-900/75 sm:text-sm">
                รองรับไฟล์ PDF, JPG และ PNG ขนาดไม่เกิน 10 MB ต่อรายการ พร้อมบันทึกฉบับร่างอัตโนมัติ
              </p>

              <ul className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
                {requiredDocs.map((doc, idx) => (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: 0.18 + idx * 0.05, ease: EASE_OUT_EXPO }}
                    className="flex items-start gap-2.5 text-sm text-teal-950"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                    <span>{doc}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            <div className="mt-5 border-t border-teal-900/10 pt-3.5 text-xs text-teal-900/75 sm:mt-6 sm:pt-4">
              ข้อมูลส่วนบุคคลของผู้สมัครจะถูกเก็บรักษาและประมวลผลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
            </div>
          </motion.div>
        </div>

        {/* Full-Width 4-Column Key Position Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-teal-900/10 pt-5 sm:mt-8 sm:gap-4 sm:pt-7 lg:grid-cols-4">
          {keyPositions.map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.3, delay: 0.2 + idx * 0.05, ease: EASE_OUT_EXPO }}
              className="rounded-2xl border border-white/80 bg-white/65 px-3.5 py-3 transition-shadow duration-200 hover:shadow-md hover:shadow-teal-950/10 sm:px-4 sm:py-3.5"
            >
              <p className="text-[11px] text-teal-800/80 sm:text-xs">{item.label}</p>
              <p
                className={`font-display mt-1 text-sm font-semibold text-teal-950 sm:text-base ${
                  item.tabular ? 'tabular-nums' : ''
                }`}
              >
                {item.value}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Qualifications & Recruitment Steps */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
          className="glass-panel interactive-card rounded-3xl p-6 sm:p-8 lg:col-span-7"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-teal-700 shrink-0" />
            <h2 className="font-display text-xl font-semibold text-teal-950">
              คุณสมบัติและขอบเขตงานพยาบาลวิชาชีพ
            </h2>
          </div>
          <ul className="mt-5 space-y-3.5">
            {qualifications.map((item, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.28, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
                className="flex items-start gap-3 text-sm sm:text-base text-teal-950/90 leading-relaxed"
              >
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-700" />
                <span>{item}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.36, delay: 0.08, ease: EASE_OUT_EXPO }}
          className="glass-panel interactive-card rounded-3xl p-6 sm:p-8 lg:col-span-5"
        >
          <h2 className="font-display text-xl font-semibold text-teal-950">
            ขั้นตอนการกรอกใบสมัครออนไลน์
          </h2>
          <ol className="mt-5 space-y-4">
            {recruitmentSteps.map((item, idx) => (
              <motion.li
                key={item.step}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.28, delay: 0.05 + idx * 0.05, ease: EASE_OUT_EXPO }}
                className="flex items-start gap-3.5"
              >
                <span className="font-mono tabular-nums mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-800/10 text-xs font-semibold text-teal-900">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-teal-950">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-teal-900/75 leading-relaxed">{item.desc}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </motion.div>
      </section>
    </div>
  );
}
