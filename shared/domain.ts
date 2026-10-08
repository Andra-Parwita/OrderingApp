export type Language = 'en' | 'id';
export type LocalText = { en: string; id: string };

/** A kitchen on Delave (D-036). `slug` is the customer link `/<slug>` (D-037); see shared/seller.ts. */
export type Seller = { id: string; slug: string; name: string };
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
};

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
  /** Customer-visible messages, newest first, at most INBOX_MAX. */
  inbox: Array<InboxEntry>;
  enteredBy?: StaffActor;
  /** Last 4 changes, newest first (D-013). */
  audit: Array<AuditEntry>;
  createdAt: string;
  updatedAt: string;
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
> & {
  /** Customers are not seller-scoped: each order says whose it is (My orders spans sellers). */
  seller: SellerRef;
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
};

/** Whether customers can order right now (the switch and the cut-off). */
export type OrderingState = { open: boolean; reason?: 'closed_by_seller' | 'cutoff_passed' };

/** Seller-editable kitchen settings (D-027). */
export type KitchenSettings = {
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
export type MenuItemView = Omit<MenuItem, 'chefId'> & {
  remaining: number | null;
  soldOut: boolean;
};

/** The same item as the seller sees it, with the chef grouping. */
export type SellerMenuItemView = MenuItemView & { chefId?: string };
