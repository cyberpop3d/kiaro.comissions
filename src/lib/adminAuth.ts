import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'yontuk_admin_session';

function expectedCookieValue(secret: string) {
  return createHmac('sha256', secret).update('yontuk-admin-session-v1').digest('hex');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function readCookie(request: Request, name: string) {
  const raw = request.headers.get('cookie') || '';
  const item = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

export function isValidAdminSecret(value: string) {
  const expected = process.env.ADMIN_SECRET || '';
  return Boolean(expected && value && safeEqual(value, expected));
}

export function isAdminRequest(request: Request, submittedSecret = '') {
  const expected = process.env.ADMIN_SECRET || '';
  if (!expected) return false;
  if (submittedSecret && safeEqual(submittedSecret, expected)) return true;

  const cookieValue = readCookie(request, ADMIN_COOKIE_NAME);
  return Boolean(cookieValue && safeEqual(cookieValue, expectedCookieValue(expected)));
}

export function adminCookieValue() {
  const secret = process.env.ADMIN_SECRET || '';
  return secret ? expectedCookieValue(secret) : '';
}
