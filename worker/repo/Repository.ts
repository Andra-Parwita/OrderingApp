// The one door to stored data (stage 8.1a, D-046). Routes call this and nothing else;
// D1 implements it (worker/db). Storage-agnostic: plain domain types
// and promises, no SQL or Workers types. Data model: docs/architecture/data-model.md.
//
// Operation-level on purpose: each method is one thing the routes do ("place an order", "close the
// week", "redeem a key"), so an implementation can make it atomic (a D1 batch) and keep the rules
// (limits, statuses, lockouts) next to the writes. Every seller-scoped method belongs to a
// `SellerRepository`, which can only see its own seller's rows (D-036).
import type { ApiErrorCode, ApiWarning } from '../../shared/apiError';
import type {
  DeliveryStepRequest,
  DeliveryStepResponse,
  MarkCollectedRequest,
  MessageLogEntry,
  MessagePlaceRequest,
  MessagePlaceResponse,
  PackRequest,
} from '../../shared/handoverContract';
import type {
  Chef,
  KitchenImages,
  KitchenSettings,
  OrderStatus,
  Seller,
  SellerMenuItemView,
  SellerOrder,
  StaffActor,
} from '../../shared/domain';
import type { BackupFile } from '../../shared/backup';
import type { PushSubscribeRequest } from '../../shared/pushContract';
import type { ImageSlot } from '../../shared/imageSlots';
import type { MenuResponse, SellerMenuResponse } from '../../shared/menuContract';
import type {
  CreateDishRequest,
  CreateDishSetRequest,
  CreateMenuRequest,
  Dish,
  DishSet,
  FinishMenuResponse,
  MenuView,
  PickupPlace,
  Preferences,
  UpdateDishRequest,
  UpdateMenuRequest,
  UpdateMenuResponse,
  UpdatePickupPlaceRequest,
  UpdatePreferencesRequest,
  UseDishSetResponse,
} from '../../shared/menusContract';
import type {
  CreateOrderRequest,
  CreateSellerOrderRequest,
  UpdateOrderRequest,
} from '../../shared/orderContract';
import type { PastWeek, PastWeekSummary } from '../../shared/pastWeeks';
import type {
  ImageStyleRequest,
  PickupPointInput,
  UpdateItemRequest,
} from '../../shared/setupContract';
import type { SendUpdatesRequest, UpdateResult } from '../../shared/updateContract';
import type {
  AdminSeller,
  CodeResponse,
  DeviceView,
  KeyResponse,
  Me,
  PasswordSignInRequest,
  Role,
  SessionResponse,
} from '../../shared/authContract';

// ---- Results ----

/** A rule-checked outcome: the value, or an API error code with a message. */
export type StoreResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: ApiErrorCode;
      message: string;
      /** Set when `force: true` would have let the call through (D-062). */
      warning?: ApiWarning;
    };

export type AuthFail = {
  ok: false;
  error: ApiErrorCode;
  message: string;
  triesLeft?: number;
  retryAfterSeconds?: number;
};
export type AuthResult<T> = { ok: true; value: T } | AuthFail;

/** A live session, resolved from its token. */
export type Caller = {
  token: string;
  role: Role;
  setup: boolean;
  sellerId?: string;
  chefId?: string;
  accountId: string;
  deviceId?: string;
};

// ---- One seller ----

