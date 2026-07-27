const LEVEL_ORDINALS = Object.freeze([
  "الأول",
  "الثاني",
  "الثالث",
  "الرابع",
  "الخامس",
  "السادس",
  "السابع",
  "الثامن",
  "التاسع",
  "العاشر",
  "الحادي عشر",
  "الثاني عشر",
  "الثالث عشر",
  "الرابع عشر",
  "الخامس عشر",
  "السادس عشر",
  "السابع عشر",
  "الثامن عشر",
  "التاسع عشر",
  "العشرون",
]);

export function semesterLevelName(index) {
  const level = Number(index);
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_ORDINALS.length) {
    throw new Error(`Unsupported semester level: ${index}. Saad supports levels 1-${LEVEL_ORDINALS.length}.`);
  }
  return `المستوى ${LEVEL_ORDINALS[level - 1]}`;
}

export function labelSemesters(semesters = [], offset = 0) {
  return semesters.map((semester, index) => ({
    ...semester,
    number: offset + index + 1,
    name: semesterLevelName(offset + index + 1),
  }));
}
