import type { DeliveryAddress } from './address';
export type Language = 'en' | 'id';
export type LocalText = { en: string; id: string };

/** A kitchen on Delave (D-036). `slug` is the customer link `/<slug>` (D-037); see shared/seller.ts. */
/** `demo` (plan 013): the admin made this a demo kitchen. The server always sets it; fixtures may omit it. */
export type Seller = {
  id: string;
  slug: string;
  name: string;
  demo?: boolean;
  /** Plan 032: set by the admin. `customers`: closed to customers only; `full`: staff are out too. */
  paused?: PauseKind;
};
/** The two ways to pause a kitchen (D-086). */
export type PauseKind = 'full' | 'customers';
/** What an order tells a customer about its seller. */
export type SellerRef = Pick<Seller, 'slug' | 'name'>;

export type Fulfilment = 'pickup' | 'delivery';

export type OrderStatus =
  | 'ordered'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'collected'
  | 'delivered'
  | 'cancelled';

export type ActorRole = 'customer' | 'seller' | 'chef';
export type Actor = { role: ActorRole; name: string };
/** Who entered an order on a customer's behalf (D-010 / D-013). */
export type StaffActor = { role: 'seller' | 'chef'; name: string };

export type AuditWhat = 'created' | 'edited' | 'status' | 'paid';

/** What a customer edit changed (D-027 row 7). Language-neutral; format with formatAuditDiff. */
export type AuditDiff = {
  /** Quantity change per item; names come from the order's snapshot lines. */
  items: Array<{ itemId: string; name: LocalText; delta: number }>;
  note?: true;
  fulfilment?: { from: Fulfilment; to: Fulfilment };
};

/**
 * `detail` is the new status for `status`, and 'paid' or 'unpaid' for `paid`. `diff` is set on
 * customer `edited` entries.
 */
export type AuditEntry = {
  by: Actor;
  what: AuditWhat;
  detail?: string;
  diff?: AuditDiff;
  at: string;
};

export type InboxKind = 'status' | 'nudge' | 'message';
/**
 * A message the customer sees on their order. Keys and data only, never translated text: the
 * screen translates `textKey` (with `minutes`) or shows the seller's own `text`.
 */
export type InboxEntry = {
  at: string;
  kind: InboxKind;
  status?: OrderStatus;
  textKey?: string;
  text?: string;
  minutes?: number;
};

/** A snapshot of the item as it was when ordered (D-020). */
export type OrderLine = {
  itemId: string;
  name: LocalText;
  size: LocalText;
  priceCents: number;
  qty: number;
  /** Seller-only packing tick (D-066). Absent means not ticked; never in the customer's view. */
  ticked?: boolean;
  /** Plan 081: a private order's line keeps the chef of the library dish it was copied from. */
  chefId?: string;
};

export type CollectedBy = 'customer' | 'seller';

/** Plan 071: a delivery address as the kitchen's team reads it. */
export type OrderAddress = { address: DeliveryAddress } | { unavailable: true };

/** The full order, as the seller and chefs see it. */
export type SellerOrder = {
  id: string;
  /** The seller that owns the order (D-036). */
  sellerId: string;
  /** Raw 6-character code; display it with formatOrderCode. */
  code: string;
  /** Long random token for the customer's private link. */
  token: string;
  firstName: string;
  language: Language;
  lines: Array<OrderLine>;
  fulfilment: Fulfilment;
  note?: string;
  status: OrderStatus;
  /** The seller's own reference; no payments in the app. */
  paid: boolean;
  /** Seller lock: the customer can no longer change or cancel (D-027). */
  locked: boolean;
  /** The seller ticked "WhatsApp received". */
  waReceived: boolean;
  /** The customer's phone had a collected/delivered order when this one was placed. */
  returning: boolean;
  /** The customer edited after placing; cleared by the seller's next status change or "seen". */
  changed: boolean;
  /**
   * Plan 071: the customer changed the delivery address. `new` until a team member taps "Got it"
   * (then `seen`); another change makes it `new` again. The old address is never kept.
   */
  addressChanged?: 'new' | 'seen';
  /** Customer-visible messages, newest first, at most INBOX_MAX. */
  inbox: Array<InboxEntry>;
  enteredBy?: StaffActor;
  /** Last 4 changes, newest first (D-013). */
  audit: Array<AuditEntry>;
  /** plan 001 stage 4. The pickup place (id) of a pickup order; absent counts as the menu's first. */
  pickupPlaceId?: string;
  /**
   * Plan 071 (D-099): the delivery address, added only by the seller-side routes (never stored in
   * this shape, never in a customer view, a backup, a label or a log). `unavailable`: one exists but
   * cannot be read (the key changed or was lost).
   */
  address?: OrderAddress;
  /**
   * Plan 071 (D-099): the anonymous code the customer's phone made for this kitchen. Seller-side
   * reads only (never in a customer view); lets the seller's device link repeat orders.
   */
  customerCode?: string;
  /** Plan 087: placed by a customer with a full Remember me session; set only by the server. */
  confirmed?: true;
  /** Kitchen · Pack (D-066): a flag only. Never changes the status, never shown to the customer. */
  packed?: boolean;
  /** When and by whom the hand-over was confirmed; both or neither. */
  collectedAt?: string;
  collectedBy?: CollectedBy;
  /** Plan 081: set only on a private (Khusus) order; a menu order has none. */
  private?: PrivateInfo;
  createdAt: string;
  updatedAt: string;
};

/** Plan 081: what makes an order private. `eventDate` is kitchen-local (YYYY-MM-DD), `eventTime` HH:MM. */
export type PrivateInfo = {
  eventDate: string;
  eventTime?: string;
  /** Deposit already paid, in cents (optional; no money is handled by the app). */
  depositCents?: number;
};

