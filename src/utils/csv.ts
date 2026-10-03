/** One CSV field: quoted when needed (RFC 4180). */
function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Text a spreadsheet would treat as a formula (=, +, -, @, tab, CR) gets a
 * leading apostrophe, so opening the file can't run a formula from a note.
 * Use only for free text, not for numbers.
 */
export function safeText(value: string | null | undefined): string {
  const s = value ?? '';
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** CSV with a UTF-8 BOM so Excel shows Bangla text correctly; CRLF line ends. */
export function toCsv(header: string[], rows: string[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(field).join(',')).join('\r\n') + '\r\n';
}
