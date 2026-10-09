import type { SellerMenuItemView } from '../../../shared/domain';
import { ITEM_DESCRIPTION_MAX, ITEM_NAME_MAX, ITEM_SIZE_MAX } from '../../../shared/limits';
import type { CreateItemRequest, UpdateItemRequest } from '../../../shared/setupContract';

export const PRICE_MAX_CENTS = 1_000_000;
export const LIMIT_MAX = 10_000;

/** "10", "10.00", "10,50", "$10" to cents; null when it is not a price. */
export function parsePriceInput(text: string): number | null {
  const match = /^\s*\$?\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*$/.exec(text);
  const whole = match?.[1];
  if (whole === undefined) return null;
  const cents = Number(whole) * 100 + Number((match?.[2] ?? '').padEnd(2, '0'));
  return cents <= PRICE_MAX_CENTS ? cents : null;
}

/** Cents to the text of the price field: 1050 becomes "10.50". */
export function priceInputOf(cents: number): string {
  return `${String(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, '0')}`;
}

export type ItemDraft = {
  nameEn: string;
  nameId: string;
  descEn: string;
  descId: string;
  sizeEn: string;
  sizeId: string;
  price: string;
  limit: string;
  /** '' means no chef. */
  chefId: string;
  soldOut: boolean;
};

export const EMPTY_DRAFT: ItemDraft = {
  nameEn: '',
  nameId: '',
  descEn: '',
  descId: '',
  sizeEn: '',
  sizeId: '',
  price: '',
  limit: '',
  chefId: '',
  soldOut: false,
};

export function draftOf(item: SellerMenuItemView): ItemDraft {
  return {
    nameEn: item.name.en,
    nameId: item.name.id,
    descEn: item.description.en,
    descId: item.description.id,
    sizeEn: item.size.en,
    sizeId: item.size.id,
    price: priceInputOf(item.priceCents),
    limit: item.limit === undefined ? '' : String(item.limit),
    chefId: item.chefId ?? '',
    soldOut: item.manualSoldOut === true,
  };
}

export type ItemErrors = Partial<{
  name: 'required' | 'tooLong';
  descEn: 'tooLong';
  descId: 'tooLong';
  sizeEn: 'tooLong';
  sizeId: 'tooLong';
  price: 'invalid';
  limit: 'invalid';
}>;

export function validateDraft(draft: ItemDraft): {
  errors: ItemErrors;
  priceCents: number;
  limit: number | null;
} {
  const errors: ItemErrors = {};
  const nameEn = draft.nameEn.trim();
  const nameId = draft.nameId.trim();
  if (nameEn === '' && nameId === '') errors.name = 'required';
  else if (nameEn.length > ITEM_NAME_MAX || nameId.length > ITEM_NAME_MAX) errors.name = 'tooLong';
  if (draft.descEn.trim().length > ITEM_DESCRIPTION_MAX) errors.descEn = 'tooLong';
  if (draft.descId.trim().length > ITEM_DESCRIPTION_MAX) errors.descId = 'tooLong';
  if (draft.sizeEn.trim().length > ITEM_SIZE_MAX) errors.sizeEn = 'tooLong';
  if (draft.sizeId.trim().length > ITEM_SIZE_MAX) errors.sizeId = 'tooLong';
  const priceCents = parsePriceInput(draft.price);
  if (priceCents === null) errors.price = 'invalid';
  let limit: number | null = null;
  const limitText = draft.limit.trim();
  if (limitText !== '') {
    const value = /^\d+$/.test(limitText) ? Number(limitText) : 0;
    if (value < 1 || value > LIMIT_MAX) errors.limit = 'invalid';
    else limit = value;
  }
  return { errors, priceCents: priceCents ?? 0, limit };
}

const text = (en: string, id: string) => ({ en: en.trim(), id: id.trim() });

export function createRequestOf(draft: ItemDraft): CreateItemRequest | null {
  const { errors, priceCents, limit } = validateDraft(draft);
  if (Object.keys(errors).length > 0) return null;
  return {
    name: text(draft.nameEn, draft.nameId),
    description: text(draft.descEn, draft.descId),
    size: text(draft.sizeEn, draft.sizeId),
    priceCents,
    ...(limit !== null ? { limit } : {}),
    ...(draft.chefId !== '' ? { chefId: draft.chefId } : {}),
  };
}

/** Every field is sent, so an emptied limit or chef is removed. */
export function updateRequestOf(draft: ItemDraft): UpdateItemRequest | null {
  const { errors, priceCents, limit } = validateDraft(draft);
  if (Object.keys(errors).length > 0) return null;
  return {
    name: text(draft.nameEn, draft.nameId),
    description: text(draft.descEn, draft.descId),
    size: text(draft.sizeEn, draft.sizeId),
    priceCents,
    limit,
    chefId: draft.chefId === '' ? null : draft.chefId,
    soldOut: draft.soldOut,
  };
}