/** Everything one seller owns. Created from a seller row; cannot see another seller (D-036). */
export type SellerRepository = {
  readonly seller: Seller;

  // Menu, settings, week
  getMenu(): Promise<MenuResponse>;
  getSellerMenu(): Promise<SellerMenuResponse>;
  getSettings(): Promise<KitchenSettings>;
  setSettings(next: KitchenSettings): Promise<KitchenSettings>;
  listPastWeeks(): Promise<Array<PastWeekSummary>>;
  getPastWeek(id: string): Promise<PastWeek | undefined>;

  // Menus (plan 001, stage 3): the one menu, not published -> live -> finished (D-063)
  getCurrentMenu(): Promise<MenuView>;
  /** Only once the current menu is finished (`menu_in_progress` otherwise). */
  createMenu(request: CreateMenuRequest): Promise<StoreResult<MenuView>>;
  /** Allowed while live (instant edits); refused once finished (`week_closed`). */
  updateMenu(request: UpdateMenuRequest): Promise<StoreResult<UpdateMenuResponse>>;
  /** An empty menu is a warning (`no_items` with `no_dishes`) that `force` overrides (D-062). */
  publishMenu(force?: boolean): Promise<StoreResult<MenuView>>;
  unpublishMenu(): Promise<StoreResult<MenuView>>;
  /** A menu that is not published only (`week_not_draft`); it ends as finished with no past-menu entry. */
  deleteMenu(): Promise<StoreResult<{ view: MenuView; before: string | undefined }>>;
  /** The menu picture (3:2); `before` is the ref it replaced, for the caller to clean up. */
  setMenuPicture(
    dataUrl: unknown,
    ref?: string,
  ): Promise<StoreResult<{ view: MenuView; before: string | undefined }>>;
  removeMenuPicture(): Promise<{ view: MenuView; before: string | undefined }>;
  /** Same as the midnight auto-finish, on demand; only for a live menu (`menu_not_live`). */
  finishMenuNow(): Promise<StoreResult<FinishMenuResponse>>;

  // Your dishes (the library). Menus hold copies, so none of this touches a menu or an order.
  listDishes(): Promise<Array<Dish>>;
  createDish(input: CreateDishRequest): Promise<StoreResult<Dish>>;
  updateDish(id: string, patch: UpdateDishRequest): Promise<StoreResult<Dish>>;
  /** Always allowed (D-062); `usedOnLiveMenu` is the warning flag. */
  deleteDish(id: string): Promise<StoreResult<{ usedOnLiveMenu: boolean }>>;

  // Saved sets as lists of dishes (the older `listSets` etc. below keep their item-copy shape)
  listDishSets(): Promise<Array<DishSet>>;
  createDishSet(input: CreateDishSetRequest): Promise<StoreResult<DishSet>>;
  /** Adds the set's dishes to the menu and counts a use. */
  useDishSet(id: string): Promise<StoreResult<UseDishSetResponse>>;

  // Pickup places: at most 5 (`pickup_place_limit`)
  listPickupPlaces(): Promise<Array<PickupPlace>>;
  createPickupPlace(input: PickupPointInput): Promise<StoreResult<PickupPlace>>;
  updatePickupPlace(id: string, patch: UpdatePickupPlaceRequest): Promise<StoreResult<PickupPlace>>;
  /** Always allowed (D-062); `usedOnLiveMenu` is the warning flag. */
  deletePickupPlace(id: string): Promise<StoreResult<{ usedOnLiveMenu: boolean }>>;

  // Theme and menu defaults
  getPreferences(): Promise<Preferences>;
  setPreferences(request: UpdatePreferencesRequest): Promise<Preferences>;

  // Items
  patchItem(id: string, patch: UpdateItemRequest): Promise<StoreResult<SellerMenuItemView>>;

  /** Renames the kitchen (the seller's name and the public kitchen name). */
  setKitchenName(name: string): Promise<string>;

  // Chefs
  listChefs(): Promise<Array<Chef>>;
  addChef(name: string): Promise<StoreResult<Chef>>;
  renameChef(id: string, name: string): Promise<StoreResult<Chef>>;
  /** Unassigns the chef's items (this week and saved sets). Sign-in cleanup is `auth.revokeChef`. */
  removeChef(id: string): Promise<StoreResult<true>>;

  // Images
  getImages(): Promise<KitchenImages>;
  /**
   * Checks the upload, then keeps `ref` for the slot (an R2 path, stage 8.3) or, without one, the
   * data URL itself (dev fixtures and tests that run without a bucket).
   */
  setImage(slot: ImageSlot, dataUrl: unknown, ref?: string): Promise<StoreResult<KitchenImages>>;
  removeImage(slot: ImageSlot): Promise<KitchenImages>;
  setImageStyle(style: ImageStyleRequest): Promise<KitchenImages>;

  // Backup and CSV
  exportBackup(): Promise<BackupFile>;
  /** Replaces this seller's data with an already validated backup. */
  /** Returns how many image refs were dropped because they were not this seller's own. */
  restoreBackup(file: BackupFile): Promise<number>;
  ordersCsv(): Promise<string>;

  // Orders: customer side
  createOrder(input: CreateOrderRequest): Promise<StoreResult<SellerOrder>>;
  updateOrder(token: string, patch: UpdateOrderRequest): Promise<StoreResult<SellerOrder>>;
  cancelOrder(token: string): Promise<StoreResult<SellerOrder>>;

  // Orders: seller and chef side
  createSellerOrder(
    input: CreateSellerOrderRequest,
    actor: StaffActor,
  ): Promise<StoreResult<SellerOrder>>;
  getByCode(code: string): Promise<SellerOrder | undefined>;
  /** Live orders, newest first. */
  listOrders(): Promise<Array<SellerOrder>>;
  /** Warns (`status_out_of_order`) instead of refusing a jump; `force` goes ahead (D-062). */
  setStatus(
    code: string,
    to: OrderStatus,
    actor: StaffActor,
    force?: boolean,
  ): Promise<StoreResult<SellerOrder>>;
  setPaid(code: string, paid: boolean, actor: StaffActor): Promise<StoreResult<SellerOrder>>;
  setLocked(code: string, locked: boolean): Promise<StoreResult<SellerOrder>>;
  setWaReceived(code: string, received: boolean): Promise<StoreResult<SellerOrder>>;
  nudge(code: string, force?: boolean): Promise<StoreResult<SellerOrder>>;
  markSeen(code: string): Promise<StoreResult<SellerOrder>>;
  /**
   * Bulk updates (stage 7.1), one result per code, in order. A code may be sloppy ("k7f-2qx"). The
   * orders are read together and written in a few batches, however many codes there are.
   */
  sendUpdates(
    rawCodes: ReadonlyArray<string>,
    update: Omit<SendUpdatesRequest, 'codes'>,
    actor: StaffActor,
  ): Promise<Array<UpdateResult>>;

  // Packing, messages, delivery steps, collected (plan 001, stage 4). Each warns instead of
  // refusing; `force` (in the request) goes ahead (D-062).
  /** Ticks and the packed flag. Never changes the status or `updatedAt` (D-066). */
  packOrder(code: string, request: PackRequest): Promise<StoreResult<SellerOrder>>;
  /** The current menu's log, newest first. */
  listMessages(): Promise<Array<MessageLogEntry>>;
  /** Message every not-finished order of a pickup place; `ready_now` also sets them Ready (D-069 Q3). */
  messagePlace(
    placeId: string,
    request: MessagePlaceRequest,
    actor: StaffActor,
  ): Promise<StoreResult<MessagePlaceResponse>>;
  /** Out for delivery, Arriving soon or Delivered for one order. */
  deliveryStep(
    code: string,
    request: DeliveryStepRequest,
    actor: StaffActor,
  ): Promise<StoreResult<DeliveryStepResponse>>;
  /** The quiet seller "Mark collected" (`collectedBy = 'seller'`). Idempotent. */
  markCollected(
    code: string,
    request: MarkCollectedRequest,
    actor: StaffActor,
  ): Promise<StoreResult<SellerOrder>>;
  /** The customer's "I've collected it", by order token (`collectedBy = 'customer'`). Idempotent. */
  customerCollected(token: string): Promise<StoreResult<SellerOrder>>;

  // Web push (plan 004 stage 6): a subscription belongs to an order, reached by its token.
  /** Idempotent per (order, endpoint); only live orders. Never returns the endpoint or keys. */
  subscribePush(token: string, request: PushSubscribeRequest): Promise<StoreResult<true>>;
  /** Removes one browser's subscription from the order. Idempotent. */
  unsubscribePush(token: string, endpoint: string): Promise<StoreResult<true>>;
};

