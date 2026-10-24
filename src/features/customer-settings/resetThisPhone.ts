import { signOutHere } from '../../api/customer/rememberMe';
import { ADDRESS_KEY } from '../../api/device/address';
import { FIRST_NAME_KEY } from '../../api/device/firstName';
import { LAST_KITCHEN_KEY, LAST_KITCHEN_THEME_KEY } from '../../api/device/lastKitchen';
import { replaceMyOrders } from '../../api/device/myOrders';

// Plan 102 stage 3, "Reset this phone": sign out, forget the key, and clear what this browser kept
// (My orders, name, address, language, the saved kitchen). Nothing is deleted on our side: that is
// the separate "Delete my saved data".

// The language keys are private to src/i18n (`lang`, `langChosen`); the app-kitchen key lives in
// sessionStorage (src/api/device/lastKitchen.ts).
const LANGUAGE_KEYS = ['lang', 'langChosen'];
const APP_KITCHEN_KEY = 'appKitchen';

const LOCAL_KEYS = [
  FIRST_NAME_KEY,
  ADDRESS_KEY,
  LAST_KITCHEN_KEY,
  LAST_KITCHEN_THEME_KEY,
  ...LANGUAGE_KEYS,
];

export async function resetThisPhone(): Promise<void> {
  await signOutHere();
  replaceMyOrders([]);
  try {
    for (const key of LOCAL_KEYS) localStorage.removeItem(key);
    sessionStorage.removeItem(APP_KITCHEN_KEY);
  } catch {
    // storage unavailable: there is nothing kept to clear
  }
}
