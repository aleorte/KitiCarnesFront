const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SHORT_CODE_PATTERN = /\b[0-9a-f]{8}\b/i;

export function parseTrackingOrderCode(raw: string): string | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  const uuid = text.match(UUID_PATTERN);
  if (uuid) {
    return uuid[0].toLowerCase();
  }

  const stripped = text
    .replace(/pedido/gi, ' ')
    .replace(/#/g, ' ')
    .replace(/[^\dA-Za-z-]+/g, ' ')
    .trim();

  const strippedUuid = stripped.match(UUID_PATTERN);
  if (strippedUuid) {
    return strippedUuid[0].toLowerCase();
  }

  const code = stripped.match(SHORT_CODE_PATTERN);
  return code ? code[0].toUpperCase() : null;
}