/** Where an order token leads (D-044): a live order, an archived one, or just its week's date. */
export type TokenLookup =
  | { kind: 'live'; sellerRepo: SellerRepository; order: SellerOrder }
  | { kind: 'archived'; sellerRepo: SellerRepository; order: SellerOrder; cookingDate: string }
  | { kind: 'expired'; sellerRepo: SellerRepository; cookingDate: string };

// ---- Sign-in ----

/** A sign-in answer with the session token inside. The route turns the token into the cookie. */
export type SessionGrant = SessionResponse & { token: string };

/** A passkey as kept on a device: public data only. `publicKey` is base64url (COSE). */
export type StoredPasskey = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: Array<string>;
};

/** Registration, as the repository takes it: a password, or a passkey the route already checked. */
export type RegisterInput =
  | { kind: 'password'; password: string; deviceName: string }
  | { kind: 'passkey'; deviceName: string; passkey: StoredPasskey };

/** What a WebAuthn challenge is for, and who may use it. */
export type ChallengeBinding =
  | { purpose: 'register'; sessionToken: string }
  | { purpose: 'authenticate'; clientDeviceId: string };

/** Accounts, devices, sessions, keys, add-device codes and lockouts (D-011, D-013, D-027). */
export type AuthRepository = {
  /** The live session for a token, renewed on use. */
  resolve(token: string | undefined): Promise<Caller | undefined>;
  me(caller: Caller): Promise<Me>;

  adminExists(): Promise<boolean>;
  adminSetup(setupKey: string, deviceId: string): Promise<AuthResult<SessionGrant>>;

  /** Invite key (admin, for a seller) or chef invite (seller, for a chef). Shown once. */
  createKey(
    target:
      { role: 'seller'; sellerId: string } | { role: 'chef'; sellerId: string; chefId: string },
    kind: 'invite' | 'recovery',
  ): Promise<KeyResponse>;
  redeemKey(key: string, deviceId: string): Promise<AuthResult<SessionGrant>>;
  createCode(caller: Caller): Promise<CodeResponse>;
  redeemCode(code: string, deviceId: string): Promise<AuthResult<SessionGrant>>;

  /** A setup session becomes a device with a full session. */
  register(token: string, request: RegisterInput): Promise<AuthResult<SessionGrant>>;
  signInPassword(request: PasswordSignInRequest): Promise<AuthResult<SessionGrant>>;
  /**
   * Passkey sign-in for the device that owns `credentialId`, counted toward the lockout of
   * `clientDeviceId`. `verify` does the WebAuthn check on the stored passkey and answers the new
   * signature counter, or null when it fails; the repository stores the counter on success.
   */
  signInPasskey(
    clientDeviceId: string,
    credentialId: string,
    verify: (passkey: StoredPasskey) => Promise<number | null>,
  ): Promise<AuthResult<SessionGrant>>;
  signOut(token: string): Promise<void>;

  // WebAuthn support: challenges, existing credentials, and the request limiter
  /** Keeps a challenge for CHALLENGE_TTL_MINUTES. */
  saveChallenge(challenge: string, binding: ChallengeBinding): Promise<void>;
  /** True once, for a live challenge made for exactly this binding. It is deleted either way. */
  takeChallenge(challenge: string, binding: ChallengeBinding): Promise<boolean>;
  /** The passkeys already on this account (so one device is not registered twice). */
  passkeysOfAccount(
    accountId: string,
  ): Promise<Array<{ credentialId: string; transports: Array<string> }>>;
  /** Id and transports of a registered credential, for the sign-in options. */
  passkeyById(
    credentialId: string,
  ): Promise<{ credentialId: string; transports: Array<string> } | undefined>;
  /** Counts one request for `scope`; the seconds to wait when over the limit, else 0. */
  rateLimit(scope: string, max: number, windowSeconds: number): Promise<number>;

  devicesOf(caller: Caller): Promise<Array<DeviceView>>;
  /** False when the device is not on the caller's own account. */
  renameDevice(caller: Caller, deviceId: string, name: string): Promise<boolean>;
  revokeOwnDevice(caller: Caller, deviceId: string): Promise<boolean>;
  devicesOfSeller(sellerId: string): Promise<Array<DeviceView>>;
  revokeSellerDevice(sellerId: string, deviceId: string): Promise<boolean>;

  chefDeviceCount(sellerId: string, chefId: string): Promise<number>;
  /** Signs a chef out everywhere: devices and sessions go, the account and password stay. */
  signOutChef(sellerId: string, chefId: string): Promise<number>;
  /** A removed chef loses their account, devices, sessions and open keys. */
  revokeChef(sellerId: string, chefId: string): Promise<void>;
};

