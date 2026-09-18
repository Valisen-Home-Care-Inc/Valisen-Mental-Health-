/** Shared with the /welcome consultation form. */
export function formatPhoneDigits(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function formatReferralPhone(value: string, caret: number) {
  let digits = value.replace(/\D/g, "");
  let before = value.slice(0, caret).replace(/\D/g, "").length;
  // Pasted Canadian/US numbers may include their +1 country code.
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
    before = Math.max(0, before - 1);
  }
  const formatted = formatPhoneDigits(digits);
  let seen = 0;
  let nextCaret = formatted.length;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === before) { nextCaret = i + 1; break; }
  }
  if (before === 0) nextCaret = 0;
  return { formatted, caret: nextCaret };
}
