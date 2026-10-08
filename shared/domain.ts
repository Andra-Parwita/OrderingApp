export type Language = 'en' | 'id';
export type LocalText = { en: string; id: string };

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
/** `detail` is the new status for `status`, and 'paid' or 'unpaid' for `paid`. */
export type AuditEntry = { by: Actor; what: AuditWhat; detail?: string; at: string };

/** A snapshot of the item as it was when ordered (D-020). */
export type OrderLine = {
  itemId: string;
  name: LocalText;
  size: LocalText;
  priceCents: number;
  qty: number;
};

export type Order = {
  id: string;
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
  enteredBy?: StaffActor;
  /** Last 4 changes, newest first (D-013). */
  audit: Array<AuditEntry>;
  createdAt: string;
  updatedAt: string;
};

export type Chef = { id: string; name: string };

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

export type Kitchen = { name: string; tagline: LocalText; bannerImageUrl?: string };

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

/** A menu item plus what is left of its limit (null = unlimited). */
export type MenuItemView = MenuItem & { remaining: number | null; soldOut: boolean };