// ---- Everything ----

export type Repository = {
  // Sellers (the admin's list, and the customer link `/<slug>`)
  listSellers(): Promise<Array<Seller>>;
  adminSellers(): Promise<Array<AdminSeller>>;
  /** Undefined for an unknown slug / id. */
  sellerBySlug(slug: string): Promise<SellerRepository | undefined>;
  sellerById(id: string): Promise<SellerRepository | undefined>;
  /**
   * The caller has checked the slug (valid, unique). `sampleImages` (local dev only, D-054) starts
   * the kitchen with the five sample pictures; absent means none.
   */
  addSeller(name: string, slug: string, options?: { sampleImages?: boolean }): Promise<AdminSeller>;

  /** Tokens are globally unique: the lookup finds the order's seller. Live, then archived. */
  lookupByToken(token: string): Promise<TokenLookup | undefined>;
  /** Many tokens in a few round trips (My orders). Unknown tokens are left out of the map. */
  lookupByTokens(tokens: ReadonlyArray<string>): Promise<Map<string, TokenLookup>>;
  /** The seller id that holds a live order, for each of these tokens (backup restore must not steal one). */
  liveOrderOwners(tokens: ReadonlyArray<string>): Promise<Map<string, string>>;

  auth: AuthRepository;

  /** Dev tools: only for a local database, and only when DEV_TOOLS is on (see worker/api). */
  dev: {
    addSampleOrders(sellerId: string, count: number): Promise<number>;
    reset(): Promise<void>;
  };
};
