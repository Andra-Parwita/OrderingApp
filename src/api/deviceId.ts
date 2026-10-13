// Plan 074: a random id per seller browser tab, made once per session. Every seller write sends it
// (X-Device-Id) and the live event that write causes carries it back as `from`, so a screen ignores
// only its own echo and never another device's change.
import { DEVICE_ID_BYTES } from '../../shared/liveContract';

const KEY = 'seller-device-id';
let memory: string | null = null;

function makeId(): string {
  const bytes = new Uint8Array(DEVICE_ID_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sellerDeviceId(): string {
  if (memory) return memory;
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      memory = saved;
      return saved;
    }
  } catch {
    // storage blocked: the id lives in memory only
  }
  memory = makeId();
  try {
    sessionStorage.setItem(KEY, memory);
  } catch {
    // see above
  }
  return memory;
}
