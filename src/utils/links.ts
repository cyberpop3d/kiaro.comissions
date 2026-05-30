export function normalizePaymentUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  // Payment links should be regular web URLs. Block unsafe/custom schemes.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';

  return `https://${raw.replace(/^\/+/, '')}`;
}
