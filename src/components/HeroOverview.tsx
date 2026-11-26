import { ArrowRight, CheckCircle2, FileText, ShieldCheck, Stethoscope } from 'lucide-react';

interface HeroOverviewProps {
  hasSavedDraft: boolean;
  onStartApply: () => void;
  onTrackStatus: () => void;
}

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

  return (
    <div className="mx-auto max-w-6xl px-3.5 py-5 sm:px-6 sm:py-12">
      {/* Main Hero Glass Surface */}
      <section className="glass-panel rounded-3xl p-5 sm:p-10 lg:p-12">
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Left Content Column */}
          <div className="flex flex-col justify-between lg:col-span-7">
            <div>
              <p className="text-xs font-medium tracking-wide text-teal-800 sm:text-sm">
                กลุ่มมิตรผล <span aria-hidden="true">·</span> ฝ่ายทรัพยากรบุคคล{' '}
                <span aria-hidden="true">·</span> ประจำปี 2570
              </p>

              <h1
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
              </h1>

              <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-teal-900/85 sm:mt-4 sm:text-base">
                เปิดรับสมัครบุคลากรทางการพยาบาลผู้มีใบอนุญาตประกอบวิชาชีพ เพื่อร่วมดูแลสุขภาพพนักงาน
                งานปฐมพยาบาลฉุกเฉิน และการส่งเสริมอาชีวอนามัยและความปลอดภัยภายในโรงงานน้ำตาลมิตรภูเวียง
                กรอกประวัติส่วนตัวและแนบเอกสารประกอบการสมัครผ่านระบบออนไลน์ได้ครบจบในขั้นตอนเดียว
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={onStartApply}
                className="btn-lift group inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-teal-800 px-6 py-3 text-base font-semibold text-white shadow-md shadow-teal-950/15 hover:bg-teal-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto"
              >
                <span>{hasSavedDraft ? 'ดำเนินการกรอกใบสมัครต่อ' : 'เริ่มกรอกใบสมัครออนไลน์'}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={onTrackStatus}
                className="btn-lift inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-teal-900/15 bg-white/75 px-5 py-3 text-sm font-medium text-teal-950 hover:bg-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto"
              >
                ติดตามสถานะใบสมัคร
              </button>
            </div>
          </div>

          {/* Right Structured Checklist Panel */}
          <div className="flex flex-col justify-between rounded-2xl border border-teal-900/10 bg-white/70 p-4 sm:p-6 lg:col-span-5">
            <div>
              <div className="flex items-center gap-2.5 text-teal-950">
                <Stethoscope className="h-5 w-5 text-teal-700 shrink-0" />
                <h2 className="font-display text-base font-semibold sm:text-lg">
                  เอกสารที่ต้องเตรียมสำหรับแนบออนไลน์
                </h2>
              </div>
              <p className="mt-1.5 text-xs text-teal-900/75 sm:text-sm">
                รองรับไฟล์ PDF, JPG และ PNG ขนาดไม่เกิน 10 MB ต่อรายการ พร้อมบันทึกฉบับร่างอัตโนมัติ
              </p>

              <ul className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
                {requiredDocs.map((doc, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-teal-950">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 border-t border-teal-900/10 pt-3.5 text-xs text-teal-900/75 sm:mt-6 sm:pt-4">
              ข้อมูลส่วนบุคคลของผู้สมัครจะถูกเก็บรักษาและประมวลผลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Key Position Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-teal-900/10 pt-5 sm:mt-8 sm:gap-4 sm:pt-7 lg:grid-cols-4">
          <div className="interactive-card rounded-2xl bg-white/65 px-3.5 py-3 border border-white/80 sm:px-4 sm:py-3.5">
            <p className="text-[11px] text-teal-800/80 sm:text-xs">ตำแหน่งที่เปิดรับ</p>
            <p className="font-display mt-1 text-sm font-semibold text-teal-950 sm:text-base">
              พยาบาลวิชาชีพ (RN)
            </p>
          </div>
          <div className="interactive-card rounded-2xl bg-white/65 px-3.5 py-3 border border-white/80 sm:px-4 sm:py-3.5">
            <p className="text-[11px] text-teal-800/80 sm:text-xs">หน่วยงาน</p>
            <p className="font-display mt-1 text-sm font-semibold text-teal-950 sm:text-base">
              ห้องพยาบาล · อาชีวอนามัย
            </p>
          </div>
          <div className="interactive-card rounded-2xl bg-white/65 px-3.5 py-3 border border-white/80 sm:px-4 sm:py-3.5">
            <p className="text-[11px] text-teal-800/80 sm:text-xs">สถานที่ปฏิบัติงาน</p>
            <p className="font-display mt-1 text-sm font-semibold text-teal-950 sm:text-base">
              อ.หนองเรือ จ.ขอนแก่น
            </p>
          </div>
          <div className="interactive-card rounded-2xl bg-white/65 px-3.5 py-3 border border-white/80 sm:px-4 sm:py-3.5">
            <p className="text-[11px] text-teal-800/80 sm:text-xs">รอบการรับสมัคร</p>
            <p className="font-display mt-1 text-sm font-semibold text-teal-950 tabular-nums sm:text-base">
              ประจำปี 2570
            </p>
          </div>
        </div>
      </section>

      {/* Qualifications & Recruitment Steps */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="glass-panel interactive-card animate-page-enter stagger-1 rounded-3xl p-6 sm:p-8 lg:col-span-7">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-teal-700 shrink-0" />
            <h2 className="font-display text-xl font-semibold text-teal-950">
              คุณสมบัติและขอบเขตงานพยาบาลวิชาชีพ
            </h2>
          </div>
          <ul className="mt-5 space-y-3.5">
            {qualifications.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-teal-950/90 leading-relaxed">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-700" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel interactive-card animate-page-enter stagger-2 rounded-3xl p-6 sm:p-8 lg:col-span-5">
          <h2 className="font-display text-xl font-semibold text-teal-950">
            ขั้นตอนการกรอกใบสมัครออนไลน์
          </h2>
          <ol className="mt-5 space-y-4">
            {[
              {
                step: '01',
                title: 'กรอกข้อมูลส่วนตัว (Personal Information)',
                desc: 'คำนำหน้า ชื่อไทย-อังกฤษ วันเกิด ที่อยู่ และช่องทางติดต่อ',
              },
              {
                step: '02',
                title: 'ประวัติการทำงานและการศึกษา',
                desc: 'ประสบการณ์ทำงานล่าสุดและประวัติการศึกษาทุกระดับ',
              },
              {
                step: '03',
                title: 'ใบประกอบวิชาชีพและผู้ติดต่อฉุกเฉิน',
                desc: 'เลขที่ใบประกอบวิชาชีพพยาบาลฯ ความพร้อมและบุคคลติดต่อฉุกเฉิน',
              },
              {
                step: '04',
                title: 'แนบเอกสารและพิมพ์ใบสมัคร',
                desc: 'อัปโหลดเอกสารครบถ้วน รับรหัสอ้างอิง และพิมพ์แบบฟอร์มทางการได้ทันที',
              },
            ].map((item) => (
              <li key={item.step} className="flex items-start gap-3.5">
                <span className="font-mono tabular-nums mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-800/10 text-xs font-semibold text-teal-900">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-teal-950">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-teal-900/75 leading-relaxed">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
