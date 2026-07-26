export function formatRequiredHours(value) {
  const hours = Number(value ?? 0);
  if (hours === 1) return "إتمام ساعة واحدة";
  if (hours === 2) return "إتمام ساعتين";
  if (hours >= 3 && hours <= 10) return `إتمام ${hours} ساعات`;
  return `إتمام ${hours} ساعة`;
}
