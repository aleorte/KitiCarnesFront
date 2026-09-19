const MIN_DIGITS = 11;
const MAX_DIGITS = 15;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function stripDuplicateArgentinePrefix(digits: string): string {
  let next = digits;
  while (next.startsWith('549549')) {
    next = next.slice(3);
  }
  return next;
}

export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;

  let digits = stripDuplicateArgentinePrefix(digitsOnly(raw));
  if (digits.startsWith('00')) digits = stripDuplicateArgentinePrefix(digits.slice(2));
  if (!digits) return null;

  if (digits.startsWith('549') && digits.length >= 12 && digits.length <= MAX_DIGITS) {
    return digits;
  }

  if (digits.startsWith('54')) {
    if (digits.length === 12 && digits[2] !== '9') {
      digits = `549${digits.slice(2)}`;
    }
    if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
    return digits;
  }

  if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.replace(/^(\d{2,4})15/, '$1');
  if (digits.startsWith('15')) digits = digits.slice(2);
  if (digits.startsWith('9') && digits.length >= 11) digits = `54${digits}`;
  else if (digits.length >= 8 && digits.length <= 11) digits = `549${digits}`;

  digits = stripDuplicateArgentinePrefix(digits);
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  return digits;
}

export function phonesMatch(left: string | null | undefined, right: string | null | undefined) {
  const a = toWhatsAppNumber(left);
  const b = toWhatsAppNumber(right);
  if (a && b) return a === b;
  const rawA = digitsOnly(left ?? '');
  const rawB = digitsOnly(right ?? '');
  return rawA.length >= 8 && rawA === rawB;
}

export function whatsappUrl(raw: string | null | undefined, text?: string): string | null {
  const number = toWhatsAppNumber(raw);
  if (!number) return null;
  if (!text) return `https://wa.me/${number}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(raw: string | null | undefined, text?: string) {
  const url = whatsappUrl(raw, text);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function formatWhatsAppDisplay(raw: string | null | undefined) {
  const number = toWhatsAppNumber(raw);
  return number ? `+${number}` : null;
}

export const STORE_EXTRA_ORDER_WHATSAPP_MESSAGE =
  'Hola, necesito realizar otro pedido o modificar un pedido.';