/** Seller-side name kept so existing seller code keeps compiling. */
export type Order = SellerOrder;

/** What the customer's own link may show: no audit, paid, WhatsApp, returning or changed. */
export type CustomerOrder = Pick<
  SellerOrder,
  | 'id'
  | 'code'
  | 'token'
  | 'firstName'
  | 'language'
  | 'lines'
  | 'fulfilment'
  | 'note'
  | 'status'
  | 'locked'
  | 'inbox'
  | 'createdAt'
  | 'updatedAt'
  | 'pickupPlaceId'
  | 'collectedAt'
  | 'paid'
> & {
  /** Plan 081: a private order's event and what is still to pay (total minus deposit, or 0 when paid). */
  private?: PrivateInfo & { toPayCents: number };
  /** Customers are not seller-scoped: each order says whose it is (My orders spans sellers). */
  seller: SellerRef;
  /**
   * Plan 071: whether the kitchen holds an address for this order. Never the address itself.
   * `unreadable` = it cannot be read any more, so the order page asks for it again. Absent = none.
   */
  addressState?: 'saved' | 'unreadable';
  /** Plan 071: after the customer changed the address, whether the kitchen has seen the change. */
  addressChange?: 'waiting' | 'seen';
  /** Set when the seller closed the week (D-044): the order is read-only. `cookingDate` goes with it. */
  archived?: true;
  /** Local date (YYYY-MM-DD) of the closed week; present with `archived`. */
  cookingDate?: string;
};

export type Chef = { id: string; sellerId: string; name: string };

export type MenuItem = {
  id: string;
  name: LocalText;
  description: LocalText;
  size: LocalText;
  priceCents: number;
  /** Portion limit; absent means unlimited. */
  limit?: number;
  chefId?: string;
  /** Manual "Sold out" switch (D-020), distinct from the portion limit running out. */
  soldOut?: boolean;
  /** Plan 029 (D-083): can be pre-ordered. Absent = yes; `false` = on the day only. */
  preorder?: boolean;
  /** Plan 029: portions sold at the stall on the day. Absent = not sold on the day. Never sent to customers. */
  dayStock?: number;
  /** Plan 067: the dish's picture (a copy of the library dish's), square 600 x 600. */
  pictureRef?: string;
};

/** Seller images and colour (D-035, D-038). Each is optional; the phone banner falls back to the desktop one. */
export type KitchenImages = {
  /** 2:1, shown at the top of the expanded left menu. */
  railImage?: string;
  /** Square, shown in the collapsed left menu; without it the seller's initial is shown. */
  railIcon?: string;
  desktopBanner?: string;
  phoneBanner?: string;
  /** "#rrggbb", behind the banners and beside them on wide screens. */
  bannerBackground?: string;
  /** Soft picture behind the wide banner (D-040); the colour above shows while it loads. */
  bannerBackgroundImage?: string;
  alt?: LocalText;
};

export type Kitchen = {
  sellerId: string;
  name: string;
  tagline: LocalText;
  bannerImageUrl?: string;
  images?: KitchenImages;
  /** The seller's own WhatsApp number, digits with country code (public, D-027). */
  whatsappNumber?: string;
  /** Plan 077: the kitchen's IANA time zone. Absent from an older payload = the default. */
  timeZone?: string;
};

/** Whether customers can order right now (the switch and the cut-off). */
export type OrderingState = {
  open: boolean;
  reason?: 'closed_by_seller' | 'cutoff_passed' | 'kitchen_closed' | 'not_published';
};

/** Plan 056: the languages customers see. "both" = English and Indonesian with a switch. */
export type Languages = 'both' | 'en' | 'id';

/** Seller-editable kitchen settings (D-027). */
export type KitchenSettings = {
  /** Absent = "both" (an older client or backup). */
  languages?: Languages;
  /**
   * Plan 060: with "both", the language a customer sees until they switch. Absent / null = not chosen
   * (the customer keeps the phone's language). On a save, absent keeps the stored one and null clears it;
   * what the server sends back never has null.
   */
  firstLanguage?: Language | null;
  whatsappNumber?: string;
  postGreeting: LocalText;
  postClosing: LocalText;
  orderingOpen: boolean;
};

export type PickupPoint = {
  id: string;
  place: string;
  directions: LocalText;
  /** Local times on the cooking date, 24h "HH:MM". */
  window: { start: string; end: string };
  /** Plan 076: optional address and map pin of the place (public); lat and lng come together. */
  address?: string;
  lat?: number;
  lng?: number;
};

export type Delivery = { available: boolean; note: LocalText };

export type Week = {
  /** Local date, YYYY-MM-DD. */
  cookingDate: string;
  /** ISO instant with offset. */
  cutoffAt: string;
  status: 'draft' | 'published';
  pickupPoints: Array<PickupPoint>;
  delivery: Delivery;
};

/** A menu item as customers see it: what is left of its limit (null = unlimited), no chef (D-012). */
export type MenuItemView = Omit<MenuItem, 'chefId' | 'dayStock'> & {
  remaining: number | null;
  soldOut: boolean;
  /** Plan 029: also sold on the day. Only this flag, never the count. */
  onTheDay?: 'available' | 'sold_out';
};

/** The same item as the seller sees it, with the chef grouping. */
export type SellerMenuItemView = MenuItemView & {
  chefId?: string;
  /** Plan 029: the day stock left (absent = not sold on the day). */
  dayStock?: number;
  /** The seller switched it to sold out (`soldOut` is also true when the limit ran out). */
  manualSoldOut?: boolean;
};
