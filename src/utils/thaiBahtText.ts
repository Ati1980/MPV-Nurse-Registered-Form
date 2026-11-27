const THAI_NUMERALS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'] as const;
const THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'] as const;

function readThaiInteger(intStr: string): string {
  const cleaned = intStr.replace(/^0+/, '');
  if (!cleaned) {
    return THAI_NUMERALS[0];
  }

  let result = '';
  const len = cleaned.length;

  for (let i = 0; i < len; i += 1) {
    const digit = Number(cleaned[i]);
    const reverseIdx = len - 1 - i;
    const posInGroup = reverseIdx % 6;

    if (digit !== 0) {
      if (posInGroup === 0 && digit === 1 && len > 1 && i > 0) {
        result += 'เอ็ด';
      } else if (posInGroup === 1 && digit === 2) {
        result += 'ยี่';
      } else if (posInGroup === 1 && digit === 1) {
        // Omit "หนึ่ง" before "สิบ"
      } else {
        result += THAI_NUMERALS[digit];
      }
      result += THAI_POSITIONS[posInGroup];
    }

    if (posInGroup === 0 && reverseIdx > 0) {
      result += 'ล้าน';
    }
  }

  return result;
}

/**
 * Converts a numeric string (supports commas, whitespace, decimals) into Thai BAHTTEXT format.
 * Returns null if the input is not a valid finite number (or empty string -> '').
 */
export function toThaiBahtText(rawInput: string): string | null {
  const normalized = rawInput.replace(/[,\s฿บาท]/g, '').trim();
  if (!normalized) {
    return '';
  }

  if (!/^-?\d+(\.\d*)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const isNegative = parsed < 0;
  const totalSatang = Math.round(Math.abs(parsed) * 100);
  if (totalSatang === 0) {
    return 'ศูนย์บาทถ้วน';
  }

  const bahtPart = Math.floor(totalSatang / 100);
  const satangPart = totalSatang % 100;

  let text = '';
  if (bahtPart > 0) {
    text += `${readThaiInteger(String(bahtPart))}บาท`;
  }

  if (satangPart === 0) {
    text += 'ถ้วน';
  } else {
    text += `${readThaiInteger(String(satangPart))}สตางค์`;
  }

  return isNegative ? `ลบ${text}` : text;
}
