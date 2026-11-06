// Uses the standard VAPID protocol and a *bodyless* Web Push request. The
// browser displays a generic alert and retrieves details after authentication.
// This avoids leaking employee information to lock screens or push services.
export const isTrustedPushEndpoint = (value: unknown): value is string => {
  try {
    if (typeof value !== 'string' || value.length > 2048) return false;
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    return host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
      host === 'web.push.apple.com' || host.endsWith('.push.apple.com') ||
      host === 'notify.windows.com' || host.endsWith('.notify.windows.com');
  } catch { return false; }
};

const fromBase64Url = (value: string): Uint8Array => {
  const clean = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(clean + '='.repeat((4 - clean.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

const toBase64Url = (value: Uint8Array) =>
  btoa(Array.from(value, byte => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export async function getVapidAuthorization(endpoint: string, env: {
  VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string;
}): Promise<string> {
  if (!isTrustedPushEndpoint(endpoint)) throw new Error('Untrusted push endpoint');
  const publicKey = String(env.VAPID_PUBLIC_KEY || '');
  const privateKey = String(env.VAPID_PRIVATE_KEY || '');
  const publicBytes = fromBase64Url(publicKey);
  const privateBytes = fromBase64Url(privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) {
    throw new Error('VAPID keys are not configured correctly');
  }
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', x: toBase64Url(publicBytes.slice(1, 33)),
    y: toBase64Url(publicBytes.slice(33, 65)), d: toBase64Url(privateBytes),
    ext: false, key_ops: ['sign'],
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const origin = new URL(endpoint).origin;
  const subject = env.VAPID_SUBJECT || 'https://management.funadhooairport.com';
  if (!subject.startsWith('https://') && !subject.startsWith('mailto:')) {
    throw new Error('VAPID subject must be an HTTPS URL or mailto address');
  }
  const encoder = new TextEncoder();
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    aud: origin, exp: Math.floor(Date.now() / 1000) + 3600, sub: subject,
  })));
  const unsignedToken = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsignedToken),
  ));
  return `vapid t=${unsignedToken}.${toBase64Url(signature)}, k=${publicKey}`;
}
