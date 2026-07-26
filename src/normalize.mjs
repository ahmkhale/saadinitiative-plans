const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toWesternDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

export function normalizeArabic(value) {
  return toWesternDigits(value)
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/ـ/gu, "")
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeCourseCode(value) {
  const raw = toWesternDigits(value).replace(/ـ/gu, "").replace(/\s+/gu, " ").trim();
  if (!raw) return "";
  const numberFirst = /^(\d+[A-Za-z]?)\s+(.+)$/u.exec(raw);
  if (numberFirst) return `${numberFirst[1]} ${numberFirst[2].trim()}`;
  const subjectFirst = /^([^\d]+?)\s+(\d+[A-Za-z]?)$/u.exec(raw);
  if (subjectFirst) return `${subjectFirst[2]} ${subjectFirst[1].trim()}`;
  const compact = /^(\d+[A-Za-z]?)([^\d\s].+)$/u.exec(raw);
  if (compact) return `${compact[1]} ${compact[2].trim()}`;
  return raw;
}

export function courseCodeKey(value) {
  return normalizeArabic(normalizeCourseCode(value)).replace(/\s+/gu, " ");
}

export function courseSubject(value) {
  const code = normalizeCourseCode(value);
  const match = /^\d+[A-Za-z]?\s+(.+)$/u.exec(code);
  return match?.[1]?.trim() ?? code.replace(/[\d\s]/gu, "").trim();
}

export function numericValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(toWesternDigits(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const ARABIC_COLLATOR = new Intl.Collator("ar", { sensitivity: "base", numeric: true });

export function compareCourseCodes(left, right) {
  const a = normalizeCourseCode(left);
  const b = normalizeCourseCode(right);
  const ma = /^(\d+)/u.exec(a);
  const mb = /^(\d+)/u.exec(b);
  const na = ma ? Number.parseInt(ma[1], 10) : Number.POSITIVE_INFINITY;
  const nb = mb ? Number.parseInt(mb[1], 10) : Number.POSITIVE_INFINITY;
  if (na !== nb) return na - nb;
  return ARABIC_COLLATOR.compare(a, b);
}

export function safeSlug(value, fallback = "plan") {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}
