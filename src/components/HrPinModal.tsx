import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Delete, Loader2, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { verifyHrPinApi } from '../utils/apiClient.ts';

interface HrPinModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function HrPinModal({ open, onClose, onSuccess }: HrPinModalProps) {
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (open) {
      setPin('');
      setErrorMsg(null);
      setVerifying(false);
    }
  }, [open]);

  const submitPin = useCallback(
    async (candidate: string) => {
      setVerifying(true);
      setErrorMsg(null);
      try {
        const ok = await verifyHrPinApi(candidate);
        if (ok) {
          onSuccess();
        } else {
          setErrorMsg('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
          setShakeKey((k) => k + 1);
          setPin('');
        }
      } catch {
        setErrorMsg('ไม่สามารถตรวจสอบรหัส PIN ได้ กรุณาลองใหม่อีกครั้ง');
        setShakeKey((k) => k + 1);
        setPin('');
      } finally {
        setVerifying(false);
      }
    },
    [onSuccess]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (verifying || pin.length >= 4) return;
      setErrorMsg(null);
      const next = `${pin}${digit}`;
      setPin(next);
      if (next.length === 4) {
        void submitPin(next);
      }
    },
    [pin, verifying, submitPin]
  );

  const handleBackspace = useCallback(() => {
    if (verifying || pin.length === 0) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [pin.length, verifying]);

  const handleClear = useCallback(() => {
    if (verifying) return;
    setErrorMsg(null);
    setPin('');
  }, [verifying]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigitPress(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, handleBackspace, handleDigitPress]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hr-pin-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-teal-950/55 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !verifying) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel relative w-full max-w-sm rounded-3xl bg-white/92 p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              aria-label="ปิดหน้าต่างกรอกรหัส PIN"
              className="absolute top-4 right-4 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-teal-900/70 transition-colors hover:bg-teal-900/8 hover:text-teal-950 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-800/10 text-teal-800">
                {verifying ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <ShieldCheck className="h-6 w-6" />
                )}
              </div>
              <h2
                id="hr-pin-modal-title"
                className="font-display mt-3 text-lg font-bold text-teal-950"
              >
                รหัส PIN เจ้าหน้าที่ HR
              </h2>
              <p className="mt-1 text-xs text-teal-900/75">
                กรุณากดรหัส PIN 4 หลักเพื่อเข้าสู่ระบบตรวจสอบใบสมัคร
              </p>
            </div>

            {/* 4-Digit PIN Indicator Dots */}
            <motion.div
              key={shakeKey}
              animate={shakeKey > 0 ? { x: [0, -7, 7, -5, 5, -2, 2, 0] } : undefined}
              transition={{ duration: 0.36 }}
              className="mt-5 flex items-center justify-center gap-3.5"
            >
              {[0, 1, 2, 3].map((slotIndex) => {
                const isFilled = slotIndex < pin.length;
                const isCurrent = slotIndex === pin.length && !verifying;
                return (
                  <div
                    key={slotIndex}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-all duration-150 ${
                      errorMsg
                        ? 'border-rose-400 bg-rose-50'
                        : isFilled
                        ? 'border-teal-700 bg-teal-800/10 shadow-sm'
                        : isCurrent
                        ? 'border-teal-600/60 bg-white'
                        : 'border-teal-900/15 bg-white/75'
                    }`}
                  >
                    <motion.span
                      initial={false}
                      animate={{
                        scale: isFilled ? 1 : 0.35,
                        opacity: isFilled ? 1 : 0,
                      }}
                      transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                      className="h-3.5 w-3.5 rounded-full bg-teal-800"
                    />
                  </div>
                );
              })}
            </motion.div>

            {/* Error Message */}
            <div className="mt-3 min-h-[20px] text-center">
              <AnimatePresence>
                {errorMsg && (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="text-xs font-medium text-rose-700"
                  >
                    {errorMsg}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Phone-Style Numeric Keypad (3x4) */}
            <div className="mt-3 grid grid-cols-3 gap-2.5 sm:gap-3">
              {KEYPAD_DIGITS.map((digit) => (
                <motion.button
                  key={digit}
                  type="button"
                  disabled={verifying}
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.1 }}
                  onClick={() => handleDigitPress(digit)}
                  className="flex min-h-[60px] items-center justify-center rounded-2xl border border-teal-900/12 bg-white/85 py-2 text-teal-950 shadow-sm transition-colors hover:bg-white active:bg-teal-800 active:text-white disabled:opacity-50 cursor-pointer select-none"
                >
                  <span className="font-mono text-3xl font-bold leading-none tabular-nums">
                    {digit}
                  </span>
                </motion.button>
              ))}

              {/* Bottom-Left: Clear */}
              <motion.button
                type="button"
                disabled={verifying || pin.length === 0}
                whileTap={{ scale: 0.92 }}
                onClick={handleClear}
                aria-label="ล้างรหัสทั้งหมด"
                className="flex min-h-[60px] flex-col items-center justify-center rounded-2xl border border-teal-900/10 bg-white/60 text-teal-900/80 transition-colors hover:bg-white disabled:opacity-40 cursor-pointer select-none"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="mt-1 text-xs font-medium">ล้าง</span>
              </motion.button>

              {/* Bottom-Center: 0 */}
              <motion.button
                type="button"
                disabled={verifying}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.1 }}
                onClick={() => handleDigitPress('0')}
                className="flex min-h-[60px] items-center justify-center rounded-2xl border border-teal-900/12 bg-white/85 py-2 text-teal-950 shadow-sm transition-colors hover:bg-white active:bg-teal-800 active:text-white disabled:opacity-50 cursor-pointer select-none"
              >
                <span className="font-mono text-3xl font-bold leading-none tabular-nums">0</span>
              </motion.button>

              {/* Bottom-Right: Backspace */}
              <motion.button
                type="button"
                disabled={verifying || pin.length === 0}
                whileTap={{ scale: 0.92 }}
                onClick={handleBackspace}
                aria-label="ลบตัวเลขล่าสุด"
                className="flex min-h-[60px] flex-col items-center justify-center rounded-2xl border border-teal-900/10 bg-white/60 text-teal-900/80 transition-colors hover:bg-white disabled:opacity-40 cursor-pointer select-none"
              >
                <Delete className="h-4 w-4" />
                <span className="mt-1 text-xs font-medium">ลบ</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
