import { APP_NAME } from './appName';
import { REMEMBER_ME_LABEL } from './customerContract';

// What the phone's passkey list shows (plan 092, D-108). One passkey serves every kitchen, so
// the kitchen's name is never part of it.

/** "Indra · seller" / "Indra · admin"; with no name "Seller · <app>" / "Admin · <app>". */
export function passkeyLabel(role: 'admin' | 'seller', name: string | null | undefined): string {
  const who = name?.trim() ?? '';
  if (who !== '') return `${who} · ${role}`;
  return `${role === 'admin' ? 'Admin' : 'Seller'} · ${APP_NAME}`;
}

/** "Indra · customer (Remember me)"; with no name "Remember me · <app>". */
export function customerLabel(firstName: string): string {
  const name = firstName.trim();
  return name === ''
    ? `${REMEMBER_ME_LABEL} · ${APP_NAME}`
    : `${name} · customer (${REMEMBER_ME_LABEL})`;
}
