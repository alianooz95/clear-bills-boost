// Simplified Arabic number-to-words (تفقيط) for non-negative integers up to billions.
// Handles two-decimal currency amounts ("ريال يمني" by default).
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
  "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function under1000(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 20) parts.push(ONES[r]);
    else {
      const o = r % 10;
      const t = Math.floor(r / 10);
      parts.push(o ? `${ONES[o]} و${TENS[t]}` : TENS[t]);
    }
  }
  return parts.join(" و");
}

function groupName(value: number, single: string, dual: string, plural: string, many: string): string {
  if (value === 1) return single;
  if (value === 2) return dual;
  if (value >= 3 && value <= 10) return `${under1000(value)} ${plural}`;
  return `${under1000(value)} ${many}`;
}

function intToArabic(n: number): string {
  if (n === 0) return "صفر";
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const out: string[] = [];
  if (billions) out.push(groupName(billions, "مليار", "ملياران", "مليارات", "مليار"));
  if (millions) out.push(groupName(millions, "مليون", "مليونان", "ملايين", "مليون"));
  if (thousands) out.push(groupName(thousands, "ألف", "ألفان", "آلاف", "ألف"));
  if (rest) out.push(under1000(rest));
  return out.join(" و");
}

export function tafqeet(amount: number | string, currency = "ريال يمني"): string {
  const num = Math.max(0, Math.round(Number(amount || 0) * 100) / 100);
  const whole = Math.floor(num);
  const fraction = Math.round((num - whole) * 100);
  const wordsWhole = intToArabic(whole);
  let result = `فقط ${wordsWhole} ${currency}`;
  if (fraction > 0) result += ` و${intToArabic(fraction)} فلس`;
  result += " لا غير";
  return result;
}