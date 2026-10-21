export function parseQuantityDraft(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (text === '' || text === '.') {
    return null;
  }
  if (!/^\d*\.?\d*$/.test(text)) {
    return null;
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

export function isAllowedQuantityDraft(raw: string): boolean {
  const text = raw.replace(',', '.').trim();
  return text === '' || /^\d*\.?\d*$/.test(text);
}

export function isIntegerQuantity(value: number): boolean {
  return Number.isInteger(value);
}
