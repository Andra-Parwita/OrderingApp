import { parseDeliveryAddress, type DeliveryAddress } from '../../../shared/address';
import type { Fulfilment, Language, OrderStatus, SellerOrder } from '../../../shared/domain';
import type { StatusTone } from '../../theme/tokens';
import {
  ADDRESS_NOTES_MAX,
  ADDRESS_POSTCODE_MAX,
  ADDRESS_STREET_MAX,
  ADDRESS_SUBURB_MAX,
  FIRST_NAME_MAX,
  MAX_MENU_ITEMS,
  MAX_QTY,
  NOTE_MAX,
} from '../../../shared/limits';
import {
  isEventDate,
  isEventTime,
  type CreatePrivateRequest,
  type PrivateDue,
  type PrivateLineInput,
  type UpdatePrivateRequest,
} from '../../../shared/privateContract';
import { isFinalStatus } from '../../../shared/status';
import { parsePriceInput, priceInputOf } from '../../../shared/priceInput';

// Plan 081: the pure rules of the Private screens: the list's date groups, what is still to pay,
// when the day-of Directions button shows, and the editor's draft, checks and request.

export type PrivateView = 'upcoming' | 'past';

// ---- money ----

export function totalCents(order: Pick<SellerOrder, 'lines'>): number {
  return order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

/** Total minus the deposit, never below 0; paid in full is 0. No money is handled by the app. */
export function stillToPayCents(
  total: number,
  paid: boolean,
  depositCents: number | undefined,
): number {
  return paid ? 0 : Math.max(0, total - (depositCents ?? 0));
}

export function orderStillToPay(order: SellerOrder): number {
  return stillToPayCents(totalCents(order), order.paid, order.private?.depositCents);
}

// ---- dates ----

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export type DateGroup = {
  /** The event date, YYYY-MM-DD. */
  date: string;
  /** `today` / `tomorrow` on the Upcoming list; later dates and the Past list show the date itself. */
  label: 'today' | 'tomorrow' | null;
  orders: Array<SellerOrder>;
};

const eventDateOf = (order: SellerOrder) => order.private?.eventDate ?? '';
// An order with no time sorts after the timed ones of its day.
const eventTimeOf = (order: SellerOrder) => order.private?.eventTime ?? '99:99';

/** Orders grouped by event date: Upcoming soonest first, Past latest first; cancelled ones sit in Past. */
export function groupByDate(
  orders: ReadonlyArray<SellerOrder>,
  today: string,
  view: PrivateView,
): Array<DateGroup> {
  const sign = view === 'upcoming' ? 1 : -1;
  const sorted = [...orders].sort(
    (a, b) =>
      sign * eventDateOf(a).localeCompare(eventDateOf(b)) ||
      sign * eventTimeOf(a).localeCompare(eventTimeOf(b)) ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const tomorrow = addDays(today, 1);
  const groups: Array<DateGroup> = [];
  for (const order of sorted) {
    const date = eventDateOf(order);
    let group = groups.find((candidate) => candidate.date === date);
    if (!group) {
      const label =
        view === 'upcoming' && date === today
          ? 'today'
          : view === 'upcoming' && date === tomorrow
            ? 'tomorrow'
            : null;
      group = { date, label, orders: [] };
      groups.push(group);
    }
    group.orders.push(order);
  }
  return groups;
}

/** The count on More (and the rail): private orders due today or tomorrow. */
export function dueCount(due: PrivateDue): number {
  return due.today + due.tomorrow;
}

// ---- the address and the day-of Directions button ----

/** The readable address of an order, or null (none yet, wiped after the event, or unreadable). */
export function readableAddress(order: SellerOrder): DeliveryAddress | null {
  const { address } = order;
  return address && 'address' in address ? address.address : null;
}

/**
 * Plan 081 ruling: on its event day each open delivery row in the list has a Directions button
 * (phone first). Not for pickup, a cancelled or delivered order, or an order with no readable address.
 */
export function showsDayDirections(order: SellerOrder, today: string): boolean {
  return (
    order.private?.eventDate === today &&
    order.fulfilment === 'delivery' &&
    !isFinalStatus(order.status) &&
    readableAddress(order) !== null
  );
}

/** Who may change the order itself (make, edit, cancel, paid): the owner only (no session = the dev owner). */
export function canEditPrivate(role: string | undefined): boolean {
  return role === 'seller' || role === undefined;
}

// ---- the status steps ----

/** The steps of one private order, in order (it starts Confirmed). */
export function stepsFor(fulfilment: Fulfilment): ReadonlyArray<SellerOrder['status']> {
  return fulfilment === 'pickup'
    ? ['confirmed', 'ready_for_pickup', 'collected']
    : ['confirmed', 'out_for_delivery', 'delivered'];
}

/** The index of the current step in `stepsFor` (-1 for a cancelled order). */
export function stepIndex(order: Pick<SellerOrder, 'status' | 'fulfilment'>): number {
  return stepsFor(order.fulfilment).indexOf(order.status);
}

// ---- the editor ----

export type LineDraft = { dishId: string; qty: number; price: string };

export type PrivateDraft = {
  firstName: string;
  language: Language;
  eventDate: string;
  eventTime: string;
  fulfilment: Fulfilment;
  pickupPlaceId: string;
  street: string;
  suburb: string;
  postcode: string;
  addressNotes: string;
  note: string;
  paid: boolean;
  deposit: string;
  lines: Array<LineDraft>;
};

/** A new order starts on delivery, unpaid, on today (the kitchen's date). */
export function emptyDraft(today: string, language: Language, pickupPlaceId = ''): PrivateDraft {
  return {
    firstName: '',
    language,
    eventDate: today,
    eventTime: '',
    fulfilment: 'delivery',
    pickupPlaceId,
    street: '',
    suburb: '',
    postcode: '',
    addressNotes: '',
    note: '',
    paid: false,
    deposit: '',
    lines: [],
  };
}

export function draftOf(order: SellerOrder, fallbackPlaceId = ''): PrivateDraft {
  const address = readableAddress(order);
  return {
    firstName: order.firstName,
    language: order.language,
    eventDate: order.private?.eventDate ?? '',
    eventTime: order.private?.eventTime ?? '',
    fulfilment: order.fulfilment,
    pickupPlaceId: order.pickupPlaceId ?? fallbackPlaceId,
    street: address?.street ?? '',
    suburb: address?.suburb ?? '',
    postcode: address?.postcode ?? '',
    addressNotes: address?.notes ?? '',
    note: order.note ?? '',
    paid: order.paid,
    deposit:
      order.private?.depositCents !== undefined && order.private.depositCents > 0
        ? priceInputOf(order.private.depositCents)
        : '',
    lines: order.lines.map((line) => ({
      dishId: line.itemId,
      qty: line.qty,
      price: priceInputOf(line.priceCents),
    })),
  };
}

export type DraftError =
  | 'name'
  | 'date'
  | 'time'
  | 'lines'
  | 'price'
  | 'deposit'
  | 'depositOver'
  | 'street'
  | 'place'
  | 'note';

/** Each field's problem, empty when the draft can be saved. */
export function draftErrors(draft: PrivateDraft): Partial<Record<DraftError, true>> {
  const errors: Partial<Record<DraftError, true>> = {};
  const name = draft.firstName.trim();
  if (name === '' || name.length > FIRST_NAME_MAX) errors.name = true;
  if (!isEventDate(draft.eventDate)) errors.date = true;
  if (draft.eventTime.trim() !== '' && !isEventTime(draft.eventTime.trim())) errors.time = true;
  if (draft.lines.length === 0 || draft.lines.length > MAX_MENU_ITEMS) errors.lines = true;
  if (draft.lines.some((line) => parsePriceInput(line.price) === null)) errors.price = true;
  if (draft.lines.some((line) => line.qty < 1 || line.qty > MAX_QTY)) errors.lines = true;
  if (draft.deposit.trim() !== '' && parsePriceInput(draft.deposit) === null) errors.deposit = true;
  else if (!draft.paid && draftDepositCents(draft) > draftTotalCents(draft))
    errors.depositOver = true;
  if (draft.fulfilment === 'delivery') {
    if (
      draft.street.trim() === '' ||
      draft.street.trim().length > ADDRESS_STREET_MAX ||
      draft.suburb.trim().length > ADDRESS_SUBURB_MAX ||
      draft.postcode.trim().length > ADDRESS_POSTCODE_MAX ||
      draft.addressNotes.trim().length > ADDRESS_NOTES_MAX
    ) {
      errors.street = true;
    }
  } else if (draft.pickupPlaceId === '') errors.place = true;
  if (draft.note.trim().length > NOTE_MAX) errors.note = true;
  return errors;
}

export function draftLineCents(line: LineDraft): number {
  return (parsePriceInput(line.price) ?? 0) * line.qty;
}

export function draftTotalCents(draft: PrivateDraft): number {
  return draft.lines.reduce((sum, line) => sum + draftLineCents(line), 0);
}

export function draftDepositCents(draft: PrivateDraft): number {
  return draft.deposit.trim() === '' ? 0 : (parsePriceInput(draft.deposit) ?? 0);
}

export function draftStillToPay(draft: PrivateDraft): number {
  return stillToPayCents(draftTotalCents(draft), draft.paid, draftDepositCents(draft));
}

function linesOf(draft: PrivateDraft): Array<PrivateLineInput> {
  return draft.lines.map((line) => ({
    dishId: line.dishId,
    qty: line.qty,
    priceCents: parsePriceInput(line.price) ?? 0,
  }));
}

function addressOfDraft(draft: PrivateDraft): DeliveryAddress | null {
  const notes = draft.addressNotes.trim();
  return parseDeliveryAddress({
    street: draft.street,
    suburb: draft.suburb,
    postcode: draft.postcode,
    ...(notes !== '' ? { notes } : {}),
  });
}

/** The POST body; null while the draft has a problem. */
export function createRequestOf(draft: PrivateDraft): CreatePrivateRequest | null {
  if (Object.keys(draftErrors(draft)).length > 0) return null;
  const note = draft.note.trim();
  const time = draft.eventTime.trim();
  const delivery = draft.fulfilment === 'delivery';
  const address = delivery ? addressOfDraft(draft) : null;
  const deposit = draftDepositCents(draft);
  return {
    firstName: draft.firstName.trim(),
    language: draft.language,
    eventDate: draft.eventDate,
    ...(time !== '' ? { eventTime: time } : {}),
    fulfilment: draft.fulfilment,
    ...(delivery ? {} : { pickupPlaceId: draft.pickupPlaceId }),
    ...(address ? { address } : {}),
    ...(note !== '' ? { note } : {}),
    paid: draft.paid,
    ...(deposit > 0 && !draft.paid ? { depositCents: deposit } : {}),
    lines: linesOf(draft),
  };
}

/** The PATCH body: every field, so what was cleared is cleared (`null` / ''). */
export function updateRequestOf(draft: PrivateDraft): UpdatePrivateRequest | null {
  const create = createRequestOf(draft);
  if (!create) return null;
  const deposit = draftDepositCents(draft);
  return {
    firstName: create.firstName,
    language: create.language,
    eventDate: create.eventDate,
    eventTime: create.eventTime ?? null,
    fulfilment: create.fulfilment,
    pickupPlaceId: create.fulfilment === 'pickup' ? (create.pickupPlaceId ?? null) : null,
    address: create.fulfilment === 'delivery' ? (create.address ?? null) : null,
    note: create.note ?? '',
    paid: create.paid ?? false,
    depositCents: deposit > 0 && !draft.paid ? deposit : null,
    lines: create.lines,
  };
}

export const FIELD_MAX = { name: FIRST_NAME_MAX, note: NOTE_MAX } as const;

/** The status pill's tone. */
export function toneOf(status: OrderStatus): StatusTone {
  switch (status) {
    case 'ordered':
      return 'ordered';
    case 'confirmed':
      return 'confirmed';
    case 'ready_for_pickup':
      return 'ready';
    case 'out_for_delivery':
      return 'outForDelivery';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'done';
  }
}
