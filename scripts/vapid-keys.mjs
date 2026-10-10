// Prints a fresh VAPID key pair for web push (plan 004 stage 6), made with Node's WebCrypto:
//   node scripts/vapid-keys.mjs
// Locally, paste the three lines into `.dev.vars` (git-ignored). In production set them as Cloudflare
// secrets: `pnpm exec wrangler secret put VAPID_PRIVATE_KEY` (and the other two). Never commit real
// keys. Changing the pair later invalidates every existing subscription, so make one and keep it.
import { webcrypto } from 'node:crypto';

const base64url = (bytes) => Buffer.from(bytes).toString('base64url');

const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const publicKey = base64url(await webcrypto.subtle.exportKey('raw', pair.publicKey));
const privateKey = (await webcrypto.subtle.exportKey('jwk', pair.privateKey)).d;

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com');
