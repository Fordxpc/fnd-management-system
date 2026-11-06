// Run locally with: node scripts/generate-vapid-keys.mjs
// Copy both values into Cloudflare Worker secrets, never into source control.
import { generateKeyPairSync } from 'node:crypto';
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
if (!jwk.x || !jwk.y || !jwk.d) throw new Error('Could not generate VAPID keys');
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
const privateKeyValue = Buffer.from(jwk.d, 'base64url').toString('base64url');
console.log('Set these as Cloudflare secrets (do not commit them):');
console.log('VAPID_PUBLIC_KEY=' + publicKey);
console.log('VAPID_PRIVATE_KEY=' + privateKeyValue);
console.log('VAPID_SUBJECT=https://management.funadhooairport.com');
