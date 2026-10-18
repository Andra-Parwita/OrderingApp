// Types, result helpers and the dev sample generator shared by the seller repository files (split out
// of seller.ts, plan 098 C3; the code is unchanged).
import type { ApiErrorCode, ApiWarning } from '../../shared/apiError';
import type {
  Chef,
  Kitchen,
  KitchenSettings,
  MenuItem,
  OrderStatus,
  Week,
} from '../../shared/domain';
import { DEFAULT_MENU_DEFAULTS, DEFAULT_THEME, type Preferences } from '../../shared/menusContract';
import { type FillRandom } from '../../shared/orderCode';
import type { StoreResult } from '../repo/Repository';
import { type Db } from './d1';
import { type OrderChange } from './orders';
import type { CustomerChange } from '../push/dispatch';
import { type SettingsRow } from './rows';

/** What a seller repository needs from the repository that creates it. */
export type Deps = {
  db: Db;
  now: () => Date;
  newId: () => string;
  newCode: () => string;
  newToken: () => string;
  seed: number;
  /** Per seller: the deterministic source behind the dev sample orders. */
  samples: Map<string, SampleState>;
  /** Web push (plan 004 stage 6): called after a write that told customers something. */
  onCustomerChange?: (changes: Array<CustomerChange>) => void;
};
export type SampleState = { random: () => number; fill: FillRandom; counter: number };

export const defaultPreferences: Preferences = {
  theme: DEFAULT_THEME,
  menuDefaults: DEFAULT_MENU_DEFAULTS,
};

export const SAMPLE_NAMES = ['Rina', 'Tom', 'Sari', 'Budi', 'Mei', 'Dewi', 'Arif', 'Lisa'];
export const SAMPLE_NOTES = [
  'No chilli please',
  'Allergic to peanuts',
  'Pickup around 3pm',
  'Tolong dibungkus terpisah',
  'Ring the bell, the gate sticks',
];

/** mulberry32: small deterministic PRNG returning [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSampleState(seed: number): SampleState {
  const random = seededRandom(seed);
  const fill: FillRandom = (bytes) => {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(random() * 256);
    return bytes;
  };
  return { random, fill, counter: 0 };
}

export function fail<T>(error: ApiErrorCode, message: string): StoreResult<T> {
  return { ok: false, error, message };
}

export function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

/**
 * D-062: a refusal the seller may override with `force`. `error` stays the code the call used to
 * refuse with, so the screens that only know the old refusals keep working.
 */
export function warn<T>(error: ApiErrorCode, warning: ApiWarning, message: string): StoreResult<T> {
  return { ok: false, error, message, warning };
}

/** A copy of the object without one key. */
export function without<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const copy = { ...source } as Partial<T>;
  delete copy[key];
  return copy as Omit<T, K>;
}

/** Everything the rules read about the seller, loaded in one round trip. */
export type State = {
  kitchen: Kitchen;
  settings: KitchenSettings;
  week: Week;
  items: Array<MenuItem>;
  /** Portions taken per item by live, not cancelled orders. */
  used: Map<string, number>;
  chefs: Array<Chef>;
  /** plan 001 stage 12: what the public menu adds (D-064 theme, D-060 menu picture). */
  theme: SettingsRow['theme'];
  pictureUrl?: string;
};

export type StaffInsert = {
  status?: OrderStatus;
  paid?: boolean;
  returning?: boolean;
  /** Seller-entered order that went ahead although it takes more portions than are left. */
  force?: boolean;
};

/** What a portion limit does to a requested line: refuse (customers), warn (sellers) or let it pass. */
export type OverLimit = 'refuse' | 'warn' | 'allow';

/** A draft change to one order: the new state plus the entries to append. */
export type Draft = OrderChange;
